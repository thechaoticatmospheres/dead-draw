import { ROOMS, DOORS, roomAt, doorOpen } from "../shared/map.js";
import "./style.css";
import "./expansion.css";
import "./high-stakes.css";
import { opticFor } from "../shared/attachments.js";
import { World } from "./render/world.js";
import { Audio } from "./audio.js";
import { Soundscape } from "./soundscape.js";
import { bindAudioSettings } from "./audio-settings.js";
import { STATIONS, WEAPONS, REWARDS } from "../shared/data.js";
import { CasinoView } from "./casino-ui.js";
import { GamepadInput } from "./gamepad.js";
import { ClubView, updateExpansionHud } from "./club-ui.js";
import { maxHealth } from "../shared/expansion.js";
import { gameSocketURL } from "./connection.js";
const $ = (id) => document.getElementById(id),
  show = (id, value = true) => ($(id).hidden = !value);
const audio = new Audio();
const soundscape = new Soundscape(audio);
bindAudioSettings(audio);
let world;
try {
  world = new World($("world"));
} catch (e) {
  $("connection").textContent =
    "WebGL could not start. Enable hardware acceleration and reload.";
  $("enter").disabled = true;
  throw e;
}
let socket,
  state,
  myId,
  yaw = 0,
  pitch = -0.04,
  aim = false,
  shoot = false,
  station = null,
  lastCasino = "",
  lastPhase = "",
  lastFrame = performance.now(),
  toastTimeout,
  noticeTimeout;
const keys = new Set();
const send = (msg) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
};
const me = () => state?.players.find((p) => p.id === myId);
const casinoView = new CasinoView({ send, audio });
const clubView = new ClubView(send);
function menuRoot() {
  return (
    ["help", "club", "floorplan", "casino", "gameover", "lobby", "welcome"]
      .map($)
      .find((e) => !e.hidden) || null
  );
}
function interact() {
  const d = nearDoor();
  if (d) send({ type: "unlock", door: d.id });
  else openCasino();
}
const controller = new GamepadInput({
  menu: menuRoot,
  playing: () => ["combat", "break"].includes(state?.phase),
  notice: toast,
  look: (x, y) => {
    const sensitivity = controller.input.aim
      ? 1 / (opticFor(me())?.zoom || 1)
      : 1;
    yaw += x * sensitivity;
    pitch = Math.max(-0.65, Math.min(0.65, pitch + y * sensitivity));
  },
  mode: (value) => {
    release();
    document.body.dataset.input = value;
    $("controllerStatus").textContent =
      value === "controller"
        ? "CONTROLLER ACTIVE · STANDARD LAYOUT"
        : "KEYBOARD + MOUSE · PRESS A CONTROLLER BUTTON TO CONNECT";
  },
  action: (action) => {
    if (action === "back") {
      if (!$("help").hidden) show("help", false);
      else if (!$("club").hidden) show("club", false);
      else if (!$("floorplan").hidden) show("floorplan", false);
      else if (station) closeCasino();
      return;
    }
    if (action === "pause") {
      release();
      show("help");
      return;
    }
    if (action === "interact") interact();
    else if (action === "club") toggleClub();
    else if (action === "map") toggleMap();
    else send({ type: action });
  },
});
$("enter").disabled = true;
$("connection").textContent = "PREPARING THE GILDED PALM…";
world.ready
  .then(() => {
    $("enter").disabled = false;
    $("connection").textContent = "THE FLOOR IS READY";
  })
  .catch((error) => {
    $("connection").textContent = "Could not load 3D assets. Reload to retry.";
    console.error(error);
  });
try {
  Object.assign(
    controller.settings,
    JSON.parse(localStorage.getItem("dead-draw-controller") || "{}"),
  );
} catch {}
for (const [id, key] of [
  ["padSensitivity", "sensitivity"],
  ["padInvert", "invert"],
  ["padRumble", "rumble"],
]) {
  const e = $(id);
  if (e.type === "checkbox") e.checked = controller.settings[key];
  else e.value = controller.settings[key];
  e.onchange = () => {
    controller.settings[key] =
      e.type === "checkbox" ? e.checked : Number(e.value);
    try {
      localStorage.setItem(
        "dead-draw-controller",
        JSON.stringify(controller.settings),
      );
    } catch {}
  };
}
$("graphicsQuality").onchange = (e) => world.setQuality(e.target.value);
function toast(text) {
  $("toast").textContent = text;
  $("toast").style.opacity = 1;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => ($("toast").style.opacity = 0), 4000);
}
function announce(text) {
  $("announcement").textContent = text;
  $("announcement").style.opacity = 1;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => ($("announcement").style.opacity = 0), 3200);
}
function release() {
  keys.clear();
  shoot = false;
  aim = false;
  document.exitPointerLock?.();
}
function lock() {
  if (
    !state ||
    !$("casino").hidden ||
    !$("help").hidden ||
    !$("floorplan").hidden ||
    !$("club").hidden ||
    !["combat", "break"].includes(state.phase)
  )
    return;
  if (controller.mode !== "controller")
    $("world")
      .requestPointerLock?.()
      ?.catch(() => {});
  audio.start();
}
function closeCasino() {
  if (station && state?.games[station.id]?.phase === "result")
    send({ type: "collect", station: station.id });
  station = null;
  lastCasino = "";
  show("casino", false);
  lock();
}
let connectingSince = 0;
function join() {
  if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(socket?.readyState))
    return;
  connectingSince ||= Date.now();
  let rejected = false;
  $("enter").disabled = true;
  $("connection").textContent = "CONNECTING TO THE FLOOR…";
  audio.start();
  try {
    socket = new WebSocket(
      gameSocketURL(location, import.meta.env.VITE_GAME_SERVER_URL || ""),
    );
  } catch (error) {
    connectingSince = 0;
    $("enter").disabled = false;
    $("connection").textContent = error.message;
    return;
  }
  const connectionTimer = setTimeout(() => {
    if (socket.readyState === WebSocket.CONNECTING)
      $("connection").textContent =
        "WAKING THE GAME SERVER… FIRST CONNECTION MAY TAKE A MINUTE.";
  }, 5000);
  const deadline = setTimeout(
    () => socket.close(),
    Math.max(1000, 90000 - (Date.now() - connectingSince)),
  );
  socket.onopen = () =>
    send({ type: "join", name: $("name").value, code: $("code").value.trim() });
  socket.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "error") {
      rejected = true;
      toast(msg.message);
      $("connection").textContent = msg.message;
      $("enter").disabled = false;
      socket.close();
      return;
    }
    if (msg.type === "welcome") {
      clearTimeout(connectionTimer);
      clearTimeout(deadline);
      connectingSince = 0;
      myId = msg.id;
      show("welcome", false);
      show("hud");
      $("room").textContent = `ROOM ${msg.code}`;
      $("lobbyCode").textContent = msg.code;
    }
    if (msg.type === "state") {
      state = msg;
      for (const event of state.events) handleEvent(event);
      updateHUD();
    }
  };
  socket.onclose = () => {
    clearTimeout(connectionTimer);
    clearTimeout(deadline);
    if (!myId && !rejected && Date.now() - connectingSince < 90000) {
      $("connection").textContent =
        "WAKING THE GAME SERVER… RETRYING CONNECTION.";
      setTimeout(join, 2000);
      return;
    }
    connectingSince = 0;
    $("enter").disabled = false;
    if (rejected) return;
    if (myId) {
      release();
      toast("Disconnected. Reload to rejoin a new run.");
      show("help");
      $("help").querySelector("h2").textContent = "Connection lost";
    } else
      $("connection").textContent =
        "Server unavailable. Select Enter the casino to retry.";
  };
  socket.onerror = () => {
    /* onclose handles bounded cold-start retries. */
  };
}
function handleEvent(e) {
  soundscape.event(e, state, myId);
  if (["purchase", "pickup"].includes(e.type) && e.player === myId) {
    toast(e.text);
  }
  if (e.type === "contract") {
    toast(e.text);
  }
  if (e.type === "explosion") {
    controller.rumble(0.5, 180);
  }
  if (e.type === "unlock") {
    toast(e.text);
    announce(ROOMS.find((r) => r.id === e.room).name + " · OPEN");
  }
  world.event(e, myId);
  if (e.type === "shot") {
    if (e.player === myId && e.hit) {
      controller.rumble(0.18, 60);
      $("hitmarker").style.opacity = 1;
      $("hitmarker").style.color = e.head ? "#ffd67c" : "#fff";
      setTimeout(() => ($("hitmarker").style.opacity = 0), 100);
    }
  }
  if (e.type === "payout") {
    if (e.player === myId) {
      toast(`${e.result} · ${REWARDS[e.reward].label}`);
    }
    if (e.reward.toLowerCase().includes("jackpot"))
      announce("JACKPOT · PLEASE GAMBLE RESPONSIBLY");
  }
  if (e.type === "notice" && (!e.player || e.player === myId)) toast(e.text);
  if (e.type === "round") {
    announce(`ROUND ${String(e.round).padStart(2, "0")} · NO CASHING OUT`);
  }
  if (e.type === "hurt" && e.player === myId) {
    controller.rumble(0.65, 180);
    document.body.classList.add("hurt");
    setTimeout(() => document.body.classList.remove("hurt"), 220);
  }
}
function nearby() {
  const p = me();
  return p && !p.down
    ? STATIONS.find(
        (s) =>
          state.openRooms?.includes(s.room) &&
          roomAt(p)?.id === s.room &&
          Math.hypot(p.x - s.x, p.z - s.z) < s.r + 2.4,
      )
    : null;
}
function nearDoor() {
  const p = me();
  return p && !p.down
    ? DOORS.find(
        (d) =>
          !doorOpen(d, state.openRooms) && Math.hypot(p.x - d.x, p.z - d.z) < 3,
      )
    : null;
}
function toggleMap() {
  show("club", false);
  if (!$("floorplan").hidden) {
    show("floorplan", false);
    lock();
    return;
  }
  if (station) closeCasino();
  release();
  show("floorplan");
  renderMap();
}
function renderMap() {
  const current = roomAt(me())?.id,
    order = [...ROOMS].sort((a, b) => a.z - b.z || a.x - b.x).map((r) => r.id);
  $("floorRooms").innerHTML = order
    .map((id) => {
      const r = ROOMS.find((r) => r.id === id),
        open = state.openRooms.includes(id);
      return (
        '<div class="floor-room ' +
        (open ? "unlocked" : "locked") +
        " " +
        (current === id ? "current-floor" : "") +
        '"><span>' +
        (current === id ? "YOU ARE HERE" : open ? "OPEN" : "LOCKED") +
        "</span><strong>" +
        r.name +
        "</strong><small>" +
        ({
          poker: "VIDEO POKER",
          craps: "CRAPS",
          baccarat: "BACCARAT",
          slots: "SLOTS",
          roulette: "ROULETTE",
          blackjack: "BLACKJACK",
        }[r.station] || STATIONS.find((s) => s.id === r.station).category) +
        "</small><b>" +
        (open ? "CREW ACCESS" : r.cost + " ◉") +
        "</b></div>"
      );
    })
    .join("");
}
function updateHUD() {
  const p = me();
  if (!p) return;
  updateExpansionHud(p, state, controller.mode === "controller");
  if (!$("club").hidden) clubView.render(p, state);
  $("location").textContent = "GILDED PALM / " + (roomAt(p)?.name || "FLOOR");
  if (!$("floorplan").hidden) renderMap();
  $("round").textContent = String(state.round).padStart(2, "0");
  $("phase").textContent =
    state.phase === "break"
      ? `INTERMISSION · TABLES OPEN`
      : state.phase === "combat"
        ? `${state.zombies.length + state.pending} GUESTS REMAIN`
        : state.phase === "over"
          ? "RUN ENDED"
          : "WAITING FOR THE CREW";
  $("team").textContent = state.players
    .filter((p) => p.id !== myId)
    .map(
      (p) =>
        `${p.down ? "✚" : "●"} ${p.name} · ${p.down ? "DOWN" : p.ready ? "READY" : p.hp + " HP"}`,
    )
    .join(" / ");
  $("health").textContent = p.hp;
  $("healthbar").style.width = Math.min(100, (p.hp / maxHealth(p)) * 100) + "%";
  $("status").textContent = p.down
    ? `REVIVING ${Math.min(100, Math.round((p.revive / 3) * 100))}%`
    : p.invulnerable > 0
      ? `SECOND WIND · ${p.invulnerable.toFixed(1)}s`
      : p.armor > 0
        ? `ARMOR ${p.armor}`
        : "STILL BREATHING";
  document.body.classList.toggle("down", p.down);
  $("chips").innerHTML = `◉ ${p.chips} <small>CHIPS</small>`;
  const gun = p.guns[p.selected],
    w = WEAPONS[gun.id];
  $("weaponName").textContent =
    (gun.power > 1 ? "GILDED " : "") +
    w.name.toUpperCase() +
    (gun.level ? ` · RANK ${gun.level}` : "");
  $("ammo").textContent = gun.ammo;
  $("reserve").textContent = "/ " + gun.reserve;
  $("reload").textContent = p.reload
    ? `RELOADING ${p.reload.toFixed(1)}s`
    : p.guns.length > 1
      ? "R RELOAD · Q SWITCH"
      : "R RELOAD";
  const s = nearby(),
    downed = state.players.find(
      (q) => q.down && q.id !== myId && Math.hypot(q.x - p.x, q.z - p.z) < 2.3,
    );
  let prompt = p.down
    ? "DOWNED · Your crew can hold F to revive you"
    : downed
      ? `HOLD F · REVIVE ${downed.name}`
      : s
        ? state.phase === "break"
          ? `E · ${s.type.toUpperCase()} / ${s.cost}+ CHIPS`
          : "CASINO CLOSED · FINISH THE ROUND"
        : "";
  const door = nearDoor();
  if (door && !p.down && !downed) {
    const r = ROOMS.find((r) => r.id === door.to);
    prompt = door.shortcut
      ? "CROWN SHORTCUT · UNLOCK CROWN VIA EITHER WING"
      : state.openRooms.includes(door.to)
        ? "OPEN THE OTHER WING TO CONNECT THIS ROUTE"
        : `E · OPEN ${r.name} / ${r.cost} CHIPS · WHOLE CREW`;
  }
  if (
    document.pointerLockElement !== $("world") &&
    controller.mode !== "controller" &&
    !station &&
    !p.down &&
    ["combat", "break"].includes(state.phase)
  )
    prompt = prompt || "CLICK THE FLOOR TO AIM · ? FOR CONTROLS";
  $("prompt").textContent = prompt;
  if (controller.mode === "controller")
    $("prompt").textContent = prompt
      .replaceAll("E ·", "A ·")
      .replaceAll("HOLD F", "HOLD LB")
      .replace(
        "CLICK THE FLOOR TO AIM · ? FOR CONTROLS",
        "RS LOOK · MENU FOR CONTROLS",
      );
  $("prompt").style.display = prompt && !station ? "block" : "none";
  show("intermission", state.phase === "break");
  const activeGames = Object.values(state.games).some(
    (g) => g.phase !== "result",
  );
  const ready = state.players.filter((p) => p.ready).length;
  $("nextRound").disabled =
    activeGames || p.down || state.players.some((p) => p.down);
  $("nextRound").textContent = p.ready
    ? "CANCEL READY"
    : state.players.length === 1
      ? "START NEXT ROUND ↗"
      : "READY FOR NEXT ROUND ↗";
  $("intermissionStatus").textContent = activeGames
    ? "Finish active casino games to continue"
    : state.players.some((p) => p.down)
      ? "Revive your crew before continuing"
      : state.players.length === 1
        ? "Gamble as long as you like."
        : ready +
          " / " +
          state.players.length +
          " READY · Everyone must be ready";
  $("difficulty").textContent =
    state.players.length +
    " PLAYER" +
    (state.players.length > 1 ? "S" : "") +
    " · " +
    (state.players.length > 1 ? "CO-OP DIFFICULTY" : "SOLO DIFFICULTY");
  $("hint").textContent =
    controller.mode === "controller"
      ? "LS MOVE · RS LOOK · LT AIM · RT FIRE · A USE · X RELOAD · Y WEAPON · LB REVIVE"
      : "WASD MOVE · SHIFT SPRINT · RMB / V AIM · LMB FIRE · E INTERACT";
  document.querySelector(".ready-shortcut").textContent =
    controller.mode === "controller"
      ? "D-PAD ↓ TO READY · MENU FOR CONTROLS"
      : "N TO READY · ESC FOR MOUSE";
  if (state.phase !== lastPhase) {
    if (state.phase === "combat") {
      show("club", false);
      station = null;
      show("casino", false);
    }
    if (state.phase === "break") {
      release();
    }
    if (state.phase === "break" && lastPhase === "combat") {
      announce("FLOOR CLEARED · CASINO OPEN");
    }

    show("lobby", state.phase === "lobby");
    show("gameover", state.phase === "over");
    if (state.phase === "over") {
      show("club", false);
      release();
      show("casino", false);
      station = null;
      $("runStats").textContent =
        `Round ${state.round} · ${p.kills} kills · ${p.headshots} headshots · Best streak ${p.bestCombo}× · Casino net ${p.casinoNet >= 0 ? "+" : ""}${p.casinoNet} chips.`;
    }
    lastPhase = state.phase;
  }
  if (p.down && station) {
    station = null;
    show("casino", false);
  }
  if (station) renderCasino();
}
function openCasino() {
  show("club", false);
  const s = nearby();
  if (!s) return;
  if (state.phase !== "break") {
    toast("Casino games reopen between rounds.");
    return;
  }
  station = s;
  casinoView.invalidate();
  release();
  show("casino");
  $("casinoTitle").textContent = s.name;
  $("casinoCategory").textContent =
    {
      poker: "SHOTGUNS / FIVE-CARD DRAW",
      craps: "ARMOR / PASS & DON’T PASS",
      baccarat: "ELITE RIFLES / CROWN SALON",
      slots: "SIDEARMS / THREE-REEL CLASSIC",
      roulette: "AUTOMATICS / EUROPEAN ROULETTE",
      blackjack: "RIFLES / BLACKJACK 3:2",
    }[s.id] || s.category;
  renderCasino();
  $("casino").scrollTop = 0;
}
function renderCasino() {
  casinoView.render(station, me(), state);
}
$("mapButton").onclick = toggleMap;
function toggleClub() {
  if (!$("club").hidden) {
    show("club", false);
    lock();
    return;
  }
  if (state?.phase !== "break" || me()?.down) {
    toast("The Survivor’s Club opens between rounds.");
    return;
  }
  if (station) closeCasino();
  show("floorplan", false);
  release();
  show("club");
  clubView.key = "";
  clubView.render(me(), state);
}
$("clubButton").onclick = toggleClub;
$("closeClub").onclick = toggleClub;
$("closeMap").onclick = toggleMap;
$("nextRound").onclick = () => {
  send({ type: "nextRound" });
};
$("enter").onclick = join;
$("start").onclick = () => {
  send({ type: "start" });
  show("lobby", false);
  audio.start();
  if (controller.mode !== "controller")
    $("world")
      .requestPointerLock?.()
      ?.catch(() => {});
};
$("restart").onclick = () => {
  send({ type: "start" });
  show("gameover", false);
  if (controller.mode !== "controller")
    $("world")
      .requestPointerLock?.()
      ?.catch(() => {});
};
$("closeCasino").onclick = closeCasino;
$("world").onclick = lock;
$("helpButton").onclick = () => {
  release();
  show("help");
};
$("resume").onclick = () => {
  show("help", false);
  lock();
};
addEventListener("keydown", (e) => {
  controller.useKeyboard();
  if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  if (e.code === "Escape") {
    if (station) closeCasino();
    show("help", false);
    show("floorplan", false);
    show("club", false);
    release();
    return;
  }
  if (e.code === "KeyM" && me()) {
    toggleMap();
    return;
  }
  if (e.code === "KeyU" && me() && !e.repeat) {
    toggleClub();
    return;
  }
  if (
    e.code === "KeyN" &&
    state?.phase === "break" &&
    !menuRoot() &&
    !e.repeat
  ) {
    send({ type: "nextRound" });
    return;
  }
  if (me() && !menuRoot() && !e.repeat) {
    if (e.code === "KeyV") {
      aim = !aim;
      return;
    }
    if (e.code === "KeyE") {
      interact();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      send({ type: "dodge" });
      return;
    }
    if (e.code === "KeyG") {
      send({ type: "grenade" });
      return;
    }
    if (e.code === "KeyR") {
      send({ type: "reload" });
      return;
    }
    if (e.code === "KeyQ") {
      send({ type: "switch" });
      return;
    }
  }
  if (document.pointerLockElement !== $("world")) return;
  keys.add(e.code);
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => {
  controller.suspend();
  keys.clear();
  shoot = false;
  aim = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) controller.suspend();
});
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement) {
    keys.clear();
    shoot = false;
    aim = false;
  }
});
addEventListener("mousemove", (e) => {
  if (e.movementX || e.movementY) controller.useKeyboard();
  if (document.pointerLockElement !== $("world") || station) return;
  const sensitivity = aim ? 1 / (opticFor(me())?.zoom || 1) : 1;
  yaw -= e.movementX * 0.0022 * sensitivity;
  pitch = Math.max(
    -0.65,
    Math.min(0.65, pitch - e.movementY * 0.0018 * sensitivity),
  );
});
addEventListener("mousedown", (e) => {
  controller.useKeyboard();
  if (document.pointerLockElement !== $("world")) return;
  if (e.button === 0) shoot = true;
  if (e.button === 2) aim = true;
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) shoot = false;
  if (e.button === 2) aim = false;
});
addEventListener("contextmenu", (e) => e.preventDefault());
setInterval(() => {
  if (!myId) return;
  send({
    type: "input",
    input: {
      forward:
        controller.mode === "controller"
          ? controller.input.forward
          : (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
      right:
        controller.mode === "controller"
          ? controller.input.right
          : (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
      yaw,
      pitch,
      aim:
        !menuRoot() &&
        !me()?.down &&
        (controller.mode === "controller" ? controller.input.aim : aim),
      shoot: controller.mode === "controller" ? controller.input.shoot : shoot,
      sprint:
        controller.mode === "controller"
          ? controller.input.sprint
          : keys.has("ShiftLeft") || keys.has("ShiftRight"),
      revive:
        controller.mode === "controller"
          ? controller.input.revive
          : keys.has("KeyF"),
    },
  });
}, 1000 / 30);
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  controller.update(dt, now);
  $("padMenuHint").hidden = controller.mode !== "controller" || !menuRoot();
  world.update(
    dt,
    state,
    myId,
    yaw,
    pitch,
    !menuRoot() &&
      !me()?.down &&
      (controller.mode === "controller" ? controller.input.aim : aim),
  );
  casinoView.animate(state);
  soundscape.update(dt, state, myId, yaw, station?.id, {
    trigger: controller.mode === "controller" ? controller.input.shoot : shoot,
    menu: !!menuRoot(),
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
