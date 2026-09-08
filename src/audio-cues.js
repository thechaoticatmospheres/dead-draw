const tone = (freq, duration, gain, at = 0, extra = {}) => ({
  freq,
  duration,
  gain,
  at,
  ...extra,
});
const noise = (duration, gain, cutoff, at = 0, extra = {}) => ({
  noise: true,
  duration,
  gain,
  cutoff,
  at,
  ...extra,
});
const metal = (freq = 1900, at = 0, gain = 0.035) => [
  tone(freq, 0.09, gain, at),
  tone(freq * 1.48, 0.055, gain * 0.4, at),
  noise(0.02, gain, 6000, at),
];
const melody = (notes, gap = 0.12, gain = 0.09) =>
  notes.flatMap((f, i) => [
    tone(f, 0.4, gain, i * gap, { type: "triangle", variation: 0 }),
    tone(f * 2, 0.25, gain * 0.15, i * gap, { variation: 0 }),
  ]);
const casino = (layers) => ({ layers, bus: "casino", wet: 0.1 });
export const CUE_NAMES = [
  "shot",
  "impact",
  "headshot",
  "hit",
  "reload",
  "reloadEnd",
  "switch",
  "empty",
  "step",
  "dodge",
  "throw",
  "explosion",
  "hurt",
  "armor",
  "down",
  "revive",
  "heartbeat",
  "enemy",
  "death",
  "warnSlam",
  "warnAcid",
  "slam",
  "acid",
  "boss",
  "chips",
  "wager",
  "card",
  "shuffle",
  "hold",
  "slotMotor",
  "reelStop",
  "rouletteTick",
  "rouletteDrop",
  "diceRoll",
  "diceStop",
  "win",
  "jackpot",
  "loss",
  "push",
  "vaultOpen",
  "safe",
  "alarm",
  "bank",
  "riskFlip",
  "door",
  "pickup",
  "upgrade",
  "ready",
  "round",
  "clear",
  "over",
  "contract",
  "ui",
  "focus",
  "room",
  "neon",
];
export function soundCue(
  name,
  { weapon = "courtesy", kind = "walker", hard = true, round = 1 } = {},
) {
  switch (name) {
    case "shot": {
      const [body, length, brightness, power] = {
        courtesy: [145, 0.13, 4200, 0.2],
        velvet: [100, 0.22, 3100, 0.29],
        switch: [180, 0.085, 5600, 0.13],
        house: [165, 0.1, 4400, 0.15],
        dividend: [125, 0.17, 6200, 0.21],
        sovereign: [82, 0.25, 3500, 0.28],
        pitViper: [68, 0.34, 2200, 0.37],
      }[weapon] || [145, 0.13, 4200, 0.2];
      return {
        priority: 2,
        wet: 0.15,
        layers: [
          noise(0.022, power, 8500),
          noise(length, power, brightness, 0.005, { toCutoff: 450 }),
          tone(body, length, power * 0.8, 0, { end: 38, type: "triangle" }),
          ...metal(2300, 0.08, 0.018),
        ],
      };
    }
    case "impact":
      return {
        layers: [noise(0.06, 0.11, 1800), ...metal(820, 0.008, 0.014)],
        cooldown: 0.045,
      };
    case "hit":
      return {
        layers: [noise(0.08, 0.1, 700), tone(210, 0.05, 0.05)],
        cooldown: 0.045,
      };
    case "headshot":
      return {
        layers: [
          noise(0.06, 0.1, 1100),
          tone(1450, 0.065, 0.045),
          tone(2175, 0.09, 0.025, 0.015),
        ],
        priority: 2,
        cooldown: 0.05,
      };
    case "reload":
      return {
        layers: [
          noise(0.12, 0.09, 1600),
          ...metal(1300, 0.03, 0.045),
          noise(0.22, 0.04, 850, 0.14),
        ],
        cooldown: 0.3,
      };
    case "reloadEnd":
      return {
        layers: [...metal(850, 0, 0.07), noise(0.045, 0.13, 2600, 0.065)],
        priority: 2,
      };
    case "switch":
      return {
        layers: [noise(0.19, 0.07, 1800), ...metal(980, 0.1, 0.04)],
        cooldown: 0.15,
      };
    case "empty":
      return { layers: metal(650, 0, 0.06), cooldown: 0.35 };
    case "step":
      return {
        layers: [
          noise(0.11, hard ? 0.08 : 0.045, hard ? 1500 : 550),
          tone(hard ? 105 : 72, 0.075, 0.055),
          ...(hard ? [noise(0.025, 0.025, 3800, 0.035)] : []),
        ],
        wet: 0.04,
      };
    case "dodge":
      return {
        layers: [
          noise(0.28, 0.17, 1800, 0, { attack: 0.035, toCutoff: 300 }),
          noise(0.12, 0.08, 650, 0.2),
        ],
        cooldown: 0.2,
      };
    case "throw":
      return {
        layers: [...metal(2700, 0, 0.04), noise(0.22, 0.12, 1200, 0.07)],
        cooldown: 0.3,
      };
    case "explosion":
      return {
        layers: [
          noise(0.085, 0.4, 3600),
          noise(0.9, 0.42, 650, 0.025, { toCutoff: 95 }),
          tone(95, 0.7, 0.35, 0, { end: 24 }),
        ],
        wet: 0.26,
        priority: 2,
        cooldown: 0.04,
      };
    case "hurt":
      return {
        layers: [
          noise(0.14, 0.17, 850),
          tone(85, 0.2, 0.1, 0, { end: 42, type: "triangle" }),
        ],
        priority: 2,
        cooldown: 0.1,
      };
    case "armor":
      return {
        layers: [noise(0.11, 0.14, 2700), ...metal(580, 0, 0.055)],
        priority: 2,
        cooldown: 0.1,
      };
    case "down":
      return {
        layers: [
          tone(150, 0.9, 0.2, 0, { end: 35, type: "triangle" }),
          noise(0.55, 0.1, 500),
        ],
        priority: 2,
      };
    case "revive":
      return { layers: melody([220, 330, 440, 660], 0.14, 0.07), priority: 2 };
    case "heartbeat":
      return {
        layers: [tone(58, 0.14, 0.2), tone(48, 0.19, 0.14, 0.2)],
        wet: 0,
        priority: 2,
        cooldown: 0.85,
      };
    case "enemy": {
      const f =
        kind === "boss"
          ? 42
          : kind === "brute"
            ? 56
            : kind === "runner"
              ? 128
              : kind === "spitter"
                ? 155
                : 78;
      return {
        layers: [
          tone(f, 0.85, 0.11, 0, {
            type: "sawtooth",
            end: f * 0.66,
            filter: "bandpass",
            cutoff: kind === "spitter" ? 1000 : 420,
            q: 3,
            attack: 0.08,
          }),
          tone(f * 1.07, 0.75, 0.08, 0.06, {
            type: "sawtooth",
            end: f * 0.6,
            cutoff: 650,
            attack: 0.05,
          }),
          noise(0.65, 0.1, 650, 0.04, {
            filter: "bandpass",
            q: 2,
            attack: 0.08,
          }),
        ],
        wet: 0.18,
        cooldown: 0.9,
      };
    }
    case "death":
      return {
        layers: [
          noise(0.25, 0.13, 750),
          tone(kind === "boss" ? 50 : 130, 0.3, 0.07, 0, {
            type: "sawtooth",
            end: 32,
            cutoff: 420,
          }),
        ],
        cooldown: 0.08,
      };
    case "warnSlam":
      return {
        layers: [
          tone(72, 0.75, 0.2, 0, {
            type: "sawtooth",
            end: 180,
            cutoff: 700,
            attack: 0.1,
          }),
          noise(0.7, 0.08, 550, 0, { attack: 0.1, toCutoff: 1800 }),
        ],
        priority: 2,
        cooldown: 0.3,
      };
    case "warnAcid":
      return {
        layers: [
          noise(0.55, 0.18, 1800, 0, {
            filter: "bandpass",
            q: 2,
            attack: 0.07,
          }),
          tone(210, 0.3, 0.06, 0, { end: 90, type: "triangle" }),
        ],
        priority: 2,
        cooldown: 0.25,
      };
    case "slam":
      return {
        layers: [noise(0.5, 0.27, 720), tone(70, 0.4, 0.27, 0, { end: 26 })],
        priority: 2,
        wet: 0.2,
        cooldown: 0.12,
      };
    case "acid":
      return {
        layers: [
          noise(0.6, 0.15, 2300, 0, { filter: "bandpass", q: 1.5 }),
          tone(390, 0.12, 0.025, 0, { end: 85 }),
        ],
        cooldown: 0.3,
      };
    case "boss":
      return {
        layers: [
          tone(45, 1.6, 0.18, 0, {
            type: "sawtooth",
            cutoff: 320,
            attack: 0.15,
          }),
          tone(68, 1.4, 0.12, 0.2, { type: "sawtooth", cutoff: 450 }),
          ...melody([110, 116, 82], 0.32, 0.08),
        ],
        priority: 2,
        wet: 0.3,
      };
    case "chips":
      return {
        ...casino([
          ...metal(1900),
          ...metal(2700, 0.037, 0.022),
          ...metal(1450, 0.08, 0.017),
        ]),
        cooldown: 0.075,
      };
    case "wager":
      return casino([
        noise(0.1, 0.055, 2500),
        ...metal(1500, 0, 0.035),
        ...metal(2050, 0.065, 0.04),
        ...metal(2800, 0.13, 0.03),
      ]);
    case "card":
      return {
        ...casino([
          noise(0.1, 0.07, 3600, 0, { filter: "highpass", attack: 0.012 }),
          noise(0.035, 0.05, 1300, 0.08),
        ]),
        cooldown: 0.055,
      };
    case "shuffle":
      return casino(
        Array.from({ length: 6 }, (_, i) =>
          noise(0.045, 0.045, 3000, i * 0.055, { filter: "bandpass" }),
        ),
      );
    case "hold":
      return casino([
        tone(880, 0.07, 0.045, 0, { type: "triangle" }),
        noise(0.04, 0.025, 1500),
      ]);
    case "slotMotor":
      return {
        ...casino([
          noise(0.18, 0.045, 700, 0, {
            filter: "bandpass",
            q: 2,
            attack: 0.025,
          }),
          tone(120, 0.16, 0.024, 0, { type: "triangle" }),
        ]),
        cooldown: 0.12,
        wet: 0,
      };
    case "reelStop":
      return casino([
        ...metal(760, 0, 0.065),
        tone(440, 0.13, 0.06),
        noise(0.07, 0.09, 1200),
      ]);
    case "rouletteTick":
      return {
        ...casino([noise(0.016, 0.04, 4300), tone(1300, 0.025, 0.022)]),
        cooldown: 0.045,
        wet: 0.025,
      };
    case "rouletteDrop":
      return casino([
        noise(0.025, 0.08, 2600),
        ...metal(1600, 0.08, 0.035),
        ...metal(1200, 0.19, 0.025),
      ]);
    case "diceRoll":
      return casino(
        Array.from({ length: 8 }, (_, i) => [
          noise(0.028, 0.05 * (1 - i * 0.065), 2100, i * 0.11),
          tone(600 + i * 87, 0.025, 0.018, i * 0.11),
        ]).flat(),
      );
    case "diceStop":
      return casino([
        noise(0.035, 0.085, 1400),
        noise(0.035, 0.07, 1900, 0.075),
      ]);
    case "win":
      return {
        ...casino(melody([440, 554, 659, 880], 0.1, 0.085)),
        priority: 2,
      };
    case "jackpot":
      return {
        ...casino([
          ...melody([440, 554, 659, 880, 1108, 1318, 1760], 0.13, 0.1),
          ...Array.from({ length: 8 }, (_, i) =>
            metal(1800 + i * 120, 0.75 + i * 0.09, 0.025),
          ).flat(),
        ]),
        priority: 2,
      };
    case "loss":
      return casino([
        tone(220, 0.35, 0.055, 0, { type: "triangle", end: 145 }),
        tone(165, 0.3, 0.04, 0.1, { end: 110 }),
      ]);
    case "push":
      return casino(melody([440, 440], 0.13, 0.04));
    case "vaultOpen":
      return casino([
        noise(0.9, 0.12, 500, 0, { attack: 0.1 }),
        ...metal(340, 0.15, 0.07),
        ...melody([330, 440, 660], 0.15, 0.06),
      ]);
    case "safe":
      return casino([
        ...metal(700, 0, 0.09),
        noise(0.18, 0.06, 500, 0.12),
        ...metal(2200, 0.22, 0.04),
      ]);
    case "alarm":
      return {
        ...casino(
          Array.from({ length: 4 }, (_, i) =>
            tone(i % 2 ? 630 : 840, 0.24, 0.085, i * 0.21, {
              type: "triangle",
              variation: 0,
            }),
          ),
        ),
        priority: 2,
        wet: 0.16,
      };
    case "bank":
      return casino([
        ...metal(1800, 0, 0.055),
        ...metal(2400, 0.08, 0.05),
        ...melody([660, 880, 1320], 0.1, 0.065),
      ]);
    case "riskFlip":
      return casino([
        noise(0.13, 0.08, 3500, 0, { filter: "highpass" }),
        tone(330, 0.85, 0.035, 0, { end: 660, type: "triangle", attack: 0.15 }),
      ]);
    case "door":
      return {
        layers: [
          noise(1.4, 0.13, 900, 0, { attack: 0.1, toCutoff: 250 }),
          tone(65, 1.2, 0.065, 0, {
            type: "sawtooth",
            cutoff: 280,
            attack: 0.1,
          }),
          ...metal(430, 1.05, 0.08),
        ],
        wet: 0.2,
      };
    case "pickup":
      return {
        layers: [...metal(1800, 0, 0.025), ...melody([660, 990], 0.09, 0.05)],
        cooldown: 0.1,
      };
    case "upgrade":
      return {
        layers: [
          ...metal(680, 0, 0.06),
          ...melody([330, 440, 554, 880], 0.1, 0.065),
        ],
      };
    case "ready":
      return { layers: melody([330, 660], 0.09, 0.04) };
    case "round":
      return {
        layers: melody(
          round % 5 === 0 ? [110, 116, 82] : [110, 146, 165],
          0.25,
          0.14,
        ),
        priority: 2,
        wet: 0.25,
      };
    case "clear":
      return {
        layers: melody([330, 440, 554, 660, 880], 0.16, 0.09),
        priority: 2,
      };
    case "over":
      return { layers: melody([220, 196, 146, 110], 0.27, 0.1), priority: 2 };
    case "contract":
      return { layers: melody([660, 880, 1108], 0.12, 0.075), priority: 2 };
    case "ui":
      return {
        layers: [noise(0.025, 0.028, 2400), tone(780, 0.045, 0.022)],
        wet: 0,
        cooldown: 0.07,
      };
    case "focus":
      return { layers: [tone(650, 0.025, 0.012)], wet: 0, cooldown: 0.1 };
    case "room":
      return {
        bus: "ambience",
        layers: [
          noise(2.4, 0.065, 260, 0, { attack: 0.5 }),
          tone(60, 2.4, 0.028, 0, { attack: 0.5, variation: 0 }),
          tone(120, 2.4, 0.009, 0, { attack: 0.5, variation: 0 }),
        ],
        wet: 0.08,
        cooldown: 1.8,
      };
    case "neon":
      return {
        bus: "ambience",
        layers: [
          noise(0.13, 0.025, 2800, 0, { filter: "bandpass", q: 3 }),
          tone(240, 0.13, 0.013, 0, { type: "sawtooth", cutoff: 600 }),
        ],
        wet: 0.12,
        cooldown: 4,
      };
    default:
      return null;
  }
}
