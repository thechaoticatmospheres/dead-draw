// Optional bounded, deterministic performance comparison. Never connects to a live server.
import fs from "node:fs";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { Game } from "../server/game.js";
import { ROOMS } from "../shared/map.js";
import { SPAWNS, WEAPONS } from "../shared/data.js";
import { PERKS } from "../shared/expansion.js";
import {
  StateEncoder,
  StateDecoder,
  prepareStateFrame,
} from "../shared/state-stream.js";
const stats = (values) => {
  const a = [...values].sort((a, b) => a - b);
  return {
    meanMs: values.reduce((a, b) => a + b, 0) / values.length,
    p95Ms: a[Math.floor(a.length * 0.95)],
  };
};
function fixture(Type, team, combat, stocked) {
  let seed = 127;
  const rng = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const g = new Type("PERF", rng);
  for (let i = 0; i < team; i++) g.addPlayer("p" + i, "Player " + i);
  g.restart();
  g.runId = "fixed-perf-run";
  g.runStarted = 0;
  if (stocked) g.openRooms = ROOMS.map((r) => r.id);
  for (const p of Object.values(g.players)) {
    p.invulnerable = 1e6;
    if (stocked) {
      p.guns = Object.entries(WEAPONS).map(([id, w]) => ({
        id,
        ammo: w.mag,
        reserve: w.mag * 4,
        power: 1,
        level: 2,
        attachments: {},
        ownedAttachments: [],
      }));
      p.perks = Object.fromEntries(PERKS.map((p) => [p.id, p.max]));
    }
  }
  if (combat) {
    g.round = stocked ? 19 : 9;
    g.startRound();
    g.pending = 0;
    g.spawnTimer = 1e6;
    const spawns = SPAWNS.filter((s) => g.openRooms.includes(s.room));
    g.zombies = Array.from({ length: g.difficulty.cap }, (_, i) =>
      g.makeEnemy(spawns[i % spawns.length]),
    );
  }
  return g;
}
let Baseline;
if (process.env.PERF_BASELINE)
  Baseline = (
    await import(
      pathToFileURL(resolve(process.env.PERF_BASELINE, "server/game.js"))
    )
  ).Game;
const cases = [];
for (const [name, team, combat, stocked] of [
  ["solo-break", 1, false, false],
  ["four-stocked-break", 4, false, true],
  ["solo-wave10", 1, true, false],
  ["four-stocked-wave20", 4, true, true],
]) {
  const g = fixture(Game, team, combat, stocked),
    old = Baseline && fixture(Baseline, team, combat, stocked);
  const ids = Object.keys(g.players),
    tx = ids.map(() => new StateEncoder()),
    rx = ids.map(() => new StateDecoder());
  const updates = [],
    encoding = [],
    sizes = [],
    fullSizes = [];
  let frame;
  for (let tick = 0; tick < 1500; tick++) {
    if (!combat) {
      g.timer = 90;
      if (old) old.timer = 90;
    }
    const start = performance.now();
    g.update(1 / 30);
    const elapsed = performance.now() - start;
    if (old) {
      old.update(1 / 30);
      assert.deepEqual(
        JSON.parse(JSON.stringify(g.snapshot("p0", false))),
        JSON.parse(JSON.stringify(old.snapshot("p0", false))),
        `Seeded simulation changed: ${name} tick ${tick}`,
      );
      old.events.length = 0;
    }
    const encodeStart = performance.now(),
      common = g.snapshot("p0", false);
    frame = prepareStateFrame(common, frame);
    const snapshots = ids.map((id) => g.snapshot(id, false, common)),
      wires = snapshots.map((s, i) => tx[i].encode(s, s.events, frame));
    const encodeElapsed = performance.now() - encodeStart;
    for (let i = 0; i < ids.length; i++)
      assert.deepEqual(
        rx[i].decode(JSON.parse(wires[i])),
        JSON.parse(JSON.stringify({ type: "state", ...snapshots[i] })),
      );
    if (tick >= 300) {
      updates.push(elapsed);
      encoding.push(encodeElapsed);
      sizes.push(Buffer.byteLength(wires[0]));
      fullSizes.push(
        Buffer.byteLength(JSON.stringify({ type: "state", ...snapshots[0] })),
      );
    }
    g.events.length = 0;
  }
  const mean = (a) => a.reduce((a, b) => a + b, 0) / a.length;
  cases.push({
    name,
    players: team,
    enemies: g.zombies.length,
    update: stats(updates),
    encodeAllClients: stats(encoding),
    compactBytes: mean(sizes),
    legacyBytes: mean(fullSizes),
    reductionPercent: 100 * (1 - mean(sizes) / mean(fullSizes)),
    compactRoomMbps: (mean(sizes) * 30 * team * 8) / 1e6,
  });
}
const modelFiles = fs
  .readdirSync("public/assets/models")
  .filter((f) => f.endsWith(".glb"));
let original = 0,
  compressed = 0;
for (const f of modelFiles) {
  const b = fs.readFileSync("public/assets/models/" + f);
  original += b.length;
  compressed += gzipSync(b, { level: 9 }).length;
}
const report = {
  date: new Date().toISOString(),
  node: process.version,
  cpu: os.cpus()[0].model,
  conditions:
    "300 warmup + 1200 measured ticks; stationary invulnerable players, normal enemy caps, no player fire. Stocked cases have all rooms, weapons and perks. Local synthetic results, not hosting capacity.",
  baselineSimulationParity: Baseline
    ? "6000 ticks matched the selected baseline exactly"
    : "not requested (set PERF_BASELINE to an old checkout)",
  cases,
  models: {
    files: modelFiles.length,
    originalBytes: original,
    compressedBytes: compressed,
    reductionPercent: 100 * (1 - compressed / original),
  },
};
console.log(JSON.stringify(report, null, 2));
