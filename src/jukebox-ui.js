import {
  TRACKS,
  SERVICES,
  canUseService,
  musicPosition,
} from "../shared/services.js";
import "./services.css";
const clock = (s) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, "0")}`;
export class JukeboxUI {
  constructor(music, send) {
    this.music = music;
    this.send = send;
    document.body.insertAdjacentHTML(
      "beforeend",
      `<section id="jukeboxPanel" class="jukebox-panel" hidden><button id="closeJukebox" aria-label="Close jukebox">✕</button><span class="eyebrow">THE GILDED PALM · MUSIC FOR THE LIVING</span><h2>Golden Hour Jukebox</h2><p>Five records. One floor. Your soundtrack.</p><div id="jukeboxBody"></div><label class="music-volume">YOUR MUSIC VOLUME <input id="musicVolume" aria-label="Your music volume" type="range" min="0" max="100" value="${Math.round(music.volume * 100)}"><output id="musicVolumeValue">${Math.round(music.volume * 100)}%</output></label><p class="table-note">Song selection and play/pause affect the crew. Volume affects only you. Music softens during combat and respects Sound Off.</p></section>`,
    );
    this.root = document.getElementById("jukeboxPanel");
    document.getElementById("closeJukebox").onclick = () =>
      (this.root.hidden = true);
    document.getElementById("musicVolume").oninput = (e) => {
      music.setVolume(+e.target.value / 100);
      document.getElementById("musicVolumeValue").textContent =
        e.target.value + "%";
    };
  }
  open(p, state) {
    this.root.hidden = false;
    this.key = "";
    this.render(p, state);
    this.music.unlock();
  }
  render(p, state) {
    if (this.root.hidden) return;
    const j = state?.jukebox;
    if (!j) return;
    const allowed = canUseService(p, SERVICES[0], state.openRooms),
      key = JSON.stringify([j, allowed, this.music.blocked, this.music.error]);
    if (key !== this.key) {
      this.key = key;
      document.getElementById("jukeboxBody").innerHTML =
        `<div class="now-playing"><span class="record-disc ${j.playing ? "record-playing" : ""}">GP</span><div><span class="eyebrow">${j.playing ? "NOW PLAYING" : "PAUSED"}</span><h3>${TRACKS[j.track].title}</h3><span id="musicProgress"></span></div></div><div class="jukebox-controls"><button data-music="previous" ${allowed ? "" : "disabled"}>◀ PREVIOUS</button><button data-music="${j.playing ? "pause" : "play"}" ${allowed ? "" : "disabled"}>${j.playing ? "Ⅱ PAUSE" : "▶ PLAY"}</button><button data-music="next" ${allowed ? "" : "disabled"}>NEXT ▶</button></div><div class="jukebox-tracks">${TRACKS.map((t, i) => `<button data-track="${i}" ${allowed ? "" : "disabled"} aria-pressed="${i === j.track}"><span>${String(i + 1).padStart(2, "0")}</span><strong>${t.title}</strong><small>3:00</small></button>`).join("")}</div><p class="table-note">${allowed ? "Anyone at the jukebox can choose the next song." : "Return to the jukebox in Palm Atrium to change the music."}</p>${this.music.blocked ? '<button id="enableMusic">ENABLE MUSIC ON THIS BROWSER</button>' : ""}${this.music.error ? `<p role="status">${this.music.error}</p><button id="retryMusic">RETRY SONG</button>` : ""}`;
      this.root.querySelectorAll("[data-music],[data-track]").forEach(
        (b) =>
          (b.onclick = () => {
            this.music.unlock();
            this.send({
              type: "music",
              choice: b.dataset.music || "select",
              track:
                b.dataset.track === undefined ? undefined : +b.dataset.track,
            });
          }),
      );
      this.root
        .querySelector("#enableMusic")
        ?.addEventListener("click", () => this.music.unlock());
      this.root
        .querySelector("#retryMusic")
        ?.addEventListener("click", () => this.music.retry());
    }
    document.getElementById("musicProgress").textContent =
      clock(Math.min(180, musicPosition(j, state.time))) + " / 3:00";
  }
}
