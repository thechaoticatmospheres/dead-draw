import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import {
  enemyType,
  maxHealth,
  oddsProfit,
  damageMultiplier,
} from "../shared/expansion.js";
import { finishCraps } from "../server/extra-games.js";
const setup = () => {
  const g = new Game("TEST", () => 0.1);
  g.addPlayer("a", "Alice");
  g.addPlayer("b", "Bob");
  g.restart();
  return [g, g.players.a, g.players.b];
};
const settle = (g, p, extra = {}) => {
  const hand = {
    station: "slots",
    player: p.id,
    cost: 25,
    returned: 50,
    awards: [],
    result: "WIN",
    phase: "playing",
    ...extra,
  };
  g.games.slots = hand;
  g.payTable(hand);
  return hand;
};
test("comps follow real table stakes, upgrades are scoped, capped and rejected during combat", () => {
  const [g, p] = setup();
  p.chips = 1000;
  g.recordWager(p, 25);
  assert.equal(p.comps, 0);
  g.recordWager(p, 25);
  assert.equal(p.comps, 1);
  p.comps = 50;
  g.buy(p, "reload");
  assert.equal(p.perks.reload, undefined);
  g.buy(p, "vitality");
  assert.equal(maxHealth(p), 125);
  assert.equal(p.hp, 125);
  assert.equal(p.comps, 47);
  g.buy(p, "upgrade");
  assert.equal(p.guns[0].level, 1);
  assert.equal(damageMultiplier(p.guns[0]), 1.3);
  assert.equal(p.chips, 875);
  g.phase = "combat";
  g.buy(p, "vitality");
  assert.equal(p.perks.vitality, 1);
  g.phase = "break";
  g.buy(p, "vitality");
  g.buy(p, "vitality");
  const comps = p.comps;
  g.buy(p, "vitality");
  assert.equal(p.comps, comps);
  assert.equal(maxHealth(p), 175);
  g.games.slots = { player: p.id, phase: "bonus" };
  g.buy(p, "ammo");
  assert.equal(p.chips, 875);
});
test("wave roster introduces distinct threats and exactly one boss every fifth wave", () => {
  assert.deepEqual(
    Array.from({ length: 6 }, (_, i) => enemyType(1, i)),
    ["walker", "dealer", "walker", "walker", "crawler", "dealer"],
  );
  const kinds = Array.from({ length: 30 }, (_, i) => enemyType(5, i));
  assert.equal(kinds.filter((k) => k === "boss").length, 1);
  for (const kind of ["runner", "brute", "spitter", "walker"])
    assert.ok(kinds.includes(kind));
  const [g] = setup();
  g.round = 4;
  g.startRound();
  const boss = g.makeEnemy({ x: 0, z: 0 });
  assert.equal(boss.kind, "boss");
  assert.ok(boss.hp > g.difficulty.hp * 10);
});
test("dodge consumes stamina, prevents damage, expires and cannot cross locked partitions", () => {
  const [g, p] = setup();
  g.startRound();
  g.pending = 99;
  p.x = -6;
  p.z = 9;
  p.yaw = Math.PI / 2;
  g.dodge(p);
  assert.equal(p.stamina, 65);
  g.dodge(p);
  assert.equal(p.stamina, 65);
  g.hurt(p, 40);
  assert.equal(p.hp, 100);
  for (let i = 0; i < 12; i++) g.updateTactics(1 / 30, [p]);
  assert.ok(p.x > -7.7);
  assert.equal(p.dodgeTime, 0);
  g.hurt(p, 40);
  assert.equal(p.hp, 60);
  p.stamina = 0;
  g.dodge(p);
  assert.equal(p.dodgeTime, 0);
});
test("grenades spend charges, respect walls and grant kill/contract credit once", () => {
  const [g, p] = setup();
  g.startRound();
  p.x = 0;
  p.z = 9;
  p.yaw = 0;
  g.grenade(p);
  const h = g.hazards[0];
  assert.equal(p.grenades, 1);
  g.grenade(p);
  assert.equal(p.grenades, 1);
  const z = { id: 999, x: h.x, z: h.z, hp: 20, kind: "walker" };
  g.zombies = [z];
  g.updateTactics(1, [p]);
  assert.equal(g.zombies.length, 0);
  assert.equal(p.kills, 1);
  assert.equal(g.chips.length, 3);
  g.updateTactics(1, [p]);
  assert.equal(p.kills, 1);
  g.hazards = [
    {
      id: 1,
      kind: "grenade",
      x: -6,
      z: 9,
      radius: 5,
      delay: 0,
      total: 1,
      life: 1,
      player: p.id,
      damage: 999,
    },
  ];
  g.zombies = [{ id: 1000, x: -9, z: 9, hp: 20 }];
  g.updateTactics(0.1, [p]);
  assert.equal(g.zombies.length, 1);
});
test("acid has a visible windup and second wind is limited to one revival per round", () => {
  const [g, p] = setup();
  g.startRound();
  p.x = 0;
  p.z = 10;
  g.hazards = [
    {
      id: 1,
      kind: "acid",
      x: 0,
      z: 10,
      radius: 2,
      delay: 1,
      total: 1,
      life: 4,
      damage: 9,
    },
  ];
  g.updateTactics(0.5, [p]);
  assert.equal(p.hp, 100);
  g.updateTactics(0.6, [p]);
  assert.equal(p.hp, 91);
  p.perks.secondWind = 1;
  g.hurt(p, 999);
  assert.equal(p.hp, 60);
  assert.equal(p.down, false);
  assert.ok(p.secondWindUsed);
  g.updateTactics(4, [p]);
  g.hurt(p, 999);
  assert.equal(p.down, true);
});
test("a completed crew contract pays each player once when the wave ends", () => {
  const [g, p, q] = setup();
  g.startRound();
  for (let i = 0; i < g.contract.goal; i++) g.progressContract("kills");
  const reward = g.contract.reward;
  g.pending = 0;
  g.zombies = [];
  g.update(0.01);
  assert.equal(g.phase, "break");
  assert.equal(p.chips, 50 + reward);
  assert.equal(q.chips, 50 + reward);
  assert.equal(p.comps, 1);
  g.update(20);
  assert.equal(p.chips, 50 + reward);
});
test("heavy attacks telegraph before damage and ranged enemies hold their distance", () => {
  const [g, p, q] = setup();
  g.startRound();
  g.pending = 99;
  g.spawnTimer = 99;
  p.x = 0;
  p.z = 10;
  q.down = true;
  const brute = {
    id: 500,
    kind: "brute",
    x: 0,
    z: 8.5,
    hp: 200,
    maxHp: 200,
    speed: 1,
    special: 0,
    attack: 0,
    stun: 0,
  };
  g.specialAttack(brute, p, 0.01);
  assert.equal(g.hazards.length, 1);
  assert.equal(g.hazards[0].kind, "slam");
  assert.ok(brute.stun > 0);
  g.updateTactics(0.5, [p]);
  assert.equal(p.hp, 100);
  g.updateTactics(0.4, [p]);
  assert.equal(p.hp, 68);
  g.hazards = [];
  const spitter = {
    id: 501,
    kind: "spitter",
    x: 0,
    z: 4,
    hp: 100,
    maxHp: 100,
    speed: 1,
    special: 99,
    attack: 1,
    stun: 0,
  };
  g.zombies = [spitter];
  g.update(0.1);
  assert.equal(spitter.z, 4);
  spitter.z = 8;
  g.update(0.1);
  assert.ok(spitter.z < 8);
});
test("vault hides unpicked outcomes, waits indefinitely, and banks only once", () => {
  const [g, p, q] = setup();
  const h = settle(g, p, { unlockVault: true });
  const before = p.chips;
  assert.equal(h.phase, "bonus");
  assert.equal(g.snapshot().games.slots.vaultHidden, undefined);
  g.update(100);
  assert.equal(h.phase, "bonus");
  g.readyPlayer(p);
  assert.equal(g.phase, "break");
  g.vaultAction(q, 0);
  assert.equal(h.vault.picks.length, 0);
  const pick = h.vaultHidden.indexOf(50);
  g.vaultAction(p, pick);
  g.vaultAction(p, pick);
  assert.equal(h.vault.winnings, 50);
  g.vaultAction(p, "bank");
  assert.equal(p.chips, before + 50);
  g.vaultAction(p, "bank");
  g.payTable(h);
  assert.equal(p.chips, before + 50);
  assert.equal(h.phase, "result");
});
test("the vault alarm forfeits only the bonus and keeps the original spin and progressive pot", () => {
  const [g, p] = setup();
  const h = settle(g, p, { unlockVault: true }),
    before = p.chips,
    pot = g.jackpot;
  g.vaultAction(p, h.vaultHidden.indexOf(100));
  g.vaultAction(p, h.vaultHidden.indexOf("alarm"));
  assert.equal(p.chips, before);
  assert.equal(h.vault.winnings, 0);
  assert.equal(g.jackpot, pot);
  assert.equal(h.phase, "result");
});
test("exactly five paid slot spins unlock the vault and invalid spins do not move the meter", () => {
  const [g, p] = setup();
  p.chips = 10000;
  p.x = -3;
  p.z = 8;
  for (let i = 0; i < 5; i++) {
    g.gamble(p, { station: "slots" });
    const h = g.games.slots;
    g.gamble(p, { station: "slots" });
    assert.equal(p.vaultSpins, (i + 1) % 5);
    g.payTable(h);
    if (i < 4) delete g.games.slots;
  }
  assert.equal(g.games.slots.phase, "bonus");
  assert.equal(g.jackpot, 255);
});
test("double or bank debits once, conceals the card, blocks ready and settles once", () => {
  const [g, p, q] = setup();
  const h = settle(g, p),
    before = p.chips;
  g.startRisk(q, "slots", "red");
  assert.equal(h.phase, "result");
  g.startRisk(p, "slots", "red");
  assert.equal(p.chips, before - 50);
  assert.equal(g.snapshot().games.slots.riskHidden, undefined);
  assert.equal(g.snapshot().games.slots.riskCard, null);
  g.startRisk(p, "slots", "red");
  assert.equal(p.chips, before - 50);
  g.readyPlayer(p);
  assert.equal(p.ready, false);
  h.riskHidden = { rank: 8, suit: "♥" };
  g.finishRisk(h);
  assert.equal(p.chips, before + 50);
  g.finishRisk(h);
  assert.equal(p.chips, before + 50);
  g.startRisk(p, "slots", "black");
  h.riskHidden = { rank: 9, suit: "♦" };
  g.finishRisk(h);
  assert.equal(h.riskCredit, 0);
  assert.equal(p.chips, before - 50);
});
test("craps odds use exact fair payouts and cannot be edited while dice are rolling", () => {
  const [g, p] = setup();
  p.chips = 1000;
  const h = {
    station: "craps",
    player: p.id,
    phase: "decision",
    lineCost: 100,
    cost: 100,
    point: 6,
    bet: "pass",
    odds: 0,
    rolls: [],
  };
  g.games.craps = h;
  g.changeOdds(p, 60);
  assert.equal(p.chips, 940);
  assert.equal(h.cost, 160);
  assert.equal(p.comps, 0);
  g.changeOdds(p, 999);
  assert.equal(h.odds, 60);
  g.changeOdds(p, 30);
  assert.equal(p.chips, 970);
  h.phase = "rolling";
  g.changeOdds(p, 0);
  assert.equal(h.odds, 30);
  h.dice = [3, 3];
  assert.ok(finishCraps(h));
  assert.equal(h.returned, 266);
  assert.equal(oddsProfit(4, "pass", 30), 60);
  assert.equal(oddsProfit(5, "pass", 30), 45);
  assert.equal(oddsProfit(6, "dont", 30), 25);
  const loss = { ...h, phase: "rolling", dice: [3, 4], rolls: [], point: 6 };
  finishCraps(loss);
  assert.equal(loss.returned, 0);
});
