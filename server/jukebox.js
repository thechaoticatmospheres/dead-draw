import {
  TRACKS,
  SERVICES,
  canUseService,
  musicPosition,
} from "../shared/services.js";
export const jukeboxMethods = {
  controlMusic(p, msg) {
    if (
      !["break", "combat"].includes(this.phase) ||
      !canUseService(p, SERVICES[0], this.openRooms) ||
      this.time < (p.musicAt || 0)
    )
      return;
    const j = this.jukebox;
    if (!["play", "pause", "next", "previous", "select"].includes(msg.choice))
      return;
    if (
      msg.choice === "select" &&
      (!Number.isInteger(msg.track) || !TRACKS[msg.track])
    )
      return;
    p.musicAt = this.time + 0.3;
    j.position = musicPosition(j, this.time);
    j.startedAt = this.time;
    if (msg.choice === "pause") j.playing = false;
    else if (msg.choice === "play") j.playing = true;
    else {
      j.track =
        msg.choice === "select"
          ? msg.track
          : (j.track + (msg.choice === "next" ? 1 : TRACKS.length - 1)) %
            TRACKS.length;
      j.position = 0;
      j.playing = true;
    }
    j.revision++;
    this.event("notice", {
      text: `${p.name} ${j.playing ? "selected " + TRACKS[j.track].title : "paused the jukebox"}.`,
    });
  },
  updateMusic() {
    const j = this.jukebox;
    if (!j.playing) return;
    let position = musicPosition(j, this.time);
    if (position < TRACKS[j.track].duration) return;
    while (position >= TRACKS[j.track].duration) {
      position -= TRACKS[j.track].duration;
      j.track = (j.track + 1) % TRACKS.length;
    }
    j.position = position;
    j.startedAt = this.time;
    j.revision++;
  },
};
