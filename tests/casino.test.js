import test from "node:test";
import assert from "node:assert/strict";
import { deck, giveReward } from "../server/casino.js";
import {
  spinSlots,
  spinRoulette,
  validateBets,
  blackjack,
  playHand,
  advanceBlackjack,
  settleBlackjack,
} from "../server/table-games.js";
import {
  score,
  slotGrid,
  evaluateLine,
  SLOT_REELS,
  betWins,
  roundSettings,
  WHEEL_ORDER,
} from "../shared/casino-rules.js";
const c = (...ranks) => ranks.map((rank) => ({ rank, suit: "♠" }));
const hand = (cards, bet = 50, extra = {}) => ({
  cards,
  bet,
  status: "stood",
  split: false,
  ...extra,
});
function fixture(hands, dealer) {
  return {
    hands,
    dealer,
    cost: hands.reduce((s, h) => s + h.bet, 0),
    phase: "decision",
    activeHand: 0,
    deck: c(2, 3, 4, 5),
  };
}
test("physical slots evaluate lines, three rows and all paytable patterns", () => {
  assert.equal(evaluateLine(["7", "7", "7"]), "slotJackpot");
  assert.equal(evaluateLine(["A", "A", "C"]), "slotPairAmmo");
  assert.equal(evaluateLine(["C", "C", "C"]), "slotCherries");
  assert.equal(evaluateLine(["BAR", "C", "BAR"]), null);
  let i = 0;
  const stops = [14, 8, 10];
  const spin = spinSlots(1, 50, 0, () => stops[i++] / 20 + 0.001);
  assert.equal(spin.awards[0].reward, "slotJackpot");
  assert.equal(spin.awards[0].multiplier, 2);
  assert.deepEqual(spin.grid[1], ["7", "7", "7"]);
  assert.equal(slotGrid([0, 0, 0]).length, 3);
  assert.equal(
    SLOT_REELS.every((r) => r.length === 20),
    true,
  );
});
test("loss protection grants a separate consolation without changing the reels", () => {
  const rng = () => 0.1,
    a = spinSlots(1, 25, 0, rng),
    b = spinSlots(1, 25, 2, rng);
  assert.deepEqual(a.stops, b.stops);
  if (!a.awards.length) {
    assert.equal(b.protection, true);
    assert.equal(b.awards[0].reward, "sideAmmo");
  }
  let total = 0;
  for (let a = 0; a < 20; a++)
    for (let b = 0; b < 20; b++)
      for (let c = 0; c < 20; c++)
        total += !!evaluateLine(slotGrid([a, b, c])[1]);
  assert.equal(total, 2036);
});
test("roulette single-zero odds, every outside bet, and traditional payouts", () => {
  assert.equal(new Set(WHEEL_ORDER).size, 37);
  for (const key of ["red", "black", "even", "odd", "low", "high"]) {
    assert.equal(
      Array.from({ length: 37 }, (_, n) => betWins(key, n)).filter(Boolean)
        .length,
      18,
    );
    assert.equal(betWins(key, 0), false);
  }
  for (const key of ["dozen1", "dozen2", "dozen3"])
    assert.equal(
      Array.from({ length: 37 }, (_, n) => betWins(key, n)).filter(Boolean)
        .length,
      12,
    );
  const r = spinRoulette(
    [
      { key: "n:3", amount: 50 },
      { key: "red", amount: 25 },
      { key: "black", amount: 10 },
    ],
    () => 3.1 / 37,
  );
  assert.equal(r.returned, 1850);
  assert.equal(r.reward, "gildedHouse");
  assert.equal(r.wins.length, 2);
  assert.equal(spinRoulette([{ key: "red", amount: 25 }], () => 0).returned, 0);
});
test("roulette rejects malformed, duplicate, over-budget and excessive wagers", () => {
  for (const b of [
    [{ key: "bad", amount: 25 }],
    [{ key: "red", amount: -25 }],
    [{ key: "red", amount: Infinity }],
    [{ key: "red", amount: 7 }],
    [{ key: "n:37", amount: 25 }],
    [
      { key: "red", amount: 25 },
      { key: "red", amount: 25 },
    ],
    [{ key: "red", amount: 600 }],
  ])
    assert.equal(validateBets(b, 1000), null);
  assert.equal(validateBets([{ key: "red", amount: 50 }], 25), null);
  assert.equal(
    validateBets(
      [
        { key: "n:0", amount: 25 },
        { key: "odd", amount: 50 },
      ],
      100,
    ),
    75,
  );
});
test("blackjack soft aces and deck integrity", () => {
  assert.equal(score(c(1, 1, 9)), 21);
  assert.equal(score(c(1, 9, 5)), 15);
  assert.equal(new Set(deck().map((c) => c.rank + c.suit)).size, 52);
});
test("blackjack settlements include returned stakes, 3:2 naturals and split-21 distinction", () => {
  assert.equal(
    settleBlackjack(fixture([hand(c(1, 10))], c(10, 8))).returned,
    125,
  );
  assert.equal(
    settleBlackjack(fixture([hand(c(1, 10))], c(1, 10))).returned,
    50,
  );
  assert.equal(
    settleBlackjack(fixture([hand(c(10, 5, 6))], c(1, 10))).returned,
    0,
  );
  assert.equal(
    settleBlackjack(fixture([hand(c(1, 10), 50, { split: true })], c(10, 8)))
      .returned,
    100,
  );
  assert.equal(
    settleBlackjack(
      fixture([hand(c(10, 9), 50, { status: "surrendered" })], c(10, 8)),
    ).returned,
    25,
  );
  assert.equal(
    settleBlackjack(fixture([hand(c(10, 10, 5))], c(10, 10, 5))).returned,
    0,
  );
});
test("double deducts exactly one extra stake, draws once and ends hand", () => {
  const g = fixture([hand(c(5, 6), 50, { status: "playing" })], c(10, 8)),
    p = { chips: 100 };
  g.deck = c(10);
  assert.equal(playHand(g, "double", p), true);
  assert.equal(p.chips, 50);
  assert.equal(g.cost, 100);
  assert.equal(g.hands[0].cards.length, 3);
  assert.equal(g.phase, "dealer");
  assert.equal(playHand(g, "double", p), false);
  assert.equal(settleBlackjack(g).returned, 200);
});
test("split creates separate wagers, limits resplits, and split aces draw once", () => {
  const g = fixture([hand(c(8, 8), 50, { status: "playing" })], c(10, 8)),
    p = { chips: 100 };
  g.deck = c(8, 8);
  assert.ok(playHand(g, "split", p));
  assert.equal(g.hands.length, 2);
  assert.equal(p.chips, 50);
  assert.equal(playHand(g, "split", p), false);
  playHand(g, "stand", p);
  assert.equal(g.activeHand, 1);
  playHand(g, "stand", p);
  assert.equal(g.phase, "dealer");
  const a = fixture([hand(c(1, 1), 50, { status: "playing" })], c(10, 8));
  assert.ok(playHand(a, "split", p));
  assert.equal(a.phase, "dealer");
  assert.equal(
    a.hands.every((h) => h.cards.length === 2),
    true,
  );
});
test("invalid blackjack actions cannot change balance or cards", () => {
  const g = fixture([hand(c(10, 6), 50, { status: "playing" })], c(10, 8)),
    p = { chips: 0 };
  assert.equal(playHand(g, "split", p), false);
  assert.equal(playHand(g, "double", p), false);
  playHand(g, "hit", p);
  assert.equal(playHand(g, "surrender", p), false);
});
test("dealer peeks for blackjack and draws individually to soft 17", () => {
  const g = blackjack(50, () => 0.1);
  g.hands = [hand(c(10, 8), 50, { status: "playing" })];
  g.dealer = c(1, 10);
  advanceBlackjack(g);
  assert.equal(g.phase, "dealer");
  assert.equal(advanceBlackjack(g), true);
  const d = fixture([hand(c(10, 9))], c(1, 5));
  d.phase = "dealer";
  d.deck = c(1);
  assert.equal(advanceBlackjack(d), false);
  assert.equal(score(d.dealer), 17);
  assert.equal(advanceBlackjack(d), true);
  assert.equal(d.dealer.length, 3);
});
test("ammo banks until a matching weapon arrives and multipliers preserve inventory", () => {
  const p = { chips: 0, stash: { rifle: 0 }, guns: [], selected: 0 };
  giveReward(p, "rifleAmmo", 2);
  giveReward(p, "dividend");
  assert.equal(p.guns[0].reserve, 330);
  giveReward(p, "dividend");
  assert.equal(p.guns.length, 1);
  assert.equal(p.guns[0].reserve, 480);
});
test("co-op scales count, health, spawn cadence and alive cap without unbounded health", () => {
  const one = roundSettings(5, 1),
    four = roundSettings(5, 4);
  assert.ok(four.count > one.count * 3);
  assert.ok(four.hp > one.hp && four.hp < one.hp * 1.5);
  assert.ok(four.interval < one.interval);
  assert.ok(four.cap > one.cap);
  assert.equal(roundSettings(100, 4).hp, roundSettings(1000, 4).hp);
});
