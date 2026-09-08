import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { resolve, relative, extname, sep, isAbsolute } from "node:path";
import { timingSafeEqual } from "node:crypto";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

function equal(a, b) {
  const first = Buffer.from(a),
    second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function hasInvite(req, token) {
  if (!token) return true;
  const cookie = String(req.headers.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("dead_draw_invite="));
  return Boolean(
    cookie && equal(cookie.slice("dead_draw_invite=".length), token),
  );
}

export function allowGameSocket(req, token, allowedOrigins = []) {
  if (!hasInvite(req, token)) return false;
  if (!req.headers.origin) return true;
  try {
    const origin = new URL(req.headers.origin);
    return allowedOrigins.length
      ? allowedOrigins.includes(origin.origin)
      : origin.host === req.headers.host;
  } catch {
    return false;
  }
}

export async function createProductionHandler(directory, token = "") {
  const root = await realpath(directory);
  await stat(resolve(root, "index.html"));
  return async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "private, no-store");
    const end = (status, text) => {
      res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(text);
    };
    if (!["GET", "HEAD"].includes(req.method))
      return end(405, "Method not allowed");
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      return end(400, "Invalid path");
    }
    if (token && pathname.startsWith("/invite/")) {
      if (!equal(pathname.slice("/invite/".length), token))
        return end(403, "Invalid invitation");
      res.setHeader(
        "Set-Cookie",
        `dead_draw_invite=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`,
      );
      res.writeHead(303, { Location: "/" });
      return res.end();
    }
    if (!hasInvite(req, token))
      return end(403, "Open your DEAD DRAW invitation link to play.");
    if (pathname === "/health") return end(200, "DEAD DRAW ready");
    if (pathname === "/") pathname = "/index.html";
    if (
      pathname.includes("\\") ||
      pathname.includes("\0") ||
      pathname.split("/").some((p) => p.startsWith("."))
    ) {
      return end(404, "Not found");
    }
    try {
      const target = await realpath(resolve(root, `.${pathname}`));
      const within = relative(root, target);
      if (
        !within ||
        isAbsolute(within) ||
        within.startsWith(`..${sep}`) ||
        within === ".."
      )
        return end(404, "Not found");
      const type = types[extname(target).toLowerCase()];
      const info = await stat(target);
      if (!type || !info.isFile()) return end(404, "Not found");
      res.writeHead(200, { "Content-Type": type, "Content-Length": info.size });
      if (req.method === "HEAD") return res.end();
      const stream = createReadStream(target);
      stream.on("error", () => res.destroy());
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    } catch {
      end(404, "Not found");
    }
  };
}
