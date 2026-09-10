import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { Game } from "./game.js";
const fields = [
  "serial",
  "jukebox",
  "timer",
  "prizeWheel",
  "round",
  "phase",
  "time",
  "openRooms",
  "jackpot",
  "history",
  "campaign",
  "runId",
  "runStarted",
  "summary",
];
export class Checkpoints {
  constructor(secret) {
    this.key = createHash("sha256").update(secret).digest();
  }
  seal(game) {
    if (game.phase !== "break" || game.busy()) return null;
    const data = Object.fromEntries(fields.map((k) => [k, game[k]]));
    data.players = Object.values(game.players).map(
      ({ input, inputAt, offline, ...p }) => ({
        ...p,
        ready: false,
        reload: 0,
        cooldown: 0,
      }),
    );
    data.code = game.code;
    data.version = 1;
    data.created = Date.now();
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv),
      body = Buffer.concat([
        cipher.update(deflateSync(Buffer.from(JSON.stringify(data)))),
        cipher.final(),
      ]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
  }
  open(token) {
    if (typeof token !== "string" || token.length > 60000)
      throw Error("Invalid checkpoint");
    const b = Buffer.from(token, "base64url"),
      cipher = createDecipheriv("aes-256-gcm", this.key, b.subarray(0, 12));
    cipher.setAuthTag(b.subarray(12, 28));
    const json = inflateSync(
      Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]),
      { maxOutputLength: 262144 },
    );
    const data = JSON.parse(json);
    if (
      data.version !== 1 ||
      data.phase !== "break" ||
      data.players.length > 4 ||
      Date.now() - data.created > 90 * 86400000
    )
      throw Error("Checkpoint expired");
    return data;
  }
  restore(data) {
    const g = new Game(data.code);
    for (const k of fields) if (data[k] !== undefined) g[k] = data[k];
    for (const p of data.players)
      g.players[p.id] = {
        ...p,
        input: {},
        inputAt: g.time,
        offline: true,
        disconnectedAt: Date.now(),
      };
    g.timer = Math.max(1, Math.min(90, data.timer ?? 90));
    g.games = {};
    g.crewTables = {};
    return g;
  }
}
export function checkpointSecret() {
  if (process.env.CHECKPOINT_SECRET) return process.env.CHECKPOINT_SECRET;
  const folder = process.env.SAVE_DIR || ".cache";
  mkdirSync(folder, { recursive: true });
  const path = folder + "/checkpoint-key";
  try {
    return readFileSync(path, "utf8");
  } catch {
    const key = randomBytes(32).toString("hex");
    writeFileSync(path, key, { mode: 0o600 });
    return key;
  }
}
export const playerId = (token) =>
  createHash("sha256").update(token).digest("hex").slice(0, 16);
