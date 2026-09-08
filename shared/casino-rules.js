import { RED } from "./data.js";

export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const pocketColor = (n) =>
  n === 0 ? "green" : RED.includes(n) ? "red" : "black";
export const OUTSIDE_BETS = [
  ["red", "RED", 18, 1],
  ["black", "BLACK", 18, 1],
  ["even", "EVEN", 18, 1],
  ["odd", "ODD", 18, 1],
  ["low", "1–18", 18, 1],
  ["high", "19–36", 18, 1],
  ["dozen1", "1st 12", 12, 2],
  ["dozen2", "2nd 12", 12, 2],
  ["dozen3", "3rd 12", 12, 2],
];
export function betInfo(key) {
  const outside = OUTSIDE_BETS.find((b) => b[0] === key);
  if (outside)
    return { label: outside[1], pockets: outside[2], odds: outside[3] };
  if (/^n:(?:[0-9]|[12][0-9]|3[0-6])$/.test(key))
    return { label: key.slice(2), pockets: 1, odds: 35 };
  return null;
}
export function betWins(key, n) {
  if (key.startsWith("n:")) return Number(key.slice(2)) === n;
  if (n === 0) return false;
  if (key === "red" || key === "black") return pocketColor(n) === key;
  if (key === "even" || key === "odd")
    return n % 2 === (key === "even" ? 0 : 1);
  if (key === "low" || key === "high") return key === "low" ? n <= 18 : n >= 19;
  return /^dozen[123]$/.test(key) && Math.ceil(n / 12) === Number(key.at(-1));
}
// Twenty equiprobable stops on each physical strip: 8 ammo, 6 cherries, 3 diamonds, 2 bars, one 7.
export const SLOT_REELS = [
  [
    "A",
    "C",
    "A",
    "♦",
    "C",
    "A",
    "BAR",
    "C",
    "A",
    "C",
    "♦",
    "A",
    "C",
    "A",
    "7",
    "A",
    "BAR",
    "C",
    "♦",
    "A",
  ],
  [
    "C",
    "A",
    "♦",
    "A",
    "C",
    "BAR",
    "A",
    "C",
    "7",
    "A",
    "♦",
    "C",
    "A",
    "A",
    "C",
    "BAR",
    "A",
    "♦",
    "C",
    "A",
  ],
  [
    "A",
    "♦",
    "C",
    "A",
    "BAR",
    "C",
    "A",
    "C",
    "♦",
    "A",
    "7",
    "C",
    "A",
    "BAR",
    "A",
    "C",
    "♦",
    "A",
    "C",
    "A",
  ],
];
export const SLOT_LABELS = { A: "▰", C: "●", "♦": "♦", BAR: "BAR", 7: "7" };
export const SLOT_PAYTABLE = [
  {
    pattern: "7 7 7",
    reward: "slotJackpot",
    detail: "Gilded Velvet + 250 chips",
    chance: "1 / 8,000",
  },
  {
    pattern: "BAR BAR BAR",
    reward: "switch",
    detail: "Switch machine pistol",
    chance: "0.10%",
  },
  {
    pattern: "♦ ♦ ♦",
    reward: "velvet",
    detail: "Velvet heavy pistol",
    chance: "0.34%",
  },
  {
    pattern: "▰ ▰ ▰",
    reward: "slotAmmo",
    detail: "72 sidearm rounds",
    chance: "6.40%",
  },
  {
    pattern: "● ● ●",
    reward: "slotCherries",
    detail: "60 chips",
    chance: "2.70%",
  },
  {
    pattern: "▰ ▰ any",
    reward: "slotPairAmmo",
    detail: "18 sidearm rounds (two only)",
    chance: "9.60%",
  },
  {
    pattern: "● ● any",
    reward: "slotCherryPair",
    detail: "20 chips (two only)",
    chance: "6.30%",
  },
];
export function slotGrid(stops) {
  return [-1, 0, 1].map((offset) =>
    stops.map((stop, i) => SLOT_REELS[i][(stop + offset + 20) % 20]),
  );
}
export function evaluateLine(symbols) {
  const [a, b, c] = symbols;
  if (a === b && b === c)
    return {
      7: "slotJackpot",
      BAR: "switch",
      "♦": "velvet",
      A: "slotAmmo",
      C: "slotCherries",
    }[a];
  if (a === b) return { A: "slotPairAmmo", C: "slotCherryPair" }[a] || null;
  return null;
}
export function score(cards) {
  let total = 0,
    aces = 0;
  for (const c of cards) {
    total += c.rank === 1 ? 11 : Math.min(10, c.rank);
    aces += c.rank === 1 ? 1 : 0;
  }
  while (total > 21 && aces-- > 0) total -= 10;
  return total;
}
export function handOptions(g, balance) {
  const h = g.hands?.[g.activeHand];
  const turn = g.phase === "decision" && h?.status === "playing";
  const two = turn && h.cards.length === 2;
  return {
    hit: turn,
    stand: turn,
    double: two && balance >= h.bet,
    split:
      two &&
      g.hands.length === 1 &&
      h.cards[0].rank === h.cards[1].rank &&
      balance >= h.bet,
    surrender: two && !h.split,
  };
}
export function roundSettings(round, team) {
  const extra = Math.max(0, Math.min(4, team) - 1);
  return {
    team: extra + 1,
    count: Math.ceil((6 + Math.max(0, round - 1) * 4) * (1 + 0.85 * extra)),
    hp: Math.round((62 + Math.min(110, round * 7)) * (1 + 0.1 * extra)),
    speed: 1.05 + Math.min(1.3, round * 0.075),
    interval: Math.max(0.22, (1.2 - round * 0.04) / (1 + 0.35 * extra)),
    cap: Math.min(36, 12 + round * 2 + extra * 5),
  };
}
