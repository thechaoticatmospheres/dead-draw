import { arsenalProp } from "./arsenal-props.js";
import { SPECIAL_WEAPONS } from "../../shared/arsenal.js";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { batchRigid, freezeLocalMatrices } from "./static-batch.js";
import { modelBytes } from "./model-bytes.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
const rigidModels = new Set([
  "chandelier",
  "column",
  "chair",
  "cocktail",
  "pistol",
  "smg",
  "rifle",
  "shotgun",
]);
const names = [
  "survivor",
  "survivor-female",
  "zombie",
  "zombie-alt",
  "slots",
  "poker",
  "roulette",
  "blackjack",
  "craps",
  "baccarat",
  "chair",
  "chandelier",
  "column",
  "cocktail",
  "pistol",
  "smg",
  "rifle",
  "shotgun",
  "war",
  "threecard",
  "sicbo",
  "keno",
  "hilo",
  "letitride",
  "jukebox",
  "cashier",
  "enemy-dealer",
  "enemy-security",
  "enemy-wheelchair",
  "enemy-crawler",
];
const ikOrigin = new T.Vector3(),
  ikDirection = new T.Vector3(),
  ikTarget = new T.Vector3(),
  ikRotation = new T.Quaternion(),
  ikWorld = new T.Quaternion(),
  ikParent = new T.Quaternion(),
  armTarget = new T.Vector3(),
  gunHand = new T.Vector3(),
  gunOffset = new T.Vector3(0, 0.13, -0.025);
function aimBone(bone, child, target) {
  if (!bone || !child) return;
  const origin = bone.getWorldPosition(ikOrigin),
    direction = child.getWorldPosition(ikDirection).sub(origin).normalize();
  const rotation = ikRotation.setFromUnitVectors(
    direction,
    ikTarget.copy(target).sub(origin).normalize(),
  );
  const world = rotation.multiply(bone.getWorldQuaternion(ikWorld));
  bone.quaternion.copy(
    bone.parent.getWorldQuaternion(ikParent).invert().multiply(world),
  );
  bone.updateMatrixWorld(true);
}
function poseArm(root, side, elbow, hand) {
  const bones = root.userData.bones;
  aimBone(
    bones[side + "Arm"],
    bones[side + "ForeArm"],
    root.localToWorld(armTarget.set(...elbow)),
  );
  aimBone(
    bones[side + "ForeArm"],
    bones[side + "Hand"],
    root.localToWorld(armTarget.set(...hand)),
  );
}
export class Assets {
  constructor() {
    this.models = new Map();
    this.downloads = { compressed: 0, original: 0 };
    this.eyeGeometry = new T.SphereGeometry(0.02, 6, 4);
    this.eyeMaterial = new T.MeshBasicMaterial({ color: 0xffa54d });
  }
  async load() {
    for (const id of Object.keys(SPECIAL_WEAPONS))
      this.models.set("weapon-" + id, { scene: arsenalProp(id) });
    this.models.set("enemy-goose", { scene: arsenalProp("goose") });
    const loader = new GLTFLoader();
    await Promise.all(
      names.map(async (name) => {
        const version =
          typeof __MODEL_REVISIONS__ === "undefined"
            ? ""
            : __MODEL_REVISIONS__[name];
        const base = `${import.meta.env.BASE_URL}assets/models/${name}.glb`;
        const url = `${base}?v=${version}`;
        let g;
        if (
          import.meta.env.PROD &&
          typeof DecompressionStream !== "undefined"
        ) {
          try {
            const response = await fetch(`${base}.gz?v=${version}`);
            const bytes = await modelBytes(response);
            g = await loader.parseAsync(bytes, "");
            this.downloads.compressed++;
          } catch {
            /* Original GLBs remain a retry/fallback for older browsers and deployments. */
          }
        }
        if (!g) {
          g = await loader.loadAsync(url);
          this.downloads.original++;
        }
        g.scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            o.frustumCulled = !o.isSkinnedMesh;
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              if (m.map) m.map.anisotropy = 4;
              m.envMapIntensity = 0.6;
            }
          }
        });
        if (["pistol", "smg", "rifle", "shotgun"].includes(name))
          this.refineWeapon(g.scene, name);
        if (rigidModels.has(name)) {
          batchRigid(g.scene, true);
          freezeLocalMatrices(g.scene);
        }
        this.models.set(name, g);
      }),
    );
  }
  refineWeapon(scene, name) {
    const steel = new T.MeshStandardMaterial({
      color: 0x313738,
      metalness: 0.78,
      roughness: 0.32,
    });
    const brass = new T.MeshStandardMaterial({
      color: 0xb79c67,
      metalness: 0.82,
      roughness: 0.29,
    });
    const rubber = new T.MeshStandardMaterial({
      color: 0x171b1b,
      metalness: 0,
      roughness: 0.86,
    });
    const add = (geo, mat, x, y, z, rx = 0, rz = 0) => {
      const mesh = new T.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, 0, rz);
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    const sidearm = name === "pistol";
    add(
      new RoundedBoxGeometry(
        sidearm ? 0.077 : 0.11,
        0.055,
        sidearm ? 0.25 : 0.45,
        2,
        0.009,
      ),
      steel,
      0,
      0.07,
      sidearm ? -0.12 : -0.27,
    );
    for (const x of [-0.051, 0.051]) {
      for (let i = 0; i < 4; i++)
        add(
          new T.BoxGeometry(0.006, 0.045, 0.009),
          rubber,
          x,
          0.065,
          -0.035 - i * 0.018,
        );
      add(
        new T.CylinderGeometry(0.012, 0.012, 0.006, 12),
        brass,
        x,
        -0.025,
        -0.08,
        0,
        Math.PI / 2,
      );
    }
    add(
      new T.BoxGeometry(0.013, 0.027, 0.023),
      brass,
      0,
      0.13,
      sidearm ? -0.25 : -0.48,
    );
    if (!sidearm)
      for (let i = 0; i < 6; i++)
        add(
          new T.BoxGeometry(0.13, 0.017, 0.018),
          steel,
          0,
          0.045,
          -0.31 - i * 0.035,
        );
  }
  prop(name) {
    const obj = this.models.get(name).scene.clone(true);
    obj.matrixAutoUpdate = true;
    obj.userData.shared = true;
    return obj;
  }
  character(zombie = false, variant = 0) {
    const asset = this.models.get(
        zombie
          ? variant % 2
            ? "zombie-alt"
            : "zombie"
          : variant % 2
            ? "survivor-female"
            : "survivor",
      ),
      visual = clone(asset.scene),
      root = new T.Group();
    root.add(visual);
    root.userData.shared = true;
    const mixer = new T.AnimationMixer(visual),
      actions = {};
    for (const clip of asset.animations)
      actions[clip.name] = mixer.clipAction(clip);
    actions.Idle.play();
    root.userData = {
      ...root.userData,
      visual,
      mixer,
      actions,
      active: "Idle",
      zombie,
      gun: new T.Group(),
      lastPosition: new T.Vector3(),
      weaponId: "",
      bones: Object.fromEntries(
        [
          "RightArm",
          "RightForeArm",
          "RightHand",
          "LeftArm",
          "LeftForeArm",
          "LeftHand",
        ].map((name) => [name, visual.getObjectByName(name)]),
      ),
    };
    root.add(root.userData.gun);
    if (zombie) {
      for (const x of [-0.065, 0.065]) {
        const eye = new T.Mesh(this.eyeGeometry, this.eyeMaterial);
        eye.position.set(x, 1.61, -0.2);
        root.add(eye);
      }
    }
    return root;
  }
  animate(root, dt, moving, reload, weapon, gunState) {
    const d = root.userData;
    if (!d.mixer) return;
    d.phase = (d.phase || 0) + dt;
    d.aimBlend =
      (d.aimBlend || 0) +
      ((d.aiming ? 1 : 0) - (d.aimBlend || 0)) * Math.min(1, dt * 15);
    const next = moving ? "Run" : "Idle";
    if (next !== d.active) {
      d.actions[d.active].fadeOut(0.18);
      d.actions[next].reset().fadeIn(0.18).play();
      d.active = next;
    }
    d.actions.Run.timeScale = d.runRate ?? (d.zombie ? 0.45 : 0.85);
    d.mixer.update(dt);
    root.updateMatrixWorld(true);
    if (d.zombie) {
      const z = d.enemyState || {},
        strike =
          z.attack > 0.64
            ? Math.sin(Math.min(1, (1 - z.attack) / 0.36) * Math.PI)
            : 0;
      const windup = d.windup || 0,
        bob = Math.sin(d.phase * 2.1) * 0.018;
      d.visual.rotation.x = 0.08 - windup * 0.12;
      const reach = d.kind === "runner" ? 0.12 : 0;
      poseArm(
        root,
        "Right",
        [0.36, 1.15 + windup * 0.28, -0.2],
        [0.3, 1.25 + windup * 0.65 + bob, -0.56 - strike * 0.23 - reach],
      );
      poseArm(
        root,
        "Left",
        [-0.36, 1.12 + windup * 0.28, -0.16],
        [-0.25, 1.14 + windup * 0.7 - bob, -0.58 - strike * 0.18 - reach],
      );
      return;
    }
    const type =
      weapon?.model ||
      (weapon?.category === "sidearm"
        ? "pistol"
        : weapon?.category === "automatic"
          ? "smg"
          : weapon?.category === "shells"
            ? "shotgun"
            : "rifle");
    if (d.attachmentSource !== gunState?.attachments) {
      d.attachmentSource = gunState?.attachments;
      d.nextAttachmentKey = JSON.stringify(gunState?.attachments || {});
    }
    const attachmentKey = d.nextAttachmentKey || "{}";
    if (d.weaponId !== type || d.attachmentKey !== attachmentKey) {
      d.gun.clear();
      d.gun.add(this.prop(type));
      d.weaponId = type;
      d.attachmentKey = attachmentKey;
      d.attachmentMeshes?.forEach((o) => {
        o.geometry.dispose();
        o.material.dispose();
      });
      d.attachmentMeshes = [];
      const part = (geometry, color, x, y, z, rx = 0) => {
        const o = new T.Mesh(
          geometry,
          new T.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 }),
        );
        o.position.set(x, y, z);
        o.rotation.x = rx;
        d.gun.add(o);
        d.attachmentMeshes.push(o);
      };
      const att = gunState?.attachments || {};
      if (att.optic) {
        const length =
          att.optic === "longscope"
            ? 0.38
            : att.optic === "scope"
              ? 0.25
              : 0.12;
        part(new T.BoxGeometry(0.055, 0.075, 0.13), 0x222d31, 0, 0.14, -0.16);
        part(
          new T.CylinderGeometry(0.055, 0.055, length, 12),
          0x293539,
          0,
          0.2,
          -0.17,
          Math.PI / 2,
        );
        part(
          new T.CircleGeometry(0.048, 12),
          0x5abbd0,
          0,
          0.2,
          -0.17 + length / 2 + 0.001,
        );
      }
      if (att.magazine)
        part(new T.BoxGeometry(0.07, 0.16, 0.1), 0x2a3335, 0, -0.14, -0.14);
      if (att.barrel)
        part(
          new T.CylinderGeometry(0.045, 0.045, 0.13, 10),
          0xb58f51,
          0,
          0.02,
          type === "pistol" ? -0.35 : -0.67,
          Math.PI / 2,
        );
      if (att.action)
        part(
          new T.BoxGeometry(0.015, 0.045, 0.09),
          0xb58f51,
          0.065,
          0.05,
          -0.15,
        );
    }
    // Three clear reload beats: lower/open, reach the magazine, then return to aim.
    if (reload && !d.wasReloading)
      d.reloadDuration = Math.max(0.1, Number(reload));
    d.wasReloading = !!reload;
    const reloadProgress = reload
      ? Math.min(1, 1 - Number(reload) / d.reloadDuration)
      : 1;
    const reloadPose = reload
      ? Math.sin(Math.PI * Math.min(1, reloadProgress * 1.1 + 0.06))
      : 0;
    d.reloadBlend =
      (d.reloadBlend || 0) +
      (reloadPose - (d.reloadBlend || 0)) * Math.min(1, dt * 22);
    d.kick = (d.kick || 0) * Math.exp(-dt * 22);
    const lift = Math.sin(d.aimPitch || 0) * 0.42,
      rest = Math.sin(d.phase * 1.6) * 0.004;
    const rightY = 1.13 + d.aimBlend * 0.08 + lift + rest;
    poseArm(
      root,
      "Right",
      [0.37, 1.02 + lift * 0.5, 0],
      [
        0.3,
        rightY - d.reloadBlend * 0.08,
        -0.34 + d.reloadBlend * 0.16 + d.kick,
      ],
    );
    poseArm(
      root,
      "Left",
      [-0.3, 1.06 + lift * 0.5, -0.1],
      [
        0.17 - d.reloadBlend * 0.14,
        1.18 + lift - d.reloadBlend * 0.26,
        -0.58 + d.reloadBlend * 0.38 + d.kick,
      ],
    );
    const hand = d.bones.RightHand.getWorldPosition(gunHand);
    d.gun.position.copy(root.worldToLocal(hand)).add(gunOffset);
    d.swing = Math.max(0, (d.swing || 0) - dt);
    d.gun.rotation.y = weapon?.melee
      ? Math.sin((d.swing / 0.25) * Math.PI) * 1.8
      : 0;
    const barrels = d.gun.getObjectByName("Barrels");
    if (barrels) barrels.rotation.z += dt * (d.swing > 0 ? 35 : 2);
    d.gun.rotation.x = (d.aimPitch || 0) - d.reloadBlend * 0.62 - d.kick * 0.8;
    d.gun.rotation.z = d.reloadBlend * 0.32;
    d.gun.position.z += d.kick;
  }
}
