import {
  ENEMIES,
  enemyType,
  maxHealth,
  grenadeLimit,
} from "../shared/expansion.js";
import { WEAPONS, moveCircle } from "../shared/data.js";
import { clearPath } from "../shared/map.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const combatMethods = {
  makeEnemy(spawn) {
    const kind = this.specialRound
        ? (this.spawned++, "goose")
        : enemyType(this.round, this.spawned++),
      stats = ENEMIES[kind];
    const hp = Math.ceil(this.difficulty.hp * stats.hp);
    return {
      id: ++this.serial,
      kind,
      x: spawn.x + this.rng() - 0.5,
      z: spawn.z + this.rng() - 0.5,
      hp,
      maxHp: hp,
      speed: this.difficulty.speed * stats.speed,
      attack: 0,
      special: 2.5,
      stun: 0,
    };
  },
  dodge(p) {
    const cost = 35 - (p.perks.dodge || 0) * 10;
    if (
      p.down ||
      p.height > 0 ||
      p.dodgeTime > 0 ||
      p.stamina < cost ||
      !["break", "combat"].includes(this.phase)
    )
      return;
    const f = p.input.forward || 0,
      r = p.input.right || 0,
      len = Math.hypot(f, r) || 1;
    p.dodgeX =
      (-Math.sin(p.yaw) * (f || (!r ? 1 : 0)) + Math.cos(p.yaw) * r) / len;
    p.dodgeZ =
      (-Math.cos(p.yaw) * (f || (!r ? 1 : 0)) - Math.sin(p.yaw) * r) / len;
    p.stamina -= cost;
    p.dodgeTime = 0.34;
    this.event("dodge", { player: p.id, x: p.x, z: p.z });
  },
  grenade(p) {
    if (
      p.down ||
      this.phase !== "combat" ||
      !p.grenades ||
      p.grenadeCooldown > 0
    )
      return;
    p.grenades--;
    p.grenadeCooldown = 0.6;
    const target = { x: p.x, z: p.z };
    moveCircle(
      target,
      -Math.sin(p.yaw) * 7,
      -Math.cos(p.yaw) * 7,
      0.2,
      this.openRooms,
    );
    this.hazards.push({
      id: ++this.serial,
      kind: "grenade",
      x: target.x,
      z: target.z,
      fromX: p.x,
      fromZ: p.z,
      radius: 3.5,
      delay: 0.85,
      total: 0.85,
      life: 0.85,
      player: p.id,
      damage: 180 * (1 + (p.perks.blast || 0) * 0.25),
    });
    this.event("throw", { player: p.id });
  },
  hurt(p, amount) {
    if (p.down || p.dodgeTime > 0 || p.invulnerable > 0) return;
    amount *= 1 - (p.perks.toughness || 0) * 0.08;
    const absorbed = Math.min(p.armor || 0, amount);
    p.armor = (p.armor || 0) - absorbed;
    p.hp = Math.max(0, p.hp - (amount - absorbed));
    this.event("hurt", { player: p.id });
    if (p.hp <= 0) {
      if ((p.perks.secondWind && !p.secondWindUsed) || p.reviveTokens > 0) {
        if (p.perks.secondWind && !p.secondWindUsed) p.secondWindUsed = true;
        else p.reviveTokens--;
        p.hp = 60;
        p.invulnerable = 3;
        this.event("notice", {
          player: p.id,
          text: "SECOND WIND · Back in the game. 3 seconds of protection.",
        });
      } else {
        p.down = true;
        p.input = {};
        p.reload = 0;
      }
    }
  },
  killEnemy(z, p, head = false, grenade = false, weaponCredit = true) {
    if (!this.zombies.includes(z)) return;
    this.zombies = this.zombies.filter((other) => other !== z);
    p.kills++;
    if (head) p.headshots++;
    if (weaponCredit && !grenade) {
      p.weaponKills ||= {};
      const weapon = p.guns[p.selected].id;
      p.weaponKills[weapon] = (p.weaponKills[weapon] || 0) + 1;
    }
    if (z.kind === "boss") {
      if (z.finalBoss) this.campaign.defeated = true;
      else this.campaign.keys = Math.min(2, this.campaign.keys + 1);
    }
    p.combo = this.time < p.comboUntil ? Math.min(10, p.combo + 1) : 1;
    p.comboUntil = this.time + 4;
    p.bestCombo = Math.max(p.bestCombo, p.combo);
    this.progressContract("kills");
    if (head) this.progressContract("headshots");
    if (grenade) this.progressContract("grenadeKills");
    const bonus =
      Math.floor(p.combo / 3) * 2 +
      (z.kind === "boss"
        ? 75
        : ["brute", "security"].includes(z.kind)
          ? 10
          : 0);
    for (let i = 0; i < 3; i++)
      this.chips.push({
        id: ++this.serial,
        x: z.x + this.rng() - 0.5,
        z: z.z + this.rng() - 0.5,
        value: i === 0 ? 5 + bonus : 1,
        age: 0,
      });
    if (p.kills % 5 === 0 || z.kind === "boss")
      this.pickups.push({
        id: ++this.serial,
        x: z.x,
        z: z.z,
        kind:
          z.kind === "boss"
            ? "jackpot"
            : p.kills % 10 === 0
              ? "medkit"
              : "ammo",
        life: 40,
      });
    this.event("death", {
      x: z.x,
      z: z.z,
      head,
      player: p.id,
      kind: z.kind,
      combo: p.combo,
      bonus,
    });
  },
  specialAttack(z, target, dt) {
    z.special = (z.special ?? 3) - dt;
    const brute = ["brute", "security"].includes(z.kind);
    if (
      !["spitter", "boss", "brute", "security"].includes(z.kind) ||
      z.special > 0 ||
      distance(z, target) > (brute ? 2.6 : 13) ||
      !clearPath(z, target, this.openRooms)
    )
      return;
    const boss = z.kind === "boss";
    const points = brute
      ? [z]
      : boss
        ? [
            { x: target.x, z: target.z },
            { x: target.x + 2.5, z: target.z },
            { x: target.x - 2.5, z: target.z },
          ]
        : [target];
    for (const point of points) {
      if (!clearPath(z, point, this.openRooms)) continue;
      const delay = brute ? 0.85 : boss ? 1.35 : 1.1;
      this.hazards.push({
        id: ++this.serial,
        kind: boss || brute ? "slam" : "acid",
        x: point.x,
        z: point.z,
        radius: brute ? 2.3 : boss ? 2.1 : 1.65,
        delay,
        total: delay,
        life: brute ? 1 : boss ? 1.5 : 4.1,
        damage: z.kind === "security" ? 24 : brute ? 32 : boss ? 30 : 9,
        tick: 0,
      });
    }
    z.special =
      z.kind === "security"
        ? 5
        : brute
          ? 3.2
          : boss
            ? Math.max(2.6, 5 * (z.hp / z.maxHp))
            : 5;
    z.stun = brute ? 0.9 : 0.55;
  },
  updateTactics(dt, players) {
    for (const p of players) {
      if (p.down) {
        p.height = 0;
        p.jumpVelocity = 0;
      } else if (p.height > 0 || p.jumpVelocity > 0) {
        p.jumpVelocity = (p.jumpVelocity || 0) - 18 * dt;
        p.height = Math.max(0, (p.height || 0) + p.jumpVelocity * dt);
        if (!p.height) p.jumpVelocity = 0;
      }
      p.stamina = Math.min(100, p.stamina + dt * (p.dodgeTime > 0 ? 0 : 23));
      p.grenadeCooldown = Math.max(0, p.grenadeCooldown - dt);
      p.invulnerable = Math.max(0, (p.invulnerable || 0) - dt);
      if (p.comboUntil < this.time) p.combo = 0;
      if (p.dodgeTime > 0) {
        if (!p.down)
          moveCircle(
            p,
            p.dodgeX * 11 * dt,
            p.dodgeZ * 11 * dt,
            0.4,
            this.openRooms,
          );
        p.dodgeTime = Math.max(0, p.dodgeTime - dt);
      }
    }
    for (const h of this.hazards) {
      h.life -= dt;
      h.delay -= dt;
      h.tick = (h.tick || 0) - dt;
      if (h.delay > 0) continue;
      if (["grenade", "rocket"].includes(h.kind)) {
        const owner = this.players[h.player];
        if (owner)
          for (const z of [...this.zombies])
            if (distance(z, h) < h.radius && clearPath(h, z, this.openRooms)) {
              z.hp -= h.damage * (1 - distance(z, h) / (h.radius * 2));
              z.stun = 0.8;
              if (z.hp <= 0)
                this.killEnemy(z, owner, false, h.kind === "grenade");
            }
        h.life = 0;
        this.event("explosion", { x: h.x, z: h.z });
      } else if (h.tick <= 0) {
        for (const p of players)
          if (
            !(p.height > 0.35) &&
            distance(p, h) < h.radius &&
            clearPath(h, p, this.openRooms)
          )
            this.hurt(p, h.damage);
        h.tick = 0.65;
      }
    }
    this.hazards = this.hazards.filter((h) => h.life > 0);
    this.pickups = this.pickups.filter((item) => {
      item.life -= dt;
      const p = players.find(
        (p) =>
          !p.down &&
          distance(p, item) < 1.5 &&
          clearPath(p, item, this.openRooms),
      );
      if (!p) return item.life > 0;
      if (item.kind === "ammo" || item.kind === "jackpot")
        for (const gun of p.guns)
          if (!WEAPONS[gun.id].melee)
            gun.reserve += Math.ceil(
              WEAPONS[gun.id].mag * 2 * (1 + (p.perks.scavenger || 0) * 0.25),
            );
      if (item.kind === "medkit" || item.kind === "jackpot")
        p.hp = Math.min(maxHealth(p), p.hp + 40);
      if (item.kind === "jackpot") {
        p.grenades = grenadeLimit(p);
        p.comps += 3;
      }
      this.event("pickup", {
        player: p.id,
        text:
          item.kind === "ammo"
            ? "AMMO CACHE · All weapons supplied"
            : item.kind === "medkit"
              ? "FIRST AID · +40 health"
              : "BOSS CACHE · Ammo, health, grenades + 3 comps",
      });
      return false;
    });
  },
};
