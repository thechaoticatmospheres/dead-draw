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
  maxPayload: 4096,
  ...(production
    ? {
        verifyClient: ({ req }) =>
          allowGameSocket(req, inviteToken, allowedOrigins),
      }
    : {}),
});
const rooms = new Map();
wss.on("connection", (ws) => {
  ws.id = randomBytes(6).toString("hex");
  let count = 0;
  const limit = setInterval(() => (count = 0), 1000);
  ws.on("message", (raw) => {
    if (++count > 100) return;
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "join" && !ws.room) {
        let code = String(msg.code || "")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 6);
        let room;
        if (code) {
          room = rooms.get(code);
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
        if (!room.addPlayer(ws.id, msg.name)) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "This floor is full (4 players).",
            }),
          );
          return;
        }
        ws.room = room;
        ws.send(JSON.stringify({ type: "welcome", id: ws.id, code }));
      } else if (ws.room) ws.room.action(ws.id, msg);
    } catch {
      /* Malformed messages never enter the simulation. */
    }
  });
  ws.on("close", () => {
    clearInterval(limit);
    if (ws.room) {
      ws.room.removePlayer(ws.id);
      if (!Object.keys(ws.room.players).length) rooms.delete(ws.room.code);
    }
  });
});
setInterval(() => {
  for (const room of rooms.values()) {
    room.update(1 / 30);
    const snapshot = JSON.stringify({ type: "state", ...room.snapshot() });
    for (const ws of wss.clients)
      if (
        ws.room === room &&
        ws.readyState === WebSocket.OPEN &&
        ws.bufferedAmount < 65536
      )
        ws.send(snapshot);
  }
}, 1000 / 30);
server.listen(
  port,
  process.env.HOST || (production ? "127.0.0.1" : "0.0.0.0"),
  () => console.log(`DEAD DRAW ready at http://localhost:${port}`),
);
