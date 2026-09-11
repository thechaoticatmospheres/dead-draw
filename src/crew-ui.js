import {
  DEVICES,
  CHALLENGES,
  COSMETICS,
  objectiveText,
} from "../shared/campaign.js";
import { DOORS, ROOMS, ROOM_SPAWNS, roomAt } from "../shared/map.js";
import { WEAPONS } from "../shared/data.js";
import { readProfile, setSkin, recordRun, cosmeticMessage } from "./profile.js";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export class CrewUI {
  constructor(send) {
    this.send = send;
    this.tab = "crew";
    document.body.insertAdjacentHTML(
      "beforeend",
      `<section id="crewPanel" class="crew-panel" hidden><button id="closeCrew">✕</button><span class="eyebrow">THE GILDED PALM · SURVIVOR SERVICES</span><h2>Your crew. Your story.</h2><nav class="club-tabs"><button data-crew-tab="crew">CREW & OBJECTIVES</button><button data-crew-tab="career">CAREER & COSMETICS</button></nav><div id="crewContents"></div></section><div id="campaignHud" hidden></div><div id="spectatorHud" hidden></div>`,
    );
    document
      .querySelector(".room-block")
      .insertAdjacentHTML(
        "afterbegin",
        '<button id="crewButton">CREW · T</button>',
      );
    document
      .querySelector("#welcome")
      .insertAdjacentHTML(
        "beforeend",
        '<button id="careerButton" class="career-button">CAREER & CHALLENGES</button>',
      );
    document.querySelector("#closeCrew").onclick = () =>
      (document.querySelector("#crewPanel").hidden = true);
    document.querySelectorAll("[data-crew-tab]").forEach(
      (b) =>
        (b.onclick = () => {
          this.tab = b.dataset.crewTab;
          this.key = "";
          this.render(this.p, this.state);
        }),
    );
  }
  toggle(p, state, tab = "crew") {
    this.tab = tab;
    const root = document.querySelector("#crewPanel");
    root.hidden = !root.hidden;
    this.key = "";
    if (!root.hidden) this.render(p, state);
  }
  update(p, state, id) {
    const objective = document.querySelector("#campaignHud");
    objective.hidden =
      !p || state?.phase === "lobby" || state?.phase === "over";
    if (!objective.hidden)
      objective.textContent = "♠ " + objectiveText(state.campaign);
    const spectator = document.querySelector("#spectatorHud");
    spectator.hidden = !p?.down;
    if (p?.down)
      spectator.textContent =
        "DOWNED · WATCHING YOUR CREW · [ / ] CHANGE SURVIVOR";
    if (state?.summary) {
      if (this.lastRun !== state.summary.id) {
        recordRun(state.summary, id);
        this.lastRun = state.summary.id;
        this.send(cosmeticMessage());
      }
    }
    if (!document.querySelector("#crewPanel").hidden) this.render(p, state);
    if (state?.summary && this.renderedSummary !== state.summary.id) {
      const s = state.summary.players.find((p) => p.id === id);
      if (s) {
        this.renderedSummary = state.summary.id;
        const el =
          document.querySelector("#runSummary") ||
          document.createElement("div");
        el.id = "runSummary";
        el.className = "run-summary";
        el.innerHTML = `<b>${state.summary.extracted ? "YOU BEAT THE HOUSE" : "RUN COMPLETE"} · ${state.summary.round} WAVES</b><p>${s.kills} kills · ${s.headshots} headshots · ${s.revives} revives<br>${s.hands} casino hands · ${s.net >= 0 ? "+" : ""}${s.net} casino chips<br>${state.summary.rooms}/12 rooms · ${Math.floor(state.summary.seconds / 60)} minutes</p>`;
        document.querySelector("#gameover").appendChild(el);
      }
    }
  }
  render(p, state) {
    this.p = p;
    this.state = state;
    const profile = readProfile();
    const c = state?.campaign;
    const viewPlayer = (v) =>
      v && [
        v.id,
        v.name,
        Math.round(v.x * 2),
        Math.round(v.z * 2),
        Math.ceil(v.hp),
        v.chips,
        v.offline,
        v.down,
        v.ready,
      ];
    const key = JSON.stringify([
      viewPlayer(p),
      c && [
        c.power,
        c.keys,
        c.archive,
        c.defeated,
        c.finale,
        c.votes,
        c.barricades,
        c.donations,
        c.pings,
      ],
      state?.phase,
      state?.players.map(viewPlayer),
      this.tab,
      profile,
    ]);
    if (key === this.key) return;
    this.key = key;
    let html = "";
    const action = (label, choice, attrs = "", disabled = false) =>
      `<button data-crew-action="${choice}" ${attrs} ${disabled ? "disabled" : ""}>${label}</button>`;
    if (this.tab === "career" || !p) {
      html = `<div class="crew-statline">${profile.runs?.length || 0} completed runs · Best wave ${profile.bestRound || 0} · ${profile.extractions || 0} extractions</div><h3>CHALLENGES</h3><div class="club-grid">${CHALLENGES.map((c) => `<article class="club-item"><div><h3>${c.name}</h3><p>${c.detail}</p><b>${Math.min(profile[c.field] || 0, c.goal)} / ${c.goal} ${(profile[c.field] || 0) >= c.goal ? "✓" : ""}</b></div></article>`).join("")}</div><h3>WARDROBE · COSMETIC ONLY</h3><div class="choice-row">${COSMETICS.map(
        (c) => {
          const goal = CHALLENGES.find((g) => g.id === c.challenge),
            locked = goal && (profile[goal.field] || 0) < goal.goal;
          return `<button data-skin="${c.id}" ${locked ? "disabled" : ""}>${c.name}${locked ? " · " + goal.name : profile.skin === c.id ? " · EQUIPPED" : ""}</button>`;
        },
      ).join(
        "",
      )}</div><h3>WEAPON MASTERY</h3><div class="mastery-list">${Object.entries(
        WEAPONS,
      )
        .map(([id, w]) => {
          const kills = profile.weapons?.[id] || 0;
          return `<p><b>${w.name}</b> · ${kills} kills · ${kills >= 500 ? "GOLD" : kills >= 200 ? "SILVER" : kills >= 50 ? "BRONZE" : "UNRANKED"}</p>`;
        })
        .join(
          "",
        )}</div><p class="table-note">Career records and cosmetics save on this browser. Mastery ranks grant presentation rewards, not damage advantages.</p>`;
    } else {
      const c = state.campaign,
        near = (o) => Math.hypot(p.x - o.x, p.z - o.z) < 3;
      html = `<div class="crew-objective"><b>${objectiveText(c)}</b><p>${c.power ? "✓" : "○"} Power · ${c.keys}/2 boss keys · ${c.archive ? "✓" : "○"} Vault code · ${c.defeated ? "✓" : "○"} House defeated</p><p>Restore power in Sapphire, defeat bosses on waves 5 and 10, and find the Neon archive. Challenge the House in Eclipse, then vote to extract at the atrium. Endless play remains available.</p></div><div class="choice-row">${action("PING MY LOCATION", "ping")}${action("REQUEST AMMO", "ammoRequest")}${action("EMERGENCY SHOVE · 20 STAMINA", "shove", "", state.phase !== "combat")}</div><h3>CREW</h3><div class="crew-seats">${state.players.map((v) => `<article><b>${esc(v.name)} ${v.id === p.id ? "(YOU)" : ""}</b><p>${v.offline ? "RECONNECTING" : v.down ? "DOWNED" : v.ready ? "READY" : "ACTIVE"} · ${Math.ceil(v.hp)} HP · ${v.chips} ◉</p><small>${ROOMS.find((r) => r.id === roomAt(v)?.id)?.name || ""}</small>${v.id !== p.id ? action("SHARE ONE MAGAZINE", "shareAmmo", `data-target="${v.id}"`, !near(v)) : ""}</article>`).join("")}</div><h3>NEARBY INTERACTIONS</h3>`;
      let count = 0;
      for (const d of DEVICES)
        if (state.openRooms.includes(d.room) && near(d)) {
          count++;
          const disabled =
            p.down ||
            p.chips < d.cost ||
            (d.id === "power" && c.power) ||
            (d.id === "archive" && (!c.power || c.archive)) ||
            (d.id === "finale" &&
              (!c.power || !c.archive || c.keys < 2 || c.defeated)) ||
            (d.id === "extract" && !c.defeated) ||
            (d.id.startsWith("trap-") &&
              (!c.power || state.phase !== "combat"));
          html += action(
            `${d.name}${d.cost ? " · " + d.cost + " ◉" : ""}${d.id === "extract" ? " · " + c.votes.length + "/" + state.players.filter((p) => !p.offline).length + " VOTES" : ""}`,
            d.id,
            "",
            disabled,
          );
        }
      for (const [i, o] of ROOM_SPAWNS.entries())
        if (near(o)) {
          count++;
          html += action(
            `REPAIR ENTRANCE · ${c.barricades[i] || 0}/3 BOARDS · 10 ◉`,
            "repair",
            `data-entrance="${i}"`,
            p.chips < 10 || (c.barricades[i] || 0) >= 3,
          );
        }
      for (const d of DOORS)
        if (
          !d.shortcut &&
          d.from === roomAt(p)?.id &&
          !state.openRooms.includes(d.to) &&
          near(d)
        ) {
          count++;
          const room = ROOMS.find((r) => r.id === d.to);
          html += action(
            `CONTRIBUTE 50 ◉ · ${room.name} · ${c.donations[room.id] || 0}/${room.cost}`,
            "donate",
            `data-door="${d.id}"`,
            state.phase !== "break" || !p.chips,
          );
        }
      if (!count)
        html +=
          '<p class="table-note">Walk up to a shutter, service entrance, or marked control terminal, then open this panel.</p>';
      html += `<h3>ACTIVE PINGS</h3>${c.pings.map((v) => `<p>${esc(state.players.find((p) => p.id === v.player)?.name || "Crew")}: ${v.label} · ${ROOMS.find((r) => r.id === v.room)?.name || ""}</p>`).join("") || '<p class="table-note">No active pings.</p>'}`;
    }
    const root = document.querySelector("#crewContents");
    root.innerHTML = html;
    root.querySelectorAll("[data-crew-action]").forEach(
      (b) =>
        (b.onclick = () => {
          this.send({
            type: "crew",
            choice: b.dataset.crewAction,
            target: b.dataset.target,
            door: b.dataset.door,
            entrance: b.dataset.entrance,
          });
        }),
    );
    root.querySelectorAll("[data-skin]").forEach(
      (b) =>
        (b.onclick = () => {
          setSkin(b.dataset.skin);
          this.send(cosmeticMessage());
          this.key = "";
          this.render(p, state);
        }),
    );
  }
}
