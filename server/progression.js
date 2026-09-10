import {
  PERKS,
  SUPPLIES,
  maxHealth,
  grenadeLimit,
  modPrice,
} from "../shared/expansion.js";
import { WEAPONS } from "../shared/data.js";
import { giveReward } from "./casino.js";
import {
  ATTACHMENTS,
  attachmentFits,
  gunStats,
} from "../shared/attachments.js";
export const playerProgression = () => ({
  perks: {},
  comps: 0,
  wagered: 0,
  ledger: [],
  casinoNet: 0,
  vaultSpins: 0,
  stamina: 100,
  dodgeTime: 0,
  grenadeCooldown: 0,
  grenades: 2,
  headshots: 0,
  combo: 0,
  comboUntil: 0,
  bestCombo: 0,
  secondWindUsed: false,
});
export const progressionMethods = {
  attach(p, id) {
    if (this.busy(p.id)) return;
    if (
      this.phase !== "break" ||
      p.down ||
      p.reload ||
      Object.values(this.games).some(
        (g) => g.player === p.id && g.phase !== "result",
      )
    )
      return;
    const item = ATTACHMENTS.find((a) => a.id === id),
      gun = p.guns[p.selected];
    if (
      !item ||
      !attachmentFits(item, WEAPONS[gun.id]) ||
      !this.openRooms.includes(item.room)
    )
      return;
    const owned = gun.ownedAttachments || [];
    if (!owned.includes(id)) {
      if (p.chips < item.cost) return;
      p.chips -= item.cost;
      gun.ownedAttachments = [...owned, id];
    }
    gun.attachments ||= {};
    gun.attachments[item.slot] = gun.attachments[item.slot] === id ? null : id;
    this.clearReady();
    this.event("purchase", {
      player: p.id,
      text: `${item.name} ${gun.attachments[item.slot] ? "equipped" : "removed"}`,
    });
  },
  buy(p, id) {
    if (this.busy(p.id)) return;
    if (
      this.phase !== "break" ||
      p.down ||
      Object.values(this.games).some(
        (g) => g.player === p.id && g.phase !== "result",
      )
    )
      return;
    const perk = PERKS.find((v) => v.id === id),
      item = SUPPLIES.find((v) => v.id === id),
      gun = p.guns[p.selected];
    if (perk) {
      const rank = p.perks[id] || 0,
        cost = perk.price * (rank + 1);
      if (
        rank >= perk.max ||
        p.comps < cost ||
        !this.openRooms.includes(perk.room)
      )
        return;
      p.comps -= cost;
      p.perks[id] = rank + 1;
      if (id === "vitality") p.hp = Math.min(maxHealth(p), p.hp + 25);
      if (id === "blast")
        p.grenades = Math.min(grenadeLimit(p), p.grenades + 1);
    } else if (id === "upgrade") {
      const price = modPrice(gun);
      if (!price || p.chips < price) return;
      p.chips -= price;
      gun.level = (gun.level || 0) + 1;
    } else if (item) {
      if (p.chips < item.chips || !this.openRooms.includes(item.room)) return;
      if (
        (id === "ammo" && WEAPONS[gun.id].melee) ||
        (id === "heal" && p.hp >= maxHealth(p)) ||
        (id === "armor" && p.armor >= 75) ||
        (id === "grenade" && p.grenades >= grenadeLimit(p))
      )
        return;
      if (["house", "pitViper"].includes(id) && p.guns.some((g) => g.id === id))
        return;
      p.chips -= item.chips;
      if (id === "ammo")
        gun.reserve += Math.ceil(
          gunStats(WEAPONS[gun.id], gun).mag *
            2 *
            (1 + (p.perks.scavenger || 0) * 0.25),
        );
      else if (id === "heal") p.hp = Math.min(maxHealth(p), p.hp + 50);
      else if (id === "armor") p.armor = 75;
      else if (id === "grenade") p.grenades++;
      else giveReward(p, id);
    } else return;
    this.clearReady();
    this.event("purchase", {
      player: p.id,
      text:
        perk?.name ||
        item?.name ||
        `${WEAPONS[gun.id].name} upgraded to rank ${gun.level}`,
    });
  },
  recordWager(p, amount) {
    const before = Math.floor(p.wagered / 50);
    p.wagered += amount;
    p.comps += Math.floor(p.wagered / 50) - before;
  },
  recordHand(p, g, net) {
    p.handsPlayed = (p.handsPlayed || 0) + 1;
    p.casinoNet += net;
    p.ledger.unshift({
      id: ++this.serial,
      station: g.station,
      result: g.result,
      net,
    });
    p.ledger = p.ledger.slice(0, 12);
  },
  progressContract(kind) {
    const c = this.contract;
    if (!c || c.complete || c.kind !== kind) return;
    c.progress = Math.min(c.goal, c.progress + 1);
    if (c.progress === c.goal) {
      c.complete = true;
      this.event("contract", {
        text: `${c.title} complete · ${c.reward} chips + 1 comp per survivor at the break.`,
      });
    }
  },
};
