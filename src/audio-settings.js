import "./audio-settings.css";
import { installAudioActivation } from "./audio-activation.js";
export function bindAudioSettings(audio, { onEnable } = {}) {
  const $ = (id) => document.getElementById(id);
  // Session permission is deliberately independent of saved volume preferences.
  // Focus changes, gameplay clicks and key presses must never grant permission.
  installAudioActivation(audio, {
    isActive: () => !document.hidden && document.hasFocus(),
    onEnable: () => { onEnable?.(); sync(); },
  });
  const sync = () => {
    $("mute").textContent = !audio.enabled ? "ENABLE SOUND" : audio.muted ? "SOUND OFF" : "SOUND ON";
    $("mute").setAttribute("aria-pressed", String(!audio.enabled || audio.muted));
    if ($("enableSound")) {
      $("enableSound").textContent = !audio.enabled ? "Enable sound" : audio.muted ? "Sound off" : "Sound on";
      $("enableSound").setAttribute("aria-pressed", String(audio.enabled && !audio.muted));
    }
    $("audioMute").checked = audio.muted;
    for (const key of ["master", "effects", "casino", "ambience"]) {
      $("audio-" + key).value = Math.round(audio.settings[key] * 100);
      $("volume-" + key).value = Math.round(audio.settings[key] * 100) + "%";
    }
    $("testSound").disabled = !audio.settings.master;
    $("audioStatus").textContent = !audio.enabled
      ? "Sound is off. Select Enable sound or Test sound to activate it."
      : audio.muted
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
    if (!audio.enabled) return audio.activate();
    audio.muted = !audio.muted;
    audio.start();
    sync();
  };
  $("audioMute").onchange = (e) => {
    if (!e.target.checked && !audio.enabled) return audio.activate();
    audio.muted = e.target.checked;
    audio.start();
    sync();
  };
  $("testSound").onclick = () => {
    audio.activate();
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
  if ($("enableSound")) $("enableSound").onclick = () => {
    if (!audio.enabled || audio.muted) audio.activate();
    else { audio.muted = true; sync(); }
  };
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
