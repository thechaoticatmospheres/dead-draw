import { defineConfig, loadEnv } from "vite";

export function normalizeBase(value = "/") {
  const path = value.trim().replace(/^\/+|\/+$/g, "");
  return path ? `/${path}/` : "/";
}

export default defineConfig(({ mode }) => ({
  // configure-pages supplies the real repository path in CI, including custom domains.
  base: normalizeBase(loadEnv(mode, process.cwd(), "").BASE_PATH || "/"),
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
}));
