import { PrizeWheelScene } from "./prize-wheel.js";
import { EffectPool, ChipBatch } from "./effect-pool.js";
import { RenderMetrics } from "./metrics.js";
import { CampaignScene } from "./campaign.js";
import { ServiceScene } from "./services.js";
import { casinoEnemy, animateCasinoEnemy } from "./casino-enemies.js";
import { ENEMIES } from "../../shared/expansion.js";
import { COSMETICS } from "../../shared/campaign.js";
import { opticFor, gunStats } from "../../shared/attachments.js";
import {
  ROOMS,
  WALLS,
  DOORS,
  ROOM_SPAWNS,
  doorOpen,
} from "../../shared/map.js";
import * as THREE from "three";
import { Encounters } from "./encounters.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { Assets } from "./assets.js";
import { CasinoEnvironment } from "./environment.js";
import { CasinoLighting } from "./casino-lighting.js";
import { RoomReflectionProbes } from "./room-probes.js";
import { installStaticBake } from "./baked-lighting.js";
import {
  STATIONS,
  OBSTACLES,
  WEAPONS,
  REWARDS,
  aimRay,
} from "../../shared/data.js";
import { WHEEL_ORDER, pocketColor } from "../../shared/casino-rules.js";
export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090f14);
    this.scene.fog = new THREE.FogExp2(0x10191d, 0.025);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnvironment = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(roomEnvironment, 0.04);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 0.25;
    roomEnvironment.dispose();
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(
      60,
      innerWidth / innerHeight,
      0.1,
      100,
    );
    this.actors = new Map();
    this.retiringActors = [];
    this.cameraDirection = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3();
    this.muzzlePosition = new THREE.Vector3();
    const contactPixels = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const i = (y * 32 + x) * 4;
        contactPixels[i + 3] = Math.round(
          130 *
            Math.pow(
              Math.max(0, 1 - Math.hypot((x - 15.5) / 16, (y - 15.5) / 16)),
              1.6,
            ),
        );
      }
    const contactMap = new THREE.DataTexture(contactPixels, 32, 32);
    contactMap.needsUpdate = true;
    this.contactGeometry = new THREE.PlaneGeometry(1.4, 1.4);
    this.contactMaterial = new THREE.MeshBasicMaterial({
      map: contactMap,
      transparent: true,
      depthWrite: false,
      color: 0x000000,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      toneMapped: false,
    });
    this.effectPool = new EffectPool(this.scene);
    this.chipBatch = new ChipBatch(this.scene);
    this.scratchPosition = new THREE.Vector3();
    this.previousPosition = new THREE.Vector3();
    this.rollOrigin = new THREE.Vector3(0, 1, 0);
    this.rollAxis = new THREE.Vector3(1, 0, 0);
    this.scopeElement = document.getElementById("scopeView");
    this.scopeLabel = this.scopeElement.querySelector(".scope-label");
    this.encounters = new Encounters(this.scene);
    this.stations = {};
    this.doors = {};
    this.clock = 0;
    this.recoil = 0;
    this.scene.add(new THREE.HemisphereLight(0xa8b5c0, 0x35252b, 0.15));
    const key = new THREE.DirectionalLight(0xffddbc, 0.16);
    this.keyLight = key;
    key.position.set(4, 18, 7);
    key.castShadow = false;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -28,
      right: 28,
      top: 24,
      bottom: -24,
    });
    key.shadow.bias = -0.001;
    this.scene.add(key, key.target);
    // The composer renders offscreen, so canvas antialias alone never covers it.
    const imageTarget = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
      type: THREE.HalfFloatType,
    });
    imageTarget.samples = Math.min(4, this.renderer.capabilities.maxSamples);
    this.composer = new EffectComposer(this.renderer, imageTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.24,
      0.4,
      1.1,
    );
    this.composer.addPass(this.bloom);
    // A very light exposure-independent grain sits in the image, never over DOM HUD text.
    this.lens = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        grain: { value: 0.012 },
      },
      vertexShader:
        "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
      fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float grain; varying vec2 vUv;
        void main(){ vec4 c=texture2D(tDiffuse,vUv); float n=fract(sin(dot(gl_FragCoord.xy+floor(time*24.0),vec2(12.9898,78.233)))*43758.5453)-0.5;
        float edge=smoothstep(0.3,0.8,distance(vUv,vec2(0.5))); c.rgb*=1.0-edge*0.035; c.rgb+=n*grain*min(vec3(1.0),sqrt(max(c.rgb,vec3(0.0)))); gl_FragColor=c; }`,
    });
    this.composer.addPass(this.lens);
    this.composer.addPass(new OutputPass());
    this.quality = "high";
    this.renderer.info.autoReset = false;
    this.metrics = new RenderMetrics(
      this.renderer,
      new URLSearchParams(location.search).has("profile"),
    );
    this.build();
    this.practicalLighting = new CasinoLighting(this.scene, this.environment);
    this.reflections = new RoomReflectionProbes(this.renderer, this.scene, {resolution:64});
    this.reflections.patchStatic(this.environment.static);
    this.reflections.patchStatic(this.environment.ceiling);
    this.probeFrames = 0;
    this.resize();
    addEventListener("resize", () => this.resize());
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      document.getElementById("toast").textContent =
        "Graphics context lost. Reload to restore the floor.";
      document.getElementById("toast").style.opacity = 1;
    });
    canvas.addEventListener("webglcontextrestored", () => location.reload());
  }
  setInspectionView(view) {
    this.inspectionView = view || null;
  }
  setSeed(seed) {
    this.effectPool.setSeed(seed);
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(innerWidth, innerHeight);
  }
  setQuality(value) {
    this.quality = value;
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, value === "low" ? 1 : 1.5),
    );
    this.renderer.shadowMap.enabled = value !== "low";
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.resize();
  }
  mat(color, metalness = 0, roughness = 0.7, emissive = 0) {
    return new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      emissive,
      emissiveIntensity: 1.6,
    });
  }
  box(w, h, d, x, y, z, color, parent = this.scene, glow = false) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.mat(color, glow ? 0.2 : 0.15, 0.6, glow ? color : 0),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = !glow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  cylinder(r, h, x, y, z, color, parent = this.scene) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 24),
      this.mat(color, 0.25, 0.5),
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  sign(text, x, y, z, color = "#f4d28f", size = 2.5, parent = this.scene) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 192;
    const c = canvas.getContext("2d");
    c.fillStyle = "#0a2420";
    c.fillRect(0, 0, 1024, 192);
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.strokeRect(10, 10, 1004, 172);
    c.fillStyle = color;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = "600 74px Georgia";
    c.shadowColor = color;
    c.shadowBlur = 12;
    c.fillText(text, 512, 100, 950);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size * 0.1875),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  build() {
    this.environment = new CasinoEnvironment(this.scene);
    this.assets = new Assets();
    this.ready = this.assets.load().then(async () => {
      this.environment.install(this.assets);
      this.stations = this.environment.stations;
      this.doors = this.environment.doors;
      this.campaignScene = new CampaignScene(this.scene, this.assets);
      this.serviceScene = new ServiceScene(this.scene, this.assets);
      this.serviceScene.teller.userData.bakeExclude = true;
      this.environment.bakeExtras = this.serviceScene.roots;
      this.prizeWheelScene = new PrizeWheelScene(this.scene);
      this.bakeStatus = 'loading';
      if(new URLSearchParams(location.search).get('bake') === 'off') this.bakeStatus = 'disabled';
      else try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/lighting/manifest.json`, {cache:'no-cache'});
        if (!response.ok) throw new Error(`Lighting manifest: ${response.status}`);
        const manifest = await response.json();
        this.bakedLighting = await installStaticBake(this.environment, manifest);
        this.bakeStatus = 'ready';
        this.renderer.domElement.dataset.bakedLighting = manifest.coverage;
      } catch (error) {
        // Keep the complete game usable if an interrupted update loses an atlas.
        this.bakeStatus = 'unavailable';
        console.warn('Casino lighting remains live:', error.message);
      }
      this.loaded = true;
      this.renderer.domElement.dataset.compressedModels =
        this.assets.downloads.compressed;
    });
  }
  actor(id, zombie = false, x = 0, z = 0, kind = "walker") {
    const variant = String(id)
      .split("")
      .reduce((n, c) => n + c.charCodeAt(0), 0);
    const root =
      zombie && ENEMIES[kind]?.model
        ? casinoEnemy(this.assets, kind)
        : this.assets.character(zombie, variant);
    root.position.set(x, 0, z);
    root.userData.kind = zombie ? kind : "survivor";
    root.userData.phase = variant * 0.37;
    const contact = new THREE.Mesh(this.contactGeometry, this.contactMaterial);
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = 0.025;
    contact.renderOrder = 1;
    root.add(contact);
    root.userData.contact = contact;
    this.scene.add(root);
    this.actors.set(id, root);
    return root;
  }
  event(e, myId) {
    if (e.type === "explosion") {
      this.particles(e.x, 0.5, e.z, 0xffbd62, 35, 0.7);
      this.particles(e.x, 0.4, e.z, 0xa0c2c1, 20, 1);
      // Explosion weight is carried by light, debris and sound, never forced camera shake.
    }
    if (e.type === "dodge") this.particles(e.x, 0.3, e.z, 0x92d0b7, 7, 0.35);
    if (e.type === "shot") {
      const weapon = WEAPONS[e.weapon],
        actor = this.actors.get(e.player);
      const muzzle = this.muzzlePosition.set(e.x, e.y, e.z);
      if (e.player === myId && this.scopeId) {
        // The optic hides the third-person rig; its near-field flash stays below the sightline.
        this.camera.getWorldDirection(this.cameraDirection);
        muzzle
          .copy(this.camera.position)
          .addScaledVector(this.cameraDirection, 0.4);
        muzzle.y -= 0.08;
      } else if (actor?.userData.gun?.visible) {
        // Visual tracer starts at the animated barrel. Its endpoint is always authoritative.
        const length =
          weapon?.category === "sidearm" ? 0.34 : weapon?.melee ? 0.9 : 0.68;
        actor.userData.gun.localToWorld(muzzle.set(0, 0.025, -length));
      }
      if (actor) {
        actor.userData.swing = 0.25;
        actor.userData.kick =
          weapon?.category === "shells" || e.weapon === "rpg" ? 0.11 : 0.065;
      }
      for (const end of e.ends || [e.end]) {
        if (!end) continue;
        if (weapon?.melee) this.effectPool.arc(muzzle, end, 0xffe1a0);
        else if (e.weapon === "tesla")
          this.effectPool.arc(muzzle, end, 0xbdc5ff, true);
        else
          this.effectPool.tracer(
            muzzle,
            end,
            e.weapon === "railgun" ? 0x9feeff : 0xffe1ab,
          );
        if (!e.hit) this.particles(end.x, end.y, end.z, 0xe4c69b, 4, 0.2);
      }
      if (!weapon?.melee)
        this.effectPool.flash(
          muzzle.x,
          muzzle.y,
          muzzle.z,
          e.weapon === "tesla" ? 0xbbacff : 0xffdc9b,
        );
      if (e.weapon === "flamethrower" && e.end) {
        for (let i = 1; i <= 5; i++)
          this.effectPool.smoke(
            muzzle.x + ((e.end.x - muzzle.x) * i) / 5,
            muzzle.y + ((e.end.y - muzzle.y) * i) / 5,
            muzzle.z + ((e.end.z - muzzle.z) * i) / 5,
            i < 3 ? 0xffd398 : 0xe85b29,
            0.24,
            0.1 + i * 0.025,
          );
      } else if (!weapon?.melee)
        this.effectPool.smoke(
          muzzle.x,
          muzzle.y,
          muzzle.z,
          0xb8b3a4,
          0.32,
          0.06,
        );
      if (e.hit && e.end)
        this.particles(
          e.end.x,
          e.end.y,
          e.end.z,
          e.head ? 0xf2c071 : 0x88936b,
          e.head ? 9 : 6,
          0.28,
        );
      if (e.player === myId)
        this.recoil =
          (weapon?.category === "shells" ? 0.04 : 0.025) *
          (this.recoilScale || 1);
    }
    if (e.type === "death") {
      this.particles(e.x, 1, e.z, 0x7e926b, 12, 0.6);
      this.particles(e.x, 0.6, e.z, 0xf2c87c, 8, 0.8);
    }
    if (e.type === "payout" && e.reward !== "dud") {
      const s = STATIONS.find((s) => s.id === e.station);
      this.particles(
        s.x,
        2,
        s.z,
        0xffd47b,
        e.reward.toLowerCase().includes("jackpot") ? 70 : 24,
        1.7,
      );
    }
  }
  particles(x, y, z, color, count, life) {
    for (let i = 0; i < count; i++) {
      this.effectPool.particle(x, y, z, color, life);
    }
  }
  update(dt, state, myId, yaw, pitch, aim) {
    this.metrics.begin();
    this.renderer.info.reset();

    this.clock += dt;
    this.recoil *= Math.exp(-dt * 20);
    const t = this.clock;
    this.lens.uniforms.time.value = t;
    this.environment.update(dt, state, myId, t);
    const litPlayer = state?.players.find(p=>p.id===myId);
    this.practicalLighting.update(dt,state,litPlayer);
    this.bakedLighting?.update(dt,!!state?.campaign?.power);
    if (this.loaded && !this.probePropsPatched) {
      this.probePropsPatched = true;
      for (const root of this.environment.roomProps.values()) this.reflections.patchStatic(root);
    }
    this.campaignScene?.update(state, t, dt);
    this.serviceScene?.update(dt, state);
    this.prizeWheelScene?.update(dt, state, myId);
    this.encounters.update(state, t);
    if (state && this.loaded) {
      const ids = new Set();
      for (const p of state.players) {
        ids.add(p.id);
        const a = this.actors.get(p.id) || this.actor(p.id, false, p.x, p.z);
        const old = this.previousPosition.copy(a.position);
        const predicted =
          p.id === this.localId && this.predicted ? this.predicted : p;
        a.visible = !p.offline;
        if (!a.userData.crewOutline) {
          const marker = new THREE.Mesh(
            new THREE.TorusGeometry(0.35, 0.018, 4, 20),
            new THREE.MeshBasicMaterial({
              color: 0x82ffce,
              depthTest: false,
              transparent: true,
              opacity: 0.65,
            }),
          );
          marker.rotation.x = Math.PI / 2;
          marker.position.y = 0.08;
          marker.renderOrder = 40;
          a.add(marker);
          a.userData.crewOutline = marker;
          const badge = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.16, 0.08),
            new THREE.MeshStandardMaterial({ color: 0xffffff }),
          );
          badge.position.set(0.35, 1.32, 0);
          a.add(badge);
          a.userData.badge = badge;
          const charm = new THREE.Mesh(
            new THREE.SphereGeometry(0.042, 8, 6),
            new THREE.MeshStandardMaterial({
              color: 0xc89162,
              metalness: 0.85,
              roughness: 0.24,
            }),
          );
          charm.position.set(0.08, -0.1, 0.03);
          a.userData.gun.add(charm);
          a.userData.masteryCharm = charm;
          a.userData.disposables = [
            ...(a.userData.disposables || []),
            marker,
            badge,
            charm,
          ];
        }
        if (!a.userData.reviveLabel) {
          a.userData.reviveLabel = this.encounters.label(
            "DOWNED · HOLD F TO REVIVE",
            "#ff919f",
          );
          a.userData.reviveLabel.position.set(0, 0.95, 0);
          a.add(a.userData.reviveLabel);
        }
        a.userData.reviveLabel.visible = !!p.down && state.phase !== "over";
        a.userData.crewOutline.visible = p.id !== this.localId;
        const mastery = p.mastery?.[p.guns[p.selected].id] || 0;
        a.userData.masteryCharm.visible = mastery > 0;
        a.userData.masteryCharm.material.color.setHex(
          [0, 0xc89162, 0xc7d7dd, 0xf3ce6f][mastery],
        );
        a.userData.badge.material.color.setHex(
          COSMETICS.find((c) => c.id === p.skin)?.color || 0xffffff,
        );
        a.position.lerp(
          this.scratchPosition.set(
            predicted.x,
            p.down ? 0 : p.height || 0,
            predicted.z,
          ),
          1 - Math.exp(-dt * 18),
        );
        a.rotation.y = p.id === myId ? yaw : p.yaw;
        a.rotation.z = 0;
        a.userData.visual.rotation.set(0, 0, 0);
        a.userData.aimPitch = p.id === myId ? pitch : p.pitch || 0;
        a.userData.aiming = p.id === myId ? aim : p.aim;
        a.userData.contact.position.y = 0.025 - a.position.y;
        a.userData.contact.scale.setScalar(
          Math.max(0.45, 1 - (p.height || 0) * 0.22),
        );
        a.userData.visual.position.set(0, 0, 0);
        a.userData.gun.visible = !p.down;
        a.userData.badge.visible = !p.down;
        a.userData.crewOutline.material.color.setHex(
          p.down ? 0xff606f : 0x82ffce,
        );

        const moving =
          Math.hypot(old.x - a.position.x, old.z - a.position.z) > 0.005 &&
          !(p.height > 0.05);
        this.assets.animate(
          a,
          dt,
          moving && !p.down,
          p.reload,
          WEAPONS[p.guns[p.selected].id],
          p.guns[p.selected],
        );
        if (p.down) {
          a.userData.visual.rotation.z = Math.PI / 2;
          a.userData.visual.position.set(0.85, 0.25, 0);
        } else if (p.dodgeTime > 0) {
          const angle = -Math.PI * 2 * (1 - p.dodgeTime / 0.34);
          a.userData.visual.rotation.x = angle;
          a.userData.visual.position.set(
            0,
            1 - Math.cos(angle),
            -Math.sin(angle),
          );
          a.userData.gun.position
            .sub(this.rollOrigin)
            .applyAxisAngle(this.rollAxis, angle)
            .add(this.rollOrigin);
          a.userData.gun.rotation.x += angle;
        }
        if (a.userData.masteryCharm.parent !== a.userData.gun)
          a.userData.gun.add(a.userData.masteryCharm);
      }
      for (const z of state.zombies) {
        const id = "z" + z.id;
        ids.add(id);
        let a = this.actors.get(id);
        if (a && a.userData.kind !== z.kind) {
          this.dispose(a);
          this.actors.delete(id);
          a = null;
        }
        a ||= this.actor(id, true, z.x, z.z, z.kind);
        const before = this.previousPosition.copy(a.position);
        a.position.lerp(
          this.scratchPosition.set(z.x, 0, z.z),
          1 - Math.exp(-dt * 16),
        );
        let target = null,
          nearest = Infinity;
        if (z.yaw === undefined)
          for (const player of state.players) {
            if (player.down) continue;
            const distance = (player.x - z.x) ** 2 + (player.z - z.z) ** 2;
            if (distance < nearest) {
              nearest = distance;
              target = player;
            }
          }
        const previousHp = a.userData.previousHp;
        if (previousHp !== undefined && z.hp < previousHp)
          a.userData.impact = 1;
        a.userData.previousHp = z.hp;
        a.userData.impact = Math.max(0, (a.userData.impact || 0) - dt * 5.5);
        if (z.yaw !== undefined || target)
          a.rotation.y = z.yaw ?? Math.atan2(z.x - target.x, z.z - target.z);
        a.userData.windup = 0;
        if (
          ["brute", "security", "boss", "spitter"].includes(z.kind) &&
          z.stun > 0 &&
          !a.userData.impact
        ) {
          const warning = state.hazards?.find(
            (h) =>
              h.delay > 0 &&
              (z.kind === "boss" ||
                z.kind === "spitter" ||
                Math.hypot(h.x - z.x, h.z - z.z) < 0.8),
          );
          if (warning)
            a.userData.windup = Math.max(0, warning.delay / warning.total);
        }
        a.userData.runRate =
          z.kind === "runner" ? 1.1 : z.kind === "boss" ? 0.3 : 0.45;
        if (a.userData.customEnemy)
          animateCasinoEnemy(a, dt, z, before.distanceTo(a.position));
        else {
          a.userData.enemyState = z;
          this.assets.animate(
            a,
            dt,
            !z.stun && before.distanceTo(a.position) > 0.001,
            false,
            null,
          );
        }
        this.encounters.actor(a, z, this.camera);
        if (!a.userData.customEnemy)
          a.userData.visual.rotation.x =
            (z.stun ? -0.18 : 0.08) - a.userData.impact * 0.16;
        if (a.userData.impact) {
          a.userData.visual.rotation.z +=
            Math.sin(a.userData.impact * Math.PI) * 0.055;
        }
      }
      for (const [id, a] of this.actors)
        if (!ids.has(id)) {
          if (id.startsWith("z") && this.retiringActors.length < 8) {
            a.userData.mixer?.stopAllAction();
            const encounter = a.userData.encounter;
            if (encounter) {
              encounter.name.visible = false;
              encounter.bars.visible = false;
            }
            a.userData.contact.visible = false;
            this.retiringActors.push({ actor: a, life: 0 });
          } else this.dispose(a);
          this.actors.delete(id);
        }
      this.chipBatch.update(state.chips, t);
      const p = state.players.find((p) => p.id === myId);
      if (p) {
        const a = this.actors.get(myId),
          ray = aimRay(
            { ...p, x: a.position.x, height: a.position.y, z: a.position.z },
            yaw,
            pitch,
            aim,
            state.openRooms,
          ),
          dir = this.cameraDirection.set(ray.dir.x, ray.dir.y, ray.dir.z),
          pos = this.scratchPosition.set(
            ray.origin.x,
            ray.origin.y,
            ray.origin.z,
          );
        this.keyLight.target.position.set(p.x, 0, p.z);
        this.keyLight.position.set(p.x + 4, 18, p.z + 7);
        this.camera.position.copy(pos);
        this.camera.lookAt(this.cameraTarget.copy(pos).add(dir));
        const optic = aim && !p.down && !this.inspectionView ? opticFor(p) : null;
        a.visible = !optic;
        this.recoilScale = gunStats(
          WEAPONS[p.guns[p.selected].id],
          p.guns[p.selected],
        ).recoil;
        const scopeId = optic?.id || "";
        if (this.scopeId !== scopeId) {
          this.scopeId = scopeId;
          this.scopeElement.hidden = !optic;
          this.scopeElement.className = scopeId;
          this.scopeLabel.textContent = optic ? optic.name.toUpperCase() : "";
          document.body.classList.toggle("scoped", !!optic);
        }
        if (a.userData.gun) {
          a.userData.gun.position.z += this.recoil * 1.8;
          a.userData.gun.rotation.x -= this.recoil * 2;
        }
        const fov = optic
          ? (2 * Math.atan(Math.tan(Math.PI / 6) / optic.zoom) * 180) / Math.PI
          : aim
            ? 48
            : 60;
        const nextFov =
          this.camera.fov + (fov - this.camera.fov) * Math.min(1, dt * 12);
        if (nextFov !== this.camera.fov) {
          this.camera.fov = nextFov;
          this.camera.updateProjectionMatrix();
        }
      }
    } else {
      // Eye-height composition from inside the playable Atrium, below the real ceiling.
      this.camera.position.set(3.8 + Math.sin(t * 0.075) * 0.45, 2.35, 13.2);
      this.camera.lookAt(-1.4, 1.65, 4.1);
    }
    for (let i = this.retiringActors.length - 1; i >= 0; i--) {
      const item = this.retiringActors[i];
      item.life += dt;
      const fall = Math.min(1, item.life / 0.45),
        eased = 1 - (1 - fall) ** 3;
      item.actor.rotation.x = -eased * Math.PI * 0.48;
      item.actor.position.y = 0.08 - Math.max(0, item.life - 1.2) * 2;
      if (item.life >= 1.8) {
        this.dispose(item.actor);
        this.retiringActors.splice(i, 1);
      }
    }
    if (this.inspectionView) {
      const view = this.inspectionView;
      this.camera.position.set(...view.position);
      this.camera.lookAt(...view.target);
      if (this.camera.fov !== (view.fov || 54)) {
        this.camera.fov = view.fov || 54;
        this.camera.updateProjectionMatrix();
      }
    }
    this.effectPool.update(dt);
    if (this.loaded && ++this.probeFrames > 30) {
      const hidden = [...this.actors.values(), ...this.retiringActors.map(v=>v.actor)];
      const reflected = this.reflections.update(litPlayer,state,{
        allowCapture: this.probeFrames % 30 === 0 && this.practicalLighting.power === 0 ||
          this.probeFrames % 30 === 0 && this.practicalLighting.power > .99,
        hide:hidden,
      });
      this.scene.environmentIntensity = reflected ? .6 : .25;
    }
    if (this.quality === "high") this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.metrics.end(this.loaded, this.effectPool);
  }
  dispose(obj) {
    if (obj.userData.shared) {
      for (const o of [
        ...(obj.userData.disposables || []),
        ...(obj.userData.attachmentMeshes || []),
      ]) {
        o.geometry.dispose();
        o.material.dispose();
      }
      obj.userData.mixer?.stopAllAction();
      if (obj.userData.mixer)
        obj.userData.mixer.uncacheRoot(obj.userData.visual);
      obj.traverse((o) => o.skeleton?.dispose());
      this.scene.remove(obj);
      return;
    }
    obj.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    this.scene.remove(obj);
  }
}
