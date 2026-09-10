import { oddsProfit } from "../shared/expansion.js";
import { POKER_PAYTABLE, baccaratScore } from "../shared/extra-rules.js";
const choice = (label, value, selected) =>
  `<button data-extra-bet="${value}" class="${selected === value ? "selected" : ""}">${label}</button>`;
function wager(view, g) {
  const id = view.s.id,
    amount = view.extra[id],
    options = id === "baccarat" ? [20, 40, 100] : [25, 50, 100];
  return g
    ? ""
    : `<div class="choice-label">WAGER</div><div class="choice-row">${options.map((n) => `<button data-extra-wager="${n}" class="${amount === n ? "selected" : ""}">${n} ◉</button>`).join("")}</div><button class="deal-button" data-play="${id}" ${view.p.chips < amount ? "disabled" : ""}>${id === "craps" ? "PLACE LINE BET" : "DEAL HAND"} <b>${amount} ◉</b></button>`;
}
function die(n) {
  const dots = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  return `<div class="casino-die">${Array.from({ length: 9 }, (_, i) => `<i class="${dots[n || 1].includes(i) ? "pip" : ""}"></i>`).join("")}</div>`;
}
export function extraTable(view, g, cards) {
  if (view.s.id === "poker") {
    if (g && view.pokerKey !== g.startedAt) {
      view.pokerKey = g.startedAt;
      view.extra.holds = [];
    }
    const hand = g?.cards;
    return `<div class="casino-layout poker-layout"><div><div class="video-poker-screen"><span class="eyebrow">JACKS OR BETTER · 9 / 6 DRAW POKER</span><div class="poker-cards">${hand ? hand.map((c, i) => `<button class="hold-card ${view.extra.holds.includes(i) ? "held" : ""}" data-hold="${i}" aria-pressed="${view.extra.holds.includes(i)}" ${g.phase !== "decision" ? "disabled" : ""}>${cards([c])}<span>${view.extra.holds.includes(i) ? "HELD" : "HOLD"}</span></button>`).join("") : '<div class="poker-idle">♠ ♥ ♣ ♦<small>ONE DRAW. MAKE IT COUNT.</small></div>'}</div><div class="poker-status">${g?.phase === "result" ? g.result : g?.phase === "decision" ? "SELECT CARDS TO KEEP, THEN DRAW" : g ? "DRAWING REPLACEMENTS" : "A PAIR OF JACKS OPENS THE PAYTABLE"}</div></div>${g?.phase === "decision" ? '<button class="deal-button" data-draw>DRAW / KEEP HELD CARDS ↗</button>' : wager(view, g)}<p class="table-note">Keep any of your five cards. Unheld cards are replaced once from the same deck. Holding all five stands pat.</p></div><div class="paytable"><span class="eyebrow">CREDITS RETURNED / 1 CHIP BET</span>${POKER_PAYTABLE.map(([name, pay]) => `<div class="${g?.result === name ? "poker-pay-win" : ""}"><strong>${name}</strong><span>${pay}×</span></div>`).join("")}<p>Jacks or better → 18 shells<br>Two pair through four of a kind → Pit Viper shotgun<br>Straight flush / royal → Gilded Pit Viper<br>Flush or better also awards Pit Boss Crossbow</p><p>Payouts include the wager. One fresh 52-card deck; no wild cards.</p></div></div>`;
  }
  if (view.s.id === "craps") {
    return `<div class="craps-felt"><div class="felt-lettering">BONES & BETS<span>PASS / DON’T PASS · BAR 12</span></div><div class="craps-point"><span>POINT</span><b>${g?.point || "OFF"}</b></div><div class="dice-tray ${g?.phase === "rolling" ? "dice-rolling" : ""}">${die(g?.dice?.[0])}${die(g?.dice?.[1])}</div><div class="craps-line ${g?.bet === "dont" ? "dont-line" : ""}">${g?.bet === "dont" ? "DON’T PASS LINE" : g?.bet === "pass" ? "PASS LINE" : "PLACE YOUR LINE BET"}</div></div>${
      !g
        ? `<div class="choice-label">WHICH SIDE OF THE DICE?</div><div class="choice-row">${choice("PASS LINE", "pass", view.extra.crapsBet)}${choice("DON’T PASS", "dont", view.extra.crapsBet)}</div>${wager(view, g)}`
        : g.phase === "decision"
          ? `${
              g.point
                ? `<div class="craps-odds"><div><span class="eyebrow">TRUE ODDS · POINT ${g.point}</span><h3>${g.odds || 0} ◉ ON THE ODDS</h3><p>Line bet ${g.lineCost || g.cost} ◉ · Odds profit if you win: ${oddsProfit(g.point, g.bet, g.odds || 0)} ◉</p></div><div class="choice-row">${[
                    0, 30, 60, 90, 120, 150, 180,
                  ]
                    .filter((n) => n <= (g.lineCost || g.cost) * 2)
                    .map(
                      (n) =>
                        `<button data-odds="${n}" class="${(g.odds || 0) === n ? "selected" : ""}" ${n - (g.odds || 0) > view.p.chips ? "disabled" : ""}>${n === 0 ? "TAKE DOWN" : n + " ◉"}</button>`,
                    )
                    .join("")}</div></div>`
                : ""
            }<button class="deal-button" data-action="roll">${g.point ? "ROLL AGAIN · POINT " + g.point : "COME-OUT ROLL"} <b>THROW THE DICE ↗</b></button>`
          : ""
    }<div class="dice-history">${
      g?.rolls
        ?.slice(-8)
        .map(
          (r) => `<span>${r.dice[0]} + ${r.dice[1]} <b>${r.total}</b></span>`,
        )
        .join("") || ""
    }</div><details class="table-rules" open><summary>Line rules & armor reward</summary><p>Pass: come-out 7/11 wins; 2/3/12 loses. Otherwise establish a point. Roll that point before a 7 to win. Don’t Pass reverses those wins/losses, except a come-out 12 pushes. Keep rolling until the line bet resolves. Winning line bets pay 1:1 plus the returned stake and give 75 armor. Armor absorbs damage before health; it refills to 75 and does not stack. After a point is set, add or take down odds between rolls. Maximum 2× your line bet, in 30-chip units for exact payouts. Pass odds pay 2:1 on 4/10, 3:2 on 5/9, 6:5 on 6/8; Don’t Pass pays the inverse. Odds have no house edge and resolve with the line. No comps on odds bets.</p></details>`;
  }
  const displayTotal = (hand) =>
    hand?.every((c) => c.rank > 0) ? baccaratScore(hand) : "?";
  return `<div class="blackjack-felt baccarat-felt"><div class="felt-lettering">CROWN BACCARAT<span>PLAYER · BANKER · TIE</span></div><div class="baccarat-hands"><div><span class="hand-label">PLAYER <b>${g ? displayTotal(g.playerCards) : "—"}</b></span>${g ? cards(g.playerCards) : '<div class="empty-shoe">♠</div>'}</div><div><span class="hand-label">BANKER <b>${g ? displayTotal(g.bankerCards) : "—"}</b></span>${g ? cards(g.bankerCards) : '<div class="empty-shoe">♦</div>'}</div></div><div class="baccarat-bet-label">${g ? "YOUR BET: " + g.bet.toUpperCase() : "PICK A SIDE. THE HOUSE DEALS BOTH HANDS."}</div></div>${!g ? `<div class="choice-row baccarat-choices">${choice("PLAYER · 1:1", "player", view.extra.baccaratBet)}${choice("BANKER · 0.95:1", "banker", view.extra.baccaratBet)}${choice("TIE · 8:1", "tie", view.extra.baccaratBet)}</div>${wager(view, g)}` : ""}<details class="table-rules" open><summary>Drawing rules & elite rewards</summary><p>Closest to 9 wins. Aces count 1; 10/J/Q/K count 0. Totals use the last digit. Natural 8/9 stops the deal; otherwise the standard player and banker third-card rules apply automatically. Six freshly shuffled decks per hand. Banker wins pay 0.95:1 after 5% commission; Player wins 1:1; Tie wins 8:1. Stakes return on wins; a tie pushes Player/Banker bets.</p><p>Winning Player/Banker → 90 rifle rounds, or Sovereign at a 100-chip wager. Winning Tie → Gilded Sovereign. All equipment is additional to chip returns.</p></details>`;
}
export function bindExtra(view, root, refresh) {
  root.querySelectorAll("[data-extra-wager]").forEach(
    (b) =>
      (b.onclick = () => {
        view.extra[view.s.id] = Number(b.dataset.extraWager);
        refresh();
      }),
  );
  root.querySelectorAll("[data-extra-bet]").forEach(
    (b) =>
      (b.onclick = () => {
        view.extra[view.s.id + "Bet"] = b.dataset.extraBet;
        refresh();
      }),
  );
  root.querySelectorAll("[data-hold]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.hold);
        view.extra.holds = view.extra.holds.includes(i)
          ? view.extra.holds.filter((n) => n !== i)
          : [...view.extra.holds, i];
        refresh();
      }),
  );
  root.querySelector("[data-draw]")?.addEventListener("click", (e) => {
    view.send({ type: "draw", holds: [...view.extra.holds] });
    e.currentTarget.disabled = true;
  });
}
