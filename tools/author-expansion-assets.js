// Original, reproducible casino props. No external images or runtime authoring dependencies.
import * as T from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { writeFile } from "node:fs/promises";
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};
const material = (color, metalness = 0, emissive = 0) =>
  new T.MeshStandardMaterial({
    color,
    metalness,
    roughness: metalness ? 0.32 : 0.75,
    emissive,
    emissiveIntensity: 0.5,
  });
const gold = material(0xcda65c, 0.8),
  dark = material(0x152426, 0.3),
  ivory = material(0xf3e9d2),
  red = material(0xc33b55),
  blue = material(0x5dbed4, 0.2, 0x286675);
function mesh(root, geo, m, x, y, z, rx = 0) {
  const o = new T.Mesh(geo, m);
  o.position.set(x, y, z);
  o.rotation.x = rx;
  root.add(o);
  return o;
}
const box = (r, w, h, d, x, y, z, m) =>
  mesh(r, new T.BoxGeometry(w, h, d), m, x, y, z);
const cylinder = (r, rad, h, x, y, z, m) =>
  mesh(r, new T.CylinderGeometry(rad, rad, h, 20), m, x, y, z);
function card(r, x, y, z, rank = 1) {
  box(r, 0.24, 0.012, 0.34, x, y, z, ivory);
  for (let i = 0; i < rank; i++)
    box(
      r,
      0.035,
      0.014,
      0.035,
      x + (i % 2) * 0.07 - 0.035,
      y + 0.01,
      z + Math.floor(i / 2) * 0.07 - 0.09,
      red,
    );
}
function ring(r, x, z) {
  mesh(
    r,
    new T.TorusGeometry(0.23, 0.012, 4, 24),
    gold,
    x,
    1.057,
    z,
    Math.PI / 2,
  );
}
function chips(r, x, z) {
  for (let j = 0; j < 4; j++)
    cylinder(r, 0.075, 0.025, x, 1.06 + j * 0.03, z, j % 2 ? ivory : red);
}
function table(felt) {
  const r = new T.Group();
  box(r, 2.9, 0.15, 1.65, 0, 0.94, 0, dark);
  box(r, 2.82, 0.05, 1.57, 0, 1.025, 0, gold);
  box(r, 2.7, 0.012, 1.45, 0, 1.057, 0, felt);
  for (const x of [-1.1, 1.1]) {
    box(r, 0.16, 0.85, 0.16, x, 0.46, 0, gold);
    box(r, 0.75, 0.07, 0.8, x, 0.06, 0, dark);
  }
  box(r, 0.55, 0.04, 0.2, 0, 1.09, -0.59, dark);
  for (const x of [-1, 1]) chips(r, x, -0.4);
  return r;
}
function cabinet(felt) {
  const r = new T.Group();
  box(r, 1.12, 1.1, 0.75, 0, 0.55, 0, dark);
  box(r, 1.2, 0.07, 0.85, 0, 1.1, 0.05, gold);
  box(r, 1.1, 1.18, 0.28, 0, 1.73, -0.23, dark);
  box(r, 1.16, 0.06, 0.32, 0, 2.34, -0.23, gold);
  box(r, 0.98, 0.94, 0.03, 0, 1.73, -0.07, felt);
  box(r, 1, 0.05, 0.35, 0, 1.16, 0.22, dark);
  for (const x of [-0.52, 0.52])
    box(r, 0.025, 1.12, 0.035, x, 1.74, -0.06, blue);
  cylinder(r, 0.09, 0.04, 0.34, 1.2, 0.25, red);
  box(r, 0.23, 0.016, 0.08, -0.3, 1.2, 0.26, gold);
  return r;
}
const colors = {
  war: 0x204e68,
  threecard: 0x455254,
  sicbo: 0x195747,
  keno: 0x391e55,
  hilo: 0x402b32,
  letitride: 0x415042,
};
for (const [id, color] of Object.entries(colors)) {
  const felt = material(color),
    r = ["keno", "hilo"].includes(id) ? cabinet(felt) : table(felt);
  if (id === "war") {
    for (const x of [-0.6, 0.6]) {
      ring(r, x, 0.1);
      card(r, x, 1.075, 0.05, 3);
    }
    box(r, 0.025, 0.014, 1, 0, 1.075, 0, gold);
  }
  if (id === "threecard") {
    for (let i = 0; i < 3; i++) {
      ring(r, (i - 1) * 0.65, 0.32);
      card(r, (i - 1) * 0.3, 1.075, -0.2, i + 1);
    }
  }
  if (id === "letitride") {
    for (let i = 0; i < 3; i++) ring(r, (i - 1) * 0.65, 0.4);
    for (let i = 0; i < 5; i++)
      card(r, (i - 2) * 0.33, 1.075, -0.2, (i % 3) + 1);
  }
  if (id === "sicbo") {
    cylinder(r, 0.43, 0.065, 0, 1.1, -0.2, gold);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 0.23;
      box(r, 0.17, 0.17, 0.17, x, 1.22, -0.2, ivory);
      for (let n = 0; n < i + 1; n++)
        cylinder(r, 0.017, 0.004, x - 0.045 + n * 0.04, 1.307, -0.2, red);
    }
    for (let i = 0; i < 6; i++) {
      box(r, 0.32, 0.012, 0.24, (i - 2.5) * 0.39, 1.074, 0.4, gold);
      box(r, 0.29, 0.015, 0.21, (i - 2.5) * 0.39, 1.08, 0.4, felt);
    }
    mesh(
      r,
      new T.TorusGeometry(0.43, 0.025, 5, 32),
      gold,
      0,
      1.48,
      -0.2,
      Math.PI / 2,
    );
    for (const x of [-0.43, 0.43])
      box(r, 0.025, 0.35, 0.025, x, 1.3, -0.2, gold);
  }
  if (id === "keno")
    for (let i = 0; i < 80; i++)
      box(
        r,
        0.065,
        0.055,
        0.017,
        ((i % 10) - 4.5) * 0.086,
        2.05 - Math.floor(i / 10) * 0.09,
        -0.042,
        i % 9 === 0 ? gold : blue,
      );
  if (id === "hilo") {
    for (const x of [-0.24, 0.24]) {
      box(r, 0.32, 0.5, 0.02, x, 1.83, -0.04, ivory);
      mesh(
        r,
        new T.ConeGeometry(0.1, 0.16, 3),
        x < 0 ? red : dark,
        x,
        1.84,
        -0.015,
      ).rotation.z = x < 0 ? 0 : Math.PI;
    }
    box(r, 0.7, 0.1, 0.02, 0, 1.4, -0.04, gold);
  }
  r.updateMatrixWorld(true);
  const buckets = new Map();
  r.traverse((o) => {
    if (!o.isMesh) return;
    const list = buckets.get(o.material) || [];
    list.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    buckets.set(o.material, list);
  });
  const output = new T.Group();
  for (const [m, geos] of buckets)
    output.add(new T.Mesh(mergeGeometries(geos), m));
  const glb = await new GLTFExporter().parseAsync(output, { binary: true });
  await writeFile(
    new URL(`../public/assets/models/${id}.glb`, import.meta.url),
    Buffer.from(glb),
  );
  console.log(`${id}: ${(glb.byteLength / 1024).toFixed(1)} KiB`);
}
