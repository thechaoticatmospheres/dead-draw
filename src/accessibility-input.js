// Arrow keys deliberately remain reserved for the existing testing sequence.
export const MOVEMENT_KEYS = new Set(["KeyW","KeyA","KeyS","KeyD","KeyE","KeyF"]);
export const LOOK_KEYS = new Set(["KeyI","KeyJ","KeyK","KeyL"]);
export function keyboardLook(keys, dt, yaw, pitch, zoom = 1) {
  const speed = 1.5 * Math.min(.05, Math.max(0, dt)) / Math.max(1, zoom);
  return {
    yaw: yaw + ((keys.has("KeyJ")?1:0)-(keys.has("KeyL")?1:0))*speed,
    pitch: Math.max(-.65,Math.min(.65,pitch+((keys.has("KeyI")?1:0)-(keys.has("KeyK")?1:0))*speed)),
  };
}
