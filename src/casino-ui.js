import { extraTable, bindExtra } from "./extra-casino-ui.js";
import {
  HIGH_STAKES,
  highStakesTable,
  bindHighStakes,
} from "./high-stakes-ui.js";
import { bonusPanel, bindBonus } from "./casino-bonus-ui.js";
import { REWARDS } from "../shared/data.js";
import {
  SLOT_REELS,
  SLOT_LABELS,
  SLOT_PAYTABLE,
  WHEEL_ORDER,
  OUTSIDE_BETS,
  pocketColor,
  betInfo,
  score,
  handOptions,
} from "../shared/casino-rules.js";
const cardName = (n) => ({ 1: "A", 11: "J", 12: "Q", 13: "K" })[n] || n;
const PIPS = {
  1: [[50, 50]],
  2: [[50, 18], [50, 82]],
  3: [[50, 18], [50, 50], [50, 82]],
  4: [[24, 18], [76, 18], [24, 82], [76, 82]],
  5: [[24, 18], [76, 18], [50, 50], [24, 82], [76, 82]],
  6: [[24, 18], [76, 18], [24, 50], [76, 50], [24, 82], [76, 82]],
  7: [[24, 18], [76, 18], [50, 34], [24, 50], [76, 50], [24, 82], [76, 82]],
  8: [[24, 18], [76, 18], [50, 34], [24, 50], [76, 50], [50, 66], [24, 82], [76, 82]],
  9: [[24, 15], [76, 15], [24, 38], [76, 38], [50, 50], [24, 62], [76, 62], [24, 85], [76, 85]],
  10: [[24, 15], [76, 15], [50, 26], [24, 38], [76, 38], [24, 62], [76, 62], [50, 74], [24, 85], [76, 85]],
};
const suitName = { "\u2660": "spades", "\u2665": "hearts", "\u2663": "clubs", "\u2666": "diamonds" };
export function cards(hand) {
  return `<div class="playing-cards">${hand.map((c, i) => {
    if (c.rank === 0) return '<div class="playing-card card-back" data-face="back" aria-label="Face-down card"><span>GP</span></div>';
    const face = c.rank <= 10
      ? `<div class="card-pips ${c.rank === 1 ? "card-ace" : ""}" aria-hidden="true">${PIPS[c.rank].map(([x, y]) => `<i style="left:${x}%;top:${y}%;--pip-turn:${y > 50 ? 180 : 0}deg">${c.suit}</i>`).join("")}</div>`
      : `<div class="court-face" aria-hidden="true"><i>${c.suit}</i><b>${cardName(c.rank)}</b><i>${c.suit}</i></div>`;
    return `<div class="playing-card ${["\u2665", "\u2666"].includes(c.suit) ? "red" : ""}" data-face="${c.rank}:${c.suit}" style="--deal:${i}" aria-label="${cardName(c.rank)} of ${suitName[c.suit] || c.suit}"><span>${cardName(c.rank)}<small>${c.suit}</small></span>${face}<span>${cardName(c.rank)}<small>${c.suit}</small></span></div>`;
  }).join("")}</div>`;
}
function wheel() {
  const sectors = WHEEL_ORDER.map((n, i) => {
    const a = (i * 360) / 37,
      b = ((i + 1) * 360) / 37;
    return `${n === 0 ? "#237b59" : pocketColor(n) === "red" ? "#963f43" : "#152b28"} ${a}deg ${b}deg`;
  }).join(",");
  return `<div class="roulette-wheel"><div class="wheel-disc" style="background:conic-gradient(${sectors})">${WHEEL_ORDER.map((n, i) => `<span class="pocket-number" style="transform:rotate(${((i + 0.5) * 360) / 37}deg)"><i>${n}</i></span>`).join("")}<div class="wheel-hub">GP<span>GILDED PALM</span></div></div><div class="roulette-ball"><i></i></div></div>`;
}
const button = (label, action, disabled = false, detail = "") =>
  `<button class="table-action" data-action="${action}" ${disabled ? "disabled" : ""}><strong>${label}</strong>${detail ? `<small>${detail}</small>` : ""}</button>`;
export class CasinoView {
  constructor({ send, audio }) {
    this.send = send;
    this.audio = audio;
    this.fingerprint = "";
    this.lines = 1;
    this.stake = 25;
    this.wager = 50;
    this.denom = 10;
    this.bets = [];
    this.previous = [];
    this.animKey = "";
    this.lastTick = -1;
    this.extra = {
      poker: 25,
      craps: 25,
      baccarat: 20,
      crapsBet: "pass",
      baccaratBet: "banker",
      holds: [],
    };
  }
  invalidate() {
    this.fingerprint = "";
  }
  render(s, p, state) {
    this.s = s;
    this.p = p;
    this.state = state;
    this.openedStation = s.id;
    const clock = document.getElementById("casinoDeadline");
    if (clock) {
      clock.textContent = `NEXT WAVE ${Math.ceil(state.timer)}s${state.timer < 7 ? " · NEW WAGERS CLOSED" : ""}`;
      clock.classList.toggle("deadline-urgent", state.timer <= 10);
    }
    const g = state.games[s.id];
    const fingerprint = JSON.stringify([
      s.id,
      p.chips,
      p.losses,
      p.comps,
      p.vaultSpins,
      p.freeSpins,
      p.slotFeature,
      state.timer < 7,
      state.jackpot,
      g ? { ...g, remaining: undefined } : null,
      state.history,
      this.lines,
      this.stake,
      this.wager,
      this.denom,
      this.bets,
      this.extra,
    ]);
    if (fingerprint === this.fingerprint) return;
    this.fingerprint = fingerprint;
    const panel = document.getElementById("casino");
    const body = document.getElementById("casinoBody");
    // Preserve what is already on the table. A new snapshot must not redeal
    // held cards or repeatedly announce a settled result.
    const handKey = `${s.id}:${g?.startedAt ?? "idle"}`;
    const sameHand = this.presentationHand === handKey;
    const oldCards = sameHand
      ? [...body.querySelectorAll(".playing-cards")].map((hand) =>
          [...hand.querySelectorAll(".playing-card")].map((card) => card.dataset.face),
        )
      : [];
    const oldDetails = new Map(
      [...body.querySelectorAll("details")].map((node, index) => [index, node.open]),
    );
    const focused = body.contains(document.activeElement)
      ? [...document.activeElement.attributes].find((attr) => attr.name.startsWith("data-"))
      : null;
    const oldScroll = panel.scrollTop;
    const sameResult = sameHand && this.displayPhase === "result";
    this.presentationHand = handKey;
    panel.dataset.game = s.id;
    panel.classList.toggle(
      "jackpot",
      g?.phase === "result" &&
        (g.reward === "slotJackpot" ||
          g.reward === "gildedHouse" ||
          g.reward === "sovereign"),
    );
    let html = `<div class="table-topline"><span>PRIVATE GAME · <b id="casinoDeadline">NEXT WAVE ${Math.ceil(state.timer)}s</b></span><span>YOUR CHIPS <b>◉ ${p.chips}</b></span></div>`;
    if (g && g.player !== p.id) {
      html +=
        '<div class="table-wait"><span>♠</span><h3>Table occupied</h3><p>Another survivor is finishing a game.<br>The intermission bell still applies.</p></div>';
    } else if (["bonus", "risk"].includes(g?.phase))
      html += bonusPanel(g, p.chips);
    else if (s.id === "slots") html += this.slots(g);
    else if (s.id === "roulette") html += this.roulette(g, state);
    else if (s.id === "blackjack") html += this.blackjack(g);
    else if (HIGH_STAKES.includes(s.id))
      html += highStakesTable(this, g, cards);
    else html += extraTable(this, g, cards);
    if (g?.phase === "result" && g.player === p.id)
      html += this.result(g) + bonusPanel(g, p.chips);
    html += `<div class="comp-strip"><span>♣ ${p.comps || 0} COMPS</span><span>1 COMP / 50 CHIPS WAGERED · SPEND AT THE SURVIVOR’S CLUB</span></div>`;
    body.innerHTML = html;
    body.querySelectorAll(".playing-cards").forEach((hand, handIndex) => {
      let incoming = 0;
      hand.querySelectorAll(".playing-card").forEach((card, cardIndex) => {
        const previous = oldCards[handIndex]?.[cardIndex];
        card.dataset.arrival = previous === card.dataset.face
          ? "held"
          : previous === "back" ? "reveal" : "deal";
        card.style.setProperty("--deal", card.dataset.arrival === "deal" ? incoming++ : 0);
      });
    });
    if (sameHand) body.querySelectorAll("details").forEach((node, index) => {
      if (node.classList.contains("slot-feature") && (p.slotFeature || p.freeSpins)) node.open = true;
      else if (oldDetails.has(index)) node.open = oldDetails.get(index);
    });
    const settlement = body.querySelector(".settlement");
    if (settlement) {
      settlement.dataset.arrival = sameResult ? "held" : "deal";
      settlement.setAttribute("role", "status");
    }
    if (sameHand) panel.scrollTop = oldScroll;
    if (this.displayPhase !== g?.phase && ["bonus", "risk"].includes(g?.phase))
      panel.scrollTop = 0;
    this.displayPhase = g?.phase;
    if (state.timer < 7)
      document
        .querySelectorAll(
          "#casinoBody [data-play],#casinoBody [data-free-spin]",
        )
        .forEach((b) => (b.disabled = true));
    this.bind(g);
    bindBonus(this, body);
    if (focused) {
      const target = body.querySelector(`[${focused.name}="${CSS.escape(focused.value)}"]`);
      if (target && !target.disabled) target.focus({ preventScroll: true });
    }
  }
  slots(g) {
    const lines = g?.lines || this.lines,
      stake = g?.stake || this.stake;
    const reels = `<div class="slot-cabinet theme-${this.extra.slotTheme || "afterlife"}"><div class="slot-marquee">LUCKY AFTERLIFE <span>777</span></div><div class="reel-window">${[0, 1, 2].map((i) => `<div class="physical-reel" data-reel="${i}">${[-1, 0, 1].map((row) => `<span data-row="${row}" class="${row === 0 ? "center-symbol" : ""}">7</span>`).join("")}</div>`).join("")}<div class="payline center"></div>${lines === 3 ? '<div class="payline upper"></div><div class="payline lower"></div>' : ""}</div><div class="slot-readout"><span>${lines} PAYLINE${lines === 3 ? "S" : ""}</span><span>${stake} ◉ / LINE</span><span>${g?.phase === "playing" ? "REELS SPINNING" : g?.phase === "result" ? g.result : "INSERT CHIPS"}</span></div></div>`;
    const feature = `<details class="slot-feature" ${this.p.slotFeature || this.p.freeSpins ? "open" : ""}><summary>NEON RUSH · ${(this.p.paidSpins || 0) % 7}/7 PAID SPINS · CABINET FINISH</summary><p>${(this.p.paidSpins || 0) % 7}/7 paid spins · Bonus pulls use the 25-chip center-line paytable.</p>${this.p.slotFeature ? `<div class="choice-row"><button data-slot-feature="bank" ${g ? "disabled" : ""}>BANK 60 CHIPS</button><button data-slot-feature="spins" ${g ? "disabled" : ""}>TAKE 3 FREE SPINS</button></div>` : ""}${this.p.freeSpins ? `<button data-free-spin ${g ? "disabled" : ""}>NEON RUSH · ${this.p.freeSpins} FREE PULLS LEFT</button>` : ""}<div class="choice-row"><button data-slot-theme="afterlife">AFTERLIFE</button><button data-slot-theme="neon">NEON RUSH</button><button data-slot-theme="gold">GILDED PALM</button></div></details>`;
    return (
      feature +
      `<div class="progressive-strip"><div><span>THE GILDED VAULT</span><b>◉ ${this.state.jackpot || 250}</b></div><div class="vault-stamps">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < (this.p.vaultSpins || 0) ? "filled" : ""}">◆</i>`).join("")}<small>Every 5 paid spins opens the vault · ${this.p.vaultSpins || 0}/5</small></div></div><div class="casino-layout slots-layout"><div>${reels}${!g ? `<div class="choice-label">PAYLINES</div><div class="choice-row">${[1, 3].map((n) => `<button data-lines="${n}" class="${this.lines === n ? "selected" : ""}">${n === 1 ? "CENTER LINE" : "ALL 3 LINES"}</button>`).join("")}</div><div class="choice-label">CHIPS PER LINE</div><div class="choice-row">${[25, 50, 100].map((n) => `<button data-stake="${n}" class="${this.stake === n ? "selected" : ""}">${n} ◉</button>`).join("")}</div><button class="deal-button" data-play="slots" ${this.p.chips < lines * stake ? "disabled" : ""}>PULL THE LEVER <b>${lines * stake} ◉</b></button>` : ""}<p class="table-note">${g?.protection ? "A third losing spin activated your safety ammo." : `Safety net: ${Math.min(2, this.p.losses)} / 2 losses. A third losing spin gives 36 rounds.`}</p></div><div class="paytable"><span class="eyebrow">THE PAYTABLE</span><p>Matches run left to right on each active horizontal line.</p>${SLOT_PAYTABLE.map((r) => `<div><strong>${r.pattern}</strong><span>${r.detail}<small>${r.chance} per line</small></span></div>`).join("")}<p>20 stops per reel. Each stop is equally likely. Higher stakes multiply chips and ammo; weapon quality stays the same. Safety ammo stays fixed.</p></div></div>`
    );
  }
  roulette(g, state) {
    const total = this.bets.reduce((n, b) => n + b.amount, 0),
      placed = g?.bets || this.bets;
    const cell = (key, label, color = "") => {
      const amount = placed.find((b) => b.key === key)?.amount;
      return `<button class="bet-cell ${color} ${amount ? "has-bet" : ""} ${g?.phase === "result" && g.wins.some((b) => b.key === key) ? "bet-win" : ""}" data-position="${key}" ${g ? "disabled" : ""} title="${betInfo(key).odds}:1 payout · ${betInfo(key).pockets}/37 chance">${label}${amount ? `<span class="placed-chip">${amount}</span>` : ""}</button>`;
    };
    const board = `<div class="betting-felt"><div class="number-grid">${cell("n:0", "0", "green")}${Array.from(
      { length: 36 },
      (_, i) => {
        const n = (i % 12) * 3 + 3 - Math.floor(i / 12);
        return cell("n:" + n, n, pocketColor(n));
      },
    ).join(
      "",
    )}</div><div class="outside-grid">${OUTSIDE_BETS.map(([key, label]) => cell(key, label, key === "red" || key === "black" ? key : "")).join("")}</div></div>`;
    return `<div class="casino-layout roulette-layout"><div class="wheel-column">${wheel()}<div class="wheel-caption">${g?.phase === "result" ? `<b class="winning-number ${pocketColor(g.pocket)}">${g.pocket}</b> ${pocketColor(g.pocket).toUpperCase()}` : g ? "NO MORE BETS" : "PLACE YOUR CHIPS"}</div><div class="roll-history">${state.history.map((n) => `<span class="${pocketColor(n)}">${n}</span>`).join("")}</div><p class="table-note">Recent results do not change the next spin’s odds. Every pocket: 1 in 37.</p><div class="roulette-rewards"><b>ARMORY REWARDS</b><p>Outside / small win → 96 SMG rounds<br>Winning dozen with 25+ → House SMG<br>Winning number with 50+ → Gilded SMG</p><small>Best winning bet determines equipment. Plus chip returns: outside 1:1 · dozen 2:1 · number 35:1. Winning stakes are returned.</small></div></div><div>${board}${!g ? `<div class="choice-label">CHIP VALUE · CLICK A SPACE TO ADD</div><div class="chip-rack">${[10, 25, 50, 100].map((n) => `<button data-chip="${n}" class="casino-chip ${this.denom === n ? "selected" : ""}">${n}</button>`).join("")}</div><div class="bet-tools"><button data-edit="undo">UNDO</button><button data-edit="clear">CLEAR</button><button data-edit="rebet" ${!this.previous.length ? "disabled" : ""}>REBET</button></div><button class="deal-button" data-play="roulette" ${total < 10 || total > this.p.chips ? "disabled" : ""}>SPIN THE WHEEL <b>${total} ◉</b></button><p class="table-note">10–500 chips per space · 1,000 total maximum. Zero loses all outside bets.</p>` : '<p class="table-note">Bets locked. Watch the ball settle into a pocket.</p>'}</div></div>`;
  }
  blackjack(g) {
    const opts = g ? handOptions(g, this.p.chips) : {};
    return `<div class="blackjack-felt"><div class="felt-lettering">BLACKJACK PAYS 3 TO 2 <span>DEALER STANDS ON ALL 17s</span></div><div class="dealer-hand"><span class="hand-label">DEALER ${g && !["decision", "dealing"].includes(g.phase) ? "· " + score(g.dealer) : ""}</span>${g ? cards(g.dealer) : '<div class="empty-shoe">♠</div>'}</div><div class="player-hands">${g ? g.hands.map((h, i) => `<div class="hand-zone ${g.activeHand === i && g.phase === "decision" ? "active-hand" : ""}"><span class="hand-label">${g.hands.length > 1 ? "HAND " + (i + 1) : "YOUR HAND"} · ${score(h.cards)} ${h.result ? "· " + h.result : ""}</span>${cards(h.cards)}<div class="hand-wager"><span class="casino-chip">${h.bet}</span>${h.doubled ? "<b>DOUBLED</b>" : ""}${h.split ? "<b>SPLIT</b>" : ""}</div></div>`).join("") : '<div class="empty-hand">PLACE YOUR WAGER</div>'}</div></div>${!g ? `<div class="blackjack-controls"><div><div class="choice-label">WAGER</div><div class="choice-row">${[50, 100, 200].map((n) => `<button data-wager="${n}" class="${this.wager === n ? "selected" : ""}">${n} ◉</button>`).join("")}</div></div><button class="deal-button" data-play="blackjack" ${this.p.chips < this.wager ? "disabled" : ""}>DEAL HAND <b>${this.wager} ◉</b></button></div>` : g.phase === "decision" ? `<div class="hand-decisions">${button("HIT", "hit", !opts.hit, "Draw another card")}${button("STAND", "stand", !opts.stand, "Keep your total")}${button("DOUBLE", "double", !opts.double, "Match bet, draw once")}${button("SPLIT", "split", !opts.split, "Two hands, two wagers")}${button("SURRENDER", "surrender", !opts.surrender, "Return half your bet")}</div><p class="table-note decision-note">YOUR DECISION · SETTLES WHEN THE BREAK ENDS</p>` : g.phase !== "result" ? `<p class="table-note decision-note">${g.phase === "dealer" ? "DEALER IS PLAYING" : "DEALING YOUR HAND"}</p>` : ""}<details class="table-rules"><summary>House rules & weapon rewards</summary><p>Fresh 52-card deck. Dealer peeks for blackjack, then stands on soft 17. Win pays 1:1, natural blackjack 3:2, push returns the stake. One split of equal ranks; split aces receive one card each. Split 21 is an ordinary win. Double any initial two cards, including after a split. Surrender your original two-card hand for half back. No insurance.</p><p>Win → Dividend rifle. Natural → Sovereign + Velvet Saber. Push → 90 rifle rounds. Equipment is awarded per hand, in addition to chip returns.</p></details>`;
  }
  result(g) {
    return `<div class="settlement"><div><span class="eyebrow">${g.result}</span><strong>${`${g.credited ?? g.returned ?? 0} ◉ RETURNED · ${(g.credited ?? g.returned ?? 0) - g.cost >= 0 ? "+" : ""}${(g.credited ?? g.returned ?? 0) - g.cost} NET`}</strong><p>${g.awards.length ? g.awards.map((a) => `${REWARDS[a.reward].label}${a.multiplier > 1 ? " × " + a.multiplier : ""}`).join(" · ") : "No equipment awarded."}</p></div><button class="deal-button" data-collect="${g.station}">PLAY AGAIN ↗</button></div>`;
  }
  bind(g) {
    const root = document.getElementById("casinoBody"),
      refresh = () => {
        this.invalidate();
        this.render(this.s, this.p, this.state);
      };
    for (const [attr, field] of [
      ["lines", "lines"],
      ["stake", "stake"],
      ["wager", "wager"],
      ["chip", "denom"],
    ])
      root.querySelectorAll(`[data-${attr}]`).forEach(
        (b) =>
          (b.onclick = () => {
            this[field] = Number(b.dataset[attr]);
            refresh();
          }),
      );

    root
      .querySelectorAll("[data-slot-feature]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            this.send({ type: "slotFeature", choice: b.dataset.slotFeature })),
      );
    root
      .querySelectorAll("[data-free-spin]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            this.send({ type: "gamble", station: "slots", freeSpin: true })),
      );
    root.querySelectorAll("[data-slot-theme]").forEach(
      (b) =>
        (b.onclick = () => {
          this.extra.slotTheme = b.dataset.slotTheme;
          refresh();
        }),
    );
    bindExtra(this, root, refresh);
    bindHighStakes(this, root, refresh);
    root.querySelectorAll("[data-position]").forEach(
      (b) =>
        (b.onclick = () => {
          const total = this.bets.reduce((n, b) => n + b.amount, 0),
            current = this.bets.find((v) => v.key === b.dataset.position);
          if (
            total + this.denom > Math.min(1000, this.p.chips) ||
            (current?.amount || 0) + this.denom > 500
          )
            return;
          if (current) current.amount += this.denom;
          else this.bets.push({ key: b.dataset.position, amount: this.denom });
          this.audio.chip();
          refresh();
        }),
    );
    root.querySelectorAll("[data-edit]").forEach(
      (b) =>
        (b.onclick = () => {
          if (b.dataset.edit === "clear") this.bets = [];
          if (b.dataset.edit === "undo") this.bets.pop();
          if (b.dataset.edit === "rebet")
            this.bets = this.previous.map((b) => ({ ...b }));
          refresh();
        }),
    );
    root.querySelectorAll("[data-play]").forEach(
      (b) =>
        (b.onclick = () => {
          this.previous = this.bets.map((b) => ({ ...b }));
          this.send({
            type: "gamble",
            station: this.s.id,
            lines: this.lines,
            stake: this.stake,
            wager: this.extra[this.s.id] || this.wager,
            picks: this.extra.kenoPicks,
            pairPlus: !!this.extra.pairPlus,
            bet: this.extra[this.s.id + "Bet"],
            bets: this.bets,
          });
          b.disabled = true;
        }),
    );
    root.querySelectorAll("[data-action]").forEach(
      (b) =>
        (b.onclick = () => {
          this.send({ type: b.dataset.action });
          root
            .querySelectorAll("[data-action]")
            .forEach((a) => (a.disabled = true));
        }),
    );
    root.querySelector("[data-collect]")?.addEventListener("click", () => {
      this.send({ type: "collect", station: this.s.id });
    });
  }
  animate(state, presentationTime = performance.now() / 1000) {
    if (document.getElementById("casino").hidden || !this.s) return;
    const shared =
      this.crewMode === this.s.id ? state?.crewTables?.[this.s.id] : null;
    const g = shared
        ? {
            ...shared,
            phase: shared.phase === "rolling" ? "playing" : shared.phase,
          }
        : state?.games[this.s.id],
      now = presentationTime;
    const dt = this.lastPresentationTime === undefined ? 1 / 60 : Math.max(0, Math.min(.1, now - this.lastPresentationTime));
    this.lastPresentationTime = now;
    if (this.s.id === "slots") {
      document.querySelectorAll("[data-reel]").forEach((el) => {
        const i = Number(el.dataset.reel),
          stop = g?.reelStops?.[i],
          spinning = g?.phase === "playing" && stop === null,
          index = spinning ? Math.floor(now * (17 - i * 2)) % 20 : (stop ?? 14);
        const wasSpinning = el.classList.contains("rolling");
        el.classList.toggle("rolling", spinning);
        if (wasSpinning && !spinning) {
          el.classList.remove("reel-settled");
          void el.offsetWidth;
          el.classList.add("reel-settled");
        }
        el.querySelectorAll("[data-row]").forEach((cell) => {
          const symbol =
            SLOT_REELS[i][(index + Number(cell.dataset.row) + 20) % 20];
          cell.textContent = SLOT_LABELS[symbol];
          cell.dataset.symbol = symbol;
        });
      });
    }
    if (this.s.id === "roulette") {
      const ball = document.querySelector(".roulette-ball");
      if (!ball) return;
      const key = g ? g.startedAt + "" : null;
      if (key !== this.animKey) {
        this.animKey = key;
        this.landing = null;
        this.rotation = 0;
      }
      let angle;
      if (g?.phase === "playing") {
        if (g.landingPocket !== undefined) {
          if (!this.landing) {
            const start = this.rotation || 0,
              target =
                ((WHEEL_ORDER.indexOf(g.landingPocket) + 0.5) * 360) / 37;
            this.landing = {
              at: now,
              start,
              end: Math.ceil(start / 360) * 360 + 360 + target,
              duration: g.remaining,
            };
          }
          const f = Math.min(
            1,
            (now - this.landing.at) / Math.max(0.1, this.landing.duration),
          );
          angle =
            this.landing.start +
            (this.landing.end - this.landing.start) * (1 - (1 - f) ** 3);
        } else angle = (this.rotation || 0) + 720 * dt;
      } else
        angle =
          g?.phase === "result"
            ? ((WHEEL_ORDER.indexOf(g.pocket) + 0.5) * 360) / 37
            : 0;
      this.rotation = angle;
      ball.style.transform = `rotate(${angle}deg)`;
    }
  }
}
