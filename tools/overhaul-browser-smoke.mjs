import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { StateDecoder } from "../shared/state-stream.js";
import { STATIONS, WEAPONS } from "../shared/data.js";

// Launch the game server separately. No testing messages, game-state injection,
// or modified balances are used: both clients interact through ordinary UI.
const url = process.env.DEAD_DRAW_URL || "http://127.0.0.1:5191";
const output = "test-results/overhaul-browser";
await mkdir(output, { recursive: true });
const report = { url, checks: [], errors: [], screenshots: [] };
let browser;
async function waitUntil(predicate, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw Error(`Timed out: ${label}`);
}
async function client(name) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const view = {
    context,
    page,
    state: null,
    id: null,
    code: null,
    checkpoint: false,
    input: null,
  };
  page.on("pageerror", (error) =>
    report.errors.push(`${name}: ${error.message}`),
  );
  page.on("websocket", (socket) => {
    if (!socket.url().includes("/game")) return;
    const decoder = new StateDecoder();
    socket.on("framesent", ({ payload }) => {
      const message = JSON.parse(String(payload));
      if (message.type === "input") view.input = message.input;
    });
    socket.on("framereceived", ({ payload }) => {
      const message = decoder.decode(JSON.parse(String(payload)));
      if (!message) return;
      if (message.type === "state") view.state = message;
      if (message.type === "welcome")
        Object.assign(view, { id: message.id, code: message.code });
      if (message.type === "checkpoint") view.checkpoint = true;
    });
  });
  await page.goto(url);
  await page.locator("#enter").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__deadDraw?.captureReady, null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__deadDraw.world.bakeStatus), "ready", "Actual Cycles assets load before this client's screenshots");
  await page.locator("#name").fill(name);
  return view;
}
async function photograph(view, name) {
  const path = `${output}/${name}.png`;
  await view.page.screenshot({ path });
  report.screenshots.push(path);
}
async function move(view, key, milliseconds) {
  await view.page.keyboard.down(key);
  await view.page.waitForTimeout(milliseconds);
  await view.page.keyboard.up(key);
  await view.page.waitForTimeout(150);
}
const self = (view) => view.state?.players.find((p) => p.id === view.id);
async function walkTo(view, target, tolerance = 0.3) {
  const trace = [], deadline = Date.now() + 8000;
  for (let step = 0; step < 24 && Date.now() < deadline; step++) {
    const p = self(view), dx = target.x - p.x, dz = target.z - p.z;
    trace.push({ x: p.x, z: p.z, yaw: p.yaw });
    if (Math.hypot(dx, dz) <= tolerance) {
      report.slotApproach = { target, trace };
      return;
    }
    // Choose the strongest camera-relative axis using the server's observed
    // heading. These are ordinary held keys, with no position/state injection.
    const forward = -Math.sin(p.yaw) * dx - Math.cos(p.yaw) * dz;
    const right = Math.cos(p.yaw) * dx - Math.sin(p.yaw) * dz;
    const alongForward = Math.abs(forward) > Math.abs(right);
    const distance = alongForward ? forward : right;
    const key = alongForward ? (distance > 0 ? "KeyW" : "KeyS") : (distance > 0 ? "KeyD" : "KeyA");
    await move(view, key, Math.min(140, Math.max(55, Math.abs(distance) / 6 * 1000)));
  }
  report.slotApproach = { target, trace, after: { x: self(view).x, z: self(view).z }, input: view.input };
  throw Error(`Held-input navigation did not reach the slot approach: ${JSON.stringify(report.slotApproach)}`);
}
try {
  browser = await chromium.launch({
    executablePath: process.env.DEAD_DRAW_BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: process.env.DEAD_DRAW_HEADED !== "1",
    args: ["--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const first = await client("QA Host");
  await photograph(first, "01-title");
  await first.page.locator("#enter").click();
  await first.page.locator("#lobby").waitFor({ state: "visible" });
  await waitUntil(() => first.code, "host welcome");
  const second = await client("QA Guest");
  await second.page.locator("#code").fill(first.code);
  await second.page.locator("#enter").click();
  await waitUntil(
    () =>
      first.state?.players.length === 2 && second.state?.players.length === 2,
    "two-player lobby",
  );
  assert.notEqual(
    first.id,
    second.id,
    "Separate contexts must create separate survivors",
  );
  report.checks.push("Two separate browser contexts join the same campaign");
  await first.page.bringToFront();
  await first.page.locator("#start").click();
  await waitUntil(() => first.state?.phase === "break", "initial intermission");
  await first.page.locator("#world").click({ position: { x: 800, y: 500 } });
  await first.page.waitForFunction(
    () => document.pointerLockElement?.id === "world",
  );
  const before = { ...self(first) };
  await move(first, "KeyW", 400);
  assert.ok(
    self(first).z < before.z - 1,
    "Keyboard movement reaches the server",
  );
  const ammunition = self(first).guns[self(first).selected].ammo;
  const fullMagazine = WEAPONS[self(first).guns[self(first).selected].id].mag;
  await first.page.mouse.down();
  await first.page.waitForTimeout(350);
  await first.page.mouse.up();
  await waitUntil(
    () => self(first).guns[self(first).selected].ammo < ammunition,
    "weapon fire",
  );
  await first.page.keyboard.press("KeyR");
  await waitUntil(
    () => self(first).guns[self(first).selected].ammo === fullMagazine,
    "reload",
  );
  report.checks.push(
    "Pointer capture, keyboard movement, firing and reload reach authority",
  );
  await photograph(first, "02-floor");
  await first.page.keyboard.press("Escape");
  await first.page.waitForFunction(() => !document.pointerLockElement);
  // Esc's pointerlockchange event clears held keys. Let that browser event and
  // its following render frame finish before beginning a new held-key action.
  await first.page.waitForTimeout(100);
  await first.page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  const unlockedPosition = { ...self(first) };
  let unlockedInputError = null, heldInput = null;
  const heldAt = Date.now();
  await first.page.keyboard.down("KeyD");
  try {
    await waitUntil(() => first.input?.right === 1, "unlocked D input reaches socket", 3000);
    heldInput = { ...first.input };
    await waitUntil(() => self(first).lastSeq >= heldInput.seq, "authority acknowledges unlocked movement", 3000);
    await first.page.waitForTimeout(Math.max(0, 250 - (Date.now() - heldAt)));
  } catch (error) { unlockedInputError = error.message; }
  finally { await first.page.keyboard.up("KeyD"); }
  await first.page.waitForTimeout(150);
  const unlockedDiagnostics = {
    before: { x: unlockedPosition.x, z: unlockedPosition.z, yaw: unlockedPosition.yaw, lastSeq: unlockedPosition.lastSeq },
    after: { x: self(first).x, z: self(first).z, yaw: self(first).yaw, lastSeq: self(first).lastSeq },
    heldInput, currentInput: first.input, error: unlockedInputError,
    browser: await first.page.evaluate(() => ({ focused: document.hasFocus(), hidden: document.hidden,
      activeElement: document.activeElement?.tagName, pointerLock: document.pointerLockElement?.id || null,
      keyboardLook: window.__deadDraw.keyboardLooking })),
  };
  report.unlockedMovement = unlockedDiagnostics;
  assert.ok(!unlockedInputError && Math.hypot(self(first).x - unlockedPosition.x, self(first).z - unlockedPosition.z) > 0.25,
    `Held movement works without pointer lock: ${JSON.stringify(unlockedDiagnostics)}`);
  await move(first, "KeyA", 100); // Return toward the clear slot-machine approach.
  await first.page.mouse.move(800, 500);
  const dragYaw = self(first).yaw;
  await first.page.mouse.down({ button: "right" });
  await first.page.mouse.move(940, 500, { steps: 7 });
  await waitUntil(() => Math.abs(self(first).yaw - dragYaw) > 0.2, "unlocked right-drag look", 3000);
  assert.equal(await first.page.evaluate(() => !!document.pointerLockElement), false);
  assert.equal(!!first.input?.aim, false, "Unlocked right drag keeps ordinary aiming separate");
  await first.page.mouse.move(800, 500, { steps: 7 });
  await first.page.mouse.up({ button: "right" });
  await first.page.keyboard.press("KeyH");
  await first.page.waitForFunction(() => window.__deadDraw.keyboardLooking);
  const keyboardYaw = self(first).yaw, keyboardPitch = self(first).pitch;
  await move(first, "KeyJ", 200);
  assert.ok(self(first).yaw > keyboardYaw + 0.1, "J turns left through normal input");
  await move(first, "KeyL", 200);
  assert.ok(self(first).yaw < keyboardYaw + 0.2, "L turns back right");
  await move(first, "KeyI", 180);
  assert.ok(self(first).pitch > keyboardPitch + 0.1, "I looks up");
  await move(first, "KeyK", 180);
  assert.ok(self(first).pitch < keyboardPitch + 0.2, "K looks back down");
  await first.page.keyboard.press("KeyV");
  await waitUntil(() => !!first.input?.aim, "keyboard aiming", 3000);
  const aimSequence = first.input.seq;
  await waitUntil(() => self(first).lastSeq >= aimSequence, "authority acknowledges aim input", 3000);
  await photograph(first, "03-unlocked-keyboard-aim");
  await first.page.keyboard.press("KeyV");
  await waitUntil(() => !first.input?.aim, "keyboard aim release", 3000);
  await first.page.keyboard.press("KeyH");
  report.checks.push("Unlocked held movement, right-button drag, H/IJKL look and V aiming reach authority");
  await first.page.locator("#mapButton").click();
  await first.page.locator("#floorplan").waitFor({ state: "visible" });
  await photograph(first, "04-floorplan");
  await first.page.locator("#closeMap").click();
  await first.page.locator("#world").click({ position: { x: 800, y: 500 } });
  // Spawn slots vary with crew order. Walk to the clear south approach using
  // observed authoritative positions rather than assuming the host's x value.
  const slots = STATIONS.find(station => station.id === "slots");
  await walkTo(first, { x: slots.x + 0.6, z: slots.z + 2.8 });
  assert.ok(Math.hypot(self(first).x - slots.x, self(first).z - slots.z) < slots.r + 2.4,
    "Observed survivor position is within the real slot interaction radius");
  await first.page.keyboard.press("KeyB");
  await first.page.locator("#casino").waitFor({ state: "visible" });
  await first.page.locator('[data-play="slots"]').click();
  await waitUntil(() => first.state?.games.slots, "slot wager");
  assert.equal(
    second.state.games.slots,
    undefined,
    "Guest never receives host's private hand",
  );
  await photograph(first, "05-private-casino");
  await waitUntil(
    () => first.state?.games.slots?.phase === "result",
    "slot settlement",
  );
  await first.page.locator("#closeCasino").click();
  await first.page.keyboard.press("ShiftLeft");
  await waitUntil(() => self(first).dodgeTime > 0, "roll starts", 3000);
  await waitUntil(() => !(self(first).dodgeTime > 0), "roll finishes", 3000);
  await first.page.keyboard.press("Space");
  await waitUntil(() => self(first).height > 0.1, "jump leaves ground", 3000);
  await waitUntil(() => !(self(first).height > 0.01), "jump lands", 3000);
  report.checks.push("Shift roll and Space jump/landing are observed in authoritative snapshots");
  await waitUntil(() => first.checkpoint, "safe checkpoint");
  report.checks.push(
    "Actual casino wager settles and private hand is absent from peer stream",
  );
  const survivorId = first.id;
  await first.page.reload();
  await first.page.locator("#resumeRun").click();
  await waitUntil(
    () => first.state?.players.find((p) => p.id === survivorId && !p.offline),
    "resume same survivor",
  );
  assert.equal(first.id, survivorId);
  assert.equal(first.state.players.length, 2);
  report.checks.push(
    "Reload and Resume reconnect the same survivor without duplication",
  );
  await first.page.keyboard.press("Escape");
  await first.page.locator("#nextRound").click();
  await second.page.bringToFront();
  await second.page.locator("#nextRound").click();
  await waitUntil(
    () => first.state?.phase === "combat" && second.state?.phase === "combat",
    "unanimous ready",
  );
  await first.page.bringToFront();
  await first.page.locator("#world").click({ position: { x: 800, y: 500 } });
  await waitUntil(() => first.state?.zombies.length > 0, "first enemies");
  await photograph(first, "06-live-combat");
  report.checks.push(
    "Both survivors ready and authoritative first wave spawns",
  );
  assert.deepEqual(report.errors, [], "No browser page errors");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.failure = error.stack;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  await browser?.close();
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        status: report.status,
        checks: report.checks,
        report: `${output}/report.json`,
      },
      null,
      2,
    ),
  );
}
