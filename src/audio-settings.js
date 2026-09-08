import "./audio-settings.css";
export function bindAudioSettings(audio) {
  const $ = (id) => document.getElementById(id);
  const sync = () => {
    $("mute").textContent = audio.muted ? "SOUND OFF" : "SOUND ON";
    $("mute").setAttribute("aria-pressed", String(audio.muted));
    $("audioMute").checked = audio.muted;
    for (const key of ["master", "effects", "casino", "ambience"]) {
      $("audio-" + key).value = Math.round(audio.settings[key] * 100);
      $("volume-" + key).value = Math.round(audio.settings[key] * 100) + "%";
    }
    $("testSound").disabled = audio.muted || !audio.settings.master;
    $("audioStatus").textContent = audio.muted
      ? "All sound muted."
      : !audio.ctx || audio.ctx.state !== "running"
        ? "Select Test sound to enable audio."
        : "Sound ready · Headphones bring out directional cues.";
  };
  for (const key of ["master", "effects", "casino", "ambience"]) {
    $("audio-" + key).oninput = (e) => {
      audio.set(key, Number(e.target.value) / 100);
      sync();
    };
    $("audio-" + key).onchange = () => {
      audio.start();
      audio.play(
        key === "casino" ? "chips" : key === "ambience" ? "neon" : "ui",
      );
      sync();
    };
  }
  $("mute").onclick = () => {
    audio.muted = !audio.muted;
    audio.start();
    sync();
  };
  $("audioMute").onchange = (e) => {
    audio.muted = e.target.checked;
    audio.start();
    sync();
  };
  $("testSound").onclick = () => {
    audio.start();
    requestAnimationFrame(() => {
      audio.test();
      sync();
    });
  };
  const focus = () => {
    audio.setActive(!document.hidden && document.hasFocus());
    requestAnimationFrame(sync);
  };
  addEventListener("blur", focus);
  addEventListener("focus", focus);
  document.addEventListener("visibilitychange", focus);
  const unlock = () => {
    audio.setActive(!document.hidden && document.hasFocus());
    audio.start();
  };
  addEventListener("pointerdown", unlock, { capture: true });
  addEventListener(
    "keydown",
    (e) => {
      if (e.isTrusted) unlock();
    },
    { capture: true },
  );
  document.addEventListener(
    "click",
    (e) => {
      const button = e.target.closest("button,summary");
      if (
        button &&
        !button.disabled &&
        !["mute", "testSound"].includes(button.id)
      )
        audio.play(button.matches("[data-hold]") ? "hold" : "ui");
      requestAnimationFrame(sync);
    },
    true,
  );
  document.addEventListener("focusin", (e) => {
    if (e.target.matches("button,summary,select")) audio.play("focus");
  });
  addEventListener("pagehide", () => audio.setActive(false));
  if (import.meta.hot) import.meta.hot.dispose(() => audio.dispose());
  sync();
}
