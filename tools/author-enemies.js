// Original articulated casino zombies. One vertex-colored mesh per animated part.
import * as T from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { writeFile } from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, weld, quantize } from "@gltf-transform/functions";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = b;
      this.onloadend?.();
    });
  }
};
const colors = {
  skin: 0x9caa89,
  dark: 0x19242a,
  red: 0x832e40,
  white: 0xe9dfc4,
  gold: 0xd7ac53,
  grey: 0xb3b8b3,
  eyes: 0xeb723d,
  green: 0x345941,
};
const material = new T.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.72,
  metalness: 0.12,
});
function part(parent, name, x = 0, y = 0, z = 0) {
  const p = new T.Group();
  p.name = name;
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}
function shape(p, geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo,
    c = new T.Color(color),
    data = [];
  for (let i = 0; i < g.attributes.position.count; i++)
    data.push(c.r, c.g, c.b);
  g.setAttribute("color", new T.Float32BufferAttribute(data, 3));
  const o = new T.Mesh(g, material);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  p.add(o);
  return o;
}
const box = (p, w, h, d, x, y, z, c, rx = 0, ry = 0, rz = 0) =>
  shape(p, new T.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz);
const cyl = (p, r, h, x, y, z, c, rx = 0, rz = 0) =>
  shape(p, new T.CylinderGeometry(r, r, h, 12), c, x, y, z, rx, 0, rz);
function head(root, y, z, old = false, security = false) {
  const h = part(root, "Head", 0, y, z);
  shape(
    h,
    new RoundedBoxGeometry(0.37, 0.4, 0.34, 2, 0.065),
    old ? 0xaeb49b : colors.skin,
    0,
    0,
    0,
  );
  box(h, 0.39, 0.1, 0.34, 0, 0.2, 0.03, old ? colors.grey : colors.dark);
  if (old) {
    box(h, 0.065, 0.23, 0.29, -0.19, 0.07, 0.02, colors.grey);
    box(h, 0.065, 0.23, 0.29, 0.19, 0.07, 0.02, colors.grey);
    box(h, 0.1, 0.07, 0.025, -0.09, 0.02, -0.18, colors.dark);
    box(h, 0.1, 0.07, 0.025, 0.09, 0.02, -0.18, colors.dark);
  }
  for (const x of [-0.085, 0.085])
    box(h, 0.055, 0.042, 0.016, x, 0.04, -0.181, colors.eyes);
  box(h, 0.15, 0.065, 0.018, 0, -0.1, -0.178, colors.red);
  box(h, 0.025, 0.043, 0.016, 0.037, -0.097, -0.19, colors.white);
  if (security) {
    box(h, 0.44, 0.13, 0.4, 0, 0.23, 0, 0x26364a);
    box(h, 0.43, 0.035, 0.24, 0, 0.19, -0.21, 0x26364a);
    box(h, 0.09, 0.06, 0.02, 0, 0.25, -0.208, colors.gold);
  }
  return h;
}
function bottle(p, x, y, z) {
  cyl(p, 0.065, 0.26, x, y, z, 0x2d6647);
  cyl(p, 0.027, 0.13, x, y + 0.19, z, 0x376d4b);
  cyl(p, 0.03, 0.035, x, y + 0.27, z, colors.gold);
  box(p, 0.085, 0.12, 0.014, x, y, z - 0.065, colors.white);
  box(p, 0.047, 0.04, 0.018, x, y, z - 0.075, colors.red);
}
function arm(root, name, x, y, z, sleeve, holding = false) {
  const a = part(root, name, x, y, z);
  box(a, 0.19, 0.31, 0.2, 0, -0.14, 0, sleeve);
  box(a, 0.16, 0.25, 0.17, 0, -0.37, -0.065, colors.skin);
  box(a, 0.18, 0.14, 0.18, 0, -0.49, -0.13, colors.skin);
  return a;
}
function leg(root, name, x, y, z, color) {
  const l = part(root, name, x, y, z);
  box(l, 0.22, 0.61, 0.23, 0, -0.29, 0, color);
  box(l, 0.24, 0.12, 0.39, 0, -0.63, -0.065, colors.dark);
  return l;
}
for (const kind of ["dealer", "security", "wheelchair", "crawler"]) {
  const root = part(new T.Group(), "Enemy"),
    body = part(root, "Body");
  if (kind === "dealer" || kind === "security") {
    const security = kind === "security",
      jacket = security ? 0x26364a : 0x4a1734;
    box(body, 0.54, 0.59, 0.32, 0, 1.13, 0, jacket);
    box(body, 0.2, 0.5, 0.025, 0, 1.17, -0.175, colors.white);
    box(body, 0.19, 0.08, 0.04, 0, 1.39, -0.2, colors.dark);
    box(body, 0.07, 0.25, 0.04, 0, 1.18, -0.2, colors.dark);
    if (security) {
      box(body, 0.57, 0.39, 0.1, 0, 1.17, -0.22, colors.dark);
      box(body, 0.13, 0.14, 0.025, -0.16, 1.25, -0.29, colors.gold);
      box(body, 0.15, 0.19, 0.08, 0.17, 1.08, -0.3, 0x334a58);
      box(body, 0.17, 0.23, 0.1, 0.24, 0.84, 0, colors.dark);
      box(body, 0.54, 0.08, 0.36, 0, 0.85, 0, colors.dark);
      box(body, 0.1, 0.07, 0.03, 0, 0.85, -0.2, colors.gold);
    } else {
      box(body, 0.09, 0.09, 0.026, -0.15, 1.29, -0.18, colors.gold);
      box(body, 0.09, 0.18, 0.025, 0.18, 0.96, -0.18, colors.red);
    }
    head(root, 1.68, 0, false, security);
    leg(root, "LegL", -0.15, 0.73, 0, colors.dark);
    leg(root, "LegR", 0.15, 0.73, 0, colors.dark);
    const l = arm(root, "ArmL", -0.38, 1.38, 0, jacket),
      r = arm(root, "ArmR", 0.38, 1.38, 0, jacket);
    l.rotation.x = -0.65;
    r.rotation.x = -0.9;
    if (security) {
      cyl(r, 0.045, 0.76, 0, -0.55, -0.18, colors.dark);
      cyl(r, 0.06, 0.12, 0, -0.47, -0.18, colors.grey);
    } else {
      // Craps rake, chip tray and fanned cards all travel with the dealer's hands.
      cyl(r, 0.022, 1.1, 0, -0.56, -0.19, colors.gold);
      box(r, 0.29, 0.045, 0.06, -0.1, -1.1, -0.19, colors.gold);
      box(l, 0.39, 0.045, 0.28, 0, -0.53, -0.16, colors.dark);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
          cyl(
            l,
            0.052,
            0.024,
            -0.12 + i * 0.12,
            -0.49 + j * 0.025,
            -0.19,
            i % 2 ? colors.white : colors.red,
          );
      for (let i = 0; i < 3; i++) {
        box(
          l,
          0.105,
          0.155,
          0.012,
          -0.08 + i * 0.06,
          -0.3,
          -0.27,
          colors.white,
          0,
          0,
          (i - 1) * 0.15,
        );
        box(
          l,
          0.025,
          0.035,
          0.014,
          -0.08 + i * 0.06,
          -0.28,
          -0.28,
          i % 2 ? colors.dark : colors.red,
        );
      }
    }
  } else if (kind === "wheelchair") {
    const chair = part(root, "Chair");
    box(chair, 0.59, 0.08, 0.57, 0, 0.62, 0, colors.dark);
    box(chair, 0.61, 0.5, 0.09, 0, 0.88, 0.3, 0x3b474c);
    for (const x of [-0.34, 0.34]) {
      cyl(chair, 0.025, 0.6, x, 0.58, 0.14, colors.grey);
      box(chair, 0.08, 0.065, 0.59, x, 0.88, -0.02, colors.dark);
      box(chair, 0.09, 0.055, 0.72, x, 0.31, -0.13, colors.grey);
      cyl(chair, 0.025, 0.4, x, 1.01, 0.32, colors.grey);
    }
    for (const x of [-0.43, 0.43]) {
      const w = part(root, x < 0 ? "WheelL" : "WheelR", x, 0.44, 0.12);
      shape(
        w,
        new T.TorusGeometry(0.4, 0.045, 8, 20),
        colors.dark,
        0,
        0,
        0,
        0,
        Math.PI / 2,
      );
      shape(
        w,
        new T.TorusGeometry(0.31, 0.012, 5, 20),
        colors.grey,
        0,
        0,
        0,
        0,
        Math.PI / 2,
      );
      cyl(w, 0.06, 0.08, 0, 0, 0, colors.grey, 0, Math.PI / 2);
      for (let i = 0; i < 6; i++)
        box(w, 0.02, 0.77, 0.015, 0, 0, 0, colors.grey, (i * Math.PI) / 3);
    }
    for (const x of [-0.31, 0.31]) {
      const w = part(root, x < 0 ? "CasterL" : "CasterR", x, 0.13, -0.5);
      cyl(w, 0.12, 0.07, 0, 0, 0, colors.dark, 0, Math.PI / 2);
    }
    box(body, 0.46, 0.5, 0.29, 0, 0.99, 0, 0x766146);
    box(body, 0.13, 0.43, 0.026, 0, 1, -0.16, colors.white);
    head(root, 1.36, -0.07, true);
    arm(root, "ArmL", -0.32, 1.17, 0, 0x766146).rotation.x = -0.95;
    arm(root, "ArmR", 0.32, 1.17, 0, 0x766146).rotation.x = -0.8;
    for (const x of [-0.16, 0.16]) {
      box(body, 0.22, 0.19, 0.43, x, 0.66, -0.25, 0x6b6554);
      box(body, 0.19, 0.35, 0.2, x, 0.43, -0.43, 0x6b6554);
      box(body, 0.22, 0.12, 0.3, x, 0.23, -0.48, colors.dark);
      box(chair, 0.25, 0.04, 0.34, x, 0.15, -0.5, colors.grey);
    }
  } else {
    box(body, 0.5, 0.27, 0.64, 0, 0.35, 0, colors.red);
    box(body, 0.14, 0.04, 0.4, 0, 0.49, -0.05, colors.white);
    box(body, 0.065, 0.035, 0.29, 0.025, 0.52, -0.16, colors.dark, 0, 0.2);
    head(root, 0.55, -0.53);
    for (const [name, x] of [
      ["LegL", -0.16],
      ["LegR", 0.16],
    ]) {
      const l = part(root, name, x, 0.27, 0.31);
      box(l, 0.2, 0.19, 0.57, 0, 0, 0.25, 0x514b52);
      box(l, 0.21, 0.17, 0.27, 0, -0.055, 0.6, colors.dark);
    }
    for (const [name, x] of [
      ["ArmL", -0.36],
      ["ArmR", 0.36],
    ]) {
      const a = part(root, name, x, 0.34, -0.21);
      box(a, 0.17, 0.17, 0.28, 0, 0, -0.1, colors.red);
      box(a, 0.15, 0.17, 0.34, 0, -0.1, -0.33, colors.skin);
      box(a, 0.19, 0.11, 0.2, 0, -0.2, -0.49, colors.skin);
      if (name === "ArmR") bottle(a, 0, -0.04, -0.51);
    }
  }
  // Merge the static geometry inside each pivot; retain pivot nodes for animation.
  const groups = [];
  root.traverse((o) => {
    if (o.isGroup) groups.push(o);
  });
  for (const group of groups) {
    const meshes = group.children.filter((o) => o.isMesh);
    if (!meshes.length) continue;
    const gs = meshes.map((o) => {
      o.updateMatrix();
      return o.geometry.clone().applyMatrix4(o.matrix);
    });
    meshes.forEach((o) => group.remove(o));
    group.add(new T.Mesh(mergeGeometries(gs), material));
  }
  const raw = await new GLTFExporter().parseAsync(root, { binary: true });
  const document = await io.readBinary(new Uint8Array(raw));
  await document.transform(dedup(), weld(), quantize());
  const glb = await io.writeBinary(document);
  await writeFile(
    new URL(`../public/assets/models/enemy-${kind}.glb`, import.meta.url),
    Buffer.from(glb),
  );
  console.log(kind, Math.round(glb.byteLength / 1024) + " KiB");
}
