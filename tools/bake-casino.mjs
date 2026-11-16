import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const flags = process.argv.slice(2);
if (flags.some(flag => !['--preview', '--production'].includes(flag)) || new Set(flags).size > 1)
  throw new Error('Usage: node tools/bake-casino.mjs [--preview | --production]');
const production = flags.includes('--production');
const binary = process.env.BLENDER_BINARY || (process.platform === 'win32'
  ? path.join(root, '.cache/blender/runtime/blender-4.5.9-windows-x64/blender.exe') : 'blender');
const started = Date.now();
const child = spawn(binary, ['--background', '--factory-startup', '--python-exit-code', '1',
  '--python', path.join(root, 'tools/bake-casino.py'), '--', production ? '--production' : '--preview', '--surfaces'],
{ cwd: root, windowsHide: true, stdio: 'inherit', shell: false });
const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
if (code !== 0) throw new Error(`Blender bake failed with exit ${code}; no successful bake is claimed.`);
const output = path.join(root, production ? 'public/assets/lighting' : 'test-results/bake-preview');
const manifestPath = path.join(output, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const source = await readFile(path.join(root, 'assets/source/bake/scene.json'));
if (manifest.status !== 'baked' || (await stat(manifestPath)).mtimeMs < started ||
    manifest.sourceSHA256 !== createHash('sha256').update(source).digest('hex'))
  throw new Error('Bake manifest is stale, incomplete or does not match the exported scene.');
for (const record of [...Object.values(manifest.states), manifest.meshMap]) {
  const bytes = await readFile(path.join(output, record.file));
  if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256)
    throw new Error(`Bake output checksum mismatch: ${record.file}`);
}
console.log(`Cycles ${manifest.dimensions.join('x')} bake verified. Inspect both states before shipping.`);
