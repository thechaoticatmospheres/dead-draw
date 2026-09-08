export const ENEMIES = {
  walker: {
    name: "Drifter",
    hp: 1,
    speed: 1,
    scale: 1,
    damage: 18,
    color: 0x88977a,
  },
  runner: {
    name: "Runner",
    hp: 0.7,
    speed: 2.05,
    scale: 0.9,
    damage: 12,
    color: 0xe8aa64,
  },
  brute: {
    name: "Pit Boss",
    hp: 3.2,
    speed: 0.72,
    scale: 1.3,
    damage: 32,
    color: 0xd76778,
  },
  spitter: {
    name: "Spitter",
    hp: 1.15,
    speed: 0.85,
    scale: 1,
    damage: 14,
    color: 0x9bf18b,
  },
  boss: {
    name: "THE HIGH ROLLER",
    hp: 12,
    speed: 0.8,
    scale: 1.65,
    damage: 38,
    color: 0xffce70,
  },
};
export function enemyType(round, index) {
  if (round % 5 === 0 && index === 0) return "boss";
  if (round >= 3 && index % 7 === 3) return "spitter";
  if (round >= 2 && index % 6 === 2) return "brute";
  if (round >= 2 && index % 3 === 1) return "runner";
  return "walker";
}
export const PERKS = [
  {
    id: "vitality",
    name: "Heart of Gold",
    glyph: "♥",
    detail: "+25 maximum health per rank. Heals 25 on purchase.",
    price: 3,
    max: 3,
    room: "atrium",
  },
  {
    id: "reload",
    name: "Quick Hands",
    glyph: "♣",
    detail: "15% faster reloads per rank.",
    price: 3,
    max: 3,
    room: "emerald",
  },
  {
    id: "magnet",
    name: "Chip Magnet",
    glyph: "◉",
    detail: "+2 m pickup radius per rank. Bring the winnings to you.",
    price: 2,
    max: 2,
    room: "atrium",
  },
  {
    id: "dodge",
    name: "Escape Artist",
    glyph: "↗",
    detail: "Dodge costs 10 less stamina per rank.",
    price: 3,
    max: 2,
    room: "velvet",
  },
  {
    id: "blast",
    name: "Loaded Dice",
    glyph: "♦",
    detail: "+25% grenade damage per rank; carry one extra grenade.",
    price: 4,
    max: 2,
    room: "dice",
  },
  {
    id: "secondWind",
    name: "Second Wind",
    glyph: "✚",
    detail: "One automatic revival per round. Stand up with 60 health.",
    price: 10,
    max: 1,
    room: "crown",
  },
];
export const SUPPLIES = [
  {
    id: "ammo",
    name: "Ammo refill",
    detail: "Two magazines for your current weapon.",
    chips: 35,
    room: "atrium",
  },
  {
    id: "heal",
    name: "First aid",
    detail: "Restore 50 health.",
    chips: 40,
    room: "atrium",
  },
  {
    id: "armor",
    name: "Fresh vest",
    detail: "Refill to 75 armor.",
    chips: 75,
    room: "velvet",
  },
  {
    id: "grenade",
    name: "One more ace",
    detail: "One grenade, up to your carrying limit.",
    chips: 35,
    room: "atrium",
  },
  {
    id: "house",
    name: "House Special SMG",
    detail: "A guaranteed automatic with a full ammo reserve.",
    chips: 250,
    room: "emerald",
  },
  {
    id: "pitViper",
    name: "Pit Viper shotgun",
    detail: "Seven pellets. One shell. Close the distance.",
    chips: 300,
    room: "arcade",
  },
];
export const maxHealth = (p) => 100 + (p.perks?.vitality || 0) * 25;
export const grenadeLimit = (p) => 2 + (p.perks?.blast ? 1 : 0);
export const modPrice = (gun) => [125, 275, 500][gun.level || 0];
export const damageMultiplier = (gun) =>
  (gun.power || 1) * (1 + (gun.level || 0) * 0.3);
export function contractFor(round, count) {
  const types = ["kills", "headshots", "grenadeKills"];
  const kind = types[(round - 1) % types.length];
  const goal = Math.min(
    count,
    kind === "kills"
      ? 6 + round
      : kind === "headshots"
        ? 3 + Math.floor(round / 2)
        : 3,
  );
  return {
    kind,
    title: {
      kills: "Clean Sweep",
      headshots: "Sharp Shooters",
      grenadeKills: "Three of a Kind",
    }[kind],
    detail: {
      kills: "Eliminate the dead",
      headshots: "Land headshot eliminations",
      grenadeKills: "Get grenade eliminations",
    }[kind],
    goal,
    progress: 0,
    complete: false,
    reward: 40 + round * 10,
  };
}
export function oddsProfit(point, bet, amount) {
  const pass =
    point === 4 || point === 10 ? 2 : point === 5 || point === 9 ? 1.5 : 1.2;
  return Math.floor(amount * (bet === "pass" ? pass : 1 / pass) + 1e-8);
}
