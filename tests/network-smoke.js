import { WebSocket } from "ws";
import assert from "node:assert/strict";
const clients = [];
async function until(check, label) {
  const deadline = Date.now() + 8000;
  while (!check()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
async function join(code = "") {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      process.env.TEST_GAME_URL || "ws://127.0.0.1:5188/game",
      process.env.TEST_ORIGIN ? { origin: process.env.TEST_ORIGIN } : {},
    );
    const client = { ws, messages: [] };
    clients.push(client);
    const timeout = setTimeout(() => reject(new Error("join timed out")), 5000);
    ws.on("open", () =>
      ws.send(JSON.stringify({ type: "join", code, name: "Network test" })),
    );
    ws.on("message", (raw) => {
      const m = JSON.parse(raw);
      client.messages.push(m);
      if (m.type === "state") client.state = m;
      if (m.type === "welcome" || m.type === "error") {
        clearTimeout(timeout);
        client.welcome = m;
        resolve(client);
      }
    });
    ws.on("error", reject);
  });
}
try {
  const host = await join(),
    code = host.welcome.code;
  const guests = await Promise.all([join(code), join(code), join(code)]);
  const rejected = await join(code);
  assert.equal(rejected.welcome.type, "error");
  assert.match(rejected.welcome.message, /full/);
  host.ws.send(JSON.stringify({ type: "start" }));
  await until(
    () =>
      [host, ...guests].every(
        (c) => c.state?.phase === "break" && c.state.players.length === 4,
      ),
    "four-player intermission",
  );
  for (const c of [host, ...guests]) {
    assert.equal(c.state.players.length, 4);
    assert.equal(c.state.phase, "break");
    assert.equal(c.state.code, code);
  }
  const id = host.welcome.id;
  host.ws.send(
    JSON.stringify({ type: "input", input: { forward: 1, yaw: 0, pitch: 0 } }),
  );
  await until(
    () =>
      [host, ...guests].every(
        (c) => c.state.players.find((p) => p.id === id).z < 9.9,
      ),
    "movement replication",
  );
  const positions = [host, ...guests].map(
    (c) => c.state.players.find((p) => p.id === id).z,
  );
  assert.ok(Math.max(...positions) - Math.min(...positions) < 0.3);
  for (const c of [host, ...guests.slice(0, 2)])
    c.ws.send(JSON.stringify({ type: "nextRound" }));
  await until(
    () => host.state.players.filter((p) => p.ready).length === 3,
    "three players ready",
  );
  assert.equal(host.state.phase, "break");
  guests[2].ws.send(JSON.stringify({ type: "nextRound" }));
  await until(
    () => [host, ...guests].every((c) => c.state.phase === "combat"),
    "unanimous combat start",
  );
  for (const c of [host, ...guests]) {
    assert.equal(c.state.phase, "combat");
    assert.equal(c.state.difficulty.team, 4);
    assert.equal(c.state.difficulty.count, 22);
  }
  console.log(
    "PASS: four real WebSocket clients share a room, round state and movement; fifth client rejected.",
  );
} finally {
  for (const c of clients) c.ws.close();
}
