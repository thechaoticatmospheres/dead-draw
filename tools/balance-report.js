import { pathToFileURL } from "node:url";
import { KENO_PAYTABLE } from "../shared/high-stakes-rules.js";
import { roundSettings } from "../shared/casino-rules.js";
import { waveClearBonus } from "../shared/campaign.js";
import { ROOMS } from "../shared/map.js";
const choose = (n, k) => {
  let v = 1;
  for (let i = 1; i <= k; i++) v = (v * (n - i + 1)) / i;
  return v;
};
export function kenoReturn(spots, stake = 20) {
  let value = 0;
  for (let hits = 0; hits <= spots; hits++) {
    const probability =
      (choose(20, hits) * choose(60, spots - hits)) / choose(80, spots);
    value +=
      probability * Math.floor(stake * (KENO_PAYTABLE[spots][hits] || 0));
  }
  return value / stake;
}
export function unlockProjection(team) {
  let bank = 25 * team,
    next = 1;
  const result = [];
  for (let round = 1; round <= 40; round++) {
    bank += roundSettings(round, team).count * 7 + team * waveClearBonus(round);
    while (next < ROOMS.length && bank >= ROOMS[next].cost) {
      bank -= ROOMS[next].cost;
      result.push({ room: ROOMS[next++].name, wave: round });
    }
  }
  return result;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(
    "Exact Keno chip return, 20-chip ticket (excludes equipment/comps):",
  );
  console.table(
    Array.from({ length: 7 }, (_, i) => ({
      spots: i + 2,
      return: (kenoReturn(i + 2) * 100).toFixed(2) + "%",
    })),
  );
  console.log(
    "Room-unlock baseline: pooled crew income, 7 chips/enemy, all chips collected, no gambling, purchases, bonuses or contract rewards. These are wave counts, not playtest times.",
  );
  for (const team of [1, 2, 4]) {
    console.log(team + " player(s)");
    console.table(unlockProjection(team));
  }
}
