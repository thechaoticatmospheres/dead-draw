import { REWARDS, WEAPONS } from "../shared/data.js";
export function deck(rng = Math.random) {
  const cards = Array.from({ length: 52 }, (_, i) => ({
    rank: (i % 13) + 1,
    suit: ["♠", "♥", "♦", "♣"][Math.floor(i / 13)],
  }));
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function giveReward(p, key, multiplier = 1) {
  const r = REWARDS[key];
  if (!r) return;
  p.chips += (r.chips || 0) * multiplier;
  if (r.armor) p.armor = Math.max(p.armor || 0, r.armor);
  if (r.ammo) {
    p.stash[r.ammo] = (p.stash[r.ammo] || 0) + r.amount * multiplier;
    for (const gun of p.guns) {
      if (WEAPONS[gun.id].category === r.ammo) {
        gun.reserve += p.stash[r.ammo];
        p.stash[r.ammo] = 0;
        break;
      }
    }
  }
  if (r.weapon) {
    const w = WEAPONS[r.weapon];
    let gun = p.guns.find((g) => g.id === r.weapon);
    if (gun) {
      gun.reserve += w.reserve * multiplier;
      gun.power = Math.max(gun.power, r.power || 1);
    } else {
      gun = {
        id: r.weapon,
        ammo: w.mag,
        reserve: w.reserve * multiplier + (p.stash[w.category] || 0),
        power: r.power || 1,
      };
      p.stash[w.category] = 0;
      p.guns.push(gun);
    }
    p.selected = p.guns.indexOf(gun);
    p.reload = 0;
  }
}
