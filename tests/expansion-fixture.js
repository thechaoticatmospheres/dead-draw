// Loopback-only deterministic scenes for browser QA; never part of the shipped server.
import http from "node:http";
import { createServer } from "vite";
import { WebSocketServer } from "ws";
import { Game } from "../server/game.js";
import { STATIONS } from "../shared/data.js";
import { ROOMS } from "../shared/map.js";
import { giveReward } from "../server/casino.js";
import { SERVICES } from "../shared/services.js";
import { WHEEL_PADS } from "../shared/arsenal.js";
import { ENEMIES } from "../shared/expansion.js";
const game = new Game("QA2026", () => 0.4);
const vite = await createServer({
  server: { middlewareMode: true, hmr: { port: 6194 } },
  appType: "spa",
});
let paused = false;
let performanceBots = [];
let performanceStress = false;
const server = http.createServer(async (req, res) => {
  if (req.url === "/__qa" && req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        phase: game.phase,
        players: game.players,
        games: game.games,
        hazards: game.hazards,
        zombies: game.zombies,
      }),
    );
  }
  if (req.url.startsWith("/__qa/") && req.method === "POST") {
    const scenario = req.url.slice(6),
      p = Object.values(game.players).find((p) => !p.offline);
    if (!p) {
      res.statusCode = 409;
      return res.end("Join first");
    }
    game.timer = 90;
    if (scenario === "performance" || scenario === "performance-stop") {
      performanceStress = scenario === "performance";
      for (const id of performanceBots) game.removePlayer(id);
      performanceBots = [];
      game.games = {};
      game.crewTables = {};
      game.zombies = [];
      game.hazards = [];
      game.openRooms = ROOMS.map((r) => r.id);
      p.x = 0;
      p.z = 13;
      p.yaw = 0;
      p.down = false;
      p.hp = 100;
      p.invulnerable = 1e6;
      game.phase = "break";
      paused = false;
      if (performanceStress) {
        ["minigun", "flamethrower", "rpg"].forEach((weapon, i) => {
          const id = "perf" + i;
          if (!game.addPlayer(id, "Performance " + weapon)) return;
          const bot = game.players[id];
          performanceBots.push(id);
          giveReward(bot, weapon);
          bot.x = -3 + i * 3;
          bot.z = 9;
          bot.yaw = 0;
          bot.invulnerable = 1e6;
          bot.perks.autoReload = 1;
          bot.guns[bot.selected].reserve = 100000;
        });
        game.round = 19;
        game.startRound();
        game.pending = 999;
        game.spawnTimer = 999;
      }
      return res.end("ok");
    }
    if (
      scenario === "wheel" ||
      scenario === "countdown" ||
      scenario === "downed" ||
      scenario.startsWith("weapon/") ||
      scenario === "geese"
    ) {
      game.phase = "break";
      game.games = {};
      game.hazards = [];
      game.zombies = [];
      game.openRooms = ROOMS.map((r) => r.id);
      p.chips = 20000;
      p.down = false;
      p.hp = 100;
      p.x = 0;
      p.z = 10;
      p.yaw = 0;
      p.pitch = 0;
      paused = false;
      if (scenario === "wheel") {
        game.prizeWheel = { room: WHEEL_PADS[0].room, spins: 0, visits: 0 };
        const pad = WHEEL_PADS[0];
        p.x = pad.x;
        p.z = pad.z + 2.3;
      }
      if (scenario === "countdown") game.timer = 10;
      if (scenario.startsWith("weapon/")) {
        giveReward(p, scenario.slice(7));
        game.phase = "combat";
        game.pending = 999;
        game.spawnTimer = 999;
      }
      if (scenario === "downed") {
        const q =
          Object.values(game.players).find((q) => q.id !== p.id) ||
          (game.addPlayer("qc", "Fallen Friend"), game.players.qc);
        q.down = true;
        q.hp = 0;
        q.x = p.x + 0.7;
        q.z = p.z - 2;
        q.offline = false;
        paused = true;
      }
      if (scenario === "geese") {
        game.round = 3;
        game.startRound();
        game.pending = 999;
        game.spawnTimer = 999;
        game.zombies = [-2, 0, 2].map((x) => ({
          ...game.makeEnemy({ x, z: 5 }),
          speed: 0,
        }));
        paused = true;
      }
    } else if (scenario === "enemies" || scenario === "enemy-combat") {
      game.phase = "combat";
      game.round = 4;
      game.pending = 999;
      game.spawnTimer = 999;
      game.games = {};
      game.crewTables = {};
      game.hazards = [];
      game.openRooms = ROOMS.map((r) => r.id);
      p.x = 0;
      p.z = 13;
      p.yaw = 0;
      p.pitch = -0.04;
      p.down = false;
      p.hp = 100;
      game.zombies = ["dealer", "security", "wheelchair", "crawler"].map(
        (kind, i) => ({
          id: ++game.serial,
          kind,
          x: -4.5 + i * 3,
          z: 7.8,
          yaw: Math.PI,
          hp: 100 * ENEMIES[kind].hp,
          maxHp: 100 * ENEMIES[kind].hp,
          speed: 1.4 * ENEMIES[kind].speed,
          special: 10,
          attack: 0,
          stun: 0,
        }),
      );
      paused = scenario === "enemies";
    } else if (scenario === "jukebox" || scenario === "cashier") {
      game.phase = "break";
      game.games = {};
      game.crewTables = {};
      game.zombies = [];
      const service = SERVICES.find((s) => s.id === scenario);
      p.x = service.x;
      p.z = service.z + 3.2;
      p.yaw = 0;
      p.pitch = 0;
      p.down = false;
      p.hp = 100;
      paused = false;
    } else if (scenario.startsWith("table/") || scenario === "scope") {
      game.phase = "break";
      game.games = {};
      game.crewTables = {};
      game.zombies = [];
      game.hazards = [];
      game.openRooms = ROOMS.map((r) => r.id);
      p.chips = 20000;
      p.down = false;
      p.hp = 100;
      const station =
        STATIONS.find((s) => s.id === scenario.slice(6)) ||
        STATIONS.find((s) => s.id === "letitride");
      p.x = station.x;
      p.z = station.z + 3;
      p.yaw = 0;
      p.pitch = 0;
      for (const mate of Object.values(game.players))
        if (mate.id !== p.id) {
          mate.x = p.x + 1;
          mate.z = p.z;
          mate.chips = 20000;
          mate.down = false;
        }
      if (station.id === "slots") {
        p.slotFeature = 1;
        p.paidSpins = 7;
      }
      if (scenario === "scope") {
        giveReward(p, "dividend");
        p.selected = p.guns.findIndex((g) => g.id === "dividend");
        const gun = p.guns[p.selected];
        gun.attachments = {
          optic: "scope",
          magazine: "extended",
          action: "speedloader",
          barrel: "compensator",
        };
        gun.ownedAttachments = [
          "reflex",
          "scope",
          "longscope",
          "extended",
          "speedloader",
          "compensator",
        ];
        p.x = 0;
        p.z = -35;
      }
      paused = false;
    } else if (scenario === "campaign") {
      game.phase = "break";
      game.openRooms = ROOMS.map((r) => r.id);
      game.games = {};
      game.crewTables = {};
      game.zombies = [];
      p.x = -21;
      p.z = -20;
      p.chips = 20000;
      p.down = false;
      p.hp = 100;
      game.campaign.keys = 2;
      game.campaign.archive = true;
      paused = false;
    } else if (scenario === "extraction") {
      game.phase = "break";
      game.campaign.defeated = true;
      game.campaign.power = true;
      game.campaign.keys = 2;
      game.campaign.archive = true;
      for (const p of Object.values(game.players)) {
        p.x = 5;
        p.z = 13;
        p.hp = 100;
        p.down = false;
      }
      paused = false;
    } else if (scenario === "pause") paused = true;
    else if (scenario === "resume") paused = false;
    else if (scenario === "club") {
      game.restart();
      const p = Object.values(game.players).find((p) => !p.offline);
      p.chips = 2000;
      p.comps = 40;
      game.openRooms = ROOMS.map((r) => r.id);
    } else if (scenario === "vault") {
      game.phase = "break";
      game.games = {};
      p.x = -3;
      p.z = 8;
      p.chips = 2000;
      p.vaultSpins = 4;
    } else if (scenario === "craps") {
      game.phase = "break";
      game.games = {};
      game.openRooms = ROOMS.map((r) => r.id);
      p.x = 17;
      p.z = -5;
      p.chips = 2000;
    } else if (scenario === "combat") {
      game.games = {};
      game.round = 4;
      game.startRound();
      game.pending = 0;
      game.openRooms = ROOMS.map((r) => r.id);
      p.x = 0;
      p.z = 10;
      p.yaw = 0;
      p.hp = 100;
      p.armor = 75;
      giveReward(p, "house");
      game.zombies = [
        game.makeEnemy({ x: 1, z: 0 }),
        game.makeEnemy({ x: 3, z: 4 }),
        game.makeEnemy({ x: -5, z: 1 }),
        game.makeEnemy({ x: 5, z: -1 }),
      ];
      game.hazards = [
        {
          id: 888,
          kind: "slam",
          x: 0,
          z: 8,
          radius: 2.1,
          delay: 1,
          total: 1.35,
          life: 1.5,
          damage: 30,
        },
        {
          id: 889,
          kind: "acid",
          x: 4,
          z: 6,
          radius: 1.65,
          delay: -0.2,
          total: 1.1,
          life: 3,
          damage: 9,
        },
      ];
      paused = true;
    } else if (scenario === "grenade") {
      paused = false;
      game.hazards = [];
      game.zombies = [];
      game.pending = 999;
      game.spawnTimer = 999;
      p.x = 0;
      p.z = 10;
      p.hp = 100;
      p.armor = 0;
      p.grenades = 2;
    } else if (scenario === "clear") {
      paused = false;
      game.zombies = [];
      game.pending = 0;
      game.hazards = [];
    } else if (scenario !== "pause" && scenario !== "resume") {
      res.statusCode = 400;
      return res.end("Unknown fixture");
    }
    return res.end("ok");
  }
  vite.middlewares(req, res);
});
const wss = new WebSocketServer({ server, path: "/game" });
wss.on("connection", (ws) => {
  ws.on("close", () => game.removePlayer(ws.player));
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.type === "join") {
      ws.player = Object.keys(game.players).length ? "qb" : "qa";
      game.addPlayer(ws.player, msg.name);
      ws.send(
        JSON.stringify({ type: "welcome", id: ws.player, code: game.code }),
      );
    } else game.action(ws.player, msg);
  });
});
setInterval(() => {
  if (performanceStress) {
    for (const id of performanceBots) {
      const bot = game.players[id];
      if (!bot) continue;
      game.action(id, {
        type: "input",
        input: { shoot: true, yaw: 0, pitch: 0 },
      });
    }
    while (game.zombies.length < game.difficulty.cap)
      game.zombies.push(
        game.makeEnemy({ x: Math.random() * 10 - 5, z: 2 + Math.random() * 3 }),
      );
  }
  if (!paused) game.update(1 / 30);
  for (const ws of wss.clients)
    if (ws.readyState === 1)
      ws.send(
        JSON.stringify({ type: "state", ...game.snapshot(ws.player, false) }),
      );
  game.events.length = 0;
}, 1000 / 30);
server.listen(5194, "127.0.0.1", () =>
  console.log("Expansion browser fixture at http://127.0.0.1:5194"),
);
