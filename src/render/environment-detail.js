import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { label } from "./surfaces.js";
import { WALLS, OUTER_WALLS } from "../../shared/map.js";

export const ROOM_PALETTES = {
  atrium: 0x544037, emerald: 0x24473c, velvet: 0x50283e,
  arcade: 0x293e50, dice: 0x593d2c, crown: 0x4d3936,
  sapphire: 0x273c54, ivory: 0x555349, jade: 0x294c40,
  neon: 0x422c4c, obsidian: 0x342f31, eclipse: 0x443b32,
};
function mesh(root, geometry, material, x,y,z) {
  const object = new T.Mesh(geometry, material);
  object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;
  root.add(object);return object;
}
function box(root,w,h,d,x,y,z,material,bevel=0) {
  return mesh(root,bevel ? new RoundedBoxGeometry(w,h,d,1,Math.min(bevel,w/3,h/3,d/3)) : new T.BoxGeometry(w,h,d),material,x,y,z);
}
function cylinder(root,r,h,x,y,z,material,segments=24,top=r) {
  return mesh(root,new T.CylinderGeometry(top,r,h,segments),material,x,y,z);
}
function ring(root,r,t,x,y,z,material) {
  const object=mesh(root,new T.TorusGeometry(r,t,6,64),material,x,y,z);object.rotation.x=Math.PI/2;return object;
}
function frame(root,w,h,x,y,z,m) {
  box(root,w+.08,h+.08,.025,x,y,z,m.dark);
  for(const sign of [-1,1]) {
    box(root,.026,h,.024,x+sign*w/2,y,z+.016,m.brassEdge);
    box(root,w,.026,.024,x,y+sign*h/2,z+.016,m.brassEdge);
  }
}
function fan(root,x,y,z,m,scale=1) {
  for(let i=-6;i<=6;i++) {
    const angle=i*Math.PI/14, length=.9-Math.abs(i)*.025;
    const spoke=box(root,.014*scale,length*scale,.015,x+Math.sin(angle)*length*.5*scale,y+Math.cos(angle)*length*.5*scale,z,m.brassEdge);
    spoke.rotation.z=-angle;
  }
  for(const radius of [.52,.7,.86]) {
    const arc=mesh(root,new T.TorusGeometry(radius*scale,.012*scale,4,32,Math.PI),m.brass,x,y,z);
    arc.rotation.z=0;
  }
}
export function roomArchitecture(room, staticRoot, ceilingRoot, m) {
  const x=room.x,z=room.z;
  const accent=m.velvet.clone();accent.name=`${room.id} upholstery`;accent.color.setHex(ROOM_PALETTES[room.id]);
  // Coffered ceiling: two bevelled ledges around a recessed central field. The
  // lowest point is 4.77 m, clear of every player and projectile path.
  for(const [span,y,width] of [[13.9,5.03,.28],[13.35,4.98,.12],[12.9,5.03,.045]]) for(const side of [-1,1]) {
    box(ceilingRoot,span,.12,width,x,y,z+side*span/2,width>.2?m.wood:m.brass);
    box(ceilingRoot,width,.12,span,x+side*span/2,y,z,width>.2?m.wood:m.brass);
  }
  for(const dx of [-3.4,3.4])for(const dz of [-3.4,3.4]) {
    box(ceilingRoot,5.5,.055,5.5,x+dx,5.19,z+dz,m.plaster);
    for(const side of [-1,1]) {
      box(ceilingRoot,5.6,.07,.065,x+dx,5.12,z+dz+side*2.8,m.wood);
      box(ceilingRoot,.065,.07,5.6,x+dx+side*2.8,5.12,z+dz,m.wood);
    }
  }
  // Recessed cove: a luminous practical fixture, not a floating effect.
  for(const side of [-1,1]) {
    box(ceilingRoot,10.3,.018,.032,x,4.975,z+side*6.72,m.warm);
    box(ceilingRoot,.032,.018,10.3,x+side*6.72,4.975,z,m.warm);
  }
  const medallion=cylinder(ceilingRoot,1.15,.055,x,5.12,z,m.wood,64);
  ring(ceilingRoot,1.1,.02,x,5.08,z,m.brassEdge);
  ring(ceilingRoot,.82,.015,x,5.07,z,m.brass);
  // Art panels sit against genuine wall segments, never over a door opening.
  for(const offset of [-4.6,4.6]) {
    const wx=x+offset,wz=z-7.79;
    const solid=[...WALLS,...OUTER_WALLS].some(w=>Math.abs(wx-w.x)<w.w/2-.95 && Math.abs(wz-w.z)<w.d/2+.25);
    if(!solid)continue;
    box(staticRoot,1.8,1.92,.03,wx,2.35,wz,accent);
    frame(staticRoot,1.8,1.92,wx,2.35,wz+.023,m);
    fan(staticRoot,wx,1.75,wz+.05,m,.83);
    for(const d of [-1,1])box(staticRoot,.012,1.78,.01,wx+d*.79,2.35,wz+.05,m.brass);
  }
  // Double woven border on the rug, flush in the floor and outside all physics.
  const edge=m.carpet.clone();edge.color.setHex(ROOM_PALETTES[room.id]).multiplyScalar(.65);
  for(const side of [-1,1]) {
    box(staticRoot,11.45,.004,.18,x,.018,z+side*5.52,edge);
    box(staticRoot,.18,.004,11.45,x+side*5.52,.018,z,edge);
    box(staticRoot,11.1,.004,.016,x,.022,z+side*5.4,m.rugInlay);
    box(staticRoot,.016,.004,11.1,x+side*5.4,.022,z,m.rugInlay);
  }
}
export function wallDetails(wall, root, m) {
  const horizontal=wall.w>wall.d, length=horizontal?wall.w:wall.d;
  // Skirting and the dado cap remain within the existing wall collision margin.
  for(const y of [.08,1.19])box(root,wall.w+.055,.09,wall.d+.055,wall.x,y,wall.z,m.wood);
  if(length<2.4)return;
  const count=Math.max(1,Math.floor(length/3.8));
  for(let i=0;i<count;i++) {
    const along=-length/2+(i+.5)*length/count;
    for(const side of [-1,1]) {
      const sconce=new T.Group();
      sconce.position.set(wall.x+(horizontal?along:side*(wall.w/2+.035)),0,wall.z+(horizontal?side*(wall.d/2+.035):along));
      sconce.rotation.y=horizontal?(side<0?Math.PI:0):(side<0?-Math.PI/2:Math.PI/2);
      root.add(sconce);
      box(sconce,.24,.83,.035,0,2.65,0,m.brass,.018);
      box(sconce,.18,.73,.025,0,2.65,.025,m.dark,.012);
      for(const sx of [-.06,0,.06]) {
        cylinder(sconce,.026,.57,sx,2.65,.075,m.warm,12);
        cylinder(sconce,.031,.025,sx,2.35,.075,m.brassEdge,12);
        cylinder(sconce,.031,.025,sx,2.95,.075,m.brassEdge,12);
      }
      // Fluted brass crown and lower finial identify the Art Deco manufacture.
      box(sconce,.26,.035,.13,0,3.04,.04,m.brassEdge,.008);
      box(sconce,.26,.035,.13,0,2.25,.04,m.brassEdge,.008);
    }
  }
}
export function chandelierDetail(room,m) {
  const root=new T.Group();root.name=`${room.id}-practical-chandelier`;
  root.position.set(room.x,4.6,room.z);
  const majestic=room.id==='atrium'||room.id==='eclipse';
  for(let tier=0;tier<3;tier++) {
    const radius=(majestic?1.56:1.2)-tier*.31, y=.18-tier*.28;
    ring(root,radius,.035,0,y,0,m.brass);
    ring(root,radius,.015,0,y-.28,0,m.brassEdge);
    const count=majestic?40:28;
    for(let i=0;i<count;i++) {
      const a=i/count*Math.PI*2, px=Math.sin(a)*radius,pz=Math.cos(a)*radius;
      const crystal=box(root,.048,.27,.078,px,y-.14,pz,i%4===0?m.warm:m.crystal,.008);
      crystal.rotation.y=a;
    }
  }
  cylinder(root,.032,.64,0,.53,0,m.brass,16);
  cylinder(root,.17,.04,0,.85,0,m.brassEdge,32);
  // Radial frame arms are above the crystal skirt and remain visibly mechanical.
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4,arm=box(root,.025,.025,majestic?1.5:1.16,Math.sin(a)*.62,.2,Math.cos(a)*.62,m.brass);
    arm.rotation.y=a;
  }
  return root;
}
export function stationSignFrame(station,root,m) {
  const width=station.id === "slots" || station.id === "poker" ? 2.05 : 2.65;
  box(root,width+.07,.57,.07,0,3.25,-.045,m.wood,.018);
  for(const side of [-1,1]) {
    box(root,width+.04,.023,.025,0,3.25+side*.265,.006,m.brassEdge,.004);
    box(root,.022,.52,.025,side*(width/2+.02),3.25,.006,m.brassEdge,.004);
    cylinder(root,.012,1.58,side*(width*.38),4.31,-.04,m.brass,8);
    cylinder(root,.05,.026,side*(width*.38),5.10,-.04,m.brassEdge,12);
  }
}
export function stationDetails(station,root,m) {
  // Mechanical cabinet labels and hardware are attached to the cabinet itself.
  // Keep these within the original 1.5 m circular station collider.
  if(['slots','poker','keno','hilo'].includes(station.id)) {
    const plaque=label(station.id==='slots'?'LUCKY AFTERLIFE':station.name.toUpperCase(),'GILDED PALM • PLAYER TERMINAL','#d8c49a',.86,.17);
    plaque.position.set(0,1.16,.475);root.add(plaque);
    box(root,.96,.045,.26,0,.94,.44,m.brassEdge,.012);
    box(root,.16,.026,.05,.28,.975,.51,m.dark,.009);
    box(root,.11,.008,.007,.28,.99,.54,m.brassEdge);
    for(const sx of [-.36,-.17,.02]) {
      cylinder(root,.04,.013,sx,.984,.49,m.brassEdge,20);
      cylinder(root,.029,.018,sx,.994,.49,sx===.02?m.warm:m.dark,20);
    }
    const glass=new T.Mesh(new T.PlaneGeometry(.92,.64),new T.MeshPhysicalMaterial({color:0xadc5bd,roughness:.13,metalness:.15,transparent:true,opacity:.055,depthWrite:false}));
    glass.position.set(0,1.68,.49);root.add(glass);
    glass.name='Cabinet protective glass';
  } else {
    // Leather edge piping and small brass screw heads at the table apron.
    for(const side of [-1,1]) {
      box(root,2.4,.02,.025,0,1.34,side*.99,m.brassEdge,.006);
      for(const x of [-.9,0,.9]) {
        const pin=cylinder(root,.012,.01,x,1.27,side*1.005,m.brassEdge,8);
        pin.rotation.x=Math.PI/2;
      }
    }
  }
}
