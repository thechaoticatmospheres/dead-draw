import * as T from "three";
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
let seed = 17;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
function repeat(t, n) {
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(n, n);
  return t;
}
export function surfaces() {
  const marble = canvasTexture((c, w, h) => {
    c.fillStyle = "#bac1b3";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const v = 150 + random() * 80;
      c.fillStyle = `rgba(${v},${v + 5},${v},.1)`;
      c.fillRect(
        random() * w,
        random() * h,
        random() * 45 + 2,
        random() * 3 + 1,
      );
    }
    for (let i = 0; i < 28; i++) {
      c.strokeStyle = i % 4 ? "#54635c28" : "#d2bd8350";
      c.lineWidth = random() * 2 + 0.5;
      c.beginPath();
      let y = random() * h;
      c.moveTo(0, y);
      for (let x = 0; x <= w; x += 12) {
        y += (random() - 0.5) * 18;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    c.strokeStyle = "#39453c";
    c.lineWidth = 2;
    c.strokeRect(1, 1, w - 2, h - 2);
  });
  const carpet = canvasTexture((c, w, h) => {
    c.fillStyle = "#382a2e";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 22000; i++) {
      c.fillStyle = random() > 0.5 ? "#ba9c6030" : "#040c132e";
      c.fillRect(random() * w, random() * h, 1, 1);
    }
    c.strokeStyle = "#ab8b534d";
    c.lineWidth = 2;
    for (let y = -128; y < h + 128; y += 128)
      for (let x = -64; x < w + 128; x += 128) {
        for (let r = 20; r <= 118; r += 19) {
          c.beginPath();
          c.arc(x + (y % 256 === 0 ? 64 : 0), y, r, 0, Math.PI);
          c.stroke();
        }
      }
  });
  const wall = canvasTexture((c, w, h) => {
    c.fillStyle = "#192b29";
    c.fillRect(0, 0, w, h);
    c.lineWidth = 1;
    c.strokeStyle = "#b69a6630";
    for (let x = 0; x <= w; x += 64) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, h);
      c.stroke();
      for (let y = 0; y < h; y += 128) {
        c.beginPath();
        c.moveTo(x - 28, y + 64);
        c.lineTo(x, y + 10);
        c.lineTo(x + 28, y + 64);
        c.lineTo(x, y + 118);
        c.closePath();
        c.stroke();
      }
    }
  });
  return {
    marble: new T.MeshStandardMaterial({
      map: repeat(marble, 8),
      color: 0xb9c3b9,
      metalness: 0.22,
      roughness: 0.28,
    }),
    carpet: new T.MeshStandardMaterial({
      map: repeat(carpet, 5),
      roughness: 0.98,
      color: 0xffffff,
    }),
    wall: new T.MeshStandardMaterial({ map: repeat(wall, 3), roughness: 0.74 }),
    dark: new T.MeshStandardMaterial({
      color: 0x101b1b,
      metalness: 0.25,
      roughness: 0.36,
    }),
    wood: new T.MeshStandardMaterial({ color: 0x2e1b20, roughness: 0.46 }),
    brass: new T.MeshStandardMaterial({
      color: 0xba955c,
      metalness: 0.88,
      roughness: 0.29,
    }),
    plaster: new T.MeshStandardMaterial({ color: 0x4c4541, roughness: 0.94 }),
    warm: new T.MeshStandardMaterial({
      color: 0xffe8bc,
      emissive: 0xffbe70,
      emissiveIntensity: 3,
    }),
    cool: new T.MeshStandardMaterial({
      color: 0x85afad,
      emissive: 0x3f8f8c,
      emissiveIntensity: 1.5,
    }),
  };
}
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
