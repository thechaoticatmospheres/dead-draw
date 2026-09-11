import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { WheelMotion } from "../src/wheel-motion.js";
import { WHEEL_PRIZES } from "../shared/arsenal.js";
test("three players can fund a door with all available chips without overpaying", () => {
  const g = new Game("DOOR");
  for (const id of ["a", "b", "c"]) g.addPlayer(id, id);
  g.restart();
  for (const p of Object.values(g.players))
    Object.assign(p, { x: -6, z: 9, chips: 30 });
  for (const id of ["a", "b", "c"])
    g.action(id, { type: "unlock", door: "emerald" });
  assert.equal(g.players.a.chips, 0);
  assert.equal(g.players.b.chips, 0);
  assert.equal(g.players.c.chips, 15);
  assert.equal(g.campaign.donations.emerald, 75);
  assert.equal(g.openRooms.filter((r) => r === "emerald").length, 1);
  g.action("c", { type: "unlock", door: "emerald" });
  assert.equal(g.players.c.chips, 15);
});
test("wheel decelerates continuously onto every winning segment across frame rates", () => {
  const n = WHEEL_PRIZES.length,
    tau = Math.PI * 2;
  for (const fps of [30, 60, 144])
    for (let prize = 0; prize < n; prize++) {
      const m = new WheelMotion(n);
      let previous = 0,
        lastStep = 0;
      for (let frame = 0; frame < fps * 6; frame++) {
        const remaining = 5 - frame / fps,
          spin =
            remaining > 0
              ? {
                  id: 1,
                  remaining,
                  ...(remaining <= 1.5 ? { landingPrize: prize } : {}),
                }
              : null;
        const angle = m.update(1 / fps, spin, { prize });
        assert.ok(angle >= previous - 1e-8, "no reverse snap");
        assert.ok(angle - previous < 1, "no result jump");
        if (!m.done) lastStep = angle - previous;
        previous = angle;
      }
      const alignment =
        (((m.angle + ((prize + 0.5) * tau) / n + Math.PI / 2) % tau) + tau) %
        tau;
      assert.ok(Math.min(alignment, tau - alignment) < 1e-8);
      assert.equal(m.done, true);
      assert.ok(
        lastStep * fps < 2,
        "slows below two radians per second before stopping",
      );
    }
});
