import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { Checkpoints } from "../server/checkpoints.js";
import {
  WHEEL_ROOMS,
  WHEEL_PADS,
  newPrizeWheel,
  nearbyWheel,
} from "../shared/arsenal.js";
import { TestingCode } from "../src/testing-ui.js";
import { recordRun } from "../src/profile.js";
function setup() {
  const g = new Game("TEST", () => 0.3);
  g.addPlayer("a", "Host");
  g.addPlayer("b", "Guest");
  g.restart();
  return g;
}
test("wheel spawns and relocates only in the first seven unlockable rooms", () => {
  assert.deepEqual(WHEEL_ROOMS, [
    "emerald",
    "velvet",
    "arcade",
    "dice",
    "crown",
    "sapphire",
    "ivory",
  ]);
  for (let i = 0; i < 100; i++)
    assert.ok(WHEEL_ROOMS.includes(newPrizeWheel(() => i / 100).room));
  const g = setup();
  const initial = g.prizeWheel.room;
  const pad = WHEEL_PADS.find((p) => p.room === initial);
  Object.assign(g.players.a, { x: pad.x, z: pad.z });
  assert.equal(nearbyWheel(g.players.a, g), null);
  g.openRooms.push(initial);
  assert.ok(nearbyWheel(g.players.a, g));
  for (let i = 0; i < 40; i++) {
    const before = g.prizeWheel.room;
    g.movePrizeWheel();
    assert.ok(WHEEL_ROOMS.includes(g.prizeWheel.room));
    assert.notEqual(g.prizeWheel.room, before);
  }
});
test("old atrium checkpoints migrate the wheel and retain spin pricing", () => {
  const g = setup(),
    vault = new Checkpoints("test-only");
  g.prizeWheel = { room: "atrium", spins: 7, visits: 1 };
  const restored = vault.restore(vault.open(vault.seal(g)));
  assert.ok(WHEEL_ROOMS.includes(restored.prizeWheel.room));
  assert.equal(restored.prizeWheel.spins, 7);
});
test("testing actions are host-only, bounded and apply to the sender", () => {
  const g = setup();
  const amount = g.players.a.chips;
  g.action("b", { type: "testing", action: "chips", value: 1000 });
  assert.equal(g.players.b.chips, 25);
  assert.ok(!g.testing);
  for (const value of [-1, Infinity, NaN, 1.5, "100", 100001])
    g.action("a", { type: "testing", action: "chips", value });
  assert.equal(g.players.a.chips, amount);
  assert.ok(!g.testing);
  g.action("a", { type: "testing", action: "chips", value: 1000, target: "b" });
  assert.equal(g.players.a.chips, amount + 1000);
  assert.equal(g.players.b.chips, 25);
  g.action("a", { type: "testing", action: "comps", value: 50 });
  assert.equal(g.players.a.comps, 50);
  assert.equal(g.snapshot("a").testing, true);
});
test("testing switches waves, clears combat, restores players and persists its flag", () => {
  const g = setup();
  g.action("a", { type: "testing", action: "wave", value: 8 });
  assert.equal(g.round, 8);
  assert.equal(g.phase, "combat");
  assert.equal(g.specialRound, true);
  g.zombies.push({ id: 1 });
  g.action("a", { type: "testing", action: "break" });
  assert.equal(g.phase, "break");
  assert.equal(g.timer, 90);
  assert.equal(g.zombies.length, 0);
  g.players.a.down = true;
  g.players.a.hp = 0;
  g.action("a", { type: "testing", action: "restore" });
  assert.equal(g.players.a.down, false);
  assert.ok(g.players.a.hp > 0);
  const vault = new Checkpoints("test-only"),
    restored = vault.restore(vault.open(vault.seal(g)));
  assert.equal(restored.testing, true);
  g.finishRun();
  assert.equal(g.summary.testing, true);
  // Must return before any localStorage read/write.
  recordRun(g.summary, "a");
  g.restart();
  assert.equal(g.testing, false);
});
test("admin code accepts arrow keys and both num-lock modes, rejecting repeats and stale sequences", () => {
  const code = new TestingCode(),
    seq = [8, 8, 2, 2, 4, 6, 4, 6];
  assert.equal(
    seq
      .map((n) => code.accept({ code: `Numpad${n}`, key: String(n) }, 100))
      .at(-1),
    true,
  );
  assert.equal(
    seq
      .map((n) => code.accept({ code: `Numpad${n}`, key: "ArrowUp" }, 200))
      .at(-1),
    true,
  );
  for (const n of seq)
    assert.equal(code.accept({ code: `Numpad${n}`, repeat: true }, 300), false);
  for (const n of seq)
    assert.equal(code.accept({ code: "ArrowUp" }, 400), false);
  const arrows = new TestingCode();
  assert.equal(
    seq
      .map((n) =>
        arrows.accept(
          {
            code: {
              8: "ArrowUp",
              2: "ArrowDown",
              4: "ArrowLeft",
              6: "ArrowRight",
            }[n],
          },
          450,
        ),
      )
      .at(-1),
    true,
  );
  code.accept({ code: "Numpad8" }, 500);
  code.accept({ code: "Numpad8" }, 600);
  for (const n of seq.slice(2))
    assert.equal(code.accept({ code: `Numpad${n}` }, 6000), false);
});
