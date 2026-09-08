import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { makeProps } from "./author-props.js";
const base = "/assets/source/kenney-survivors/";
async function binary(scene, animations = []) {
  const data = await new GLTFExporter().parseAsync(scene, {
    binary: true,
    animations,
    onlyVisible: true,
  });
  let s = "";
  const bytes = new Uint8Array(data);
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
export async function author(save) {
  const loader = new FBXLoader(),
    idle = await loader.loadAsync(base + "Animations/idle.fbx"),
    run = await loader.loadAsync(base + "Animations/run.fbx");
  const clips = [
    idle.animations.find((a) => a.name.includes("Idle")).clone(),
    run.animations.find((a) => !a.name.includes("Targeting")).clone(),
    idle.animations.find((a) => a.name.includes("Targeting")).clone(),
  ];
  clips[0].name = "Idle";
  clips[1].name = "Run";
  clips[2].name = "Aim";
  for (const [name, skin] of [
    ["survivor", "survivorMaleB"],
    ["survivor-female", "survivorFemaleA"],
    ["zombie", "zombieA"],
    ["zombie-alt", "zombieC"],
  ]) {
    const source = await loader.loadAsync(base + "Model/characterMedium.fbx"),
      tex = await new THREE.TextureLoader().loadAsync(
        base + "Skins/" + skin + ".png",
      );
    tex.colorSpace = THREE.SRGBColorSpace;
    source.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.85,
        });
        o.frustumCulled = false;
      }
    });
    source.scale.setScalar(1.82 / 376.537);
    source.rotation.y = Math.PI;
    source.name = "Character";
    const root = new THREE.Group();
    root.add(source);
    await save(name, await binary(root, clips));
  }
  for (const [name, root] of Object.entries(makeProps())) {
    root.name = name;
    await save(name, await binary(root));
  }
}
