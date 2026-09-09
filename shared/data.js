import { COVER } from "./campaign.js";
import { BOUNDS, barriers, circleRect, barrierDistance } from "./map.js";
import { opticFor } from "./attachments.js";
export const WEAPONS = {
  pitViper: {
    name: "Pit Viper",
    category: "shells",
    damage: 16,
    pellets: 7,
    spread: 0.055,
    interval: 0.75,
    mag: 6,
    reserve: 36,
    reload: 2.1,
    color: 0x9abef7,
  },
  courtesy: {
    name: "Courtesy .38",
    category: "sidearm",
    damage: 26,
    interval: 0.29,
    mag: 12,
    reserve: 60,
    reload: 1.25,
    color: 0xc9b8a0,
  },
  velvet: {
    name: "Velvet Hand",
    category: "sidearm",
    damage: 58,
    interval: 0.42,
    mag: 8,
    reserve: 48,
    reload: 1.5,
    color: 0xffcf75,
  },
  switch: {
    name: "Switch",
    category: "sidearm",
    damage: 19,
    interval: 0.095,
    mag: 24,
    reserve: 144,
    reload: 1.4,
    color: 0xf384ca,
  },
  house: {
    name: "House Special",
    category: "automatic",
    damage: 24,
    interval: 0.085,
    mag: 32,
    reserve: 192,
    reload: 1.6,
    color: 0x6cf5de,
  },
  dividend: {
    name: "Dividend",
    category: "rifle",
    damage: 40,
    interval: 0.13,
    mag: 30,
    reserve: 150,
    reload: 1.8,
    color: 0x86b7ff,
  },
  sovereign: {
    name: "Sovereign",
    category: "rifle",
    damage: 65,
    interval: 0.16,
    mag: 24,
    reserve: 144,
    reload: 2,
    color: 0xffda83,
  },
};
export const REWARDS = {
  shells: { ammo: "shells", amount: 18, label: "18 shotgun shells" },
  pitViper: { weapon: "pitViper", label: "PIT VIPER SHOTGUN" },
  gildedViper: {
    weapon: "pitViper",
    power: 1.6,
    label: "GILDED VIPER · JACKPOT",
  },
  armor: { armor: 75, label: "75 armor" },
  gildedSovereign: {
    weapon: "sovereign",
    power: 1.6,
    label: "GILDED SOVEREIGN · JACKPOT",
  },
  slotAmmo: { ammo: "sidearm", amount: 72, label: "72 sidearm rounds" },
  slotPairAmmo: { ammo: "sidearm", amount: 18, label: "18 sidearm rounds" },
  slotCherryPair: { chips: 20, label: "20 chips" },
  slotCherries: { chips: 60, label: "60 chips" },
  gildedHouse: { weapon: "house", power: 1.6, label: "GILDED HOUSE · JACKPOT" },
  sideAmmo: { ammo: "sidearm", amount: 36, label: "36 sidearm rounds" },
  autoAmmo: { ammo: "automatic", amount: 96, label: "96 automatic rounds" },
  rifleAmmo: { ammo: "rifle", amount: 90, label: "90 rifle rounds" },
  velvet: { weapon: "velvet", label: "VELVET HAND" },
  switch: { weapon: "switch", label: "SWITCH" },
  house: { weapon: "house", label: "HOUSE SPECIAL" },
  dividend: { weapon: "dividend", label: "DIVIDEND" },
  sovereign: { weapon: "sovereign", label: "SOVEREIGN" },
  bonus: { chips: 65, label: "65 chips" },
  dud: { label: "The house thanks you." },
  slotJackpot: {
    weapon: "velvet",
    chips: 250,
    power: 1.6,
    label: "GILDED VELVET · JACKPOT",
  },
  rouletteJackpot: {
    weapon: "house",
    chips: 600,
    power: 1.6,
    label: "GILDED HOUSE · JACKPOT",
  },
};
export const RED = [
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
];
export const STATIONS = [
  {
    id: "slots",
    type: "slots",
    name: "Lucky Afterlife",
    room: "atrium",
    x: -3,
    z: 5,
    r: 1.5,
    cost: 25,
    color: 0xff73bd,
    category: "SIDEARMS",
  },
  {
    id: "roulette",
    type: "roulette",
    name: "Last Rotation",
    room: "emerald",
    x: -17,
    z: 7,
    r: 2,
    cost: 10,
    color: 0x68f5d5,
    category: "AUTOMATICS",
  },
  {
    id: "blackjack",
    type: "blackjack",
    name: "Dead Man’s Hand",
    room: "velvet",
    x: 17,
    z: 7,
    r: 2,
    cost: 50,
    color: 0xffd477,
    category: "RIFLES",
  },
  {
    id: "poker",
    type: "poker",
    name: "Dead Draw Poker",
    room: "arcade",
    x: -17,
    z: -9,
    r: 1.5,
    cost: 25,
    color: 0x86baff,
    category: "SHOTGUNS",
  },
  {
    id: "craps",
    type: "craps",
    name: "Bones & Bets",
    room: "dice",
    x: 17,
    z: -8,
    r: 2.2,
    cost: 25,
    color: 0xffa16a,
    category: "ARMOR",
  },
  {
    id: "baccarat",
    type: "baccarat",
    name: "Crown Baccarat",
    room: "crown",
    x: 0,
    z: -10,
    r: 2,
    cost: 20,
    color: 0xffd98d,
    category: "ELITE RIFLES",
  },
];
STATIONS.push(
  {
    id: "war",
    type: "war",
    name: "Sapphire Showdown",
    room: "sapphire",
    x: -17,
    z: -25,
    r: 2,
    cost: 50,
    wagers: [50, 100, 200],
    color: 0x719ef0,
    category: "CASINO WAR",
  },
  {
    id: "threecard",
    type: "threecard",
    name: "Ivory Three Card",
    room: "ivory",
    x: 0,
    z: -26,
    r: 2,
    cost: 75,
    wagers: [75, 150, 300],
    color: 0xe8ddd0,
    category: "ANTE / PLAY / PAIR PLUS",
  },
  {
    id: "sicbo",
    type: "sicbo",
    name: "Jade Dragon Dice",
    room: "jade",
    x: 17,
    z: -25,
    r: 2.2,
    cost: 100,
    wagers: [100, 200, 400],
    color: 0x70cda2,
    category: "THREE-DICE SIC BO",
  },
  {
    id: "keno",
    type: "keno",
    name: "Neon Numbers",
    room: "neon",
    x: -17,
    z: -41,
    r: 1.5,
    cost: 125,
    wagers: [125, 250, 500],
    color: 0xd887ea,
    category: "80-BALL KENO",
  },
  {
    id: "hilo",
    type: "hilo",
    name: "Obsidian Hi-Lo",
    room: "obsidian",
    x: 17,
    z: -41,
    r: 1.5,
    cost: 150,
    wagers: [150, 300, 600],
    color: 0xc98f79,
    category: "PREDICT / PRESS / BANK",
  },
  {
    id: "letitride",
    type: "letitride",
    name: "Eclipse Let It Ride",
    room: "eclipse",
    x: 0,
    z: -42,
    r: 2.2,
    cost: 200,
    wagers: [200, 400, 800],
    color: 0xe8bd6e,
    category: "THREE BETS / FIVE CARDS",
  },
);
export const OBSTACLES = [
  ...COVER,
  ...STATIONS.map((s) => ({
    x: s.x,
    z: s.z,
    r: s.r,
    h: ["slots", "poker", "keno", "hilo"].includes(s.type) ? 2.8 : 1.4,
  })),
  { x: 3, z: 4, r: 1.15, h: 1.2 },
  { x: -20, z: 3, r: 1, h: 1.2 },
  { x: 20, z: 3, r: 1, h: 1.2 },
  { x: -12, z: -11, r: 1, h: 3.6 },
  { x: 12, z: -11, r: 1, h: 3.6 },
  { x: -4, z: -5, r: 0.8, h: 3.6 },
  { x: 4, z: -5, r: 0.8, h: 3.6 },
];
export { ROOM_SPAWNS as SPAWNS } from "./map.js";
export function moveCircle(entity, dx, dz, r = 0.4, open = ["atrium"]) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
  const walls = barriers(open);
  for (let step = 0; step < steps; step++) {
    for (const [axis, delta] of [
      ["x", dx / steps],
      ["z", dz / steps],
    ]) {
      const old = entity[axis];
      entity[axis] += delta;
      entity.x = Math.max(BOUNDS.minX + r, Math.min(BOUNDS.maxX - r, entity.x));
      entity.z = Math.max(BOUNDS.minZ + r, Math.min(BOUNDS.maxZ - r, entity.z));
      if (
        walls.some((o) => circleRect(entity, r, o)) ||
        OBSTACLES.some(
          (o) => Math.hypot(entity.x - o.x, entity.z - o.z) < o.r + r,
        )
      )
        entity[axis] = old;
    }
  }
}
// Same shoulder-camera origin on client and server, including furniture avoidance.
export function aimRay(p, yaw, pitch, aim, open = ["atrium"]) {
  const dir = {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
  if (aim && opticFor(p)) return { dir, origin: { x: p.x, y: 1.65, z: p.z } };
  const back = aim ? 2.4 : 4.2,
    dx = -dir.x * back + Math.cos(yaw) * 0.65,
    dz = -dir.z * back - Math.sin(yaw) * 0.65,
    dy = -dir.y * back;
  let fraction = 1;
  const a = dx * dx + dz * dz;
  for (const o of OBSTACLES) {
    const ox = p.x - o.x,
      oz = p.z - o.z,
      r = o.r + 0.16,
      b = 2 * (ox * dx + oz * dz),
      c = ox * ox + oz * oz - r * r,
      disc = b * b - 4 * a * c;
    if (disc < 0 || a < 0.001) continue;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t > 0 && t < fraction && 1.65 + dy * t < o.h + 0.15)
      fraction = Math.max(0.08, t - 0.05);
  }
  const wallFraction = barrierDistance(
    { x: p.x, y: 1.65, z: p.z },
    { x: dx, y: dy, z: dz },
    open,
    0.18,
  );
  fraction = Math.min(fraction, Math.max(0.06, wallFraction - 0.03));
  return {
    dir,
    origin: {
      x: Math.max(
        BOUNDS.minX + 0.2,
        Math.min(BOUNDS.maxX - 0.2, p.x + dx * fraction),
      ),
      y: Math.max(0.5, 1.65 + dy * fraction),
      z: Math.max(
        BOUNDS.minZ + 0.2,
        Math.min(BOUNDS.maxZ - 0.2, p.z + dz * fraction),
      ),
    },
  };
}
