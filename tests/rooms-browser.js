// Real UI/socket coverage on an isolated server. Funding and seating are fixture setup.
import http from "node:http";
import { WebSocketServer } from "ws";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { Game } from "../server/game.js";
import { baccaratFromShoe } from "../server/extra-games.js";
await mkdir("test-results", { recursive: true });
const vite = await createServer({
  server: { middlewareMode: true, hmr: { port: 6191 } },
  appType: "spa",
});
const server = http.createServer(vite.middlewares),
  wss = new WebSocketServer({ server, path: "/game" }),
  game = new Game("ROOMQA", () => 0.1);
let count = 0;
wss.on("connection", (ws) => {
  let id;
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "join") {
      id = "qa" + ++count;
      game.addPlayer(id, m.name);
      ws.send(JSON.stringify({ type: "welcome", id, code: game.code }));
    } else game.action(id, m);
  });
  ws.on("close", () => game.removePlayer(id));
});
const interval = setInterval(() => {
  game.update(1 / 30);
  const s = JSON.stringify({ type: "state", ...game.snapshot() });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(s);
}, 1000 / 30);
await new Promise((r) => server.listen(5191, "127.0.0.1", r));
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  await context.addInitScript(() => {
    const WS = window.WebSocket;
    window.WebSocket = class extends WS {
      constructor(...args) {
        super(...args);
        this.addEventListener("message", (e) => {
          const m = JSON.parse(e.data);
          if (m.type === "state") window.testState = m;
        });
      }
    };
  });
  const page = await context.newPage(),
    crew = await context.newPage();
  for (const [i, p] of [page, crew].entries()) {
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:5191");
    await p.locator("#name").fill(i ? "Door watcher" : "Room tester");
    await p.locator("#enter").click();
    await p.locator("#lobby").waitFor();
  }
  await page.bringToFront();
  await page.locator("#start").click();
  await page.waitForFunction(() => window.testState?.phase === "break");
  const p = game.players.qa1;
  p.chips = 2000;
  const place = async (x, z) => {
    p.x = x;
    p.z = z;
    await page.waitForTimeout(250);
  };
  const engage = async () => {
    if (!(await page.evaluate(() => !!document.pointerLockElement))) {
      await page.locator("#world").click({ position: { x: 720, y: 450 } });
      await page.waitForFunction(() => document.pointerLockElement);
    }
  };
  await place(-6, 9);
  await engage();
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyA");
  assert.ok(p.x > -8, "closed shutter stops keyboard movement");
  await page.keyboard.press("KeyM");
  await page.locator("#floorplan").waitFor();
  assert.equal(await page.locator(".floor-room.locked").count(), 5);
  await page.screenshot({ path: "test-results/20-locked-floorplan.png" });
  await page.locator("#closeMap").click();
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() =>
    window.testState.openRooms.includes("emerald"),
  );
  await crew.waitForFunction(() =>
    window.testState.openRooms.includes("emerald"),
  );
  assert.equal(p.chips, 1925);
  assert.equal(game.players.qa2.chips, 25);
  await page.keyboard.down("KeyA");
  await page.waitForTimeout(900);
  await page.keyboard.up("KeyA");
  assert.ok(p.x < -8, "purchased shutter permits keyboard movement");
  await page.screenshot({ path: "test-results/21-emerald-open.png" });
  await place(-16, 2);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() =>
    window.testState.openRooms.includes("arcade"),
  );
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1000);
  await page.keyboard.up("KeyW");
  assert.ok(p.z < 0, "north door admits players");
  await place(-17, -6);
  await page.keyboard.press("KeyE");
  await page.locator('[data-play="poker"]').waitFor();
  await page.screenshot({ path: "test-results/22-poker-cabinet.png" });
  await page.locator('[data-play="poker"]').click();
  await page.locator('[data-hold="0"]').waitFor();
  // Set a legal two-pair draw so the UI and account assertions do not depend on luck.
  const card = (rank, suit = "♠") => ({ rank, suit }),
    pg = game.games.poker;
  pg.cards = [card(11), card(11, "♥"), card(4), card(8), card(2)];
  pg.deck = [card(9, "♦"), card(9), card(3)];
  await page.waitForTimeout(250);
  await page.locator('[data-hold="0"]').click();
  await page.locator('[data-hold="1"]').click();
  assert.equal(await page.locator(".hold-card.held").count(), 2);
  assert.equal(await page.locator("#nextRound").isDisabled(), true);
  await page.screenshot({ path: "test-results/23-poker-hold.png" });
  const pokerBank = p.chips;
  await page.locator("[data-draw]").click();
  await page.locator(".settlement").waitFor();
  assert.equal(p.chips, pokerBank + 50);
  assert.ok(p.guns.some((g) => g.id === "pitViper"));
  await page.screenshot({ path: "test-results/24-poker-result.png" });
  await page.locator("#closeCasino").click();
  await place(-10, -9);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() =>
    window.testState.openRooms.includes("crown"),
  );
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(1000);
  await page.keyboard.up("KeyD");
  assert.ok(p.x > -8);
  await place(0, 2);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1000);
  await page.keyboard.up("KeyW");
  assert.ok(p.z < 0, "Crown unlock opens the Atrium shortcut");
  await place(0, -7);
  await page.keyboard.press("KeyE");
  await page.locator('[data-play="baccarat"]').waitFor();
  await page.screenshot({ path: "test-results/25-baccarat-ready.png" });
  const baccaratBank = p.chips;
  await page.locator('[data-play="baccarat"]').click();
  await page.waitForFunction(() => !!window.testState.games.baccarat);
  Object.assign(
    game.games.baccarat,
    baccaratFromShoe([card(5), card(3), card(4), card(4)], "banker", 20),
  );
  await page.waitForTimeout(1700);
  await page.screenshot({ path: "test-results/26-baccarat-dealing.png" });
  await page.locator(".settlement").waitFor();
  assert.equal(p.chips, baccaratBank + 19);
  await page.screenshot({ path: "test-results/27-baccarat-result.png" });
  await page.locator("#closeCasino").click();
  await place(6, 9);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() =>
    window.testState.openRooms.includes("velvet"),
  );
  await place(16, 2);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.testState.openRooms.includes("dice"));
  await place(17, -5);
  await page.keyboard.press("KeyE");
  await page.locator('[data-play="craps"]').waitFor();
  await page.screenshot({ path: "test-results/28-craps-ready.png" });
  const crapsBank = p.chips;
  await page.locator('[data-play="craps"]').click();
  await page.locator('[data-action="roll"]').waitFor();
  game.rng = () => 0.4;
  await page.locator('[data-action="roll"]').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/29-craps-rolling.png" });
  await page.locator('[data-action="roll"]').waitFor();
  assert.equal(game.games.craps.point, 6);
  await page.screenshot({ path: "test-results/30-craps-point.png" });
  await page.locator('[data-action="roll"]').click();
  await page.locator(".settlement").waitFor();
  assert.equal(p.chips, crapsBank + 25);
  assert.equal(p.armor, 75);
  await page.screenshot({ path: "test-results/31-craps-result.png" });
  await page.locator("#closeCasino").click();
  await page.keyboard.press("KeyM");
  assert.equal(await page.locator(".floor-room.unlocked").count(), 6);
  await page.screenshot({ path: "test-results/32-open-floorplan.png" });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: "test-results/33-map-compact.png" });
  await page.locator("#closeMap").click();
  await page.keyboard.press("KeyE");
  await page.screenshot({ path: "test-results/34-craps-compact.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.locator("#closeCasino").click();
  await page.keyboard.press("Escape");
  await page.locator("#nextRound").click();
  await crew.bringToFront();
  await crew.locator("#nextRound").click();
  await page.waitForFunction(() => window.testState.phase === "combat");
  assert.equal(game.difficulty.team, 2);
  await page.bringToFront();
  await engage();
  await page.keyboard.press("KeyE");
  assert.equal(await page.locator("#casino").isVisible(), false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: six rooms purchased crew-wide; locked/open movement; Crown shortcut; poker hold/draw and shotgun payout; baccarat commission; craps point rolls and armor; map at two sizes; co-op readiness and combat lockout. No browser errors.",
  );
} finally {
  await browser.close();
  clearInterval(interval);
  for (const ws of wss.clients) ws.terminate();
  wss.close();
  server.close();
  await vite.close();
}
