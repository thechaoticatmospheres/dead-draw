import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { modelBytes } from "../src/render/model-bytes.js";
import * as T from "three";
import { batchRigid } from "../src/render/static-batch.js";
import { EffectPool, ChipBatch } from "../src/render/effect-pool.js";
import { World } from "../src/render/world.js";
import { textValue, styleValue } from "../src/dom-values.js";
import {
  StateEncoder,
  StateDecoder,
  prepareStateFrame,
} from "../shared/state-stream.js";
import { Game } from "../server/game.js";
import { Navigation } from "../server/navigation.js";
test("model downloads decode raw gzip and automatically decoded HTTP responses identically", async () => {
  const original = Buffer.from(
    "glTF exact geometry, normals and texture bytes",
  );
  assert.deepEqual(
    Buffer.from(await modelBytes(new Response(gzipSync(original)))),
    original,
  );
  assert.deepEqual(
    Buffer.from(await modelBytes(new Response(original))),
    original,
  );
  await assert.rejects(
    modelBytes(new Response("missing", { status: 404 })),
    /unavailable/,
  );
  await assert.rejects(
    modelBytes(new Response(Uint8Array.from([31, 139, 0, 0]))),
  );
});
import {
  ROOMS,
  DOORS,
  WALLS,
  OUTER_WALLS,
  barriers,
  doorOpen,
} from "../shared/map.js";

test("state patches reproduce legacy JSON exactly and retain previous snapshots", () => {
  const tx = new StateEncoder(),
    rx = new StateDecoder();
  const g = new Game("DELTA", () => 0.4);
  g.addPlayer("a", "A");
  g.addPlayer("b", "B");
  g.restart();
  let previous, previousJSON;
  for (let i = 0; i < 350; i++) {
    if (i === 5)
      g.players.a.guns.push({ id: "courtesy", ammo: 0, reserve: 1, power: 1 });
    if (i === 7) delete g.players.a.guns[0].power;
    if (i === 10) g.players.a.guns.pop();
    if (i === 80) g.removePlayer("b");
    g.action("a", {
      type: "input",
      input: { forward: 1, yaw: i * 0.02, seq: i },
    });
    g.update(1 / 30);
    if (i % 7 === 0) g.event("notice", { text: "one effect" });
    const expected = JSON.parse(
      JSON.stringify({ type: "state", ...g.snapshot("a", false) }),
    );
    const actual = rx.decode(JSON.parse(tx.encode(expected)));
    assert.deepEqual(actual, expected);
    if (previous)
      assert.equal(
        JSON.stringify(previous),
        previousJSON,
        "decoder never mutates previous state",
      );
    previous = actual;
    previousJSON = JSON.stringify(actual);
    g.events.length = 0;
  }
});

test("patch sequence gaps request resync; legacy states and full resets remain compatible", () => {
  const tx = new StateEncoder(),
    rx = new StateDecoder();
  const state = {
    players: [{ id: "a", inventory: Array(100).fill("preserved") }],
    time: 1,
    events: [],
  };
  rx.decode(JSON.parse(tx.encode(state)));
  state.time = 2;
  tx.encode(state);
  state.time = 3;
  assert.equal(rx.decode(JSON.parse(tx.encode(state))), null);
  assert.ok(rx.needsResync);
  tx.reset();
  const wire = JSON.parse(tx.encode(state));
  assert.equal(wire.type, "state-v2");
  assert.equal(rx.decode(wire).time, 3);
  assert.equal(rx.needsResync, false);
  const legacy = { type: "state", time: 4 };
  assert.equal(rx.decode(legacy), legacy);
});

test("shared room encoding isolates hands and sends a full state after a skipped broadcast", () => {
  const g = new Game("SHARED", () => 0.4);
  g.addPlayer("a", "A");
  g.addPlayer("b", "B");
  g.restart();
  g.games = {
    slots: {
      station: "slots",
      player: "a",
      phase: "result",
      secretMarker: "ONLY_A",
      duration: 1,
      remaining: 0,
    },
  };
  const tx = [new StateEncoder(), new StateEncoder()],
    rx = [new StateDecoder(), new StateDecoder()];
  let frame;
  for (let i = 0; i < 12; i++) {
    g.update(1 / 30);
    g.event("notice", { text: "visible " + i });
    const common = g.snapshot("a", false);
    frame = prepareStateFrame(common, frame);
    for (const [n, id] of ["a", "b"].entries()) {
      if (n === 1 && i === 5) continue;
      const expected = g.snapshot(id, false, common),
        wire = tx[n].encode(expected, expected.events, frame);
      if (n === 1) {
        assert.ok(!wire.includes("ONLY_A"));
        if (i === 6) assert.equal(JSON.parse(wire).type, "state-v2");
      }
      assert.deepEqual(
        rx[n].decode(JSON.parse(wire)),
        JSON.parse(JSON.stringify({ type: "state", ...expected })),
      );
    }
    g.events.length = 0;
  }
});

test("unchanged inventories are absent from compact frames and private hands remain private", () => {
  const tx = new StateEncoder(),
    g = new Game("PRIVATE", () => 0.4);
  g.addPlayer("a", "A");
  g.addPlayer("b", "B");
  g.restart();
  g.games = {
    a: {
      station: "slots",
      player: "a",
      phase: "playing",
      duration: 5,
      remaining: 4,
      startedAt: 1,
      secretMarker: "PLAYER_A_ONLY",
      stops: [1, 2, 3],
    },
    b: {
      station: "slots",
      player: "b",
      phase: "playing",
      duration: 5,
      remaining: 4,
      startedAt: 2,
      secretMarker: "PLAYER_B_ONLY",
      stops: [3, 2, 1],
    },
  };
  const common = g.snapshot("a", false),
    b = g.snapshot("b", false, common);
  assert.ok(!JSON.stringify(b).includes("PLAYER_A_ONLY"));
  assert.ok(!JSON.stringify(b).includes('"stops"'));
  const full = tx.encode({
    ...b,
    inventory: Array(100).fill("STATIC_INVENTORY"),
  });
  const delta = tx.encode({
    ...b,
    inventory: Array(100).fill("STATIC_INVENTORY"),
    time: 2,
  });
  assert.ok(!delta.includes("STATIC_INVENTORY"));
  assert.ok(delta.length < full.length / 4);
});

test("rigid batches preserve transformed bounds, material and shadow distinctions", () => {
  const parent = new T.Group(),
    root = new T.Group();
  parent.position.set(10, 2, -4);
  parent.rotation.y = 0.4;
  parent.add(root);
  root.position.set(2, 0, 3);
  const material = new T.MeshStandardMaterial();
  for (let i = 0; i < 5; i++) {
    const m = new T.Mesh(new T.BoxGeometry(1, 2, 3), material);
    m.position.x = i * 2;
    m.castShadow = i < 4;
    root.add(m);
  }
  const glass = new T.Mesh(
    new T.BoxGeometry(),
    new T.MeshBasicMaterial({ transparent: true }),
  );
  root.add(glass);
  parent.updateMatrixWorld(true);
  const before = new T.Box3().setFromObject(root, true);
  batchRigid(root);
  const after = new T.Box3().setFromObject(root, true);
  assert.ok(before.min.distanceTo(after.min) < 1e-5);
  assert.ok(before.max.distanceTo(after.max) < 1e-5);
  assert.equal(root.children.length, 3);
  assert.equal(glass.parent, root);
  assert.equal(root.children.filter((m) => m.castShadow).length, 1);
});

test("combat pools retain effects and reuse graphics allocations without a visual-count cap", () => {
  const pool = new EffectPool(new T.Scene());
  for (let i = 0; i < 150; i++) pool.particle(1, 2, 3, 0xff0000, 0.5);
  pool.tracer({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, 0xffffff);
  pool.update(0.01);
  assert.equal(pool.active.length, 151);
  assert.equal(pool.active[0].mesh.material.opacity, 0.98);
  const allocated = pool.allocated;
  pool.update(1);
  assert.equal(pool.active.length, 0);
  for (let i = 0; i < 150; i++) pool.particle(5, 6, 7, 0x00ff00, 0.5);
  pool.tracer({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }, 0xff0000);
  assert.equal(pool.allocated, allocated);
  assert.equal(pool.active[0].mesh.position.x, 5);
  pool.dispose();
  assert.equal(pool.scene.children.length, 0);
});

test("chip batching grows without losing currency visuals and resets bounds", () => {
  const chips = new ChipBatch(new T.Scene(), 2),
    data = Array.from({ length: 150 }, (_, i) => ({
      id: i,
      x: i,
      z: -i,
      value: i % 2 ? 5 : 1,
    }));
  chips.update(data, 2);
  assert.equal(chips.mesh.count, 150);
  assert.ok(chips.capacity >= 150);
  const matrix = new T.Matrix4();
  chips.mesh.getMatrixAt(149, matrix);
  assert.equal(matrix.elements[12], 149);
  chips.update([], 3);
  assert.equal(chips.mesh.count, 0);
});

test("actor cleanup releases owned decorations and final attachments, preserving shared assets", () => {
  const world = { scene: new T.Scene() },
    actor = new T.Group();
  world.scene.add(actor);
  const own = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial()),
    shared = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  actor.add(own, shared);
  let released = 0,
    sharedReleased = 0;
  own.geometry.addEventListener("dispose", () => released++);
  own.material.addEventListener("dispose", () => released++);
  shared.geometry.addEventListener("dispose", () => sharedReleased++);
  actor.userData = { shared: true, attachmentMeshes: [own] };
  World.prototype.dispose.call(world, actor);
  assert.equal(released, 2);
  assert.equal(sharedReleased, 0);
  assert.equal(world.scene.children.length, 0);
});

test("collision caches match uncached barriers for every room combination", () => {
  for (let mask = 0; mask < 1 << ROOMS.length; mask++) {
    const open = ROOMS.filter((_, i) => mask & (1 << i)).map((r) => r.id);
    const expected = [
      ...WALLS,
      ...OUTER_WALLS,
      ...DOORS.filter((d) => !doorOpen(d, open)).map((d) => ({ ...d, h: 3.8 })),
    ];
    assert.deepEqual(barriers(open), expected);
  }
});

test("navigation cached fields match fresh fields across targets, downed crew and door changes", () => {
  const nav = new Navigation();
  for (const open of [
    ["atrium"],
    ROOMS.slice(0, 3).map((r) => r.id),
    ROOMS.map((r) => r.id),
    ["atrium"],
  ])
    for (const players of [
      [{ x: 0, z: 10 }],
      [{ x: 0.1, z: 10.1 }],
      [{ x: 7.9, z: 8 }],
      [
        { x: -2, z: 10 },
        { x: 2, z: 10 },
      ],
      [],
    ]) {
      nav.build(players, open);
      const fresh = new Navigation();
      fresh.build(players, open);
      assert.deepEqual(nav.dist, fresh.dist);
      assert.deepEqual(nav.walk, fresh.walk);
      for (const p of [
        { x: 0, z: 1 },
        { x: 7.9, z: 8 },
        { x: -20, z: -20 },
      ])
        assert.deepEqual(nav.target(p), fresh.target(p));
    }
});

test("unchanged HUD values do not cause repeat DOM writes", () => {
  let writes = 0,
    text = "",
    width = "";
  const element = {
    get textContent() {
      return text;
    },
    set textContent(v) {
      text = v;
      writes++;
    },
    style: {
      get width() {
        return width;
      },
      set width(v) {
        width = v;
        writes++;
      },
    },
  };
  for (let i = 0; i < 100; i++) {
    textValue(element, "12");
    styleValue(element, "width", "75%");
  }
  assert.equal(writes, 2);
  textValue(element, 11);
  assert.equal(writes, 3);
});
