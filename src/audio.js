import { soundCue } from "./audio-cues.js";
export const AUDIO_DEFAULTS = {
  master: 0.7,
  effects: 0.85,
  casino: 0.75,
  ambience: 0.35,
  muted: false,
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function audioSettings(value = {}) {
  const result = { ...AUDIO_DEFAULTS };
  for (const key of ["master", "effects", "casino", "ambience"])
    if (typeof value?.[key] === "number" && Number.isFinite(value[key]))
      result[key] = clamp(value[key], 0, 1);
  result.muted = value?.muted === true;
  return result;
}
export function spatialMix(listener, source, blocked = false) {
  if (
    !listener ||
    !source ||
    !Number.isFinite(source.x) ||
    !Number.isFinite(source.z)
  )
    return { gain: 1, pan: 0, cutoff: 16000 };
  const x = source.x - listener.x,
    z = source.z - listener.z,
    d = Math.hypot(x, z);
  return {
    gain: d >= 26 ? 0 : (1 - d / 26) ** 2 * (blocked ? 0.28 : 1),
    pan: clamp(
      (x * Math.cos(listener.yaw || 0) - z * Math.sin(listener.yaw || 0)) /
        Math.max(2, d),
      -0.95,
      0.95,
    ),
    cutoff: blocked ? 650 : Math.max(2200, 16000 - d * 420),
  };
}
// Procedural Foley shares a mixer, room tail and cached noise; each cue disposes its nodes.
export class Audio {
  constructor({ contextFactory, storage } = {}) {
    this.contextFactory =
      contextFactory ||
      (() => new (globalThis.AudioContext || globalThis.webkitAudioContext)());
    try {
      this.storage = storage ?? globalThis.localStorage;
    } catch {}
    let saved;
    try {
      saved = JSON.parse(this.storage?.getItem("dead-draw-audio") || "{}");
    } catch {}
    this.settings = audioSettings(saved);
    this.ctx = null;
    this.active = true;
    this.voices = new Set();
    this.cooldowns = new Map();
    this.listener = null;
    this.ducked = false;
  }
  get muted() {
    return this.settings.muted;
  }
  set muted(value) {
    this.set("muted", !!value);
  }
  set(key, value) {
    if (!(key in AUDIO_DEFAULTS)) return;
    this.settings = audioSettings({ ...this.settings, [key]: value });
    try {
      this.storage?.setItem("dead-draw-audio", JSON.stringify(this.settings));
    } catch {}
    if (this.muted || !this.settings.master) this.stopAll();
    // Stop already-scheduled cues in a category turned off, including their reverb sends.
    if (this.settings[key] === 0)
      for (const voice of [...this.voices]) if (voice.bus === key) voice.stop();
    this.mix();
  }
  start() {
    if (!this.active) return;
    try {
      if (!this.ctx) this.createGraph();
      if (this.ctx.state === "suspended") this.ctx.resume()?.catch(() => {});
      this.mix();
    } catch {
      /* Audio failure must not prevent play. */
    }
  }
  createGraph() {
    const c = (this.ctx = this.contextFactory());
    this.output = c.createGain();
    this.limiter = c.createDynamicsCompressor();
    Object.assign(this.limiter.threshold, { value: -12 });
    this.limiter.knee.value = 12;
    this.limiter.ratio.value = 8;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;
    // The compressor shapes loudness; a soft ceiling catches its attack-time overshoot.
    this.ceiling = c.createWaveShaper();
    const curve = new Float32Array(4096);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1,
        level = Math.abs(x);
      curve[i] =
        Math.sign(x) *
        (level <= 0.7
          ? level
          : 0.7 + 0.25 * (1 - Math.exp(-(level - 0.7) / 0.25)));
    }
    this.ceiling.curve = curve;
    this.ceiling.oversample = "2x";
    this.limiter
      .connect(this.ceiling)
      .connect(this.output)
      .connect(c.destination);
    this.buses = Object.fromEntries(
      ["effects", "casino", "ambience"].map((name) => {
        const bus = c.createGain();
        bus.connect(this.limiter);
        return [name, bus];
      }),
    );
    this.room = c.createConvolver();
    const impulse = c.createBuffer(
      2,
      Math.ceil(c.sampleRate * 0.7),
      c.sampleRate,
    );
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3 * 0.25;
    }
    this.room.buffer = impulse;
    this.room.connect(this.limiter);
    this.noiseBuffer = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const noise = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
  }
  mix() {
    if (!this.output) return;
    const at = this.ctx.currentTime;
    const target = (p, v) => {
      p.cancelScheduledValues(at);
      p.setTargetAtTime(v, at, 0.025);
    };
    target(
      this.output.gain,
      this.active && !this.muted ? this.settings.master ** 2 : 0,
    );
    for (const [name, bus] of Object.entries(this.buses))
      target(
        bus.gain,
        this.settings[name] ** 2 *
          (this.ducked && name !== "effects" ? 0.35 : 1),
      );
    for (const voice of this.voices)
      target(
        voice.send.gain,
        voice.wet *
          this.settings[voice.bus] ** 2 *
          (this.ducked && voice.bus !== "effects" ? 0.35 : 1),
      );
  }
  setActive(active) {
    if (this.active === active) return;
    this.active = active;
    if (!active) {
      this.stopAll();
      this.mix();
      this.ctx?.suspend()?.catch(() => {});
    } else this.start();
  }
  duck(value) {
    if (this.ducked !== value) {
      this.ducked = value;
      this.mix();
    }
  }
  stopAll() {
    for (const voice of [...this.voices]) voice.stop();
    this.cooldowns.clear();
  }
  play(name, options = {}) {
    const cue = soundCue(name, options);
    return cue
      ? this.layers(cue.layers, {
          ...cue,
          ...options,
          key: options.key || name,
        })
      : false;
  }
  layers(
    layers,
    {
      bus = "effects",
      gain = 1,
      source,
      blocked = false,
      key,
      cooldown = 0,
      priority = 1,
      wet = 0.08,
      delay = 0,
    } = {},
  ) {
    const c = this.ctx;
    if (
      !c ||
      c.state !== "running" ||
      !this.active ||
      this.muted ||
      !this.settings.master ||
      !this.settings[bus]
    )
      return false;
    const space = spatialMix(this.listener, source, blocked);
    if (space.gain * gain < 0.008) return false;
    const count = [...this.voices].reduce((n, v) => n + v.count, 0);
    if (count + layers.length > (priority >= 2 ? 96 : 64)) return false;
    if (key && c.currentTime < (this.cooldowns.get(key) || 0)) return false;
    if (key) this.cooldowns.set(key, c.currentTime + cooldown);
    if (this.cooldowns.size > 256)
      for (const [id, until] of this.cooldowns)
        if (until <= c.currentTime) this.cooldowns.delete(id);
    const channel = c.createGain(),
      filter = c.createBiquadFilter(),
      pan = c.createStereoPanner(),
      send = c.createGain();
    channel.gain.value = gain * space.gain * 2;
    filter.type = "lowpass";
    filter.frequency.value = space.cutoff;
    pan.pan.value = space.pan;
    channel.connect(filter).connect(pan).connect(this.buses[bus]);
    send.gain.value =
      wet *
      this.settings[bus] ** 2 *
      (this.ducked && bus !== "effects" ? 0.35 : 1);
    pan.connect(send).connect(this.room);
    const nodes = [channel, filter, pan, send],
      sources = [];
    let remaining = layers.length,
      disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      for (const n of nodes) n.disconnect();
      this.voices.delete(voice);
    };
    const voice = {
      count: layers.length,
      bus,
      send,
      wet,
      stop: () => {
        for (const s of sources) {
          try {
            s.stop();
          } catch {}
        }
        dispose();
      },
    };
    this.voices.add(voice);
    for (const layer of layers) {
      const at = c.currentTime + delay + (layer.at || 0),
        duration = Math.max(0.015, layer.duration || 0.1),
        s = layer.noise ? c.createBufferSource() : c.createOscillator(),
        env = c.createGain(),
        f = c.createBiquadFilter();
      if (layer.noise) {
        s.buffer = this.noiseBuffer;
        s.loop = true;
      } else {
        s.type = layer.type || "sine";
        s.frequency.setValueAtTime(layer.freq || 220, at);
        s.frequency.exponentialRampToValueAtTime(
          Math.max(20, layer.end || layer.freq || 220),
          at + duration,
        );
        s.detune.value = (Math.random() - 0.5) * (layer.variation ?? 24);
      }
      f.type = layer.filter || "lowpass";
      f.frequency.setValueAtTime(layer.cutoff || 12000, at);
      if (layer.toCutoff)
        f.frequency.exponentialRampToValueAtTime(layer.toCutoff, at + duration);
      f.Q.value = layer.q || 0.7;
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(
        Math.max(0.0002, layer.gain || 0.05),
        at + Math.min(duration / 3, layer.attack || 0.003),
      );
      env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      s.connect(f).connect(env).connect(channel);
      sources.push(s);
      nodes.push(s, f, env);
      s.onended = () => {
        if (--remaining === 0) dispose();
      };
      if (layer.noise) s.start(at, Math.random() * 0.5);
      else s.start(at);
      s.stop(at + duration + 0.01);
    }
    return true;
  }
  chip() {
    this.play("chips");
  }
  tone(freq = 440, duration = 0.1, type = "sine", gain = 0.04, delay = 0) {
    return this.layers([{ freq, duration, type, gain }], { delay });
  }
  test() {
    this.play("shot", { weapon: "courtesy" });
    this.play("chips", { delay: 0.35 });
    this.play("win", { delay: 0.7 });
  }
  dispose() {
    this.stopAll();
    this.ctx?.close()?.catch(() => {});
    this.ctx = null;
    this.output = null;
  }
}
