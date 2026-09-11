import * as T from "three";

// Retain individual transparent meshes: their depth sorting and fade match the original.
// Geometry, materials, mesh nodes and motion records are reused rather than reallocated.
export class EffectPool {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.cubes = [];
    this.lines = [];
    this.geometry = new T.BoxGeometry(0.06, 0.06, 0.06);
    this.allocated = 0;
  }
  acquire(kind, color, life) {
    const free = kind === "cube" ? this.cubes : this.lines;
    let item = free.pop();
    if (!item) {
      const mesh =
        kind === "cube"
          ? new T.Mesh(
              this.geometry,
              new T.MeshBasicMaterial({ transparent: true }),
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
    this.scene.add(item.mesh);
    this.active.push(item);
    return item;
  }
  particle(x, y, z, color, life) {
    const item = this.acquire("cube", color, life);
    item.mesh.position.set(x, y, z);
    item.velocity.set(
      (Math.random() - 0.5) * 4,
      Math.random() * 3,
      (Math.random() - 0.5) * 4,
    );
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
        (item.kind === "cube" ? this.cubes : this.lines).push(item);
        continue;
      }
      if (item.kind === "cube") {
        item.mesh.position.addScaledVector(item.velocity, dt);
        item.velocity.y -= dt * 5;
      }
      item.mesh.material.opacity = item.life / item.max;
      this.active[count++] = item;
    }
    this.active.length = count;
  }
  dispose() {
    const items = [...this.active, ...this.cubes, ...this.lines];
    for (const item of items) {
      item.mesh.removeFromParent();
      item.mesh.material.dispose();
      if (item.kind === "line") item.mesh.geometry.dispose();
    }
    this.geometry.dispose();
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
