import { BOUNDS, barriers, circleRect, roomAt } from "../shared/map.js";
import { OBSTACLES } from "../shared/data.js";
const WIDTH = BOUNDS.maxX - BOUNDS.minX,
  HEIGHT = BOUNDS.maxZ - BOUNDS.minZ;
const point = (i) => ({
  x: (i % WIDTH) + BOUNDS.minX + 0.5,
  z: Math.floor(i / WIDTH) + BOUNDS.minZ + 0.5,
});
const cell = (p) =>
  Math.max(0, Math.min(WIDTH - 1, Math.floor(p.x - BOUNDS.minX))) +
  WIDTH * Math.max(0, Math.min(HEIGHT - 1, Math.floor(p.z - BOUNDS.minZ)));
export class Navigation {
  constructor() {
    this.key = "";
    this.dist = new Int16Array(WIDTH * HEIGHT);
    this.walk = new Uint8Array(WIDTH * HEIGHT);
  }
  build(players, open) {
    const key = open.slice().sort().join();
    if (key !== this.key) {
      this.key = key;
      const walls = barriers(open);
      for (let i = 0; i < this.walk.length; i++) {
        const p = point(i);
        this.walk[i] =
          open.includes(roomAt(p)?.id) &&
          !walls.some((o) => circleRect(p, 0.46, o)) &&
          !OBSTACLES.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + 0.48)
            ? 1
            : 0;
      }
    }
    this.dist.fill(-1);
    const queue = [];
    for (const p of players) {
      let index = cell(p);
      if (!this.walk[index]) {
        let nearest = Infinity;
        for (let i = 0; i < this.walk.length; i++)
          if (this.walk[i]) {
            const q = point(i),
              d = Math.hypot(p.x - q.x, p.z - q.z);
            if (d < nearest) {
              nearest = d;
              index = i;
            }
          }
      }
      if (this.walk[index] && this.dist[index] === -1) {
        this.dist[index] = 0;
        queue.push(index);
      }
    }
    for (let n = 0; n < queue.length; n++) {
      const index = queue[n];
      for (const next of this.neighbors(index))
        if (this.walk[next] && this.dist[next] === -1) {
          this.dist[next] = this.dist[index] + 1;
          queue.push(next);
        }
    }
  }
  neighbors(i) {
    const x = i % WIDTH,
      z = Math.floor(i / WIDTH);
    return [
      x > 0 ? i - 1 : -1,
      x < WIDTH - 1 ? i + 1 : -1,
      z > 0 ? i - WIDTH : -1,
      z < HEIGHT - 1 ? i + WIDTH : -1,
    ].filter((n) => n >= 0);
  }
  target(p) {
    const i = cell(p);
    let best = i;
    if (this.dist[i] < 0) {
      let d = Infinity;
      for (let j = 0; j < this.dist.length; j++)
        if (this.dist[j] >= 0) {
          const q = point(j),
            n = Math.hypot(q.x - p.x, q.z - p.z);
          if (n < d) {
            d = n;
            best = j;
          }
        }
    }
    for (const n of this.neighbors(best))
      if (this.dist[n] >= 0 && this.dist[n] < this.dist[best]) best = n;
    return this.dist[best] >= 0 ? point(best) : null;
  }
}
