import { Matrix4, Mesh } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Only call on rigid, non-interactive pieces. Animated ancestors remain independent.
export function batchRigid(root, recursive = false) {
  root.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(root.matrixWorld).invert(),
    buckets = new Map();
  const visit = (o) => {
    if (
      !o.isMesh ||
      o.isSkinnedMesh ||
      o.children.length ||
      !o.visible ||
      Array.isArray(o.material) ||
      o.material.transparent ||
      Object.keys(o.geometry.morphAttributes).length
    )
      return;
    const key = [
      o.material.uuid,
      o.castShadow,
      o.receiveShadow,
      o.renderOrder,
      o.layers.mask,
      Object.keys(o.geometry.attributes).sort().join(),
      !!o.geometry.index,
    ].join(":");
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  };
  if (recursive) root.traverse(visit);
  else root.children.forEach(visit);
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const copies = meshes.map((o) =>
      o.geometry
        .clone()
        .applyMatrix4(new Matrix4().multiplyMatrices(inverse, o.matrixWorld)),
    );
    const geometry = mergeGeometries(copies);
    copies.forEach((g) => g.dispose());
    if (!geometry) continue;
    const source = meshes[0],
      merged = new Mesh(geometry, source.material);
    merged.castShadow = source.castShadow;
    merged.receiveShadow = source.receiveShadow;
    merged.renderOrder = source.renderOrder;
    merged.layers.mask = source.layers.mask;
    merged.name = "RigidBatch";
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    root.add(merged);
    const originals = new Set(meshes.map((o) => o.geometry));
    meshes.forEach((o) => o.removeFromParent());
    // This runs before asset cloning or first GPU upload.
    originals.forEach((g) => g.dispose());
  }
  return root;
}

export function freezeLocalMatrices(root) {
  root.traverse((o) => {
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
}
