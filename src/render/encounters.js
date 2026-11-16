import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ENEMIES } from "../../shared/expansion.js";
export class Encounters {
  constructor(scene) {
    this.scene = scene;
    this.hazards = new Map();
    this.pickups = new Map();
    this.labels = new Map();
    this.materials = new Map();
    this.ring = new T.RingGeometry(0.93, 1, 48);
    this.disc = new T.CircleGeometry(1, 48);
    this.box = new T.BoxGeometry(1, 1, 1);
    this.sphere = new T.SphereGeometry(0.14, 10, 8);
    this.crown = new T.CylinderGeometry(0.245, 0.27, 0.23, 32);
    this.hatBrim = new T.CylinderGeometry(0.32, 0.32, 0.028, 32);
    this.tailoring = new RoundedBoxGeometry(0.68, 0.5, 0.34, 2, 0.05);
    this.lapel = new RoundedBoxGeometry(0.085, 0.35, 0.024, 1, 0.006);
    this.button = new T.SphereGeometry(0.018, 8, 6);
    this.velvet = new T.MeshStandardMaterial({
      color: 0x332b2e,
      roughness: 0.9,
      metalness: 0,
    });
    this.ivory = new T.MeshStandardMaterial({
      color: 0xbcae8a,
      roughness: 0.88,
      metalness: 0,
    });
    this.satin = new T.MeshStandardMaterial({
      color: 0x151c1b,
      roughness: 0.48,
      metalness: 0,
    });
    this.barGeometry = new T.PlaneGeometry(1, 0.07);
    this.gold = new T.MeshStandardMaterial({
      color: 0xe6bc6b,
      metalness: 0.85,
      roughness: 0.3,
    });
    this.armor = new T.MeshStandardMaterial({
      color: 0x293e3e,
      metalness: 0.7,
      roughness: 0.5,
    });
    this.barBg = new T.MeshBasicMaterial({ color: 0x151814, depthTest: false });
    this.barFill = new T.MeshBasicMaterial({
      color: 0xf4c789,
      depthTest: false,
    });
  }
  label(text, color = "#f1d899") {
    const key = text + color;
    if (!this.labels.has(key)) {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 80;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#061511b0";
      ctx.fillRect(0, 0, 512, 80);
      ctx.font = "600 35px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(text, 256, 40);
      const texture = new T.CanvasTexture(c);
      texture.colorSpace = T.SRGBColorSpace;
      this.labels.set(
        key,
        new T.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        }),
      );
    }
    const sprite = new T.Sprite(this.labels.get(key));
    sprite.scale.set(1.8, 0.28, 1);
    return sprite;
  }
  decorate(actor, z) {
    if (actor.userData.encounter) return;
    const stats = ENEMIES[z.kind] || ENEMIES.walker;
    actor.scale.setScalar(stats.scale);
    actor.userData.visual.traverse((o) => {
      if (!o.isMesh || actor.userData.customEnemy) return;
      const tint = (m) => {
        const key = m.uuid + z.kind;
        if (!this.materials.has(key)) {
          const next = m.clone();
          next.color.lerp(new T.Color(stats.color), 0.22);
          this.materials.set(key, next);
        }
        return this.materials.get(key);
      };
      o.material = Array.isArray(o.material)
        ? o.material.map(tint)
        : tint(o.material);
    });
    if (["brute", "boss"].includes(z.kind)) {
      // Tailored waistcoats and a battered dinner hat read as casino staff/patrons,
      // with mass carried by the original body scale instead of floating armour blocks.
      const vest = new T.Mesh(
        this.tailoring,
        z.kind === "boss" ? this.ivory : this.velvet,
      );
      vest.position.set(0, 1.1, 0);
      actor.add(vest);
      for (const sign of [-1, 1]) {
        const lapel = new T.Mesh(this.lapel, this.satin);
        lapel.position.set(sign * 0.14, 1.23, -0.181);
        lapel.rotation.z = sign * 0.3;
        actor.add(lapel);
      }
      for (const y of [1.01, 1.09, 1.17]) {
        const button = new T.Mesh(this.button, this.gold);
        button.position.set(0, y, -0.184);
        actor.add(button);
      }
      if (z.kind === "boss") {
        const crown = new T.Mesh(this.crown, this.satin),
          brim = new T.Mesh(this.hatBrim, this.satin);
        crown.position.y = 1.88;
        brim.position.y = 1.77;
        actor.add(crown, brim);
        const band = new T.Mesh(this.hatBrim, this.gold);
        band.scale.set(0.79, 1.6, 0.79);
        band.position.y = 1.81;
        actor.add(band);
      }
    }
    if (z.kind === "spitter") {
      const tank = new T.Mesh(
        new T.SphereGeometry(0.19, 8, 6),
        new T.MeshStandardMaterial({
          color: 0x73e05f,
          emissive: 0x338020,
          emissiveIntensity: 1.2,
          roughness: 0.3,
        }),
      );
      tank.position.set(0, 1.25, 0.27);
      actor.add(tank);
      actor.userData.disposables = [tank];
    }
    const name = this.label(
      stats.name.toUpperCase(),
      `#${stats.color.toString(16).padStart(6, "0")}`,
    );
    name.position.y = stats.labelY || 2.02;
    actor.add(name);
    const bars = new T.Group(),
      bg = new T.Mesh(this.barGeometry, this.barBg),
      fill = new T.Mesh(this.barGeometry, this.barFill);
    bars.add(bg, fill);
    fill.position.z = 0.002;
    bars.position.y = (stats.labelY || 2.02) - 0.19;
    actor.add(bars);
    actor.userData.encounter = { bars, fill, name };
  }
  actor(actor, z, camera) {
    this.decorate(actor, z);
    const { bars, fill, name } = actor.userData.encounter;
    bars.quaternion.copy(actor.quaternion).invert().multiply(camera.quaternion);
    const ratio = Math.max(0, Math.min(1, z.hp / (z.maxHp || z.hp)));
    fill.scale.x = ratio;
    fill.position.x = -(1 - ratio) / 2;
    const distance = camera.position.distanceTo(actor.position);
    // Identification appears near the threat; distant floating text must not bury the room.
    bars.visible = distance < 18 && (z.kind !== "walker" || ratio < 1);
    name.visible =
      z.kind !== "walker" && distance < (z.kind === "boss" ? 24 : 10);
  }
  makeHazard(h) {
    const group = new T.Group(),
      color =
        h.kind === "rocket"
          ? 0xffbb79
          : h.kind === "grenade"
            ? 0x9fd8ef
            : h.kind === "slam"
              ? 0xffb65e
              : 0x9eef70;
    const ring = new T.Mesh(
      this.ring,
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    const disc = new T.Mesh(
      this.disc,
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.13,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = disc.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(h.radius);
    disc.scale.setScalar(h.radius);
    group.add(disc, ring);
    group.position.set(h.x, 0.055, h.z);
    if (h.kind === "grenade") {
      const bomb = new T.Mesh(this.sphere, this.gold);
      group.add(bomb);
      group.userData.bomb = bomb;
    }
    group.userData = { ...group.userData, ring, disc };
    this.scene.add(group);
    return group;
  }
  update(state, time) {
    const seen = new Set();
    for (const h of state?.hazards || []) {
      seen.add(h.id);
      let mesh = this.hazards.get(h.id);
      if (!mesh) {
        mesh = this.makeHazard(h);
        this.hazards.set(h.id, mesh);
      }
      const { ring, disc, bomb } = mesh.userData,
        // Rockets have a short authoritative delay but no `total` field.
        // Keep every transform finite without changing explosion timing.
        progress = Math.max(
          0,
          Math.min(
            1,
            1 - (h.delay || 0) / (h.total || (h.kind === "rocket" ? 0.15 : 1)),
          ),
        );
      ring.material.opacity =
        h.delay > 0 ? 0.55 + Math.sin(time * 16) * 0.2 : 1;
      disc.material.opacity =
        h.delay > 0 ? 0.06 + progress * 0.16 : 0.32 + Math.sin(time * 8) * 0.07;
      disc.scale.setScalar(h.radius * (h.delay > 0 ? 0.2 + 0.8 * progress : 1));
      if (bomb)
        bomb.position.set(
          (h.fromX - h.x) * (1 - progress),
          0.15 + Math.sin(progress * Math.PI) * 2.8,
          (h.fromZ - h.z) * (1 - progress),
        );
    }
    for (const [id, obj] of this.hazards)
      if (!seen.has(id)) {
        obj.userData.ring.material.dispose();
        obj.userData.disc.material.dispose();
        this.scene.remove(obj);
        this.hazards.delete(id);
      }
    const alive = new Set();
    for (const p of state?.pickups || []) {
      alive.add(p.id);
      let root = this.pickups.get(p.id);
      if (!root) {
        root = new T.Group();
        const box = new T.Mesh(
          this.box,
          p.kind === "jackpot" ? this.gold : this.armor,
        );
        box.scale.set(0.5, 0.38, 0.38);
        root.add(box);
        const label = this.label(
          p.kind === "ammo"
            ? "+ AMMO"
            : p.kind === "medkit"
              ? "+ HEALTH"
              : "BOSS CACHE",
          p.kind === "medkit" ? "#a4f3c6" : "#f3d083",
        );
        label.position.y = 0.5;
        root.add(label);
        this.scene.add(root);
        this.pickups.set(p.id, root);
      }
      root.position.set(p.x, 0.36 + Math.sin(time * 3 + p.id) * 0.08, p.z);
      root.children[0].rotation.y = time;
    }
    for (const [id, obj] of this.pickups)
      if (!alive.has(id)) {
        this.scene.remove(obj);
        this.pickups.delete(id);
      }
  }
}
