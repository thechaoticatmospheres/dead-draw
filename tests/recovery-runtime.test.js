import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { WebSocket } from "ws";
const origin = "https://thechaoticatmospheres.github.io";
async function boot() {
  const processHandle = spawn(process.execPath, ["server/index.js"], {
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      SERVER_ONLY: "true",
      HOST: "127.0.0.1",
      PORT: "0",
      SHARE_TOKEN: "",
      ALLOWED_ORIGINS: origin,
      CHECKPOINT_SECRET: "automated-test-only-not-a-live-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const port = await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(
      () => reject(Error("Server startup timeout")),
      5000,
    );
    processHandle.on("error", reject);
    processHandle.stdout.on("data", (b) => {
      output += b;
      const m = output.match(/localhost:(\d+)/);
      if (m) {
        clearTimeout(timeout);
        resolve(m[1]);
      }
    });
  });
  return { processHandle, port };
}
async function connect(port, join) {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/game`, { origin });
  const messages = [];
  socket.on("message", (raw) => messages.push(JSON.parse(raw)));
  await once(socket, "open");
  socket.send(
    JSON.stringify({ type: "join", name: "Recovery tester", ...join }),
  );
  return { socket, messages };
}
async function message(c, predicate) {
  const until = Date.now() + 4500;
  while (Date.now() < until) {
    const m = c.messages.find(predicate);
    if (m) return m;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error("Expected message not received");
}
test(
  "real sockets resume the same survivor and restore an encrypted checkpoint after server restart",
  { timeout: 20000 },
  async () => {
    let server = await boot();
    const clients = [];
    try {
      const first = await connect(server.port, {});
      clients.push(first);
      const welcome = await message(first, (m) => m.type === "welcome");
      first.socket.send(JSON.stringify({ type: "start" }));
      const checkpoint = (await message(first, (m) => m.type === "checkpoint"))
        .checkpoint;
      first.socket.close();
      await once(first.socket, "close");
      const second = await connect(server.port, {
        code: welcome.code,
        resumeToken: welcome.resumeToken,
        checkpoint,
      });
      clients.push(second);
      assert.equal(
        (await message(second, (m) => m.type === "welcome")).id,
        welcome.id,
      );
      assert.equal(
        (await message(second, (m) => m.type === "state")).players.length,
        1,
      );
      second.socket.close();
      await once(second.socket, "close");
      server.processHandle.kill();
      await once(server.processHandle, "exit");
      server = await boot();
      const third = await connect(server.port, {
        code: welcome.code,
        resumeToken: welcome.resumeToken,
        checkpoint,
      });
      clients.push(third);
      assert.equal(
        (await message(third, (m) => m.type === "welcome")).id,
        welcome.id,
      );
      const state = await message(third, (m) => m.type === "state");
      assert.equal(state.phase, "break");
      assert.equal(state.players[0].chips, 25);
      assert.equal(state.players[0].guns.length, 1);
      const intruder = await connect(server.port, {
        code: welcome.code,
        resumeToken: "b".repeat(64),
        checkpoint,
      });
      clients.push(intruder);
      assert.match(
        (await message(intruder, (m) => m.type === "error")).message,
        /cannot be restored/,
      );
    } finally {
      for (const c of clients) c.socket.terminate();
      server.processHandle.kill();
      await once(server.processHandle, "exit");
    }
  },
);
