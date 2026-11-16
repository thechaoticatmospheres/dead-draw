import * as T from "three";
import { physicalSurfaces } from "./physical-materials.js";
export function canvasTexture(draw, w = 512, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function surfaces() { return physicalSurfaces(); }
export function label(text, sub, color = "#e9c387", w = 3.3, h = 0.65) {
  const map = canvasTexture(
    (c, W, H) => {
      c.fillStyle = "#0c1b1df8";
      c.fillRect(0, 0, W, H);
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.strokeRect(8, 8, W - 16, H - 16);
      c.fillStyle = color;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = "500 64px Georgia";
      c.fillText(text, W / 2, H * (sub ? 0.4 : 0.52), W * 0.91);
      if (sub) {
        c.font = "22px sans-serif";
        c.fillText(sub, W / 2, H * 0.79, W * 0.9);
      }
    },
    1024,
    256,
  );
  return new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshStandardMaterial({
      map,
      emissive: 0xffffff,
      emissiveMap: map,
      emissiveIntensity: 0.48,
      roughness: 0.5,
    }),
  );
}
