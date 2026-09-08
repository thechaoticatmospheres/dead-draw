import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await context.addInitScript(() => {
  const WS = window.WebSocket;
  window.WebSocket = class extends WS {
    constructor(...args) {
      super(...args);
      if (String(args[0]).includes("/game")) {
        window.testSocket = this;
        this.addEventListener("message", (e) => {
          const data = JSON.parse(e.data);
          if (data.type === "state") window.testState = data;
          if (data.type === "welcome") window.testId = data.id;
        });
      }
    }
  };
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5188");
await page.waitForTimeout(1800);
await page.screenshot({ path: "test-results/01-title.png" });
await page.locator("#enter").click();
await page.locator("#lobby").waitFor({ state: "visible" });
const code = await page.locator("#lobbyCode").textContent();
const second = await context.newPage();
second.on("pageerror", (e) => errors.push(e.message));
await second.goto("http://127.0.0.1:5188");
await second.locator("#name").fill("Second survivor");
await second.locator("#code").fill(code);
await second.locator("#enter").click();
await second.locator("#lobby").waitFor({ state: "visible" });
await page.waitForFunction(() => window.testState?.players.length === 2);
await page.bringToFront();
await page.locator("#start").click();
await page.waitForFunction(() => window.testState?.phase === "break");
await second.waitForFunction(() => window.testState?.phase === "break");
await page.locator("#world").click({ position: { x: 720, y: 450 } });
await page.waitForFunction(() => document.pointerLockElement?.id === "world");
await page.screenshot({ path: "test-results/02-floor.png" });
const before = await page.evaluate(() =>
  window.testState.players.find((p) => p.id === window.testId),
);
await page.keyboard.down("KeyW");
await page.waitForTimeout(700);
await page.keyboard.up("KeyW");
const after = await page.evaluate(() =>
  window.testState.players.find((p) => p.id === window.testId),
);
assert.ok(after.z < before.z - 1, "W moves player forward");
await page.mouse.down();
await page.waitForTimeout(500);
await page.mouse.up();
await page.waitForTimeout(100);
const fired = await page.evaluate(() =>
  window.testState.players.find((p) => p.id === window.testId),
);
assert.ok(fired.guns[0].ammo < 12, "pointer input fires weapon");
await page.keyboard.press("KeyR");
await page.waitForTimeout(1500);
const reloaded = await page.evaluate(() =>
  window.testState.players.find((p) => p.id === window.testId),
);
assert.equal(reloaded.guns[0].ammo, 12, "reload transfers reserve");
// Real keyboard movement to the slot station during the unlimited intermission.
await page.keyboard.down("KeyA");
await page.waitForTimeout(250);
await page.keyboard.up("KeyA");
await page.keyboard.down("KeyW");
await page.waitForTimeout(450);
await page.keyboard.up("KeyW");
await page.keyboard.press("KeyE");
await page.locator("#casino").waitFor({ state: "visible", timeout: 3000 });
await page.locator('[data-play="slots"]').click();
await page.waitForTimeout(1000);
await page.screenshot({ path: "test-results/03-slots.png" });
await page.waitForFunction(
  () => window.testState.games.slots?.phase === "result",
);
const a = await page.evaluate(() => window.testState.games.slots.reward);
const b = await second.evaluate(() => window.testState.games.slots.reward);
assert.equal(a, b, "casino outcomes synchronized");
await page.screenshot({ path: "test-results/04-payout.png" });
await page.locator("#closeCasino").click();
await page.keyboard.press("Escape");
await page.locator("#nextRound").click();
await page.waitForFunction(
  () => window.testState.players.find((p) => p.id === window.testId).ready,
);
assert.equal(await page.evaluate(() => window.testState.phase), "break");
await second.bringToFront();
await second.locator("#nextRound").click();
await page.waitForFunction(() => window.testState.phase === "combat");
await second.waitForFunction(() => window.testState.phase === "combat");
assert.equal(await page.evaluate(() => window.testState.difficulty.team), 2);
assert.deepEqual(errors, []);
console.log(
  JSON.stringify(
    {
      room: code,
      players: 2,
      movement: true,
      shooting: true,
      reload: true,
      slots: a,
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
