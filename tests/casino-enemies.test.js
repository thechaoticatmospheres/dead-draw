import test from "node:test";
import assert from "node:assert/strict";
import { ENEMIES, enemyType, enemyHitVolumes } from "../shared/expansion.js";
import { nearbyPower } from "../shared/campaign.js";
import { ROOMS } from "../shared/map.js";
import { Game } from "../server/game.js";
const setup = () => {
  const g = new Game("CREATURES", () => 0.5);
  g.addPlayer("a", "Tester");
  g.restart();
  return [g, g.players.a];
};
test("casino roster preserves bosses and introduces security only from wave four", () => {
  for (let round = 1; round <= 20; round++) {
    const roster = Array.from({ length: 80 }, (_, i) => enemyType(round, i));
    assert.equal(
      roster.filter((k) => k === "boss").length,
      round % 5 === 0 ? 1 : 0,
    );
    assert.equal(roster.includes("security"), round >= 4);
    assert.equal(roster.includes("wheelchair"), round >= 2);
    for (const k of ["walker", "dealer", "crawler"])
      assert.ok(roster.includes(k));
    assert.ok(roster.every((k) => ENEMIES[k]));
  }
});
test("power proximity and direct crew action respect walls, cost, phase and repeated presses", () => {
  const [g, p] = setup();
  g.openRooms = ROOMS.map((r) => r.id);
  p.x = -21;
  p.z = -20;
  p.chips = 149;
  assert.equal(nearbyPower(p, g).id, "power");
  g.action(p.id, { type: "crew", choice: "power" });
  assert.equal(g.campaign.power, false);
  p.chips = 500;
  g.phase = "combat";
  g.action(p.id, { type: "crew", choice: "power" });
  assert.equal(g.campaign.power, false);
  g.phase = "break";
  g.action(p.id, { type: "crew", choice: "power" });
  assert.equal(g.campaign.power, true);
  assert.equal(p.chips, 350);
  g.action(p.id, { type: "crew", choice: "power" });
  assert.equal(p.chips, 350);
  p.z = -15;
  assert.equal(nearbyPower(p, g), null);
  p.z = -20;
  p.down = true;
  assert.equal(nearbyPower(p, g), null);
  p.down = false;
  g.openRooms = ["atrium"];
  assert.equal(nearbyPower(p, g), null);
});
test("crawler hit volumes follow facing and cannot be shot at standing head height", () => {
  const [g, p] = setup();
  g.startRound();
  g.pending = 10;
  p.x = 0;
  p.z = 12;
  const z = {
    id: 900,
    kind: "crawler",
    x: 0,
    z: 8,
    yaw: Math.PI,
    hp: 100,
    maxHp: 100,
  };
  g.zombies = [z];
  const above = g.fireRay(
    p,
    p.guns[0],
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 1.68, z: 12 },
  );
  assert.equal(above.hit, false);
  const hit = g.fireRay(
    p,
    p.guns[0],
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 0.55, z: 12 },
  );
  assert.equal(hit.hit, true);
  assert.equal(hit.head, true);
  assert.ok(enemyHitVolumes(z).head.z > z.z);
  z.yaw = Math.PI / 2;
  assert.ok(enemyHitVolumes(z).head.x < z.x);
});
test("wheelchair seated headshots and tougher security use authoritative combat rules", () => {
  const [g, p] = setup();
  g.startRound();
  g.pending = 10;
  p.x = 0;
  p.z = 12;
  const z = { id: 900, kind: "wheelchair", x: 0, z: 8, hp: 100, maxHp: 100 };
  g.zombies = [z];
  const hit = g.fireRay(
    p,
    p.guns[0],
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 1.36, z: 12 },
  );
  assert.equal(hit.hit, true);
  assert.equal(hit.head, true);
  g.round = 4;
  g.spawned = 6;
  const security = g.makeEnemy({ x: 0, z: 10 });
  assert.equal(security.kind, "security");
  assert.ok(security.hp > g.difficulty.hp * 2);
  security.special = 0;
  g.specialAttack(security, p, 0.03);
  assert.equal(g.hazards.at(-1).kind, "slam");
  assert.equal(g.hazards.at(-1).damage, 24);
  assert.ok(g.hazards.at(-1).delay > 0);
});
