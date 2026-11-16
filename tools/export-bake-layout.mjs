// Authoritative world coordinates, in metres. Run before every Cycles bake.
import { ROOMS, WALLS, OUTER_WALLS, DOORS } from '../shared/map.js';
import { STATIONS, OBSTACLES } from '../shared/data.js';
import { SERVICES } from '../shared/services.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const layout = { rooms: ROOMS, walls: [...WALLS, ...OUTER_WALLS], doors: DOORS, stations: STATIONS, obstacles: OBSTACLES, services: SERVICES };
const json = JSON.stringify(layout, null, 2);
await mkdir('assets/source/bake', { recursive: true });
await writeFile('assets/source/bake/layout.json', json);
console.log(`Exported ${ROOMS.length} rooms, ${layout.walls.length} partitions, ${OBSTACLES.length} static collision envelopes. SHA-256 ${createHash('sha256').update(json).digest('hex')}`);
