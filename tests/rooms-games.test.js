import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { Navigation } from "../server/navigation.js";
import {
  DOORS,
  ROOMS,
  ROOM_SPAWNS,
  roomAt,
  clearPath,
  doorOpen,
} from "../shared/map.js";
import { moveCircle, WEAPONS } from "../shared/data.js";
import { pokerHand, crapsOutcome, bankerDraws } from "../shared/extra-rules.js";
import {
  dealPoker,
  drawPoker,
  rollCraps,
  finishCraps,
  baccaratFromShoe,
} from "../server/extra-games.js";
import { giveReward } from "../server/casino.js";
const all = ROOMS.map((r) => r.id),
  c = (ranks, suit = "♠") => ranks.map((rank) => ({ rank, suit }));
function game() {
  const g = new Game("TEST", () => 0.1);
  g.addPlayer("a", "A");
  g.restart();
  return g;
}
test("door purchase requires proximity, prerequisite room and sufficient chips; opens once for everyone", () => {
  const g = game();
  g.addPlayer("b", "B");
  const p = g.players.a;
  p.chips = 1000;
  g.action("a", { type: "unlock", door: "emerald" });
  assert.deepEqual(g.openRooms, ["atrium"]);
  p.x = -6;
  p.z = 9;
  p.chips = 74;
  g.action("a", { type: "unlock", door: "emerald" });
  assert.equal(p.chips, 74);
  p.chips = 1000;
  g.action("a", { type: "unlock", door: "emerald" });
  assert.equal(p.chips, 925);
  assert.equal(g.players.b.chips, 25);
  assert.ok(g.snapshot().openRooms.includes("emerald"));
  g.action("a", { type: "unlock", door: "emerald" });
  assert.equal(p.chips, 925);
  p.x = -14;
  p.z = 1.5;
  g.action("a", { type: "unlock", door: "arcade" });
  assert.ok(g.openRooms.includes("arcade"));
  assert.equal(p.chips, 725);
  p.x = -10;
  p.z = -9;
  g.action("a", { type: "unlock", door: "crown-west" });
  assert.ok(g.openRooms.includes("crown"));
  assert.equal(p.chips, 375);
  assert.ok(
    doorOpen(
      DOORS.find((d) => d.id === "shortcut"),
      g.openRooms,
    ),
  );
  assert.equal(
    doorOpen(
      DOORS.find((d) => d.id === "crown-east"),
      g.openRooms,
    ),
    false,
  );
  g.restart();
  assert.deepEqual(g.openRooms, ["atrium"]);
});
test("locked shutters block movement and bullets; open doorway admits players but partition stays solid", () => {
  const p = { x: -6, z: 9 };
  moveCircle(p, -6, 0, 0.4, ["atrium"]);
  assert.ok(p.x > -8);
  assert.equal(clearPath({ x: -6, z: 9 }, { x: -10, z: 9 }, ["atrium"]), false);
  moveCircle(p, -6, 0, 0.4, ["atrium", "emerald"]);
  assert.ok(p.x < -8);
  assert.equal(
    clearPath({ x: -6, z: 9 }, { x: -10, z: 9 }, ["atrium", "emerald"]),
    true,
  );
  const q = { x: -6, z: 3 };
  moveCircle(q, -10, 0, 0.4, all);
  assert.ok(q.x > -8, "solid partition cannot be bypassed after purchase");
  const g = game();
  g.players.a.x = -6;
  g.players.a.z = 9;
  g.players.a.yaw = Math.PI / 2;
  g.zombies = [{ id: 1, x: -12, z: 8.35, hp: 100 }];
  g.shoot(g.players.a);
  assert.equal(g.zombies[0].hp, 100);
});
test("tables in unopened rooms reject forged or remote wagers and opened rooms still respect intermissions", () => {
  const g = game(),
    p = g.players.a;
  p.chips = 1000;
  p.x = -17;
  p.z = 10;
  g.action("a", {
    type: "gamble",
    station: "roulette",
    bets: [{ key: "red", amount: 10 }],
  });
  assert.equal(p.chips, 1000);
  assert.equal(g.games.roulette, undefined);
  g.openRooms.push("emerald");
  g.action("a", {
    type: "gamble",
    station: "roulette",
    bets: [{ key: "red", amount: 10 }],
  });
  assert.equal(p.chips, 990);
  g.games = {};
  g.startRound();
  g.action("a", {
    type: "gamble",
    station: "roulette",
    bets: [{ key: "red", amount: 10 }],
  });
  assert.equal(p.chips, 990);
});
test("only open-room entrances spawn zombies and doors can be bought during combat", () => {
  const g = game();
  g.startRound();
  for (let i = 0; i < 30; i++) g.update(0.05);
  assert.ok(g.zombies.every((z) => roomAt(z).id === "atrium"));
  g.players.a.x = -6;
  g.players.a.z = 9;
  g.players.a.chips = 75;
  g.action("a", { type: "unlock", door: "emerald" });
  assert.ok(g.openRooms.includes("emerald"));
});
test("navigation reaches the atrium from every unlocked service entrance through doorways", () => {
  const nav = new Navigation(),
    target = { x: 0, z: 12 };
  nav.build([target], all);
  for (const entrance of ROOM_SPAWNS) {
    const z = { ...entrance };
    for (
      let i = 0;
      i < 2500 && Math.hypot(z.x - target.x, z.z - target.z) > 1.5;
      i++
    ) {
      const p = nav.target(z);
      assert.ok(p);
      const dx = p.x - z.x,
        dz = p.z - z.z,
        d = Math.hypot(dx, dz);
      if (d > 0.02) moveCircle(z, (dx / d) * 0.1, (dz / d) * 0.1, 0.43, all);
    }
    assert.ok(
      Math.hypot(z.x - target.x, z.z - target.z) < 1.5,
      JSON.stringify({ entrance, stopped: z }),
    );
  }
});
test("video poker ranks wheel straights, flushes, full houses, quads and high pairs", () => {
  assert.equal(pokerHand(c([1, 10, 11, 12, 13])).multiplier, 800);
  assert.equal(pokerHand(c([1, 2, 3, 4, 5])).multiplier, 50);
  assert.equal(pokerHand([...c([5, 5, 5]), ...c([2, 2], "♥")]).multiplier, 9);
  assert.equal(pokerHand([...c([9, 9, 9, 9]), ...c([2], "♥")]).multiplier, 25);
  assert.equal(pokerHand([...c([11, 11, 3]), ...c([5, 8], "♥")]).multiplier, 1);
  assert.equal(pokerHand([...c([10, 10, 3]), ...c([5, 8], "♥")]).multiplier, 0);
});
test("video poker keeps held cards, draws once, validates holds and awards shotgun", () => {
  const g = { ...dealPoker(() => 0.1), cost: 25 };
  g.cards = [...c([11, 11, 3]), ...c([5, 8], "♥")];
  g.deck = c([3, 3, 2]);
  assert.equal(drawPoker(g, [0, 0]), false);
  assert.ok(drawPoker(g, [0, 1]));
  assert.deepEqual(g.cards.slice(0, 2), c([11, 11]));
  assert.equal(g.cards.length, 5);
  assert.equal(drawPoker(g, []), false);
  assert.equal(g.awards[0].reward, "pitViper");
});
test("craps come-out, point, seven-out and Don’t Pass bar-12 rules", () => {
  assert.equal(crapsOutcome(0, 7, "pass").result, "win");
  assert.equal(crapsOutcome(0, 11, "dont").result, "loss");
  assert.equal(crapsOutcome(0, 12, "dont").result, "push");
  assert.equal(crapsOutcome(0, 3, "dont").result, "win");
  assert.equal(crapsOutcome(6, 6, "pass").result, "win");
  assert.equal(crapsOutcome(6, 7, "pass").result, "loss");
  assert.equal(crapsOutcome(6, 8, "pass").result, "point");
  const g = { phase: "decision", point: 0, bet: "pass", cost: 25, rolls: [] };
  let i = 0;
  assert.ok(rollCraps(g, () => [0.4, 0.4][i++]));
  assert.deepEqual(g.dice, [3, 3]);
  assert.equal(finishCraps(g), false);
  assert.equal(g.point, 6);
  g.dice = [2, 4];
  assert.equal(finishCraps(g), true);
  assert.equal(g.returned, 50);
  assert.equal(g.awards[0].reward, "armor");
});
test("baccarat third-card tableau, natural stops and commissioned banker payout", () => {
  assert.equal(bankerDraws(3, 8), false);
  assert.equal(bankerDraws(3, 7), true);
  assert.equal(bankerDraws(4, 1), false);
  assert.equal(bankerDraws(4, 2), true);
  assert.equal(bankerDraws(5, 3), false);
  assert.equal(bankerDraws(5, 4), true);
  assert.equal(bankerDraws(6, 5), false);
  assert.equal(bankerDraws(6, 6), true);
  assert.equal(bankerDraws(7, 7), false);
  assert.equal(bankerDraws(5, null), true);
  // Pop order player 4, banker 4, player 3, banker 5 -> natural banker 9.
  const b = baccaratFromShoe(c([5, 3, 4, 4]), "banker", 20);
  assert.equal(b.bankerTotal, 9);
  assert.equal(b.playerCards.length, 2);
  assert.equal(b.returned, 39);
  const tie = baccaratFromShoe(c([5, 5, 4, 4]), "tie", 20);
  assert.equal(tie.returned, 180);
  assert.equal(tie.awards[0].reward, "gildedSovereign");
  const push = baccaratFromShoe(c([5, 5, 4, 4]), "player", 20);
  assert.equal(push.returned, 20);
});
test("shotgun spends one shell for seven pellets and armor absorbs incoming melee damage first", () => {
  const g = game(),
    p = g.players.a;
  giveReward(p, "pitViper");
  p.x = 0;
  p.z = 10;
  p.yaw = 0;
  p.pitch = 0;
  g.zombies = [{ id: 99, x: 0.65, z: 7, hp: 1000 }];
  g.shoot(p);
  assert.equal(p.guns[p.selected].ammo, WEAPONS.pitViper.mag - 1);
  assert.equal(g.events.find((e) => e.type === "shot").ends.length, 7);
  assert.ok(g.zombies[0].hp < 950);
  giveReward(p, "armor");
  giveReward(p, "armor");
  assert.equal(p.armor, 75);
  g.phase = "combat";
  g.pending = 0;
  g.zombies = [
    { id: 99, x: p.x, z: p.z + 0.6, hp: 100, speed: 1, attack: 0, stun: 0 },
  ];
  g.update(0.03);
  assert.equal(p.hp, 100);
  assert.equal(p.armor, 57);
});

test("new table decisions allow decisions during the break, reject other players and settle only once", () => {
  const g = game(),
    p = g.players.a;
  g.addPlayer("b", "B");
  g.openRooms = all;
  p.chips = 1000;
  p.x = -17;
  p.z = -6;
  g.action("a", { type: "gamble", station: "poker", wager: 25 });
  assert.equal(p.chips, 975);
  const poker = g.games.poker;
  poker.cards = [...c([11, 11]), ...c([9, 9, 2], "♥")];
  g.action("b", { type: "draw", holds: [0, 1, 2, 3, 4] });
  assert.equal(poker.drawn, false);
  for (let i = 0; i < 10; i++) g.update(1);
  assert.equal(poker.phase, "decision");
  assert.equal(g.phase, "break");
  g.action("a", { type: "nextRound" });
  assert.equal(p.ready, false);
  g.action("a", { type: "draw", holds: [0, 1, 2, 3, 4] });
  g.action("a", { type: "draw", holds: [] });
  g.update(2);
  assert.equal(p.chips, 1025);
  assert.equal(poker.phase, "result");
  g.update(10);
  assert.equal(p.chips, 1025);
  assert.equal(p.guns.filter((g) => g.id === "pitViper").length, 1);
  g.action("b", { type: "collect", station: "poker" });
  assert.ok(g.games.poker);
  g.action("a", { type: "collect", station: "poker" });
  p.x = 17;
  p.z = -5;
  g.action("a", { type: "gamble", station: "craps", wager: 25, bet: "pass" });
  const craps = g.games.craps;
  g.action("b", { type: "roll" });
  assert.equal(craps.phase, "decision");
  g.rng = () => 0.4;
  g.action("a", { type: "roll" });
  g.update(2);
  assert.equal(craps.point, 6);
  for (let i = 0; i < 10; i++) g.update(1);
  assert.equal(craps.phase, "decision");
  g.action("a", { type: "roll" });
  g.action("a", { type: "roll" });
  g.update(2);
  assert.equal(craps.phase, "result");
  assert.equal(p.chips, 1050);
  g.update(10);
  assert.equal(p.chips, 1050);
  assert.equal(p.armor, 75);
});

test("new games conceal shoes, baccarat totals and rolling dice until reveal", () => {
  const g = game(),
    p = g.players.a;
  g.openRooms = all;
  p.chips = 1000;
  p.x = -17;
  p.z = -6;
  g.action("a", { type: "gamble", station: "poker" });
  let s = g.snapshot();
  assert.equal(s.games.poker.deck, undefined);
  assert.equal(s.games.poker.cards.length, 5);
  g.removePlayer("a");
  assert.equal(g.games.poker, undefined);
  g.addPlayer("a", "A");
  const q = g.players.a;
  q.chips = 1000;
  q.x = 0;
  q.z = -7;
  g.action("a", {
    type: "gamble",
    station: "baccarat",
    wager: 20,
    bet: "banker",
  });
  s = g.snapshot().games.baccarat;
  assert.ok(s.playerCards.every((c) => c.rank === 0));
  assert.ok(s.bankerCards.every((c) => c.rank === 0));
  assert.equal(s.winner, undefined);
  assert.equal(s.returned, undefined);
  g.update(5);
  const bank = q.chips;
  g.update(10);
  assert.equal(q.chips, bank);
  assert.equal(g.snapshot().games.baccarat.phase, "result");
  g.action("a", { type: "collect", station: "baccarat" });
  q.x = 17;
  q.z = -5;
  g.action("a", { type: "gamble", station: "craps", wager: 25, bet: "dont" });
  g.action("a", { type: "roll" });
  assert.deepEqual(g.snapshot().games.craps.dice, []);
  g.update(2);
  assert.equal(g.snapshot().games.craps.dice.length, 2);
});

test("baccarat draws a player third card before applying the banker tableau", () => {
  // Deal order P2, B1, P3, B2, P8: banker total 3 must stand against third-card 8.
  const stood = baccaratFromShoe(c([8, 2, 3, 1, 2]), "tie", 20);
  assert.equal(stood.playerCards.length, 3);
  assert.equal(stood.bankerCards.length, 2);
  assert.equal(stood.playerTotal, 3);
  assert.equal(stood.bankerTotal, 3);
  assert.equal(stood.returned, 180);
  // Player stands on 6; banker draws on 5, and face cards count zero.
  const drawn = baccaratFromShoe(c([13, 3, 3, 2, 3]), "player", 20);
  assert.equal(drawn.playerCards.length, 2);
  assert.equal(drawn.bankerCards.length, 3);
  assert.equal(drawn.playerTotal, 6);
  assert.equal(drawn.bankerTotal, 5);
  assert.equal(drawn.returned, 40);
});
