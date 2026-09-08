export const POKER_PAYTABLE = [
  ["ROYAL FLUSH", 800],
  ["STRAIGHT FLUSH", 50],
  ["FOUR OF A KIND", 25],
  ["FULL HOUSE", 9],
  ["FLUSH", 6],
  ["STRAIGHT", 4],
  ["THREE OF A KIND", 3],
  ["TWO PAIR", 2],
  ["JACKS OR BETTER", 1],
];
export function pokerHand(cards) {
  const ranks = cards
      .map((c) => (c.rank === 1 ? 14 : c.rank))
      .sort((a, b) => a - b),
    counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a),
    flush = cards.every((c) => c.suit === cards[0].suit),
    straight =
      counts.size === 5 &&
      (ranks[4] - ranks[0] === 4 || ranks.join(",") === "2,3,4,5,14");
  let name =
    flush && straight && ranks[0] === 10
      ? "ROYAL FLUSH"
      : flush && straight
        ? "STRAIGHT FLUSH"
        : groups[0] === 4
          ? "FOUR OF A KIND"
          : groups[0] === 3 && groups[1] === 2
            ? "FULL HOUSE"
            : flush
              ? "FLUSH"
              : straight
                ? "STRAIGHT"
                : groups[0] === 3
                  ? "THREE OF A KIND"
                  : groups[0] === 2 && groups[1] === 2
                    ? "TWO PAIR"
                    : groups[0] === 2 &&
                        [...counts].some(([rank, n]) => n === 2 && rank >= 11)
                      ? "JACKS OR BETTER"
                      : "NO PAYING HAND";
  return {
    name,
    multiplier: POKER_PAYTABLE.find((p) => p[0] === name)?.[1] || 0,
  };
}
export function crapsOutcome(point, total, bet) {
  let result = "point";
  if (!point) {
    if ([7, 11].includes(total)) result = bet === "pass" ? "win" : "loss";
    else if ([2, 3].includes(total)) result = bet === "pass" ? "loss" : "win";
    else if (total === 12) result = bet === "pass" ? "loss" : "push";
  } else if (total === 7) result = bet === "pass" ? "loss" : "win";
  else if (total === point) result = bet === "pass" ? "win" : "loss";
  return {
    result,
    point: point || ([4, 5, 6, 8, 9, 10].includes(total) ? total : 0),
  };
}
export const baccaratValue = (c) => (c.rank >= 10 ? 0 : c.rank);
export const baccaratScore = (cards) =>
  cards.reduce((sum, c) => sum + baccaratValue(c), 0) % 10;
export function bankerDraws(total, playerThird) {
  if (playerThird === null) return total <= 5;
  return (
    total <= 2 ||
    (total === 3 && playerThird !== 8) ||
    (total === 4 && playerThird >= 2 && playerThird <= 7) ||
    (total === 5 && playerThird >= 4 && playerThird <= 7) ||
    (total === 6 && [6, 7].includes(playerThird))
  );
}
