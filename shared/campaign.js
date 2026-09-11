import { clearPath, roomAt, ROOM_SPAWNS } from "./map.js";
export function nearbyCampaignTarget(p, state) {
  if (!p || p.down || p.offline || !state?.campaign) return null;
  return (
    [
      ...DEVICES,
      ...ROOM_SPAWNS.map((v, entrance) => ({
        ...v,
        id: "repair",
        entrance,
        name: "Repair entrance",
        cost: 10,
      })),
    ]
      .filter(
        (v) =>
          state.openRooms.includes(v.room) &&
          roomAt(p)?.id === v.room &&
          Math.hypot(p.x - v.x, p.z - v.z) <= 3 &&
          clearPath(p, v, state.openRooms),
      )
      .sort(
        (a, b) =>
          Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(p.x - b.x, p.z - b.z),
      )[0] || null
  );
}
export function nearbyPower(p, state) {
  const d = DEVICES[0];
  return p &&
    !p.down &&
    !p.offline &&
    state?.openRooms.includes(d.room) &&
    roomAt(p)?.id === d.room &&
    Math.hypot(p.x - d.x, p.z - d.z) <= 3 &&
    clearPath(p, d, state.openRooms)
    ? d
    : null;
}
export const DEVICES = [
  {
    id: "power",
    room: "sapphire",
    x: -21,
    z: -22,
    name: "Restore casino power",
    cost: 150,
  },
  {
    id: "archive",
    room: "neon",
    x: -21,
    z: -38,
    name: "Recover the vault code",
    cost: 0,
  },
  {
    id: "finale",
    room: "eclipse",
    x: 5,
    z: -38,
    name: "Challenge the House",
    cost: 0,
  },
  {
    id: "extract",
    room: "atrium",
    x: 5,
    z: 12,
    name: "Leave with the winnings",
    cost: 0,
  },
  {
    id: "trap-jade",
    room: "jade",
    x: 13,
    z: -21,
    name: "Jade electric trap",
    cost: 75,
  },
  {
    id: "trap-ivory",
    room: "ivory",
    x: 3,
    z: -20,
    name: "Ivory flame trap",
    cost: 75,
  },
];
export const waveClearBonus = (round) =>
  25 + Math.min(100, Math.max(0, round - 1) * 5);
export const COVER = [
  { x: -19, z: -20, r: 0.7, h: 1.15 },
  { x: -17.5, z: -20, r: 0.7, h: 1.15 },
  { x: -14, z: -27, r: 0.8, h: 1.15 },
  { x: 12, z: -19, r: 0.7, h: 2.6 },
  { x: 12, z: -20.4, r: 0.7, h: 2.6 },
  { x: 12, z: -21.8, r: 0.7, h: 2.6 },
  { x: 20, z: -29, r: 0.8, h: 1.15 },
  { x: -3, z: -20, r: 0.65, h: 1.15 },
  { x: -3, z: -21.3, r: 0.65, h: 1.15 },
  { x: 19, z: -36, r: 0.7, h: 2.6 },
  { x: 20.4, z: -36, r: 0.7, h: 2.6 },
  { x: -19, z: -44, r: 0.8, h: 1.15 },
];
export const newCampaign = () => ({
  power: false,
  keys: 0,
  archive: false,
  defeated: false,
  finale: false,
  extracted: false,
  donations: {},
  traps: {},
  barricades: {},
  pings: [],
  votes: [],
});
export const objectiveText = (c) =>
  !c?.power
    ? "Restore power in Sapphire Gallery"
    : c.keys < 2
      ? `Collect boss keys · ${c.keys}/2 (waves 5 & 10)`
      : !c.archive
        ? "Recover the vault code in Neon Exchange"
        : !c.defeated
          ? "Challenge the House in Eclipse Penthouse"
          : "Return to the atrium to extract, or keep playing";
export const CHALLENGES = [
  {
    id: "survivor",
    name: "Still Breathing",
    detail: "Clear wave 5",
    field: "bestRound",
    goal: 5,
  },
  {
    id: "sharpshooter",
    name: "Ace of Spades",
    detail: "Land 100 headshot kills",
    field: "headshots",
    goal: 100,
  },
  {
    id: "teamplayer",
    name: "Never Fold",
    detail: "Revive 10 teammates",
    field: "revives",
    goal: 10,
  },
  {
    id: "regular",
    name: "House Regular",
    detail: "Complete 100 casino hands",
    field: "hands",
    goal: 100,
  },
  {
    id: "escape",
    name: "Beat the House",
    detail: "Extract successfully",
    field: "extractions",
    goal: 1,
  },
];
export const COSMETICS = [
  { id: "classic", name: "Classic", color: 0xffffff },
  { id: "mint", name: "Emerald Crew", color: 0x76d9bb, challenge: "survivor" },
  {
    id: "rose",
    name: "Velvet Ace",
    color: 0xe69bd4,
    challenge: "sharpshooter",
  },
  { id: "gold", name: "House Champion", color: 0xe7c16a, challenge: "escape" },
];
