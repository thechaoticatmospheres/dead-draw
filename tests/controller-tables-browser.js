import http from "node:http";
import { WebSocketServer } from "ws";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { Game } from "../server/game.js";
import { ROOMS } from "../shared/map.js";
import { STATIONS } from "../shared/data.js";
const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: 6192 } },
    appType: "spa",
  }),
  server = http.createServer(vite.middlewares),
  wss = new WebSocketServer({ server, path: "/game" }),
  game = new Game("PADQA", () => 0.1);
wss.on("connection", (ws) =>
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "join") {
      game.addPlayer("qa", "Controller QA");
      ws.send(JSON.stringify({ type: "welcome", id: "qa", code: game.code }));
    } else game.action("qa", m);
  }),
);
const interval = setInterval(() => {
  game.update(1 / 30);
  const s = JSON.stringify({ type: "state", ...game.snapshot() });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(s);
}, 1000 / 30);
await new Promise((r) => server.listen(5192, "127.0.0.1", r));
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript(() => {
    window.pad = {
      id: "Standard gamepad fixture",
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", {
      value: () => [window.pad],
    });
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5192");
  await page.bringToFront();
  await page.locator('#world[data-graphics="ready"]').waitFor();
  await page.waitForTimeout(300);
  const press = async (n) => {
    await page.evaluate(
      (n) => (window.pad.buttons[n] = { pressed: true, value: 1 }),
      n,
    );
    await page.waitForTimeout(80);
    await page.evaluate(
      (n) => (window.pad.buttons[n] = { pressed: false, value: 0 }),
      n,
    );
    await page.waitForTimeout(90);
  };
  const focus = async (selector) => {
    for (let i = 0; i < 95; i++) {
      if (await page.locator(selector + ".pad-focus").count()) return;
      await press(5);
    }
    throw Error("Controller could not reach " + selector);
  };
  const select = async (selector) => {
    await focus(selector);
    await press(0);
  };
  await press(0);
  await page.locator("#lobby").waitFor();
  await press(0);
  await page.waitForFunction(() =>
    document.getElementById("phase").textContent.includes("INTERMISSION"),
  );
  const p = game.players.qa;
  p.chips = 5000;
  const place = async (x, z) => {
    p.x = x;
    p.z = z;
    await page.waitForTimeout(300);
  };
  await place(-6, 9);
  await press(0);
  assert.ok(game.openRooms.includes("emerald"));
  assert.equal(p.chips, 4925);
  await place(-16, 2);
  await press(0);
  assert.ok(game.openRooms.includes("arcade"));
  await place(-10, -9);
  await press(0);
  assert.ok(game.openRooms.includes("crown"));
  await place(6, 9);
  await press(0);
  await place(16, 2);
  await press(0);
  assert.equal(game.openRooms.length, 6);
  for (const id of [
    "poker",
    "craps",
    "baccarat",
    "blackjack",
    "roulette",
    "slots",
  ]) {
    const s = STATIONS.find((s) => s.id === id);
    await place(s.x, s.z + 3);
    await press(0);
    await page.locator("#casino").waitFor();
    if (id === "roulette") {
      await select('[data-position="red"]');
      assert.equal(
        await page.locator('[data-position="red"] .placed-chip').textContent(),
        "10",
      );
    }
    await select('[data-play="' + id + '"]');
    if (id === "poker") {
      await page.locator('[data-hold="0"]').waitFor();
      await select('[data-hold="0"]');
      await select('[data-hold="1"]');
      assert.equal(await page.locator(".hold-card.held").count(), 2);
      await page.screenshot({ path: "test-results/44-controller-poker.png" });
      await select("[data-draw]");
    }
    if (id === "craps") {
      game.rng = () => 0.4;
      await select('[data-action="roll"]');
      await page.waitForFunction(
        () => document.querySelector(".craps-point b")?.textContent === "6",
      );
      await select('[data-action="roll"]');
    }
    if (id === "blackjack") {
      await page.waitForFunction(
        () =>
          document.querySelector(".hand-decisions") ||
          document.querySelector(".settlement"),
      );
      if (game.games.blackjack.phase === "decision")
        await select('[data-action="stand"]');
    }
    await page.locator(".settlement").waitFor({ timeout: 15000 });
    await page.screenshot({
      path: "test-results/45-controller-" + id + "-result.png",
    });
    await press(1);
    assert.equal(await page.locator("#casino").isVisible(), false);
    await page.waitForTimeout(250);
    assert.equal(game.games[id], undefined, "Back releases a completed table");
    console.log("Controller table passed: " + id);
  }
  await press(9);
  await page.locator("#help").waitFor();
  await focus("#padSensitivity");
  const initial = +(await page.locator("#padSensitivity").inputValue());
  await press(15);
  assert.ok(+(await page.locator("#padSensitivity").inputValue()) > initial);
  await select("#padInvert");
  assert.equal(await page.locator("#padInvert").isChecked(), true);
  await focus("#graphicsQuality");
  await press(15);
  assert.equal(await page.locator("#graphicsQuality").inputValue(), "low");
  await page.screenshot({ path: "test-results/46-controller-options.png" });
  await press(1);
  await press(13);
  await page.waitForFunction(() =>
    document.getElementById("phase").textContent.includes("GUESTS REMAIN"),
  );
  assert.equal(game.phase, "combat");
  await press(0);
  assert.equal(await page.locator("#casino").isVisible(), false);
  // A populated scene exercises animation, shadows, model instancing and both quality modes.
  game.pending = 0;
  game.openRooms = ROOMS.map((r) => r.id);
  p.hp = 100000;
  p.x = 0;
  p.z = -3;
  game.zombies = Array.from({ length: 36 }, (_, i) => ({
    id: 1000 + i,
    x: [-5.5, -2.5, 2.5, 5.5][i % 4],
    z: -13 + Math.floor(i / 4) * 1.1,
    hp: 1000,
    speed: 0.2,
    stun: 0,
    attack: 0,
  }));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "test-results/47-combat-performance.png" });
  const measure = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const times = [];
          let last = performance.now();
          function sample(t) {
            times.push(t - last);
            last = t;
            if (times.length < 75) requestAnimationFrame(sample);
            else
              resolve({
                fps: Math.round(
                  1000 / (times.reduce((a, b) => a + b) / times.length),
                ),
                drawCalls: +document.getElementById("world").dataset.drawCalls,
                triangles: +document.getElementById("world").dataset.triangles,
              });
          }
          requestAnimationFrame(sample);
        }),
    );
  const low = await measure();
  await press(9);
  await focus("#graphicsQuality");
  await press(14);
  await press(1);
  await page.waitForTimeout(700);
  const high = await measure();
  await page.screenshot({ path: "test-results/48-combat-cinematic.png" });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        result:
          "PASS: controller-only unlocks, six casino games, poker holds, craps point rolls, baccarat/blackjack/roulette/slots settlement, options, manual next round and combat lockout",
        low,
        high,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  clearInterval(interval);
  for (const ws of wss.clients) ws.terminate();
  wss.close();
  server.close();
  await vite.close();
}
