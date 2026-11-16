import * as T from 'three';
import { ROOMS, roomAt } from '../../shared/map.js';

// Practical lamp lighting. Static irradiance is supplied separately by Cycles;
// these lamps also illuminate moving characters and provide live specular.
export class CasinoLighting {
  constructor(scene, environment) {
    this.environment = environment;
    this.power = 0;
    this.shadow = new T.SpotLight(0xffd6a5, 32, 18, 1.18, .85, 2);
    this.shadow.castShadow = true;
    this.shadow.shadow.mapSize.set(1024, 1024);
    this.shadow.shadow.bias = -.0003;
    this.shadow.shadow.normalBias = .035;
    this.shadow.shadow.camera.near = .1;
    this.shadow.shadow.camera.far = 18;
    scene.add(this.shadow, this.shadow.target);
    this.sconces = Array.from({length:4}, () => {
      const light = new T.PointLight(0xffcb91, 5, 8, 2);
      scene.add(light);
      return light;
    });
    this.room = null;
  }
  update(dt, state, player) {
    const room = roomAt(player || {x:0,z:8});
    if (!room) return;
    this.room = room.id;
    this.power = T.MathUtils.damp(this.power, state?.campaign?.power ? 1 : 0, 2.5, dt);
    for (const r of ROOMS) {
      const light = this.environment.roomLights.get(r.id);
      if (!light) continue;
      const open = !state || state.openRooms.includes(r.id);
      const distance = Math.hypot(r.x-room.x,r.z-room.z);
      light.intensity = open && distance < 25 ? 45 + this.power * 55 : 0;
      light.color.setHex(r.id==='neon'?0xd9c2e9:r.id==='sapphire'?0xd0d9e7:0xffd1a0);
    }
    this.shadow.position.set(room.x,4.55,room.z);
    this.shadow.target.position.set(room.x,0,room.z);
    this.shadow.intensity = 24 + this.power*20;
    const positions = [[-6.8,0],[6.8,0],[0,-6.8],[0,6.8]];
    this.sconces.forEach((light,i) => {
      light.position.set(room.x+positions[i][0],2.7,room.z+positions[i][1]);
      light.intensity = 4 + this.power*6;
    });
  }
}
