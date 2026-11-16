import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { Checkpoints } from "../server/checkpoints.js";
import { DEVICES } from "../shared/campaign.js";
import { DOORS, ROOMS, clearPath, roomAt } from "../shared/map.js";
import { OBSTACLES } from "../shared/data.js";
import { enemyHitVolumes } from "../shared/expansion.js";
import {
  StateEncoder,
  StateDecoder,
  prepareStateFrame,
} from "../shared/state-stream.js";

// Authority integration, not a human playthrough: only initial currency and
// fixture positions are supplied by the test. Doors, purchases, wave spawning,
// weapon cooldown/ammo/damage, boss keys, finale and ending use production code.
const STEP = 1 / 30;
function createCrew(count = 2) {
  const game = new Game("FLOW", () => 0.43);
  for (let i = 0; i < count; i++)
    game.addPlayer(String(i), `Survivor ${i + 1}`);
  game.action("0", { type: "start" });
  for (const p of Object.values(game.players)) p.chips = 30000;
  return game;
}
function atDoor(game, id) {
  const door = DOORS.find((d) => d.id === id);
  const source = ROOMS.find((r) => r.id === door.from);
  const dx = source.x - door.x,
    dz = source.z - door.z;
  const distance = Math.hypot(dx, dz);
  Object.assign(game.players[0], {
    x: door.x + (dx / distance) * 1.5,
    z: door.z + (dz / distance) * 1.5,
  });
  assert.equal(roomAt(game.players[0])?.id, door.from);
  game.action("0", { type: "unlock", door: id });
  assert.ok(game.openRooms.includes(door.to), `Purchased ${door.to}`);
}
function device(game, id, player = "0") {
  const terminal = DEVICES.find((d) => d.id === id);
  Object.assign(game.players[player], { x: terminal.x, z: terminal.z + 1 });
  game.action(player, { type: "crew", choice: id });
}
function prepareCampaign() {
  const game = createCrew();
  for (const id of [
    "emerald",
    "velvet",
    "arcade",
    "dice",
    "crown-west",
    "sapphire",
    "ivory",
    "jade",
    "neon",
    "obsidian",
    "eclipse",
  ])
    atDoor(game, id);
  assert.equal(game.openRooms.length, ROOMS.length);
  device(game, "archive");
  assert.equal(game.campaign.archive, false, "Archive requires power");
  device(game, "power");
  device(game, "archive");
  device(game, "finale");
  assert.equal(
    game.campaign.finale,
    false,
    "Finale still requires earned boss keys",
  );
  for (const p of Object.values(game.players)) {
    game.action(p.id, { type: "buy", item: "house" });
    assert.equal(p.guns[p.selected].id, "house");
    for (let i = 0; i < 3; i++)
      game.action(p.id, { type: "buy", item: "upgrade" });
    game.action(p.id, { type: "attachment", item: "reflex" });
    for (let i = 0; i < 28; i++)
      game.action(p.id, { type: "buy", item: "ammo" });
  }
  return game;
}
function readyCrew(game) {
  for (const p of Object.values(game.players).filter((v) => !v.offline)) {
    game.action(p.id, { type: "buy", item: "heal" });
    game.action(p.id, { type: "buy", item: "heal" });
    game.action(p.id, { type: "buy", item: "armor" });
  }
  for (const p of Object.values(game.players).filter((v) => !v.offline))
    game.action(p.id, { type: "nextRound" });
  assert.equal(game.phase, "combat");
}
function firingPoint(game, enemy, offset) {
  const room = roomAt(enemy);
  for (let i = 0; i < 32; i++) {
    const angle = ((i + offset) / 32) * Math.PI * 2;
    const candidate = {
      x: enemy.x + Math.sin(angle) * 5.5,
      z: enemy.z + Math.cos(angle) * 5.5,
    };
    if (
      roomAt(candidate)?.id !== room.id ||
      !clearPath(candidate, enemy, game.openRooms)
    )
      continue;
    if (
      OBSTACLES.some(
        (o) => Math.hypot(o.x - candidate.x, o.z - candidate.z) < o.r + 0.45,
      )
    )
      continue;
    const dx = enemy.x - candidate.x,
      dz = enemy.z - candidate.z;
    if (
      OBSTACLES.some((o) => {
        const t =
          ((o.x - candidate.x) * dx + (o.z - candidate.z) * dz) /
          (dx * dx + dz * dz);
        return (
          o.h > 1.2 &&
          t > 0 &&
          t < 1 &&
          Math.hypot(candidate.x + dx * t - o.x, candidate.z + dz * t - o.z) <
            o.r
        );
      })
    )
      continue;
    return candidate;
  }
  throw Error(
    `No clear fixture firing point for ${enemy.kind} at ${enemy.x},${enemy.z}`,
  );
}
function fightWave(game) {
  const round = game.round;
  let houseSeen = false,
    collectorsSeen = false,
    lowPhaseSeen = false;
  for (let tick = 0; tick < 30 * 240 && game.phase === "combat"; tick++) {
    const enemy = game.zombies.find((z) => z.finalBoss) || game.zombies[0];
    if (enemy) {
      if (enemy.finalBoss) {
        houseSeen = true;
        collectorsSeen ||= game.zombies.some((z) => !z.finalBoss);
        lowPhaseSeen ||= enemy.hp < enemy.maxHp * 0.34;
      }
      for (const [index, p] of Object.values(game.players).entries()) {
        if (p.offline || p.down) continue;
        Object.assign(
          p,
          firingPoint(game, enemy, index * 8 + Math.floor(tick / 8)),
        );
        const head = enemyHitVolumes(enemy).head;
        const dx = head.x - p.x,
          dz = head.z - p.z;
        game.action(p.id, {
          type: "input",
          input: {
            aim: true,
            shoot: true,
            yaw: Math.atan2(-dx, -dz),
            pitch: Math.atan2(head.y - 1.65, Math.hypot(dx, dz)),
          },
        });
        if (!p.guns[p.selected].ammo) game.action(p.id, { type: "reload" });
      }
    }
    game.update(STEP);
    if (tick % 300 === 0) game.events = [];
  }
  assert.equal(
    game.phase,
    "break",
    `Wave ${round} cleared through weapon damage; ${JSON.stringify(Object.values(game.players).map((p) => ({ hp: p.hp, down: p.down, ammo: p.guns[p.selected].ammo, reserve: p.guns[p.selected].reserve })))}, enemies ${game.zombies.length}`,
  );
  assert.equal(game.pending, 0);
  assert.equal(game.zombies.length, 0);
  for (const p of Object.values(game.players))
    game.action(p.id, { type: "input", input: {} });
  return { houseSeen, collectorsSeen, lowPhaseSeen };
}
function defeatHouse() {
  const game = prepareCampaign();
  for (let round = 1; round <= 10; round++) {
    readyCrew(game);
    assert.equal(game.round, round);
    fightWave(game);
    assert.equal(game.campaign.keys, Math.min(2, Math.floor(round / 5)));
  }
  device(game, "finale");
  assert.equal(game.campaign.finale, true);
  readyCrew(game);
  assert.equal(game.pending, 0);
  const boss = game.zombies.find((z) => z.finalBoss);
  assert.equal(
    boss.maxHp,
    7200,
    "House scales for the two connected survivors",
  );
  const phases = fightWave(game);
  assert.ok(phases.houseSeen && phases.collectorsSeen && phases.lowPhaseSeen);
  assert.equal(game.campaign.defeated, true);
  assert.equal(game.summary, null);
  assert.equal(game.testing, false);
  return game;
}

test("integrated campaign clears ten real waves, the House, safe recovery, revive, extraction and restart", () => {
  const game = defeatHouse();
  const vault = new Checkpoints("overhaul-integration-only");
  const encrypted = vault.seal(game);
  assert.ok(encrypted);
  const restored = vault.restore(vault.open(encrypted));
  assert.equal(restored.campaign.defeated, true);
  assert.equal(restored.round, 11);
  assert.deepEqual(restored.openRooms, game.openRooms);
  for (const p of Object.values(restored.players)) {
    assert.equal(p.offline, true);
    // Socket reconnection applies these same ownership-preserving fields.
    Object.assign(p, { offline: false, input: {}, disconnectedAt: null });
  }
  device(restored, "extract", "0");
  assert.equal(
    restored.phase,
    "break",
    "One survivor cannot extract the whole connected crew",
  );
  device(restored, "extract", "1");
  assert.equal(restored.phase, "over");
  assert.equal(restored.summary.extracted, true);
  assert.equal(restored.summary.players.length, 2);
  assert.ok(
    restored.summary.players.reduce((sum, p) => sum + p.kills, 0) > 400,
  );
  const summary = JSON.stringify(restored.summary);
  restored.update(1);
  restored.finishRun();
  assert.equal(
    JSON.stringify(restored.summary),
    summary,
    "Ending report is stable and not paid twice",
  );
  restored.action("0", { type: "start" });
  assert.equal(restored.phase, "break");
  assert.equal(restored.round, 0);
  assert.equal(restored.summary, null);
  assert.deepEqual(restored.openRooms, ["atrium"]);
  assert.equal(restored.campaign.defeated, false);
  assert.ok(
    Object.values(restored.players).every(
      (p) => p.chips === 25 && p.guns.length === 1,
    ),
  );
  const patient = restored.players[1],
    rescuer = restored.players[0];
  restored.hurt(patient, 100);
  assert.equal(patient.down, true);
  Object.assign(rescuer, { x: patient.x + 1, z: patient.z });
  for (let i = 0; i < 92; i++) {
    restored.action("0", { type: "input", input: { revive: true } });
    restored.update(STEP);
  }
  assert.equal(patient.down, false);
  assert.equal(patient.hp, 60);
  assert.equal(rescuer.revives, 1);
  restored.hurt(rescuer, 1000);
  restored.hurt(patient, 1000);
  restored.update(STEP);
  assert.equal(restored.phase, "over");
  assert.equal(restored.summary.extracted, false);
});

test("defeating the House allows an actual subsequent endless wave without a repeated finale", () => {
  const game = defeatHouse();
  readyCrew(game);
  assert.equal(game.round, 12);
  assert.ok(game.pending > 0);
  assert.equal(
    game.zombies.some((z) => z.finalBoss),
    false,
  );
  fightWave(game);
  assert.equal(game.campaign.defeated, true);
  assert.equal(game.campaign.extracted, false);
  device(game, "extract", "0");
  device(game, "extract", "1");
  assert.equal(game.summary.extracted, true);
  assert.equal(game.summary.round, 12);
});

test("four recipient streams preserve private hands and settle the shared deadline exactly once", () => {
  const game = createCrew(4);
  atDoor(game, "velvet");
  for (const p of Object.values(game.players)) {
    Object.assign(p, { x: 17, z: 10 });
    game.action(p.id, { type: "gamble", station: "blackjack", wager: 50 });
  }
  assert.equal(Object.keys(game.games).length, 4);
  const encoders = Array.from({ length: 4 }, () => new StateEncoder());
  const decoders = Array.from({ length: 4 }, () => new StateDecoder());
  let frame;
  for (let tick = 0; tick < 2; tick++) {
    frame = prepareStateFrame(game.snapshot(undefined, false), frame);
    for (const p of Object.values(game.players)) {
      const snapshot = game.snapshot(p.id, false);
      const decoded = decoders[p.id].decode(
        JSON.parse(encoders[p.id].encode(snapshot, [], frame)),
      );
      assert.equal(Object.keys(decoded.games).length, 1);
      assert.equal(decoded.games.blackjack.player, p.id);
      assert.equal(decoded.games.blackjack.deck, undefined);
      assert.deepEqual(decoded.games.blackjack.dealer[1], {
        rank: 0,
        suit: "?",
      });
      assert.equal(decoded.games.blackjack.returned, undefined);
    }
    game.update(STEP);
  }
  const vault = new Checkpoints("private-hands-test");
  assert.equal(
    vault.seal(game),
    null,
    "Unsettled hands cannot be checkpointed",
  );
  game.update(91);
  assert.equal(game.phase, "combat");
  assert.equal(Object.keys(game.games).length, 0);
  assert.ok(
    Object.values(game.players).every(
      (p) => p.handsPlayed === 1 && p.ledger.length === 1,
    ),
  );
  const after = Object.values(game.players).map((p) => p.chips);
  game.finishIntermissionGames();
  assert.deepEqual(
    Object.values(game.players).map((p) => p.chips),
    after,
  );
});
