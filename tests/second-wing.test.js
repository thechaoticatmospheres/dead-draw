import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { ROOMS, DOORS, roomAt, clearPath } from "../shared/map.js";
import { STATIONS, WEAPONS, aimRay } from "../shared/data.js";
import { ATTACHMENTS, gunStats, opticFor } from "../shared/attachments.js";
import {
  HIGH_STAKES,
  threeCardRank,
  compareThree,
  sicBoProfit,
  hiLoQuote,
} from "../shared/high-stakes-rules.js";
import {
  highStakesCost,
  advanceHighStakes,
  highStakesDecision,
  publicHighStakes,
} from "../server/high-stakes.js";
import { giveReward } from "../server/casino.js";
const c = (rank, suit = "♠") => ({ rank, suit });
function setup(id = "threecard") {
  const g = new Game("WING", () => 0.4);
  g.addPlayer("a", "A");
  g.restart();
  const p = g.players.a,
    s = STATIONS.find((s) => s.id === id);
  p.chips = 20000;
  p.x = s.x;
  p.z = s.z + 3;
  g.openRooms = ROOMS.map((r) => r.id);
  return { g, p, s };
}
const advance = (g, seconds = 3) => {
  for (let i = 0; i < seconds * 30; i++) g.update(1 / 30);
};
test("twelve unique rooms and games; second-wing purchases escalate and open to the crew once", () => {
  assert.equal(ROOMS.length, 12);
  assert.equal(new Set(STATIONS.map((s) => s.type)).size, 12);
  const { g, p } = setup();
  g.openRooms = ["atrium", "emerald", "arcade", "crown", "dice", "velvet"];
  let previous = 350;
  for (const id of [
    "sapphire",
    "ivory",
    "jade",
    "neon",
    "obsidian",
    "eclipse",
  ]) {
    const room = ROOMS.find((r) => r.id === id),
      door = DOORS.find((d) => d.id === id);
    assert.ok(room.cost > previous);
    previous = room.cost;
    p.x = door.x;
    p.z = door.z + 2;
    assert.equal(roomAt(p).id, door.from);
    assert.equal(
      clearPath(p, { x: door.x, z: door.z - 2 }, g.openRooms),
      false,
    );
    const balance = p.chips;
    g.action("a", { type: "unlock", door: id });
    assert.ok(g.openRooms.includes(id));
    assert.equal(p.chips, balance - room.cost);
    g.action("a", { type: "unlock", door: id });
    assert.equal(p.chips, balance - room.cost);
    assert.ok(clearPath(p, { x: door.x, z: door.z - 2 }, g.openRooms));
  }
});
test("every new table rejects malformed wagers, locked rooms, combat and a second active hand", () => {
  for (const id of HIGH_STAKES) {
    const { g, p, s } = setup(id),
      msg = {
        type: "gamble",
        station: id,
        wager: s.cost,
        bet: "small",
        picks: [1, 2, 3],
      };
    assert.equal(highStakesCost(s, { ...msg, wager: NaN }), null);
    g.phase = "combat";
    g.action("a", msg);
    assert.equal(p.chips, 20000);
    g.phase = "break";
    g.openRooms = [];
    g.action("a", msg);
    assert.equal(p.chips, 20000);
    g.openRooms = ROOMS.map((r) => r.id);
    g.action("a", msg);
    assert.ok(g.games[id]);
    const balance = p.chips;
    g.action("a", msg);
    assert.equal(p.chips, balance);
    g.action("a", { type: "nextRound" });
    assert.equal(g.phase, "break");
  }
  const k = STATIONS.find((s) => s.id === "keno");
  for (const picks of [
    [],
    [1],
    [1, 1],
    [1, 81],
    [1, 2.5],
    Array.from({ length: 9 }, (_, i) => i + 1),
  ])
    assert.equal(highStakesCost(k, { wager: 125, picks }), null);
});
test("three-card ranking puts straights above flushes, ace-low last, and compares pair kickers", () => {
  const straight = [c(4), c(5, "♥"), c(6)],
    flush = [c(1), c(9), c(4)];
  assert.equal(threeCardRank(straight).name, "STRAIGHT");
  assert.ok(compareThree(straight, flush) > 0);
  assert.ok(compareThree([c(1), c(2, "♥"), c(3)], [c(2), c(3, "♥"), c(4)]) < 0);
  assert.ok(
    compareThree([c(7), c(7, "♥"), c(13)], [c(7), c(7, "♥"), c(12)]) > 0,
  );
});
test("three-card decisions wait, charge play once, hide the dealer and settle exactly once", () => {
  const { g, p } = setup();
  g.action("a", {
    type: "gamble",
    station: "threecard",
    wager: 75,
    pairPlus: true,
  });
  const hand = g.games.threecard;
  hand.cards = [c(4), c(5, "♥"), c(6)];
  hand.dealer = [c(11), c(9, "♥"), c(2)];
  advance(g, 60);
  assert.equal(hand.phase, "decision");
  assert.equal(p.chips, 19850);
  assert.ok(g.snapshot().games.threecard.dealer.every((c) => c.rank === 0));
  g.addPlayer("b", "B");
  g.action("b", { type: "tableChoice", station: "threecard", choice: "play" });
  assert.equal(hand.phase, "decision");
  g.action("a", { type: "tableChoice", station: "threecard", choice: "play" });
  g.action("a", { type: "tableChoice", station: "threecard", choice: "play" });
  assert.equal(p.chips, 19775);
  advance(g);
  assert.equal(hand.returned, 825);
  assert.equal(p.chips, 20600);
  assert.equal(p.ledger.length, 1);
  advance(g, 30);
  g.payTable(hand);
  assert.equal(p.chips, 20600);
});
test("Casino War surrender and matched-war accounting including a second tie", () => {
  const p = { id: "a", chips: 50 },
    g = {
      kind: "war",
      player: "a",
      phase: "decision",
      wager: 50,
      cost: 50,
      cards: [c(8)],
      dealer: [c(8)],
      deck: [c(10), c(10), c(2), c(3), c(4)],
    };
  highStakesDecision(g, p, { choice: "war" }, () => 0.4);
  assert.equal(p.chips, 0);
  assert.equal(g.cost, 100);
  assert.ok(publicHighStakes(g).cards.at(-1).rank === 0);
  assert.equal(advanceHighStakes(g), true);
  assert.equal(g.returned, 200);
  const surrender = { ...g, phase: "decision", war: false };
  assert.ok(highStakesDecision(surrender, p, { choice: "surrender" }));
  assert.equal(surrender.returned, 25);
});
test("Sic Bo triples override outside bets and face bets pay the number of occurrences", () => {
  for (const bet of ["small", "big", "odd", "even"])
    assert.equal(sicBoProfit([3, 3, 3], bet), -1);
  assert.equal(sicBoProfit([3, 3, 3], "triple"), 30);
  assert.equal(sicBoProfit([2, 2, 5], "face:2"), 2);
  assert.equal(sicBoProfit([1, 2, 3], "big"), -1);
});
test("Keno draws twenty unique balls and reveals them gradually without exposing the shoe", () => {
  const { g } = setup("keno");
  g.action("a", {
    type: "gamble",
    station: "keno",
    wager: 125,
    picks: [1, 2, 3, 4],
  });
  assert.equal(new Set(g.games.keno.drawn).size, 20);
  let safe = g.snapshot().games.keno;
  assert.deepEqual(safe.drawn, []);
  assert.equal(safe.deck, undefined);
  advance(g, 2);
  safe = g.snapshot().games.keno;
  assert.ok(safe.drawn.length >= 6 && safe.drawn.length < 20);
  assert.equal(safe.returned, undefined);
  assert.equal(safe.matches, undefined);
  advance(g, 5);
  assert.equal(g.snapshot().games.keno.drawn.length, 20);
  assert.equal(g.games.keno.phase, "result");
});
test("Let It Ride protects withdrawn bets, reveals one community card, then pays each remaining bet", () => {
  const { g, p } = setup("letitride");
  g.action("a", { type: "gamble", station: "letitride", wager: 200 });
  const hand = g.games.letitride;
  hand.cards = [c(10), c(10, "♥"), c(3)];
  hand.community = [c(5, "♦"), c(8, "♣")];
  advance(g);
  assert.ok(g.snapshot().games.letitride.community.every((c) => c.rank === 0));
  g.action("a", { type: "tableChoice", station: "letitride", choice: "pull" });
  advance(g);
  assert.equal(g.snapshot().games.letitride.community[0].rank, 5);
  assert.equal(g.snapshot().games.letitride.community[1].rank, 0);
  g.action("a", { type: "tableChoice", station: "letitride", choice: "ride" });
  advance(g);
  assert.equal(hand.returned, 1000);
  assert.equal(p.chips, 20400);
  assert.equal(hand.phase, "result");
});
test("Hi-Lo quotes valid probabilities, rejects impossible calls and banking before a win, ties lose", () => {
  assert.equal(hiLoQuote(c(1), "higher", 150).count, 0);
  assert.equal(hiLoQuote(c(2), "lower", 150).count, 0);
  assert.equal(hiLoQuote(c(8), "higher", 150).count, 6);
  const p = { id: "a", chips: 0 },
    g = {
      kind: "hilo",
      player: "a",
      phase: "decision",
      cards: [c(8)],
      credit: 150,
      streak: 0,
    };
  highStakesDecision(g, p, { choice: "bank" });
  assert.equal(g.phase, "decision");
  Object.assign(g, { guess: "higher", cards: [c(8), c(9)] });
  advanceHighStakes(g);
  assert.equal(g.streak, 1);
  assert.equal(g.credit, 312);
  assert.ok(highStakesDecision(g, p, { choice: "bank" }));
  assert.equal(g.returned, 312);
  Object.assign(g, { guess: "lower", cards: [c(8), c(8)] });
  advanceHighStakes(g);
  assert.equal(g.returned, 0);
});
test("new-game snapshots never expose risk secrets during double-or-bank", () => {
  const { g } = setup("war");
  g.action("a", { type: "gamble", station: "war", wager: 50 });
  const hand = g.games.war;
  Object.assign(hand, { cards: [c(13)], dealer: [c(2)] });
  advance(g);
  g.action("a", { type: "risk", station: "war", color: "red" });
  const safe = g.snapshot().games.war;
  assert.equal(safe.riskHidden, undefined);
  assert.equal(safe.deck, undefined);
  assert.ok(Array.isArray(safe.awards));
});
test("attachments enforce room, cost, weapon and intermission rules; owned optics switch free", () => {
  const { g, p } = setup(),
    gun = p.guns[0];
  g.openRooms = ["atrium"];
  g.action("a", { type: "attachment", item: "reflex" });
  assert.equal(p.chips, 20000);
  g.openRooms = ROOMS.map((r) => r.id);
  g.phase = "combat";
  g.action("a", { type: "attachment", item: "reflex" });
  assert.equal(p.chips, 20000);
  g.phase = "break";
  g.action("a", { type: "attachment", item: "longscope" });
  assert.equal(p.chips, 20000);
  g.action("a", { type: "attachment", item: "scope" });
  assert.equal(p.chips, 19725);
  assert.equal(opticFor(p).zoom, 2.5);
  g.action("a", { type: "attachment", item: "scope" });
  assert.equal(opticFor(p), undefined);
  g.action("a", { type: "attachment", item: "scope" });
  assert.equal(p.chips, 19725);
  const ray = aimRay(p, 0, 0, true, g.openRooms);
  assert.deepEqual(ray.origin, { x: p.x, y: 1.65, z: p.z });
  giveReward(p, "velvet");
  assert.equal(gun.attachments.optic, "scope");
  assert.equal(ATTACHMENTS.length, 6);
});
test("extended magazine and speed loader affect authoritative reload without generating extra ammo", () => {
  const { g, p } = setup(),
    gun = p.guns[0];
  for (const item of ["extended", "speedloader", "compensator"])
    g.action("a", { type: "attachment", item });
  const stats = gunStats(WEAPONS[gun.id], gun);
  assert.equal(stats.mag, 18);
  assert.equal(stats.reload, 0.9375);
  assert.equal(stats.recoil, 0.55);
  gun.ammo = 0;
  const reserve = gun.reserve;
  g.action("a", { type: "reload" });
  assert.equal(p.reload, 0.9375);
  advance(g);
  assert.equal(gun.ammo, 18);
  assert.equal(gun.reserve, reserve - 18);
  g.action("a", { type: "attachment", item: "extended" });
  g.action("a", { type: "reload" });
  advance(g);
  assert.equal(gun.reserve, reserve - 18);
});
test("scoped shots hit the eye-level sight line in the new wing and still obey walls", () => {
  const { g, p } = setup();
  p.x = 0;
  p.z = -34;
  p.yaw = 0;
  p.pitch = 0;
  g.action("a", { type: "attachment", item: "scope" });
  p.input.aim = true;
  g.round = 1;
  const enemy = g.makeEnemy({ x: 0, z: -38 });
  enemy.hp = 50;
  g.zombies = [enemy];
  g.shoot(p);
  assert.ok(enemy.hp <= 0, "centered scope headshot damages the actual target");
  const behind = g.makeEnemy({ x: 0, z: -50 });
  behind.hp = 50;
  g.zombies = [behind];
  p.cooldown = 0;
  g.shoot(p);
  assert.equal(behind.hp, 50, "the new north wall occludes shots");
});
