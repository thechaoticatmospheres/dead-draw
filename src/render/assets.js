import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
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
];
function aimBone(bone, child, target) {
  if (!bone || !child) return;
  const origin = bone.getWorldPosition(new T.Vector3()),
    direction = child.getWorldPosition(new T.Vector3()).sub(origin).normalize();
  const rotation = new T.Quaternion().setFromUnitVectors(
    direction,
    target.clone().sub(origin).normalize(),
  );
  const world = rotation.multiply(bone.getWorldQuaternion(new T.Quaternion()));
  bone.quaternion.copy(
    bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(world),
  );
  bone.updateMatrixWorld(true);
}
function poseArm(root, side, elbow, hand) {
  const bones = root.userData.bones;
  aimBone(
    bones[side + "Arm"],
    bones[side + "ForeArm"],
    root.localToWorld(new T.Vector3(...elbow)),
  );
  aimBone(
    bones[side + "ForeArm"],
    bones[side + "Hand"],
    root.localToWorld(new T.Vector3(...hand)),
  );
}
export class Assets {
  constructor() {
    this.models = new Map();
    this.eyeGeometry = new T.SphereGeometry(0.02, 6, 4);
    this.eyeMaterial = new T.MeshBasicMaterial({ color: 0xffa54d });
  }
  async load() {
    const loader = new GLTFLoader();
    await Promise.all(
      names.map(async (name) => {
        const g = await loader.loadAsync(
          `${import.meta.env.BASE_URL}assets/models/${name}.glb`,
        );
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
        this.models.set(name, g);
      }),
    );
  }
  prop(name) {
    const obj = this.models.get(name).scene.clone(true);
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
      d.visual.rotation.x = 0.08;
      poseArm(root, "Right", [0.36, 1.15, -0.2], [0.3, 1.25, -0.56]);
      poseArm(root, "Left", [-0.36, 1.12, -0.16], [-0.25, 1.14, -0.58]);
      return;
    }
    const type =
      weapon?.category === "sidearm"
        ? "pistol"
        : weapon?.category === "automatic"
          ? "smg"
          : weapon?.category === "shells"
            ? "shotgun"
            : "rifle";
    const attachmentKey = JSON.stringify(gunState?.attachments || {});
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
    poseArm(
      root,
      "Right",
      [0.37, 1.02, 0],
      [0.3, 1.13, reload ? -0.12 : -0.34],
    );
    poseArm(
      root,
      "Left",
      [-0.3, 1.06, -0.1],
      [0.17, 1.18, reload ? -0.15 : -0.58],
    );
    const hand = d.bones.RightHand.getWorldPosition(new T.Vector3());
    d.gun.position
      .copy(root.worldToLocal(hand))
      .add(new T.Vector3(0, 0.13, -0.025));
    d.gun.rotation.x = reload ? -0.8 : 0;
  }
}
