const TAU = Math.PI * 2;
const mod = (v) => ((v % TAU) + TAU) % TAU;
export class WheelMotion {
  constructor(count) {
    this.count = count;
    this.angle = 0;
    this.id = null;
    this.landing = null;
    this.done = true;
  }
  update(dt, spin, result) {
    dt = Math.max(0, Math.min(dt, 0.1));
    if (spin && (this.id !== spin.id || this.done)) {
      // A completed landing can precede the final server packet by a frame.
      if (this.id !== spin.id || this.id === null) {
        this.id = spin.id;
        this.landing = null;
        this.done = false;
      }
    }
    const prize =
      spin?.landingPrize ?? (!spin && !this.done ? result?.prize : undefined);
    if (prize !== undefined && !this.landing && !this.done) {
      const target = mod(-Math.PI / 2 - ((prize + 0.5) * TAU) / this.count);
      this.landing = {
        start: this.angle,
        distance: mod(target - mod(this.angle)) + TAU,
        elapsed: 0,
        duration: Math.max(0.3, spin?.remaining || 1.2),
      };
    }
    if (this.landing && !this.done) {
      const l = this.landing;
      l.elapsed = Math.min(l.duration, l.elapsed + dt);
      const u = l.elapsed / l.duration;
      this.angle =
        l.start +
        10 * l.duration * u * (1 - u) * (1 - u) +
        l.distance * u * u * (3 - 2 * u);
      if (u === 1) this.done = true;
    } else if (spin && !this.done) this.angle += dt * 10;
    return this.angle;
  }
}
