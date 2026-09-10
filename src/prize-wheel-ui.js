import { WHEEL_PRIZES, wheelCost, nearbyWheel } from "../shared/arsenal.js";
export class PrizeWheelUI {
  constructor(send) {
    this.send = send;
    this.panel = document.createElement("section");
    this.panel.id = "prizeWheelPanel";
    this.panel.hidden = true;
    this.panel.className = "wheel-panel";
    this.panel.innerHTML = `<div class="wheel-card"><small>THE HOUSE'S WANDERING ARMORY</small><button class="wheel-close" aria-label="Close prize wheel">×</button><h1>THE GRAND PRIZE</h1><p>Every spin wins a weapon or rare supply. The wheel moves after three spins. Your spin is yours alone.</p><div class="wheel-prizes">${WHEEL_PRIZES.map((p) => `<span>${p.label}</span>`).join("")}</div><h2 id="wheelResult">Take your chances.</h2><button id="wheelSpin">SPIN</button><p id="wheelDeadline"></p></div>`;
    document.body.append(this.panel);
    this.panel.querySelector(".wheel-close").onclick = () =>
      (this.panel.hidden = true);
    this.panel.querySelector("#wheelSpin").onclick = () =>
      send({ type: "prizeWheel" });
  }
  open(p, state) {
    this.panel.hidden = false;
    this.update(p, state);
  }
  update(p, state) {
    if (this.panel.hidden) return;
    if (!p || p.down || state.phase !== "break" || !nearbyWheel(p, state)) {
      this.panel.hidden = true;
      return;
    }
    const cost = wheelCost(state.prizeWheel),
      button = this.panel.querySelector("#wheelSpin");
    button.disabled = !!p.wheelSpin || p.chips < cost || state.timer < 7;
    button.textContent = p.wheelSpin
      ? `SPINNING… ${Math.ceil(p.wheelSpin.remaining)}s`
      : `SPIN · ${cost} CHIPS`;
    this.panel.querySelector("#wheelResult").textContent = p.wheelSpin
      ? "What will the house deliver?"
      : p.lastWheel?.label || "Take your chances.";
    this.panel.querySelector("#wheelDeadline").textContent =
      `Next wave in ${Math.ceil(state.timer)}s · New spins close at 7s · ${p.chips} chips available`;
  }
}
