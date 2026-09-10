import { moveCircle } from "../shared/data.js";
export class MovementPrediction {
  constructor() {
    this.position = null;
    this.correction = { x: 0, z: 0 };
    this.pending = [];
  }
  sent(seq, input) {
    this.pending.push({ seq, input: { ...input } });
    if (this.pending.length > 15) this.pending.shift();
  }
  reconcile(p, open) {
    this.pending = this.pending.filter((i) => i.seq > (p.lastSeq || 0));
    const target = { x: p.x, z: p.z };
    for (const i of this.pending) this.step(target, i.input, 1 / 30, open);
    if (
      !this.position ||
      Math.hypot(target.x - this.position.x, target.z - this.position.z) > 3 ||
      p.down ||
      p.dodgeTime
    ) {
      this.position = target;
      this.correction = { x: 0, z: 0 };
    } else
      this.correction = {
        x: target.x - this.position.x,
        z: target.z - this.position.z,
      };
  }
  step(p, i, dt, open) {
    const f = i.forward || 0,
      r = i.right || 0,
      len = Math.max(1, Math.hypot(f, r)),
      speed = 6;
    moveCircle(
      p,
      ((-Math.sin(i.yaw) * f + Math.cos(i.yaw) * r) / len) * speed * dt,
      ((-Math.cos(i.yaw) * f - Math.sin(i.yaw) * r) / len) * speed * dt,
      0.4,
      open,
    );
  }
  update(dt, p, input, open) {
    if (!this.position) this.reconcile(p, open);
    if (!p.down && !p.offline && !p.dodgeTime)
      this.step(this.position, input, dt, open);
    const alpha = Math.min(1, dt * 12);
    moveCircle(
      this.position,
      this.correction.x * alpha,
      this.correction.z * alpha,
      0.4,
      open,
    );
    this.correction.x *= 1 - alpha;
    this.correction.z *= 1 - alpha;
    return this.position;
  }
}
