// Original DEAD DRAW models, authored in meters, +Z front, origin at floor center.
import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const mat = (color, metalness = 0, roughness = 0.5) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
const gold = mat("#c49a50", 0.8, 0.25),
  dark = mat("#101716", 0.35, 0.3),
  wood = mat("#351e1b", 0.2, 0.35),
  leather = mat("#251c21", 0, 0.7),
  cream = mat("#f5ecd3", 0, 0.55),
  felt = mat("#144d3d", 0, 0.97),
  red = mat("#842c43", 0, 0.65);
const group = () => new T.Group();
function mesh(root, geo, m, x = 0, y = 0, z = 0) {
  const o = new T.Mesh(geo, m);
  o.position.set(x, y, z);
  root.add(o);
  return o;
}
function box(root, w, h, d, x, y, z, m, r = 0.035) {
  return mesh(
    root,
    new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)),
    m,
    x,
    y,
    z,
  );
}
function cylinder(root, r, h, x, y, z, m, top = r) {
  return mesh(root, new T.CylinderGeometry(top, r, h, 32), m, x, y, z);
}
function ring(root, r, t, x, y, z, m) {
  const o = mesh(root, new T.TorusGeometry(r, t, 8, 48), m, x, y, z);
  o.rotation.x = Math.PI / 2;
  return o;
}
function ball(root, r, x, y, z, m) {
  return mesh(root, new T.SphereGeometry(r, 12, 8), m, x, y, z);
}
function texture(draw, w = 1024, h = 512) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
function screen(
  root,
  w,
  h,
  x,
  y,
  z,
  text,
  accent = "#e6bc73",
  sub = "GILDED PALM",
) {
  const map = texture((c, W, H) => {
    c.fillStyle = "#091a1b";
    c.fillRect(0, 0, W, H);
    c.strokeStyle = accent;
    c.lineWidth = 4;
    c.strokeRect(12, 12, W - 24, H - 24);
    c.fillStyle = accent;
    c.textAlign = "center";
    c.font = "600 100px Georgia";
    c.fillText(text, W / 2, H * 0.55, W * 0.88);
    c.font = "28px sans-serif";
    c.fillText(sub, W / 2, H * 0.8, W * 0.9);
  });
  const m = new T.MeshStandardMaterial({
    map,
    emissive: 0xffffff,
    emissiveMap: map,
    emissiveIntensity: 0.8,
    roughness: 0.4,
  });
  return mesh(root, new T.PlaneGeometry(w, h), m, x, y, z);
}
function chips(root, x, y, z, color = "#bb3149", count = 5) {
  const m = mat(color, 0.05, 0.5);
  for (let i = 0; i < count; i++) {
    cylinder(root, 0.075, 0.018, x, y + i * 0.022, z, m);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2;
      box(
        root,
        0.027,
        0.019,
        0.016,
        x + Math.sin(a) * 0.065,
        y + i * 0.022,
        z + Math.cos(a) * 0.065,
        cream,
        0.003,
      );
    }
  }
}
function card(root, x, y, z, rank = "A", suit = "♠", rotation = 0) {
  const t = texture(
    (c, w, h) => {
      c.fillStyle = "#fff4d7";
      c.fillRect(0, 0, w, h);
      c.fillStyle = ["♥", "♦"].includes(suit) ? "#952f42" : "#1b2924";
      c.font = "90px Georgia";
      c.fillText(rank, 18, 100);
      c.font = "170px Georgia";
      c.fillText(suit, 42, 290);
    },
    256,
    384,
  );
  const o = mesh(
    root,
    new T.PlaneGeometry(0.18, 0.27),
    new T.MeshStandardMaterial({ map: t, roughness: 0.85 }),
    x,
    y,
    z,
  );
  o.rotation.set(-Math.PI / 2, 0, rotation);
}
function pedestal(root) {
  cylinder(root, 0.57, 0.11, 0, 0.09, 0, gold);
  cylinder(root, 0.4, 0.86, 0, 0.56, 0, wood, 0.28);
  ring(root, 0.43, 0.025, 0, 0.15, 0, gold);
}
function cabinet(poker = false) {
  const g = group(),
    accent = mat(poker ? "#568ac4" : "#ca527d", 0.4, 0.3);
  accent.emissive.set(poker ? "#2c76d4" : "#e63377");
  accent.emissiveIntensity = 0.6;
  box(g, 1.25, 0.15, 0.92, 0, 0.1, 0, gold);
  box(g, 1.16, 1.15, 0.8, 0, 0.72, 0, wood, 0.09);
  box(g, 1.1, 0.87, 0.08, 0, 0.75, 0.42, dark);
  for (const x of [-0.48, 0.48]) box(g, 0.025, 0.8, 0.025, x, 0.8, 0.475, gold);
  box(g, 1.33, 0.15, 1.03, 0, 1.34, 0.08, gold, 0.06);
  box(g, 1.2, 0.13, 0.92, 0, 1.44, 0.07, dark);
  box(g, 1.2, 1.08, 0.56, 0, 2.0, -0.12, dark, 0.12);
  box(g, 1.3, 0.12, 0.62, 0, 2.55, -0.12, gold);
  for (const x of [-0.6, 0.6])
    box(g, 0.04, 0.98, 0.08, x, 2.01, 0.19, accent, 0.02);
  box(g, 1.17, 0.47, 0.4, 0, 2.75, -0.1, wood, 0.08);
  screen(
    g,
    1.08,
    0.39,
    0,
    2.76,
    0.111,
    poker ? "DEAD DRAW" : "AFTERLIFE",
    poker ? "#8cc9ff" : "#ffc6da",
    poker ? "JACKS OR BETTER" : "LUCKY 7 · LUCKY YOU",
  );
  if (poker) {
    screen(
      g,
      1.02,
      0.65,
      0,
      2.03,
      0.17,
      "A ♠ K ♥ Q",
      "#b6d8f5",
      "HOLD · DRAW · WIN",
    );
  } else {
    box(g, 1.07, 0.61, 0.05, 0, 2.03, 0.17, gold);
    for (let i = -1; i <= 1; i++) {
      box(g, 0.3, 0.51, 0.055, i * 0.335, 2.03, 0.205, cream);
      const tex = texture(
        (c, w, h) => {
          c.fillStyle = "#fff4d8";
          c.fillRect(0, 0, w, h);
          c.fillStyle = "#b52647";
          c.textAlign = "center";
          c.textBaseline = "middle";
          c.font = "bold 350px Georgia";
          c.fillText(i === 0 ? "7" : "♦", w / 2, h / 2);
        },
        512,
        512,
      );
      mesh(
        g,
        new T.PlaneGeometry(0.27, 0.45),
        new T.MeshStandardMaterial({ map: tex, roughness: 0.45 }),
        i * 0.335,
        2.035,
        0.24,
      );
    }
  }
  for (let i = 0; i < 5; i++)
    cylinder(
      g,
      0.045,
      0.027,
      -0.4 + i * 0.16,
      1.525,
      0.35,
      i === 4 ? accent : gold,
    );
  box(g, 0.32, 0.025, 0.05, 0.32, 1.52, 0.14, gold);
  box(g, 0.36, 0.17, 0.04, 0, 0.6, 0.48, gold);
  box(g, 0.31, 0.1, 0.045, 0, 0.62, 0.51, dark);
  cylinder(g, 0.035, 0.58, 0.72, 1.78, 0, gold);
  ball(g, 0.095, 0.72, 2.1, 0, accent);
  return g;
}
function table(type) {
  const g = group();
  pedestal(g);
  const craps = type === "craps";
  const rail = box(
    g,
    craps ? 3.8 : 3.5,
    0.24,
    craps ? 2.3 : 2.5,
    0,
    1.06,
    0,
    wood,
    0.22,
  );
  box(
    g,
    craps ? 3.65 : 3.38,
    0.13,
    craps ? 2.15 : 2.37,
    0,
    1.21,
    0,
    gold,
    0.15,
  );
  box(
    g,
    craps ? 3.55 : 3.27,
    0.16,
    craps ? 2.05 : 2.26,
    0,
    1.28,
    0,
    leather,
    0.22,
  );
  box(g, craps ? 3.25 : 2.99, 0.05, craps ? 1.74 : 1.95, 0, 1.35, 0, felt, 0.2);
  const map = texture((c, w, h) => {
    c.fillStyle = "#164534";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#ccbc85";
    c.lineWidth = 3;
    c.strokeRect(30, 30, w - 60, h - 60);
    c.fillStyle = "#d7c392";
    c.textAlign = "center";
    c.font = "36px Georgia";
    c.fillText(
      type === "blackjack"
        ? "BLACKJACK PAYS 3 TO 2"
        : type === "baccarat"
          ? "PLAYER       TIE       BANKER"
          : type === "craps"
            ? "4      5      SIX      8      NINE      10"
            : "1  2  3  4  5  6",
      w / 2,
      125,
    );
    c.font = "22px Georgia";
    c.fillText(
      type === "craps" ? "DON’T PASS BAR 12" : "THE GILDED PALM",
      w / 2,
      210,
    );
    c.font = "40px Georgia";
    c.fillText(
      type === "craps"
        ? "PASS LINE"
        : type === "roulette"
          ? "RED   ◆   BLACK"
          : "♠       ♥       ♣       ♦",
      w / 2,
      360,
    );
    for (let i = 0; i < 5; i++) c.strokeRect(140 + i * 153, 270, 115, 135);
  });
  const f = mesh(
    g,
    new T.PlaneGeometry(craps ? 3.12 : 2.85, craps ? 1.63 : 1.84),
    new T.MeshStandardMaterial({ map, roughness: 0.95 }),
    0,
    1.381,
    0,
  );
  f.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 5; i++)
    chips(
      g,
      -1 + i * 0.28,
      1.41,
      -0.64,
      ["#af314b", "#225788", "#26312f"][i % 3],
      4 + (i % 3),
    );
  if (type === "roulette") {
    const rotor = group();
    rotor.name = "rotor";
    g.add(rotor);
    rotor.position.set(-0.65, 1.4, 0);
    cylinder(rotor, 0.81, 0.11, 0, 0, 0, wood);
    ring(rotor, 0.78, 0.045, 0, 0.1, 0, gold);
    cylinder(rotor, 0.7, 0.03, 0, 0.085, 0, dark);
    const order = [
      0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
      24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
    ];
    for (let i = 0; i < 37; i++) {
      const a = (i / 37) * Math.PI * 2;
      const o = box(
        rotor,
        0.095,
        0.018,
        0.15,
        Math.sin(a) * 0.59,
        0.12,
        Math.cos(a) * 0.59,
        i === 0 ? felt : i % 2 ? red : dark,
        0.004,
      );
      o.rotation.y = a;
    }
    cylinder(rotor, 0.37, 0.12, 0, 0.17, 0, gold, 0.04);
    cylinder(rotor, 0.04, 0.3, 0, 0.32, 0, gold);
    ball(rotor, 0.068, 0, 0.51, 0, gold);
    const b = ball(g, 0.038, 0.1, 1.56, 0.18, cream);
    b.name = "rouletteBall";
  } else if (craps) {
    for (let i = 0; i < 2; i++) {
      const d = box(
        g,
        0.19,
        0.19,
        0.19,
        -0.15 + i * 0.4,
        1.51,
        0.2,
        cream,
        0.025,
      );
      d.rotation.y = 0.35 + i;
      for (const [x, z] of [
        [-0.05, -0.05],
        [0.05, 0.05],
        [0, 0],
      ])
        cylinder(g, 0.012, 0.006, -0.15 + i * 0.4 + x, 1.608, 0.2 + z, dark);
    }
    for (const x of [-1.78, 1.78])
      box(g, 0.13, 0.25, 2.08, x, 1.43, 0, leather, 0.055);
  } else {
    card(g, -0.25, 1.414, 0.36, "A", "♠", -0.1);
    card(g, 0, 1.416, 0.35, "K", "♥", 0.1);
    card(g, 0.5, 1.416, -0.28, "9", "♦");
  }
  return g;
}
function chair() {
  const g = group();
  cylinder(g, 0.38, 0.05, 0, 0.04, 0, dark);
  cylinder(g, 0.075, 0.58, 0, 0.34, 0, gold);
  ring(g, 0.26, 0.023, 0, 0.34, 0, gold);
  cylinder(g, 0.36, 0.14, 0, 0.72, 0, red);
  ring(g, 0.35, 0.012, 0, 0.79, 0, gold);
  box(g, 0.65, 0.55, 0.13, 0, 1.01, -0.28, red, 0.08);
  for (const x of [-0.23, 0.23]) cylinder(g, 0.02, 0.38, x, 0.77, -0.28, gold);
  return g;
}
function chandelier() {
  const g = group();
  for (let tier = 0; tier < 3; tier++) {
    const r = 1.3 - tier * 0.35,
      y = 0.2 - tier * 0.32;
    ring(g, r, 0.03, 0, y, 0, gold);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const m = mat("#f9daa0", 0.25, 0.2);
      m.emissive.set("#ffcc80");
      m.emissiveIntensity = 2;
      box(
        g,
        0.05,
        0.32,
        0.08,
        Math.sin(a) * r,
        y - 0.18,
        Math.cos(a) * r,
        m,
        0.015,
      );
    }
  }
  cylinder(g, 0.035, 1, 0, 0.7, 0, gold);
  return g;
}
function column() {
  const g = group();
  cylinder(g, 0.77, 0.14, 0, 0.07, 0, gold);
  cylinder(g, 0.62, 3.25, 0, 1.75, 0, dark);
  cylinder(g, 0.78, 0.15, 0, 3.5, 0, gold);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    cylinder(
      g,
      0.014,
      3.17,
      Math.sin(a) * 0.632,
      1.73,
      Math.cos(a) * 0.632,
      gold,
    );
  }
  ring(g, 0.68, 0.028, 0, 0.23, 0, gold);
  ring(g, 0.68, 0.028, 0, 3.38, 0, gold);
  return g;
}
function cocktail() {
  const g = group();
  cylinder(g, 0.44, 0.1, 0, 0.08, 0, gold);
  cylinder(g, 0.12, 0.85, 0, 0.52, 0, dark);
  cylinder(g, 1.04, 0.12, 0, 1.04, 0, wood);
  ring(g, 1.03, 0.025, 0, 1.09, 0, gold);
  cylinder(g, 0.035, 0.18, 0.25, 1.19, 0.1, gold);
  cylinder(g, 0.09, 0.06, 0.25, 1.31, 0.1, cream, 0.065);
  chips(g, -0.2, 1.12, 0, "#295562", 7);
  card(g, 0, 1.111, 0.3);
  return g;
}
function weapon(type) {
  const g = group(),
    steel = mat("#29353b", 0.8, 0.24),
    grip = mat("#3c2923", 0, 0.8),
    long = type !== "pistol";
  box(g, 0.13, 0.17, long ? 0.65 : 0.35, 0, 0, -0.2, steel, 0.025);
  box(g, 0.11, 0.25, 0.14, 0, -0.18, 0.01, grip, 0.025).rotation.x = -0.25;
  const barrel = cylinder(
    g,
    type === "shotgun" ? 0.046 : 0.028,
    long ? 0.6 : 0.16,
    0,
    0.035,
    long ? -0.67 : -0.44,
    steel,
  );
  barrel.rotation.x = Math.PI / 2;
  if (long) {
    box(g, 0.1, 0.16, 0.38, 0, -0.035, 0.26, grip, 0.03);
    box(g, 0.14, 0.09, 0.3, 0, -0.08, -0.45, type === "shotgun" ? wood : steel);
    if (type !== "shotgun")
      box(g, 0.09, 0.24, 0.15, 0, -0.19, -0.22, steel).rotation.x = 0.1;
  }
  box(g, 0.055, 0.04, 0.065, 0, 0.11, -0.34, gold, 0.007);
  box(g, 0.05, 0.04, 0.05, 0, 0.11, 0.025, gold, 0.007);
  return g;
}
// Collapse static components sharing a material; named moving pieces remain separate.
function batch(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map(),
    dynamic = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === "rouletteBall" || o.parent.name === "rotor") {
      dynamic.push(o);
      return;
    }
    const geo = o.geometry.index
      ? o.geometry.toNonIndexed()
      : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    const list = buckets.get(o.material) || [];
    list.push(geo);
    buckets.set(o.material, list);
  });
  const result = group();
  for (const [m, geos] of buckets) {
    const out = new T.Mesh(mergeGeometries(geos), m);
    result.add(out);
  }
  for (const o of dynamic) {
    const out = o.clone();
    out.applyMatrix4(o.parent.matrixWorld);
    result.add(out);
  }
  return result;
}
export function makeProps() {
  return {
    slots: batch(cabinet()),
    poker: batch(cabinet(true)),
    roulette: batch(table("roulette")),
    blackjack: batch(table("blackjack")),
    craps: batch(table("craps")),
    baccarat: batch(table("baccarat")),
    chair: batch(chair()),
    chandelier: batch(chandelier()),
    column: batch(column()),
    cocktail: batch(cocktail()),
    pistol: batch(weapon("pistol")),
    smg: batch(weapon("smg")),
    rifle: batch(weapon("rifle")),
    shotgun: batch(weapon("shotgun")),
  };
}
