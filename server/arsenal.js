import { WEAPONS, aimRay, OBSTACLES } from "../shared/data.js";
import { clearPath, barrierDistance } from "../shared/map.js";
import { damageMultiplier } from "../shared/expansion.js";
export const arsenalMethods = {
  weaponDamage(p, gun, z, amount) {
    const damage =
      amount * damageMultiplier(gun) * (1 + (p.perks.power || 0) * 0.1);
    p.hits = (p.hits || 0) + 1;
    p.damageDealt = (p.damageDealt || 0) + Math.min(z.hp, damage);
    z.hp -= damage;
    z.stun = 0.12;
    if (z.hp <= 0) this.killEnemy(z, p, false);
  },
  specialShot(p, gun) {
    const w = WEAPONS[gun.id],
      { origin, dir } = aimRay(p, p.yaw, p.pitch, p.input.aim, this.openRooms);
    const range = w.range,
      ends = [];
    const reachable = (z) =>
      clearPath(p, z, this.openRooms) &&
      !OBSTACLES.some((o) => {
        if (o.h < 1.2) return false;
        const dx = z.x - p.x,
          dz = z.z - p.z,
          l = dx * dx + dz * dz,
          t = ((o.x - p.x) * dx + (o.z - p.z) * dz) / l;
        return (
          t > 0 &&
          t < 1 &&
          Math.hypot(p.x + dx * t - o.x, p.z + dz * t - o.z) < o.r
        );
      });
    const targets = this.zombies
      .filter((z) => {
        const dx = z.x - p.x,
          dz = z.z - p.z,
          d = Math.hypot(dx, dz),
          dot =
            (dx * -Math.sin(p.yaw) + dz * -Math.cos(p.yaw)) / Math.max(0.01, d);
        return (
          d < range &&
          dot > (w.mode === "sword" ? 0.2 : w.mode === "flame" ? 0.8 : 0.92) &&
          reachable(z)
        );
      })
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      );
    if (w.mode === "rocket") {
      const trace = this.fireRay(p, gun, dir, origin, true),
        end = trace.end;
      this.hazards.push({
        id: ++this.serial,
        kind: "rocket",
        x: end.x,
        z: end.z,
        radius: 4,
        damage:
          w.damage * damageMultiplier(gun) * (1 + (p.perks.power || 0) * 0.1),
        player: p.id,
        delay: 0.15,
        life: 0.3,
      });
      ends.push(end);
    } else if (w.mode === "rail") {
      // Trace the same ray repeatedly through pierced enemies; furniture still blocks it.
      const ignored = new Set();
      for (let n = 0; n < 4; n++) {
        const hit = this.fireRay(p, gun, dir, origin, false, ignored);
        ends.push(hit.end);
        if (!hit.target) break;
        ignored.add(hit.target);
      }
    } else if (w.mode === "tesla") {
      let current = targets[0];
      const hit = new Set();
      for (let n = 0; current && n < 4; n++) {
        hit.add(current);
        ends.push({ x: current.x, y: 1, z: current.z });
        this.weaponDamage(p, gun, current, w.damage * (1 - n * 0.12));
        const prev = current;
        current = this.zombies.find(
          (z) =>
            !hit.has(z) &&
            Math.hypot(z.x - prev.x, z.z - prev.z) < 4 &&
            clearPath(prev, z, this.openRooms) &&
            reachable(z),
        );
      }
    } else
      for (const z of targets) {
        this.weaponDamage(p, gun, z, w.damage);
        ends.push({ x: z.x, y: 0.8, z: z.z });
      }
    if (!ends.length)
      ends.push({
        x: p.x - Math.sin(p.yaw) * range,
        y: 1,
        z: p.z - Math.cos(p.yaw) * range,
      });
    this.event("shot", {
      player: p.id,
      weapon: gun.id,
      x: p.x,
      y: 1.4 + (p.height || 0),
      z: p.z,
      end: ends[0],
      ends,
      hit: targets.length > 0,
    });
  },
};
