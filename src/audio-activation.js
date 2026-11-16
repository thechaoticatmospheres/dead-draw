// Permission lasts for this page only. It is never inferred from saved settings.
export function installAudioActivation(audio, { isActive = () => true, onEnable } = {}) {
  audio.enabled = false;
  const start = audio.start.bind(audio);
  audio.start = () => { if (audio.enabled) start(); };
  audio.activate = () => {
    audio.enabled = true;
    audio.muted = false;
    audio.setActive(isActive());
    start();
    onEnable?.();
  };
  return audio;
}
