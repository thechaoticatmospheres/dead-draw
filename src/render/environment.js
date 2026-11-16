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
import { WHEEL_PADS } from "../../shared/arsenal.js";
import { SERVICES } from "../../shared/services.js";
import { surfaces, label } from "./surfaces.js";
import { dressStaticProp } from "./physical-materials.js";
import { ROOM_PALETTES, roomArchitecture, wallDetails, chandelierDetail, stationDetails, stationSignFrame } from "./environment-detail.js";
import { batchRigid, freezeLocalMatrices } from "./static-batch.js";
import { bakeGeometrySignature } from "./baked-lighting.js";
function box(root, w, h, d, x, y, z, m) {
  const geometry = new T.BoxGeometry(w, h, d);
  // Keep wall veneer grain and wallpaper at a physical scale; a 14 m partition
  // must not stretch one cabinet-sized texture across its entire length.
  if(m.name === "Tobacco walnut lacquer" || m.name === "Woven champagne wallcovering") {
    const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
    const scale=m.name === "Tobacco walnut lacquer" ? 1.5 : .25;
    for(let i=0;i<p.count;i++) {
      const u=Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i);
      const v=Math.abs(n.getY(i))>.5?p.getZ(i):p.getY(i);
      uv.setXY(i,u*scale,v*scale);
    }
  }
  const o = new T.Mesh(geometry, m);
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
  // Group by indexing too: bevelled trim and flat shell geometry have different
  // index layouts. Never discard geometry when an otherwise valid merge fails.
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material) || o.material.transparent) return;
    const key = `${o.material.uuid}:${!!o.geometry.index}:${Object.keys(o.geometry.attributes).sort().join()}`;
    if(!buckets.has(key)) buckets.set(key, {m:o.material, gs:[]});
    buckets.get(key).gs.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
  });
  group.clear();
  for (const {m, gs} of buckets.values()) {
    const geo=mergeGeometries(gs);
    if(!geo) throw new Error(`Static geometry merge failed for ${m.name}`);
    const o = new T.Mesh(geo, m);
    o.name = `Casino shell / ${m.name}`;
    o.castShadow = true; o.receiveShadow = true;
    group.add(o); gs.forEach(g=>g.dispose());
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
    this.roomLights = new Map();
    this.serviceEntrances = [];
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
      carpet.color.setHex(ROOM_PALETTES[room.id]);
      carpet.name = `Woven Deco wool / ${room.id}`;
      plane(g, 11.5, 11.5, room.x, 0.012, room.z, carpet);
      for (const d of [-1, 1]) {
        box(g, 11.6, 0.015, 0.035, room.x, 0.024, room.z + d * 5.8, m.brass);
        box(g, 0.035, 0.015, 11.6, room.x + d * 5.8, 0.024, room.z, m.brass);
      }
      roomArchitecture(room, g, this.ceiling, m);
      // Deco inlay medallion, flush to the carpet.
      const ring = new T.Mesh(new T.RingGeometry(2.92, 2.97, 96), m.rugInlay);
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
          m.rugInlay,
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
        4.6,
        0.55,
      );
      name.position.set(room.x, 4.6, room.z - 7.73);
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
      light.name = `${room.id}-chandelier-light`;
      light.userData.room = room.id;
      this.roomLights.set(room.id, light);
    }
    for (const wall of [...WALLS, ...OUTER_WALLS]) {
      wallDetails(wall, g, m);
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
      shutter.userData.bakeExclude = true;
      root.add(shutter);
      box(shutter, 3.6, 3.7, 0.2, 0, 1.85, 0, m.shutter);
      for (let y = 0.15; y < 3.7; y += 0.24)
        box(shutter, 3.6, 0.055, 0.235, 0, y, 0, m.dark);
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
      batchRigid(root);
      batchRigid(shutter);
      // Only rigid leaves are frozen: the shutter keeps its independent lift transform.
      for (const o of [...root.children, ...shutter.children])
        if (o.isMesh) {
          o.updateMatrix();
          o.matrixAutoUpdate = false;
        }
      root.userData.shutter = shutter;
      this.doors[door.id] = root;
    }
    for (const e of ROOM_SPAWNS) {
      const r = ROOMS.find((r) => r.id === e.room),
        side = r.z > 0 ? 1 : -1,
        root = new T.Group();
      root.name = `Service entrance / ${e.room}`;
      this.serviceEntrances.push(root);
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
      batchRigid(root);
      freezeLocalMatrices(root);
    }
    batch(g);
    batchRigid(this.ceiling);
    freezeLocalMatrices(g);
    freezeLocalMatrices(this.ceiling);
  }
  install(assets) {
    this.assets = assets;
    for (const room of ROOMS) {
      const g = this.roomProps.get(room.id),
        chandelier = chandelierDetail(room, this.m);
      batchRigid(chandelier, true);
      freezeLocalMatrices(chandelier);
      g.add(chandelier);
    }
    for (const o of OBSTACLES.slice(
      WHEEL_PADS.length + COVER.length + SERVICES.length + STATIONS.length,
    )) {
      const prop = dressStaticProp(assets.prop(o.h > 3 ? "column" : "cocktail"), this.m);
      prop.position.set(o.x, 0, o.z);
      if (o.h > 3) prop.scale.x = prop.scale.z = o.r / 0.78;
      this.roomProps.get(roomAt(o).id).add(prop);
    }
    for (const s of STATIONS) {
      const root = new T.Group();
      root.position.set(s.x, 0, s.z);
      this.roomProps.get(s.room).add(root);
      const prop = dressStaticProp(assets.prop(s.id), this.m);
      if(s.id === 'slots') prop.traverse(piece => {
        if(!piece.isMesh || !['mesh_5','mesh_6','mesh_7','mesh_8'].includes(piece.name)) return;
        // Translucent printed reels are illuminated inside the cabinet.
        piece.material = piece.material.clone();
        piece.material.name = 'Backlit ivory slot reels';
        piece.material.emissive.setHex(0xffe6ba);
        piece.material.emissiveIntensity = .85;
      });
      root.add(prop);
      stationDetails(s, root, this.m);
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
      stationSignFrame(s, root, this.m);
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
      prize.userData.bakeExclude = true;
      root.add(prize);
      root.userData = { light, prize, prop };
      this.stations[s.id] = root;
      // Seats stay inside the existing table collision footprint.
      if (!["slots", "poker", "keno", "hilo"].includes(s.id)) {
        for (const x of [-0.9, 0.9]) {
          const chair = dressStaticProp(assets.prop("chair"), this.m);
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
      batchRigid(root);
      for(const piece of root.children) if(piece.isMesh) {piece.updateMatrix();piece.matrixAutoUpdate=false;}
    }
  }
  collectBakeMeshes() {
    const meshes=[], seen=new Set();
    const addRoot=(root)=>root.traverse(o=>{
      if(!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.material.transparent) return;
      for(let ancestor=o;ancestor;ancestor=ancestor.parent) if(ancestor.userData.bakeExclude) return;
      if(seen.has(o)) return;
      seen.add(o); meshes.push(o);
    });
    addRoot(this.static);addRoot(this.ceiling);
    for(const root of this.roomProps.values())addRoot(root);
    for(const root of this.serviceEntrances)addRoot(root);
    for(const root of Object.values(this.doors))addRoot(root);
    for(const root of this.bakeExtras || [])addRoot(root);
    return meshes;
  }
  exportBakeScene() {
    this.scene.updateMatrixWorld(true);
    const meshes=[], lights=[];
    const mapAverages=new Map();
    for(const [bakeId,o] of this.collectBakeMeshes().entries()) {
      const geometry=o.geometry, material=o.material;
      const position=geometry.attributes.position, positions=[], point=new T.Vector3();
      // glTF may use interleaved, normalized integer attributes. Transform in
      // floating point; writing world metres back into an Int16 buffer wraps it.
      for(let i=0;i<position.count;i++) {
        point.fromBufferAttribute(position,i).applyMatrix4(o.matrixWorld);
        positions.push(point.x,point.y,point.z);
      }
      const color=material.color?.clone() || new T.Color(.2,.2,.2);
      if(material.map?.image) {
        if(!mapAverages.has(material.map)) {
          const canvas=document.createElement('canvas');canvas.width=canvas.height=32;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});
          ctx.drawImage(material.map.image,0,0,32,32);
          const pixels=ctx.getImageData(0,0,32,32).data, average=new T.Color(0,0,0), sample=new T.Color();
          for(let i=0;i<pixels.length;i+=4) {
            sample.setRGB(pixels[i]/255,pixels[i+1]/255,pixels[i+2]/255,material.map.colorSpace);
            average.add(sample);
          }
          average.multiplyScalar(1/1024);mapAverages.set(material.map,average);
        }
        color.multiply(mapAverages.get(material.map));
      }
      meshes.push({bakeId,geometrySignature:bakeGeometrySignature(o),name:o.name || material.name || "static", positions,
        indices:geometry.index ? Array.from(geometry.index.array):null,
        material:{name:material.name,standard:!!material.isMeshStandardMaterial,color:color.toArray(),metalness:material.metalness || 0,
          roughness:material.roughness ?? 1,emissive:material.emissive?.toArray(),emissiveIntensity:material.emissiveIntensity || 0}});
    }
    this.scene.traverse(o=>{if(o.isPointLight){const p=o.getWorldPosition(new T.Vector3());lights.push({name:o.name,position:p.toArray(),color:o.color.toArray(),intensity:o.intensity,distance:o.distance});}});
    return {units:"metres",up:"Y",rooms:ROOMS.map(({id,x,z})=>({id,x,z})),meshes,lights};
  }
  update(dt, state, myId, time) {
    this.ceiling.visible = true;
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
