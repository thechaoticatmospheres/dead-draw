import { deck } from "./casino.js";
export const casinoExpansionMethods = {
  startRisk(p, station, color) {
    const g = this.games[station];
    if (
      this.phase !== "break" ||
      !g ||
      g.player !== p.id ||
      g.phase !== "result" ||
      !["red", "black"].includes(color) ||
      !g.riskCredit ||
      g.riskCredit > p.chips ||
      (g.riskAttempts || 0) >= 3 ||
      g.riskCredit > 10000 ||
      Object.values(this.games).some(
        (other) => other.player === p.id && other.phase !== "result",
      )
    )
      return;
    p.chips -= g.riskCredit;
    g.riskStake = g.riskCredit;
    g.riskChoice = color;
    g.riskAttempts = (g.riskAttempts || 0) + 1;
    g.riskHidden = deck(this.rng).pop();
    g.riskCard = null;
    g.phase = "risk";
    g.remaining = 1.2;
    this.clearReady();
    this.event("card", { player: p.id });
  },
  finishRisk(g) {
    const p = this.players[g.player];
    if (!p || g.phase !== "risk") return;
    g.riskCard = g.riskHidden;
    delete g.riskHidden;
    const color = ["♥", "♦"].includes(g.riskCard.suit) ? "red" : "black";
    const won = color === g.riskChoice;
    g.riskCredit = won ? g.riskStake * 2 : 0;
    g.riskOutcome = won ? "DOUBLE PAID" : "PAYOUT LOST";
    p.chips += g.riskCredit;
    this.recordHand(
      p,
      {
        station: g.station,
        result: `Double or bank · ${won ? "win" : "loss"}`,
      },
      g.riskCredit - g.riskStake,
    );
    g.phase = "result";
    g.remaining = null;
    this.event("notice", {
      player: p.id,
      text: `${g.riskOutcome} · ${g.riskCredit} chips credited. Equipment is yours to keep.`,
    });
  },
  openVault(g) {
    g.vaultHidden = [25, 50, 100, this.jackpot, "alarm"];
    for (let i = 4; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [g.vaultHidden[i], g.vaultHidden[j]] = [
        g.vaultHidden[j],
        g.vaultHidden[i],
      ];
    }
    g.vault = {
      picks: [],
      winnings: 0,
      jackpot: this.jackpot,
      finished: false,
    };
    g.phase = "bonus";
    g.remaining = null;
    this.event("notice", {
      player: g.player,
      text: "THE VAULT IS OPEN · Pick up to 3 safes, or bank before the alarm.",
    });
  },
  vaultAction(p, choice) {
    const g = this.games.slots;
    if (this.phase !== "break" || g?.player !== p.id || g.phase !== "bonus")
      return;
    const v = g.vault;
    if (choice === "bank") {
      if (v.picks.length) this.bankVault(g);
      return;
    }
    if (
      !Number.isInteger(choice) ||
      choice < 0 ||
      choice > 4 ||
      v.picks.some((p) => p.index === choice)
    )
      return;
    const value = g.vaultHidden[choice];
    v.picks.push({ index: choice, value });
    if (value === "alarm") {
      v.winnings = 0;
      v.alarm = true;
      this.bankVault(g);
    } else {
      v.winnings += value;
      if (v.picks.length === 3) this.bankVault(g);
    }
  },
  bankVault(g) {
    const p = this.players[g.player],
      v = g.vault;
    if (!p || v.finished) return;
    v.finished = true;
    if (v.winnings && v.picks.some((p) => p.value === v.jackpot))
      this.jackpot = 250;
    p.chips += v.winnings;
    g.riskCredit += v.winnings;
    g.phase = "result";
    g.remaining = null;
    this.recordHand(
      p,
      { station: "slots", result: v.alarm ? "Vault alarm" : "Vault banked" },
      v.winnings,
    );
    this.event("notice", {
      player: p.id,
      text: v.alarm
        ? "VAULT ALARM · Bonus lost. Your original spin payout is safe."
        : `VAULT BANKED · +${v.winnings} chips`,
    });
  },
  changeOdds(p, amount) {
    const g = this.games.craps;
    if (
      this.phase !== "break" ||
      !g ||
      g.player !== p.id ||
      g.phase !== "decision" ||
      !g.point
    )
      return;
    const line = g.lineCost || g.cost;
    if (
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > line * 2 ||
      amount % 30 !== 0
    )
      return;
    const delta = amount - (g.odds || 0);
    if (delta > p.chips) return;
    p.chips -= delta;
    g.cost += delta;
    g.odds = amount;
    this.clearReady();
  },
};
