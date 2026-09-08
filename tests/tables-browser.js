// Isolated fixture: uses real simulation and UI, with a funded guest for repeatable table QA.
import http from "node:http";
import { WebSocketServer } from "ws";
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import { Game } from "../server/game.js";
import assert from "node:assert/strict";
const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: 6190 } },
    appType: "spa",
  }),
  server = http.createServer(vite.middlewares),
  wss = new WebSocketServer({ server, path: "/game" }),
  game = new Game("QA1234", () => 0.1);
wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.type === "join") {
      game.addPlayer("qa", "Table tester");
      game.restart();

      game.openRooms = [
        "atrium",
        "emerald",
        "velvet",
        "arcade",
        "dice",
        "crown",
      ];
      game.players.qa.x = -17;
      game.players.qa.z = 10;
      game.players.qa.chips = 500;
      ws.send(JSON.stringify({ type: "welcome", id: "qa", code: game.code }));
    } else game.action("qa", m);
  });
});
const interval = setInterval(() => {
  game.update(1 / 30);
  const s = JSON.stringify({ type: "state", ...game.snapshot() });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(s);
}, 1000 / 30);
await new Promise((r) => server.listen(5190, "127.0.0.1", r));
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5190");
  await page.locator("#enter").click();
  await page.waitForFunction(() => !document.getElementById("hud").hidden);
  await page.waitForFunction(() =>
    document.getElementById("phase").textContent.includes("INTERMISSION"),
  );
  await page.bringToFront();
  await page.locator("#world").click({ position: { x: 600, y: 500 } });
  await page.waitForFunction(() => document.pointerLockElement);
  await page.keyboard.press("KeyE");

  await page.locator('[data-position="red"]').click();
  await page.locator('[data-chip="25"]').click();
  await page.locator('[data-position="dozen1"]').click();
  await page.locator('[data-chip="50"]').click();
  await page.locator('[data-position="n:3"]').click();
  await page.screenshot({ path: "test-results/10-roulette-bets.png" });
  await page.locator('[data-play="roulette"]').click();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: "test-results/11-roulette-spin.png" });
  await page.locator(".settlement").waitFor({ state: "visible" });
  assert.equal(game.players.qa.chips, 2310);
  assert.equal(
    game.players.qa.guns.some((g) => g.id === "house" && g.power === 1.6),
    true,
  );
  await page.screenshot({ path: "test-results/12-roulette-payout.png" });
  await page.locator("#closeCasino").click();
  game.players.qa.x = 17;
  game.players.qa.z = 10;
  await page.waitForTimeout(500);
  await page.keyboard.press("KeyE");
  await page.locator('[data-play="blackjack"]').click();
  await page.waitForTimeout(100);
  const c = (...ranks) => ranks.map((rank) => ({ rank, suit: "♠" }));
  const hand = game.games.blackjack;
  hand.hands[0].cards = c(8, 8);
  hand.dealer = c(10, 7);
  hand.deck = c(10, 2, 10);
  await page
    .locator('[data-action="split"]:enabled')
    .waitFor({ state: "visible" });
  await page.screenshot({ path: "test-results/13-blackjack-hand.png" });
  await page.locator('[data-action="split"]').click();
  await page.locator(".hand-zone").nth(1).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/14-blackjack-split.png" });
  await page.locator('[data-action="stand"]').click();
  await page.locator('[data-action="double"]:enabled').waitFor();
  await page.locator('[data-action="double"]').click();
  await page.locator(".settlement").waitFor({ state: "visible" });
  assert.equal(game.games.blackjack.returned, 300);
  await page.screenshot({ path: "test-results/15-blackjack-payout.png" });
  await page.locator("#closeCasino").click();
  game.players.qa.x = -3;
  game.players.qa.z = 8;
  game.players.qa.losses = 2;
  game.rng = () => 0.1;
  await page.waitForTimeout(500);
  await page.keyboard.press("KeyE");
  await page.locator('[data-lines="3"]').click();
  await page.screenshot({ path: "test-results/16-slot-paytable.png" });
  await page.locator('[data-play="slots"]').click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "test-results/17-slot-spin.png" });
  await page.locator(".settlement").waitFor({ state: "visible" });
  assert.equal(game.games.slots.protection, true);
  await page.screenshot({ path: "test-results/18-slot-payout.png" });
  await page.locator("#closeCasino").click();
  await page.keyboard.press("Escape");
  await page.locator("#nextRound").click();
  await page.waitForFunction(() =>
    document.getElementById("phase").textContent.includes("GUESTS REMAIN"),
  );
  await page.locator("#world").click({ position: { x: 600, y: 500 } });
  await page.keyboard.press("KeyE");
  assert.equal(await page.locator("#casino").isVisible(), false);
  await page.screenshot({ path: "test-results/19-round-closed.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: roulette multi-bets and payouts; blackjack split/double; three-line slots and safety payout; manual round start; combat casino lockout. No browser errors.",
  );
} finally {
  await browser.close();
  clearInterval(interval);
  for (const ws of wss.clients) ws.terminate();
  wss.close();
  server.close();
  await vite.close();
}
