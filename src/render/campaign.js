import * as T from "three";
import { DEVICES, COVER } from "../../shared/campaign.js";
import { ROOM_SPAWNS } from "../../shared/map.js";
import { label } from "./surfaces.js";
import { STATIONS } from "../../shared/data.js";
export class CampaignScene {
  constructor(scene, assets) {
    this.root = new T.Group();
    scene.add(this.root);
    this.devices = {};
    this.boards = [];
    this.markers = new Map();
    this.dealers = [];
    this.chips = new T.InstancedMesh(
      new T.CylinderGeometry(0.12, 0.12, 0.035, 12),
      new T.MeshStandardMaterial({
        color: 0xdac181,
        metalness: 0.35,
        roughness: 0.4,
      }),
      240,
    );
    this.chips.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.chips.count = 0;
    this.chips.frustumCulled = false;
    this.root.add(this.chips);
    this.chipPose = new T.Object3D();
    this.trapRings = {};
    const wood = new T.MeshStandardMaterial({
        color: 0x72593c,
        roughness: 0.8,
      }),
      metal = new T.MeshStandardMaterial({
        color: 0x29423f,
        metalness: 0.6,
        roughness: 0.4,
      }),
      gold = new T.MeshStandardMaterial({
        color: 0xc4a45d,
        metalness: 0.7,
        roughness: 0.35,
      });
    const box = (w, h, d, x, y, z, m) => {
      const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = true;
      this.root.add(o);
      return o;
    };
    for (const c of COVER) {
      box(c.r * 1.8, c.h, c.r * 1.8, c.x, c.h / 2, c.z, metal);
      box(c.r * 1.82, 0.06, c.r * 1.82, c.x, c.h, c.z, gold);
    }
    for (const d of DEVICES) {
      const group = new T.Group();
      group.position.set(d.x, 0, d.z);
      this.root.add(group);
      const body = new T.Mesh(new T.BoxGeometry(0.6, 1.2, 0.45), metal);
      body.position.y = 0.6;
      group.add(body);
      const panel = new T.Mesh(
        new T.BoxGeometry(0.45, 0.35, 0.04),
        new T.MeshStandardMaterial({
          color: 0x76e8bf,
          emissive: 0x2ca78f,
          emissiveIntensity: 0.7,
        }),
      );
      panel.position.set(0, 1, 0.25);
      group.add(panel);
      const text = label(
        d.name.toUpperCase(),
        "T · CREW & OBJECTIVES",
        "#e7c482",
        2.1,
        0.5,
      );
      text.position.y = 2;
      group.add(text);
      this.devices[d.id] = group;
      if (d.id.startsWith("trap-")) {
        const ring = new T.Mesh(
          new T.RingGeometry(3.6, 4, 48),
          new T.MeshBasicMaterial({
            color: d.id === "trap-jade" ? 0x7edaff : 0xff914d,
            transparent: true,
            opacity: 0.6,
            side: T.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(d.x, 0.05, d.z);
        this.root.add(ring);
        this.trapRings[d.id] = ring;
      }
    }
    for (const station of STATIONS.filter(
      (s) => !["slots", "poker", "keno", "hilo"].includes(s.id),
    )) {
      const dealer = assets.character(false, 1);
      dealer.position.set(station.x, 0, station.z - 0.9);
      dealer.rotation.y = Math.PI;
      dealer.scale.setScalar(0.95);
      this.root.add(dealer);
      this.dealers.push({ station, dealer });
    }
    ROOM_SPAWNS.forEach((s, i) => {
      const boards = [];
      for (let j = 0; j < 3; j++) {
        const b = box(1.45, 0.18, 0.1, s.x, 0.65 + j * 0.45, s.z, wood);
        b.rotation.z = j % 2 ? 0.1 : -0.1;
        boards.push(b);
      }
      this.boards[i] = boards;
    });
  }
  update(state, time, dt) {
    const c = state?.campaign;
    if (!c) {
      this.root.visible = false;
      return;
    }
    this.root.visible = true;
    for (const d of DEVICES) {
      const o = this.devices[d.id];
      o.visible = state.openRooms.includes(d.room);
      o.children[1].material.emissiveIntensity =
        c.traps[d.id]?.until > state.time
          ? 3 + Math.sin(time * 20)
          : c.power
            ? 1
            : 0.25;
      if (this.trapRings[d.id]) {
        this.trapRings[d.id].visible = c.traps[d.id]?.until > state.time;
        this.trapRings[d.id].material.opacity = 0.3 + 0.2 * Math.sin(time * 15);
      }
    }
    for (const { station, dealer } of this.dealers) {
      dealer.visible =
        state.openRooms.includes(station.room) && state.phase === "break";
      if (dealer.visible) dealer.userData.mixer.update(dt);
      const active = state.games[station.id] || state.crewTables?.[station.id];
      const arm = dealer.userData.bones.RightArm;
      if (arm && active) arm.rotation.x = -0.65 + Math.sin(time * 3) * 0.16;
    }
    let chipCount = 0;
    for (const station of STATIONS) {
      const t = state.crewTables?.[station.id],
        solo = state.games[station.id],
        seats = t?.seats || (solo ? [{ cost: solo.cost }] : []);
      if (state.phase !== "break") continue;
      seats.forEach((s, i) => {
        const count = Math.min(5, Math.ceil((s.cost || 0) / 30));
        for (let j = 0; j < count; j++) {
          const pose = this.chipPose;
          pose.position.set(
            station.x + (i - 1.5) * 0.36,
            1.03 + j * 0.039 + Math.sin(time * 2 + i) * 0.008,
            station.z + 0.4,
          );
          pose.rotation.set(0, time * 0.12 + i, 0);
          pose.updateMatrix();
          this.chips.setMatrixAt(chipCount++, pose.matrix);
        }
      });
    }
    this.chips.count = chipCount;
    this.chips.instanceMatrix.needsUpdate = true;
    this.boards.forEach((list, i) =>
      list.forEach((b, j) => (b.visible = j < (c.barricades[i] || 0))),
    );
    const ids = new Set();
    for (const ping of c.pings) {
      ids.add(ping.player);
      let o = this.markers.get(ping.player);
      if (!o) {
        o = new T.Mesh(
          new T.ConeGeometry(0.22, 0.6, 4),
          new T.MeshBasicMaterial({
            color: 0x82ffcd,
            depthTest: false,
            transparent: true,
            opacity: 0.8,
          }),
        );
        o.renderOrder = 50;
        this.root.add(o);
        this.markers.set(ping.player, o);
      }
      o.position.set(ping.x, 2.8 + Math.sin(time * 3) * 0.2, ping.z);
    }
    for (const [id, o] of this.markers)
      if (!ids.has(id)) {
        this.root.remove(o);
        o.geometry.dispose();
        o.material.dispose();
        this.markers.delete(id);
      }
  }
}
