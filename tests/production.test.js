import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import { createProductionHandler, allowGameSocket } from "../server/production.js";

test("invited guests get only compiled game files, with protected HTTP and sockets", async () => {
  const prefix = join(tmpdir(), "dead-draw-serving-");
  const directory = await mkdtemp(prefix);
  const token = "a".repeat(64);
  const cookie = `dead_draw_invite=${token}`;
  await writeFile(join(directory, "index.html"), "<h1>DEAD DRAW</h1>");
  await mkdir(join(directory, "assets"));
  await writeFile(join(directory, "assets", "scene.glb"), Buffer.from([103, 108, 84, 70]));
  await writeFile(join(directory, ".env"), "do not serve");
  const server = createServer(await createProductionHandler(directory, token));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(origin)).status, 403);
    assert.equal((await fetch(`${origin}/assets/scene.glb`)).status, 403);
    assert.equal((await fetch(`${origin}/invite/wrong`)).status, 403);
    const invitation = await fetch(`${origin}/invite/${token}`, { redirect: "manual" });
    assert.equal(invitation.status, 303);
    assert.equal(invitation.headers.get("location"), "/");
    assert.match(invitation.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Lax/);
    assert.equal(invitation.headers.get("referrer-policy"), "no-referrer");
    const authorized = { headers: { cookie } };
    const game = await fetch(origin, authorized);
    assert.equal(game.status, 200);
    assert.match(await game.text(), /DEAD DRAW/);
    assert.equal(game.headers.get("cache-control"), "private, no-store");
    const model = await fetch(`${origin}/assets/scene.glb`, authorized);
    assert.equal(model.headers.get("content-type"), "model/gltf-binary");
    assert.equal((await model.arrayBuffer()).byteLength, 4);
    for (const path of ["/.env", "/@vite/client", "/@fs/C:/Windows/win.ini", "/server/index.js", "/%2e%2e%5cpackage.json", "/assets/%00"]) {
      assert.equal((await fetch(origin + path, authorized)).status, 404, path);
    }
    assert.equal((await fetch(origin, { ...authorized, method: "POST" })).status, 405);
    assert.equal((await fetch(`${origin}/%ZZ`, authorized)).status, 400);
    assert.equal(allowGameSocket({ headers: { host: "play.example" } }, token), false);
    assert.equal(allowGameSocket({ headers: { host: "play.example", cookie, origin: "https://wrong.example" } }, token), false);
    assert.equal(allowGameSocket({ headers: { host: "play.example", cookie, origin: "https://play.example" } }, token), true);
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server, "close");
    assert.ok(resolve(directory).startsWith(resolve(prefix)));
    await rm(directory, { recursive: true, force: true });
  }
});
