export const BOUNDS = { minX: -24, maxX: 24, minZ: -48, maxZ: 16 };
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
ROOMS.push(
  {
    id: "sapphire",
    name: "SAPPHIRE GALLERY",
    x: -16,
    z: -24,
    cost: 500,
    color: 0x719ef0,
    station: "war",
  },
  {
    id: "ivory",
    name: "IVORY CLUB",
    x: 0,
    z: -24,
    cost: 700,
    color: 0xe8ddd0,
    station: "threecard",
  },
  {
    id: "jade",
    name: "JADE PAVILION",
    x: 16,
    z: -24,
    cost: 950,
    color: 0x70cda2,
    station: "sicbo",
  },
  {
    id: "neon",
    name: "NEON EXCHANGE",
    x: -16,
    z: -40,
    cost: 1250,
    color: 0xd887ea,
    station: "keno",
  },
  {
    id: "obsidian",
    name: "OBSIDIAN VAULT",
    x: 16,
    z: -40,
    cost: 1600,
    color: 0xc98f79,
    station: "hilo",
  },
  {
    id: "eclipse",
    name: "ECLIPSE PENTHOUSE",
    x: 0,
    z: -40,
    cost: 2100,
    color: 0xe8bd6e,
    station: "letitride",
  },
);
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
DOORS.push(
  ...[
    ["arcade", "sapphire", -16, -16],
    ["crown", "ivory", 0, -16],
    ["dice", "jade", 16, -16],
    ["sapphire", "neon", -16, -32],
    ["ivory", "eclipse", 0, -32],
    ["jade", "obsidian", 16, -32],
  ].map(([from, to, x, z]) => ({ id: to, from, to, x, z, w: 3.6, d: 0.36 })),
  ...[
    ["sapphire", "ivory", -8, -25],
    ["jade", "ivory", 8, -25],
    ["neon", "eclipse", -8, -41],
    ["obsidian", "eclipse", 8, -41],
  ].map(([from, to, x, z]) => ({
    id: `${from}-${to}`,
    from,
    to,
    x,
    z,
    w: 0.36,
    d: 3.6,
  })),
);
// Derive solid partitions from the door openings so render, bullets and AI share one layout.
function partition(axis, position, low, high) {
  const vertical = axis === "x";
  const gaps = DOORS.filter(
    (d) => d[axis] === position && (vertical ? d.w < 1 : d.d < 1),
  )
    .map((d) => [d[vertical ? "z" : "x"] - 1.8, d[vertical ? "z" : "x"] + 1.8])
    .sort((a, b) => a[0] - b[0]);
  const segments = [];
  let cursor = low;
  for (const [a, b] of [...gaps, [high, high]]) {
    if (a > cursor)
      segments.push(
        vertical
          ? {
              x: position,
              z: (cursor + a) / 2,
              w: 0.36,
              d: a - cursor,
              h: 5.15,
            }
          : {
              x: (cursor + a) / 2,
              z: position,
              w: a - cursor,
              d: 0.36,
              h: 5.15,
            },
      );
    cursor = b;
  }
  return segments;
}
export const WALLS = [
  ...[-8, 8].flatMap((x) => partition("x", x, BOUNDS.minZ, BOUNDS.maxZ)),
  ...[0, -16, -32].flatMap((z) => partition("z", z, BOUNDS.minX, BOUNDS.maxX)),
];
export const OUTER_WALLS = [
  { x: 0, z: -48.2, w: 48.4, d: 0.4, h: 5.3 },
  { x: 0, z: 16.2, w: 48.4, d: 0.4, h: 5.3 },
  { x: -24.2, z: -16, w: 0.4, d: 64, h: 5.3 },
  { x: 24.2, z: -16, w: 0.4, d: 64, h: 5.3 },
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
