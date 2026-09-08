import test from "node:test";
import assert from "node:assert/strict";
import { Audio, audioSettings, spatialMix } from "../src/audio.js";
import { soundCue, CUE_NAMES } from "../src/audio-cues.js";
import { Soundscape } from "../src/soundscape.js";
import { WEAPONS } from "../shared/data.js";

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
    7,
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
