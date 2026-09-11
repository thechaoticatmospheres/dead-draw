import * as T from "three";
import { WHEEL_PADS, WHEEL_PRIZES } from "../../shared/arsenal.js";
import { label } from "./surfaces.js";
export class PrizeWheelScene {
  constructor(scene) {
    this.pads = WHEEL_PADS.map((p) => {
      const m = new T.Mesh(
        new T.CylinderGeometry(1, 1, 0.24, 32),
        new T.MeshStandardMaterial({
          color: 0x263b3b,
          metalness: 0.8,
          roughness: 0.3,
        }),
      );
      m.position.set(p.x, 0.12, p.z);
      scene.add(m);
      return { p, m };
    });
    this.root = new T.Group();
    scene.add(this.root);
    const gold = new T.MeshStandardMaterial({
      color: 0xe6bd6b,
      metalness: 0.75,
      roughness: 0.3,
    });
    const foot = new T.Mesh(new T.BoxGeometry(0.22, 1.3, 0.25), gold);
    foot.position.y = 0.8;
    this.root.add(foot);
    this.disc = new T.Group();
    this.disc.position.y = 2;
    this.root.add(this.disc);
    const rim = new T.Mesh(new T.TorusGeometry(1.05, 0.07, 8, 48), gold);
    this.disc.add(rim);
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const ctx = c.getContext("2d"),
      n = WHEEL_PRIZES.length;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      ctx.fillStyle = ["#235455", "#762d40", "#b08a43"][i % 3];
      ctx.beginPath();
      ctx.moveTo(512, 512);
      ctx.arc(512, 512, 490, a, b);
      ctx.fill();
      ctx.save();
      ctx.translate(512, 512);
      ctx.rotate((a + b) / 2);
      ctx.fillStyle = "#fff0cd";
      ctx.font = "bold 23px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(
        WHEEL_PRIZES[i].label.split(" · ")[0].toUpperCase(),
        460,
        8,
        320,
      );
      ctx.restore();
    }
    const texture = new T.CanvasTexture(c);
    texture.colorSpace = T.SRGBColorSpace;
    this.disc.add(
      new T.Mesh(
        new T.CircleGeometry(1.02, 64),
        new T.MeshStandardMaterial({
          map: texture,
          side: T.DoubleSide,
          roughness: 0.55,
        }),
      ),
    );
    const hub = new T.Mesh(new T.SphereGeometry(0.14, 12, 8), gold);
    hub.position.z = 0.09;
    this.disc.add(hub);
    const pointer = new T.Mesh(new T.ConeGeometry(0.13, 0.27, 3), gold);
    pointer.position.set(0, 3.03, 0.12);
    pointer.rotation.z = Math.PI;
    this.root.add(pointer);
    const sign = label(
      "THE GRAND PRIZE",
      "WEAPONS & RARE FINDS · EVERY SPIN WINS",
      "#f1cb7c",
      2.8,
      0.55,
    );
    sign.position.set(0, 3.55, 0);
    this.root.add(sign);
  }
  update(dt, state, myId) {
    this.pads.forEach(
      ({ p, m }) => (m.visible = !!state?.openRooms?.includes(p.room)),
    );
    const pad = WHEEL_PADS.find((p) => p.room === state?.prizeWheel?.room);
    this.root.visible = !!pad && state.openRooms.includes(pad.room);
    if (!pad) return;
    this.root.position.set(pad.x, 0, pad.z);
    const p = state.players.find((p) => p.id === myId),
      spin = p?.wheelSpin;
    if (spin) {
      this.disc.rotation.z -= dt * (2 + spin.remaining * 3);
      this.wasSpinning = true;
    } else if (this.wasSpinning && p?.lastWheel) {
      this.disc.rotation.z =
        Math.PI / 2 +
        ((p.lastWheel.prize + 0.5) * Math.PI * 2) / WHEEL_PRIZES.length;
      this.wasSpinning = false;
    }
  }
}
