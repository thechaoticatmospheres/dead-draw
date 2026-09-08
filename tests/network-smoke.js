import { WebSocket } from "ws";
import assert from "node:assert/strict";
const clients = [];
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
  await new Promise((r) => setTimeout(r, 500));
  for (const c of [host, ...guests]) {
    assert.equal(c.state.players.length, 4);
    assert.equal(c.state.phase, "break");
    assert.equal(c.state.code, code);
  }
  const id = host.welcome.id;
  host.ws.send(
    JSON.stringify({ type: "input", input: { forward: 1, yaw: 0, pitch: 0 } }),
  );
  await new Promise((r) => setTimeout(r, 150));
  const positions = [host, ...guests].map(
    (c) => c.state.players.find((p) => p.id === id).z,
  );
  assert.ok(Math.max(...positions) - Math.min(...positions) < 0.3);
  for (const c of [host, ...guests.slice(0, 2)])
    c.ws.send(JSON.stringify({ type: "nextRound" }));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(host.state.phase, "break");
  guests[2].ws.send(JSON.stringify({ type: "nextRound" }));
  await new Promise((r) => setTimeout(r, 150));
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
