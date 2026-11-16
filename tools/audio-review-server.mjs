import http from "node:http";
import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, sep, extname } from "node:path";

const root = process.env.AUDIO_REVIEW_ROOT
  ? resolve(process.env.AUDIO_REVIEW_ROOT)
  : fileURLToPath(new URL("../docs/audio-review/", import.meta.url));
const port = Number(process.env.AUDIO_REVIEW_PORT || 5190);
const host = `127.0.0.1:${port}`;
let saving = Promise.resolve();
const server = http.createServer(async (req, res) => {
  const reply = (status, body, type = "application/json") => {
    res.writeHead(status, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
  };
  try {
    if (req.headers.host !== host)
      return reply(403, '{"error":"Local access only"}');
    const pathname = decodeURIComponent(
      new URL(req.url, `http://${host}`).pathname,
    );
    if (pathname === "/api/decisions") {
      if (req.method === "GET") {
        const data = await readFile(
          resolve(root, "decisions.json"),
          "utf8",
        ).catch((e) => {
          if (e.code === "ENOENT") return '{"version":1,"sounds":{}}';
          throw e;
        });
        return reply(200, data);
      }
      if (req.method !== "POST") return reply(405, "{}");
      if (
        req.headers.origin !== `http://${host}` ||
        !req.headers["content-type"]?.startsWith("application/json")
      )
        return reply(403, "{}");
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 65536) return reply(413, "{}");
      }
      let input;
      try {
        input = JSON.parse(raw);
      } catch {
        return reply(400, '{"error":"Invalid JSON"}');
      }
      const catalog = JSON.parse(
        await readFile(resolve(root, "catalog.json"), "utf8"),
      );
      const sounds = {};
      if (
        !input.sounds ||
        typeof input.sounds !== "object" ||
        Array.isArray(input.sounds)
      )
        return reply(400, "{}");
      for (const [id, choice] of Object.entries(input.sounds)) {
        const sound = catalog.sounds.find((s) => s.id === id);
        const ids = new Set(sound?.candidates.map((c) => c.id));
        if (
          !sound ||
          !choice ||
          (choice.pick !== null && !ids.has(choice.pick)) ||
          !Array.isArray(choice.alternates) ||
          choice.alternates.some((a) => !ids.has(a)) ||
          typeof choice.notes !== "string" ||
          choice.notes.length > 4000 ||
          typeof choice.regenerate !== "boolean"
        )
          return reply(400, '{"error":"Invalid selection"}');
        sounds[id] = {
          pick: choice.pick,
          alternates: [...new Set(choice.alternates)].filter(
            (a) => a !== choice.pick,
          ),
          notes: choice.notes,
          regenerate: choice.regenerate,
        };
      }
      saving = saving
        .catch(() => {})
        .then(async () => {
          const prior = JSON.parse(
            await readFile(resolve(root, "decisions.json"), "utf8").catch(
              (e) => {
                if (e.code === "ENOENT") return '{"sounds":{}}';
                throw e;
              },
            ),
          );
          const data =
            JSON.stringify(
              {
                version: 1,
                updatedAt: new Date().toISOString(),
                sounds: { ...prior.sounds, ...sounds },
              },
              null,
              2,
            ) + "\n";
          await writeFile(resolve(root, "decisions.json.tmp"), data);
          await rename(
            resolve(root, "decisions.json.tmp"),
            resolve(root, "decisions.json"),
          );
          return data;
        });
      const data = await saving;
      return reply(200, data);
    }
    if (!["GET", "HEAD"].includes(req.method)) return reply(405, "{}");
    const file = resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep))
      return reply(403, "{}");
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".md": "text/plain; charset=utf-8",
    };
    if (!types[extname(file)]) return reply(404, "{}");
    const bytes = await readFile(file);
    reply(200, req.method === "HEAD" ? "" : bytes, types[extname(file)]);
  } catch (e) {
    reply(
      e.code === "ENOENT" ? 404 : 500,
      JSON.stringify({
        error:
          e.code === "ENOENT"
            ? "Not found"
            : "Could not read or save review data",
      }),
    );
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Sound review ready at http://${host}`),
);
