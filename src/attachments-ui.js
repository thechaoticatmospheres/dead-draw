import {
  ATTACHMENTS,
  attachmentFits,
  gunStats,
} from "../shared/attachments.js";
import { ROOMS } from "../shared/map.js";
export function attachmentBench(p, state, weapon, occupied) {
  const gun = p.guns[p.selected],
    stats = gunStats(weapon, gun);
  return `<h3 class="club-section">ATTACHMENT BENCH · ${weapon.name}</h3><p class="table-note">${stats.mag}-round magazine · ${stats.reload.toFixed(2)}s base reload · Buy once per weapon; switching owned attachments is free. Aim with RMB / LT or toggle with V.</p><div class="club-grid">${ATTACHMENTS.map(
    (a) => {
      const owned = gun.ownedAttachments?.includes(a.id),
        equipped = gun.attachments?.[a.slot] === a.id,
        locked = !state.openRooms.includes(a.room),
        fits = attachmentFits(a, weapon);
      const disabled =
        locked ||
        !fits ||
        occupied ||
        p.down ||
        !!p.reload ||
        state.phase !== "break" ||
        (!owned && p.chips < a.cost);
      return `<article class="club-item ${locked ? "locked" : ""}"><div class="perk-symbol">${a.slot === "optic" ? "⊕" : "⚙"}</div><div><span class="eyebrow">${a.slot.toUpperCase()} · ${equipped ? "EQUIPPED" : owned ? "OWNED" : ROOMS.find((r) => r.id === a.room).name}</span><h3>${a.name}</h3><p>${a.detail}</p><button data-attachment="${a.id}" ${disabled ? "disabled" : ""}>${!fits ? "RIFLES ONLY" : locked ? "OPEN " + ROOMS.find((r) => r.id === a.room).name : equipped ? "REMOVE" : owned ? "EQUIP" : a.cost + " ◉ · BUY & EQUIP"}</button></div></article>`;
    },
  ).join("")}</div>`;
}
