import { CrewUI } from "./crew-ui.js";
import { TestingCode, TestingUI } from "./testing-ui.js";
import { BackgroundMusic } from "./music.js";
import { PrizeWheelUI } from "./prize-wheel-ui.js";
import { nearbyWheel, wheelCost } from "../shared/arsenal.js";
import { JukeboxUI } from "./jukebox-ui.js";
import { nearbyService } from "../shared/services.js";
import { nearbyPower, nearbyCampaignTarget } from "../shared/campaign.js";
import { cosmeticMessage } from "./profile.js";
import { MovementPrediction } from "./prediction.js";
import "./crew.css";
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
import { StateDecoder, STATE_PROTOCOL } from "../shared/state-stream.js";
import { textValue, styleValue } from "./dom-values.js";
const nodes = new Map();
const $ = (id) => {
    let node = nodes.get(id);
    if (!node?.isConnected) {
      node = document.getElementById(id);
      nodes.set(id, node);
    }
    return node;
  },
  show = (id, value = true) => ($(id).hidden = !value);
const setText = (id, value) => textValue($(id), value);
const audio = new Audio();
const soundscape = new Soundscape(audio);
bindAudioSettings(audio);
const music = new BackgroundMusic(audio);
addEventListener("pointerdown", () => music.unlock(), { capture: true });
addEventListener(
  "keydown",
  (e) => {
    if (e.isTrusted) music.unlock();
  },
  { capture: true },
);
for (const event of ["blur", "focus", "pagehide"])
  addEventListener(event, () => music.update(state));
document.addEventListener("visibilitychange", () => music.update(state));
if (import.meta.hot) import.meta.hot.dispose(() => music.dispose());
let world;
try {
  world = new World($("world"));
} catch (e) {
  setText(
    "connection",
    "WebGL could not start. Enable hardware acceleration and reload.",
  );
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
const crewUI = new CrewUI(send),
  prediction = new MovementPrediction();
const jukeboxUI = new JukeboxUI(music, send);
const prizeWheelUI = new PrizeWheelUI(send);
const testingUI = new TestingUI(send),
  testingCode = new TestingCode();
let serviceClick = false;
let inputSeq = 0,
  latestInput = { yaw: 0 },
  spectatorIndex = 0,
  session = {};
try {
  session = JSON.parse(localStorage.getItem("dead-draw-session") || "{}");
} catch {}
let savedSessionJSON = null;
const saveSession = () => {
  try {
    const json = JSON.stringify(session);
    if (json !== savedSessionJSON) {
      localStorage.setItem("dead-draw-session", json);
      savedSessionJSON = json;
    }
  } catch {}
};
$("enter").insertAdjacentHTML(
  "afterend",
  `<button id="resumeRun" ${session.token ? "" : "hidden"}>RESUME LAST RUN / CHECKPOINT</button>`,
);
$("resumeRun").onclick = () => join(true);
$("crewButton").onclick = () => {
  show("jukeboxPanel", false);
  release();
  crewUI.toggle(me(), state);
};
$("careerButton").onclick = () => crewUI.toggle(me(), state, "career");
function menuRoot() {
  return (
    [
      "testingPanel",
      "prizeWheelPanel",
      "jukeboxPanel",
      "crewPanel",
      "help",
      "club",
      "floorplan",
      "casino",
      "gameover",
      "lobby",
      "welcome",
    ]
      .map($)
      .find((e) => !e.hidden) || null
  );
}
function interact() {
  if (
    state?.players.some(
      (v) =>
        v.id !== myId && v.down && Math.hypot(v.x - me().x, v.z - me().z) < 2.5,
    )
  )
    return;
  const target = nearbyCampaignTarget(me(), state);
  if (target && target.id !== "power") {
    release();
    crewUI.toggle(me(), state, "interactions");
    return;
  }
  if (nearbyWheel(me(), state)) {
    if (state.phase !== "break") {
      toast("PRIZE WHEEL CLOSED DURING COMBAT");
      return;
    }
    release();
    prizeWheelUI.open(me(), state);
    return;
  }
  const power = nearbyPower(me(), state);
  if (power) {
    if (state.campaign.power) toast("CASINO POWER IS ALREADY ON");
    else if (state.phase !== "break") toast("RESTORE POWER BETWEEN ROUNDS");
    else if (me().chips < power.cost) toast("POWER REQUIRES 150 CHIPS");
    else send({ type: "crew", choice: "power" });
    return;
  }
  const service = preferredService();
  if (service) {
    useService(service);
    return;
  }
  const d = nearDoor();
  if (d || !nearby()) {
    release();
    crewUI.toggle(me(), state, "interactions");
  } else openCasino();
}
function preferredService() {
  const p = me(),
    service = nearbyService(p, state?.openRooms || []),
    table = nearby();
  if (!service || nearDoor()) return null;
  return !table ||
    Math.hypot(p.x - service.x, p.z - service.z) <
      Math.hypot(p.x - table.x, p.z - table.z)
    ? service
    : null;
}
function useService(service) {
  if (service.id === "cashier") toggleClub();
  else {
    if (station) closeCasino();
    show("club", false);
    show("crewPanel", false);
    show("floorplan", false);
    release();
    jukeboxUI.open(me(), state);
  }
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
    setText(
      "controllerStatus",
      value === "controller"
        ? "CONTROLLER ACTIVE · STANDARD LAYOUT"
        : "KEYBOARD + MOUSE · PRESS A CONTROLLER BUTTON TO CONNECT",
    );
  },
  action: (action) => {
    if (me()?.down && ["switch", "club"].includes(action)) {
      spectatorIndex++;
      return;
    }
    if (action === "crew") {
      show("jukeboxPanel", false);
      release();
      crewUI.toggle(me(), state);
      return;
    }
    if (action === "shove") {
      send({ type: "crew", choice: "shove" });
      return;
    }
    if (action === "back") {
      if (!$("prizeWheelPanel").hidden) {
        show("prizeWheelPanel", false);
        return;
      }
      if (!$("jukeboxPanel").hidden) {
        show("jukeboxPanel", false);
        return;
      }
      if (!$("crewPanel").hidden) {
        $("crewPanel").hidden = true;
        return;
      }
      if (!$("help").hidden) show("help", false);
      else if (!$("club").hidden) show("club", false);
      else if (!$("floorplan").hidden) show("floorplan", false);
      else if (station) closeCasino();
      return;
    }
    if (action === "pause") {
      release();
      show("jukeboxPanel", false);
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
setText("connection", "PREPARING THE GILDED PALM…");
world.ready
  .then(() => {
    $("enter").disabled = false;
    setText("connection", "THE FLOOR IS READY");
  })
  .catch((error) => {
    setText("connection", "Could not load 3D assets. Reload to retry.");
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
  setText("toast", text);
  $("toast").style.opacity = 1;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => ($("toast").style.opacity = 0), 4000);
}
function announce(text) {
  setText("announcement", text);
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
    !$("prizeWheelPanel").hidden ||
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
function join(resume = false) {
  if ([WebSocket.OPEN, WebSocket.CONNECTING].includes(socket?.readyState))
    return;
  connectingSince ||= Date.now();
  let rejected = false;
  const decoder = new StateDecoder();
  let resyncRequested = false;
  $("enter").disabled = true;
  setText("connection", "CONNECTING TO THE FLOOR…");
  audio.start();
  try {
    socket = new WebSocket(
      gameSocketURL(location, import.meta.env.VITE_GAME_SERVER_URL || ""),
    );
  } catch (error) {
    connectingSince = 0;
    $("enter").disabled = false;
    setText("connection", error.message);
    return;
  }
  const connectionTimer = setTimeout(() => {
    if (socket.readyState === WebSocket.CONNECTING)
      setText(
        "connection",
        "WAKING THE GAME SERVER… FIRST CONNECTION MAY TAKE A MINUTE.",
      );
  }, 5000);
  const deadline = setTimeout(
    () => socket.close(),
    Math.max(1000, 90000 - (Date.now() - connectingSince)),
  );
  socket.onopen = () =>
    send({
      type: "join",
      protocol: STATE_PROTOCOL,
      name: $("name").value,
      code: resume ? session.code || "" : $("code").value.trim(),
      resumeToken: session.token,
      checkpoint: resume ? session.checkpoint : undefined,
    });
  socket.onmessage = (e) => {
    const msg = decoder.decode(JSON.parse(e.data));
    if (!msg) {
      if (decoder.needsResync && !resyncRequested) {
        send({ type: "resync" });
        resyncRequested = true;
      }
      return;
    }
    if (msg.type === "state") resyncRequested = false;
    if (msg.type === "error") {
      rejected = true;
      toast(msg.message);
      setText("connection", msg.message);
      $("enter").disabled = false;
      socket.close();
      return;
    }
    if (msg.type === "checkpoint") {
      session.checkpoint = msg.checkpoint;
      saveSession();
      return;
    }
    if (msg.type === "welcome") {
      if (session.code !== msg.code) delete session.checkpoint;
      session.code = msg.code;
      session.token = msg.resumeToken;
      saveSession();
      $("resumeRun").hidden = false;
      $("help").querySelector("h2").textContent = "Controls";
      show("help", false);
      send(cosmeticMessage());
      clearTimeout(connectionTimer);
      clearTimeout(deadline);
      connectingSince = 0;
      myId = msg.id;
      show("welcome", false);
      show("hud");
      setText("room", `ROOM ${msg.code}`);
      setText("lobbyCode", msg.code);
    }
    if (msg.type === "state") {
      state = msg;
      if (me()) prediction.reconcile(me(), state.openRooms);
      crewUI.update(me(), state, myId);
      testingUI.update(me(), state);
      if (state.phase === "over") {
        delete session.checkpoint;
        saveSession();
      }
      for (const event of state.events) handleEvent(event);
      updateHUD();
    }
  };
  socket.onclose = () => {
    clearTimeout(connectionTimer);
    clearTimeout(deadline);
    if (!myId && !rejected && Date.now() - connectingSince < 90000) {
      setText("connection", "WAKING THE GAME SERVER… RETRYING CONNECTION.");
      setTimeout(() => join(resume), 2000);
      return;
    }
    $("enter").disabled = false;
    if (rejected) return;
    if (myId) {
      release();
      toast("Connection interrupted. Reconnecting to your survivor…");
      if (!connectingSince) connectingSince = Date.now();
      if (Date.now() - connectingSince < 90000)
        setTimeout(() => join(true), 2000);
      show("jukeboxPanel", false);
      show("help");
      $("help").querySelector("h2").textContent = "Connection lost";
    } else {
      connectingSince = 0;
      setText(
        "connection",
        "Server unavailable. Select Enter the casino to retry.",
      );
    }
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
  show("jukeboxPanel", false);
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
let mapKey = "";
function renderMap() {
  const current = roomAt(me())?.id;
  const key = current + ":" + state.openRooms.join(",");
  if (key === mapKey) return;
  mapKey = key;
  const order = [...ROOMS]
    .sort((a, b) => a.z - b.z || a.x - b.x)
    .map((r) => r.id);
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
  jukeboxUI.render(p, state);
  prizeWheelUI.update(p, state);
  updateExpansionHud(p, state, controller.mode === "controller");
  if (!$("club").hidden) clubView.render(p, state);
  setText(
    "location",
    "GILDED PALM / " +
      (roomAt(p)?.name || "FLOOR") +
      " · WHEEL: " +
      (ROOMS.find((r) => r.id === state.prizeWheel?.room)?.name || "—"),
  );
  if (!$("floorplan").hidden) renderMap();
  setText("round", String(state.round).padStart(2, "0"));
  setText(
    "phase",
    state.phase === "break"
      ? `INTERMISSION · ${Math.ceil(state.timer)}s · TABLES OPEN`
      : state.phase === "combat"
        ? `${state.specialRound ? "MASCOT MELTDOWN · " : ""}${state.zombies.length + state.pending} GUESTS REMAIN`
        : state.phase === "over"
          ? "RUN ENDED"
          : "WAITING FOR THE CREW",
  );
  setText(
    "team",
    state.players
      .filter((p) => p.id !== myId)
      .map(
        (p) =>
          `${p.down ? "✚" : "●"} ${p.name} · ${p.down ? "DOWN" : p.ready ? "READY" : p.hp + " HP"}`,
      )
      .join(" / "),
  );
  setText("health", p.hp);
  styleValue(
    $("healthbar"),
    "width",
    Math.min(100, (p.hp / maxHealth(p)) * 100) + "%",
  );
  setText(
    "status",
    p.down
      ? `REVIVING ${Math.min(100, Math.round((p.revive / 3) * 100))}%`
      : p.invulnerable > 0
        ? `SECOND WIND · ${p.invulnerable.toFixed(1)}s`
        : p.armor > 0
          ? `ARMOR ${p.armor}`
          : "STILL BREATHING",
  );
  document.body.classList.toggle("down", p.down);
  const chipLabel = `◉ ${p.chips} <small>CHIPS</small>`;
  if ($("chips").innerHTML !== chipLabel) $("chips").innerHTML = chipLabel;
  const gun = p.guns[p.selected],
    w = WEAPONS[gun.id];
  setText(
    "weaponName",
    (gun.power > 1 ? "GILDED " : "") +
      w.name.toUpperCase() +
      (gun.level ? ` · RANK ${gun.level}` : ""),
  );
  document.body.classList.toggle("shotgun", w.category === "shells");
  setText("ammo", w.melee ? "∞" : gun.ammo);
  setText("reserve", w.melee ? "NO AMMO NEEDED" : "/ " + gun.reserve);
  setText(
    "reload",
    p.reload
      ? `RELOADING ${p.reload.toFixed(1)}s`
      : p.guns.length > 1
        ? "R RELOAD · Q SWITCH"
        : "R RELOAD",
  );
  const s = nearby(),
    downed = state.players.find(
      (q) => q.down && q.id !== myId && Math.hypot(q.x - p.x, q.z - p.z) < 2.3,
    );
  let prompt = p.down
    ? "DOWNED · Your crew can hold F to revive you"
    : downed
      ? `HOLD E / F · REVIVE ${downed.name}`
      : s
        ? state.phase === "break"
          ? `E · ${s.type.toUpperCase()} / ${s.cost}+ CHIPS`
          : "CASINO CLOSED · FINISH THE ROUND"
        : "";
  const door = nearDoor();
  const service = preferredService();
  if (service && !downed)
    prompt =
      service.id === "cashier"
        ? state.phase === "break"
          ? "E · SURVIVOR’S CLUB · OR CLICK · U SHORTCUT"
          : "CASHIER CLOSED · U BETWEEN ROUNDS"
        : "E · GOLDEN HOUR JUKEBOX · OR CLICK";
  if (door && !p.down && !downed) {
    const r = ROOMS.find((r) => r.id === door.to);
    prompt = door.shortcut
      ? "CROWN SHORTCUT · UNLOCK CROWN VIA EITHER WING"
      : state.openRooms.includes(door.to)
        ? "OPEN THE OTHER WING TO CONNECT THIS ROUTE"
        : `E · OPEN ${r.name} / ${r.cost} CHIPS · WHOLE CREW`;
  }
  if (nearbyWheel(p, state) && !downed)
    prompt =
      state.phase === "break"
        ? `E · GRAND PRIZE WHEEL / ${wheelCost(state.prizeWheel)} CHIPS`
        : "PRIZE WHEEL CLOSED · FINISH THE ROUND";
  if (nearbyPower(p, state) && !downed)
    prompt = state.campaign.power
      ? "CASINO POWER · ONLINE"
      : state.phase === "break"
        ? "E · RESTORE POWER · 150 CHIPS"
        : "POWER TERMINAL · USE BETWEEN ROUNDS";
  const campaignTarget = nearbyCampaignTarget(p, state);
  if (campaignTarget && campaignTarget.id !== "power" && !downed)
    prompt = `E · ${campaignTarget.name.toUpperCase()}${campaignTarget.cost ? " / " + campaignTarget.cost + " CHIPS" : ""}`;
  else if (door && !p.down && !downed && !nearbyPower(p, state))
    prompt += " · OPEN / CONTRIBUTE";
  if (
    document.pointerLockElement !== $("world") &&
    controller.mode !== "controller" &&
    !station &&
    !p.down &&
    ["combat", "break"].includes(state.phase)
  )
    prompt = prompt || "CLICK THE FLOOR TO AIM · ? FOR CONTROLS";
  setText("prompt", prompt);
  if (controller.mode === "controller")
    setText(
      "prompt",
      prompt
        .replaceAll("E ·", "A ·")
        .replaceAll("HOLD E / F", "HOLD LB")
        .replace(
          "CLICK THE FLOOR TO AIM · ? FOR CONTROLS",
          "RS LOOK · MENU FOR CONTROLS",
        ),
    );
  $("prompt").style.display = prompt && !station ? "block" : "none";
  show("intermission", state.phase === "break");
  const seconds = Math.max(0, Math.ceil(state.timer || 0));
  $("nextRound").disabled = !!p.down;
  setText(
    "nextRound",
    `${p.ready ? "CANCEL READY" : "READY UP"} · N · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
  );
  $("nextRound").classList.toggle("countdown-urgent", seconds <= 10);
  setText(
    "intermissionStatus",
    `${state.players.filter((v) => !v.offline && !v.down && v.ready).length}/${state.players.filter((v) => !v.offline && !v.down).length} READY · All ready skips the wait · Finish your hand first`,
  );
  setText(
    "difficulty",
    state.players.length +
      " PLAYER" +
      (state.players.length > 1 ? "S" : "") +
      " · " +
      (state.players.length > 1 ? "CO-OP DIFFICULTY" : "SOLO DIFFICULTY"),
  );
  setText(
    "hint",
    controller.mode === "controller"
      ? "LS MOVE · RS LOOK · LT AIM · RT FIRE · A USE · X RELOAD · Y WEAPON · LB REVIVE"
      : "WASD MOVE · SHIFT ROLL · SPACE JUMP · RMB / V AIM · LMB FIRE · E INTERACT · U SURVIVOR’S CLUB",
  );
  document.querySelector(".ready-shortcut").textContent =
    "N TO READY / CANCEL · WAVE STILL STARTS AT THE BELL";
  if (state.phase !== lastPhase) {
    if (state.phase === "combat") {
      show("crewPanel", false);
      show("jukeboxPanel", false);
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
    if (state.phase === "over") $("crewPanel").hidden = true;
    if (state.phase === "over") {
      show("jukeboxPanel", false);
      show("club", false);
      release();
      show("casino", false);
      station = null;
      setText(
        "runStats",
        `Round ${state.round} · ${p.kills} kills · ${p.headshots} headshots · Best streak ${p.bestCombo}× · Casino net ${p.casinoNet >= 0 ? "+" : ""}${p.casinoNet} chips.`,
      );
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
  setText("casinoTitle", s.name);
  setText(
    "casinoCategory",
    {
      poker: "SHOTGUNS / FIVE-CARD DRAW",
      craps: "ARMOR / PASS & DON’T PASS",
      baccarat: "ELITE RIFLES / CROWN SALON",
      slots: "SIDEARMS / THREE-REEL CLASSIC",
      roulette: "AUTOMATICS / EUROPEAN ROULETTE",
      blackjack: "RIFLES / BLACKJACK 3:2",
    }[s.id] || s.category,
  );
  renderCasino();
  $("casino").scrollTop = 0;
}
function renderCasino() {
  casinoView.render(station, me(), state);
}
$("mapButton").onclick = toggleMap;
function toggleClub() {
  show("jukeboxPanel", false);
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
$("nextRound").onclick = () => send({ type: "nextRound" });
$("enter").onclick = () => join(false);
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
$("world").onclick = () => {
  if (serviceClick) {
    serviceClick = false;
    return;
  }
  lock();
};
$("helpButton").onclick = () => {
  show("jukeboxPanel", false);
  release();
  show("help");
};
$("resume").onclick = () => {
  show("help", false);
  lock();
};
addEventListener("keydown", (e) => {
  controller.useKeyboard();
  if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) && e.code !== "Escape") return;
  if (me() && testingCode.accept(e)) {
    e.preventDefault();
    release();
    testingUI.toggle(me(), state);
    return;
  }
  if (e.code === "Escape") {
    show("testingPanel", false);
    show("prizeWheelPanel", false);
    $("crewPanel").hidden = true;
    if (station) closeCasino();
    show("help", false);
    show("floorplan", false);
    show("club", false);
    show("jukeboxPanel", false);
    release();
    return;
  }
  if (e.code === "KeyT" && me() && !e.repeat) {
    show("jukeboxPanel", false);
    release();
    crewUI.toggle(me(), state);
    return;
  }
  if (me()?.down && ["BracketLeft", "BracketRight"].includes(e.code)) {
    spectatorIndex += e.code === "BracketRight" ? 1 : -1;
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
  if (e.code === "KeyN" && state?.phase === "break" && !e.repeat) {
    send({ type: "nextRound" });
    return;
  }
  if (me() && !menuRoot() && !e.repeat) {
    if (e.code === "KeyC") {
      send({ type: "crew", choice: "shove" });
      return;
    }
    if (e.code === "KeyZ") {
      send({ type: "crew", choice: "ping" });
      return;
    }
    if (e.code === "KeyV") {
      aim = !aim;
      return;
    }
    if (e.code === "KeyE") {
      interact();
      return;
    }
    if (["ShiftLeft", "ShiftRight"].includes(e.code) && !e.repeat) {
      send({ type: "dodge" });
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      send({ type: "jump" });
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
  if (e.button === 0 && e.target === $("world") && !menuRoot() && me()) {
    const locked = document.pointerLockElement === $("world"),
      r = $("world").getBoundingClientRect();
    const service = world.serviceScene?.pick(
      locked ? r.left + r.width / 2 : e.clientX,
      locked ? r.top + r.height / 2 : e.clientY,
      world.camera,
      $("world"),
      me(),
      state.openRooms,
    );
    if (service) {
      serviceClick = true;
      useService(service);
      e.preventDefault();
      return;
    }
  }
  if (document.pointerLockElement !== $("world")) return;
  if (e.button === 0) shoot = true;
  if (e.button === 2) aim = true;
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) shoot = false;
  if (e.button === 2) aim = false;
});
addEventListener("contextmenu", (e) => e.preventDefault());
function readInput() {
  return {
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
    sprint: false,
    revive:
      controller.mode === "controller"
        ? controller.input.revive
        : keys.has("KeyF") || keys.has("KeyE"),
  };
}
setInterval(() => {
  if (!myId || socket?.readyState !== WebSocket.OPEN) return;
  latestInput = readInput();
  latestInput.seq = ++inputSeq;
  prediction.sent(inputSeq, latestInput);
  send({ type: "input", input: latestInput });
}, 1000 / 30);
let lastSoundState = null;
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  controller.update(dt, now);
  $("padMenuHint").hidden = controller.mode !== "controller" || !menuRoot();
  let viewId = myId,
    viewYaw = yaw,
    viewPitch = pitch;
  const p = me();
  if (p?.down) {
    const living = state.players.filter((p) => !p.down && !p.offline);
    const target =
      living[
        ((spectatorIndex % living.length) + living.length) % living.length
      ];
    if (target) {
      viewId = target.id;
      viewYaw = target.yaw;
      viewPitch = target.pitch;
    }
  }
  world.predicted =
    p && !p.down
      ? prediction.update(dt, p, readInput(), state.openRooms)
      : null;
  world.localId = myId;
  world.update(
    dt,
    state,
    viewId,
    viewYaw,
    viewPitch,
    !menuRoot() &&
      !me()?.down &&
      (controller.mode === "controller" ? controller.input.aim : aim),
  );
  casinoView.animate(state);
  music.update(state);
  soundscape.update(dt, state, myId, yaw, station?.id, {
    newSnapshot: state !== lastSoundState,
    trigger: controller.mode === "controller" ? controller.input.shoot : shoot,
    menu: !!menuRoot(),
  });
  lastSoundState = state;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
