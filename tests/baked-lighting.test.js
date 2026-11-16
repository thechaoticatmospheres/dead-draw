import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { checkBakeAssets } from "../tools/check-bake-assets.js";
import * as THREE from "three";
import { CasinoEnvironment } from "../src/render/environment.js";
import { bakeGeometrySignature, installStaticBake } from "../src/render/baked-lighting.js";
import { RoomReflectionProbes } from "../src/render/room-probes.js";

test("the bake exporter reads interleaved glTF vertices and exact world transforms", () => {
  const data = new Float32Array([
    1, 2, 3, 0, 1, 0, 0.2, 0.3,
    4, 2, 3, 0, 1, 0, 0.7, 0.3,
    1, 2, 6, 0, 1, 0, 0.2, 0.8,
  ]);
  const original = [...data], buffer = new THREE.InterleavedBuffer(data, 8);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  geometry.setAttribute("normal", new THREE.InterleavedBufferAttribute(buffer, 3, 3));
  geometry.setAttribute("uv", new THREE.InterleavedBufferAttribute(buffer, 2, 6));
  geometry.setIndex([0, 2, 1]);
  const material = new THREE.MeshStandardMaterial({ color: 0x665544 });
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(2, 3, 4);
  const group = new THREE.Group(); group.position.set(10, 0, 20); group.add(mesh);
  const excluded = new THREE.Group(); excluded.userData.bakeExclude = true;
  excluded.add(new THREE.Mesh(geometry, material)); group.add(excluded);
  group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ transparent: true })));
  const scene = new THREE.Scene(), ceiling = new THREE.Group(); scene.add(group, ceiling);
  const environment = Object.assign(Object.create(CasinoEnvironment.prototype), {
    scene, static: group, ceiling, roomProps: new Map([["duplicate", group]]), serviceEntrances: [], doors: {},
  });
  const exported = environment.exportBakeScene();
  assert.equal(exported.meshes.length, 1, "Movable, transparent and duplicate receivers are excluded");
  assert.deepEqual(exported.meshes[0].positions, [13, 5, 27, 16, 5, 27, 13, 5, 30]);
  assert.deepEqual(exported.meshes[0].indices, [0, 2, 1]);
  assert.equal(exported.meshes[0].bakeId, 0);
  assert.deepEqual([...data], original, "Export must not mutate shared render geometry");
});

test("normalized Int16 glTF positions export as world metres without integer wrapping", () => {
  const data = new Int16Array([
    0, 32767, 16384, 0, 32767, 0,
    32767, 0, 0, 0, 32767, 0,
    0, 0, 32767, 0, 32767, 0,
  ]);
  const original = [...data], buffer = new THREE.InterleavedBuffer(data, 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.InterleavedBufferAttribute(buffer, 3, 0, true));
  geometry.setAttribute("normal", new THREE.InterleavedBufferAttribute(buffer, 3, 3, true));
  geometry.setIndex([0, 1, 2]);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.position.set(-3, 2, 5);
  const group = new THREE.Group(), ceiling = new THREE.Group(), scene = new THREE.Scene();
  group.add(mesh); scene.add(group, ceiling);
  const environment = Object.assign(Object.create(CasinoEnvironment.prototype), {
    scene, static: group, ceiling, roomProps: new Map(), serviceEntrances: [], doors: {},
  });
  scene.updateMatrixWorld(true);
  const signatureBefore = bakeGeometrySignature(mesh), record = environment.exportBakeScene().meshes[0];
  const expected = [-3, 3, 5 + 16384 / 32767, -2, 2, 5, -3, 2, 6];
  assert.equal(record.positions.length, 9);
  record.positions.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-9, `World component ${i}`));
  assert.ok(record.positions.some(value => value > 1) && record.positions.some(value => value < -1));
  assert.equal(record.geometrySignature, signatureBefore);
  assert.equal(bakeGeometrySignature(mesh), signatureBefore, "Export preserves the original render fingerprint");
  assert.deepEqual([...data], original, "Normalized integer source data stays unchanged");
});

test("baked diffuse preserves live materials/specular and rejects changed scene geometry", async (t) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setIndex([0, 1, 2]);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.4 });
  material.onBeforeCompile = shader => { shader.fragmentShader += "\n// existing room reflection patch"; };
  material.customProgramCacheKey = () => "room-probe-existing";
  const mesh = new THREE.Mesh(geometry, material), movingMesh = new THREE.Mesh(geometry, material);
  const scene = new THREE.Scene(); scene.add(mesh, movingMesh); scene.updateMatrixWorld(true);
  const probes = Object.assign(Object.create(RoomReflectionProbes.prototype), {
    patched: new WeakSet(), center: { value: new THREE.Vector3() },
    minimum: { value: new THREE.Vector3(-8, 0, -8) }, maximum: { value: new THREE.Vector3(8, 5.2, 8) },
  });
  probes.patchStatic(scene);
  const environment = { scene, collectBakeMeshes: () => [mesh] };
  const record = {
    bakeId: 0, vertexCount: 3, indexCount: 3, triangleCount: 1,
    uv: [0.1, 0.1, 0.4, 0.1, 0.1, 0.4], geometrySignature: bakeGeometrySignature(mesh),
  };
  const manifest = {
    status: "baked", coverage: "static-diffuse", encoding: "RGBM", range: 32,
    dimensions: [4, 4], meshCount: 1, receiverCount: 1,
    meshMap: { file: "static-uv.json" },
    states: { emergency: { file: "static-emergency.png" }, restored: { file: "static-restored.png" } },
  };
  const originalFetch = globalThis.fetch, originalLoad = THREE.TextureLoader.prototype.loadAsync;
  const requested = [], textures = [];
  globalThis.fetch = async url => { requested.push(url); return { ok: true, json: async () => ({ version: 1, meshes: [record] }) }; };
  THREE.TextureLoader.prototype.loadAsync = async function (url) {
    requested.push(url); const texture = new THREE.Texture({ width: 4, height: 4 }); textures.push(texture); return texture;
  };
  t.after(() => { globalThis.fetch = originalFetch; THREE.TextureLoader.prototype.loadAsync = originalLoad; });
  mesh.position.x = 1;
  await assert.rejects(installStaticBake(environment, manifest, { baseURL: "/casino/assets/lighting/" }), /mapping mismatch/);
  assert.equal(mesh.material, material); assert.equal(mesh.geometry, geometry);
  assert.equal(textures.length, 0, "Reject stale geometry before fetching textures or changing the scene");
  mesh.position.x = 0;
  const bake = await installStaticBake(environment, manifest, { baseURL: "/casino/assets/lighting/" });
  assert.equal(bake.meshCount, 1);
  assert.notEqual(mesh.material, material); assert.equal(movingMesh.material, material);
  assert.notEqual(mesh.geometry, geometry); assert.equal(movingMesh.geometry, geometry);
  assert.equal(mesh.geometry.attributes.casinoBakeUV.count, 3);
  assert.ok(requested.every(url => url.startsWith("/casino/assets/lighting/")), "All bake requests respect the deployment subpath");
  assert.ok(textures.every(texture => texture.colorSpace === THREE.NoColorSpace && !texture.premultiplyAlpha));
  probes.patchStatic(scene);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  mesh.material.onBeforeCompile(shader, {});
  assert.match(shader.fragmentShader, /existing room reflection patch/);
  assert.equal((shader.fragmentShader.match(/vec3 casinoBoxReflection\(/g) || []).length, 1,
    "Revisiting baked clones must not duplicate the probe shader function");
  assert.match(shader.fragmentShader, /reflectedLight.directDiffuse = vec3\(0.0\)/);
  assert.match(shader.fragmentShader, /reflectedLight.indirectDiffuse = material.diffuseColor \* casinoIrradiance/);
  assert.doesNotMatch(shader.fragmentShader, /reflectedLight\.(?:direct|indirect)Specular\s*=/);
  assert.match(mesh.material.customProgramCacheKey(), /^room-probe-existing:/);
  assert.equal(shader.uniforms.casinoPowerBlend.value, 0);
  bake.update(0.2, true);
  assert.ok(shader.uniforms.casinoPowerBlend.value > 0 && shader.uniforms.casinoPowerBlend.value < 1);
  bake.setPower(true); assert.equal(shader.uniforms.casinoPowerBlend.value, 1);
  bake.dispose(); assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, material);
});

test("the shipped Cycles bake has valid two-state irradiance and UV data", async () => {
  const result = await checkBakeAssets("public/assets/lighting");
  assert.ok(result.receivers > 20);
});

test("the baked illumination belongs to the exact exported environment", async () => {
  const manifest = JSON.parse(await readFile("public/assets/lighting/manifest.json", "utf8"));
  const sceneBytes = await readFile("assets/source/bake/scene.json");
  assert.equal(createHash("sha256").update(sceneBytes).digest("hex"), manifest.sourceSHA256);
  const scene = JSON.parse(sceneBytes);
  assert.equal(scene.rooms.length, 12);
  assert.equal(scene.meshes.length, manifest.meshCount);
  const uv = JSON.parse(await readFile("public/assets/lighting/" + manifest.meshMap.file, "utf8"));
  const byId = new Map(scene.meshes.map(mesh => [mesh.bakeId, mesh]));
  for (const record of uv.meshes) {
    const mesh = byId.get(record.bakeId);
    assert.ok(mesh, `Receiver ${record.bakeId} belongs to the exported scene`);
    assert.equal(record.vertexCount, mesh.positions.length / 3);
    assert.equal(record.indexCount, mesh.indices?.length || 0);
    if (/Honed ivory marble|Woven Deco wool/.test(mesh.material.name)) {
      let surfaceArea = 0, uvArea = 0;
      for (let triangle = 0; triangle < record.triangleCount; triangle++) {
        const points = [0, 1, 2].map(corner => {
          const vertex = mesh.indices ? mesh.indices[triangle * 3 + corner] : triangle * 3 + corner;
          return new THREE.Vector3().fromArray(mesh.positions, vertex * 3);
        });
        surfaceArea += points[1].sub(points[0]).cross(points[2].sub(points[0])).length() / 2;
        const i = triangle * 6, data = record.uv;
        uvArea += Math.abs((data[i + 2] - data[i]) * (data[i + 5] - data[i + 1]) - (data[i + 4] - data[i]) * (data[i + 3] - data[i + 1])) / 2;
      }
      const texelsPerMetre = Math.sqrt(uvArea * manifest.dimensions[0] * manifest.dimensions[1] / surfaceArea);
      assert.ok(texelsPerMetre >= 16 * manifest.dimensions[0] / 4096,
        `${mesh.material.name}: ${texelsPerMetre.toFixed(2)} lighting texels/metre; floor atlas must not collapse to a few pixels`);
    }
  }
});
