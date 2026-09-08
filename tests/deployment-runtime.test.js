import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

test(
  "Render production runtime serves health and supports four-player rounds",
  { timeout: 15000 },
  async () => {
    const cwd = fileURLToPath(new URL("../", import.meta.url));
    const origin = "https://thechaoticatmospheres.github.io";
    const server = spawn(process.execPath, ["server/index.js"], {
      cwd,
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: "production",
        SERVER_ONLY: "true",
        HOST: "127.0.0.1",
        PORT: "0",
        SHARE_TOKEN: "",
        ALLOWED_ORIGINS: origin,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    server.stderr.on("data", (chunk) => {
      output += chunk;
    });
    try {
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Server startup timed out: ${output}`)),
          5000,
        );
        server.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        server.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Server exited ${code}: ${output}`));
        });
        server.stdout.on("data", (chunk) => {
          output += chunk;
          const match = output.match(/ready at http:\/\/localhost:(\d+)/);
          if (match) {
            clearTimeout(timer);
            resolve(Number(match[1]));
          }
        });
      });
      const base = `http://127.0.0.1:${port}`;
      assert.equal((await fetch(`${base}/health`)).status, 200);
      for (const path of ["/", "/.env", "/server/index.js"])
        assert.equal((await fetch(base + path)).status, 404);
      await new Promise((resolve, reject) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/game`, {
          origin: "https://unrelated.example",
          handshakeTimeout: 2000,
        });
        socket.once("open", () => {
          socket.close();
          reject(new Error("Unrelated browser origin accepted"));
        });
        socket.once("error", (error) => {
          try {
            assert.match(error.message, /401/);
            resolve();
          } catch (failure) {
            reject(failure);
          }
        });
      });
      const smoke = spawn(process.execPath, ["tests/network-smoke.js"], {
        cwd,
        windowsHide: true,
        env: {
          ...process.env,
          TEST_GAME_URL: `ws://127.0.0.1:${port}/game`,
          TEST_ORIGIN: origin,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let smokeOutput = "";
      smoke.stdout.on("data", (chunk) => {
        smokeOutput += chunk;
      });
      smoke.stderr.on("data", (chunk) => {
        smokeOutput += chunk;
      });
      const timer = setTimeout(() => smoke.kill(), 6000);
      try {
        const [code] = await once(smoke, "exit");
        assert.equal(code, 0, smokeOutput);
      } finally {
        clearTimeout(timer);
      }
    } finally {
      const exited = once(server, "exit");
      server.kill();
      if (server.exitCode === null) await exited;
    }
  },
);
