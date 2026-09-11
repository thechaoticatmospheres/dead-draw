import { STATIONS } from "../shared/data.js";
import { ROOMS, DOORS, roomAt, clearPath } from "../shared/map.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const cards = (g) =>
  [
    ...(g.cards || []),
    ...(g.community || []),
    ...(g.dealer || []),
    ...(g.hands || []).flatMap((h) => h.cards),
    ...(g.playerCards || []),
    ...(g.bankerCards || []),
  ]
    .filter((c) => c.rank > 0)
    .map((c) => c.rank + c.suit)
    .join(",");

// Audio observes public snapshots; it never predicts a win or changes simulation state.
export class Soundscape {
  constructor(audio) {
    this.audio = audio;
    this.players = new Map();
    this.games = new Map();
    this.hazards = new Map();
    this.steps = new Map();
    this.events = new Set();
    this.clock = 0;
    this.growlAt = 0;
    this.roomAt = 0;
    this.neonAt = 6;
    this.phase = null;
    this.bossId = null;
  }
  spatial(name, source, state, options = {}) {
    const p = this.audio.listener;
    return this.audio.play(name, {
      source,
      blocked: !!(p && source && !clearPath(p, source, state.openRooms)),
      ...options,
    });
  }
  event(e, state, myId) {
    if (this.events.has(e.id)) return;
    this.events.add(e.id);
    if (this.events.size > 128)
      this.events.delete(this.events.values().next().value);
    const p = state.players.find((p) => p.id === myId),
      actor = state.players.find((p) => p.id === e.player),
      own = e.player === myId,
      a = this.audio;
    if (!p) return;
    a.listener = { ...p, yaw: this.yaw ?? p.yaw };
    const play = (name, options = {}) =>
      this.spatial(name, own ? null : actor || e, state, options);
    if (e.type === "shot") {
      play("shot", { weapon: e.weapon });
      if (e.hit && own) a.play(e.head ? "headshot" : "hit");
      else if (e.end) this.spatial("impact", e.end, state, { gain: 0.6 });
    } else if (e.type === "death")
      this.spatial("death", e, state, { kind: e.kind, gain: 0.7 });
    else if (e.type === "explosion") this.spatial("explosion", e, state);
    else if (e.type === "dodge" || e.type === "shove") play("dodge");
    else if (e.type === "throw") play("throw");
    else if (e.type === "hurt") {
      const before = this.players.get(e.player);
      play(before?.armor > 0 ? "armor" : "hurt");
    } else if (e.type === "chip" && own) a.play("chips");
    else if (e.type === "wager")
      this.spatial(
        "wager",
        STATIONS.find((s) => s.id === e.station),
        state,
        { gain: own ? 1 : 0.55 },
      );
    else if (e.type === "purchase" && own) a.play("upgrade");
    else if (e.type === "pickup" && own) a.play("pickup");
    else if (e.type === "contract") a.play("contract");
    else if (e.type === "unlock")
      this.spatial(
        "door",
        DOORS.find((d) => d.to === e.room) ||
          ROOMS.find((r) => r.id === e.room),
        state,
      );
    else if (e.type === "round") a.play("round", { round: e.round });
    else if (e.type === "payout") {
      const jackpot =
        /jackpot|gilded/i.test(e.reward) || /jackpot/i.test(e.result);
      const name = jackpot
        ? "jackpot"
        : /push/i.test(e.result)
          ? "push"
          : e.reward !== "dud" || e.returned > 0
            ? "win"
            : "loss";
      this.spatial(
        name,
        STATIONS.find((s) => s.id === e.station),
        state,
        { gain: own ? 1 : 0.45 },
      );
    }
  }
  update(
    dt,
    state,
    myId,
    yaw,
    table = null,
    { trigger = false, menu = false, newSnapshot = true } = {},
  ) {
    this.clock += dt;
    this.yaw = yaw;
    const p = state?.players.find((p) => p.id === myId),
      a = this.audio;
    if (!p) return;
    a.listener = { x: p.x, z: p.z, yaw };
    a.duck(state.phase === "combat");
    const count = state.phase === "break" ? Math.ceil(state.timer || 0) : -1;
    if (count > 0 && count <= 10 && count !== this.countdown)
      a.play("ready", { gain: count <= 5 ? 1 : 0.55 });
    this.countdown = count;

    // Continue observing while muted so resuming never replays old wins or movement.
    if (this.phase && state.phase !== this.phase) {
      if (state.phase === "break" && this.phase === "combat") a.play("clear");
      if (state.phase === "over") a.play("over");
    }
    this.phase = state.phase;
    if (this.clock >= this.roomAt) {
      a.play("room", { gain: state.phase === "over" ? 0.5 : 1 });
      this.roomAt = this.clock + 1.9;
    }
    if (this.clock >= this.neonAt) {
      this.spatial(
        "neon",
        ROOMS.find((r) => r.id === roomAt(p)?.id),
        state,
      );
      this.neonAt = this.clock + 6 + Math.random() * 5;
    }
    if (state.phase === "combat" && !p.down && p.hp <= 30) a.play("heartbeat");
    if (
      trigger &&
      !menu &&
      !p.down &&
      p.guns[p.selected].ammo === 0 &&
      !p.reload &&
      ["combat", "break"].includes(state.phase)
    )
      a.play("empty");
    if (newSnapshot) {
      const currentPlayers = new Map();
      for (const player of state.players) {
        const old = this.players.get(player.id),
          own = player.id === myId,
          source = own ? null : player;
        if (old) {
          const d = distance(old, player),
            step = (this.steps.get(player.id) || 0) + (d < 1.5 ? d : 0);
          if (
            d > 0.002 &&
            step > 1.35 &&
            !player.down &&
            player.dodgeTime <= 0
          ) {
            this.spatial("step", source, state, {
              hard: ["atrium", "crown"].includes(roomAt(player)?.id),
              gain: own ? 1 : 0.7,
            });
            this.steps.set(player.id, 0);
          } else this.steps.set(player.id, step);
          if (!old.reload && player.reload)
            this.spatial("reload", source, state);
          if (
            old.reload &&
            !player.reload &&
            !player.down &&
            player.guns[player.selected].ammo > old.guns[old.selected].ammo
          )
            this.spatial("reloadEnd", source, state);
          if (old.selected !== player.selected)
            this.spatial("switch", source, state);
          if (!old.down && player.down)
            this.spatial("down", source, state, { gain: own ? 1 : 0.7 });
          if (
            (old.down && !player.down) ||
            (!old.invulnerable && player.invulnerable)
          )
            this.spatial("revive", source, state);
          if (!old.ready && player.ready)
            a.play("ready", { gain: own ? 1 : 0.5 });
        }
        currentPlayers.set(player.id, player);
      }
      this.players = currentPlayers;
      for (const id of this.steps.keys())
        if (!currentPlayers.has(id)) this.steps.delete(id);
    }
    const boss = state.zombies.find((z) => z.kind === "boss");
    if (boss && boss.id !== this.bossId) {
      this.spatial("boss", boss, state);
      this.bossId = boss.id;
    } else if (!boss) this.bossId = null;
    if (state.phase === "combat" && this.clock >= this.growlAt) {
      const near = state.zombies
        .filter((z) => distance(z, p) < 18)
        .sort((x, y) => distance(x, p) - distance(y, p))
        .slice(0, 4);
      const z = near[Math.floor(Math.random() * near.length)];
      if (z) this.spatial("enemy", z, state, { kind: z.kind });
      this.growlAt = this.clock + 1.2 + Math.random() * 0.9;
    }
    if (newSnapshot) {
      const hazards = new Map();
      for (const h of state.hazards || []) {
        const old = this.hazards.get(h.id);
        if (h.kind !== "grenade") {
          if (old === undefined && h.delay > 0)
            this.spatial(h.kind === "slam" ? "warnSlam" : "warnAcid", h, state);
          if ((old === undefined || old > 0) && h.delay <= 0)
            this.spatial(h.kind === "slam" ? "slam" : "acid", h, state);
        }
        hazards.set(h.id, h.delay);
      }
      this.hazards = hazards;
    }
    if (newSnapshot || !this.tableEntries) {
      const tables = { ...state.games };
      for (const [id, t] of Object.entries(state.crewTables || {}))
        tables[id] = {
          ...t,
          player: "crew",
          phase:
            id === "roulette" && t.phase === "rolling" ? "playing" : t.phase,
          duration: 5,
          remaining: 2,
          hands: t.seats.flatMap((s) => s.hand?.hands || []),
          playerCards: t.baccarat?.playerCards,
          bankerCards: t.baccarat?.bankerCards,
        };
      this.tableEntries = Object.entries(tables);
    }
    const games = newSnapshot ? new Map() : this.games;
    for (const [id, g] of this.tableEntries) {
      const previous = this.games.get(id),
        key = g.startedAt + ":" + g.player;
      const old = previous?.key === key ? previous : null;
      const pos = id === table ? null : STATIONS.find((s) => s.id === id),
        gain = id === table ? 1 : 0.6;
      const play = (name, extra = {}) =>
        this.spatial(name, pos, state, {
          gain,
          key: name + ":" + id,
          ...extra,
        });
      // Motors and wheel ticks retain their frame-driven cadence; transitions are observed once.
      if (
        id === "slots" &&
        g.phase === "playing" &&
        (g.reelStops || []).filter((s) => s !== null).length < 3
      )
        play("slotMotor");
      if (id === "roulette" && g.phase === "playing")
        play("rouletteTick", {
          cooldown:
            0.06 + Math.max(0, 1 - (g.remaining || 0) / g.duration) * 0.19,
        });
      if (!newSnapshot) continue;
      const visible = cards(g),
        reels = (g.reelStops || []).filter((s) => s !== null).length,
        picks = g.vault?.picks.length || 0;
      if (
        !old &&
        [
          "blackjack",
          "poker",
          "baccarat",
          "war",
          "threecard",
          "hilo",
          "letitride",
        ].includes(id)
      )
        play("shuffle");
      if (visible && visible !== old?.cards)
        play("card", { delay: old ? 0 : 0.14 });
      if (id === "slots") {
        if (old && reels > old.reels) play("reelStop");
      }
      if (id === "roulette") {
        if (old?.phase === "playing" && g.phase !== "playing")
          play("rouletteDrop");
      }
      if (["craps", "sicbo"].includes(id)) {
        if (g.phase === "rolling" && old?.phase !== "rolling") play("diceRoll");
        if (old?.phase === "rolling" && g.phase !== "rolling") play("diceStop");
      }
      if (g.phase === "bonus" && old?.phase !== "bonus") play("vaultOpen");
      if (old && picks > old.picks && !g.vault.alarm) play("safe");
      if (old && g.vault?.finished && !old.finished)
        play(g.vault.alarm ? "alarm" : "bank", {
          delay: g.vault.alarm ? 0 : 0.15,
        });
      if (g.phase === "risk" && old?.phase !== "risk") play("riskFlip");
      if (old?.phase === "risk" && g.phase === "result")
        play(g.riskCredit ? "win" : "loss");
      if (id === "keno" && g.drawn?.length > (old?.balls || 0))
        play("rouletteDrop");
      games.set(id, {
        balls: g.drawn?.length || 0,
        key,
        cards: visible,
        reels,
        picks,
        finished: !!g.vault?.finished,
        phase: g.phase,
      });
    }
    this.games = games;
  }
}
