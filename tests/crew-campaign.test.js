import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { Checkpoints, playerId } from "../server/checkpoints.js";
import { STATIONS } from "../shared/data.js";
import { ROOMS, DOORS, ROOM_SPAWNS } from "../shared/map.js";
import { DEVICES } from "../shared/campaign.js";
import { MovementPrediction } from "../src/prediction.js";
import { recordRun, readProfile, setSkin } from "../src/profile.js";
function setup(id = "roulette", count = 2) {
  const g = new Game("CREW", () => 0.4);
  for (let i = 0; i < count; i++) g.addPlayer(String(i), "Player " + i);
  g.restart();
  g.openRooms = ROOMS.map((r) => r.id);
  const station = STATIONS.find((s) => s.id === id);
  for (const p of Object.values(g.players)) {
    p.chips = 5000;
    p.x = station.x;
    p.z = station.z + 3;
  }
  return g;
}
const act = (g, id, choice, extra = {}) =>
  g.action(String(id), {
    type: "crewTable",
    station: Object.values(g.crewTables)[0]?.id || "roulette",
    choice,
    ...extra,
  });
const bet = (g, id, station, key, amount = 30) =>
  act(g, id, "bet", { station, bet: key, amount });
const step = (g, s = 6) => {
  for (let i = 0; i < s * 30; i++) g.update(1 / 30);
};
test("retired shared-table messages cannot reserve a station or debit chips", () => {
  const g = setup();
  bet(g, 0, "roulette", "red");
  act(g, 0, "ready");
  assert.equal(g.players[0].chips, 5000);
  assert.deepEqual(g.crewTables, {});
});
test("checkpoints authenticate, preserve equipment and reject active casino hands", () => {
  const g = setup();
  g.round = 8;
  g.serial = 81;
  g.players[0].guns[0].attachments = { optic: "reflex" };
  g.campaign.power = true;
  const vault = new Checkpoints("test-only secret");
  const token = vault.seal(g);
  assert.ok(token);
  const restored = vault.restore(vault.open(token));
  assert.equal(restored.round, 8);
  assert.equal(restored.serial, 81);
  assert.equal(restored.players[0].guns[0].attachments.optic, "reflex");
  assert.equal(restored.players[0].offline, true);
  assert.equal(restored.campaign.power, true);
  assert.throws(() => vault.open(token.slice(0, 30) + "!" + token.slice(31)));
  assert.throws(() => new Checkpoints("wrong").open(token));
  assert.notEqual(playerId("a".repeat(64)), playerId("b".repeat(64)));
  g.action("0", {
    type: "gamble",
    station: "roulette",
    bets: [{ key: "red", amount: 30 }],
  });
  assert.equal(vault.seal(g), null);
});
test("door contributions charge only the remainder and open once for the crew", () => {
  const g = setup();
  g.openRooms = ["atrium"];
  const d = DOORS.find((d) => d.to === "emerald" && !d.shortcut);
  for (const p of Object.values(g.players)) {
    p.x = d.x + 2;
    p.z = d.z;
  }
  for (const id of ["0", "1", "0"])
    g.action(id, { type: "crew", choice: "donate", door: d.id });
  assert.ok(g.openRooms.includes("emerald"));
  assert.equal(g.players[0].chips + g.players[1].chips, 10000 - 75);
});
test("barricades delay enemies, shove spends stamina and traps enforce cooldowns", () => {
  const g = setup("slots", 1),
    p = g.players[0];
  g.openRooms = ["atrium"];
  const entries = ROOM_SPAWNS.map((s, i) => [s, i]).filter(
    ([s]) => s.room === "atrium",
  );
  for (const [, i] of entries) g.campaign.barricades[i] = 3;
  g.startRound();
  const pending = g.pending;
  g.update(1 / 30);
  assert.equal(g.pending, pending);
  assert.equal(g.zombies.length, 0);
  p.x = 0;
  p.z = 8;
  p.yaw = 0;
  const z = g.makeEnemy({ x: 0, z: 6.5 });
  z.hp = 10;
  g.zombies = [z];
  p.stamina = 100;
  g.action("0", { type: "crew", choice: "shove" });
  assert.equal(p.stamina, 80);
  assert.equal(g.zombies.length, 0);
  assert.equal(Object.keys(p.weaponKills || {}).length, 0);
  g.action("0", { type: "crew", choice: "shove" });
  assert.equal(p.stamina, 80);
  const d = DEVICES.find((d) => d.id === "trap-ivory");
  g.openRooms = ROOMS.map((r) => r.id);
  p.x = d.x;
  p.z = d.z + 1;
  g.campaign.power = true;
  g.action("0", { type: "crew", choice: d.id });
  const chips = p.chips;
  g.action("0", { type: "crew", choice: d.id });
  assert.equal(p.chips, chips);
  assert.ok(g.campaign.traps[d.id].until > g.time);
});
test("campaign requires power, code and two boss keys; extraction requires crew votes", () => {
  const g = setup(),
    p = g.players[0];
  const device = (id) => {
    const d = DEVICES.find((d) => d.id === id);
    p.x = d.x;
    p.z = d.z + 1;
    g.action("0", { type: "crew", choice: id });
  };
  device("finale");
  assert.equal(g.campaign.finale, false);
  device("power");
  device("archive");
  for (let i = 0; i < 2; i++) {
    const z = g.makeEnemy({ x: 0, z: 0 });
    z.kind = "boss";
    g.zombies.push(z);
    g.killEnemy(z, p);
  }
  device("finale");
  assert.equal(g.campaign.finale, true);
  g.startRound();
  const boss = g.zombies.find((z) => z.finalBoss);
  assert.ok(boss.hp >= 3600);
  assert.equal(g.pending, 0);
  boss.hp = 1;
  g.killEnemy(boss, p);
  step(g, 0.1);
  assert.equal(g.phase, "break");
  device("extract");
  assert.equal(g.phase, "break");
  g.players[1].x = p.x;
  g.players[1].z = p.z;
  g.action("1", { type: "crew", choice: "extract" });
  assert.equal(g.phase, "over");
  assert.equal(g.summary.extracted, true);
  assert.equal(g.summary.players.length, 2);
});
test("free spins consume a token without generating paid-spin progress, comps or jackpot funding", () => {
  const g = setup("slots", 1),
    p = g.players[0];
  p.freeSpins = 1;
  p.paidSpins = 6;
  const j = g.jackpot;
  g.action("0", { type: "gamble", station: "slots", freeSpin: true });
  assert.equal(p.freeSpins, 0);
  assert.equal(p.chips, 5000);
  assert.equal(p.paidSpins, 6);
  assert.equal(p.comps, 0);
  assert.equal(g.jackpot, j);
});
test("local prediction responds immediately and reconciles acknowledged inputs", () => {
  const v = new MovementPrediction(),
    p = { x: 0, z: 8, lastSeq: 0 };
  v.reconcile(p, ["atrium"]);
  const input = { forward: 1, right: 0, yaw: 0 };
  v.sent(1, input);
  v.update(1 / 30, p, input, ["atrium"]);
  assert.ok(v.position.z < 8);
  v.reconcile({ ...p, z: 8 - 6 / 30, lastSeq: 1 }, ["atrium"]);
  assert.equal(v.pending.length, 0);
  assert.ok(Math.abs(v.correction.z) < 0.0001);
  for (let i = 0; i < 200; i++)
    v.update(1 / 30, p, { forward: 0, right: 1, yaw: 0 }, ["atrium"]);
  assert.ok(v.position.x < 8);
});
test("career accumulates once per run and locks cosmetics until challenges are met", () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => data.get(k),
    setItem: (k, v) => data.set(k, v),
  };
  setSkin("gold");
  assert.equal(readProfile().skin, "classic");
  const summary = {
    id: "career-test",
    round: 6,
    extracted: true,
    players: [
      {
        id: "a",
        kills: 20,
        headshots: 8,
        revives: 2,
        hands: 3,
        net: 40,
        weaponKills: { velvet: 20 },
      },
    ],
  };
  recordRun(summary, "a");
  recordRun(summary, "a");
  assert.equal(readProfile().kills, 20);
  assert.equal(readProfile().weapons.velvet, 20);
  setSkin("gold");
  assert.equal(readProfile().skin, "gold");
  delete globalThis.localStorage;
});
