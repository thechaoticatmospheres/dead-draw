import {
  HIGH_STAKES,
  SIC_BO_BETS,
  KENO_PAYTABLE,
  RIDE_PAYTABLE,
  hiLoQuote,
} from "../shared/high-stakes-rules.js";
export { HIGH_STAKES };
const choice = (name, id, detail = "", disabled = false) =>
  `<button class="table-action" data-table-choice="${id}" ${disabled ? "disabled" : ""}><strong>${name}</strong><small>${detail}</small></button>`;
const rules = {
  war: "Fresh 52-card deck; ace high. Higher card wins 1:1. On a tie, surrender for half your stake or match it to go to war. Three cards burn, then both draw again. A war win returns three stakes; another tie returns four. A loss loses both stakes.",
  threecard:
    "Ante first, then play by matching your ante or fold. Dealer qualifies with queen high or better. If unqualified, ante wins 1:1 and play pushes. Otherwise both bets win 1:1, push on a tie, or lose. Ante bonus: straight 1:1, trips 4:1, straight flush 5:1, even if the dealer wins. Pair Plus: pair 1:1, flush 3:1, straight 6:1, trips 30:1, straight flush 40:1. Folding forfeits all bets. Fresh deck. Straight beats flush; A-2-3 is the lowest straight.",
  sicbo:
    "Three independent six-sided dice. Small (4–10), big (11–17), odd and even pay 1:1; all lose on any triple. Any triple pays 30:1. A chosen face pays 1:1, 2:1 or 3:1 for one, two or three matches. Winning stakes are also returned.",
  keno: "Pick 2–8 distinct numbers from 1–80. Twenty unique balls are drawn without replacement. The paytable shows total return including the stake. Unlisted match counts lose. Your ticket stays selected for the next draw.",
  hilo: "Ace high. Predict strictly higher or lower, then press your winnings or bank. An equal rank loses. Each draw uses a fresh 52-card deck. The quoted return reflects the exact chance, with a 4% house edge per prediction and rounding down to whole chips. Five correct calls bank automatically.",
  letitride:
    "Place three equal bets. See your three cards, then pull back bet 1 or let it ride. After the first community card, decide on bet 2. Bet 3 always rides. Your five-card hand pays each remaining bet independently. Pulled stakes are returned at settlement. A pair of tens or better wins. Fresh 52-card deck. Table shows profit odds; winning stakes are also returned.",
};
export function highStakesTable(v, g, cards) {
  const id = v.s.id,
    e = v.extra;
  e[id] ??= v.s.cost;
  e.sicboBet ??= "small";
  e.kenoPicks ??= [7, 17, 27, 37];
  const wager = g?.wager || e[id],
    active = g?.phase === "decision",
    busy = g && !["decision", "result"].includes(g.phase);
  let felt = "",
    actions = "";
  if (["war", "threecard"].includes(id)) {
    felt = `<div class="dealer-hand"><span class="hand-label">DEALER ${id === "threecard" ? "· QUEEN HIGH TO QUALIFY" : ""}</span>${g ? cards(g.dealer) : '<div class="empty-shoe">♠</div>'}</div><div class="hand-zone"><span class="hand-label">YOUR ${id === "war" ? "CHALLENGE" : "THREE CARDS"}</span>${g ? cards(g.cards) : '<div class="empty-hand">THE NEXT HAND IS YOURS</div>'}</div>`;
    if (active)
      actions =
        id === "war"
          ? choice("GO TO WAR", "war", `Match ${wager} ◉`, v.p.chips < wager) +
            choice(
              "SURRENDER",
              "surrender",
              `Return ${Math.floor(wager / 2)} ◉`,
            )
          : choice(
              "PLAY",
              "play",
              `Match ante · ${wager} ◉`,
              v.p.chips < wager,
            ) + choice("FOLD", "fold", "Forfeit placed bets");
  }
  if (id === "sicbo") {
    felt = `<div class="sicbo-dice ${busy ? "dice-rolling" : ""}">${[0, 1, 2].map((i) => `<span>${g?.dice?.[i] ? ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][g.dice[i]] : "◆"}</span>`).join("")}</div><div class="sicbo-grid">${SIC_BO_BETS.map(([key, label]) => `<button data-sicbo="${key}" class="${(g?.bet || e.sicboBet) === key ? "selected" : ""}" ${g ? "disabled" : ""}>${label}<small>${key.startsWith("face") ? "1–3:1" : key === "triple" ? "30:1" : "1:1"}</small></button>`).join("")}</div>`;
  }
  if (id === "keno") {
    const picks = g?.picks || e.kenoPicks,
      drawn = g?.drawn || [];
    felt = `<div class="keno-status"><b>${picks.length} SPOTS SELECTED</b><span>${drawn.length} / 20 DRAWN · ${picks.filter((n) => drawn.includes(n)).length} HITS</span></div><div class="keno-board">${Array.from(
      { length: 80 },
      (_, i) => i + 1,
    )
      .map(
        (n) =>
          `<button data-keno="${n}" class="${picks.includes(n) ? "selected" : ""} ${drawn.includes(n) ? "drawn" : ""}" ${g ? "disabled" : ""}>${n}</button>`,
      )
      .join("")}</div><div class="keno-pays">${Object.entries(
      KENO_PAYTABLE[picks.length] || {},
    )
      .map(([hits, pay]) => `<span>${hits} HITS <b>${pay}×</b></span>`)
      .join("")}</div>`;
  }
  if (id === "hilo") {
    felt = `<div class="hilo-bank"><span>AT THE TABLE</span><strong>◉ ${g?.credit || wager}</strong><small>${g?.streak || 0} / 5 CORRECT · PRESS OR BANK</small></div>${g ? cards(g.cards) : '<div class="empty-hand">ONE CARD. YOUR CALL.</div>'}`;
    if (active) {
      actions =
        ["higher", "lower"]
          .map((direction) => {
            const q = hiLoQuote(g.cards.at(-1), direction, g.credit);
            return choice(
              direction === "higher" ? "↑ HIGHER" : "↓ LOWER",
              direction,
              `${(q.chance * 100).toFixed(1)}% · return ${q.returned} ◉`,
              !q.count,
            );
          })
          .join("") + choice("BANK", "bank", `Take ${g.credit} ◉`, !g.streak);
    }
  }
  if (id === "letitride") {
    felt = `<div class="ride-bets">${[0, 1, 2].map((i) => `<div class="${g?.riding[i] === false ? "pulled" : ""}"><span>BET ${i + 1}${i === 2 ? " · FIXED" : ""}</span><b>${wager} ◉</b><small>${g?.riding[i] === false ? "PULLED BACK" : active && g.step === i ? "YOUR DECISION" : "RIDING"}</small></div>`).join("")}</div><span class="hand-label">YOUR CARDS</span>${g ? cards(g.cards) : '<div class="empty-hand">THREE BETS. FIVE CARDS.</div>'}<span class="hand-label">COMMUNITY CARDS</span>${cards(g?.community || [{ rank: 0 }, { rank: 0 }])}`;
    if (active)
      actions =
        choice("LET IT RIDE", "ride", `Keep bet ${g.step + 1} in play`) +
        choice(
          "PULL BACK",
          "pull",
          `Protect ${wager} ◉ · returned at settlement`,
        );
  }
  const cost =
    wager * (id === "letitride" ? 3 : id === "threecard" && e.pairPlus ? 2 : 1);
  const controls = !g
    ? `<div class="choice-label">${id === "letitride" ? "CHIPS PER BET · THREE BETS" : id === "threecard" ? "ANTE" : "WAGER"}</div><div class="choice-row">${v.s.wagers.map((n) => `<button data-high-wager="${n}" class="${wager === n ? "selected" : ""}">${n} ◉</button>`).join("")}</div>${id === "threecard" ? `<button class="pair-plus ${e.pairPlus ? "selected" : ""}" data-pair-plus>PAIR PLUS ${e.pairPlus ? "ON" : "OFF"} · ${wager} ◉ OPTIONAL</button>` : ""}<button class="deal-button" data-play="${id}" ${v.p.chips < cost || (id === "keno" && e.kenoPicks.length < 2) ? "disabled" : ""}>${id === "keno" ? "DRAW 20 BALLS" : id === "sicbo" ? "SHAKE THE DICE" : "DEAL"} <b>${cost} ◉</b></button>`
    : "";
  return `<div class="high-stakes-felt ${id}-felt">${felt}</div>${controls}${actions ? `<div class="hand-decisions">${actions}</div><p class="table-note">YOUR DECISION · TAKE YOUR TIME</p>` : ""}${busy ? `<p class="table-note decision-note">${g.phase.toUpperCase()}…</p>` : ""}<details class="table-rules"><summary>House rules & payouts</summary><p>${rules[id]}</p>${id === "letitride" ? `<div class="ride-paytable">${RIDE_PAYTABLE.map(([name, odds]) => `<span>${name}<b>${odds}:1</b></span>`).join("")}</div>` : ""}<p>All wagers use in-game chips. Equipment rewards accompany winning hands; the chip returns above are separate.</p></details>`;
}
export function bindHighStakes(v, root, refresh) {
  root.querySelectorAll("[data-high-wager]").forEach(
    (b) =>
      (b.onclick = () => {
        v.extra[v.s.id] = Number(b.dataset.highWager);
        refresh();
      }),
  );
  root.querySelectorAll("[data-sicbo]").forEach(
    (b) =>
      (b.onclick = () => {
        v.extra.sicboBet = b.dataset.sicbo;
        refresh();
      }),
  );
  root.querySelectorAll("[data-keno]").forEach(
    (b) =>
      (b.onclick = () => {
        const n = Number(b.dataset.keno),
          picks = v.extra.kenoPicks;
        if (picks.includes(n)) v.extra.kenoPicks = picks.filter((p) => p !== n);
        else if (picks.length < 8) picks.push(n);
        v.audio.chip();
        refresh();
      }),
  );
  const pair = root.querySelector("[data-pair-plus]");
  if (pair)
    pair.onclick = () => {
      v.extra.pairPlus = !v.extra.pairPlus;
      refresh();
    };
  root.querySelectorAll("[data-table-choice]").forEach(
    (b) =>
      (b.onclick = () => {
        v.send({
          type: "tableChoice",
          station: v.s.id,
          choice: b.dataset.tableChoice,
        });
        root
          .querySelectorAll("[data-table-choice]")
          .forEach((b) => (b.disabled = true));
      }),
  );
}
