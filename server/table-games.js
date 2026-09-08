import {
  SLOT_REELS,
  slotGrid,
  evaluateLine,
  betInfo,
  betWins,
  score,
  handOptions,
} from "../shared/casino-rules.js";
import { deck } from "./casino.js";

export function spinSlots(
  lines = 1,
  stake = 25,
  losses = 0,
  rng = Math.random,
) {
  const stops = SLOT_REELS.map((r) => Math.floor(rng() * r.length)),
    grid = slotGrid(stops),
    awards = [];
  for (const row of lines === 3 ? [0, 1, 2] : [1]) {
    const reward = evaluateLine(grid[row]);
    if (reward) awards.push({ row, reward, multiplier: stake / 25 });
  }
  const protection = awards.length === 0 && losses >= 2;
  if (protection) awards.push({ row: -1, reward: "sideAmmo", multiplier: 1 });
  return {
    stops,
    grid,
    awards,
    protection,
    result: protection
      ? "SAFETY PAYOUT"
      : awards.some((a) => a.reward === "slotJackpot")
        ? "JACKPOT"
        : awards.length
          ? "WINNING LINE"
          : "NO WINNING LINE",
  };
}
export function validateBets(bets, balance) {
  if (!Array.isArray(bets) || !bets.length || bets.length > 46) return null;
  const seen = new Set();
  let total = 0;
  for (const b of bets) {
    if (
      !b ||
      typeof b.key !== "string" ||
      !betInfo(b.key) ||
      seen.has(b.key) ||
      !Number.isInteger(b.amount) ||
      b.amount < 10 ||
      b.amount > 500 ||
      b.amount % 5
    )
      return null;
    seen.add(b.key);
    total += b.amount;
  }
  return total <= balance && total <= 1000 ? total : null;
}
export function spinRoulette(bets, rng = Math.random) {
  const pocket = Math.floor(rng() * 37),
    wins = bets.filter((b) => betWins(b.key, pocket));
  const returned = wins.reduce(
    (n, b) => n + b.amount * (betInfo(b.key).odds + 1),
    0,
  );
  const reward = wins.some((b) => b.key.startsWith("n:") && b.amount >= 50)
    ? "gildedHouse"
    : wins.some((b) => b.key.startsWith("dozen") && b.amount >= 25)
      ? "house"
      : wins.length
        ? "autoAmmo"
        : "dud";
  return {
    pocket,
    wins,
    returned,
    reward,
    result: wins.length ? "WINNING BET" : "HOUSE WINS",
  };
}
export function blackjack(wager, rng = Math.random) {
  const cards = deck(rng),
    hand = [cards.pop()],
    dealer = [cards.pop()];
  hand.push(cards.pop());
  dealer.push(cards.pop());
  return {
    deck: cards,
    hands: [{ cards: hand, bet: wager, status: "playing", split: false }],
    dealer,
    activeHand: 0,
    phase: "dealing",
    remaining: 1.1,
  };
}
function nextHand(g) {
  const next = g.hands.findIndex((h) => h.status === "playing");
  if (next >= 0) {
    g.activeHand = next;
    g.phase = "decision";
    g.remaining = null;
  } else {
    g.phase = "dealer";
    g.remaining = 0.65;
  }
}
export function playHand(g, action, p) {
  const options = handOptions(g, p.chips);
  if (!options[action]) return false;
  const h = g.hands[g.activeHand];
  if (action === "split") {
    p.chips -= h.bet;
    g.cost += h.bet;
    const aces = h.cards[0].rank === 1;
    g.hands = h.cards.map((card) => ({
      cards: [card, g.deck.pop()],
      bet: h.bet,
      split: true,
      status: aces ? "stood" : "playing",
    }));
    for (const hand of g.hands)
      if (score(hand.cards) === 21) hand.status = "stood";
    nextHand(g);
    return true;
  }
  if (action === "double") {
    p.chips -= h.bet;
    g.cost += h.bet;
    h.bet *= 2;
    h.doubled = true;
    h.cards.push(g.deck.pop());
    h.status = score(h.cards) > 21 ? "bust" : "stood";
  }
  if (action === "hit") {
    h.cards.push(g.deck.pop());
    if (score(h.cards) > 21) h.status = "bust";
    else if (score(h.cards) === 21) h.status = "stood";
  }
  if (action === "stand") h.status = "stood";
  if (action === "surrender") h.status = "surrendered";
  nextHand(g);
  return true;
}
export function settleBlackjack(g) {
  const dealer = score(g.dealer),
    naturalDealer = dealer === 21 && g.dealer.length === 2;
  let returned = 0;
  const awards = [];
  for (const h of g.hands) {
    const total = score(h.cards),
      natural = !h.split && h.cards.length === 2 && total === 21;
    let amount = 0,
      result = "LOSE",
      reward = null;
    if (h.status === "surrendered") {
      amount = h.bet / 2;
      result = "SURRENDER";
    } else if (total > 21) result = "BUST";
    else if (natural && !naturalDealer) {
      amount = h.bet * 2.5;
      result = "BLACKJACK";
      reward = "sovereign";
    } else if (naturalDealer && !natural) result = "DEALER BLACKJACK";
    else if (total === dealer) {
      amount = h.bet;
      result = "PUSH";
      reward = "rifleAmmo";
    } else if (dealer > 21 || total > dealer) {
      amount = h.bet * 2;
      result = "WIN";
      reward = "dividend";
    }
    h.result = result;
    h.returned = amount;
    returned += amount;
    if (reward) awards.push({ reward, multiplier: 1 });
  }
  return {
    returned,
    awards,
    result: g.hands.some((h) => h.result === "BLACKJACK")
      ? "BLACKJACK"
      : returned > g.cost
        ? "YOU WIN"
        : returned === g.cost
          ? "PUSH"
          : returned
            ? "PARTIAL RETURN"
            : "HOUSE WINS",
  };
}
export function advanceBlackjack(g) {
  if (g.phase === "dealing") {
    if (score(g.dealer) === 21 || score(g.hands[0].cards) === 21) {
      g.hands[0].status = "stood";
      g.phase = "dealer";
      g.remaining = 0.65;
    } else {
      g.phase = "decision";
      g.remaining = null;
    }
    return false;
  }
  if (g.phase === "dealer") {
    const needsDraw = g.hands.some(
      (h) =>
        !["bust", "surrendered"].includes(h.status) &&
        !(!h.split && h.cards.length === 2 && score(h.cards) === 21),
    );
    if (needsDraw && score(g.dealer) < 17) {
      g.dealer.push(g.deck.pop());
      g.remaining = 0.65;
      return false;
    }
    Object.assign(g, settleBlackjack(g));
    return true;
  }
  return false;
}
