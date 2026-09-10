import { drawPoker, rollCraps, finishCraps } from "./extra-games.js";
import { playHand, advanceBlackjack } from "./table-games.js";
import { advanceHighStakes, highStakesDecision } from "./high-stakes.js";
import { HIGH_STAKES } from "../shared/high-stakes-rules.js";
export const BREAK_SECONDS = 90;
export const intermissionMethods = {
  finishIntermissionGames() {
    // Deadline policy: stand at blackjack, hold poker cards, surrender/fold unpaid
    // decisions, keep Let It Ride wagers, bank Hi-Lo/vault and finish committed rolls.
    for (const g of Object.values(this.games)) {
      const p = this.players[g.player];
      if (!p) continue;
      for (let guard = 0; guard < 128 && g.phase !== "result"; guard++) {
        if (g.phase === "risk") {
          this.finishRisk(g);
          continue;
        }
        if (g.phase === "bonus") {
          this.bankVault(g);
          continue;
        }
        if (g.station === "blackjack") {
          if (g.phase === "decision") playHand(g, "stand", p);
          else if (advanceBlackjack(g)) this.payTable(g);
        } else if (g.station === "poker") {
          if (g.phase === "decision") drawPoker(g, [0, 1, 2, 3, 4]);
          else this.payTable(g);
        } else if (g.station === "craps") {
          if (g.phase === "decision") rollCraps(g, this.rng);
          else if (finishCraps(g)) this.payTable(g);
        } else if (HIGH_STAKES.includes(g.station)) {
          if (g.phase === "decision") {
            if (g.kind === "hilo" && !g.streak) {
              Object.assign(g, {
                returned: g.credit || g.cost,
                awards: [],
                result: "UNPLAYED HI-LO · STAKE RETURNED",
              });
              this.payTable(g);
              continue;
            }
            const choice = {
              war: "surrender",
              threecard: "fold",
              letitride: "ride",
              hilo: "bank",
            }[g.kind];
            if (highStakesDecision(g, p, { choice }, this.rng))
              this.payTable(g);
          } else if (advanceHighStakes(g, this.rng)) this.payTable(g);
        } else this.payTable(g);
      }
      // A pathological dice RNG cannot hold a server round open indefinitely.
      if (g.phase !== "result" && !g.paid) {
        Object.assign(g, {
          returned: g.cost,
          awards: [],
          result: "UNRESOLVED WAGER RETURNED",
        });
        this.payTable(g);
      }
      if (g.phase === "bonus") this.bankVault(g);
    }
  },
};
