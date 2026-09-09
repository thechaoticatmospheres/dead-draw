import { roomAt, clearPath } from "./map.js";
export const SERVICES = [
  {
    id: "jukebox",
    name: "Golden Hour Jukebox",
    room: "atrium",
    x: -5.7,
    z: 2.1,
    r: 0.85,
    h: 2.5,
  },
  {
    id: "cashier",
    name: "Survivor’s Club Cashier",
    room: "atrium",
    x: 4.8,
    z: 2,
    r: 1.8,
    h: 2.9,
  },
];
export const TRACKS = [
  { id: "golden-velvet-room", title: "The Golden Velvet Room", duration: 180 },
  { id: "double-down-swing", title: "Double Down Swing", duration: 180 },
  {
    id: "midnight-roll-of-the-dice",
    title: "Midnight Roll of the Dice",
    duration: 180,
  },
  { id: "red-velvet-lounge", title: "Red Velvet Lounge", duration: 180 },
  { id: "midnight-rollers", title: "Midnight Rollers", duration: 180 },
];
export const newJukebox = () => ({
  track: 0,
  playing: true,
  position: 0,
  startedAt: 0,
  revision: 0,
});
export function musicPosition(j, time) {
  return Math.max(
    0,
    j.position + (j.playing ? Math.max(0, time - j.startedAt) : 0),
  );
}
export function canUseService(p, s, open) {
  return (
    !!p &&
    !p.down &&
    !p.offline &&
    roomAt(p)?.id === s.room &&
    open.includes(s.room) &&
    Math.hypot(p.x - s.x, p.z - s.z) <= 4 &&
    clearPath(p, s, open)
  );
}
export const nearbyService = (p, open) =>
  SERVICES.filter((s) => canUseService(p, s, open)).sort(
    (a, b) =>
      Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(p.x - b.x, p.z - b.z),
  )[0];
