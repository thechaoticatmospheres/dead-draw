import { Checkpoints, checkpointSecret, playerId } from "./checkpoints.js";
import http from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "node:url";
import { createProductionHandler, allowGameSocket } from "./production.js";
import { Game } from "./game.js";
const port = Number(process.env.PORT || 5188);
const production = process.env.NODE_ENV === "production";
const inviteToken = process.env.SHARE_TOKEN || "";
const serverOnly = process.env.SERVER_ONLY === "true";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
let handler;
if (serverOnly) {
  if (production && !allowedOrigins.length)
    throw new Error("ALLOWED_ORIGINS must name the public game origin.");
  handler = (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    const revision = process.env.RENDER_GIT_COMMIT;
    if (/^[a-f0-9]{40}$/i.test(revision || ""))
      res.setHeader("X-Game-Revision", revision);
    res.writeHead(
      req.url === "/health" && ["GET", "HEAD"].includes(req.method) ? 200 : 404,
    );
    res.end(req.url === "/health" ? "DEAD DRAW ready" : "Not found");
  };
} else if (production) {
  handler = await createProductionHandler(
    fileURLToPath(new URL("../dist/", import.meta.url)),
    inviteToken,
  );
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: { port: port + 1000 } },
    appType: "spa",
  });
  handler = (req, res) => vite.middlewares(req, res);
}
const server = http.createServer(handler);
const wss = new WebSocketServer({
  server,
  path: "/game",
  maxPayload: 65536,
  ...(production
    ? {
        verifyClient: ({ req }) =>
          allowGameSocket(req, inviteToken, allowedOrigins),
      }
    : {}),
});
const rooms = new Map();
const saves = new Checkpoints(checkpointSecret());
wss.on("connection", (ws) => {
  ws.alive = true;
  ws.on("pong", () => {
    ws.alive = true;
  });
  ws.id = randomBytes(6).toString("hex");
  let count = 0;
  const limit = setInterval(() => (count = 0), 1000);
  ws.on("message", (raw) => {
    if (++count > 100) return;
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "join" && !ws.room) {
        const token =
          typeof msg.resumeToken === "string" &&
          /^[a-f0-9]{64}$/.test(msg.resumeToken)
            ? msg.resumeToken
            : randomBytes(32).toString("hex");
        ws.id = playerId(token);
        ws.resumeToken = token;
        let restored;
        if (msg.checkpoint) {
          try {
            restored = saves.open(msg.checkpoint);
            if (!restored.players.some((p) => p.id === ws.id)) throw Error();
          } catch {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "This checkpoint cannot be restored. Start a new run.",
              }),
            );
            return;
          }
        }
        let code = String(msg.code || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 6);
        if (restored && !code) code = restored.code;
        let room;
        if (code) {
          room = rooms.get(code);
          if (!room && restored && restored.code === code && rooms.size < 100) {
            room = saves.restore(restored);
            rooms.set(code, room);
          }
          if (!room) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Room not found. Check the code or host a new floor.",
              }),
            );
            return;
          }
        } else {
          if (rooms.size >= 100) return;
          do {
            code = randomBytes(3).toString("hex").toUpperCase();
          } while (rooms.has(code));
          room = new Game(code);
          rooms.set(code, room);
        }
        if (room.players[ws.id]) {
          for (const other of wss.clients)
            if (other !== ws && other.id === ws.id && other.room === room) {
              other.superseded = true;
              other.close();
            }
          Object.assign(room.players[ws.id], {
            offline: false,
            input: {},
            disconnectedAt: null,
          });
          room.clearReady();
        } else if (!room.addPlayer(ws.id, msg.name)) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "This floor is full (4 players).",
            }),
          );
          return;
        }
        ws.room = room;
        ws.send(
          JSON.stringify({
            type: "welcome",
            id: ws.id,
            code,
            resumeToken: token,
          }),
        );
      } else if (ws.room) {
        if (msg.type === "leave") {
          ws.room.removePlayer(ws.id);
          ws.superseded = true;
          ws.close();
        } else ws.room.action(ws.id, msg);
      }
    } catch {
      /* Malformed messages never enter the simulation. */
    }
  });
  ws.on("close", () => {
    clearInterval(limit);
    if (ws.room && !ws.superseded && ws.room.players[ws.id]) {
      Object.assign(ws.room.players[ws.id], {
        offline: true,
        disconnectedAt: Date.now(),
        input: {},
        ready: false,
      });
    }
  });
});
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 30000).unref();
setInterval(() => {
  for (const room of rooms.values()) {
    const connected = Object.values(room.players).filter((p) => !p.offline);
    if (!connected.length) {
      room.idleSince ||= Date.now();
      if (Date.now() - room.idleSince > 30 * 60000) rooms.delete(room.code);
      continue;
    }
    room.idleSince = null;
    for (const p of Object.values(room.players))
      if (p.offline && Date.now() - p.disconnectedAt > 120000)
        room.removePlayer(p.id);
    room.update(1 / 30);
    let checkpoint = null;
    if (Date.now() - (room.savedAt || 0) > 1500) {
      checkpoint = saves.seal(room);
      if (checkpoint) room.savedAt = Date.now();
    }
    const snapshot = JSON.stringify({ type: "state", ...room.snapshot() });
    for (const ws of wss.clients)
      if (
        ws.room === room &&
        ws.readyState === WebSocket.OPEN &&
        ws.bufferedAmount < 65536
      ) {
        ws.send(snapshot);
        if (checkpoint)
          ws.send(JSON.stringify({ type: "checkpoint", checkpoint }));
      }
  }
}, 1000 / 30);
server.listen(
  port,
  process.env.HOST || (production ? "127.0.0.1" : "0.0.0.0"),
  () =>
    console.log(`DEAD DRAW ready at http://localhost:${server.address().port}`),
);
