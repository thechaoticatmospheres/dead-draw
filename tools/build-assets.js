import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  resample,
  weld,
  quantize,
} from "@gltf-transform/functions";
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS),
  browser = await chromium.launch({ channel: "msedge", headless: true });
await fs.mkdir("public/assets/models", { recursive: true });
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error(e));
  await page.exposeFunction("saveModel", async (name, b64) => {
    const doc = await io.readBinary(Buffer.from(b64, "base64"));
    await doc.transform(dedup(), weld(), quantize(), prune(), resample());
    const out = await io.writeBinary(doc);
    await fs.writeFile("public/assets/models/" + name + ".glb", out);
    console.log(
      name +
        ": " +
        Math.round(out.length / 1024) +
        " KiB / " +
        doc.getRoot().listAnimations().length +
        " clips",
    );
  });
  await page.goto("http://127.0.0.1:5188");
  for (let retry = 0; retry < 2; retry++) {
    try {
      await page.evaluate(async () => {
        const m = await import("/tools/author-assets.js");
        await m.author(window.saveModel);
      });
      break;
    } catch (e) {
      if (retry || !e.message.includes("context was destroyed")) throw e;
      await page.waitForTimeout(1500);
    }
  }
} finally {
  await browser.close();
}
