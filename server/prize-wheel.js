import {
  WHEEL_PRIZES,
  WHEEL_ROOMS,
  newPrizeWheel,
  nearbyWheel,
  wheelCost,
} from "../shared/arsenal.js";
import { WEAPONS } from "../shared/data.js";
import { ROOMS } from "../shared/map.js";
import { giveReward } from "./casino.js";
export const prizeWheelMethods = {
  movePrizeWheel() {
    const choices = WHEEL_ROOMS.filter((r) => r !== this.prizeWheel?.room);
    this.prizeWheel ||= newPrizeWheel(this.rng);
    if (choices.length)
      this.prizeWheel.room = choices[Math.floor(this.rng() * choices.length)];
    this.prizeWheel.visits = 0;
    this.event("notice", {
      text:
        "THE GRAND PRIZE WHEEL · " +
        ROOMS.find((r) => r.id === this.prizeWheel.room).name,
    });
  },
  spinPrizeWheel(p) {
    if (
      this.phase !== "break" ||
      this.timer < 7 ||
      !nearbyWheel(p, this) ||
      this.busy(p.id) ||
      p.wheelSpin
    )
      return;
    const cost = wheelCost(this.prizeWheel);
    if (p.chips < cost) return;
    p.chips -= cost;
    p.wheelSpin = {
      remaining: 5,
      total: 5,
      cost,
      prize: Math.floor(this.rng() * WHEEL_PRIZES.length),
    };
    this.prizeWheel.spins++;
    this.prizeWheel.visits++;
    this.event("wager", { player: p.id, station: "prizeWheel" });
  },
  updatePrizeWheel(dt, force = false) {
    for (const p of Object.values(this.players)) {
      const spin = p.wheelSpin;
      if (!spin) continue;
      spin.remaining -= dt;
      if (spin.remaining > 0 && !force) continue;
      const prize = WHEEL_PRIZES[spin.prize];
      if (prize.kind === "weapon") giveReward(p, prize.id);
      else if (prize.id === "maxAmmo")
        for (const gun of p.guns) {
          const w = WEAPONS[gun.id];
          gun.ammo = w.mag;
          gun.reserve = Math.max(gun.reserve, w.reserve);
        }
      else if (prize.id === "goldVest") p.armor = Math.max(p.armor, 150);
      else p.reviveTokens = (p.reviveTokens || 0) + 1;
      p.lastWheel = {
        id: ++this.serial,
        label: prize.label,
        prize: spin.prize,
      };
      delete p.wheelSpin;
      this.event("purchase", {
        player: p.id,
        text: "GRAND PRIZE · " + prize.label,
      });
    }
    if (
      this.prizeWheel.visits >= 3 &&
      !Object.values(this.players).some((p) => p.wheelSpin)
    )
      this.movePrizeWheel();
  },
};
