import { deck } from "./casino.js";
import { oddsProfit } from "../shared/expansion.js";
import {
  pokerHand,
  crapsOutcome,
  baccaratScore,
  baccaratValue,
  bankerDraws,
} from "../shared/extra-rules.js";

export function dealPoker(rng) {
  const shoe = deck(rng);
  return {
    deck: shoe,
    cards: Array.from({ length: 5 }, () => shoe.pop()),
    phase: "decision",
    remaining: null,
    drawn: false,
  };
}
export function drawPoker(g, holds) {
  if (
    g.phase !== "decision" ||
    g.drawn ||
    !Array.isArray(holds) ||
    holds.length > 5 ||
    new Set(holds).size !== holds.length ||
    holds.some((i) => !Number.isInteger(i) || i < 0 || i > 4)
  )
    return false;
  g.cards = g.cards.map((c, i) => (holds.includes(i) ? c : g.deck.pop()));
  g.holds = holds;
  g.drawn = true;
  const hand = pokerHand(g.cards);
  g.result = hand.name;
  g.returned = g.cost * hand.multiplier;
  const reward =
    hand.multiplier >= 50
      ? "gildedViper"
      : hand.multiplier >= 2
        ? "pitViper"
        : hand.multiplier === 1
          ? "shells"
          : null;
  g.awards = reward ? [{ reward, multiplier: 1 }] : [];
  g.phase = "playing";
  g.remaining = 1.3;
  return true;
}
export function rollCraps(g, rng) {
  if (g.phase !== "decision") return false;
  g.dice = [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
  g.phase = "rolling";
  g.remaining = 1.5;
  return true;
}
export function finishCraps(g) {
  const line = g.lineCost || g.cost;
  const odds = g.odds || 0;
  const pointBefore = g.point;
  const total = g.dice[0] + g.dice[1],
    outcome = crapsOutcome(g.point, total, g.bet);
  g.rolls.push({ dice: [...g.dice], total });
  g.point = outcome.point;
  if (outcome.result === "point") {
    g.phase = "decision";
    g.remaining = null;
    return false;
  }
  g.returned =
    outcome.result === "win"
      ? line * 2 + odds + oddsProfit(pointBefore, g.bet, odds)
      : outcome.result === "push"
        ? line + odds
        : 0;
  g.result =
    outcome.result === "win"
      ? "YOU WIN"
      : outcome.result === "push"
        ? "PUSH · BAR 12"
        : total === 7 && g.point
          ? "SEVEN OUT · HOUSE WINS"
          : "LINE LOSES · " + total;
  g.awards =
    outcome.result === "win" ? [{ reward: "armor", multiplier: 1 }] : [];
  return true;
}
export function dealBaccarat(bet, cost, rng) {
  // Six shuffled decks, rebuilt per coup. No persistent shoe or card-count advantage.
  const shoe = Array.from({ length: 6 }, () => deck(rng)).flat();
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return baccaratFromShoe(shoe, bet, cost);
}
export function baccaratFromShoe(shoe, bet, cost) {
  const playerCards = [shoe.pop()],
    bankerCards = [shoe.pop()];
  playerCards.push(shoe.pop());
  bankerCards.push(shoe.pop());
  const p = baccaratScore(playerCards),
    b = baccaratScore(bankerCards),
    natural = p >= 8 || b >= 8;
  if (!natural) {
    let third = null;
    if (p <= 5) {
      const c = shoe.pop();
      playerCards.push(c);
      third = baccaratValue(c);
    }
    if (bankerDraws(b, third)) bankerCards.push(shoe.pop());
  }
  const playerTotal = baccaratScore(playerCards),
    bankerTotal = baccaratScore(bankerCards),
    winner =
      playerTotal > bankerTotal
        ? "player"
        : bankerTotal > playerTotal
          ? "banker"
          : "tie";
  const won = bet === winner,
    push = winner === "tie" && bet !== "tie",
    returned = won
      ? Math.round(cost * (bet === "tie" ? 9 : bet === "banker" ? 1.95 : 2))
      : push
        ? cost
        : 0;
  const reward = won
    ? bet === "tie"
      ? "gildedSovereign"
      : cost >= 100
        ? "sovereign"
        : "rifleAmmo"
    : null;
  return {
    playerCards,
    bankerCards,
    playerTotal,
    bankerTotal,
    natural,
    winner,
    bet,
    returned,
    awards: reward ? [{ reward, multiplier: 1 }] : [],
    result: push
      ? "TIE · STAKE RETURNED"
      : won
        ? "YOU WIN · " + winner.toUpperCase()
        : "HOUSE WINS · " + winner.toUpperCase(),
    phase: "playing",
    remaining: 4,
    duration: 4,
  };
}
