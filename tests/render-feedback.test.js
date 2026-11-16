import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectPool } from "../src/render/effect-pool.js";

test("seeded visual effects repeat without changing the authoritative arc endpoint", () => {
  const a = new EffectPool(new T.Scene()),
    b = new EffectPool(new T.Scene());
  for (const p of [a, b]) {
    p.setSeed(91);
    p.particle(0, 1, 0, 0xffffff, 0.3);
    p.smoke(0, 1, 0, 0xffffff, 0.5, 0.1);
    p.arc({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, 0xffffff, true);
  }
  assert.deepEqual(
    a.active.map((v) => v.velocity.toArray()),
    b.active.map((v) => v.velocity.toArray()),
  );
  const endpoint = a.active.at(-1).mesh.geometry.attributes.position;
  assert.deepEqual(
    [endpoint.getX(1), endpoint.getY(1), endpoint.getZ(1)],
    [4, 5, 6],
  );
  a.update(2);
  b.update(2);
  const allocated = a.allocated;
  a.flash(0, 1, 0, 0xffeecc);
  a.smoke(0, 1, 0, 0x999999);
  assert.equal(a.active[0].mesh.material.blending, T.AdditiveBlending);
  assert.equal(a.active[1].mesh.material.blending, T.NormalBlending);
  a.update(2);
  assert.equal(a.active.length, 0);
  assert.ok(a.allocated <= allocated + 1);
  a.dispose();
  b.dispose();
});

test("refined casino characters retain articulated pivots and low-profile envelopes", async () => {
  for (const [kind, maximum] of [
    ["dealer", 2],
    ["security", 2],
    ["wheelchair", 1.66],
    ["crawler", 0.82],
  ]) {
    const bytes = await readFile(`public/assets/models/enemy-${kind}.glb`);
    const asset = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    for (const name of ["Head", "Body", "ArmL", "ArmR"])
      assert.ok(asset.scene.getObjectByName(name), `${kind}: ${name}`);
    const bounds = new T.Box3().setFromObject(asset.scene);
    assert.ok(
      bounds.max.y < maximum,
      `${kind} maintains its hit-volume height`,
    );
    assert.ok(bounds.min.y > -0.01, `${kind} feet remain on the floor`);
    let vertices = 0;
    asset.scene.traverse((o) => {
      if (o.isMesh) {
        vertices += o.geometry.attributes.position.count;
        assert.ok(o.geometry.attributes.normal);
        assert.ok(o.geometry.attributes.color);
      }
    });
    assert.ok(vertices < 20000, `${kind}: bounded mesh density`);
  }
});

import { Encounters } from "../src/render/encounters.js";
test("rocket warning has finite transforms when authority omits total duration", () => {
  const scene = new T.Scene(),
    encounters = new Encounters(scene);
  const rocket = {
    id: 1,
    kind: "rocket",
    x: 4,
    z: 3,
    radius: 4,
    delay: 0.15,
    life: 0.3,
  };
  encounters.update({ hazards: [rocket], pickups: [] }, 0);
  encounters.update(
    { hazards: [{ ...rocket, delay: 0.05 }], pickups: [] },
    0.1,
  );
  scene.updateMatrixWorld(true);
  scene.traverse((o) =>
    assert.ok(o.matrixWorld.elements.every(Number.isFinite), o.type),
  );
  encounters.update({ hazards: [], pickups: [] }, 1);
  assert.equal(encounters.hazards.size, 0);
});
