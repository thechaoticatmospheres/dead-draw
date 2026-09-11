import { textValue, styleValue } from "./dom-values.js";
import {
  PERKS,
  SUPPLIES,
  maxHealth,
  grenadeLimit,
  modPrice,
  damageMultiplier,
} from "../shared/expansion.js";
import { attachmentBench } from "./attachments-ui.js";
import { ROOMS } from "../shared/map.js";
import { WEAPONS } from "../shared/data.js";
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export class ClubView {
  constructor(send) {
    this.send = send;
    this.key = "";
  }
  render(p, state) {
    const key = JSON.stringify([
      p.chips,
      p.comps,
      p.perks,
      p.guns,
      p.selected,
      p.hp,
      p.armor,
      p.grenades,
      p.ledger,
      state.openRooms,
      state.phase,
      Object.values(state.games).map((g) => g.phase),
    ]);
    if (this.key === key) return;
    this.key = key;
    const occupied = Object.values(state.games).some(
      (g) => g.player === p.id && g.phase !== "result",
    );
    const gun = p.guns[p.selected],
      weapon = WEAPONS[gun.id];
    const roomName = (id) => ROOMS.find((r) => r.id === id).name;
    const tile = (item, perk) => {
      const rank = p.perks[item.id] || 0,
        locked = !state.openRooms.includes(item.room);
      const owned = perk
        ? rank >= item.max
        : p.guns.some((g) => g.id === item.id);
      const price = perk ? item.price * (rank + 1) : item.chips;
      const full =
        (item.id === "ammo" && weapon.melee) ||
        (item.id === "heal" && p.hp >= maxHealth(p)) ||
        (item.id === "armor" && p.armor >= 75) ||
        (item.id === "grenade" && p.grenades >= grenadeLimit(p));
      const unavailable =
        locked ||
        owned ||
        full ||
        occupied ||
        p.down ||
        state.phase !== "break" ||
        price > (perk ? p.comps : p.chips);
      return `<article class="club-item ${locked ? "locked" : ""}"><div class="perk-symbol">${item.glyph || "◆"}</div><div><span class="eyebrow">${perk ? `RANK ${rank} / ${item.max}` : roomName(item.room)}</span><h3>${item.name}</h3><p>${item.detail}</p><button data-buy="${item.id}" ${unavailable ? "disabled" : ""}>${locked ? `OPEN ${roomName(item.room).toUpperCase()}` : owned ? "OWNED" : full ? "FULL" : `${price} ${perk ? "COMPS" : "◉"} · ${perk ? "UPGRADE" : "BUY"}`}</button></div></article>`;
    };
    document.getElementById("clubBody").innerHTML =
      `<div class="club-account"><div><span class="eyebrow">SURVIVOR’S CLUB</span><strong>${p.comps} <small>COMPS</small></strong></div><div><span class="eyebrow">YOUR BANKROLL</span><strong>◉ ${p.chips}</strong></div><p>Every 50 chips wagered at the tables earns 1 comp. Perks last for this run. True-odds bets and double-or-bank rounds do not earn comps.</p></div>${occupied ? '<p class="club-warning">Finish your active casino game before shopping.</p>' : ""}<nav class="club-tabs"><button data-club-tab="perks" class="selected">PERKS & SUPPLIES</button><button data-club-tab="attachments">ATTACHMENTS</button><button data-club-tab="ledger">SESSION LEDGER</button></nav><div id="clubPerks"><div class="club-upgrade"><div><span class="eyebrow">WEAPON BENCH · CURRENT WEAPON</span><h3>${weapon.name} <small>RANK ${gun.level || 0} / 3</small></h3><p>${Math.round(weapon.damage * damageMultiplier(gun))} damage${weapon.pellets ? ` × ${weapon.pellets} pellets` : ""} · Each rank adds 30% base damage. Stacks with gilded weapons.</p></div><button data-buy="upgrade" ${!modPrice(gun) || p.chips < modPrice(gun) || occupied ? "disabled" : ""}>${modPrice(gun) ? `UPGRADE · ${modPrice(gun)} ◉` : "MAX RANK"}</button></div><div class="club-grid">${PERKS.map((p) => tile(p, true)).join("")}</div><h3 class="club-section">SUPPLIES & GUARANTEED WEAPONS</h3><div class="club-grid supplies-grid">${SUPPLIES.map((p) => tile(p, false)).join("")}</div></div><div id="clubLedger" hidden><div class="ledger-total"><span>NET CASINO CHIPS</span><b class="${p.casinoNet >= 0 ? "positive" : "negative"}">${p.casinoNet >= 0 ? "+" : ""}${p.casinoNet}</b><small>Completed games only · Includes vault and double-or-bank outcomes</small></div>${p.ledger.length ? p.ledger.map((h) => `<div class="ledger-row"><span>${escape(h.station.toUpperCase())}</span><strong>${escape(h.result)}</strong><b class="${h.net >= 0 ? "positive" : "negative"}">${h.net >= 0 ? "+" : ""}${h.net} ◉</b></div>`).join("") : '<p class="table-note">Your last 12 settlements will appear here. No wagers yet.</p>'}</div>`;
    const root = document.getElementById("clubBody");
    root.insertAdjacentHTML(
      "beforeend",
      `<div id="clubAttachments" hidden>${attachmentBench(p, state, weapon, occupied)}</div>`,
    );
    root.querySelectorAll("[data-attachment]").forEach(
      (b) =>
        (b.onclick = () => {
          this.send({ type: "attachment", item: b.dataset.attachment });
          b.disabled = true;
        }),
    );
    root.querySelectorAll("[data-buy]").forEach(
      (b) =>
        (b.onclick = () => {
          this.send({ type: "buy", item: b.dataset.buy });
          b.disabled = true;
        }),
    );
    root.querySelectorAll("[data-club-tab]").forEach(
      (b) =>
        (b.onclick = () => {
          this.tab = b.dataset.clubTab;
          root.querySelector("#clubPerks").hidden = this.tab !== "perks";
          root.querySelector("#clubLedger").hidden = this.tab !== "ledger";
          root.querySelector("#clubAttachments").hidden =
            this.tab !== "attachments";
          root
            .querySelectorAll("[data-club-tab]")
            .forEach((v) => v.classList.toggle("selected", v === b));
        }),
    );
    if (this.tab) root.querySelector(`[data-club-tab="${this.tab}"]`).click();
  }
}
export function updateExpansionHud(p, state, controller) {
  const $ = (id) => document.getElementById(id),
    c = state.contract;
  $("contractHud").hidden = state.phase !== "combat" || !c;
  if (c) {
    textValue(
      $("contractTitle"),
      c.complete ? "CONTRACT COMPLETE" : c.title.toUpperCase(),
    );
    textValue($("contractText"), `${c.detail} · ${c.progress}/${c.goal}`);
    styleValue(
      $("contractProgress"),
      "width",
      Math.min(100, (c.progress / c.goal) * 100) + "%",
    );
  }
  $("tactics").hidden = !["combat", "break"].includes(state.phase);
  styleValue($("staminaBar"), "width", p.stamina + "%");
  textValue($("dodgeLabel"), `${controller ? "B" : "SHIFT"} ROLL`);
  textValue(
    $("grenadeLabel"),
    `${controller ? "RS CLICK" : "G"} GRENADE · ${p.grenades}`,
  );
  textValue(
    $("comboHud"),
    p.combo >= 2
      ? `${p.combo}× STREAK${p.combo >= 3 ? ` · +${Math.floor(p.combo / 3) * 2} CHIPS / KILL` : ""}`
      : "",
  );
  const boss = state.zombies.find((z) => z.kind === "boss");
  $("bossHud").hidden = !boss;
  if (boss) {
    styleValue(
      $("bossHealth"),
      "width",
      Math.max(0, (boss.hp / boss.maxHp) * 100) + "%",
    );
    textValue(
      $("bossState"),
      boss.hp < boss.maxHp / 2
        ? "ENRAGED · KEEP MOVING"
        : "DODGE THE GOLD MARKERS",
    );
  }
  $("clubButton").hidden = state.phase !== "break";
  textValue(
    $("clubButton"),
    `SURVIVOR’S CLUB · ${controller ? "D-PAD →" : "U"} · ${p.comps} COMPS`,
  );
  textValue(
    $("wavePreview"),
    (state.round + 1) % 5 === 0
      ? "NEXT: THE HIGH ROLLER · BOSS WAVE"
      : `NEXT: WAVE ${state.round + 1}${state.round >= 2 ? " · SPITTERS ACTIVE" : state.round >= 1 ? " · RUNNERS + PIT BOSSES" : " · FIRST CALL"}`,
  );
}
