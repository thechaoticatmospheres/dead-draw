import { CHALLENGES, COSMETICS } from "../shared/campaign.js";
const key = "dead-draw-profile-v1";
export function cosmeticMessage() {
  const p = readProfile();
  return {
    type: "cosmetic",
    skin: p.skin,
    mastery: Object.fromEntries(
      Object.entries(p.weapons || {}).map(([id, kills]) => [
        id,
        kills >= 500 ? 3 : kills >= 200 ? 2 : kills >= 50 ? 1 : 0,
      ]),
    ),
  };
}
export function readProfile() {
  try {
    return {
      runs: [],
      kills: 0,
      headshots: 0,
      revives: 0,
      hands: 0,
      extractions: 0,
      bestRound: 0,
      bestNet: 0,
      weapons: {},
      skin: "classic",
      ...JSON.parse(localStorage.getItem(key) || "{}"),
    };
  } catch {
    return { runs: [], weapons: {}, skin: "classic" };
  }
}
export function recordRun(summary, id) {
  if (!summary) return;
  const p = readProfile(),
    s = summary.players.find((p) => p.id === id);
  if (!s || p.runs.includes(summary.id)) return;
  p.runs = [...p.runs, summary.id].slice(-200);
  for (const k of ["kills", "headshots", "revives", "hands"])
    p[k] = (p[k] || 0) + (s[k] || 0);
  p.extractions = (p.extractions || 0) + (summary.extracted ? 1 : 0);
  p.bestRound = Math.max(
    p.bestRound || 0,
    summary.clearedRound ?? summary.round,
  );
  p.bestNet = Math.max(p.bestNet || 0, s.net);
  for (const [id, n] of Object.entries(s.weaponKills || {}))
    p.weapons[id] = (p.weapons[id] || 0) + n;
  try {
    localStorage.setItem(key, JSON.stringify(p));
  } catch {}
}
export function setSkin(id) {
  const p = readProfile(),
    skin = COSMETICS.find((s) => s.id === id),
    goal = CHALLENGES.find((c) => c.id === skin?.challenge);
  if (!skin || (goal && (p[goal.field] || 0) < goal.goal)) return;
  p.skin = id;
  try {
    localStorage.setItem(key, JSON.stringify(p));
  } catch {}
}
