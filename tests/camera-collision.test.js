import test from "node:test";
import assert from "node:assert/strict";
import { aimRay, OBSTACLES, moveCircle } from "../shared/data.js";
import { ROOMS, DOORS, barriers, circleRect, barrierDistance, roomAt } from "../shared/map.js";

const allRooms = ROOMS.map((room) => room.id);

test("jumping and looking down cannot lift the camera above the casino ceiling", () => {
  const ray = aimRay({ x: 0, z: 8, height: 1.2 }, 0, -0.65, false, allRooms);
  assert.equal(ray.origin.y, 4.8);
  assert.ok(Math.abs(Math.hypot(ray.dir.x, ray.dir.y, ray.dir.z) - 1) < 1e-12);
});

test("jumped eye height is used for furniture retraction and scoped bullet origins", () => {
  const standing = { x: -5.05, z: 4.1 };
  const ground = aimRay(standing, Math.PI, 0, false, allRooms);
  const jumped = aimRay({ ...standing, height: 1.2 }, Math.PI, 0, false, allRooms);
  assert.ok(jumped.origin.z < ground.origin.z - 1, "Jumped camera clears the jukebox top instead of retracting at standing eye level");
  const scoped = aimRay({ ...standing, height: 0.9, selected: 0, guns: [{ id: "house", attachments: { optic: "reflex" } }] }, 0.4, 0.3, true, allRooms);
  assert.equal(scoped.origin.y, 2.55);
  assert.equal(scoped.origin.x, standing.x);
  assert.equal(scoped.origin.z, standing.z);
});

test("every shutter blocks movement until both adjacent rooms are open", () => {
  for (const door of DOORS) {
    const source = ROOMS.find((room) => room.id === door.from);
    const dx = source.x - door.x, dz = source.z - door.z;
    const length = Math.hypot(dx, dz), nx = dx / length, nz = dz / length;
    const start = { x: door.x + nx * 1.6, z: door.z + nz * 1.6 };
    const closed = { ...start }, opened = { ...start };
    moveCircle(closed, -nx * 3.2, -nz * 3.2, 0.4, [door.from]);
    assert.equal(roomAt(closed)?.id, door.from, `${door.id} stays closed`);
    moveCircle(opened, -nx * 3.2, -nz * 3.2, 0.4, [door.from, door.to]);
    assert.equal(roomAt(opened)?.id, door.to, `${door.id} admits the survivor when open`);
  }
});

test("camera sweeps in all twelve rooms stay within ceiling, floor and solid partitions", () => {
  let samples = 0;
  for (const open of [["atrium"], allRooms]) {
    const solids = barriers(open);
    for (const room of ROOMS.filter((r) => open.includes(r.id))) {
      for (const ox of [-6, -3, 0, 3, 6]) for (const oz of [-6, -3, 0, 3, 6]) {
        const position = { x: room.x + ox, z: room.z + oz };
        if (solids.some((wall) => circleRect(position, 0.4, wall)) ||
          OBSTACLES.some((o) => Math.hypot(position.x - o.x, position.z - o.z) < o.r + 0.4)) continue;
        for (let angle = 0; angle < 16; angle++) for (const pitch of [-0.65, 0, 0.65]) for (const height of [0, 1]) for (const aim of [false, true]) {
          const camera = aimRay({ ...position, height }, angle * Math.PI / 8, pitch, aim, open).origin;
          const description = `${room.id} / ${ox},${oz} / yaw ${angle} / pitch ${pitch} / height ${height} / aim ${aim}`;
          assert.ok(camera.y >= 0.5 && camera.y <= 4.8, description);
          const delta = { x: camera.x - position.x, y: camera.y - (1.65 + height), z: camera.z - position.z };
          const stop = barrierDistance({ ...position, y: 1.65 + height }, delta, open);
          assert.ok(stop >= 1 || !Number.isFinite(stop), `Camera crossed a solid partition: ${description}`);
          samples++;
        }
      }
    }
  }
  assert.ok(samples > 20000, `Expected a broad camera sweep; sampled ${samples}`);
});
