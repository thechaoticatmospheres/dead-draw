import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { stick, GamepadInput } from "../src/gamepad.js";
import { barrierDistance } from "../shared/map.js";
test("analog sticks have a radial deadzone, preserve direction and cap diagonal speed", () => {
  assert.deepEqual(stick(0.1, -0.1), { x: 0, y: 0 });
  const full = stick(1, 1);
  assert.ok(Math.abs(Math.hypot(full.x, full.y) - 1) < 1e-8);
  assert.ok(stick(0, -0.4).y < 0);
  assert.ok(stick(0.8, 0).x > stick(0.4, 0).x);
  assert.deepEqual(stick(), { x: 0, y: 0 });
});
test("gamepad actions are edge-triggered, menus consume fire, and focus/disconnect clear held input", () => {
  const pad = {
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    },
    actions = [];
  let connected = true,
    focused = true;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => (connected ? [pad] : []) },
  });
  globalThis.document = {
    hidden: false,
    hasFocus: () => focused,
    querySelectorAll: () => [],
  };
  let menu = null;
  const input = new GamepadInput({
    menu: () => menu,
    playing: () => true,
    action: (a) => actions.push(a),
    look: () => {},
    mode: () => {},
    notice: () => {},
  });
  let now = 0;
  const step = () => input.update(0.016, (now += 16)),
    button = (i, value) =>
      (pad.buttons[i] = { pressed: value, value: value ? 1 : 0 });
  step();
  button(2, true);
  step();
  step();
  assert.deepEqual(actions, ["reload"]);
  button(2, false);
  step();
  button(2, true);
  step();
  assert.deepEqual(actions, ["reload", "reload"]);
  button(7, true);
  pad.axes[1] = -1;
  step();
  assert.equal(input.input.shoot, true);
  assert.equal(input.input.forward, 1);
  focused = false;
  input.suspend();
  step();
  assert.equal(input.input.shoot, false);
  assert.equal(input.input.forward, 0);
  focused = true;
  step();
  assert.equal(
    input.input.shoot,
    false,
    "held controls must return neutral after focus",
  );
  button(2, false);
  button(7, false);
  pad.axes[1] = 0;
  step();
  button(7, true);
  step();
  assert.equal(input.input.shoot, true);
  menu = {};
  input.navigate = () => {};
  step();
  assert.equal(input.input.shoot, false);
  menu = null;
  connected = false;
  step();
  assert.equal(input.mode, "keyboard");
  assert.equal(input.input.forward, 0);
});
test("shipped GLBs are valid containers with embedded resources and animation rigs", async () => {
  const names = await fs.readdir("public/assets/models");
  assert.equal(names.filter((n) => n.endsWith(".glb")).length, 30);
  let total = 0;
  for (const name of names.filter((n) => n.endsWith(".glb"))) {
    const bytes = await fs.readFile("public/assets/models/" + name);
    total += bytes.length;
    assert.equal(bytes.toString("ascii", 0, 4), "glTF");
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
    const json = JSON.parse(
      bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)),
    );
    assert.ok(json.meshes.length > 0, name);
    assert.ok(json.buffers.every((b) => !b.uri));
    assert.ok((json.images || []).every((i) => i.bufferView !== undefined));
    if (/survivor|zombie/.test(name)) {
      assert.ok(json.skins.length > 0, name);
      assert.deepEqual(json.animations.map((a) => a.name).sort(), [
        "Aim",
        "Idle",
        "Run",
      ]);
    }
  }
  assert.ok(total < 6 * 1024 * 1024, "asset payload stays under six MiB");
});
test("the taller casino partitions and exterior walls stop bullets at the visible surface", () => {
  const upper = barrierDistance({ x: 0, y: 4.3, z: 5 }, { x: 1, y: 0, z: 0 }, [
    "atrium",
  ]);
  assert.ok(Math.abs(upper - 7.82) < 0.01);
  const outer = barrierDistance({ x: 0, y: 1.5, z: 10 }, { x: 0, y: 0, z: 1 }, [
    "atrium",
  ]);
  assert.ok(Math.abs(outer - 6) < 0.01);
});
