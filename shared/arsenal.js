import { ROOMS, clearPath, roomAt } from "./map.js";
export const SPECIAL_WEAPONS = {
  sword: {
    name: "Velvet Saber",
    category: "melee",
    mode: "sword",
    model: "weapon-sword",
    damage: 95,
    range: 2.7,
    interval: 0.62,
    mag: 1,
    reserve: 0,
    reload: 0,
    color: 0xf2db9b,
    melee: true,
  },
  crossbow: {
    name: "Pit Boss Crossbow",
    category: "bolts",
    model: "weapon-crossbow",
    damage: 145,
    interval: 0.8,
    mag: 1,
    reserve: 24,
    reload: 1.35,
    color: 0xb5e1ad,
  },
  rpg: {
    name: "Housebreaker RPG",
    category: "rockets",
    mode: "rocket",
    model: "weapon-rpg",
    damage: 300,
    range: 35,
    interval: 1.1,
    mag: 1,
    reserve: 8,
    reload: 2.8,
    color: 0xf7ad68,
  },
  flamethrower: {
    name: "Dragon’s Breath",
    category: "fuel",
    mode: "flame",
    model: "weapon-flamethrower",
    damage: 9,
    range: 6,
    interval: 0.09,
    mag: 90,
    reserve: 270,
    reload: 2.7,
    color: 0xff934d,
  },
  minigun: {
    name: "The Debt Collector",
    category: "heavy",
    model: "weapon-minigun",
    damage: 22,
    interval: 0.055,
    mag: 120,
    reserve: 360,
    reload: 3.8,
    color: 0xe9c867,
  },
  railgun: {
    name: "Royal Flush Railgun",
    category: "energy",
    mode: "rail",
    model: "weapon-railgun",
    damage: 185,
    range: 42,
    interval: 1.1,
    mag: 4,
    reserve: 24,
    reload: 2.4,
    color: 0x79e8fa,
  },
  tesla: {
    name: "Static Jackpot",
    category: "energy",
    mode: "tesla",
    model: "weapon-tesla",
    damage: 48,
    range: 12,
    interval: 0.5,
    mag: 12,
    reserve: 72,
    reload: 2.2,
    color: 0xb4a1ff,
  },
};
export const WHEEL_PRIZES = [
  ...Object.entries(SPECIAL_WEAPONS).map(([id, w]) => ({
    id,
    label: w.name,
    kind: "weapon",
  })),
  { id: "gildedSovereign", label: "Gilded Sovereign", kind: "weapon" },
  { id: "maxAmmo", label: "MAX AMMO · All weapons", kind: "special" },
  { id: "goldVest", label: "GOLDEN VEST · 150 armor", kind: "special" },
  { id: "extraLife", label: "SECOND CHANCE · Revive token", kind: "special" },
];
export const WHEEL_PADS = ROOMS.map((r) => ({
  room: r.id,
  x: r.x + 5,
  z: r.z + 1,
  r: 1,
  h: 0.5,
}));
export const wheelCost = (w) => Math.min(1500, 500 + 100 * (w?.spins || 0));
export function nearbyWheel(p, state) {
  const w = state?.prizeWheel,
    pad = WHEEL_PADS.find((s) => s.room === w?.room);
  return p &&
    !p.down &&
    pad &&
    roomAt(p)?.id === pad.room &&
    state.openRooms.includes(pad.room) &&
    Math.hypot(p.x - pad.x, p.z - pad.z) < 3.5 &&
    clearPath(p, pad, state.openRooms)
    ? pad
    : null;
}
