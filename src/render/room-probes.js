import * as T from 'three';
import { roomAt } from '../../shared/map.js';

/**
 * Room-local reflections captured from the actual playable casino. Captures are
 * lazy, cached by room + campaign power + door topology, and never run in combat.
 * 128px cubes are convolved once, not refreshed each frame. A caller explicitly
 * budgets the one-time capture through update(..., { allowCapture: true }).
 */
export class RoomReflectionProbes {
  constructor(renderer, scene, { resolution = 128, maxCached = 6 } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.resolution = Math.min(128, Math.max(32, resolution));
    this.maxCached = Math.max(2, Math.min(12, maxCached));
    this.cache = new Map();
    this.pmrem = new T.PMREMGenerator(renderer);
    this.pmrem.compileCubemapShader();
    this.baseEnvironment = scene.environment;
    this.center = { value: new T.Vector3(0, 2.3, 8) };
    this.minimum = { value: new T.Vector3(-8, 0, 0) };
    this.maximum = { value: new T.Vector3(8, 5.2, 16) };
    this.patched = new WeakSet();
    this.captures = 0;
    this.captureMilliseconds = 0;
  }

  /** Apply position correction to reflective static materials only. */
  patchStatic(root) {
    root.traverse(object => {
      if (!object.isMesh || object.isSkinnedMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material?.isMeshStandardMaterial || this.patched.has(material) || material.userData.casinoProbePatched) continue;
        if ((material.metalness || 0) < .3 && material.roughness > .52) continue;
        this.patched.add(material);
        material.userData.casinoProbePatched = true;
        const prior = material.onBeforeCompile, priorKey = material.customProgramCacheKey.bind(material);
        const key = priorKey();
        material.onBeforeCompile = (shader, renderer) => {
          prior.call(material, shader, renderer);
          shader.uniforms.casinoProbeCenter = this.center;
          shader.uniforms.casinoProbeMin = this.minimum;
          shader.uniforms.casinoProbeMax = this.maximum;
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vCasinoProbePosition;')
            .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCasinoProbePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
          const header = `
varying vec3 vCasinoProbePosition;
uniform vec3 casinoProbeCenter;
uniform vec3 casinoProbeMin;
uniform vec3 casinoProbeMax;
vec3 casinoBoxReflection(vec3 direction) {
  // Only apply the local correction while the fragment is inside this room.
  if (any(lessThan(vCasinoProbePosition, casinoProbeMin - vec3(.1))) || any(greaterThan(vCasinoProbePosition, casinoProbeMax + vec3(.1)))) return direction;
  vec3 ray = sign(direction + vec3(.000001)) * max(abs(direction), vec3(.0001));
  vec3 hitA = (casinoProbeMax - vCasinoProbePosition) / ray;
  vec3 hitB = (casinoProbeMin - vCasinoProbePosition) / ray;
  vec3 furthest = max(hitA, hitB);
  float distanceToBox = min(furthest.x, min(furthest.y, furthest.z));
  return normalize(vCasinoProbePosition + direction * distanceToBox - casinoProbeCenter);
}
`;
          const env = T.ShaderChunk.envmap_physical_pars_fragment.replace(
            'envMapRotation * reflectVec, roughness',
            'envMapRotation * casinoBoxReflection(reflectVec), roughness',
          );
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\n' + header)
            .replace('#include <envmap_physical_pars_fragment>', env);
        };
        material.customProgramCacheKey = () => `${key}:casino-box-probe-v1`;
        material.needsUpdate = true;
      }
    });
  }

  update(position, state, { allowCapture = false, hide = [] } = {}) {
    const room = roomAt(position || { x: 0, z: 8 });
    if (!room) return false;
    const power = !!state?.campaign?.power;
    const topology = (state?.openRooms || ['atrium']).slice().sort().join(',');
    const key = `${room.id}:${power ? 1 : 0}:${topology}`;
    let entry = this.cache.get(key);
    if (!entry && allowCapture && state?.phase !== 'combat') entry = this.capture(room, key, hide);
    if (!entry) {
      this.scene.environment = this.baseEnvironment;
      return false;
    }
    this.scene.environment = entry.target.texture;
    this.center.value.set(room.x, 2.3, room.z);
    this.minimum.value.set(room.x - 8, 0, room.z - 8);
    this.maximum.value.set(room.x + 8, 5.2, room.z + 8);
    return true;
  }

  capture(room, key, hide) {
    const started = performance.now();
    const cube = new T.WebGLCubeRenderTarget(this.resolution, { type: T.HalfFloatType, generateMipmaps: false });
    const camera = new T.CubeCamera(.08, 42, cube);
    camera.position.set(room.x, 2.3, room.z);
    const hidden = hide.filter(Boolean).map(object => [object, object.visible]);
    const previous = this.scene.environment;
    const previousToneMapping = this.renderer.toneMapping;
    const previousShadowUpdate = this.renderer.shadowMap.autoUpdate;
    try {
      hidden.forEach(([object]) => { object.visible = false; });
      // Prevent a feedback loop from a previously captured environment.
      this.scene.environment = this.baseEnvironment;
      this.renderer.toneMapping = T.NoToneMapping;
      this.renderer.shadowMap.autoUpdate = false;
      camera.update(this.renderer, this.scene);
      const target = this.pmrem.fromCubemap(cube.texture);
      const entry = { target, room: room.id };
      this.cache.set(key, entry);
      this.captures++;
      while (this.cache.size > this.maxCached) {
        const oldest = this.cache.keys().next().value;
        this.cache.get(oldest).target.dispose();
        this.cache.delete(oldest);
      }
      return entry;
    } finally {
      this.scene.environment = previous;
      this.renderer.toneMapping = previousToneMapping;
      this.renderer.shadowMap.autoUpdate = previousShadowUpdate;
      hidden.forEach(([object, visible]) => { object.visible = visible; });
      cube.dispose();
      this.captureMilliseconds += performance.now() - started;
    }
  }

  dispose() {
    if ([...this.cache.values()].some(entry => entry.target.texture === this.scene.environment))
      this.scene.environment = this.baseEnvironment;
    this.cache.forEach(entry => entry.target.dispose());
    this.cache.clear();
    this.pmrem.dispose();
  }
}
