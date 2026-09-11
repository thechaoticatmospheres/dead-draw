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
import { Assets } from "./assets.js";
import { CasinoEnvironment } from "./environment.js";
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
    this.scene.environmentIntensity = 0.42;
    roomEnvironment.dispose();
    pmrem.dispose();
    this.camera = new THREE.PerspectiveCamera(
      60,
      innerWidth / innerHeight,
      0.1,
      100,
    );
    this.actors = new Map();
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
    this.scene.add(new THREE.HemisphereLight(0xa8c5cf, 0x35252b, 0.48));
    const key = new THREE.DirectionalLight(0xffddbc, 1.3);
    this.keyLight = key;
    key.position.set(4, 18, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -28,
      right: 28,
      top: 24,
      bottom: -24,
    });
    key.shadow.bias = -0.001;
    this.scene.add(key, key.target);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.24,
      0.4,
      1.1,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.quality = "high";
    this.renderer.info.autoReset = false;
    this.metrics = new RenderMetrics(
      this.renderer,
      new URLSearchParams(location.search).has("profile"),
    );
    this.build();
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
    this.ready = this.assets.load().then(() => {
      this.environment.install(this.assets);
      this.stations = this.environment.stations;
      this.doors = this.environment.doors;
      this.campaignScene = new CampaignScene(this.scene, this.assets);
      this.serviceScene = new ServiceScene(this.scene, this.assets);
      this.prizeWheelScene = new PrizeWheelScene(this.scene);
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
    this.scene.add(root);
    this.actors.set(id, root);
    return root;
  }
  event(e, myId) {
    if (e.type === "explosion") {
      this.particles(e.x, 0.5, e.z, 0xffbd62, 35, 0.7);
      this.particles(e.x, 0.4, e.z, 0xa0c2c1, 20, 1);
      this.hurtShake = 0.04;
    }
    if (e.type === "dodge") this.particles(e.x, 0.3, e.z, 0x92d0b7, 7, 0.35);
    if (e.type === "shot") {
      for (const end of e.ends || [e.end]) {
        this.effectPool.tracer(e, end, WEAPONS[e.weapon]?.color || 0xffda8e);
      }
      this.particles(
        e.x,
        e.y,
        e.z,
        WEAPONS[e.weapon]?.color || 0xffd181,
        3,
        0.12,
      );
      if (e.weapon === "flamethrower")
        this.particles(e.end.x, e.end.y, e.end.z, 0xff7634, 8, 0.35);
      const actor = this.actors.get(e.player);
      if (actor) actor.userData.swing = 0.25;
      if (e.hit)
        this.particles(
          e.end.x,
          e.end.y,
          e.end.z,
          e.head ? 0xffd47b : 0x9bac79,
          7,
          0.25,
        );
      if (e.player === myId) this.recoil = 0.025 * (this.recoilScale || 1);
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
    this.hurtShake = (this.hurtShake || 0) * Math.exp(-dt * 14);
    this.clock += dt;
    this.recoil *= Math.exp(-dt * 20);
    const t = this.clock;
    this.environment.update(dt, state, myId, t);
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
          a.userData.disposables = [marker, badge, charm];
        }
        if (!a.userData.reviveLabel) {
          a.userData.reviveLabel = this.encounters.label(
            "DOWNED · HOLD F TO REVIVE",
            "#ff919f",
          );
          a.userData.reviveLabel.position.set(0, 0.95, 0);
          a.add(a.userData.reviveLabel);
        }
        a.userData.reviveLabel.visible = !!p.down;
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
        a.userData.visual.position.set(0, 0, 0);
        a.userData.gun.visible = !p.down;
        a.userData.badge.visible = !p.down;
        a.userData.crewOutline.material.color.setHex(
          p.down ? 0xff606f : 0x82ffce,
        );

        const moving = old.distanceTo(a.position) > 0.005;
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
        const a = this.actors.get(id) || this.actor(id, true, z.x, z.z, z.kind);
        const before = this.previousPosition.copy(a.position);
        a.position.lerp(
          this.scratchPosition.set(z.x, 0, z.z),
          1 - Math.exp(-dt * 16),
        );
        const target =
          z.yaw === undefined
            ? state.players
                .filter((p) => !p.down)
                .sort(
                  (p, q) =>
                    Math.hypot(p.x - z.x, p.z - z.z) -
                    Math.hypot(q.x - z.x, q.z - z.z),
                )[0]
            : null;
        if (z.yaw !== undefined || target)
          a.rotation.y = z.yaw ?? Math.atan2(z.x - target.x, z.z - target.z);
        a.userData.runRate =
          z.kind === "runner" ? 1.1 : z.kind === "boss" ? 0.3 : 0.45;
        if (a.userData.customEnemy)
          animateCasinoEnemy(a, dt, z, before.distanceTo(a.position));
        else this.assets.animate(a, dt, !z.stun, false, null);
        this.encounters.actor(a, z, this.camera);
        if (!a.userData.customEnemy)
          a.userData.visual.rotation.x = z.stun ? -0.18 : 0.08;
      }
      for (const [id, a] of this.actors)
        if (!ids.has(id)) {
          this.dispose(a);
          this.actors.delete(id);
        }
      this.chipBatch.update(state.chips, t);
      const p = state.players.find((p) => p.id === myId);
      if (p) {
        const a = this.actors.get(myId),
          ray = aimRay(
            { ...p, x: a.position.x, z: a.position.z },
            yaw,
            pitch,
            aim,
            state.openRooms,
          ),
          dir = new THREE.Vector3(ray.dir.x, ray.dir.y, ray.dir.z),
          pos = new THREE.Vector3(ray.origin.x, ray.origin.y, ray.origin.z);
        this.keyLight.target.position.set(p.x, 0, p.z);
        this.keyLight.position.set(p.x + 4, 18, p.z + 7);
        this.camera.position.copy(pos);
        this.camera.lookAt(
          pos
            .clone()
            .add(dir)
            .add(new THREE.Vector3(0, this.hurtShake || 0, 0)),
        );
        const optic = aim && !p.down ? opticFor(p) : null;
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
      this.camera.position.set(11 + Math.sin(t * 0.08) * 2, 7.8, 15);
      this.camera.lookAt(-2, 1, -3);
    }
    this.effectPool.update(dt);
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
