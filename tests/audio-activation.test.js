import test from "node:test";
import assert from "node:assert/strict";
import { installAudioActivation } from "../src/audio-activation.js";

test("saved unmuted preferences and incidental focus/start never activate playback", () => {
  let starts = 0, unlocked = 0;
  const audio = {
    muted: false, settings: { master:.37, effects:.82, ambience:.16 },
    start() { starts++; },
    setActive(value) { this.active=value; if(value)this.start(); },
  };
  const originalSettings={...audio.settings};
  installAudioActivation(audio,{onEnable:()=>unlocked++});
  audio.start();
  audio.setActive(false);
  audio.setActive(true);
  audio.start();
  assert.equal(starts,0);
  assert.equal(unlocked,0);
  assert.equal(audio.enabled,false);
  assert.deepEqual(audio.settings,originalSettings);
  audio.activate();
  assert.equal(audio.enabled,true);
  assert.ok(starts>0);
  assert.equal(unlocked,1);
  assert.deepEqual(audio.settings,originalSettings,"activation keeps the saved mix");
});
