import {
  DOORS,
  ROOMS,
  roomAt,
  doorOpen,
  clearPath,
  barrierDistance,
} from "../shared/map.js";
import { Navigation } from "./navigation.js";
import { playerProgression, progressionMethods } from "./progression.js";
import { combatMethods } from "./combat.js";
import { casinoExpansionMethods } from "./casino-expansion.js";
import {
  ENEMIES,
  damageMultiplier,
  maxHealth,
  grenadeLimit,
  contractFor,
} from "../shared/expansion.js";
import {
  dealPoker,
  drawPoker,
  rollCraps,
  finishCraps,
  dealBaccarat,
} from "./extra-games.js";
import {
  WEAPONS,
  STATIONS,
  OBSTACLES,
  SPAWNS,
  moveCircle,
  aimRay,
} from "../shared/data.js";
import { giveReward } from "./casino.js";
import { roundSettings } from "../shared/casino-rules.js";
import {
  spinSlots,
  validateBets,
  spinRoulette,
  blackjack,
  playHand,
  advanceBlackjack,
} from "./table-games.js";
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export class Game {
  constructor(code, rng = Math.random) {
    this.code = code;
    this.rng = rng;
    this.players = {};
    this.zombies = [];
    this.chips = [];
    this.time = 0;
    this.round = 0;
    this.phase = "lobby";
    this.timer = 0;
    this.pending = 0;
    this.spawnTimer = 0;
    this.serial = 0;
    this.events = [];
    this.games = {};
    this.difficulty = roundSettings(1, 1);
    this.history = [];
    this.openRooms = ["atrium"];
    this.nav = new Navigation();
    this.navTime = 0;
    this.hazards = [];
    this.pickups = [];
    this.spawned = 0;
    this.jackpot = 250;
    this.contract = null;
  }
  event(type, data = {}) {
    this.events.push({ id: ++this.serial, type, ...data });
  }
  addPlayer(id, name) {
    if (Object.keys(this.players).length >= 4) return false;
    const index = Object.keys(this.players).length;
    this.players[id] = {
      id,
      name: String(name || "Guest").slice(0, 18),
      x: index * 1.4 - 2,
      z: 10,
      yaw: 0,
      pitch: 0,
      hp: 100,
      armor: 0,
      down: false,
      chips: 25,
      guns: [{ id: "courtesy", ammo: 12, reserve: 60, power: 1 }],
      selected: 0,
      stash: { sidearm: 0, automatic: 0, rifle: 0, shells: 0 },
      reload: 0,
      cooldown: 0,
      input: {},
      inputAt: 0,
      losses: 0,
      revive: 0,
      kills: 0,
      ready: false,
      ...playerProgression(),
    };
    this.clearReady();
    if (this.phase === "combat") this.scaleTeam();
    return true;
  }
  removePlayer(id) {
    delete this.players[id];
    for (const [k, g] of Object.entries(this.games))
      if (g.player === id) delete this.games[k];
    this.clearReady();
  }
  action(id, msg) {
    const p = this.players[id];
    if (!p) return;
    if (msg.type === "input") {
      const i = msg.input || {};
      p.input = {
        forward: Math.max(-1, Math.min(1, Number(i.forward) || 0)),
        right: Math.max(-1, Math.min(1, Number(i.right) || 0)),
        shoot: !!i.shoot,
        sprint: !!i.sprint,
        aim: !!i.aim,
        revive: !!i.revive,
      };
      p.yaw = Number.isFinite(i.yaw) ? i.yaw : p.yaw;
      p.pitch = Number.isFinite(i.pitch)
        ? Math.max(-0.65, Math.min(0.65, i.pitch))
        : p.pitch;
      p.inputAt = this.time;
      return;
    }
    if (
      msg.type === "start" &&
      (this.phase === "lobby" || this.phase === "over")
    ) {
      this.restart();
      return;
    }
    if (p.down || !["combat", "break"].includes(this.phase)) return;
    if (msg.type === "buy") return this.buy(p, msg.item);
    if (msg.type === "dodge") return this.dodge(p);
    if (msg.type === "grenade") return this.grenade(p);
    if (msg.type === "risk") return this.startRisk(p, msg.station, msg.color);
    if (msg.type === "vault") return this.vaultAction(p, msg.choice);
    if (msg.type === "odds") return this.changeOdds(p, msg.amount);
    if (msg.type === "unlock") {
      this.unlock(p, msg.door);
      return;
    }
    if (msg.type === "draw" && this.phase === "break") {
      const g = this.games.poker;
      if (g?.player === id && drawPoker(g, msg.holds))
        this.event("card", { player: id });
      return;
    }
    if (msg.type === "roll" && this.phase === "break") {
      const g = this.games.craps;
      if (g?.player === id) rollCraps(g, this.rng);
      return;
    }
    if (msg.type === "nextRound") {
      this.readyPlayer(p);
      return;
    }
    if (msg.type === "collect" && this.phase === "break") {
      const g = this.games[msg.station];
      if (g?.player === id && g.phase === "result")
        delete this.games[msg.station];
      return;
    }
    if (msg.type === "reload") {
      const gun = p.guns[p.selected],
        w = WEAPONS[gun.id];
      if (!p.reload && gun.ammo < w.mag && gun.reserve > 0)
        p.reload = w.reload * (1 - (p.perks.reload || 0) * 0.15);
    }
    if (
      msg.type === "switch" &&
      !p.reload &&
      !Object.values(this.games).some(
        (g) => g.player === id && g.phase !== "result",
      )
    )
      p.selected = (p.selected + 1) % p.guns.length;
    if (msg.type === "gamble") this.gamble(p, msg);
    if (["hit", "stand", "double", "split", "surrender"].includes(msg.type))
      this.cardAction(p, msg.type);
  }
  unlock(p, id) {
    const door = DOORS.find((d) => d.id === id);
    if (
      !door ||
      door.shortcut ||
      p.down ||
      doorOpen(door, this.openRooms) ||
      !this.openRooms.includes(door.from) ||
      this.openRooms.includes(door.to) ||
      Math.hypot(p.x - door.x, p.z - door.z) > 3 ||
      roomAt(p)?.id !== door.from
    )
      return;
    const room = ROOMS.find((r) => r.id === door.to);
    if (p.chips < room.cost) {
      this.event("notice", {
        player: p.id,
        text: room.name + " requires " + room.cost + " chips.",
      });
      return;
    }
    p.chips -= room.cost;
    this.openRooms.push(room.id);
    this.clearReady();
    this.nav.key = "";
    this.navTime = 0;
    this.event("unlock", {
      room: room.id,
      player: p.id,
      text: p.name + " opened " + room.name + " for the crew.",
    });
  }
  clearReady() {
    for (const p of Object.values(this.players)) p.ready = false;
  }
  scaleTeam() {
    const next = roundSettings(this.round, Object.keys(this.players).length);
    if (next.team <= this.difficulty.team) return;
    this.pending += next.count - this.difficulty.count;
    for (const z of this.zombies) {
      const previousMax = z.maxHp || z.hp;
      z.hp = Math.ceil((z.hp * next.hp) / this.difficulty.hp);
      z.maxHp = Math.ceil((previousMax * next.hp) / this.difficulty.hp);
    }
    this.difficulty = next;
  }
  readyPlayer(p) {
    if (this.phase !== "break") return;
    if (Object.values(this.games).some((g) => g.phase !== "result")) {
      this.event("notice", {
        player: p.id,
        text: "Finish the active casino hands before starting the next round.",
      });
      return;
    }
    if (Object.values(this.players).some((p) => p.down)) {
      this.event("notice", {
        player: p.id,
        text: "Revive your teammates before the next round.",
      });
      return;
    }
    p.ready = !p.ready;
    if (Object.values(this.players).every((p) => p.ready)) this.startRound();
  }
  startRound() {
    this.round++;
    this.phase = "combat";
    this.games = {};
    this.clearReady();
    this.difficulty = roundSettings(
      this.round,
      Object.keys(this.players).length,
    );
    this.pending = this.difficulty.count;
    this.spawnTimer = 0;
    this.spawned = 0;
    this.hazards = [];
    this.contract = contractFor(this.round, this.difficulty.count);
    for (const p of Object.values(this.players)) {
      p.secondWindUsed = false;
      p.grenades = grenadeLimit(p);
      p.stamina = 100;
    }
    this.event("round", { round: this.round });
  }
  restart() {
    for (const p of Object.values(this.players)) {
      const id = p.id,
        name = p.name;
      delete this.players[id];
      this.addPlayer(id, name);
    }
    this.round = 0;
    this.zombies = [];
    this.chips = [];
    this.games = {};
    this.phase = "break";
    this.timer = null;
    this.history = [];
    this.hazards = [];
    this.pickups = [];
    this.jackpot = 250;
    this.contract = null;
    this.spawned = 0;
    this.openRooms = ["atrium"];
    this.nav = new Navigation();
    this.navTime = 0;
    this.clearReady();
    this.event("notice", {
      text: "The floor is yours. Gamble, gear up, then start the next round.",
    });
  }
  gamble(p, msg) {
    if (this.phase !== "break") {
      this.event("notice", {
        player: p.id,
        text: "Casino games reopen when the round is cleared.",
      });
      return;
    }
    const s = STATIONS.find((s) => s.id === msg.station);
    if (
      !s ||
      !this.openRooms.includes(s.room) ||
      roomAt(p)?.id !== s.room ||
      !clearPath(p, s, this.openRooms) ||
      dist(p, s) > s.r + 2.4 ||
      this.games[s.id] ||
      Object.values(this.games).some(
        (g) => g.player === p.id && g.phase !== "result",
      )
    )
      return;
    let cost = s.cost;
    const lines = msg.lines === 3 ? 3 : 1,
      stake = [25, 50, 100].includes(msg.stake) ? msg.stake : 25;
    if (s.type === "slots") cost = lines * stake;
    if (s.type === "blackjack")
      cost = [50, 100, 200].includes(msg.wager) ? msg.wager : 50;
    if (s.type === "roulette") {
      cost = validateBets(msg.bets, p.chips);
      if (cost === null) {
        this.event("notice", {
          player: p.id,
          text: "Place valid bets: 10–500 chips per position, 1,000 maximum per spin.",
        });
        return;
      }
    }
    if (["poker", "craps"].includes(s.type))
      cost = [25, 50, 100].includes(msg.wager) ? msg.wager : 25;
    if (s.type === "baccarat")
      cost = [20, 40, 100].includes(msg.wager) ? msg.wager : 20;
    if (s.type === "craps" && !["pass", "dont"].includes(msg.bet)) return;
    if (s.type === "baccarat" && !["player", "banker", "tie"].includes(msg.bet))
      return;
    if (p.chips < cost) {
      this.event("notice", {
        player: p.id,
        text: "Not enough chips. The house does not extend credit.",
      });
      return;
    }
    p.chips -= cost;
    this.recordWager(p, cost);
    this.clearReady();
    p.input.shoot = false;
    const g = {
      station: s.id,
      player: p.id,
      phase: "playing",
      remaining: 4.8,
      duration: 4.8,
      startedAt: this.time,
      cost,
    };
    if (s.type === "slots") {
      this.jackpot += Math.max(1, Math.floor(cost * 0.05));
      p.vaultSpins++;
      if (p.vaultSpins >= 5) {
        g.unlockVault = true;
        p.vaultSpins = 0;
      }
      Object.assign(g, spinSlots(lines, stake, p.losses, this.rng), {
        lines,
        stake,
      });
      p.losses = g.awards.length ? 0 : p.losses + 1;
    }
    if (s.type === "roulette") {
      Object.assign(g, spinRoulette(msg.bets, this.rng));
      g.bets = msg.bets.map((b) => ({ ...b }));
      g.remaining = g.duration = 6;
      g.awards =
        g.reward === "dud" ? [] : [{ reward: g.reward, multiplier: 1 }];
    }
    if (s.type === "blackjack") {
      Object.assign(g, blackjack(cost, this.rng));
    }
    if (s.type === "poker") Object.assign(g, dealPoker(this.rng));
    if (s.type === "craps")
      Object.assign(g, {
        bet: msg.bet,
        lineCost: cost,
        odds: 0,
        point: 0,
        dice: [],
        rolls: [],
        phase: "decision",
        remaining: null,
      });
    if (s.type === "baccarat")
      Object.assign(g, dealBaccarat(msg.bet, cost, this.rng));
    this.games[s.id] = g;
    this.event("wager", { player: p.id, station: s.id, cost });
  }
  cardAction(p, action) {
    const g = this.games.blackjack;
    if (this.phase !== "break" || !g || g.player !== p.id) return;
    const before = g.cost;
    if (playHand(g, action, p)) {
      if (g.cost > before) this.recordWager(p, g.cost - before);
      this.event("card", { player: p.id });
    }
  }
  payTable(g) {
    const p = this.players[g.player];
    if (!p || g.paid) return;
    g.paid = true;
    const before = p.chips;
    p.chips += g.returned || 0;
    for (const a of g.awards || []) giveReward(p, a.reward, a.multiplier);
    g.reward =
      (g.awards || []).find(
        (a) =>
          a.reward === "slotJackpot" ||
          a.reward === "gildedHouse" ||
          a.reward === "sovereign",
      )?.reward ||
      g.awards?.[0]?.reward ||
      "dud";
    g.phase = "result";
    g.remaining = null;
    g.riskCredit = p.chips - before;
    g.credited = g.riskCredit;
    this.recordHand(p, g, g.riskCredit - g.cost);
    if (g.station === "roulette") {
      this.history.unshift(g.pocket);
      this.history = this.history.slice(0, 12);
    }
    this.event("payout", {
      player: g.player,
      station: g.station,
      reward: g.reward,
      result: g.result,
      returned: g.returned || 0,
    });
    if (g.unlockVault) this.openVault(g);
  }
  shoot(p) {
    const gun = p.guns[p.selected],
      w = WEAPONS[gun.id];
    if (p.cooldown > 0 || p.reload || gun.ammo <= 0) return;
    gun.ammo--;
    p.cooldown = w.interval;
    const hits = [];
    for (let i = 0; i < (w.pellets || 1); i++) {
      const yaw = p.yaw + (i ? (this.rng() - 0.5) * 2 * w.spread : 0),
        pitch = p.pitch + (i ? (this.rng() - 0.5) * 2 * w.spread : 0);
      const { dir, origin } = aimRay(
        p,
        yaw,
        pitch,
        p.input.aim,
        this.openRooms,
      );
      hits.push(this.fireRay(p, gun, dir, origin));
    }
    this.event("shot", {
      player: p.id,
      weapon: gun.id,
      x: p.x,
      y: 1.4,
      z: p.z,
      end: hits[0].end,
      ends: hits.map((h) => h.end),
      hit: hits.some((h) => h.hit),
      head: hits.some((h) => h.head && h.hit),
    });
  }
  fireRay(p, gun, dir, origin) {
    const w = WEAPONS[gun.id];
    let nearest = Math.min(55, barrierDistance(origin, dir, this.openRooms)),
      target = null,
      head = false;
    const sphere = (x, y, z, r) => {
      const vx = x - origin.x,
        vy = y - origin.y,
        vz = z - origin.z,
        t = vx * dir.x + vy * dir.y + vz * dir.z,
        d2 = vx * vx + vy * vy + vz * vz - t * t;
      return t > 0 && d2 < r * r ? t - Math.sqrt(r * r - d2) : Infinity;
    };
    for (const o of OBSTACLES) {
      const t = sphere(o.x, o.h * 0.5, o.z, o.r);
      if (t < nearest) {
        nearest = t;
        target = null;
      }
    }
    for (const z of this.zombies) {
      const scale = ENEMIES[z.kind]?.scale || 1;
      const body = sphere(z.x, 0.95 * scale, z.z, 0.53 * scale),
        h = sphere(z.x, 1.68 * scale, z.z, 0.3 * scale),
        t = Math.min(body, h);
      if (t < nearest) {
        nearest = t;
        target = z;
        head = h <= body;
      }
    }
    if (target && !clearPath(p, target, this.openRooms)) target = null;
    // Reject shots whose muzzle is blocked by furniture, even if the shoulder camera can see over it.
    if (target) {
      for (const o of OBSTACLES) {
        const vx = target.x - p.x,
          vz = target.z - p.z,
          l = vx * vx + vz * vz,
          t = ((o.x - p.x) * vx + (o.z - p.z) * vz) / l;
        if (
          o.h > 1.2 &&
          t > 0 &&
          t < 1 &&
          Math.hypot(p.x + vx * t - o.x, p.z + vz * t - o.z) < o.r
        ) {
          target = null;
          break;
        }
      }
    }
    const end = {
      x: origin.x + dir.x * nearest,
      y: origin.y + dir.y * nearest,
      z: origin.z + dir.z * nearest,
    };
    if (target) {
      target.hp -= w.damage * damageMultiplier(gun) * (head ? 2.2 : 1);
      target.stun = 0.16;
      if (target.hp <= 0) {
        this.killEnemy(target, p, head);
      }
    }
    return { end, hit: !!target, head };
  }
  update(dt) {
    this.time += dt;
    if (!["combat", "break"].includes(this.phase)) return;
    const players = Object.values(this.players),
      alive = players.filter((p) => !p.down);
    if (!players.length) return;
    if (!alive.length) {
      this.phase = "over";
      this.event("notice", { text: "THE HOUSE ALWAYS WINS" });
      return;
    }
    this.updateTactics(dt, players);
    for (const p of players) {
      if (this.time - p.inputAt > 0.3) p.input = {};
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (p.reload) {
        p.reload = Math.max(0, p.reload - dt);
        if (!p.reload) {
          const gun = p.guns[p.selected],
            n = Math.min(WEAPONS[gun.id].mag - gun.ammo, gun.reserve);
          gun.ammo += n;
          gun.reserve -= n;
        }
      }
      if (p.down) {
        const rescuer = alive.find(
          (a) =>
            a.input.revive &&
            dist(a, p) < 2.3 &&
            clearPath(a, p, this.openRooms),
        );
        p.revive = rescuer ? p.revive + dt : Math.max(0, p.revive - dt * 2);
        if (p.revive >= 3) {
          p.down = false;
          p.hp = 60;
          p.revive = 0;
          this.event("notice", { text: `${p.name} is back on their feet.` });
        }
        continue;
      }
      const i = p.input;
      const f = i.forward || 0,
        r = i.right || 0,
        len = Math.max(1, Math.hypot(f, r)),
        speed = i.sprint && !i.aim ? 6 : 3.8;
      moveCircle(
        p,
        ((-Math.sin(p.yaw) * f + Math.cos(p.yaw) * r) / len) * speed * dt,
        ((-Math.cos(p.yaw) * f - Math.sin(p.yaw) * r) / len) * speed * dt,
        0.4,
        this.openRooms,
      );
      if (i.shoot && p.dodgeTime <= 0) this.shoot(p);
    }
    for (const [id, g] of Object.entries(this.games)) {
      if (g.remaining === null) continue;
      g.remaining -= dt;
      if (g.remaining <= 0) {
        if (g.phase === "risk") this.finishRisk(g);
        else if (id === "blackjack") {
          if (advanceBlackjack(g)) this.payTable(g);
        } else if (id === "craps" && g.phase === "rolling") {
          if (finishCraps(g)) this.payTable(g);
        } else if (g.phase === "playing") this.payTable(g);
      }
    }
    if (this.phase === "combat") {
      this.navTime -= dt;
      if (this.navTime <= 0) {
        this.nav.build(alive, this.openRooms);
        this.navTime = 0.4;
      }
      this.spawnTimer -= dt;
      if (
        this.pending > 0 &&
        this.spawnTimer <= 0 &&
        this.zombies.length < this.difficulty.cap
      ) {
        const ranked = SPAWNS.filter((s) => this.openRooms.includes(s.room))
          .map((s) => ({
            s,
            score: Math.min(
              ...alive.map((p) => {
                const dx = s.x - p.x,
                  dz = s.z - p.z,
                  d = Math.hypot(dx, dz);
                const dot = (dx * -Math.sin(p.yaw) + dz * -Math.cos(p.yaw)) / d;
                return d + (dot < 0.3 ? 12 : 0);
              }),
            ),
          }))
          .sort((a, b) => b.score - a.score);
        const s = ranked[Math.floor(this.rng() * Math.min(2, ranked.length))].s;
        this.zombies.push(this.makeEnemy(s));
        this.pending--;
        this.spawnTimer = this.difficulty.interval;
      }
      for (const z of this.zombies) {
        const target = alive.reduce(
          (best, p) => (dist(p, z) < dist(best, z) ? p : best),
          alive[0],
        );
        this.specialAttack(z, target, dt);
        z.attack -= dt;
        z.stun = Math.max(0, z.stun - dt);
        const d = dist(z, target);
        const ranged =
          z.kind === "spitter" && clearPath(z, target, this.openRooms);
        if (ranged && d < 4 && !z.stun) {
          moveCircle(
            z,
            ((z.x - target.x) / Math.max(0.01, d)) * z.speed * dt,
            ((z.z - target.z) / Math.max(0.01, d)) * z.speed * dt,
            0.43,
            this.openRooms,
          );
        } else if (d > 1 && !z.stun && !(ranged && d < 8)) {
          const waypoint =
            d < 2 && clearPath(z, target, this.openRooms)
              ? target
              : this.nav.target(z);
          if (waypoint) {
            const dx = waypoint.x - z.x,
              dz = waypoint.z - z.z,
              l = Math.hypot(dx, dz);
            if (l > 0.02)
              moveCircle(
                z,
                (dx / l) * z.speed * dt,
                (dz / l) * z.speed * dt,
                0.43,
                this.openRooms,
              );
          }
          for (const other of this.zombies) {
            if (other.id <= z.id) continue;
            const dd = dist(z, other);
            if (dd > 0 && dd < 0.8) {
              const push = (0.8 - dd) * 0.25;
              moveCircle(
                z,
                ((z.x - other.x) / dd) * push,
                ((z.z - other.z) / dd) * push,
                0.43,
                this.openRooms,
              );
            }
          }
        } else if (
          d <= 1.3 &&
          !z.stun &&
          z.kind !== "brute" &&
          z.attack <= 0 &&
          clearPath(z, target, this.openRooms)
        ) {
          this.hurt(target, ENEMIES[z.kind]?.damage || 18);
          z.attack = 1;
        }
      }
      if (!this.pending && !this.zombies.length) {
        this.phase = "break";
        this.timer = null;
        this.clearReady();
        this.hazards = [];
        for (const p of players) {
          p.chips += 25 + (this.contract?.complete ? this.contract.reward : 0);
          if (this.contract?.complete) p.comps++;
          p.hp = p.down ? p.hp : Math.min(maxHealth(p), p.hp + 25);
          const gun = p.guns[p.selected];
          gun.reserve += 12;
        }
        this.event("notice", {
          text: `FLOOR CLEARED · 25 chips + ammo${this.contract?.complete ? ` · CONTRACT +${this.contract.reward} chips + 1 comp` : ""}. Place your bets.`,
        });
      }
    }
    this.chips = this.chips.filter((c) => {
      c.age += dt;
      const p = alive.reduce(
        (best, p) => (dist(p, c) < dist(best, c) ? p : best),
        alive[0],
      );
      const d = dist(p, c);
      if (
        d < 4 + (p.perks.magnet || 0) * 2 &&
        clearPath(c, p, this.openRooms)
      ) {
        c.x += (p.x - c.x) * Math.min(1, dt * 7);
        c.z += (p.z - c.z) * Math.min(1, dt * 7);
      }
      if (d < 0.65 && clearPath(c, p, this.openRooms)) {
        p.chips += c.value;
        this.event("chip", { player: p.id, value: c.value });
        return false;
      }
      return this.phase === "break" || c.age < 100;
    });
  }
  snapshot() {
    return {
      code: this.code,
      phase: this.phase,
      round: this.round,
      timer: this.timer,
      time: this.time,
      difficulty: this.difficulty,
      history: this.history,
      openRooms: [...this.openRooms],
      pending: this.pending,
      hazards: this.hazards,
      pickups: this.pickups,
      contract: this.contract,
      jackpot: this.jackpot,
      players: Object.values(this.players).map(({ input, inputAt, ...p }) => p),
      zombies: this.zombies,
      chips: this.chips,
      games: Object.fromEntries(
        Object.entries(this.games).map(([id, g]) => {
          const {
            deck,
            playerCards,
            bankerCards,
            playerTotal,
            bankerTotal,
            natural,
            winner,
            reward,
            stops,
            grid,
            awards,
            protection,
            pocket,
            wins,
            returned,
            result,
            vaultHidden,
            riskHidden,
            ...safe
          } = g;
          const elapsed = g.duration - (g.remaining || 0);
          return [
            id,
            {
              ...safe,
              ...(id === "baccarat"
                ? {
                    playerCards: playerCards.map((c, i) =>
                      g.phase === "result" || elapsed > 1 + i * 0.7
                        ? c
                        : { rank: 0, suit: "?" },
                    ),
                    bankerCards: bankerCards.map((c, i) =>
                      g.phase === "result" || elapsed > 1.3 + i * 0.7
                        ? c
                        : { rank: 0, suit: "?" },
                    ),
                  }
                : {}),
              ...(id === "craps" && g.phase === "rolling" ? { dice: [] } : {}),
              ...(g.phase === "result" || g.paid
                ? {
                    playerTotal,
                    bankerTotal,
                    natural,
                    winner,
                    reward,
                    stops,
                    grid,
                    awards,
                    protection,
                    pocket,
                    wins,
                    returned,
                    result,
                  }
                : {}),
              reelStops: stops?.map((stop, i) =>
                g.phase === "result" || elapsed > 2.2 + i * 0.8 ? stop : null,
              ),
              // The final pocket becomes visible only after betting has locked, for a continuous landing animation.
              landingPocket:
                g.station === "roulette" &&
                (g.phase === "result" || g.remaining <= 2)
                  ? pocket
                  : undefined,
              dealer: g.dealer
                ? ["decision", "dealing"].includes(g.phase)
                  ? [g.dealer[0], { rank: 0, suit: "?" }]
                  : g.dealer
                : undefined,
            },
          ];
        }),
      ),
      events: this.events.splice(0),
    };
  }
}
Object.assign(
  Game.prototype,
  progressionMethods,
  combatMethods,
  casinoExpansionMethods,
);
