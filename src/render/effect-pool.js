import * as T from "three";

// Retain individual transparent meshes: their depth sorting and fade match the original.
// Geometry, materials, mesh nodes and motion records are reused rather than reallocated.
export class EffectPool {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.cubes = [];
    this.lines = [];
    this.geometry = new T.SphereGeometry(0.025, 6, 4);
    this.sprites = [];
    this.random = Math.random;
    const pixels = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const i = (y * 32 + x) * 4,
          r = Math.hypot((x - 15.5) / 16, (y - 15.5) / 16);
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
        pixels[i + 3] = Math.round(255 * Math.max(0, 1 - r) ** 2);
      }
    this.softMap = new T.DataTexture(pixels, 32, 32);
    this.softMap.needsUpdate = true;
    this.allocated = 0;
  }
  setSeed(seed) {
    let value = (Number(seed) || 1) >>> 0;
    this.random = () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }
  acquire(kind, color, life) {
    const free =
      kind === "cube"
        ? this.cubes
        : kind === "line"
          ? this.lines
          : this.sprites;
    let item = free.pop();
    if (!item) {
      const mesh =
        kind === "cube"
          ? new T.Mesh(
              this.geometry,
              new T.MeshBasicMaterial({ transparent: true }),
            )
          : kind === "sprite"
            ? new T.Sprite(
                new T.SpriteMaterial({
                  map: this.softMap,
                  transparent: true,
                  depthWrite: false,
                  toneMapped: false,
                }),
              )
            : new T.Line(
                new T.BufferGeometry().setAttribute(
                  "position",
                  new T.BufferAttribute(new Float32Array(6), 3),
                ),
                new T.LineBasicMaterial({ transparent: true }),
              );
      item = { kind, mesh, velocity: new T.Vector3(), life: 0, max: 0 };
      this.allocated++;
    }
    item.life = item.max = life;
    item.mesh.material.color.setHex(color);
    item.mesh.material.opacity = kind === "line" ? 0.8 : 1;
    item.mesh.material.depthWrite = false;
    item.mesh.scale.setScalar(1);
    item.mesh.rotation.set(0, 0, 0);
    item.velocity.set(0, 0, 0);
    item.flash = false;
    item.size = 1;
    this.scene.add(item.mesh);
    this.active.push(item);
    return item;
  }
  particle(x, y, z, color, life) {
    const item = this.acquire("cube", color, life);
    item.mesh.position.set(x, y, z);
    item.velocity.set(
      (this.random() - 0.5) * 3,
      this.random() * 2.3,
      (this.random() - 0.5) * 3,
    );
  }
  flash(x, y, z, color) {
    const item = this.acquire("sprite", color, 0.065);
    item.mesh.position.set(x, y, z);
    item.size = 0.32;
    item.flash = true;
    item.mesh.scale.setScalar(item.size);
    item.mesh.material.blending = T.AdditiveBlending;
  }
  smoke(x, y, z, color, life = 0.45, size = 0.12) {
    const item = this.acquire("sprite", color, life);
    item.mesh.position.set(x, y, z);
    item.velocity.set(
      (this.random() - 0.5) * 0.3,
      0.2 + this.random() * 0.25,
      (this.random() - 0.5) * 0.3,
    );
    item.size = size;
    item.mesh.scale.setScalar(size);
    item.mesh.material.rotation = this.random() * Math.PI;
    item.mesh.material.blending = T.NormalBlending;
  }
  arc(start, end, color, electric = false) {
    let previous = { x: start.x, y: start.y, z: start.z };
    for (let i = 1; i <= 6; i++) {
      const f = i / 6,
        bend = Math.sin(f * Math.PI);
      const next = {
        x:
          start.x +
          (end.x - start.x) * f +
          (electric ? (this.random() - 0.5) * 0.3 * bend : 0),
        y:
          start.y +
          (end.y - start.y) * f +
          bend * (electric ? (this.random() - 0.5) * 0.45 : 0.32),
        z: start.z + (end.z - start.z) * f,
      };
      this.tracer(previous, next, color);
      previous = next;
    }
  }
  tracer(start, end, color) {
    const item = this.acquire("line", color, 0.07),
      geometry = item.mesh.geometry;
    const position = geometry.attributes.position;
    position.setXYZ(0, start.x, start.y, start.z);
    position.setXYZ(1, end.x, end.y, end.z);
    position.needsUpdate = true;
    geometry.computeBoundingSphere();
  }
  update(dt) {
    let count = 0;
    for (const item of this.active) {
      item.life -= dt;
      if (item.life <= 0) {
        item.mesh.removeFromParent();
        (item.kind === "cube"
          ? this.cubes
          : item.kind === "line"
            ? this.lines
            : this.sprites
        ).push(item);
        continue;
      }
      if (item.kind === "cube") {
        item.mesh.position.addScaledVector(item.velocity, dt);
        item.velocity.y -= dt * 7;
        if (item.mesh.position.y < 0.04) {
          item.mesh.position.y = 0.04;
          item.velocity.y = Math.abs(item.velocity.y) * 0.22;
          item.velocity.x *= 0.7;
          item.velocity.z *= 0.7;
        }
        const size = 0.45 + (item.life / item.max) * 0.55;
        item.mesh.scale.set(size * 0.75, size * 1.8, size * 0.75);
      } else if (item.kind === "sprite") {
        item.mesh.position.addScaledVector(item.velocity, dt);
        item.mesh.scale.setScalar(
          item.size *
            (item.flash
              ? 0.4 + item.life / item.max
              : 1 + (1 - item.life / item.max) * 2),
        );
      }
      item.mesh.material.opacity =
        (item.life / item.max) *
        (item.kind === "sprite" && !item.flash ? 0.24 : 1);
      this.active[count++] = item;
    }
    this.active.length = count;
  }
  dispose() {
    const items = [
      ...this.active,
      ...this.cubes,
      ...this.lines,
      ...this.sprites,
    ];
    for (const item of items) {
      item.mesh.removeFromParent();
      item.mesh.material.dispose();
      if (item.kind === "line") item.mesh.geometry.dispose();
    }
    this.geometry.dispose();
    this.softMap.dispose();
    this.sprites = [];
    this.active = [];
    this.cubes = [];
    this.lines = [];
  }
}

export class ChipBatch {
  constructor(scene, capacity = 64) {
    this.scene = scene;
    this.capacity = capacity;
    this.pose = new T.Object3D();
    this.geometry = new T.CylinderGeometry(0.13, 0.13, 0.045, 24);
    this.material = new T.MeshStandardMaterial({
      metalness: 0.25,
      roughness: 0.5,
      emissiveIntensity: 1.6,
    });
    this.color = new T.Color();
    this.create();
  }
  create() {
    if (this.mesh) {
      this.mesh.removeFromParent();
      this.mesh.dispose();
    }
    this.mesh = new T.InstancedMesh(
      this.geometry,
      this.material,
      this.capacity,
    );
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.mesh.count = 0;
    this.scene.add(this.mesh);
  }
  update(chips, time) {
    if (chips.length > this.capacity) {
      while (this.capacity < chips.length) this.capacity *= 2;
      this.create();
    }
    this.mesh.count = chips.length;
    chips.forEach((c, i) => {
      this.pose.position.set(c.x, 0.2 + Math.sin(time * 5 + c.id) * 0.08, c.z);
      this.pose.rotation.y = time * 2;
      this.pose.updateMatrix();
      this.mesh.setMatrixAt(i, this.pose.matrix);
      this.mesh.setColorAt(
        i,
        this.color.setHex(c.value === 5 ? 0xe9707a : 0xf6edcf),
      );
    });
    if (chips.length) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
      this.mesh.computeBoundingSphere();
    }
  }
}
