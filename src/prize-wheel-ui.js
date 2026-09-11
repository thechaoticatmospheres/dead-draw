import { WHEEL_PRIZES, wheelCost, nearbyWheel } from "../shared/arsenal.js";
import { WheelMotion } from "./wheel-motion.js";
export class PrizeWheelUI {
  constructor(send, audio) {
    this.audio = audio;
    this.send = send;
    this.panel = document.createElement("section");
    this.panel.id = "prizeWheelPanel";
    this.panel.hidden = true;
    this.panel.className = "wheel-panel";
    this.panel.innerHTML = `<div class="wheel-card"><small>THE HOUSE'S WANDERING ARMORY</small><button class="wheel-close" aria-label="Close prize wheel">×</button><h1>THE GRAND PRIZE</h1><p>Every spin wins a weapon or rare supply. The wheel moves after three spins. Your spin is yours alone.</p><div class="wheel-prizes">${WHEEL_PRIZES.map((p) => `<span>${p.label}</span>`).join("")}</div><h2 id="wheelResult">Take your chances.</h2><button id="wheelSpin">SPIN</button><p id="wheelDeadline"></p></div>`;
    document.body.append(this.panel);
    this.motion = new WheelMotion(WHEEL_PRIZES.length);
    this.panel.querySelector(".wheel-prizes").outerHTML =
      '<div class="prize-spinner"><div class="prize-pointer">▼</div><canvas width="800" height="800" aria-label="Prize wheel with weapon and supply segments"></canvas><span class="prize-hub">GP</span></div>';
    this.disc = this.panel.querySelector("canvas");
    const ctx = this.disc.getContext("2d"),
      n = WHEEL_PRIZES.length;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      ctx.beginPath();
      ctx.moveTo(400, 400);
      ctx.arc(400, 400, 388, a, b);
      ctx.closePath();
      ctx.fillStyle = ["#235455", "#762d40", "#9c7935"][i % 3];
      ctx.fill();
      ctx.strokeStyle = "#edc97e";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.save();
      ctx.translate(400, 400);
      ctx.rotate((a + b) / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff2ce";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(WHEEL_PRIZES[i].label, 365, 7, 270);
      ctx.restore();
    }
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
    if (!p || p.down || state.phase !== "break") {
      this.panel.hidden = true;
      return;
    }
    const cost = wheelCost(state.prizeWheel),
      button = this.panel.querySelector("#wheelSpin");
    button.disabled =
      !!p.wheelSpin ||
      !this.motion.done ||
      !nearbyWheel(p, state) ||
      p.chips < cost ||
      state.timer < 7;
    button.textContent = p.wheelSpin
      ? `SPINNING… ${Math.ceil(p.wheelSpin.remaining)}s`
      : !nearbyWheel(p, state)
        ? "WHEEL MOVED · FIND ITS NEW ROOM"
        : `SPIN · ${cost} CHIPS`;
    this.panel.querySelector("#wheelResult").textContent = p.wheelSpin
      ? "What will the house deliver?"
      : this.motion.done
        ? p.lastWheel?.label || "Take your chances."
        : "Coming to a stop…";
    this.panel.querySelector("#wheelDeadline").textContent =
      `Next wave in ${Math.ceil(state.timer)}s · New spins close at 7s · ${p.chips} chips available`;
  }
  animate(dt, state, p) {
    const angle = this.motion.update(dt, p?.wheelSpin, p?.lastWheel);
    this.disc.style.transform = `rotate(${angle}rad)`;
    const sector = Math.floor((angle * WHEEL_PRIZES.length) / (Math.PI * 2));
    if (!this.panel.hidden && !this.motion.done && sector !== this.sector)
      this.audio?.play("rouletteTick", {
        gain: 0.65,
        key: "prize-wheel-tick",
        cooldown: 0.035,
      });
    this.sector = sector;
    if (!this.panel.hidden) this.update(p, state);
  }
}
