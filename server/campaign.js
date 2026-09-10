import { DEVICES, newCampaign } from "../shared/campaign.js";
import { DOORS, ROOMS, ROOM_SPAWNS, roomAt, clearPath } from "../shared/map.js";
import { WEAPONS, moveCircle } from "../shared/data.js";
const near = (p, o, r = 3) => Math.hypot(p.x - o.x, p.z - o.z) <= r;
export const campaignMethods = {
  crewAction(p, msg) {
    if (!["combat", "break"].includes(this.phase) || p.down || p.offline)
      return;
    const c = this.campaign;
    if (msg.choice === "ping" || msg.choice === "ammoRequest") {
      if (this.time < (p.pingAt || 0)) return;
      p.pingAt = this.time + 2;
      c.pings = c.pings.filter((v) => v.player !== p.id);
      c.pings.push({
        player: p.id,
        x: p.x,
        z: p.z,
        room: roomAt(p)?.id,
        label: msg.choice === "ammoRequest" ? "NEED AMMO" : "REGROUP HERE",
        until: this.time + 12,
      });
      this.event("notice", {
        text: `${p.name}: ${msg.choice === "ammoRequest" ? "Need ammo" : "Regroup"} · ${roomAt(p)?.name}`,
      });
      return;
    }
    if (msg.choice === "shove") {
      if (
        this.phase !== "combat" ||
        p.stamina < 20 ||
        this.time < (p.shoveAt || 0)
      )
        return;
      p.stamina -= 20;
      p.shoveAt = this.time + 1;
      for (const z of this.zombies) {
        const dx = z.x - p.x,
          dz = z.z - p.z,
          d = Math.hypot(dx, dz);
        if (
          d < 2.5 &&
          (-Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz) / Math.max(0.1, d) >
            0.25 &&
          clearPath(p, z, this.openRooms)
        ) {
          z.hp -= 20;
          z.stun = 0.8;
          moveCircle(
            z,
            (dx / Math.max(d, 0.1)) * 0.75,
            (dz / Math.max(d, 0.1)) * 0.75,
            0.43,
            this.openRooms,
          );
          if (z.hp <= 0) this.killEnemy(z, p, false, false, false);
        }
      }
      this.event("shove", { player: p.id, x: p.x, z: p.z });
      return;
    }
    if (msg.choice === "shareAmmo") {
      const target = this.players[msg.target],
        gun = p.guns[p.selected];
      if (
        !target ||
        target.id === p.id ||
        target.offline ||
        !near(p, target, 3) ||
        !clearPath(p, target, this.openRooms) ||
        gun.reserve < 1
      )
        return;
      const receiver = target.guns.find(
        (g) => WEAPONS[g.id].category === WEAPONS[gun.id].category,
      );
      if (!receiver) return;
      const count = Math.min(WEAPONS[gun.id].mag, gun.reserve);
      gun.reserve -= count;
      receiver.reserve += count;
      this.event("notice", {
        text: `${p.name} shared ${count} rounds with ${target.name}.`,
      });
      return;
    }
    if (msg.choice === "donate") {
      const door = DOORS.find((d) => d.id === msg.door),
        room = ROOMS.find((r) => r.id === door?.to);
      if (
        !door ||
        door.shortcut ||
        this.phase !== "break" ||
        this.busy(p.id) ||
        !this.openRooms.includes(door.from) ||
        this.openRooms.includes(door.to) ||
        roomAt(p)?.id !== door.from ||
        !near(p, door)
      )
        return;
      const amount = Math.min(
        50,
        p.chips,
        room.cost - (c.donations[room.id] || 0),
      );
      if (amount <= 0) return;
      p.chips -= amount;
      c.donations[room.id] = (c.donations[room.id] || 0) + amount;
      this.clearReady();
      if (c.donations[room.id] >= room.cost) {
        this.openRooms.push(room.id);
        this.nav.key = "";
        this.event("unlock", {
          room: room.id,
          player: p.id,
          text: `The crew opened ${room.name}.`,
        });
      }
      return;
    }
    if (msg.choice === "repair") {
      const index = Number(msg.entrance),
        entry = ROOM_SPAWNS[index];
      if (
        !entry ||
        !this.openRooms.includes(entry.room) ||
        !near(p, entry) ||
        p.chips < 10 ||
        this.time < (p.repairAt || 0) ||
        (c.barricades[index] || 0) >= 3
      )
        return;
      p.chips -= 10;
      p.repairAt = this.time + 1;
      c.barricades[index] = (c.barricades[index] || 0) + 1;
      this.event("purchase", {
        player: p.id,
        text: "Barricade repaired · incoming enemies delayed",
      });
      return;
    }
    const device = DEVICES.find((d) => d.id === msg.choice);
    if (
      !device ||
      !this.openRooms.includes(device.room) ||
      !near(p, device) ||
      !clearPath(p, device, this.openRooms)
    )
      return;
    if (device.id.startsWith("trap-")) {
      if (
        !c.power ||
        this.phase !== "combat" ||
        p.chips < device.cost ||
        this.time < (c.traps[device.id]?.cooldown || 0)
      )
        return;
      p.chips -= device.cost;
      c.traps[device.id] = {
        until: this.time + 8,
        cooldown: this.time + 28,
        owner: p.id,
        tick: 0,
      };
      this.event("purchase", {
        player: p.id,
        text: device.name + " activated · 8 seconds",
      });
      return;
    }
    if (this.phase !== "break" || this.busy() || p.chips < device.cost) {
      if (device.id === "power" && this.phase === "break" && this.busy())
        this.event("notice", {
          player: p.id,
          text: "Finish active casino hands before restoring power.",
        });
      return;
    }
    if (device.id === "power" && !c.power) {
      p.chips -= device.cost;
      c.power = true;
      this.event("notice", {
        text: "POWER RESTORED · Traps and vault terminals are online.",
      });
    }
    if (device.id === "archive" && c.power && !c.archive) {
      c.archive = true;
      this.event("notice", {
        text: "VAULT CODE RECOVERED · Defeat two bosses to challenge the House.",
      });
    }
    if (
      device.id === "finale" &&
      c.power &&
      c.archive &&
      c.keys >= 2 &&
      !c.defeated
    ) {
      c.finale = true;
      this.event("notice", {
        text: "THE HOUSE HAS ACCEPTED · Ready up to begin the finale.",
      });
    }
    if (device.id === "extract" && c.defeated) {
      c.votes = c.votes.includes(p.id)
        ? c.votes.filter((id) => id !== p.id)
        : [...c.votes, p.id];
      if (
        Object.values(this.players)
          .filter((v) => !v.offline)
          .every((v) => c.votes.includes(v.id))
      ) {
        c.extracted = true;
        this.phase = "over";
        this.finishRun();
        this.event("notice", { text: "YOU BEAT THE HOUSE · CREW EXTRACTED" });
      }
    }
    this.clearReady();
  },
  busy(player) {
    return (
      Object.values(this.players).some(
        (p) => (!player || p.id === player) && p.wheelSpin,
      ) ||
      Object.values(this.games).some(
        (g) => (!player || g.player === player) && g.phase !== "result",
      ) ||
      Object.values(this.crewTables || {}).some((t) =>
        Object.values(t.seats).some(
          (s) =>
            (!player || s.player === player) &&
            (s.cost > 0 || s.bets?.length) &&
            t.phase !== "result",
        ),
      )
    );
  },
  updateCampaign(dt) {
    const c = this.campaign;
    const boss = this.zombies.find((z) => z.finalBoss && z.hp > 0);
    if (
      boss &&
      boss.hp < boss.maxHp * 0.67 &&
      this.time > (boss.summonAt || 0)
    ) {
      boss.summonAt = this.time + 12;
      for (const side of [-1, 1]) {
        const z = this.makeEnemy({ x: boss.x + side * 2, z: boss.z + 2 });
        z.kind = "runner";
        z.hp = 90;
        z.maxHp = 90;
        z.speed = 3;
        this.zombies.push(z);
      }
      this.event("notice", {
        text: "THE HOUSE CALLS ITS COLLECTORS · Keep moving!",
      });
      if (boss.hp < boss.maxHp * 0.34)
        for (const p of Object.values(this.players).filter(
          (p) => !p.down && !p.offline,
        ))
          this.hazards.push({
            id: ++this.serial,
            kind: "acid",
            x: p.x,
            z: p.z,
            radius: 1.8,
            delay: 1.4,
            total: 1.4,
            life: 4,
            damage: 12,
          });
    }
    c.pings = c.pings.filter((p) => p.until > this.time);
    for (const d of DEVICES.filter((d) => d.id.startsWith("trap-"))) {
      const trap = c.traps[d.id];
      if (!trap || trap.until < this.time || this.phase !== "combat") continue;
      trap.tick -= dt;
      if (trap.tick > 0) continue;
      trap.tick = 0.5;
      const owner =
        this.players[trap.owner] ||
        Object.values(this.players).find((p) => !p.offline);
      if (!owner) continue;
      for (const z of this.zombies)
        if (z.hp > 0 && near(z, d, 4) && clearPath(z, d, this.openRooms)) {
          z.hp -= 70;
          z.stun = 0.35;
          if (z.hp <= 0) this.killEnemy(z, owner, false, false, false);
        }
    }
  },
  finishRun() {
    if (this.summary) return;
    this.summary = {
      id: this.runId,
      round: this.round,
      clearedRound: this.campaign.extracted
        ? this.round
        : Math.max(0, this.round - 1),
      extracted: !!this.campaign.extracted,
      rooms: this.openRooms.length,
      seconds: Math.floor(this.time - this.runStarted),
      players: Object.values(this.players).map((p) => ({
        id: p.id,
        name: p.name,
        kills: p.kills,
        headshots: p.headshots,
        revives: p.revives || 0,
        hands: p.handsPlayed || 0,
        net: p.casinoNet,
        chips: p.chips,
        damage: p.damageDealt || 0,
        shots: p.shots || 0,
        hits: p.hits || 0,
        weaponKills: p.weaponKills || {},
      })),
    };
  },
};
