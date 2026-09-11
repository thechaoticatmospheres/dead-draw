import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { DEVICES, nearbyCampaignTarget } from "../shared/campaign.js";
import { ROOMS, ROOM_SPAWNS } from "../shared/map.js";
function setup() {
  const g = new Game("READY", () => 0.2);
  g.addPlayer("a", "A");
  g.addPlayer("b", "B");
  g.restart();
  return g;
}
test("ready votes toggle, require the connected crew, skip the timer and reset", () => {
  const g = setup();
  g.action("a", { type: "nextRound" });
  assert.equal(g.players.a.ready, true);
  assert.equal(g.phase, "break");
  g.action("a", { type: "nextRound" });
  assert.equal(g.players.a.ready, false);
  g.action("b", { type: "nextRound" });
  assert.equal(g.phase, "break");
  g.action("a", { type: "nextRound" });
  assert.equal(g.phase, "combat");
  assert.equal(g.round, 1);
  assert.ok(Object.values(g.players).every((p) => !p.ready));
  g.action("a", { type: "nextRound" });
  assert.equal(g.round, 1);
});
test("solo readiness excludes offline survivors and ordinary timeout still works", () => {
  const g = setup();
  g.players.b.offline = true;
  g.action("a", { type: "nextRound" });
  assert.equal(g.phase, "combat");
  const h = setup();
  h.action("a", { type: "nextRound" });
  h.update(90);
  assert.equal(h.phase, "combat");
});
test("active casino hands block readiness", () => {
  const g = setup();
  Object.assign(g.players.a, { x: -3, z: 8, chips: 100 });
  g.action("a", { type: "gamble", station: "slots" });
  assert.ok(g.busy("a"));
  g.action("a", { type: "nextRound" });
  assert.equal(g.players.a.ready, false);
  assert.equal(g.phase, "break");
});
test("all campaign terminals and repair entrances have an E proximity target", () => {
  const g = setup();
  g.openRooms = ROOMS.map((r) => r.id);
  for (const device of DEVICES) {
    Object.assign(g.players.a, { x: device.x, z: device.z });
    assert.equal(nearbyCampaignTarget(g.players.a, g)?.id, device.id);
  }
  for (const [entrance, v] of ROOM_SPAWNS.entries()) {
    Object.assign(g.players.a, { x: v.x, z: v.z });
    const target = nearbyCampaignTarget(g.players.a, g);
    assert.equal(target?.id, "repair");
    assert.equal(target.entrance, entrance);
  }
  g.players.a.down = true;
  assert.equal(nearbyCampaignTarget(g.players.a, g), null);
});
