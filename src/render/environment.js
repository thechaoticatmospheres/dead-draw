import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  ROOMS,
  WALLS,
  OUTER_WALLS,
  DOORS,
  ROOM_SPAWNS,
  roomAt,
  doorOpen,
} from "../../shared/map.js";
import { STATIONS, OBSTACLES } from "../../shared/data.js";
import { COVER } from "../../shared/campaign.js";
import { SERVICES } from "../../shared/services.js";
import { surfaces, label } from "./surfaces.js";
function box(root, w, h, d, x, y, z, m) {
  const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  root.add(o);
  return o;
}
function plane(root, w, h, x, y, z, m) {
  const o = new T.Mesh(new T.PlaneGeometry(w, h), m);
  o.rotation.x = -Math.PI / 2;
  o.position.set(x, y, z);
  o.receiveShadow = true;
  root.add(o);
  return o;
}
function batch(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const list = buckets.get(o.material) || [];
    list.push(geo);
    buckets.set(o.material, list);
  });
  group.clear();
  for (const [m, gs] of buckets) {
    const o = new T.Mesh(mergeGeometries(gs), m);
    o.castShadow = true;
    o.receiveShadow = true;
    group.add(o);
  }
}
export class CasinoEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.m = surfaces();
    this.static = new T.Group();
    scene.add(this.static);
    this.ceiling = new T.Group();
    scene.add(this.ceiling);
    this.roomProps = new Map();
    this.doors = {};
    this.stations = {};
    this.build();
  }
  build() {
    const { scene, m } = this,
      g = this.static;
    for (const room of ROOMS) {
      plane(g, 16, 16, room.x, 0, room.z, m.marble);
      const carpet = m.carpet.clone();
      carpet.color.setHex(room.color).lerp(new T.Color(0x624e5e), 0.5);
      plane(g, 11.5, 11.5, room.x, 0.012, room.z, carpet);
      for (const d of [-1, 1]) {
        box(g, 11.6, 0.015, 0.035, room.x, 0.024, room.z + d * 5.8, m.brass);
        box(g, 0.035, 0.015, 11.6, room.x + d * 5.8, 0.024, room.z, m.brass);
      }
      // Deco inlay medallion, flush to the carpet.
      const ring = new T.Mesh(new T.RingGeometry(2.92, 2.97, 96), m.brass);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(room.x, 0.028, room.z);
      g.add(ring);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const inlay = box(
          g,
          0.035,
          0.009,
          0.65,
          room.x + Math.sin(a) * 2.6,
          0.028,
          room.z + Math.cos(a) * 2.6,
          m.brass,
        );
        inlay.rotation.y = a;
      }
      const roof = box(
        this.ceiling,
        15.9,
        0.15,
        15.9,
        room.x,
        5.3,
        room.z,
        m.dark,
      );
      roof.castShadow = false;
      for (const d of [-1, 1]) {
        box(
          this.ceiling,
          12,
          0.16,
          0.2,
          room.x,
          5.13,
          room.z + d * 6,
          m.brass,
        ).castShadow = false;
        box(
          this.ceiling,
          0.2,
          0.16,
          12,
          room.x + d * 6,
          5.13,
          room.z,
          m.brass,
        ).castShadow = false;
      }
      const name = label(
        room.name,
        "THE GILDED PALM · EST. 1978",
        "#e9c88d",
        5.2,
        0.86,
      );
      name.position.set(room.x, 3.95, room.z - 7.73);
      scene.add(name);
      const props = new T.Group();
      scene.add(props);
      this.roomProps.set(room.id, props);
      const light = new T.PointLight(
        room.id === "crown" ? 0xffd798 : 0xffd4a0,
        52,
        17,
        2,
      );
      light.position.set(room.x, 4.4, room.z);
      scene.add(light);
    }
    for (const wall of [...WALLS, ...OUTER_WALLS]) {
      box(g, wall.w, wall.h, wall.d, wall.x, wall.h / 2, wall.z, m.wall);
      const horizontal = wall.w > wall.d,
        length = horizontal ? wall.w : wall.d;
      for (const y of [0.13, 1.25, 3.25, 4.98])
        box(g, wall.w + 0.04, 0.065, wall.d + 0.04, wall.x, y, wall.z, m.brass);
      box(g, wall.w + 0.03, 1.04, wall.d + 0.03, wall.x, 0.69, wall.z, m.wood);
      const n = Math.floor(length / 2);
      for (let i = 0; i < n; i++) {
        const v = -length / 2 + ((i + 0.5) * length) / n;
        const x = wall.x + (horizontal ? v : 0),
          z = wall.z + (horizontal ? 0 : v);
        box(
          g,
          horizontal ? 0.09 : 0.5,
          4.9,
          horizontal ? 0.5 : 0.09,
          x,
          2.48,
          z,
          m.dark,
        );
        box(
          g,
          horizontal ? 0.025 : 0.51,
          4.65,
          horizontal ? 0.51 : 0.025,
          x,
          2.5,
          z,
          m.brass,
        );
      }
    }
    for (const door of DOORS) {
      const root = new T.Group();
      root.position.set(door.x, 0, door.z);
      root.rotation.y = door.w < 1 ? Math.PI / 2 : 0;
      scene.add(root);
      for (const x of [-1.93, 1.93]) {
        box(root, 0.22, 4, 0.55, x, 2, 0, m.dark);
        box(root, 0.045, 3.85, 0.59, x, 1.96, 0, m.brass);
      }
      box(root, 4.1, 0.25, 0.55, 0, 3.9, 0, m.brass);
      box(root, 3.6, 0.08, 0.55, 0, 0.045, 0, m.brass);
      const shutter = new T.Group();
      root.add(shutter);
      box(shutter, 3.6, 3.7, 0.2, 0, 1.85, 0, m.dark);
      for (let y = 0.15; y < 3.7; y += 0.16)
        box(shutter, 3.6, 0.012, 0.22, 0, y, 0, m.brass);
      const room = ROOMS.find((r) => r.id === door.to);
      for (const side of [-1, 1]) {
        const sign = label(
          door.shortcut ? "CROWN SHORTCUT" : room.name,
          door.shortcut
            ? "OPENS FROM CROWN"
            : room.cost + " CHIPS · CREW ACCESS",
          "#e9c387",
          3.15,
          0.83,
        );
        sign.position.set(0, 2.25, side * 0.13);
        sign.rotation.y = side < 0 ? Math.PI : 0;
        shutter.add(sign);
        const lamp = box(
          root,
          0.07,
          2.7,
          0.07,
          1.79,
          1.85,
          side * 0.32,
          m.warm,
        );
      }
      root.userData.shutter = shutter;
      this.doors[door.id] = root;
    }
    for (const e of ROOM_SPAWNS) {
      const r = ROOMS.find((r) => r.id === e.room),
        side = r.z > 0 ? 1 : -1,
        root = new T.Group();
      root.position.set(e.x, 0, e.z + side * 1.75);
      root.rotation.y = side > 0 ? Math.PI : 0;
      scene.add(root);
      box(root, 1.8, 2.7, 0.1, 0, 1.35, 0, m.dark);
      for (const x of [-0.9, 0.9])
        box(root, 0.06, 2.75, 0.15, x, 1.37, 0.02, m.brass);
      box(root, 1.86, 0.06, 0.15, 0, 2.74, 0.02, m.brass);
      const sign = label(
        "SERVICE",
        "AUTHORIZED PERSONNEL",
        "#b87865",
        1.65,
        0.35,
      );
      sign.position.set(0, 2.45, 0.09);
      root.add(sign);
      for (const y of [0.65, 1.15, 1.65]) {
        const plank = box(root, 1.73, 0.16, 0.06, 0, y, 0.1, m.wood);
        plank.rotation.z = 0.08;
      }
      box(root, 0.06, 0.06, 0.03, 0.68, 1.28, 0.16, m.warm);
    }
    batch(g);
  }
  install(assets) {
    this.assets = assets;
    for (const room of ROOMS) {
      const g = this.roomProps.get(room.id),
        chandelier = assets.prop("chandelier");
      chandelier.position.set(room.x, 4.6, room.z);
      g.add(chandelier);
    }
    for (const o of OBSTACLES.slice(
      COVER.length + SERVICES.length + STATIONS.length,
    )) {
      const prop = assets.prop(o.h > 3 ? "column" : "cocktail");
      prop.position.set(o.x, 0, o.z);
      if (o.h > 3) prop.scale.x = prop.scale.z = o.r / 0.78;
      this.roomProps.get(roomAt(o).id).add(prop);
    }
    for (const s of STATIONS) {
      const root = new T.Group();
      root.position.set(s.x, 0, s.z);
      this.roomProps.get(s.room).add(root);
      const prop = assets.prop(s.id);
      root.add(prop);
      const sign = label(
        s.id === "poker"
          ? "VIDEO POKER"
          : {
              letitride: "LET IT RIDE",
              threecard: "THREE CARD POKER",
              sicbo: "SIC BO",
              hilo: "HI-LO",
            }[s.type] || s.type.toUpperCase(),
        s.category + " · " + s.cost + "+ CHIPS",
        "#e7c482",
        s.id === "slots" || s.id === "poker" ? 2.05 : 2.65,
        0.5,
      );
      sign.position.set(0, 3.25, 0);
      root.add(sign);
      const light = new T.PointLight(s.color, 10, 5, 2);
      light.position.set(0, 2.55, 0.5);
      root.add(light);
      const prize = assets.prop(
        s.id === "poker"
          ? "shotgun"
          : s.id === "slots"
            ? "pistol"
            : s.id === "roulette"
              ? "smg"
              : "rifle",
      );
      prize.position.set(0, 2.1, 0);
      prize.visible = false;
      root.add(prize);
      root.userData = { light, prize, prop };
      this.stations[s.id] = root;
      // Seats stay inside the existing table collision footprint.
      if (!["slots", "poker", "keno", "hilo"].includes(s.id)) {
        for (const x of [-0.9, 0.9]) {
          const chair = assets.prop("chair");
          chair.position.set(x, 0, 1.55);
          chair.rotation.y = Math.PI;
          root.add(chair);
        }
      }
      const marker = new T.Mesh(
        new T.RingGeometry(s.r + 0.2, s.r + 0.225, 64),
        new T.MeshBasicMaterial({
          color: s.color,
          transparent: true,
          opacity: 0.22,
        }),
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.y = 0.033;
      root.add(marker);
    }
  }
  update(dt, state, myId, time) {
    this.ceiling.visible = !!state;
    for (const d of DOORS) {
      const shutter = this.doors[d.id].userData.shutter,
        open = doorOpen(d, state?.openRooms || ["atrium"]);
      shutter.position.y +=
        ((open ? 4.1 : 0) - shutter.position.y) * Math.min(1, dt * 5);
      shutter.visible = shutter.position.y < 4;
    }
    for (const [id, g] of this.roomProps)
      g.visible = !state || state.openRooms.includes(id);
    for (const [id, root] of Object.entries(this.stations)) {
      const game = state?.games[id];
      root.userData.light.intensity =
        state?.phase === "combat" ? 4 : game ? 14 + Math.sin(time * 9) * 2 : 9;
      root.userData.prize.visible =
        game?.phase === "result" &&
        game.awards?.some((a) =>
          /gilded|Viper|sovereign|house|dividend|velvet|switch/i.test(a.reward),
        );
      root.userData.prize.rotation.y = time * 0.8;
    }
  }
}
