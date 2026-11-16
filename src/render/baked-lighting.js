import * as T from 'three';

/** A topology/placement guard: a changed mesh must be rebaked, never mis-mapped. */
export function bakeGeometrySignature(mesh) {
  const position = mesh.geometry.attributes.position, point = new T.Vector3();
  let hash = 2166136261;
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    for (const value of [point.x, point.y, point.z])
      hash = Math.imul(hash ^ (Math.round(Math.fround(value) * 10000) >>> 0), 16777619) >>> 0;
  }
  const index = mesh.geometry.index;
  if (index) for (let i = 0; i < index.count; i++) hash = Math.imul(hash ^ index.getX(i), 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

function checkManifest(manifest) {
  if (manifest?.status !== 'baked' || manifest.coverage !== 'static-diffuse' || manifest.encoding !== 'RGBM')
    throw new Error('A successful static Cycles RGBM manifest is required.');
  if (!Number.isFinite(manifest.range) || manifest.range <= 0 || manifest.range > 128)
    throw new Error('Invalid Cycles radiance range.');
  const safe = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+\.(png|json)$/.test(value);
  if (!safe(manifest.meshMap?.file) || !['emergency', 'restored'].every(state => safe(manifest.states?.[state]?.file)))
    throw new Error('Invalid local Cycles asset paths.');
}

/**
 * Replaces static diffuse illumination with genuine Cycles transport. Live
 * specular, environment reflections, animation, and dynamic actors stay live.
 * Both power states share identical padded UVs. No albedo is baked twice.
 */
export async function installStaticBake(environment, manifest, options = {}) {
  checkManifest(manifest);
  const base = options.baseURL ?? `${import.meta.env.BASE_URL}assets/lighting/`;
  const response = await fetch(base + manifest.meshMap.file + `?v=${manifest.meshMap.sha256}`);
  if (!response.ok) throw new Error(`Cycles UV map unavailable (${response.status}).`);
  const map = await response.json(), objects = environment.collectBakeMeshes();
  environment.scene.updateMatrixWorld(true);
  if (objects.length !== manifest.meshCount || map.version !== 1 || map.meshes.length !== manifest.receiverCount)
    throw new Error('Static environment changed: rebuild the casino lightmaps.');
  const bindings = [], seen = new Set();
  // Validate the entire mapping before mutating the renderable scene.
  for (const record of map.meshes) {
    const mesh = objects[record.bakeId], geometry = mesh?.geometry;
    if (!mesh?.material?.isMeshStandardMaterial || seen.has(record.bakeId) ||
        geometry.attributes.position.count !== record.vertexCount || (geometry.index?.count || 0) !== record.indexCount ||
        record.uv.length !== record.triangleCount * 6 || record.uv.some(v => !Number.isFinite(v) || v < 0 || v > 1) ||
        record.geometrySignature && bakeGeometrySignature(mesh) !== record.geometrySignature)
      throw new Error(`Cycles mesh mapping mismatch at ${record.bakeId}. Re-export and rebake.`);
    seen.add(record.bakeId); bindings.push({ mesh, record });
  }
  const loader = new T.TextureLoader(), textures = [];
  try {
    for (const state of ['emergency', 'restored']) {
      const texture = await loader.loadAsync(base + manifest.states[state].file + `?v=${manifest.states[state].sha256}`);
      texture.colorSpace = T.NoColorSpace; texture.premultiplyAlpha = false;
      texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
      texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
      texture.anisotropy = 4;
      if (texture.image.width !== manifest.dimensions[0] || texture.image.height !== manifest.dimensions[1]) {
        texture.dispose(); throw new Error('Cycles atlas dimensions do not match the manifest.');
      }
      textures.push(texture);
    }
  } catch (error) { textures.forEach(texture => texture.dispose()); throw error; }
  const power = { value: options.restored ? 1 : 0 }, clones = new Map(), changes = [];
  for (const { mesh, record } of bindings) {
    const original = mesh.material;
    let material = clones.get(original);
    if (!material) {
      material = original.clone();
      const prior = original.onBeforeCompile, priorKey = original.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        prior.call(material, shader, renderer);
        shader.uniforms.casinoBakeEmergency = { value: textures[0] };
        shader.uniforms.casinoBakeRestored = { value: textures[1] };
        shader.uniforms.casinoPowerBlend = power;
        shader.uniforms.casinoBakeRange = { value: manifest.range };
        shader.vertexShader = shader.vertexShader.replace('#include <common>',
          '#include <common>\nattribute vec2 casinoBakeUV;\nvarying vec2 vCasinoBakeUV;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCasinoBakeUV = casinoBakeUV;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vCasinoBakeUV;
uniform sampler2D casinoBakeEmergency;
uniform sampler2D casinoBakeRestored;
uniform float casinoPowerBlend;
uniform float casinoBakeRange;
vec3 decodeCasinoRGBM(vec4 value) { return value.rgb * value.a * casinoBakeRange; }
`).replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
vec3 casinoIrradiance = mix(decodeCasinoRGBM(texture2D(casinoBakeEmergency, vCasinoBakeUV)),
  decodeCasinoRGBM(texture2D(casinoBakeRestored, vCasinoBakeUV)), casinoPowerBlend);
reflectedLight.directDiffuse = vec3(0.0);
reflectedLight.indirectDiffuse = material.diffuseColor * casinoIrradiance;
`);
      };
      material.customProgramCacheKey = () => `${priorKey}:casino-cycles-static-v2`;
      material.needsUpdate = true; clones.set(original, material);
    }
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.setAttribute('casinoBakeUV', new T.Float32BufferAttribute(record.uv, 2));
    changes.push({ mesh, geometry: mesh.geometry, material: mesh.material, bakedGeometry: geometry });
    mesh.geometry = geometry; mesh.material = material;
  }
  return {
    coverage: manifest.coverage, materialCount: clones.size, meshCount: changes.length,
    dimensions: manifest.dimensions, gpuBytesWithMipmaps: manifest.gpuBytesWithMipmaps,
    update(dt, restored) { power.value = T.MathUtils.damp(power.value, restored ? 1 : 0, 2.5, dt); },
    setPower(restored) { power.value = restored ? 1 : 0; },
    dispose() {
      changes.forEach(change => { change.mesh.geometry = change.geometry; change.mesh.material = change.material; change.bakedGeometry.dispose(); });
      clones.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
    },
  };
}
