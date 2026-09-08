// Injects standard Gamepad API samples. This checks browser integration, not physical hardware.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    window.virtualPad = {
      id: "Xbox standard test controller",
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({
        pressed: false,
        touched: false,
        value: 0,
      })),
    };
    window.testFocused = true;
    Object.defineProperty(document, "hasFocus", {
      value: () => window.testFocused,
    });
    Object.defineProperty(navigator, "getGamepads", {
      value: () => (window.virtualPad ? [window.virtualPad] : []),
    });
    const WS = window.WebSocket;
    window.WebSocket = class extends WS {
      constructor(...args) {
        super(...args);
        this.addEventListener("message", (e) => {
          const m = JSON.parse(e.data);
          if (m.type === "state") window.testState = m;
          if (m.type === "welcome") window.testId = m.id;
        });
      }
    };
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5188");
  await page.bringToFront();
  await page
    .locator('#world[data-graphics="ready"]')
    .waitFor({ timeout: 30000 });
  await page.waitForTimeout(500);
  const set = async (button, value) =>
    page.evaluate(
      ({ button, value }) => {
        window.virtualPad.buttons[button] = {
          pressed: value,
          touched: value,
          value: value ? 1 : 0,
        };
      },
      { button, value },
    );
  const press = async (button) => {
    await set(button, true);
    await page.waitForTimeout(140);
    await set(button, false);
    await page.waitForTimeout(160);
  };
  const axes = async (values) =>
    page.evaluate((values) => (window.virtualPad.axes = values), values);
  const player = () =>
    page.evaluate(() =>
      window.testState.players.find((p) => p.id === window.testId),
    );
  await page.screenshot({ path: "test-results/40-graphics-title.png" });
  await press(0);
  await page.locator("#lobby").waitFor();
  await press(0);
  await page.waitForFunction(() => window.testState?.phase === "break");
  assert.equal(
    await page.evaluate(() => document.pointerLockElement),
    null,
    "controller never requires pointer lock",
  );
  const before = await player();
  await axes([0, -1, 0, 0]);
  await page.waitForTimeout(550);
  await axes([0, 0, 0, 0]);
  const after = await player();
  assert.ok(after.z < before.z - 1, "left stick moves");
  await axes([0, 0, 0.6, 0.2]);
  await page.waitForTimeout(400);
  await axes([0, 0, 0, 0]);
  assert.ok((await player()).yaw < before.yaw - 0.2, "right stick looks");
  await set(6, true);
  await set(7, true);
  await page.waitForTimeout(500);
  await set(7, false);
  await set(6, false);
  assert.ok((await player()).guns[0].ammo < 12, "triggers aim and fire");
  await press(2);
  await page.waitForTimeout(1600);
  assert.equal((await player()).guns[0].ammo, 12, "X reloads");
  await page.screenshot({ path: "test-results/41-controller-floor.png" });
  await press(8);
  await page.locator("#floorplan").waitFor();
  await page.screenshot({ path: "test-results/42-controller-map.png" });
  await press(1);
  assert.equal(await page.locator("#floorplan").isVisible(), false);
  await press(9);
  await page.locator("#help").waitFor();
  await page.screenshot({ path: "test-results/43-controller-settings.png" });
  await press(1);
  assert.equal(await page.locator("#help").isVisible(), false);
  // Verify background input is cleared even if the last sample held the trigger.
  await set(7, true);
  await axes([0, -1, 0, 0]);
  await page.evaluate(() => {
    window.testFocused = false;
    window.dispatchEvent(new Event("blur"));
  });
  await page.waitForTimeout(500);
  const stopped = await player();
  await page.waitForTimeout(400);
  const still = await player();
  assert.ok(Math.abs(still.z - stopped.z) < 0.05);
  assert.equal(still.guns[0].ammo, stopped.guns[0].ammo);
  await page.evaluate(() => (window.testFocused = true));
  await page.waitForTimeout(300);
  assert.equal(
    (await player()).guns[0].ammo,
    stopped.guns[0].ammo,
    "focus requires neutral controls",
  );
  await set(7, false);
  await axes([0, 0, 0, 0]);
  await page.waitForTimeout(250);
  await page.evaluate(() => (window.virtualPad = null));
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(() => document.body.dataset.input),
    "keyboard",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: controller host/start, analog movement/look, aim/fire/reload, map, settings, menu back, blur neutral rearm, disconnect. No browser errors.",
  );
} finally {
  await browser.close();
}
