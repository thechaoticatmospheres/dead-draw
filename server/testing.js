import { WEAPONS } from "../shared/data.js";
import { maxHealth } from "../shared/expansion.js";
import { BREAK_SECONDS } from "./intermissions.js";
export const testingMethods = {
  testingHost() {
    return Object.values(this.players).find((p) => !p.offline)?.id || null;
  },
  testingAction(p, msg) {
    if (
      p.offline ||
      p.id !== this.testingHost() ||
      !["break", "combat"].includes(this.phase)
    )
      return;
    const numeric = ["chips", "comps", "wave"].includes(msg.action);
    if (
      numeric &&
      (!Number.isSafeInteger(msg.value) ||
        msg.value < 1 ||
        msg.value > (msg.action === "wave" ? 100 : 100000))
    )
      return;
    if (!["chips", "comps", "wave", "restore", "break"].includes(msg.action))
      return;
    this.testing = true;
    if (msg.action === "chips" || msg.action === "comps")
      p[msg.action] = Math.min(1000000, (p[msg.action] || 0) + msg.value);
    if (msg.action === "restore") {
      p.down = false;
      p.hp = maxHealth(p);
      p.armor = 100;
      p.stamina = 100;
      p.reload = 0;
      for (const gun of p.guns) {
        gun.ammo = WEAPONS[gun.id].mag;
        gun.reserve = WEAPONS[gun.id].reserve;
      }
    }
    if (msg.action === "wave" || msg.action === "break") {
      this.finishIntermissionGames();
      this.updatePrizeWheel(0, true);
      this.zombies = [];
      this.hazards = [];
      this.pending = 0;
      this.chips = [];
      this.pickups = [];
      this.contract = null;
      this.campaign.finale = false;
      this.clearReady();
      if (msg.action === "wave") {
        this.round = msg.value - 1;
        this.startRound();
      } else {
        this.phase = "break";
        this.timer = BREAK_SECONDS;
      }
    }
    this.event("notice", {
      text:
        "TESTING RUN · " +
        p.name +
        " used " +
        msg.action +
        (numeric ? " " + msg.value : "") +
        ". Career records disabled for this run.",
    });
  },
};
