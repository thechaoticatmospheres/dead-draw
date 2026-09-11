import { TRACKS, musicPosition } from "../shared/services.js";
export class BackgroundMusic {
  constructor(audio, { media, storage } = {}) {
    this.audio = audio;
    this.media = media || document.createElement("audio");
    this.media.id = "backgroundMusic";
    this.media.preload = "metadata";
    this.media.setAttribute("aria-hidden", "true");
    if (!media) document.body.appendChild(this.media);
    try {
      this.storage = storage || localStorage;
      const saved = Number(
        this.storage.getItem("dead-draw-music-volume") ?? 0.28,
      );
      this.volume = Number.isFinite(saved)
        ? Math.max(0, Math.min(1, saved))
        : 0.28;
    } catch {
      this.volume = 0.28;
    }
    this.unlocked = false;
    this.blocked = false;
    this.pending = false;
    this.error = "";
    this.track = -1;
    this.revision = -1;
    this.media.addEventListener("loadedmetadata", () => {
      this.seek();
      this.play();
    });
    this.media.addEventListener("error", () => {
      this.error = "Song could not load. Select another track or retry.";
    });
  }
  setVolume(value) {
    if (!Number.isFinite(value)) return;
    this.volume = Math.max(0, Math.min(1, value));
    try {
      this.storage?.setItem("dead-draw-music-volume", String(this.volume));
    } catch {}
    this.update(this.state);
  }
  unlock() {
    this.unlocked = true;
    this.blocked = false;
    if (this.media.paused) this.play();
  }
  retry() {
    this.error = "";
    this.media.load();
    this.unlock();
  }
  seek() {
    if (this.state?.jukebox && Number.isFinite(this.media.duration)) {
      const time = Math.min(
        this.media.duration - 0.05,
        musicPosition(this.state.jukebox, this.state.time),
      );
      if (Math.abs(this.media.currentTime - time) > 1.5)
        this.media.currentTime = Math.max(0, time);
    }
  }
  async play() {
    if (
      !this.unlocked ||
      this.blocked ||
      this.pending ||
      !this.state?.jukebox?.playing ||
      !this.audio.active ||
      this.audio.muted ||
      !this.volume ||
      !this.audio.settings.master ||
      !this.media.paused
    )
      return;
    this.pending = true;
    const source = this.media.src;
    this.seek();
    try {
      await this.media.play();
      this.error = "";
    } catch (error) {
      if (source === this.media.src && error.name !== "AbortError")
        this.blocked = true;
    } finally {
      this.pending = false;
    }
  }
  update(state) {
    this.state = state;
    const j = state?.jukebox;
    if (!j) {
      if (!this.media.paused) this.media.pause();
      return;
    }
    if (this.track !== j.track) {
      this.track = j.track;
      this.error = "";
      this.media.src = `${import.meta.env?.BASE_URL || "/"}assets/music/${TRACKS[j.track].id}.mp3`;
      this.media.load();
    }
    if (this.revision !== j.revision) {
      this.revision = j.revision;
      this.seek();
    }
    const volume =
      this.volume *
      this.audio.settings.master ** 2 *
      (state.phase === "combat" ? 0.42 : 1);
    if (this.media.volume !== volume) this.media.volume = volume;
    if (
      !j.playing ||
      !this.audio.active ||
      this.audio.muted ||
      !this.volume ||
      !this.audio.settings.master
    ) {
      if (!this.media.paused) this.media.pause();
      return;
    }
    if (this.media.paused) this.play();
  }
  dispose() {
    this.media.pause();
    this.media.removeAttribute("src");
    this.media.load();
    this.media.remove();
  }
}
