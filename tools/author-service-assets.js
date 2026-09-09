// Original cashier cage and jukebox. Rebuild with node tools/author-service-assets.js.
import * as T from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { writeFile } from "node:fs/promises";
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
};
const mat = (color, metalness = 0, emissive = 0) =>
  new T.MeshStandardMaterial({
    color,
    metalness,
    roughness: 0.4,
    emissive,
    emissiveIntensity: 0.8,
  });
const gold = mat(0xcaa560, 0.8),
  wood = mat(0x201a1f),
  green = mat(0x133d34),
  black = mat(0x081718),
  mint = mat(0x9bf5db, 0.2, 0x3b957c),
  cream = mat(0xefe0b9),
  red = mat(0x872f44);
const mesh = (r, geo, m, x, y, z) => {
  const o = new T.Mesh(geo, m);
  o.position.set(x, y, z);
  r.add(o);
  return o;
};
const box = (r, w, h, d, x, y, z, m) =>
  mesh(r, new T.BoxGeometry(w, h, d), m, x, y, z);
for (const id of ["jukebox", "cashier"]) {
  const r = new T.Group();
  if (id === "jukebox") {
    box(r, 1.35, 1.8, 0.7, 0, 0.9, 0, wood);
    box(r, 1.4, 0.14, 0.8, 0, 0.08, 0, gold);
    mesh(
      r,
      new T.CylinderGeometry(0.68, 0.68, 0.7, 32, 1, false, 0, Math.PI),
      wood,
      0,
      1.8,
      0,
    ).rotation.x = Math.PI / 2;
    mesh(
      r,
      new T.TorusGeometry(0.58, 0.055, 8, 40, Math.PI),
      gold,
      0,
      1.8,
      0.37,
    );
    mesh(
      r,
      new T.TorusGeometry(0.49, 0.026, 6, 40, Math.PI),
      mint,
      0,
      1.8,
      0.4,
    );
    for (const x of [-0.58, 0.58]) {
      box(r, 0.09, 1.65, 0.06, x, 0.97, 0.39, gold);
      box(r, 0.025, 1.57, 0.06, x, 0.97, 0.43, mint);
    }
    box(r, 0.9, 0.72, 0.03, 0, 0.62, 0.37, black);
    for (let x = -0.4; x <= 0.4; x += 0.08)
      box(r, 0.018, 0.68, 0.025, x, 0.62, 0.4, gold);
    box(r, 0.96, 0.5, 0.03, 0, 1.43, 0.38, cream);
    for (let i = 0; i < 5; i++) {
      box(r, 0.66, 0.045, 0.012, 0, 1.61 - i * 0.075, 0.41, green);
      box(
        r,
        0.1,
        0.042,
        0.035,
        0.39,
        1.61 - i * 0.075,
        0.43,
        i % 2 ? red : gold,
      );
    }
    mesh(
      r,
      new T.CylinderGeometry(0.34, 0.34, 0.02, 32),
      black,
      0,
      1.92,
      0.38,
    ).rotation.x = Math.PI / 2;
    mesh(
      r,
      new T.CylinderGeometry(0.085, 0.085, 0.026, 16),
      gold,
      0,
      1.92,
      0.4,
    ).rotation.x = Math.PI / 2;
  } else {
    box(r, 3.2, 1, 0.9, 0, 0.5, 0.2, green);
    box(r, 3.35, 0.12, 1.35, 0, 1.05, 0.15, gold);
    box(r, 3.2, 2.65, 0.12, 0, 1.325, -0.8, wood);
    for (const x of [-1.55, 1.55]) {
      box(r, 0.12, 2.8, 1.7, x, 1.4, 0, wood);
      box(r, 0.055, 2.8, 0.07, x, 1.4, 0.86, gold);
    }
    box(r, 3.35, 0.18, 1.85, 0, 2.8, 0, gold);
    const glass = new T.MeshStandardMaterial({
      color: 0x9ed6d1,
      transparent: true,
      opacity: 0.18,
      roughness: 0.12,
      metalness: 0.1,
      depthWrite: false,
    });
    box(r, 2.95, 1.35, 0.03, 0, 1.98, 0.83, glass);
    for (const x of [-0.96, 0.96])
      box(r, 0.028, 1.5, 0.035, x, 1.95, 0.86, gold);
    box(r, 0.5, 0.018, 0.3, 0, 1.13, 0.72, black);
    box(r, 0.5, 0.03, 0.2, 0, 1.16, 0.56, gold);
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 4; j++)
        mesh(
          r,
          new T.CylinderGeometry(0.095, 0.095, 0.035, 12),
          i % 2 ? red : cream,
          -1.05 + i * 0.16,
          1.13 + j * 0.035,
          0.3,
        );
    box(r, 0.4, 0.28, 0.16, 0.8, 1.27, -0.05, black);
    box(r, 0.32, 0.17, 0.02, 0.8, 1.29, 0.04, mint);
  }
  r.updateMatrixWorld(true);
  const buckets = new Map();
  r.traverse((o) => {
    if (!o.isMesh) return;
    const a = buckets.get(o.material) || [];
    a.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    buckets.set(o.material, a);
  });
  const output = new T.Group();
  for (const [m, g] of buckets) output.add(new T.Mesh(mergeGeometries(g), m));
  const result = await new GLTFExporter().parseAsync(output, { binary: true });
  await writeFile(
    new URL(`../public/assets/models/${id}.glb`, import.meta.url),
    Buffer.from(result),
  );
  console.log(id, Math.round(result.byteLength / 1024) + " KiB");
}
