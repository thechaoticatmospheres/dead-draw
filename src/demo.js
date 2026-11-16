// An isolated local adapter around the SAME authority used by multiplayer.
// No sockets, persistence, career unlocks, or live-room state enter this module.
import { Game } from "../server/game.js";
import { ROOMS, DOORS, clearPath, roomAt } from "../shared/map.js";
import { STATIONS, WEAPONS, OBSTACLES, aimRay } from "../shared/data.js";
import { DEVICES } from "../shared/campaign.js";
import { enemyHitVolumes } from "../shared/expansion.js";

export const DEMO_ID = "local-demo-survivor";
export const DEMO_STEP = 1 / 60;
export const DEMO_STATES = [
  "atrium", "combat", "intermission", "power", "late-game", "house",
  "extraction", "defeat", "restart", "restored-power", "power-up", "casino", "stress",
  ...ROOMS.map((r) => r.id), ...STATIONS.map((s) => s.id),
];
export function seededRandom(seed = 1978) {
  let n = Number(seed) >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function demoOptions(search = "") {
  const q = new URLSearchParams(search);
  const requested = ["auto", "seed", "state", "t", "view"].some((k) => q.has(k));
  const seed = /^-?\d+$/.test(q.get("seed") || "") ? Number(q.get("seed")) >>> 0 : 1978;
  const candidate = q.get("state") || (q.get("auto") === "1" ? "tour" : "combat");
  const stateName = candidate === "tour" || DEMO_STATES.includes(candidate) ? candidate : "atrium";
  const seconds = Number(q.get("t"));
  return {
    requested, seed, stateName,
    auto: q.get("auto") === "1",
    freezeAt: q.has("t") && Number.isFinite(seconds) ? Math.max(0, Math.min(600, seconds)) : null,
    view: q.get("view") || "player",
    power: q.has("power") ? q.get("power") === "1" : null,
  };
}
const gun = (id) => ({ id, ammo: WEAPONS[id].mag, reserve: WEAPONS[id].reserve, power: 1 });
const fixturePlace = (p, room, ox = 1.5, oz = 3.5) => {
  const r = ROOMS.find((r) => r.id === room) || ROOMS[0];
  Object.assign(p, { x: r.x + ox, z: r.z + oz, yaw: 0, pitch: -0.035 });
};

export class LocalDemo {
  constructor({ seed = 1978, stateName = "combat", auto = false, freezeAt = null, view = "player", attract = false, power = null } = {}) {
    this.seed = seed >>> 0;
    this.auto = auto;
    this.attract = attract;
    this.view = view;
    this.powerOverride = power;
    this.stateName = stateName;
    this.elapsedTicks = 0;
    this.accumulator = 0;
    this.sequence = 0;
    this.stage = -1;
    this.actions = new Set();
    this.freezeAt = freezeAt;
    this.frozen = false;
    this.input = {};
    this.game = new Game("LOCAL-DEMO", seededRandom(this.seed));
    this.game.addPlayer(DEMO_ID, "Guest survivor");
    this.fixture(stateName === "tour" ? "combat" : stateName);
    this.game.events = [];
    if (freezeAt !== null) this.seek(freezeAt);
  }
  get player() { return this.game.players[DEMO_ID]; }
  get time() { return this.elapsedTicks * DEMO_STEP; }
  fixture(name) {
    const g = this.game;
    g.restart();
    g.testing = true; // Also makes every summary ineligible for recordRun().
    g.runId = `LOCAL-DEMO-${this.seed}-${this.sequence++}`;
    g.runStarted = g.time;
    this.actions.clear();
    this.fixtureName = name;
    const p = this.player;
    fixturePlace(p, "atrium", 1.7, 3.5);
    if (name === "stress") {
      for (let i = 1; i <= 3; i++) g.addPlayer(`local-demo-crew-${i}`, ["Rose", "Vincent", "June"][i-1]);
      g.openRooms = ROOMS.map((r) => r.id);
      g.campaign.power = true;
      const weapons = ["minigun", "rpg", "tesla", "flamethrower"];
      Object.values(g.players).forEach((member, index) => {
        Object.assign(member, { x: -1.5 + index * 1.7, z: 11.8, armor: 100, guns: [gun(weapons[index])] });
      });
      g.round = 10;
      g.startRound();
      let spawned = 0;
      for (let row = 0; row < 6 && spawned < 40; row++) {
        for (let column = 0; column < 10 && spawned < 40; column++) {
          const spawn = {x:-6.3 + column*1.35, z:1.4 + row*1.05};
          if (OBSTACLES.some((o)=>Math.hypot(o.x-spawn.x,o.z-spawn.z)<o.r+.7)) continue;
          g.zombies.push(g.makeEnemy(spawn));
          spawned++;
        }
      }
      g.pending = Math.max(0,g.pending-spawned);
    } else if (name === "combat") {
      g.startRound();
      // Three of wave one's normal enemies enter immediately for the playable preview.
      for (const spawn of [{ x: 2.8, z: 4 }, { x: 4.4, z: 5.5 }, { x: 0.5, z: 2.8 }]) {
        if (g.pending <= 0) break;
        g.zombies.push(g.makeEnemy(spawn));
        g.pending--;
      }
    } else if (name === "intermission" || name === "casino") {
      p.chips = 225;
      fixturePlace(p, "atrium", -3, -0.1);
    } else if (STATIONS.some((s) => s.id === name)) {
      const station = STATIONS.find((s) => s.id === name);
      g.openRooms = ROOMS.map((r) => r.id);
      p.chips = 1000;
      Object.assign(p, { x: station.x, z: station.z + station.r + 1.2, yaw: 0, pitch: -.06 });
    } else if (["power", "restored-power", "power-up", "late-game", "house"].includes(name)) {
      g.openRooms = ROOMS.map((r) => r.id);
      g.round = 10;
      p.chips = 450;
      p.guns = [gun("sovereign"), gun("railgun")];
      p.armor = 100;
      Object.assign(g.campaign, { power: !["power", "power-up", "restored-power"].includes(name), keys: 2, archive: true });
      fixturePlace(p, ["power", "power-up", "restored-power"].includes(name) ? "sapphire" : "eclipse");
      if (["power", "power-up", "restored-power"].includes(name)) {
        p.x = DEVICES[0].x + 1.5;
        p.z = DEVICES[0].z + 1.8;
        if (name !== "power-up") g.action(DEMO_ID, {type:"crew", choice:"power"});
      }
      if (name === "house") {
        g.campaign.finale = true;
        g.startRound();
        fixturePlace(p, "eclipse", 3.7, 4.2);
      }
    } else if (name === "extraction") {
      g.openRooms = ROOMS.map((r) => r.id);
      g.round = 11;
      Object.assign(g.campaign, { power: true, keys: 2, archive: true, defeated: true });
      Object.assign(p, { x: 4.3, z: 10.5, chips: 1275 });
    } else if (name === "defeat") {
      g.round = 3;
      p.down = true;
      p.hp = 0;
      g.update(DEMO_STEP); // Actual defeat/summary path.
    } else if (name === "restart") {
      p.down = true;
      p.hp = 0;
      g.update(DEMO_STEP);
      this.action({ type: "start" });
    } else if (ROOMS.some((r) => r.id === name)) {
      if (name !== "atrium") g.openRooms = ROOMS.map((r) => r.id);
      fixturePlace(p, name);
    }
    if (this.powerOverride !== null) g.campaign.power = this.powerOverride;
    g.testing = true;
    g.nav.key = "";
    this.input = { yaw: this.player.yaw, pitch: this.player.pitch };
  }
  action(message) {
    const restarting = message.type === "start" &&
      ["lobby", "over"].includes(this.game.phase);
    // An ending capture can become a playable run through the existing restart
    // button. Every other frozen action, including start during combat, stays inert.
    if (this.frozen && !(restarting && this.game.phase === "over")) return;
    this.game.action(DEMO_ID, message);
    // Game.restart intentionally clears testing for a real run. Local runs never do.
    this.game.testing = true;
    if (restarting) {
      this.frozen = false;
      this.freezeAt = null;
      this.elapsedTicks = 0;
      this.accumulator = 0;
      this.stageTime = 0;
      this.actions.clear();
      this.input = { yaw: this.player.yaw, pitch: this.player.pitch };
      this.view = "player";
      this.attract = false;
      this.game.runId = `LOCAL-DEMO-${this.seed}-${this.sequence++}`;
      this.auto = false;
      this.stateName = "restart";
      this.fixtureName = "restart";
    }
  }
  once(key, callback) {
    if (this.actions.has(key)) return;
    this.actions.add(key);
    callback();
  }
  bot(p = this.player) {
    const g = this.game;
    if (p.down) return {};
    if (g.phase === "combat") {
      const enemies = g.zombies.filter((z) => clearPath(p, z, g.openRooms));
      const target = enemies.sort((a, b) => Math.hypot(p.x-a.x, p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z))[0];
      if (target) {
        const distance = Math.hypot(target.x-p.x,target.z-p.z);
        let yaw = Math.atan2(p.x-target.x,p.z-target.z);
        const volume = enemyHitVolumes(target).head;
        // Solve from the real shoulder camera origin, accounting for its side offset.
        for (let i=0;i<3;i++) {
          const {origin} = aimRay(p,yaw,0,true,g.openRooms);
          yaw = Math.atan2(origin.x-target.x,origin.z-target.z);
        }
        const {origin} = aimRay(p,yaw,0,true,g.openRooms);
        const pitch = Math.atan2((volume?.y || 1.1)-origin.y,Math.hypot(target.x-origin.x,target.z-origin.z));
        const currentGun = p.guns[p.selected];
        if (currentGun.ammo === 0) g.action(p.id,{type:"reload"});
        if (distance < 2.8 && p.stamina > 45 && this.elapsedTicks % 150 === 0) g.action(p.id,{type:"dodge"});
        return { yaw, pitch, aim:true, shoot:true, forward:distance < 3.5 ? -0.6 : 0,
          right:Math.sin(this.time*.7)*(distance < 5 ? .55 : .18) };
      }
      return {yaw:p.yaw + .003,pitch:-.035};
    }
    if (g.phase === "break") {
      if (this.fixtureName === "combat") {
        const chip = [...g.chips].sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
        if (chip && clearPath(p,chip,g.openRooms)) return {yaw:Math.atan2(p.x-chip.x,p.z-chip.z),pitch:-.04,forward:.45};
      } else if (["intermission","casino","slots"].includes(this.fixtureName)) {
        this.once("slots",()=>this.action({type:"gamble",station:"slots",stake:25,lines:1}));
      } else if (this.fixtureName === "power-up") {
        if (this.stageTime > 3) this.once("power",()=>this.action({type:"crew",choice:"power"}));
      } else if (this.fixtureName === "extraction") {
        if (this.stageTime > 4) this.once("extract",()=>this.action({type:"crew",choice:"extract"}));
      } else if (this.fixtureName === "emerald") {
        this.once("roulette",()=>this.action({type:"gamble",station:"roulette",bets:[{key:"red",amount:20}]}));
      }
    }
    return {yaw:p.yaw,pitch:p.pitch};
  }
  tour() {
    const t = this.time % 120;
    const moments = [
      [0,"combat"], [20,"intermission"], [38,"emerald"],
      [56,"power-up"], [78,"house"], [111,"extraction"],
    ];
    const stage = moments.findLastIndex(([at])=>t>=at);
    this.stageTime = t - moments[stage][0];
    const index = Math.floor(this.time/120)*moments.length + stage;
    if (index !== this.stage) {
      this.stage = index;
      this.fixture(moments[stage][1]);
      if (moments[stage][1] === "emerald") {
        const s=STATIONS.find((s)=>s.id==="roulette");
        Object.assign(this.player,{x:s.x+2.8,z:s.z+1.5,chips:350,yaw:1.15});
      }
    }
  }
  step() {
    if (this.stateName === "tour") this.tour();
    else this.stageTime = this.time;
    const input = this.auto ? this.bot() : this.input;
    this.game.action(DEMO_ID,{type:"input",input:{...input,seq:this.elapsedTicks+1}});
    if (this.fixtureName === "stress") {
      Object.values(this.game.players).forEach((member,index)=>{
        if(member.id !== DEMO_ID) this.game.action(member.id,{type:"input",input:{...this.bot(member),seq:this.elapsedTicks+1}});
        if (this.elapsedTicks % 180 === index*30) this.game.action(member.id,{type:"grenade"});
      });
    }
    this.game.update(DEMO_STEP);
    this.game.testing = true;
    this.elapsedTicks++;
  }
  advance(dt, input = this.input) {
    if (this.frozen) return;
    this.input = input;
    this.accumulator += Math.max(0, Math.min(.1,dt));
    while (this.accumulator+1e-10 >= DEMO_STEP) {
      this.step();
      this.accumulator -= DEMO_STEP;
    }
  }
  seek(seconds) {
    const ticks = Math.round(Math.max(0,Math.min(600,seconds))/DEMO_STEP);
    // Forward-only from constructor. Playback is deterministic and never touches a room.
    while (this.elapsedTicks < ticks) {
      this.step();
      this.game.events = []; // Capture starts at the requested frame, not with stale effects.
    }
    this.frozen = true;
  }
  snapshot() {
    return structuredClone({...this.game.snapshot(DEMO_ID),type:"state",localDemo:true});
  }
  inspectionView() {
    if (this.view === "player" && !this.attract) return null;
    const p=this.player, r=roomAt(p)||ROOMS[0];
    const s=STATIONS.find((s)=>s.room===r.id);
    if (this.view === "table" || this.view === "detail") {
      const close=this.view === "detail";
      return {position:[s.x+ (close?2.1:3.5),close?1.75:2.5,s.z+(close?2.5:4.5)],target:[s.x,close?1.3:.95,s.z],fov:close?48:58};
    }
    if (this.view === "entrance")
      return {position:[r.x+1,1.9,r.z+6.7],target:[r.x-.5,1.7,r.z-4.5],fov:64};
    return {position:[r.x+6.4,3.25,r.z+6.6],target:[r.x-1,1.45,r.z-.8],fov:62};
  }
}
