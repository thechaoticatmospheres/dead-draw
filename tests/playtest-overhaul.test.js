import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { STATIONS, WEAPONS, aimRay } from "../shared/data.js";
import { ROOMS } from "../shared/map.js";
import {
  WHEEL_PADS,
  WHEEL_PRIZES,
  SPECIAL_WEAPONS,
  wheelCost,
} from "../shared/arsenal.js";
import { giveReward } from "../server/casino.js";
import { Checkpoints } from "../server/checkpoints.js";
import { PERKS } from "../shared/expansion.js";
function setup(station = "slots") {
  const g = new Game("PLAYTEST", () => 0.4);
  for (const id of ["a", "b", "c", "d"]) g.addPlayer(id, id);
  g.restart();
  g.openRooms = ROOMS.map((r) => r.id);
  const s = STATIONS.find((s) => s.id === station);
  for (const p of Object.values(g.players)) {
    p.chips = 20000;
    p.x = s.x;
    p.z = s.z + 3;
  }
  return g;
}
const choices = {
  roulette: { bets: [{ key: "red", amount: 30 }] },
  craps: { bet: "pass" },
  baccarat: { bet: "banker" },
  sicbo: { bet: "big" },
  keno: { picks: [1, 2, 3] },
  war: {},
  threecard: {},
  hilo: {},
  letitride: {},
};
const step = (g, t) => {
  for (let i = 0; i < t * 30; i++) g.update(1 / 30);
};
test("four survivors can independently play every casino station with private snapshots", () => {
  for (const s of STATIONS) {
    const g = setup(s.id);
    for (const id of Object.keys(g.players))
      g.action(id, {
        type: "gamble",
        station: s.id,
        wager: s.wagers?.[0] || s.cost,
        ...choices[s.id],
      });
    assert.equal(Object.keys(g.games).length, 4, s.id);
    const hands = Object.values(g.games);
    assert.equal(new Set(hands.map((h) => h.player)).size, 4);
    for (const p of Object.values(g.players)) {
      const snap = g.snapshot(p.id, false);
      assert.equal(Object.keys(snap.games).length, 1, s.id);
      assert.equal(snap.games[s.id].player, p.id);
      assert.equal(snap.games[s.id].deck, undefined);
      const chips = p.chips;
      g.action(p.id, {
        type: "gamble",
        station: s.id,
        wager: s.wagers?.[0] || s.cost,
        ...choices[s.id],
      });
      assert.equal(p.chips, chips, "duplicate wager rejected");
    }
    g.finishIntermissionGames();
    assert.ok(
      hands.every((h) => h.phase === "result" && h.paid),
      s.id + " settles",
    );
    const balances = Object.values(g.players).map((p) => p.chips);
    g.finishIntermissionGames();
    assert.deepEqual(
      Object.values(g.players).map((p) => p.chips),
      balances,
      "single payout",
    );
  }
});
test("deadline settles a committed hand, rejects late wagers and ignores readiness", () => {
  const g = setup("blackjack");
  g.action("a", { type: "gamble", station: "blackjack" });
  const h = g.hand(g.players.a, "blackjack");
  g.timer = 6;
  g.action("b", { type: "gamble", station: "blackjack" });
  assert.equal(g.players.b.chips, 20000);
  g.action("a", { type: "nextRound" });
  assert.equal(g.phase, "break");
  g.timer = 0.01;
  g.update(0.02);
  assert.equal(g.phase, "combat");
  assert.ok(h.paid);
  assert.deepEqual(g.games, {});
});
test("prize wheel charges once, conceals results, rewards all players and relocates only after spins finish", () => {
  const g = setup();
  const originalRoom = g.prizeWheel.room;
  const pad = WHEEL_PADS.find((p) => p.room === originalRoom);
  for (const p of Object.values(g.players)) {
    p.x = pad.x;
    p.z = pad.z + 2;
    g.action(p.id, { type: "prizeWheel" });
  }
  assert.equal(g.prizeWheel.spins, 4);
  assert.deepEqual(
    Object.values(g.players).map((p) => p.chips),
    [19500, 19400, 19300, 19200],
  );
  const snapshot = g.snapshot("a");
  assert.equal(snapshot.players[0].wheelSpin.prize, undefined);
  g.action("a", { type: "prizeWheel" });
  assert.equal(g.prizeWheel.spins, 4);
  const vault = new Checkpoints("test-only");
  assert.equal(vault.seal(g), null);
  g.updatePrizeWheel(5);
  assert.ok(
    Object.values(g.players).every((p) =>
      p.guns.some((w) => w.id === "minigun"),
    ),
  );
  assert.notEqual(g.prizeWheel.room, originalRoom);
  const guns = g.players.a.guns.length;
  g.updatePrizeWheel(5);
  assert.equal(g.players.a.guns.length, guns);
  g.timer = 37;
  const saved = vault.restore(vault.open(vault.seal(g)));
  assert.equal(saved.timer, 37);
  assert.equal(saved.prizeWheel.spins, 4);
  assert.equal(saved.players.a.guns.length, guns);
  assert.equal(wheelCost({ spins: 100 }), 1500);
});
test("wheel reward pool contains only weapons and specials and all seven weapon grants are usable", () => {
  const g = setup();
  assert.equal(Object.keys(SPECIAL_WEAPONS).length, 7);
  for (const prize of WHEEL_PRIZES) {
    assert.ok(["weapon", "special"].includes(prize.kind));
    if (prize.kind === "weapon") {
      giveReward(g.players.a, prize.id);
      assert.ok(WEAPONS[g.players.a.guns[g.players.a.selected].id]);
    }
  }
});
test("saber cleaves without ammo, flame damages a cone, rail pierces and lightning chains", () => {
  for (const id of ["sword", "flamethrower", "railgun", "tesla"]) {
    const g = setup(),
      p = g.players.a;
    p.x = 0;
    p.z = 10;
    p.yaw = 0;
    p.pitch = 0;
    p.input = { aim: true };
    giveReward(p, id);
    const ray = aimRay(p, 0, 0, true, g.openRooms),
      x = id === "railgun" ? ray.origin.x : 0;
    g.zombies = [
      { id: 1, kind: "walker", x, z: 8.5, hp: 1000 },
      { id: 2, kind: "walker", x, z: id === "sword" ? 8 : 6, hp: 1000 },
    ];
    const gun = p.guns[p.selected],
      ammo = gun.ammo;
    g.shoot(p);
    assert.ok(
      g.zombies.every((z) => z.hp < 1000),
      id,
    );
    assert.equal(gun.ammo, ammo - (id === "sword" ? 0 : 1));
    const hp = g.zombies[0].hp;
    g.shoot(p);
    assert.equal(g.zombies[0].hp, hp, "cooldown");
  }
});
test("RPG explodes at impact and damages nearby enemies once", () => {
  const g = setup(),
    p = g.players.a;
  p.x = 0;
  p.z = 10;
  p.yaw = 0;
  p.pitch = 0;
  p.input = { aim: true };
  giveReward(p, "rpg");
  g.zombies = [
    { id: 1, kind: "walker", x: 0.65, z: 6, hp: 1000 },
    { id: 2, kind: "walker", x: 1.5, z: 6, hp: 1000 },
  ];
  g.shoot(p);
  assert.equal(g.zombies[0].hp, 1000);
  g.updateTactics(0.2, Object.values(g.players));
  assert.ok(g.zombies.every((z) => z.hp < 1000));
  const hp = g.zombies[0].hp;
  g.updateTactics(0.2, Object.values(g.players));
  assert.equal(g.zombies[0].hp, hp);
});
test("jump rises and lands, cannot be spammed, and default movement equals former sprint", () => {
  const g = setup(),
    p = g.players.a;
  p.x = 0;
  p.z = 10;
  g.action("a", { type: "jump" });
  g.update(0.1);
  assert.ok(p.height > 0);
  const velocity = p.jumpVelocity;
  g.action("a", { type: "jump" });
  assert.equal(p.jumpVelocity, velocity);
  step(g, 1);
  assert.equal(p.height, 0);
  g.action("a", { type: "input", input: { forward: 1, yaw: 0 } });
  g.update(0.1);
  assert.ok(Math.abs(p.z - 9.4) < 0.001);
  g.action("a", { type: "dodge" });
  assert.ok(p.dodgeTime > 0);
  assert.equal(p.stamina, 65);
});
test("mascot waves replace regular roster and give bonus ammo while boss waves remain intact", () => {
  const g = setup();
  g.round = 3;
  g.startRound();
  assert.equal(g.specialRound, true);
  assert.equal(g.makeEnemy({ x: 0, z: 5 }).kind, "goose");
  const p = g.players.a,
    ammo = p.guns[0].reserve;
  g.pending = 0;
  g.zombies = [];
  g.update(0.03);
  assert.equal(g.phase, "break");
  assert.ok(p.guns[0].reserve > ammo);
  g.startRound();
  assert.equal(g.round, 5);
  assert.equal(g.specialRound, false);
  assert.equal(g.makeEnemy({ x: 0, z: 5 }).kind, "boss");
});
test("new comp ranks affect damage, protection, ammo and revival", () => {
  assert.equal(PERKS.length, 12);
  assert.ok(PERKS.find((p) => p.id === "vitality").price > 3);
  const g = setup(),
    p = g.players.a,
    q = g.players.b;
  p.comps = 100;
  g.buy(p, "toughness");
  g.hurt(p, 50);
  assert.equal(p.hp, 54);
  g.buy(p, "power");
  const target = { hp: 1000 };
  g.weaponDamage(p, p.guns[0], target, 100);
  assert.equal(target.hp, 890);
  g.buy(p, "scavenger");
  const reserve = p.guns[0].reserve;
  g.buy(p, "ammo");
  assert.equal(p.guns[0].reserve - reserve, 30);
  g.buy(p, "medic");
  q.down = true;
  q.hp = 0;
  q.x = p.x + 1;
  q.z = p.z;
  for (let i = 0; i < 67; i++) {
    g.action("a", { type: "input", input: { revive: true } });
    g.update(1 / 30);
  }
  assert.equal(q.down, false);
});

test("the saber cannot consume chip ammo refills or equip gun attachments", () => {
  const g = setup(),
    p = g.players.a;
  giveReward(p, "sword");
  const chips = p.chips;
  g.buy(p, "ammo");
  g.attach(p, "extended");
  assert.equal(p.chips, chips);
  assert.equal(p.guns[p.selected].reserve, 0);
});
