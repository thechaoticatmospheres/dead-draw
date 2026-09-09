import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { Checkpoints } from "../server/checkpoints.js";
import { SERVICES, musicPosition, newJukebox } from "../shared/services.js";
import { BackgroundMusic } from "../src/music.js";
const setup = () => {
  const game = new Game("MUSIC");
  game.addPlayer("a", "Alice");
  game.addPlayer("b", "Bob");
  game.restart();
  const p = game.players.a;
  Object.assign(p, { x: SERVICES[0].x, z: SERVICES[0].z + 3 });
  return [game, p];
};
test("jukebox controls require proximity and reject malformed or rapid actions", () => {
  const [g, p] = setup();
  g.action("a", { type: "music", choice: "select", track: 3 });
  assert.equal(g.snapshot().jukebox.track, 3);
  g.action("a", { type: "music", choice: "next" });
  assert.equal(g.jukebox.track, 3);
  g.time += 1;
  for (const track of [-1, 5, 1.5, "1"])
    g.action("a", { type: "music", choice: "select", track });
  g.action("b", { type: "music", choice: "next" });
  p.down = true;
  g.action("a", { type: "music", choice: "next" });
  assert.equal(g.jukebox.track, 3);
  p.down = false;
  p.z = -1;
  g.action("a", { type: "music", choice: "next" });
  assert.equal(g.jukebox.track, 3);
});
test("shared pause preserves position, queue loops and music does not block a round", () => {
  const [g, p] = setup();
  g.time = 65;
  g.action("a", { type: "music", choice: "pause" });
  g.time = 600;
  g.updateMusic();
  assert.equal(musicPosition(g.jukebox, g.time), 65);
  g.action("a", { type: "music", choice: "play" });
  g.time += 116;
  g.updateMusic();
  assert.equal(g.jukebox.track, 1);
  assert.equal(musicPosition(g.jukebox, g.time), 1);
  g.time += 180 * 5;
  g.updateMusic();
  assert.equal(g.jukebox.track, 1);
  assert.equal(g.busy(), false);
  g.startRound();
  assert.equal(g.phase, "combat");
  assert.equal(g.jukebox.playing, true);
  assert.equal(p.chips, g.players.b.chips);
});
test("checkpoints retain playlist and old checkpoints get a default playlist", () => {
  const [g] = setup(),
    c = new Checkpoints("test-only");
  g.jukebox = {
    track: 4,
    position: 22,
    startedAt: 12,
    playing: false,
    revision: 3,
  };
  const data = c.open(c.seal(g));
  assert.deepEqual(c.restore(data).jukebox, g.jukebox);
  delete data.jukebox;
  assert.deepEqual(c.restore(data).jukebox, newJukebox());
});
class Media {
  paused = true;
  duration = 180;
  currentTime = 0;
  loads = 0;
  volume = 1;
  setAttribute() {}
  addEventListener() {}
  removeAttribute() {}
  remove() {}
  load() {
    this.loads++;
    this.paused = true;
  }
  pause() {
    this.paused = true;
  }
  async play() {
    if (this.failure) throw this.failure;
    this.paused = false;
  }
}
const player = () => {
  const media = new Media(),
    saved = new Map();
  const audio = { active: true, muted: false, settings: { master: 1 } };
  const music = new BackgroundMusic(audio, {
    media,
    storage: {
      getItem: (k) => saved.get(k),
      setItem: (k, v) => saved.set(k, v),
    },
  });
  const state = { jukebox: newJukebox(), time: 15, phase: "break" };
  return { media, audio, music, state, saved };
};
test("music waits for a gesture, streams one track, obeys volume/mute/focus and combat ducking", async () => {
  const { media, audio, music, state, saved } = player();
  music.update(state);
  assert.equal(media.paused, true);
  assert.equal(media.loads, 1);
  music.unlock();
  await Promise.resolve();
  assert.equal(media.paused, false);
  assert.equal(media.currentTime, 15);
  music.setVolume(0.5);
  assert.equal(saved.get("dead-draw-music-volume"), "0.5");
  audio.settings.master = 0.8;
  state.phase = "combat";
  music.update(state);
  assert.ok(Math.abs(media.volume - 0.5 * 0.64 * 0.42) < 0.00001);
  audio.muted = true;
  music.update(state);
  assert.equal(media.paused, true);
  audio.muted = false;
  audio.active = false;
  music.update(state);
  assert.equal(media.paused, true);
  audio.active = true;
  music.update(state);
  await Promise.resolve();
  assert.equal(media.paused, false);
  assert.equal(media.loads, 1);
  state.jukebox.track = 2;
  state.jukebox.revision++;
  music.update(state);
  assert.equal(media.loads, 2);
  assert.match(media.src, /midnight-roll-of-the-dice.mp3$/);
  music.dispose();
  assert.equal(media.paused, true);
});
test("autoplay denial can be retried and aborted loads do not lock playback", async () => {
  const { media, music, state } = player();
  music.update(state);
  media.failure = { name: "NotAllowedError" };
  music.unlock();
  await Promise.resolve();
  assert.equal(music.blocked, true);
  media.failure = { name: "AbortError" };
  music.unlock();
  await Promise.resolve();
  assert.equal(music.blocked, false);
  media.failure = null;
  music.retry();
  await Promise.resolve();
  assert.equal(media.paused, false);
  assert.equal(music.blocked, false);
});
