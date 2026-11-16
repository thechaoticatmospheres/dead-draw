import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { join, basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  for (let n = 0; n < 8; n++) i = (i & 1) ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
  return i >>> 0;
});
const crc32 = bytes => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const paeth = (a, b, c) => {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decode the actual PNG payload, including chunk CRC and scanline filters. */
export function decodeBakePNG(bytes) {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  let width, height, ended = false;
  const compressed = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), start = offset + 4, end = start + 4 + length;
    assert.ok(end + 4 <= bytes.length, "PNG chunk must be complete");
    const type = bytes.toString("ascii", start, start + 4), data = bytes.subarray(start + 4, end);
    assert.equal(crc32(bytes.subarray(start, end)), bytes.readUInt32BE(end), `PNG ${type} CRC`);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.ok(width > 0 && height > 0 && width <= 8192 && height <= 8192);
      assert.equal(data[8], 8, "RGBM texture uses eight bits per channel");
      assert.equal(data[9], 6, "RGBM texture needs all four RGBA channels");
      assert.equal(data[12], 0, "Bake PNG is not interlaced");
    } else if (type === "IDAT") compressed.push(data);
    else if (type === "IEND") ended = true;
    offset = end + 4;
  }
  assert.ok(ended && width && height && compressed.length, "Complete PNG image");
  const stride = width * 4, packed = inflateSync(Buffer.concat(compressed));
  assert.equal(packed.length, (stride + 1) * height, "PNG decoded byte count");
  const pixels = Buffer.allocUnsafe(stride * height);
  for (let y = 0; y < height; y++) {
    const input = y * (stride + 1), filter = packed[input], output = y * stride;
    assert.ok(filter <= 4, "Known PNG row filter");
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? pixels[output + x - 4] : 0;
      const above = y ? pixels[output + x - stride] : 0;
      const corner = x >= 4 && y ? pixels[output + x - stride - 4] : 0;
      const predicted = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? above : filter === 3 ? (left + above) >>> 1 : paeth(left, above, corner);
      pixels[output + x] = (packed[input + x + 1] + predicted) & 255;
    }
  }
  return { width, height, pixels };
}

export async function checkBakeAssets(directory) {
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  assert.equal(manifest.status, "baked");
  assert.equal(manifest.engine, "Blender Cycles");
  assert.equal(manifest.coverage, "static-diffuse");
  assert.equal(manifest.encoding, "RGBM");
  assert.ok(manifest.range > 0 && manifest.range <= 64);
  assert.match(manifest.sourceSHA256, /^[a-f0-9]{64}$/);
  assert.ok(Number.isFinite(manifest.uvOccupiedArea) && manifest.uvOccupiedArea >= 0.25 && manifest.uvOccupiedArea <= 1.001,
    "Packed receiver triangles use at least one quarter of the atlas without area overflow");
  const [width, height] = manifest.dimensions;
  const textureBytesWithMipmaps = width * height * 4 * 2 * 4 / 3;
  assert.ok(textureBytesWithMipmaps <= 220 * 1024 * 1024, "Two power-state atlases stay within the documented 220 MiB texture ceiling");
  async function payload(definition) {
    assert.equal(basename(definition.file), definition.file, "Runtime bake paths are local basenames");
    const bytes = await readFile(join(directory, definition.file));
    assert.equal(bytes.length, definition.bytes, `${definition.file} byte size`);
    assert.equal(sha256(bytes), definition.sha256, `${definition.file} SHA256`);
    return bytes;
  }
  const uv = JSON.parse((await payload(manifest.meshMap)).toString("utf8"));
  assert.equal(uv.version, 1);
  assert.equal(uv.meshes.length, manifest.receiverCount);
  const ids = new Set(); let triangles = 0;
  for (const mesh of uv.meshes) {
    assert.ok(!ids.has(mesh.bakeId), `Unique receiver ID ${mesh.bakeId}`); ids.add(mesh.bakeId);
    assert.equal(mesh.uv.length, mesh.triangleCount * 6, `${mesh.bakeId} per-corner UV count`);
    assert.equal(mesh.triangleCount * 3, mesh.indexCount || mesh.vertexCount, `${mesh.bakeId} source topology`);
    assert.ok(mesh.uv.every(value => Number.isFinite(value) && value >= -0.000001 && value <= 1.000001), `${mesh.bakeId} finite, bounded UVs`);
    assert.ok(Number.isFinite(mesh.worldArea) && mesh.worldArea > 0, `${mesh.bakeId} nonzero physical receiver area`);
    if (/Honed ivory marble|Woven Deco wool/.test(mesh.materialName))
      assert.ok(mesh.texelsPerMetre >= 16, `${mesh.materialName} has at least 16 lighting texels/metre at production resolution`);
    triangles += mesh.triangleCount;
  }
  assert.equal(triangles, manifest.triangles);
  assert.ok(manifest.meshCount >= manifest.receiverCount && manifest.receiverCount > 0);
  const states = {};
  for (const state of ["emergency", "restored"]) {
    const definition = manifest.states[state], image = decodeBakePNG(await payload(definition));
    assert.deepEqual([image.width, image.height], [width, height]);
    assert.ok(Number.isFinite(definition.decodedRelativeError) && definition.decodedRelativeError < 0.035, `${state} stored RGBM decode matches the original float bake`);
    assert.ok(Number.isFinite(definition.clippedFraction) && definition.clippedFraction < 0.01, `${state} clipped light pixels stay below one percent`);
    if (manifest.denoising) {
      assert.equal(manifest.denoising.method, "OpenImageDenoise RT");
      assert.ok(Number.isFinite(definition.denoiseEnergyChangeFraction) && definition.denoiseEnergyChangeFraction <= 0.15,
        `${state} denoising preserves the measured Cycles lighting energy`);
    }
    let sum = 0, peak = 0, litPixels = 0, minimum = Infinity;
    for (let i = 0; i < image.pixels.length; i += 4) {
      const multiplier = image.pixels[i + 3] / 255 * manifest.range;
      const value = (image.pixels[i] + image.pixels[i + 1] + image.pixels[i + 2]) / (255 * 3) * multiplier;
      sum += value; peak = Math.max(peak, value); minimum = Math.min(minimum, value);
      if (value > 0.0001) litPixels++;
    }
    const mean = sum / (width * height);
    assert.ok(mean > 0.0001 && peak > mean * 1.1 && minimum < peak, `${state} has nonblack, spatially varying illumination`);
    assert.ok(litPixels > width * height * 0.02, `${state} bake covers a meaningful area`);
    states[state] = { mean, peak, litPixels, bytes: definition.bytes };
  }
  assert.ok(states.restored.mean > states.emergency.mean * 1.08, "Restored power adds actual light energy, not only a tint");
  assert.notEqual(manifest.states.emergency.sha256, manifest.states.restored.sha256);
  return { coverage: manifest.coverage, receivers: uv.meshes.length, triangles, dimensions: manifest.dimensions, uvOccupiedArea: manifest.uvOccupiedArea, textureBytesWithMipmaps: Math.ceil(textureBytesWithMipmaps), states };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await checkBakeAssets(process.argv[2] || "public/assets/lighting"), null, 2));
}
