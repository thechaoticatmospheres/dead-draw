import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
const root = resolve("dist");
const html = await readFile(join(root, "index.html"), "utf8");
const links = [...html.matchAll(/(?:src|href)="([^"?#]+\.(?:js|css))"/g)].map(
  (m) => m[1],
);
assert.ok(
  links.some((p) => p.endsWith(".js")),
  "Production entry must load a JS bundle",
);
for (const link of links) {
  if (/^https?:/.test(link)) continue;
  const relative = link.slice(link.indexOf("assets/"));
  assert.ok(relative.startsWith("assets/"), `Unexpected build asset ${link}`);
  assert.ok(
    (await stat(join(root, relative))).isFile(),
    `Missing asset ${link}`,
  );
}
const models = (await readdir(join(root, "assets/models"))).filter((f) =>
  f.endsWith(".glb"),
);
assert.equal(models.length, 18, "All original models must ship");
for (const model of models) {
  const data = await readFile(join(root, "assets/models", model));
  assert.equal(data.subarray(0, 4).toString(), "glTF", model);
  assert.equal(data.readUInt32LE(8), data.length, model);
}
async function inspect(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    assert.ok(
      !/^(?:\.env|\.share|\.git|\.codex|server|tests|tools|node_modules|assets\/source)$/.test(
        item.name,
      ),
      `Private/development file in build: ${item.name}`,
    );
    const path = join(dir, item.name);
    if (item.isDirectory()) await inspect(path);
    else if (/\.(?:html|css|js)$/.test(item.name)) {
      const source = await readFile(path, "utf8");
      assert.ok(
        !/trycloudflare\.com|(?:[A-Z]:\\Users\\)|["']\/@(?:vite|fs)\//i.test(
          source,
        ),
        `Preview dependency in ${item.name}`,
      );
      assert.ok(
        !/github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(
          source,
        ),
        `Credential-like content in ${item.name}`,
      );
    }
  }
}
await inspect(root);
console.log(
  `PASS: production entry, ${models.length} embedded models, compiled assets and clean static output.`,
);
