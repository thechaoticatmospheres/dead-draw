export const BOUNDS = { minX: -24, maxX: 24, minZ: -16, maxZ: 16 };
export const ROOMS = [
  {
    id: "atrium",
    name: "PALM ATRIUM",
    x: 0,
    z: 8,
    cost: 0,
    color: 0xc39b61,
    station: "slots",
  },
  {
    id: "emerald",
    name: "EMERALD LOUNGE",
    x: -16,
    z: 8,
    cost: 75,
    color: 0x5dd8b3,
    station: "roulette",
  },
  {
    id: "velvet",
    name: "VELVET ROOM",
    x: 16,
    z: 8,
    cost: 125,
    color: 0xd49bca,
    station: "blackjack",
  },
  {
    id: "arcade",
    name: "DRAW ARCADE",
    x: -16,
    z: -8,
    cost: 200,
    color: 0x85b8ef,
    station: "poker",
  },
  {
    id: "dice",
    name: "DICE HALL",
    x: 16,
    z: -8,
    cost: 250,
    color: 0xe19264,
    station: "craps",
  },
  {
    id: "crown",
    name: "CROWN SALON",
    x: 0,
    z: -8,
    cost: 350,
    color: 0xe9cb83,
    station: "baccarat",
  },
];
export const DOORS = [
  {
    id: "emerald",
    from: "atrium",
    to: "emerald",
    x: -8,
    z: 9,
    w: 0.36,
    d: 3.6,
  },
  { id: "velvet", from: "atrium", to: "velvet", x: 8, z: 9, w: 0.36, d: 3.6 },
  {
    id: "arcade",
    from: "emerald",
    to: "arcade",
    x: -16,
    z: 0,
    w: 3.6,
    d: 0.36,
  },
  { id: "dice", from: "velvet", to: "dice", x: 16, z: 0, w: 3.6, d: 0.36 },
  {
    id: "crown-west",
    from: "arcade",
    to: "crown",
    x: -8,
    z: -9,
    w: 0.36,
    d: 3.6,
  },
  { id: "crown-east", from: "dice", to: "crown", x: 8, z: -9, w: 0.36, d: 3.6 },
  {
    id: "shortcut",
    from: "atrium",
    to: "crown",
    x: 0,
    z: 0,
    w: 3.6,
    d: 0.36,
    shortcut: true,
  },
];
export const WALLS = [
  ...[-8, 8].flatMap((x) =>
    [
      [-16, -10.8],
      [-7.2, 7.2],
      [10.8, 16],
    ].map(([a, b]) => ({ x, z: (a + b) / 2, w: 0.36, d: b - a, h: 5.15 })),
  ),
  ...[
    [-24, -17.8],
    [-14.2, -1.8],
    [1.8, 14.2],
    [17.8, 24],
  ].map(([a, b]) => ({ x: (a + b) / 2, z: 0, w: b - a, d: 0.36, h: 5.15 })),
];
export const OUTER_WALLS = [
  { x: 0, z: -16.2, w: 48.4, d: 0.4, h: 5.3 },
  { x: 0, z: 16.2, w: 48.4, d: 0.4, h: 5.3 },
  { x: -24.2, z: 0, w: 0.4, d: 32, h: 5.3 },
  { x: 24.2, z: 0, w: 0.4, d: 32, h: 5.3 },
];
export const ROOM_SPAWNS = ROOMS.flatMap((room) =>
  [-1, 1].map((side) => ({
    room: room.id,
    x: room.x + side * 6,
    z: room.z + (room.z > 0 ? 6 : -6),
  })),
);
export const roomAt = (p) =>
  ROOMS.find(
    (r) => p.x >= r.x - 8 && p.x <= r.x + 8 && p.z >= r.z - 8 && p.z <= r.z + 8,
  );
export const doorOpen = (d, open = ["atrium"]) =>
  open.includes(d.from) && open.includes(d.to);
export const barriers = (open = ["atrium"]) => [
  ...WALLS,
  ...OUTER_WALLS,
  ...DOORS.filter((d) => !doorOpen(d, open)).map((d) => ({ ...d, h: 3.8 })),
];
export function circleRect(p, r, o) {
  const x = Math.max(o.x - o.w / 2, Math.min(o.x + o.w / 2, p.x)),
    z = Math.max(o.z - o.d / 2, Math.min(o.z + o.d / 2, p.z));
  return Math.hypot(p.x - x, p.z - z) < r;
}
export function rayBox(origin, dir, box, pad = 0) {
  let low = 0,
    high = Infinity;
  for (const [axis, min, max] of [
    ["x", box.x - box.w / 2 - pad, box.x + box.w / 2 + pad],
    ["y", -pad, (box.h || 3.8) + pad],
    ["z", box.z - box.d / 2 - pad, box.z + box.d / 2 + pad],
  ]) {
    if (Math.abs(dir[axis]) < 1e-8) {
      if (origin[axis] < min || origin[axis] > max) return Infinity;
      continue;
    }
    const a = (min - origin[axis]) / dir[axis],
      b = (max - origin[axis]) / dir[axis];
    low = Math.max(low, Math.min(a, b));
    high = Math.min(high, Math.max(a, b));
    if (low > high) return Infinity;
  }
  return low;
}
export function barrierDistance(origin, dir, open, pad = 0) {
  return Math.min(
    Infinity,
    ...barriers(open).map((b) => rayBox(origin, dir, b, pad)),
  );
}
export function clearPath(a, b, open) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    length = Math.hypot(dx, dz);
  if (!length) return true;
  return (
    barrierDistance(
      { x: a.x, y: 1.4, z: a.z },
      { x: dx / length, y: 0, z: dz / length },
      open,
    ) >= length
  );
}
