import { handOptions } from "../shared/casino-rules.js";
export const CREW_GAMES = ["roulette", "blackjack", "baccarat", "craps"];
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function crewCasino(v, cards, wheel) {
  const id = v.s.id,
    t = v.state.crewTables?.[id],
    s = t?.seats.find((s) => s.player === v.p.id),
    phase = t?.phase || "betting";
  v.extra.crewAmount ??= 30;
  const options =
    id === "blackjack"
      ? [50, 100, 200]
      : id === "baccarat"
        ? [20, 40, 100]
        : [30, 60, 150];
  if (!options.includes(v.extra.crewAmount)) v.extra.crewAmount = options[0];
  const action = (text, choice, disabled = false, more = "") =>
    `<button data-crew-choice="${choice}" ${disabled ? "disabled" : ""} ${more}>${text}</button>`;
  let table = "";
  if (id === "roulette")
    table = `${wheel()}<p class="table-note">${phase === "result" ? "WINNING NUMBER " + t.pocket : "One wheel · separate bets · every seated player confirms before spinning."}</p>`;
  if (id === "baccarat")
    table = `<div class="crew-hands"><div>PLAYER${cards(t?.baccarat?.playerCards || [{ rank: 0 }, { rank: 0 }])}</div><div>BANKER${cards(t?.baccarat?.bankerCards || [{ rank: 0 }, { rank: 0 }])}</div></div>`;
  if (id === "blackjack")
    table = `<span class="hand-label">ONE DEALER · STANDS ON ALL 17s</span>${cards(t?.dealer || [{ rank: 0 }, { rank: 0 }])}`;
  if (id === "craps")
    table = `<div class="sicbo-dice ${phase === "rolling" ? "dice-rolling" : ""}">${t?.dice?.length ? t.dice.map((n) => ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][n]).join(" ") : "◇ ◇"}</div><p>POINT: ${t?.point || "OFF"} · SHOOTER: ${esc(t?.seats.find((s) => s.player === t.shooter)?.name || "FIRST PLAYER")}</p><p class="table-note">${t?.rolls?.join(" · ") || "Pass / Don’t Pass · Place bets work only when point is on · Come bets travel"}</p>`;
  table += `<div class="crew-seats">${(t?.seats || []).map((seat) => `<article class="${seat.player === v.p.id ? "your-seat" : ""}"><b>${esc(seat.name)}</b><span>${seat.ready ? "READY" : "AT THE TABLE"} · ${seat.cost} ◉</span>${seat.hand ? seat.hand.hands.map((h) => cards(h.cards) + `<small>${h.status.toUpperCase()} ${h.result || ""}</small>`).join("") : ""}<small>${seat.bets?.map((b) => `${esc(b.key)}${b.point ? " → " + b.point : ""}: ${b.amount}`).join(" · ") || esc(seat.bet || "")}</small>${seat.result ? `<strong>${esc(seat.result)} · ${seat.returned || 0} ◉ RETURNED</strong>` : ""}</article>`).join("") || "<p>Your friends can take seats here and bet alongside you.</p>"}</div>`;
  let controls = "";
  if (phase === "betting") {
    controls = `<div class="choice-row">${options.map((n) => `<button data-crew-amount="${n}" class="${v.extra.crewAmount === n ? "selected" : ""}">${n} ◉</button>`).join("")}</div>`;
    const bets =
      id === "roulette"
        ? [
            ["red", "RED"],
            ["black", "BLACK"],
            ["even", "EVEN"],
            ["odd", "ODD"],
            ["low", "1–18"],
            ["high", "19–36"],
            ["dozen1", "1ST 12"],
            ["dozen2", "2ND 12"],
            ["dozen3", "3RD 12"],
            ...Array.from({ length: 37 }, (_, n) => ["n:" + n, String(n)]),
          ]
        : id === "baccarat"
          ? [
              ["player", "PLAYER 1:1"],
              ["banker", "BANKER 0.95:1"],
              ["tie", "TIE 8:1"],
            ]
          : id === "blackjack"
            ? [["ante", "PLACE ANTE"]]
            : [
                ["pass", "PASS"],
                ["dont", "DON’T PASS"],
                ["come", "COME"],
                ...[4, 5, 6, 8, 9, 10].map((n) => ["place:" + n, "PLACE " + n]),
              ];
    controls += `<div class="crew-bets">${bets.map(([key, label]) => action(label, "bet", v.p.chips < v.extra.crewAmount || ((id === "blackjack" || id === "baccarat") && s?.cost > 0), `data-crew-bet="${key}"`)).join("")}</div><div class="hand-decisions">${action(id === "craps" ? "PICK UP PLACE BETS" : "CLEAR BETS", "clear", !s?.cost)}${id === "craps" ? action("ROLL · SHOOTER", "roll", !t?.seats.some((s) => s.cost) || t.shooter !== v.p.id) : action(s?.ready ? "UNREADY" : "READY TO DEAL / SPIN", "ready", !s?.cost)}</div>`;
  }
  if (
    id === "blackjack" &&
    phase === "decision" &&
    s?.hand?.phase === "decision"
  ) {
    const opts = handOptions(s.hand, v.p.chips);
    controls = `<div class="hand-decisions">${["hit", "stand", "double", "split", "surrender"].map((a) => action(a.toUpperCase(), "card", !opts[a], `data-card-action="${a}"`)).join("")}</div>`;
  }
  const canLeave =
    phase === "result" ||
    (phase === "betting" &&
      (!s?.cost ||
        id !== "craps" ||
        s.bets.every((b) => b.key.startsWith("place:"))));
  return `<div class="table-topline"><span>CREW TABLE · ${phase.toUpperCase()}</span><b>YOUR CHIPS ◉ ${v.p.chips}</b></div><div class="high-stakes-felt">${table}</div>${controls}${s ? action("LEAVE SEAT / COLLECT", "leave", !canLeave) : action("TAKE A SEAT", "seat", phase !== "betting")}<p class="table-note">No countdown. Place your bets, then every seated player confirms. Spectators can watch without betting. Leave your seat when finished. Active line and come bets must settle before leaving.</p><details class="table-rules"><summary>Shared table rules</summary><p>Roulette: single zero, outside 1:1 and numbers 35:1. Baccarat: player 1:1, banker 0.95:1, tie 8:1; ties push other bets. Blackjack: 3:2 naturals, one split, double and surrender; all players share a fresh deck and dealer. Craps: line and come wins 1:1, Don’t Pass bars 12. Place 4/10 pays 9:5, 5/9 pays 7:5, 6/8 pays 7:6; place stakes stay on the table until picked up or lost. Place bets are off on come-out. Shooter rotates after a seven-out. Stakes and equipment belong to each player.</p></details>`;
}
export function bindCrewCasino(v, root, refresh) {
  root.querySelectorAll("[data-crew-amount]").forEach(
    (b) =>
      (b.onclick = () => {
        v.extra.crewAmount = +b.dataset.crewAmount;
        refresh();
      }),
  );
  root.querySelectorAll("[data-crew-choice]").forEach(
    (b) =>
      (b.onclick = () => {
        v.send({
          type: "crewTable",
          station: v.s.id,
          choice: b.dataset.crewChoice,
          bet: b.dataset.crewBet,
          amount: v.extra.crewAmount,
          action: b.dataset.cardAction,
        });
      }),
  );
}
