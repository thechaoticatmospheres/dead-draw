import { defineConfig, loadEnv } from "vite";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
const models = readdirSync(new URL("./public/assets/models/", import.meta.url))
  .filter((name) => name.endsWith(".glb"))
  .map((name) => ({
    name,
    bytes: readFileSync(
      new URL(`./public/assets/models/${name}`, import.meta.url),
    ),
  }));

export function normalizeBase(value = "/") {
  const path = value.trim().replace(/^\/+|\/+$/g, "");
  return path ? `/${path}/` : "/";
}

export default defineConfig(({ mode }) => ({
  // configure-pages supplies the real repository path in CI, including custom domains.
  base: normalizeBase(loadEnv(mode, process.cwd(), "").BASE_PATH || "/"),
  define: {
    __MODEL_REVISIONS__: JSON.stringify(
      Object.fromEntries(
        models.map(({ name, bytes }) => [
          name.slice(0, -4),
          createHash("sha256").update(bytes).digest("hex").slice(0, 12),
        ]),
      ),
    ),
  },
  plugins: [
    {
      name: "lossless-model-downloads",
      generateBundle() {
        for (const { name, bytes } of models)
          this.emitFile({
            type: "asset",
            fileName: `assets/models/${name}.gz`,
            source: gzipSync(bytes, { level: 9 }),
          });
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/")) return "three";
        },
      },
    },
  },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
}));
