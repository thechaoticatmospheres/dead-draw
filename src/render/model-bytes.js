// Fetch may already decode Content-Encoding: gzip; Pages can also serve raw .gz bytes.
export async function modelBytes(response) {
  if (!response.ok) throw new Error("Compressed model unavailable");
  const bytes = await response.arrayBuffer(),
    header = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  if (header[0] !== 0x1f || header[1] !== 0x8b) return bytes;
  return new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
  ).arrayBuffer();
}
