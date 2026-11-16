import test from "node:test";
import assert from "node:assert/strict";
import { Audio, audioSettings, spatialMix } from "../src/audio.js";
import { soundCue, CUE_NAMES } from "../src/audio-cues.js";
import { Soundscape } from "../src/soundscape.js";
import { WEAPONS } from "../shared/data.js";
import {
  APPROVED_SAMPLES,
  sampleKey,
  sampleUrl,
} from "../src/audio-samples.js";
import { readFile } from "node:fs/promises";

class Param {
  value = 0;
  setValueAtTime(v) {
    this.value = v;
  }
  exponentialRampToValueAtTime(v) {
    this.value = v;
  }
  setTargetAtTime(v) {
    this.value = v;
  }
  cancelScheduledValues() {}
}
class Node {
  constructor() {
    for (const p of [
      "gain",
      "frequency",
      "detune",
      "Q",
      "pan",
      "threshold",
      "knee",
      "ratio",
      "attack",
      "release",
    ])
      this[p] = new Param();
    this.connections = [];
  }
  connect(to) {
    this.connections.push(to);
    return to;
  }
  disconnect() {
    this.connections = [];
    this.disconnected = true;
  }
  start() {}
  stop() {
    this.stopped = true;
  }
}
class Context {
  state = "running";
  currentTime = 0;
  sampleRate = 1000;
  destination = new Node();
  nodes = [];
  sources = [];
  node() {
    const n = new Node();
    this.nodes.push(n);
    return n;
  }
  createGain() {
    return this.node();
  }
  createWaveShaper() {
    return this.node();
  }
  createBiquadFilter() {
    return this.node();
  }
  createStereoPanner() {
    return this.node();
  }
  createConvolver() {
    return this.node();
  }
  createDynamicsCompressor() {
    return this.node();
  }
  createOscillator() {
    const n = this.node();
    this.sources.push(n);
    return n;
  }
  createBufferSource() {
    return this.createOscillator();
  }
  createBuffer(ch, n) {
    const data = Array.from({ length: ch }, () => new Float32Array(n));
    return { getChannelData: (i) => data[i] };
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  close() {
    this.state = "closed";
    return Promise.resolve();
  }
  finish() {
    for (const s of this.sources.splice(0)) s.onended?.();
  }
}
const setup = () => {
  const ctx = new Context(),
    values = new Map(),
    storage = {
      getItem: (k) => values.get(k),
      setItem: (k, v) => values.set(k, v),
    };
  const audio = new Audio({ contextFactory: () => ctx, storage });
  audio.start();
  return { audio, ctx, storage };
};

test("approved assets exactly match the user's audition files and respect deployment base paths", async () => {
  const approval = JSON.parse(
    await readFile(
      new URL("../docs/audio-review/approved-batch-03.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    new Set(Object.values(APPROVED_SAMPLES).map((s) => s.generationId)),
    new Set(
      Object.values(approval.sounds)
        .map((s) => s.pick)
        .filter(Boolean),
    ),
    "Every selected recording is included, and unselected candidates stay out",
  );
  for (const sample of Object.values(APPROVED_SAMPLES)) {
    assert.ok(
      Object.values(approval.sounds).some(
        (s) => s.pick === sample.generationId,
      ),
    );
    assert.deepEqual(
      await readFile(
        new URL(`../public/assets/audio/${sample.file}`, import.meta.url),
      ),
      await readFile(
        new URL(
          `../docs/audio-review/audio/${sample.generationId}.wav`,
          import.meta.url,
        ),
      ),
    );
    assert.equal(
      sampleUrl(sample, "/dead-draw/"),
      `/dead-draw/assets/audio/${sample.file}`,
    );
  }
  assert.equal(sampleKey("shot", { weapon: "pitViper" }), "shot:pitViper");
  assert.equal(sampleKey("enemy", { kind: "runner" }), "enemy:runner");
  assert.equal(sampleKey("death", { kind: "walker" }), null);
});

test("sample preload is deduplicated, plays immediately through fallback, and never replays an old cue", async () => {
  const ctx = new Context();
  const decoded = { duration: 0.5 };
  ctx.decodeAudioData = async () => decoded;
  const pending = [];
  const audio = new Audio({
    contextFactory: () => ctx,
    fetcher: () => new Promise((resolve) => pending.push(resolve)),
  });
  audio.start();
  audio.start();
  assert.equal(pending.length, Object.keys(APPROVED_SAMPLES).length);
  assert.equal(audio.play("shot", { weapon: "courtesy" }), true);
  assert.ok(ctx.sources.length > 1, "procedural fallback while loading");
  const before = ctx.sources.length;
  for (const resolve of pending)
    resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  await audio.loadSamples();
  assert.equal(
    ctx.sources.length,
    before,
    "loading must not replay a past gunshot",
  );
  ctx.finish();
  assert.equal(audio.play("shot", { weapon: "courtesy" }), true);
  assert.equal(ctx.sources.length, 1);
  assert.equal(ctx.sources[0].buffer, decoded);
  assert.notEqual(ctx.sources[0].loop, true);
  audio.muted = true;
  assert.equal(audio.voices.size, 0);
  assert.equal(audio.play("shot", { weapon: "courtesy" }), false);
  audio.muted = false;
  ctx.finish();
  assert.equal(audio.play("reload", { weapon: "railgun" }), true);
  assert.ok(
    ctx.sources.length > 1,
    "unselected handling still uses procedural audio",
  );
  audio.dispose();
});

test("unavailable samples keep fallback audio and late downloads cannot revive a disposed mixer", async () => {
  const ctx = new Context();
  ctx.decodeAudioData = async () => ({ duration: 1 });
  const audio = new Audio({
    contextFactory: () => ctx,
    fetcher: async () => ({ ok: false }),
  });
  audio.start();
  await audio.loadSamples();
  assert.equal(audio.sampleBuffers.size, 0);
  assert.equal(audio.play("enemy", { kind: "walker" }), true);
  const pending = [];
  const late = new Audio({
    contextFactory: () => new Context(),
    fetcher: () => new Promise((resolve) => pending.push(resolve)),
  });
  late.contextFactory = () => {
    const c = new Context();
    c.decodeAudioData = async () => ({ duration: 1 });
    return c;
  };
  late.start();
  const oldLoad = late.loadSamples();
  late.dispose();
  for (const resolve of pending)
    resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  await oldLoad;
  assert.equal(late.sampleBuffers.size, 0);
  assert.equal(late.ctx, null);
});

test("all selected weapon and enemy routes play the exact approved recording; unselected routes use defaults", async () => {
  const catalog = JSON.parse(
    await readFile(
      new URL("../docs/audio-review/catalog.json", import.meta.url),
      "utf8",
    ),
  );
  const approval = JSON.parse(
    await readFile(
      new URL("../docs/audio-review/approved-batch-03.json", import.meta.url),
      "utf8",
    ),
  );
  const { audio, ctx } = setup();
  for (const [key, sample] of Object.entries(APPROVED_SAMPLES))
    audio.sampleBuffers.set(key, {
      duration: 0.5,
      generationId: sample.generationId,
    });
  for (const sound of catalog.sounds) {
    if (
      !["shot", "enemy", "reload", "reloadEnd", "switch", "empty"].includes(
        sound.cue,
      )
    )
      continue;
    for (const target of sound.appliesTo || [sound.weapon || sound.kind]) {
      const options =
        sound.cue === "enemy" ? { kind: target } : { weapon: target };
      ctx.currentTime += 10;
      assert.equal(audio.play(sound.cue, options), true, sound.id);
      const pick = approval.sounds[sound.id]?.pick;
      if (pick) {
        assert.equal(ctx.sources.length, 1, sound.id);
        assert.equal(
          ctx.sources[0].buffer.generationId,
          pick,
          `${sound.id} / ${target}`,
        );
      } else {
        assert.ok(
          ctx.sources.every((s) => !s.buffer?.generationId),
          `${sound.id} keeps default`,
        );
      }
      ctx.finish();
    }
  }
  audio.dispose();
});

test("saved sound levels are clamped and invalid storage cannot poison the mixer", () => {
  assert.deepEqual(
    audioSettings({
      master: 2,
      effects: -1,
      casino: NaN,
      ambience: "loud",
      muted: 1,
    }),
    { master: 1, effects: 0, casino: 0.75, ambience: 0.35, muted: false },
  );
  assert.equal(audioSettings(null).master, 0.7);
  const { audio, storage } = setup();
  audio.set("casino", 0.25);
  audio.muted = true;
  const restored = new Audio({ storage });
  assert.equal(restored.settings.casino, 0.25);
  assert.equal(restored.muted, true);
});
test("direction follows listener rotation and walls and range attenuate sound", () => {
  const p = { x: 0, z: 8, yaw: 0 },
    right = { x: 6, z: 8 };
  assert.ok(spatialMix(p, right).pan > 0);
  assert.ok(spatialMix({ ...p, yaw: Math.PI }, right).pan < 0);
  assert.equal(spatialMix(p, { x: 30, z: 8 }).gain, 0);
  assert.ok(spatialMix(p, right, true).gain < spatialMix(p, right).gain);
  assert.equal(spatialMix(p, right, true).cutoff, 650);
});
test("every sound and weapon profile schedules and disconnects all owned nodes", () => {
  const { audio, ctx } = setup();
  const profiles = CUE_NAMES.map((name) => [name, {}]).concat(
    Object.keys(WEAPONS).map((weapon) => ["shot", { weapon }]),
  );
  for (const [name, options] of profiles) {
    ctx.currentTime += 10;
    assert.ok(soundCue(name, options).layers.length);
    const begin = ctx.nodes.length;
    assert.equal(audio.play(name, options), true, name);
    ctx.finish();
    assert.equal(audio.voices.size, 0, name);
    assert.ok(
      ctx.nodes.slice(begin).every((n) => n.disconnected),
      name,
    );
  }
  assert.equal(
    new Set(
      Object.keys(WEAPONS).map((weapon) =>
        JSON.stringify(soundCue("shot", { weapon })),
      ),
    ).size,
    14,
  );
});
test("mute stops queued sounds, persists, and focus loss suppresses new voices", () => {
  const { audio, ctx } = setup();
  audio.play("jackpot");
  audio.muted = true;
  assert.equal(audio.voices.size, 0);
  assert.ok(ctx.sources.every((s) => s.stopped));
  assert.equal(audio.output.gain.value, 0);
  assert.equal(audio.play("explosion"), false);
  audio.muted = false;
  audio.setActive(false);
  assert.equal(ctx.state, "suspended");
  assert.equal(audio.play("shot"), false);
  audio.setActive(true);
  assert.equal(ctx.state, "running");
  assert.equal(audio.play("shot"), true);
  audio.set("effects", 0);
  assert.equal(audio.voices.size, 0);
  assert.equal(audio.play("shot"), false);
  assert.equal(audio.play("chips"), true);
});
test("rapid fire and casino loops have bounded voices and throttled repeated cues", () => {
  const { audio, ctx } = setup();
  assert.equal(audio.play("chips"), true);
  assert.equal(audio.play("chips"), false);
  ctx.currentTime += 1;
  for (let i = 0; i < 500; i++) audio.play("shot");
  assert.ok([...audio.voices].reduce((n, v) => n + v.count, 0) <= 96);
  ctx.finish();
  assert.equal(audio.voices.size, 0);
});
const scene = () => ({
  phase: "break",
  round: 0,
  openRooms: ["atrium"],
  players: [
    {
      id: "a",
      x: 0,
      z: 8,
      yaw: 0,
      hp: 100,
      armor: 0,
      down: false,
      reload: 0,
      dodgeTime: 0,
      selected: 0,
      guns: [{ id: "courtesy", ammo: 10 }],
    },
  ],
  zombies: [],
  hazards: [],
  games: {},
});
const observer = () => {
  const calls = [];
  const audio = {
    play: (name, options) => calls.push({ name, options }),
    duck: () => {},
  };
  return { calls, s: new Soundscape(audio) };
};
test("snapshot sounds follow real movement and weapon changes without repetition", () => {
  const { s, calls } = observer();
  let state = scene();
  s.update(0.033, state, "a", 0);
  calls.length = 0;
  state = structuredClone(state);
  state.players[0].z += 0.7;
  s.update(0.033, state, "a", 0);
  state = structuredClone(state);
  state.players[0].z += 0.7;
  s.update(0.033, state, "a", 0);
  assert.equal(calls.filter((c) => c.name === "step").length, 1);
  for (let i = 0; i < 10; i++) s.update(0.033, state, "a", 0);
  assert.equal(calls.filter((c) => c.name === "step").length, 1);
  state = structuredClone(state);
  state.players[0].reload = 1;
  s.update(0.033, state, "a", 0);
  state = structuredClone(state);
  state.players[0].reload = 0;
  state.players[0].guns[0].ammo = 12;
  s.update(0.033, state, "a", 0);
  assert.equal(calls.filter((c) => c.name === "reload").length, 1);
  assert.equal(calls.filter((c) => c.name === "reloadEnd").length, 1);
});
test("handling events identify each local and remote weapon and do not finish cancelled reloads", () => {
  for (const weapon of Object.keys(WEAPONS)) {
    const { s, calls } = observer();
    let state = scene();
    state.players.push({ ...structuredClone(state.players[0]), id: "b", x: 3 });
    s.update(0.033, state, "a", 0);
    calls.length = 0;
    state = structuredClone(state);
    for (const p of state.players) {
      p.guns.push({ id: weapon, ammo: 0 });
      p.selected = 1;
    }
    s.update(0.033, state, "a", 0, null, { trigger: true });
    assert.equal(
      calls.filter((c) => c.name === "empty")[0].options.weapon,
      weapon,
    );
    state = structuredClone(state);
    for (const p of state.players) p.reload = 1;
    s.update(0.033, state, "a", 0);
    state = structuredClone(state);
    for (const p of state.players) {
      p.reload = 0;
      p.guns[1].ammo = 10;
    }
    s.update(0.033, state, "a", 0);
    for (const name of ["switch", "reload", "reloadEnd"]) {
      const events = calls.filter((c) => c.name === name);
      assert.equal(events.length, 2, `${weapon} ${name}`);
      assert.ok(events.every((c) => c.options.weapon === weapon));
      assert.equal(events[0].options.source, null);
      assert.equal(events[1].options.source.id, "b");
    }
    calls.length = 0;
    state = structuredClone(state);
    state.players[0].reload = 1;
    s.update(0.033, state, "a", 0);
    state = structuredClone(state);
    state.players[0].guns[1] = {
      id: weapon === "rpg" ? "courtesy" : "rpg",
      ammo: 20,
    };
    state.players[0].reload = 0;
    s.update(0.033, state, "a", 0);
    assert.equal(calls.filter((c) => c.name === "reloadEnd").length, 0);
    assert.equal(
      calls.filter((c) => c.name === "switch").length,
      1,
      "replacement in same slot equips",
    );
  }
});

test("casino reveals and vault outcomes sound once and never use hidden outcomes", () => {
  const { s, calls } = observer();
  let state = scene();
  s.update(0.033, state, "a", 0);
  calls.length = 0;
  state.games.slots = {
    startedAt: 1,
    player: "a",
    phase: "playing",
    reelStops: [null, null, null],
    stops: [1, 2, 3],
  };
  s.update(0.033, state, "a", 0, "slots");
  assert.equal(calls.filter((c) => c.name === "reelStop").length, 0);
  state.games.slots.reelStops = [1, null, null];
  s.update(0.033, state, "a", 0, "slots");
  s.update(0.033, state, "a", 0, "slots");
  assert.equal(calls.filter((c) => c.name === "reelStop").length, 1);
  Object.assign(state.games.slots, {
    phase: "bonus",
    vault: { picks: [], finished: false },
  });
  s.update(0.033, state, "a", 0, "slots");
  state.games.slots.vault = {
    picks: [{ index: 1, value: "alarm" }],
    alarm: true,
    finished: true,
  };
  state.games.slots.phase = "result";
  s.update(0.033, state, "a", 0, "slots");
  s.update(0.033, state, "a", 0, "slots");
  assert.equal(calls.filter((c) => c.name === "alarm").length, 1);
  assert.equal(calls.filter((c) => c.name === "bank").length, 0);
});

test("extra render frames retain casino motor cadence without re-observing snapshot transitions", () => {
  const { s, calls } = observer(),
    state = scene();
  state.games.slots = {
    startedAt: 1,
    player: "a",
    phase: "playing",
    reelStops: [null, null, null],
  };
  s.update(0.016, state, "a", 0, "slots");
  const players = s.players,
    hazards = s.hazards,
    games = s.games;
  for (let i = 0; i < 10; i++)
    s.update(0.016, state, "a", 0, "slots", { newSnapshot: false });
  assert.equal(s.players, players);
  assert.equal(s.hazards, hazards);
  assert.equal(s.games, games);
  assert.equal(calls.filter((c) => c.name === "slotMotor").length, 11);
  const next = structuredClone(state);
  next.games.slots.reelStops = [1, null, null];
  s.update(0.016, next, "a", 0, "slots");
  for (let i = 0; i < 10; i++)
    s.update(0.016, next, "a", 0, "slots", { newSnapshot: false });
  assert.equal(calls.filter((c) => c.name === "reelStop").length, 1);
});
test("hazards telegraph then land once, and duplicate network events are silent", () => {
  const { s, calls } = observer(),
    state = scene();
  s.update(0.033, state, "a", 0);
  calls.length = 0;
  state.hazards = [{ id: 2, kind: "slam", x: 0, z: 8, delay: 1 }];
  s.update(0.033, state, "a", 0);
  state.hazards[0].delay = -0.1;
  s.update(0.033, state, "a", 0);
  s.update(0.033, state, "a", 0);
  assert.equal(calls.filter((c) => c.name === "warnSlam").length, 1);
  assert.equal(calls.filter((c) => c.name === "slam").length, 1);
  const e = {
    id: 44,
    type: "shot",
    player: "a",
    weapon: "house",
    hit: true,
    head: true,
  };
  s.event(e, state, "a");
  s.event(e, state, "a");
  assert.equal(calls.filter((c) => c.name === "shot").length, 1);
  assert.equal(calls.filter((c) => c.name === "headshot").length, 1);
});

test("final ten seconds beep once per second and stop in combat", () => {
  const { s, calls } = observer(),
    state = scene();
  state.phase = "break";
  for (let n = 11; n >= 1; n--) {
    state.timer = n;
    s.update(0.033, state, "a", 0);
    s.update(0.033, state, "a", 0);
  }
  assert.equal(calls.filter((c) => c.name === "ready").length, 10);
  state.phase = "combat";
  s.update(0.033, state, "a", 0);
  assert.equal(calls.filter((c) => c.name === "ready").length, 10);
});
