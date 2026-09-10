import { deck } from "./casino.js";
import { pokerHand } from "../shared/extra-rules.js";
import {
  HIGH_STAKES,
  SIC_BO_BETS,
  KENO_PAYTABLE,
  RIDE_PAYTABLE,
  rankValue,
  threeCardRank,
  compareThree,
  hiLoQuote,
} from "../shared/high-stakes-rules.js";
const hiddenCard = () => ({ rank: 0, suit: "?" });
export function highStakesCost(s, msg) {
  if (!s.wagers.includes(msg.wager)) return null;
  if (s.id === "sicbo" && !SIC_BO_BETS.some((b) => b[0] === msg.bet))
    return null;
  if (
    s.id === "keno" &&
    (!Array.isArray(msg.picks) ||
      msg.picks.length < 2 ||
      msg.picks.length > 8 ||
      new Set(msg.picks).size !== msg.picks.length ||
      msg.picks.some((n) => !Number.isInteger(n) || n < 1 || n > 80))
  )
    return null;
  return (
    msg.wager *
    (s.id === "letitride"
      ? 3
      : s.id === "threecard" && msg.pairPlus === true
        ? 2
        : 1)
  );
}
export function beginHighStakes(s, msg, rng) {
  const g = {
    kind: s.id,
    wager: msg.wager,
    awards: [],
    deck: deck(rng),
    phase: "dealing",
    remaining: 1.5,
    duration: 1.5,
    returned: 0,
  };
  if (s.id === "war") {
    g.cards = [g.deck.pop()];
    g.dealer = [g.deck.pop()];
  }
  if (s.id === "threecard") {
    g.cards = g.deck.splice(-3);
    g.dealer = g.deck.splice(-3);
    g.pairPlus = msg.pairPlus === true ? msg.wager : 0;
  }
  if (s.id === "letitride") {
    g.cards = g.deck.splice(-3);
    g.community = g.deck.splice(-2);
    g.step = 0;
    g.riding = [true, true, true];
    g.refunded = 0;
  }
  if (s.id === "sicbo") {
    g.bet = msg.bet;
    g.dice = Array.from({ length: 3 }, () => 1 + Math.floor(rng() * 6));
    g.phase = "rolling";
    g.remaining = g.duration = 2.6;
  }
  if (s.id === "keno") {
    g.picks = [...msg.picks].sort((a, b) => a - b);
    const balls = Array.from({ length: 80 }, (_, i) => i + 1);
    for (let i = 79; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [balls[i], balls[j]] = [balls[j], balls[i]];
    }
    g.drawn = balls.slice(0, 20);
    g.phase = "drawing";
    g.remaining = g.duration = 6;
  }
  if (s.id === "hilo") {
    g.cards = [g.deck.pop()];
    g.credit = msg.wager;
    g.streak = 0;
  }
  return g;
}
const decide = (g) => {
  g.phase = "decision";
  g.remaining = null;
};
function finish(g, returned, result, reward) {
  g.returned = Math.max(0, Math.floor(returned));
  g.result = result;
  g.awards = reward ? [{ reward, multiplier: 1 }] : [];
  return true;
}
function resolveThree(g) {
  const rank = threeCardRank(g.cards),
    compare = compareThree(g.cards, g.dealer);
  const qualifies =
    threeCardRank(g.dealer).level > 0 ||
    Math.max(...g.dealer.map(rankValue)) >= 12;
  const base = !qualifies ? 3 : compare > 0 ? 4 : compare === 0 ? 2 : 0;
  const bonus = { 3: 1, 4: 4, 5: 5 }[rank.level] || 0;
  const pairPay = [0, 1, 3, 6, 30, 40][rank.level];
  const returned =
    g.wager * (base + bonus) +
    (rank.level > 0 ? g.pairPlus * (1 + pairPay) : 0);
  return finish(
    g,
    returned,
    `${rank.name} · ${!qualifies ? "DEALER DOES NOT QUALIFY" : compare > 0 ? "YOU WIN" : compare === 0 ? "PUSH" : "DEALER WINS"}`,
    returned > g.cost ? "rifleAmmo" : null,
  );
}
function resolveRide(g) {
  const cards = [...g.cards, ...g.community],
    hand = pokerHand(cards);
  const tens = cards.filter((c) => rankValue(c) === 10).length === 2;
  const name =
    hand.name === "JACKS OR BETTER" || (hand.name === "NO PAYING HAND" && tens)
      ? "TENS OR BETTER"
      : hand.name;
  const odds = RIDE_PAYTABLE.find(([n]) => n === name)?.[1];
  const active = g.riding.filter(Boolean).length;
  return finish(
    g,
    g.refunded + (odds ? active * g.wager * (odds + 1) : 0),
    `${name} · ${active} BET${active === 1 ? "" : "S"} RIDING`,
    odds >= 5 ? "gildedSovereign" : odds ? "rifleAmmo" : null,
  );
}
export function advanceHighStakes(g, rng) {
  if (g.kind === "sicbo") {
    const sum = g.dice.reduce((a, b) => a + b, 0),
      profit = sicBoProfitLocal(g);
    return finish(
      g,
      profit < 0 ? 0 : g.wager * (profit + 1),
      `${g.dice.join(" + ")} = ${sum} · ${profit < 0 ? "NO WIN" : `${profit}:1 WIN`}`,
      profit >= 3 ? "sovereign" : profit > 0 ? "armor" : null,
    );
  }
  if (g.kind === "keno") {
    g.matches = g.picks.filter((n) => g.drawn.includes(n));
    const multiplier = KENO_PAYTABLE[g.picks.length][g.matches.length] || 0;
    return finish(
      g,
      g.wager * multiplier,
      `${g.matches.length} / ${g.picks.length} MATCHED · ${multiplier}× RETURN`,
      multiplier >= 20 ? "gildedHouse" : multiplier > 0 ? "autoAmmo" : null,
    );
  }
  if (g.kind === "war") {
    const compare = rankValue(g.cards.at(-1)) - rankValue(g.dealer.at(-1));
    if (g.war)
      return finish(
        g,
        compare >= 0 ? g.wager * (compare === 0 ? 4 : 3) : 0,
        compare >= 0 ? "WAR WON" : "WAR LOST",
        compare >= 0 ? "rifleAmmo" : null,
      );
    if (!compare) {
      g.tie = true;
      decide(g);
      return false;
    }
    return finish(
      g,
      compare > 0 ? g.wager * 2 : 0,
      compare > 0 ? "YOUR CARD WINS" : "DEALER CARD WINS",
      compare > 0 ? "sideAmmo" : null,
    );
  }
  if (g.kind === "threecard" && g.played) return resolveThree(g);
  if (g.kind === "letitride" && g.step === 2) return resolveRide(g);
  if (g.kind === "hilo" && g.guess) {
    const previous = g.cards.at(-2),
      card = g.cards.at(-1),
      difference = rankValue(card) - rankValue(previous);
    const won = g.guess === "higher" ? difference > 0 : difference < 0;
    if (!won)
      return finish(
        g,
        0,
        difference === 0
          ? "EQUAL RANK · HOUSE WINS"
          : "WRONG CALL · HOUSE WINS",
      );
    g.credit = hiLoQuote(previous, g.guess, g.credit).returned;
    g.streak++;
    g.guess = null;
    if (g.streak >= 5)
      return finish(
        g,
        g.credit,
        "FIVE-CARD STREAK · AUTO BANK",
        "gildedSovereign",
      );
  }
  decide(g);
  return false;
}
// Explicit bet validation occurs before this resolver receives a wager.
import { sicBoProfit } from "../shared/high-stakes-rules.js";
const sicBoProfitLocal = (g) => sicBoProfit(g.dice, g.bet);
export function highStakesDecision(g, p, msg, rng) {
  if (g.phase !== "decision" || g.player !== p.id) return false;
  const choice = msg.choice;
  if (g.kind === "war") {
    if (choice === "surrender")
      return finish(g, g.wager / 2, "SURRENDER · HALF RETURNED");
    if (choice !== "war" || p.chips < g.wager) return false;
    p.chips -= g.wager;
    g.cost += g.wager;
    g.war = true;
    g.deck.splice(-3);
    g.cards.push(g.deck.pop());
    g.dealer.push(g.deck.pop());
  } else if (g.kind === "threecard") {
    if (choice === "fold")
      return finish(g, 0, "FOLDED · ANTE AND PAIR PLUS LOST");
    if (choice !== "play" || p.chips < g.wager) return false;
    p.chips -= g.wager;
    g.cost += g.wager;
    g.played = true;
  } else if (g.kind === "letitride") {
    if (!["ride", "pull"].includes(choice) || g.step >= 2) return false;
    if (choice === "pull") {
      g.riding[g.step] = false;
      g.refunded += g.wager;
    }
    g.step++;
  } else if (g.kind === "hilo") {
    if (choice === "bank" && g.streak > 0)
      return finish(
        g,
        g.credit,
        "BANKED · " + g.streak + " CORRECT",
        g.streak >= 3 ? "sovereign" : "rifleAmmo",
      );
    if (
      !["higher", "lower"].includes(choice) ||
      !hiLoQuote(g.cards.at(-1), choice, g.credit).count
    )
      return false;
    g.guess = choice;
    g.cards.push(deck(rng).pop());
  } else return false;
  g.phase = "revealing";
  g.remaining = g.duration = 1.4;
  return false;
}
export function publicHighStakes(g) {
  const { deck, riskHidden, vaultHidden, ...safe } = g;
  const result = g.phase === "result" || g.paid;
  // Never expose future cards, dealer information, dice or drawn balls before their reveal.
  if (!result) {
    delete safe.returned;
    delete safe.result;
    delete safe.awards;
  }
  if (g.kind === "keno") {
    safe.drawn = result
      ? g.drawn
      : g.drawn.slice(0, Math.floor((g.duration - g.remaining) / 0.3));
    delete safe.matches;
    if (result) safe.matches = g.matches;
  }
  if (g.kind === "sicbo" && !result) safe.dice = [];
  if (g.cards)
    safe.cards = g.cards.map((c, i) =>
      g.phase === "dealing" ||
      (g.phase === "revealing" &&
        ["hilo", "war"].includes(g.kind) &&
        i === g.cards.length - 1)
        ? hiddenCard()
        : c,
    );
  if (g.dealer)
    safe.dealer = g.dealer.map((c, i) =>
      result ||
      (g.kind === "war" && g.phase === "decision") ||
      (g.kind === "war" && i < g.dealer.length - 1)
        ? c
        : hiddenCard(),
    );
  if (g.community)
    safe.community = g.community.map((c, i) =>
      result ||
      i <
        (g.phase === "revealing"
          ? g.step - 1
          : g.phase === "decision"
            ? g.step
            : 0)
        ? c
        : hiddenCard(),
    );
  return safe;
}
export const highStakesMethods = {
  tableChoice(p, msg) {
    const g = this.hand(p, msg.station);
    if (
      this.phase !== "break" ||
      !g ||
      !HIGH_STAKES.includes(g.kind) ||
      g.player !== p.id ||
      p.down
    )
      return;
    const before = g.cost;
    const complete = highStakesDecision(g, p, msg, this.rng);
    if (g.cost > before) this.recordWager(p, g.cost - before);
    if (complete) this.payTable(g);
    if (complete || g.phase === "revealing")
      this.event("card", { player: p.id, station: g.station });
  },
};
