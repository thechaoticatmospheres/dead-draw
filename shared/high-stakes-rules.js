export const HIGH_STAKES = [
  "war",
  "threecard",
  "sicbo",
  "keno",
  "hilo",
  "letitride",
];
export const rankValue = (c) => (c.rank === 1 ? 14 : c.rank);
export const SIC_BO_BETS = [
  ["small", "SMALL · 4–10", "1:1 · triples lose"],
  ["big", "BIG · 11–17", "1:1 · triples lose"],
  ["odd", "ODD TOTAL", "1:1 · triples lose"],
  ["even", "EVEN TOTAL", "1:1 · triples lose"],
  ["triple", "ANY TRIPLE", "30:1"],
  ...Array.from({ length: 6 }, (_, i) => [
    `face:${i + 1}`,
    `FACE ${i + 1}`,
    "1 / 2 / 3 matches pay 1 / 2 / 3:1",
  ]),
];
export function sicBoProfit(dice, bet) {
  const sum = dice.reduce((a, b) => a + b, 0),
    triple = dice.every((n) => n === dice[0]);
  if (bet === "triple") return triple ? 30 : -1;
  if (bet.startsWith("face:")) {
    const n = dice.filter((v) => v === Number(bet.slice(5))).length;
    return n || -1;
  }
  if (triple) return -1;
  return {
    small: sum >= 4 && sum <= 10,
    big: sum >= 11 && sum <= 17,
    odd: sum % 2 === 1,
    even: sum % 2 === 0,
  }[bet]
    ? 1
    : -1;
}
// Total-return multipliers, including the ticket stake. 20 unique balls drawn from 80.
export const KENO_PAYTABLE = {
  2: { 2: 14.1 },
  3: { 2: 2, 3: 42 },
  4: { 2: 1.16, 3: 5.8, 4: 116 },
  5: { 3: 2.43, 4: 24.3, 5: 546.5 },
  6: { 3: 1.39, 4: 9.7, 5: 69.3, 6: 1386 },
  7: { 3: 1.36, 4: 4.07, 5: 27.14, 6: 135.7, 7: 2714 },
  8: { 4: 3, 5: 15, 6: 75, 7: 750, 8: 7500 },
};
export function threeCardRank(cards) {
  const ranks = cards.map(rankValue).sort((a, b) => b - a);
  const unique = [...new Set(ranks)];
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const wheel = ranks.join() === "14,3,2";
  const straight = unique.length === 3 && (ranks[0] - ranks[2] === 2 || wheel);
  const trips = unique.length === 1,
    pair = unique.length === 2;
  const level =
    straight && flush ? 5 : trips ? 4 : straight ? 3 : flush ? 2 : pair ? 1 : 0;
  const pairRank = pair
    ? ranks.find((r) => ranks.filter((v) => v === r).length === 2)
    : 0;
  const tie = pair
    ? [pairRank, ...ranks.filter((r) => r !== pairRank)]
    : straight
      ? [wheel ? 3 : ranks[0]]
      : ranks;
  return {
    level,
    tie,
    name: [
      "HIGH CARD",
      "PAIR",
      "FLUSH",
      "STRAIGHT",
      "THREE OF A KIND",
      "STRAIGHT FLUSH",
    ][level],
  };
}
export function compareThree(a, b) {
  const A = threeCardRank(a),
    B = threeCardRank(b);
  if (A.level !== B.level) return Math.sign(A.level - B.level);
  for (let i = 0; i < A.tie.length; i++)
    if (A.tie[i] !== B.tie[i]) return Math.sign(A.tie[i] - B.tie[i]);
  return 0;
}
export const RIDE_PAYTABLE = [
  ["ROYAL FLUSH", 1000],
  ["STRAIGHT FLUSH", 200],
  ["FOUR OF A KIND", 50],
  ["FULL HOUSE", 11],
  ["FLUSH", 8],
  ["STRAIGHT", 5],
  ["THREE OF A KIND", 3],
  ["TWO PAIR", 2],
  ["TENS OR BETTER", 1],
];
export function hiLoQuote(card, direction, credit) {
  const rank = rankValue(card),
    count =
      direction === "higher" ? 14 - rank : direction === "lower" ? rank - 2 : 0;
  return {
    count,
    chance: count / 13,
    returned: count > 0 ? Math.floor((credit * 12.48) / count) : 0,
  };
}
