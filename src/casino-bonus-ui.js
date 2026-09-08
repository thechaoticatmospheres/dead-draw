export function bonusPanel(g, balance = Infinity) {
  if (!g) return "";
  if (g.phase === "bonus") {
    const v = g.vault;
    return `<div class="vault-bonus"><span class="eyebrow">FIFTH-SPIN REWARD · THE GILDED VAULT</span><h3>How far does your luck go?</h3><p>Four cash safes. One alarm. Pick up to three, or bank after any safe. An alarm loses only this bonus; your spin payout is already safe.</p><div class="vault-prize"><span>PROGRESSIVE SAFE<br /><b>◉ ${v.jackpot}</b></span><span>UNBANKED BONUS<br /><b>◉ ${v.winnings}</b></span></div><div class="vault-safes">${[
      0, 1, 2, 3, 4,
    ]
      .map((i) => {
        const pick = v.picks.find((p) => p.index === i);
        return `<button data-vault="${i}" ${pick ? "disabled" : ""} class="${pick ? "opened" : ""}"><span>${pick ? "◉" : "✦"}</span><b>${pick ? pick.value : "0" + (i + 1)}</b><small>${pick ? "CASH FOUND" : "OPEN SAFE"}</small></button>`;
      })
      .join(
        "",
      )}</div><button class="deal-button" data-vault-bank ${!v.picks.length ? "disabled" : ""}>BANK BONUS <b>${v.winnings} ◉</b></button><p class="table-note">${3 - v.picks.length} picks left · No extra wager · The alarm stays in the unopened safes.</p></div>`;
  }
  if (!["risk", "result"].includes(g.phase) || !g.paid) return "";
  if (!g.riskCredit && !g.riskAttempts)
    return g.vault?.finished
      ? `<div class="vault-banked">${g.vault.alarm ? "ALARM · VAULT BONUS LOST" : `VAULT BANKED · +${g.vault.winnings} ◉`}</div>`
      : "";
  const card = g.riskCard,
    red = card && ["♥", "♦"].includes(card.suit),
    rank = card
      ? { 1: "A", 11: "J", 12: "Q", 13: "K" }[card.rank] || card.rank
      : "GP";
  const enabled =
    g.phase === "result" &&
    g.riskCredit > 0 &&
    (g.riskAttempts || 0) < 3 &&
    g.riskCredit <= 10000 &&
    g.riskCredit <= balance;
  return `${g.vault?.finished ? `<div class="vault-banked">${g.vault.alarm ? "ALARM · VAULT BONUS LOST" : `VAULT BANKED · +${g.vault.winnings} ◉`}</div>` : ""}<div class="risk-panel"><div class="risk-card ${red ? "red" : ""} ${g.phase === "risk" ? "flipping" : ""}">${g.phase === "risk" ? "♠" : rank}<small>${g.phase === "risk" ? "?" : card?.suit || "♠"}</small></div><div><span class="eyebrow">OPTIONAL · DOUBLE OR BANK</span><h3>${g.phase === "risk" ? "Turning the card…" : g.riskOutcome || "Keep it. Or call the color."}</h3><p>${g.phase === "risk" ? `${g.riskStake} chips at risk` : `${g.riskCredit} chips already credited. A correct call doubles that amount; a wrong call loses it. Equipment stays yours.`}</p><small>Fresh 52-card deck · Red 50% / Black 50% · ${g.riskAttempts || 0}/3 attempts · No comps</small></div><div class="risk-actions"><button data-risk="red" ${!enabled ? "disabled" : ""}>♥ RED</button><button data-risk="black" ${!enabled ? "disabled" : ""}>♠ BLACK</button>${g.phase === "result" ? "<small>PLAY AGAIN or close the table to bank.</small>" : ""}</div></div>`;
}
export function bindBonus(view, root) {
  root.querySelectorAll("[data-risk]").forEach(
    (b) =>
      (b.onclick = () => {
        view.send({ type: "risk", station: view.s.id, color: b.dataset.risk });
        root
          .querySelectorAll("[data-risk]")
          .forEach((v) => (v.disabled = true));
      }),
  );
  root.querySelectorAll("[data-vault]").forEach(
    (b) =>
      (b.onclick = () => {
        view.send({ type: "vault", choice: Number(b.dataset.vault) });
        b.disabled = true;
      }),
  );
  root
    .querySelector("[data-vault-bank]")
    ?.addEventListener("click", () =>
      view.send({ type: "vault", choice: "bank" }),
    );
  root.querySelectorAll("[data-odds]").forEach(
    (b) =>
      (b.onclick = () => {
        view.send({ type: "odds", amount: Number(b.dataset.odds) });
        b.disabled = true;
      }),
  );
}
