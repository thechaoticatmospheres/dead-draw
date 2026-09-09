import * as T from "three";
import { SERVICES, canUseService } from "../../shared/services.js";
import { label } from "./surfaces.js";
export class ServiceScene {
  constructor(scene, assets) {
    this.roots = [];
    this.ray = new T.Raycaster();
    for (const s of SERVICES) {
      const r = new T.Group();
      r.position.set(s.x, 0, s.z);
      r.userData.service = s.id;
      r.add(assets.prop(s.id));
      const sign = label(
        s.id === "cashier" ? "SURVIVOR’S CLUB" : "GOLDEN HOUR",
        s.id === "cashier"
          ? "CASHIER · WEAPONS / PERKS · U"
          : "JUKEBOX · CHOOSE THE MUSIC · E",
        "#e7c482",
        s.id === "cashier" ? 3.5 : 2.1,
        0.55,
      );
      sign.position.set(0, s.id === "cashier" ? 3.25 : 2.9, 0.2);
      r.add(sign);
      scene.add(r);
      this.roots.push(r);
      if (s.id === "cashier") {
        this.teller = assets.character(false, 0);
        this.teller.position.set(0, 0, -0.2);
        this.teller.rotation.y = Math.PI;
        r.add(this.teller);
      }
    }
  }
  update(dt, state) {
    this.teller.userData.mixer.update(dt);
    this.roots[1].children[1].material.opacity =
      state?.phase === "combat" ? 0.5 : 1;
  }
  pick(x, y, camera, canvas, p, open) {
    const rect = canvas.getBoundingClientRect();
    this.ray.setFromCamera(
      new T.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        (-(y - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    for (const hit of this.ray.intersectObjects(this.roots, true)) {
      let o = hit.object;
      while (o && !o.userData.service) o = o.parent;
      const s = SERVICES.find((s) => s.id === o?.userData.service);
      if (s && canUseService(p, s, open)) return s;
    }
    return null;
  }
}
