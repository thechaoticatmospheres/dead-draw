import * as T from "three";
import { ENEMIES } from "../../shared/expansion.js";
export function casinoEnemy(assets, kind) {
  const root = new T.Group(),
    visual = assets.prop("enemy-" + kind);
  root.add(visual);
  const pivots = {};
  for (const name of [
    "Head",
    "Body",
    "ArmL",
    "ArmR",
    "LegL",
    "LegR",
    "WheelL",
    "WheelR",
    "CasterL",
    "CasterR",
  ]) {
    const node = visual.getObjectByName(name);
    if (node)
      pivots[name] = {
        node,
        position: node.position.clone(),
        rotation: node.rotation.clone(),
      };
  }
  root.userData = { shared: true, visual, customEnemy: kind, pivots, phase: 0 };
  return root;
}
export function animateCasinoEnemy(root, dt, z, distance) {
  const d = root.userData,
    kind = d.customEnemy;
  const moving = distance > 0.001 && !z.stun;
  d.phase += dt * (kind === "crawler" ? 4.4 : kind === "wheelchair" ? 3 : 5.5);
  const t = d.phase,
    swing = moving ? Math.sin(t) : 0,
    attack = z.attack > 0.65 ? Math.sin(((1 - z.attack) * Math.PI) / 0.35) : 0;
  for (const { node, position, rotation } of Object.values(d.pivots)) {
    node.position.copy(position);
    node.rotation.copy(rotation);
  }
  const p = (name) => d.pivots[name]?.node;
  if (kind === "wheelchair") {
    d.wheelSpin = (d.wheelSpin || 0) - distance / 0.4;
    for (const name of ["WheelL", "WheelR", "CasterL", "CasterR"])
      p(name).rotation.x = d.wheelSpin;
    p("ArmL").rotation.x += swing * 0.22 - attack * 0.55;
    p("ArmR").rotation.x -= swing * 0.22 + attack * 0.55;
    p("Head").rotation.x = 0.08 + Math.sin(t * 0.4) * 0.05;
  } else if (kind === "crawler") {
    for (const [name, sign] of [
      ["ArmL", 1],
      ["ArmR", -1],
    ]) {
      p(name).position.z += swing * 0.14 * sign;
      p(name).position.y += Math.max(0, swing * sign) * 0.06;
    }
    p("Head").rotation.z = Math.sin(t * 0.6) * 0.09;
    p("Head").position.y += attack * 0.09;
    p("LegL").rotation.y = swing * 0.13;
    p("LegR").rotation.y = -swing * 0.13;
    p("Body").rotation.z = swing * 0.035;
  } else {
    p("LegL").rotation.x = swing * 0.32;
    p("LegR").rotation.x = -swing * 0.32;
    p("ArmL").rotation.x += swing * 0.12;
    p("ArmR").rotation.x -= attack * 0.9 + swing * 0.14;
    p("Head").rotation.z = Math.sin(t * 0.5) * 0.06;
    d.visual.position.y = moving ? Math.abs(swing) * 0.025 : 0;
  }
  d.visual.rotation.x = z.stun ? -0.12 : 0;
}
