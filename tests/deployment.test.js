import test from "node:test";
import assert from "node:assert/strict";
import { gameSocketURL } from "../src/connection.js";
import { normalizeBase } from "../vite.config.js";
import { allowGameSocket } from "../server/production.js";
test("production paths work for arbitrary repository names and root sites", () => {
  assert.equal(normalizeBase("/REPOSITORY-NAME/"), "/REPOSITORY-NAME/");
  assert.equal(normalizeBase("dead-draw"), "/dead-draw/");
  assert.equal(normalizeBase(""), "/");
});
test("Pages connects to the configured secure backend instead of its static origin", () => {
  const page = {
    protocol: "https:",
    host: "player.github.io",
    pathname: "/REPOSITORY-NAME/",
  };
  assert.equal(
    gameSocketURL(page, "https://game.onrender.com"),
    "wss://game.onrender.com/game",
  );
  assert.equal(
    gameSocketURL(page, "wss://game.onrender.com/game/"),
    "wss://game.onrender.com/game",
  );
  assert.throws(() => gameSocketURL(page, "http://game.example"), /secure/);
  assert.throws(
    () => gameSocketURL(page, "https://user:password@game.example"),
    /invalid/,
  );
  assert.throws(
    () => gameSocketURL(page, "https://game.example?token=secret"),
    /invalid/,
  );
  assert.equal(
    gameSocketURL({ protocol: "http:", host: "localhost:5188" }),
    "ws://localhost:5188/game",
  );
});
test("multiplayer origin checks allow the Pages site and reject unrelated sites", () => {
  const headers = {
      host: "game.onrender.com",
      origin: "https://player.github.io",
    },
    allowed = ["https://player.github.io"];
  assert.equal(allowGameSocket({ headers }, "", allowed), true);
  assert.equal(
    allowGameSocket(
      { headers: { ...headers, origin: "https://unrelated.example" } },
      "",
      allowed,
    ),
    false,
  );
  assert.equal(
    allowGameSocket(
      { headers: { ...headers, origin: "invalid" } },
      "",
      allowed,
    ),
    false,
  );
});
