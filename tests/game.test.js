import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { aimRay, OBSTACLES } from "../shared/data.js";
function game() {
  const g = new Game("TEST", () => 0.1);
  g.addPlayer("a", "A");
  g.restart();
  return g;
}
test("rooms cap at four and start with individual balances", () => {
  const g = game();
  for (const id of ["b", "c", "d"]) assert.ok(g.addPlayer(id, id));
  assert.equal(g.addPlayer("e", "E"), false);
  g.players.a.chips = 0;
  assert.equal(g.players.b.chips, 25);
});
test("server enforces distance, balance, station exclusivity and concealed outcomes", () => {
  const g = game(),
    p = g.players.a;
  g.action("a", { type: "gamble", station: "slots" });
  assert.deepEqual(g.games, {});
  p.x = -3;
  p.z = 8;
  g.action("a", { type: "gamble", station: "slots" });
  assert.equal(p.chips, 0);
  assert.ok(g.games.slots);
  assert.equal(g.snapshot().games.slots.reward, undefined);
  g.action("a", { type: "gamble", station: "slots" });
  assert.equal(p.chips, 0);
  g.update(5);
  assert.ok(p.guns[0].reserve >= 60);
  assert.equal(g.games.slots.phase, "result");
});
test("rounds spawn and all-down ends run; restart resets economy", () => {
  const g = game();
  g.action("a", { type: "nextRound" });
  g.update(0.03);
  assert.equal(g.round, 1);
  assert.equal(g.phase, "combat");
  assert.equal(g.pending, 5);
  g.players.a.down = true;
  g.update(0.03);
  assert.equal(g.phase, "over");
  g.action("a", { type: "start" });
  assert.equal(g.phase, "break");
  assert.equal(g.players.a.hp, 100);
  assert.equal(g.players.a.chips, 25);
});
test("revive requires nearby held input and succeeds after three seconds", () => {
  const g = game();
  g.addPlayer("b", "B");
  const p = g.players.a,
    b = g.players.b;
  p.down = true;
  p.hp = 0;
  b.x = p.x + 1;
  b.z = p.z;
  for (let i = 0; i < 92; i++) {
    g.action("b", { type: "input", input: { revive: true } });
    g.update(1 / 30);
  }
  assert.equal(p.down, false);
  assert.equal(p.hp, 60);
});
test("server fire rate and ammunition cannot be bypassed by action spam", () => {
  const g = game(),
    p = g.players.a;
  p.input = { aim: false };
  g.shoot(p);
  for (let i = 0; i < 50; i++) g.shoot(p);
  assert.equal(p.guns[0].ammo, 11);
  p.cooldown = 0;
  p.guns[0].ammo = 0;
  g.shoot(p);
  assert.equal(p.guns[0].ammo, 0);
});
test("input clamps movement and expires on disconnected or idle controls", () => {
  const g = game(),
    p = g.players.a;
  g.action("a", { type: "input", input: { forward: 100000, right: 100000 } });
  assert.equal(p.input.forward, 1);
  g.update(0.4);
  assert.deepEqual(p.input, {});
});
test("chip attraction credits exactly one player", () => {
  const g = game();
  g.addPlayer("b", "B");
  g.chips.push({ id: 1, x: g.players.a.x, z: g.players.a.z, value: 5, age: 0 });
  g.update(0.03);
  assert.equal(g.players.a.chips, 30);
  assert.equal(g.players.b.chips, 25);
  assert.equal(g.chips.length, 0);
});
test("aimed headshots kill and produce physical chip drops", () => {
  const g = game(),
    p = g.players.a;
  p.x = 0;
  p.z = 8;
  p.yaw = 0;
  p.pitch = 0;
  p.input = { aim: true };
  g.zombies = [{ id: 99, x: 0.65, z: 2, hp: 50 }];
  g.shoot(p);
  assert.equal(g.zombies.length, 0);
  assert.equal(g.chips.length, 3);
  assert.equal(p.kills, 1);
  assert.equal(g.events.find((e) => e.type === "shot").head, true);
});
test("furniture occludes bullets and retracts the shoulder camera", () => {
  const g = game(),
    p = g.players.a;
  p.x = -3;
  p.z = 8;
  p.yaw = 0;
  p.pitch = 0;
  p.input = { aim: true };
  g.zombies = [{ id: 99, x: -2.35, z: 2, hp: 100 }];
  g.shoot(p);
  assert.equal(g.zombies[0].hp, 100);
  const ray=aimRay({x:0,z:1.8},Math.PI,0,false);
  assert.ok(ray.origin.z>.3,'camera stays south of the closed shortcut');
});
test("active wager does not prevent escaping the table", () => {
  const g = game(),
    p = g.players.a;
  p.x = -3;
  p.z = 7;
  g.action("a", { type: "gamble", station: "slots" });
  g.action("a", { type: "input", input: { forward: -1 } });
  g.update(0.1);
  assert.ok(p.z > 7);
  assert.ok(g.games.slots);
});

test("intermissions never auto-start, and gambling is rejected during combat", () => {
  const g = game(),
    p = g.players.a;
  g.update(3600);
  assert.equal(g.phase, "break");
  assert.equal(g.round, 0);
  g.action("a", { type: "nextRound" });
  assert.equal(g.phase, "combat");
  p.x = -3;
  p.z = 7;
  const chips = p.chips;
  g.action("a", { type: "gamble", station: "slots" });
  assert.equal(p.chips, chips);
  assert.deepEqual(g.games, {});
  g.pending = 0;
  g.zombies = [];
  g.update(0.03);
  assert.equal(g.phase, "break");
  g.update(3600);
  assert.equal(g.round, 1);
});
test("every teammate must ready, wagers reset readiness, and active hands block round start", () => {
  const g = game();
  g.addPlayer("b", "B");
  g.action("a", { type: "nextRound" });
  assert.equal(g.phase, "break");
  assert.equal(g.players.a.ready, true);
  const p = g.players.b;
  p.x = -3;
  p.z = 7;
  g.action("b", { type: "gamble", station: "slots" });
  assert.equal(g.players.a.ready, false);
  g.action("a", { type: "nextRound" });
  assert.equal(g.players.a.ready, false);
  g.update(5);
  g.action("a", { type: "nextRound" });
  g.action("b", { type: "nextRound" });
  assert.equal(g.phase, "combat");
  assert.equal(g.difficulty.team, 2);
  assert.deepEqual(g.games, {});
});
test("no start with a downed teammate; readiness can be cancelled and roster changes reset it", () => {
  const g = game();
  g.addPlayer("b", "B");
  g.players.b.down = true;
  g.action("a", { type: "nextRound" });
  assert.equal(g.players.a.ready, false);
  g.players.b.down = false;
  g.action("a", { type: "nextRound" });
  g.action("a", { type: "nextRound" });
  assert.equal(g.players.a.ready, false);
  g.action("a", { type: "nextRound" });
  g.addPlayer("c", "C");
  assert.equal(g.players.a.ready, false);
});
test("a mid-round join scales remaining wave and enemies while disconnect never heals or weakens them", () => {
  const g = game();
  g.action("a", { type: "nextRound" });
  g.update(0.03);
  const pending = g.pending,
    hp = g.zombies[0].hp;
  g.addPlayer("b", "B");
  assert.ok(g.pending > pending);
  assert.ok(g.zombies[0].hp > hp);
  const scaled = g.zombies[0].hp;
  g.removePlayer("b");
  assert.equal(g.zombies[0].hp, scaled);
});
test("blackjack waits indefinitely for a decision and settlement credits exactly once", () => {
  const g = game(),
    p = g.players.a;
  p.x=17;p.z=10;g.openRooms.push("velvet");
  p.chips=200;
  g.action("a", { type: "gamble", station: "blackjack", wager: 50 });
  g.update(1.2);
  assert.equal(g.games.blackjack.phase, "decision");
  const cards = g.games.blackjack.hands[0].cards.length;
  g.update(1000);
  assert.equal(g.games.blackjack.hands[0].cards.length, cards);
  assert.equal(g.games.blackjack.phase, "decision");
  const snapshot = g.snapshot().games.blackjack;
  assert.equal(snapshot.deck, undefined);
  assert.equal(snapshot.dealer[1].rank, 0);
  g.action("a", { type: "surrender" });
  g.update(1);
  assert.equal(g.games.blackjack.phase, "result");
  assert.equal(p.chips, 175);
  g.update(1000);
  assert.equal(p.chips, 175);
  g.action("a", { type: "collect", station: "blackjack" });
  assert.equal(g.games.blackjack, undefined);
});
