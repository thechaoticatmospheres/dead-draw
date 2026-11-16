import * as T from "three";

// Original deterministic material library. All maps describe matter, never light.
// Shared maps keep the full twelve-room casino within a modest texture budget.
let rng = 17;
const random = () => ((rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296);
function texture(draw, size = 512, srgb = true) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"), size);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.anisotropy = 8;
  return map;
}
function tile(map, repeats) { map.repeat.set(repeats, repeats); return map; }
function fibres(c, size, base, scale = 1) {
  c.fillStyle = base; c.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 38; i++) {
    const value = random() < .5 ? 255 : 0;
    c.fillStyle = `rgba(${value},${value},${value},${.035 + random() * .08})`;
    c.fillRect(Math.floor(random() * size), Math.floor(random() * size), scale, .6 + random() * scale);
  }
}
function normalFrom(map, strength = 1) {
  const size = map.image.width, ctx = map.image.getContext("2d");
  const pixels = ctx.getImageData(0, 0, size, size).data;
  return texture((c) => {
    const out = c.createImageData(size, size), d = out.data;
    const h = (x, y) => pixels[(((y + size) % size) * size + (x + size) % size) * 4] / 255;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let dx = (h(x - 1, y) - h(x + 1, y)) * strength;
      let dy = (h(x, y - 1) - h(x, y + 1)) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1), i = (y * size + x) * 4;
      d[i] = (dx * inv * .5 + .5) * 255; d[i + 1] = (dy * inv * .5 + .5) * 255;
      d[i + 2] = (inv * .5 + .5) * 255; d[i + 3] = 255;
    }
    c.putImageData(out, 0, 0);
  }, size, false);
}
export function physicalSurfaces() {
  rng = 17;
  const marble = texture((c, n) => {
    c.fillStyle = "#d8d0bb"; c.fillRect(0, 0, n, n);
    for (let i = 0; i < 100; i++) {
      const x = random() * n, y = random() * n, r = 40 + random() * 180;
      const grad = c.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, i % 3 ? "#a5a99a0d" : "#ffffff20"); grad.addColorStop(1, "#ffffff00");
      c.fillStyle = grad; c.fillRect(x-r, y-r, r*2, r*2);
    }
    for (let i = 0; i < 14; i++) {
      let x = random() * n, y = -20;
      const points = [[x, y]];
      for (let j = 0; j < 26; j++) { x += 8 + (random()-.5)*24; y += n/23; points.push([x,y]); }
      for (const [width, opacity] of [[9,.035],[3,.08],[.7,.19]]) {
        c.strokeStyle = `rgba(75,81,73,${opacity})`; c.lineWidth = width; c.beginPath();
        points.forEach(([px,py],j)=>j?c.lineTo(px,py):c.moveTo(px,py)); c.stroke();
      }
      if(i%3===0) {c.strokeStyle="#a8895144";c.lineWidth=.65;c.beginPath();c.moveTo(points[10][0],points[10][1]);c.bezierCurveTo(points[10][0]-30,points[10][1]+20,points[10][0]-80,n*.8,points[10][0]-140,n);c.stroke();}
    }
    c.strokeStyle = "#716e5d66"; c.lineWidth = 1.5; c.strokeRect(.75,.75,n-1.5,n-1.5);
  }, 1024);
  const stoneRough = texture((c,n)=>{fibres(c,n,"#b7b7b7",1);for(let i=0;i<40;i++){c.strokeStyle="#dadada10";c.lineWidth=8+random()*20;c.beginPath();c.moveTo(random()*n,0);c.lineTo(random()*n,n);c.stroke();}},512,false);
  const woolWear = texture((c,n)=>{
    c.fillStyle="#fafafa";c.fillRect(0,0,n,n);
    // A broad worn passage, not repeated random scratches. Roughness stays high.
    for(const axis of [0,1]) {const g=axis?c.createLinearGradient(0,0,n,0):c.createLinearGradient(0,0,0,n);
      g.addColorStop(0,"#f6f6f6");g.addColorStop(.35,"#efefef");g.addColorStop(.5,"#d9d9d9");g.addColorStop(.65,"#efefef");g.addColorStop(1,"#f6f6f6");
      c.globalAlpha=.5;c.fillStyle=g;c.fillRect(0,0,n,n);c.globalAlpha=1;}
  },256,false);
  const weave = texture((c,n)=>{
    fibres(c,n,"#777777");
    for(let y=0;y<n;y+=3){c.fillStyle=y%2?"#eeeeee22":"#00000022";c.fillRect(0,y,n,1);}
    for(let x=0;x<n;x+=3){c.fillStyle=x%2?"#eeeeee18":"#00000018";c.fillRect(x,0,1,n);}
  },512,false);
  const carpet = texture((c,n)=>{
    fibres(c,n,"#7c7770");
    for(let y=-n/4;y<n*1.3;y+=n/4) for(let x=-n/4;x<n*1.3;x+=n/4){
      const ox=x+(Math.round(y/(n/4))%2?n/8:0);
      c.save();c.beginPath();c.rect(ox-n/8,y,n/4,n/4);c.clip();
      for(let r=17;r<n/3;r+=15){c.strokeStyle=r%2?"#d2bc7c8f":"#292b2a88";c.lineWidth=3;c.beginPath();c.arc(ox,y+n/4,r,Math.PI,Math.PI*2);c.stroke();}
      c.restore();
    }
    for(let y=0;y<n;y+=2){c.fillStyle="#ffffff0a";c.fillRect(0,y,n,1);}
    for(let x=0;x<n;x+=2){c.fillStyle="#00000012";c.fillRect(x,0,1,n);}
  },1024);
  const wall = texture((c,n)=>{
    fibres(c,n,"#b7ad92");
    c.strokeStyle="#5c564c3d";c.lineWidth=1;
    for(let y=-n/4;y<n*1.2;y+=n/4)for(let x=0;x<n;x+=n/4){
      c.beginPath();c.moveTo(x,y+n/4);c.lineTo(x+n/8,y);c.lineTo(x+n/4,y+n/4);c.stroke();
      c.beginPath();c.moveTo(x+n/16,y+n/4);c.lineTo(x+n/8,y+n/8);c.lineTo(x+n*3/16,y+n/4);c.stroke();
    }
  },512);
  const wood = texture((c,n)=>{
    c.fillStyle="#583222";c.fillRect(0,0,n,n);
    for(let i=0;i<1600;i++){
      const x=random()*n, shade=random();c.strokeStyle=shade<.4?`rgba(19,9,6,${.03+random()*.13})`:`rgba(198,132,77,${.015+random()*.07})`;
      c.lineWidth=.3+random()*2.2;c.beginPath();c.moveTo(x,0);
      c.bezierCurveTo(x+Math.sin(x*.016)*20,n*.32,x-Math.sin(x*.016)*35,n*.68,x,n);c.stroke();
    }
  },1024);
  const brushed = texture((c,n)=>{c.fillStyle="#bdbdbd";c.fillRect(0,0,n,n);for(let i=0;i<1600;i++){c.strokeStyle=`rgba(40,40,40,${random()*.07})`;c.lineWidth=.3;c.beginPath();const y=random()*n;c.moveTo(0,y);c.lineTo(n,y+random()*2);c.stroke();}},512,false);
  const leather = texture((c,n)=>{fibres(c,n,"#8b8b8b");for(let i=0;i<15000;i++){c.fillStyle="#1515152b";c.beginPath();c.ellipse(random()*n,random()*n,.7+random()*1.8,.4+random(),random()*Math.PI,0,Math.PI*2);c.fill();}},512,false);
  const plasterGrain = texture((c,n)=>{
    fibres(c,n,"#b9b5a8",1);
    // Trowelled skim coat, broad low-contrast variation without painted shadows.
    for(let i=0;i<160;i++){c.fillStyle=i%2?"#fff9dd05":"#4d463b05";c.fillRect(random()*n,random()*n,20+random()*80,.5+random()*2);}
  },512);
  const plasterNormal = normalFrom(plasterGrain,.42);
  const weaveNormal = normalFrom(weave, 1.1), leatherNormal = normalFrom(leather, 1.1);
  tile(marble,8);tile(stoneRough,8);tile(carpet,4);tile(weaveNormal,32);tile(wall,3);tile(wood,1);tile(brushed,1);tile(leatherNormal,3);tile(plasterGrain,3);tile(plasterNormal,3);
  const make=(name,properties)=>{const m=new T.MeshStandardMaterial(properties);m.name=name;return m;};
  const materials = {
    marble: make("Honed ivory marble",{map:marble,roughnessMap:stoneRough,roughness:.48,metalness:0,color:0xfff7e8}),
    carpet: make("Woven Deco wool",{map:carpet,normalMap:weaveNormal,normalScale:new T.Vector2(.32,.32),roughness:.98,roughnessMap:woolWear,color:0x50403d}),
    wall: make("Woven champagne wallcovering",{map:wall,normalMap:weaveNormal,normalScale:new T.Vector2(.15,.15),roughness:.83,color:0x696b60}),
    dark: make("Midnight lacquer",{color:0x101e1c,roughness:.34,metalness:0}),
    wood: make("Tobacco walnut lacquer",{map:wood,color:0xb69b83,roughness:.49,roughnessMap:brushed,metalness:0}),
    brass: make("Recessed aged brass",{color:0xa48248,metalness:.88,roughness:.51,roughnessMap:brushed}),
    brassEdge: make("Hand polished brass edges",{color:0xd6b470,metalness:.92,roughness:.24}),
    plaster: make("Trowelled warm ivory plaster",{map:plasterGrain,normalMap:plasterNormal,normalScale:new T.Vector2(.14,.14),color:0xd2c5ab,roughness:.98}),
    shutter: make("Ribbed blackened shutter steel",{color:0x222923,metalness:.3,roughness:.62,roughnessMap:brushed}),
    rugInlay: make("Antique gold woven rug yarn",{color:0x77623e,normalMap:weaveNormal,normalScale:new T.Vector2(.25,.25),roughness:.98}),
    felt: make("Table baize",{color:0x195841,normalMap:weaveNormal,normalScale:new T.Vector2(.22,.22),roughness:.98}),
    leather: make("Burgundy leather upholstery",{color:0x4a2029,normalMap:leatherNormal,normalScale:new T.Vector2(.18,.18),roughness:.68}),
    velvet: make("Emerald velvet",{color:0x244337,normalMap:weaveNormal,normalScale:new T.Vector2(.16,.16),roughness:.97}),
    cream: make("Ivory card stock",{color:0xe9dfc5,roughness:.72}),
    warm: make("Warm opal glass",{color:0xffebce,emissive:0xffc47f,emissiveIntensity:1.15,roughness:.3}),
    cool: make("Cabinet edge glass",{color:0x91bdb9,emissive:0x5d9b93,emissiveIntensity:.7,roughness:.25}),
    crystal: make("Cut champagne crystal",{color:0xc4bfad,metalness:.08,roughness:.24,emissive:0x5c4c37,emissiveIntensity:.08}),
  };
  return materials;
}

// Upgrade authored static props by physical material family, preserving labels,
// emissive screens, named moving parts, meshes and authoritative placement.
export function dressStaticProp(root, palette) {
  const cache = new Map();
  root.traverse(o=>{
    if(!o.isMesh || o.isSkinnedMesh) return;
    const dress=source=>{
      if(!source || source.emissiveIntensity>0 && source.emissive?.getHex()>0) return source;
      if(source.map) {
        if(source.roughness<.94)return source;
        if(cache.has(source))return cache.get(source);
        const printedFelt=source.clone();printedFelt.normalMap=palette.felt.normalMap;
        printedFelt.normalScale.copy(palette.felt.normalScale);printedFelt.roughness=.98;
        printedFelt.color.multiplyScalar(.86);printedFelt.envMapIntensity=.18;
        cache.set(source,printedFelt);return printedFelt;
      }
      if(cache.has(source)) return cache.get(source);
      const c=source.color, hsl={};c.getHSL(hsl);
      let family;
      if(source.metalness>.55 && hsl.h>.06 && hsl.h<.18) family=palette.brass;
      else if(hsl.h>.025 && hsl.h<.10 && hsl.l<.32) family=palette.wood;
      else if(hsl.h>.25 && hsl.h<.48 && hsl.s>.25) family=palette.felt;
      else if((hsl.h>.85 || hsl.h<.02) && hsl.l<.4 && source.roughness>.5) family=palette.leather;
      else if(hsl.l<.13 && source.roughness<.6) family=palette.dark;
      if(!family)return source;
      const out=family.clone();if(family===palette.felt)out.color.copy(c);
      if(family===palette.leather)out.color.copy(c).lerp(palette.leather.color,.58);
      cache.set(source,out);return out;
    };
    o.material=Array.isArray(o.material)?o.material.map(dress):dress(o.material);
  });
  return root;
}
