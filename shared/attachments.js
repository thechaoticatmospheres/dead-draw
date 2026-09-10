export const ATTACHMENTS = [
  {
    id: "reflex",
    slot: "optic",
    name: "Palm Reflex",
    room: "velvet",
    cost: 125,
    zoom: 1.5,
    detail: "1.5× open red-dot sight. Clear peripheral vision.",
  },
  {
    id: "scope",
    slot: "optic",
    name: "Marksman 2.5×",
    room: "crown",
    cost: 275,
    zoom: 2.5,
    detail: "Look through a magnified scope with a fine crosshair.",
  },
  {
    id: "longscope",
    slot: "optic",
    name: "Eclipse 6×",
    room: "eclipse",
    cost: 900,
    zoom: 6,
    categories: ["rifle"],
    detail: "6× rifle scope with mil-dot markings. Long-range precision.",
  },
  {
    id: "extended",
    slot: "magazine",
    name: "Extended Magazine",
    room: "sapphire",
    cost: 250,
    detail: "50% more rounds per magazine. Reload to fill it.",
  },
  {
    id: "speedloader",
    slot: "action",
    name: "Speed Loader",
    room: "ivory",
    cost: 350,
    detail: "25% faster reloads. Stacks with your reload perk.",
  },
  {
    id: "compensator",
    slot: "barrel",
    name: "Gold Compensator",
    room: "jade",
    cost: 450,
    detail: "45% less recoil and 25% tighter shotgun pellet spread.",
  },
];
export const attachmentFits = (item, weapon) =>
  !weapon.melee &&
  (!item.categories || item.categories.includes(weapon.category));
export const opticFor = (p) =>
  ATTACHMENTS.find((a) => a.id === p?.guns?.[p.selected]?.attachments?.optic);
export function gunStats(base, gun) {
  const a = gun?.attachments || {};
  return {
    ...base,
    mag: a.magazine === "extended" ? Math.ceil(base.mag * 1.5) : base.mag,
    reload: base.reload * (a.action === "speedloader" ? 0.75 : 1),
    spread: (base.spread || 0) * (a.barrel === "compensator" ? 0.75 : 1),
    recoil: a.barrel === "compensator" ? 0.55 : 1,
  };
}
