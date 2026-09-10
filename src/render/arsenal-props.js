import * as T from "three";
// Original lightweight geometry: shared prototypes are cloned by Assets.
export function arsenalProp(id) {
  const root = new T.Group(),
    materials = new Map();
  const mat = (c) => {
    if (!materials.has(c))
      materials.set(
        c,
        new T.MeshStandardMaterial({
          color: c,
          roughness: 0.4,
          metalness: 0.65,
        }),
      );
    return materials.get(c);
  };
  const add = (g, c, x = 0, y = 0, z = 0, rx = 0) => {
    const m = new T.Mesh(g, mat(c));
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    root.add(m);
    return m;
  };
  const box = (w, h, d, x, y, z, c) =>
    add(new T.BoxGeometry(w, h, d), c, x, y, z);
  const tube = (r, l, x, y, z, c) =>
    add(new T.CylinderGeometry(r, r, l, 12), c, x, y, z, Math.PI / 2);
  const gold = 0xd6ad58,
    dark = 0x243338;
  if (id === "goose") {
    const pivot = (name, x, y, z) => {
      const p = new T.Group();
      p.name = name;
      p.position.set(x, y, z);
      root.add(p);
      return p;
    };
    const ellipsoid = (parent, x, y, z, sx, sy, sz, c) => {
      const m = new T.Mesh(new T.SphereGeometry(1, 12, 8), mat(c));
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      parent.add(m);
      return m;
    };
    ellipsoid(pivot("Body", 0, 0.48, 0), 0, 0, 0, 0.34, 0.27, 0.5, 0xf0e8ce);
    const head = pivot("Head", 0, 0.9, -0.37);
    ellipsoid(head, 0, -0.14, 0.04, 0.12, 0.3, 0.13, 0xf0e8ce);
    ellipsoid(head, 0, 0, -0.04, 0.16, 0.16, 0.18, 0xf0e8ce);
    ellipsoid(head, 0, -0.03, -0.25, 0.115, 0.06, 0.18, 0xeaa645);
    for (const x of [-0.12, 0.12])
      ellipsoid(head, x, 0.03, -0.14, 0.03, 0.035, 0.035, 0xdb4339);
    const hat = new T.Mesh(
      new T.CylinderGeometry(0.19, 0.19, 0.13, 10),
      mat(dark),
    );
    hat.position.y = 0.18;
    head.add(hat);
    for (const [n, x] of [
      ["ArmL", -0.32],
      ["ArmR", 0.32],
    ])
      ellipsoid(pivot(n, x, 0.51, 0), 0, 0, 0.04, 0.1, 0.16, 0.38, 0xc8c1ac);
    for (const [n, x] of [
      ["LegL", -0.15],
      ["LegR", 0.15],
    ])
      ellipsoid(
        pivot(n, x, 0.2, 0.04),
        0,
        -0.12,
        -0.08,
        0.14,
        0.05,
        0.22,
        0xeaa645,
      );
    box(0.16, 0.1, 0.04, 0, 0.63, -0.43, 0x992d43);
    return root;
  }
  if (id === "sword") {
    box(0.075, 0.035, 0.9, 0, 0.015, -0.6, 0xd8e7e7);
    box(0.045, 0.05, 0.78, 0, 0.015, -0.55, 0xf5e5a7);
    box(0.33, 0.06, 0.06, 0, 0, -0.12, gold);
    box(0.06, 0.06, 0.22, 0, 0, 0.015, 0x642b3a);
    tube(0.075, 0.035, 0, 0, 0.14, gold);
  } else {
    box(0.16, 0.19, 0.34, 0, 0, -0.12, dark);
    box(0.07, 0.2, 0.1, 0, -0.15, 0, 0x512f32);
    box(0.12, 0.1, 0.22, 0, 0, 0.15, gold);
    if (id === "crossbow") {
      box(0.85, 0.065, 0.09, 0, 0.02, -0.45, gold);
      box(0.03, 0.03, 0.65, 0, 0.09, -0.35, 0xb4d6cf);
      for (const x of [-0.4, 0.4]) box(0.04, 0.06, 0.22, x, 0.015, -0.38, dark);
      tube(0.035, 0.5, 0, 0.11, -0.34, 0xc9d9ca);
    }
    if (id === "rpg") {
      tube(0.14, 0.95, 0, 0.05, -0.32, 0x466044);
      tube(0.19, 0.2, 0, 0.05, 0.25, gold);
      add(
        new T.ConeGeometry(0.17, 0.34, 12),
        0xb8be91,
        0,
        0.05,
        -0.95,
        Math.PI / 2,
      );
      box(0.03, 0.15, 0.04, 0, 0.2, -0.55, dark);
    }
    if (id === "flamethrower") {
      tube(0.09, 0.7, 0, 0, -0.55, dark);
      tube(0.14, 0.27, -0.2, -0.05, -0.12, 0xa74228);
      tube(0.14, 0.27, 0.2, -0.05, -0.12, 0xa74228);
      tube(0.13, 0.12, 0, 0, -0.9, gold);
    }
    if (id === "minigun") {
      const rotor = new T.Group();
      rotor.name = "Barrels";
      root.add(rotor);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3,
          m = tube(
            0.037,
            0.85,
            Math.cos(a) * 0.105,
            Math.sin(a) * 0.105,
            -0.6,
            0x80918d,
          );
        root.remove(m);
        rotor.add(m);
      }
      tube(0.18, 0.12, 0, 0, -0.85, gold);
      tube(0.21, 0.25, 0, 0, -0.15, dark);
      box(0.33, 0.25, 0.24, 0, -0.22, -0.17, gold);
    }
    if (id === "railgun") {
      for (const x of [-0.105, 0.105]) {
        box(0.075, 0.11, 0.88, x, 0, -0.55, dark);
        box(0.02, 0.045, 0.8, x, 0.07, -0.55, 0x63e6ed);
      }
      tube(0.08, 0.15, 0, 0, -0.18, gold);
    }
    if (id === "tesla") {
      tube(0.075, 0.65, 0, 0, -0.5, dark);
      for (let i = 0; i < 5; i++)
        tube(0.15, 0.035, 0, 0, -0.25 - i * 0.11, 0xa096e8);
      add(new T.SphereGeometry(0.105, 12, 8), 0xc9b4ff, 0, 0, -0.85);
    }
  }
  return root;
}
