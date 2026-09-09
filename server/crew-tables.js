import { STATIONS } from "../shared/data.js";
import { roomAt, clearPath } from "../shared/map.js";
import { deck } from "./casino.js";
import {
  spinRoulette,
  validateBets,
  playHand,
  settleBlackjack,
} from "./table-games.js";
import { dealBaccarat } from "./extra-games.js";
import { score, betInfo } from "../shared/casino-rules.js";
export const CREW_GAMES = ["roulette", "blackjack", "baccarat", "craps"];
const hidden = () => ({ rank: 0, suit: "?" });
const total = (s) => (s.bets || []).reduce((n, b) => n + b.amount, 0);
const payout = (game, t, s, returned, result, awards = []) => {
  game.payTable({
    station: t.id,
    player: s.player,
    cost: s.cost,
    returned,
    result,
    awards,
    pocket: t.pocket,
    shared: true,
  });
  s.returned = returned;
  s.result = result;
  s.settled = true;
};
function rollDice(game, t) {
  for (const s of Object.values(t.seats))
    for (const b of s.bets)
      if (!b.recorded && (!b.key.startsWith("place:") || t.point)) {
        game.recordWager(game.players[s.player], b.amount);
        b.recorded = true;
      }
  t.dice = [1 + Math.floor(game.rng() * 6), 1 + Math.floor(game.rng() * 6)];
  t.phase = "rolling";
  t.remaining = 1.8;
  game.event("wager", { player: t.shooter, station: "craps", cost: 0 });
}
function resolveDice(game, t) {
  const n = t.dice[0] + t.dice[1],
    point = t.point;
  t.rolls.unshift(n);
  t.rolls = t.rolls.slice(0, 12);
  for (const s of Object.values(t.seats)) {
    const keep = [];
    for (const b of s.bets) {
      let result = null,
        returned = 0;
      if (b.key.startsWith("place:")) {
        const number = +b.key.slice(6);
        if (n === 7 && point) {
          result = "PLACE BET LOST";
        } else if (point && n === number) {
          const odds = [4, 10].includes(number)
            ? 9 / 5
            : [5, 9].includes(number)
              ? 7 / 5
              : 7 / 6;
          const profit = Math.floor(b.amount * odds);
          game.players[s.player].chips += profit;
          game.recordHand(
            game.players[s.player],
            { station: "craps", result: `PLACE ${number} WIN` },
            profit,
          );
          s.returned = (s.returned || 0) + profit;
          s.result = `PLACE ${number} WIN`;
          game.event("payout", {
            player: s.player,
            station: "craps",
            reward: "dud",
            result: s.result,
            returned: profit,
          });
          keep.push(b);
          continue;
        } else {
          keep.push(b);
          continue;
        }
      } else if (b.key === "come") {
        if (!b.point) {
          if ([7, 11].includes(n)) {
            returned = b.amount * 2;
            result = "COME WINS";
          } else if ([2, 3, 12].includes(n)) {
            result = "COME LOSES";
          } else {
            b.point = n;
            keep.push(b);
            continue;
          }
        } else if (n === b.point) {
          returned = b.amount * 2;
          result = "COME POINT WINS";
        } else if (n === 7) {
          result = "COME SEVEN OUT";
        } else {
          keep.push(b);
          continue;
        }
      } else {
        const win = !point ? [7, 11].includes(n) : n === point,
          lose = !point ? [2, 3, 12].includes(n) : n === 7;
        if (!win && !lose) {
          keep.push(b);
          continue;
        }
        returned =
          b.key === "dont"
            ? n === 12 && !point
              ? b.amount
              : lose
                ? b.amount * 2
                : 0
            : win
              ? b.amount * 2
              : 0;
        result =
          returned > b.amount
            ? "LINE WINS"
            : returned
              ? "LINE PUSH"
              : "LINE LOSES";
      }
      game.players[s.player].chips += returned;
      if (returned > b.amount)
        game.players[s.player].armor = Math.max(
          game.players[s.player].armor || 0,
          75,
        );
      game.event("payout", {
        player: s.player,
        station: "craps",
        reward: returned > b.amount ? "armor" : "dud",
        result,
        returned,
      });
      game.recordHand(
        game.players[s.player],
        { station: "craps", result },
        returned - b.amount,
      );
      s.returned = (s.returned || 0) + returned;
      s.result = result;
    }
    s.bets = keep;
    s.cost = total(s);
    s.ready = false;
  }
  if (!point && ![2, 3, 7, 11, 12].includes(n)) t.point = n;
  if (point && (n === 7 || n === point)) t.point = 0;
  if (point && n === 7) {
    const ids = Object.keys(t.seats);
    t.shooter = ids[(ids.indexOf(t.shooter) + 1) % ids.length];
  }
  t.phase = "betting";
  t.remaining = null;
  game.event("notice", {
    text: `CREW CRAPS · ${t.dice.join(" + ")} = ${n}${point && n === 7 ? " · SEVEN OUT · NEXT SHOOTER" : ""}`,
  });
}
function start(game, t) {
  t.phase = "rolling";
  t.remaining = t.id === "roulette" ? 5 : 2;
  t.startedAt = game.time;
  const seats = Object.values(t.seats);
  for (const s of seats) game.recordWager(game.players[s.player], s.cost);
  if (t.id === "roulette") {
    const pocket = Math.floor(game.rng() * 37);
    t.outcomes = Object.fromEntries(
      seats.map((s) => [s.player, spinRoulette(s.bets, () => pocket / 37)]),
    );
  }
  if (t.id === "baccarat") {
    const hand = dealBaccarat("player", 20, game.rng);
    t.baccarat = hand;
    for (const s of seats) {
      const bet = s.bet,
        won = bet === hand.winner,
        push = hand.winner === "tie" && bet !== "tie";
      s.outcome = {
        returned: won
          ? Math.round(
              s.cost * (bet === "tie" ? 9 : bet === "banker" ? 1.95 : 2),
            )
          : push
            ? s.cost
            : 0,
        result: push ? "TIE · PUSH" : won ? "YOU WIN" : "HOUSE WINS",
        awards: won
          ? [
              {
                reward:
                  bet === "tie"
                    ? "gildedSovereign"
                    : s.cost >= 100
                      ? "sovereign"
                      : "rifleAmmo",
                multiplier: 1,
              },
            ]
          : [],
      };
    }
  }
  if (t.id === "blackjack") {
    t.shoe = deck(game.rng);
    t.dealer = [t.shoe.pop(), t.shoe.pop()];
    for (const s of seats) {
      s.hand = {
        player: s.player,
        station: "blackjack",
        cost: s.cost,
        deck: t.shoe,
        dealer: t.dealer,
        hands: [
          {
            cards: [t.shoe.pop(), t.shoe.pop()],
            bet: s.cost,
            status: "playing",
            split: false,
          },
        ],
        activeHand: 0,
        phase: "decision",
        remaining: null,
      };
    }
  }
  game.event("wager", { player: seats[0].player, station: t.id, cost: 0 });
}
export const crewTableMethods = {
  crewTable(p, msg) {
    if (
      !["seat", "bet", "clear", "ready", "roll", "card", "leave"].includes(
        msg.choice,
      )
    )
      return;
    if (
      this.games[msg.station]?.phase &&
      this.games[msg.station].phase !== "result"
    )
      return;
    if (
      this.phase !== "break" ||
      p.down ||
      p.offline ||
      !CREW_GAMES.includes(msg.station)
    )
      return;
    const station = STATIONS.find((s) => s.id === msg.station);
    if (
      roomAt(p)?.id !== station.room ||
      !this.openRooms.includes(station.room) ||
      Math.hypot(p.x - station.x, p.z - station.z) > station.r + 2.4 ||
      !clearPath(p, station, this.openRooms)
    )
      return;
    let t = this.crewTables[station.id];
    if (!t)
      t = this.crewTables[station.id] = {
        id: station.id,
        phase: "betting",
        seats: {},
        point: 0,
        rolls: [],
        dice: [],
        remaining: null,
      };
    let s = t.seats[p.id];
    if (msg.choice === "leave") {
      if (!s) return;
      if (
        t.phase === "result" ||
        (t.phase === "betting" &&
          (!s.cost ||
            t.id !== "craps" ||
            s.bets.every((b) => b.key.startsWith("place:"))))
      ) {
        if (t.phase === "betting") p.chips += s.cost;
        delete t.seats[p.id];
        for (const seat of Object.values(t.seats)) seat.ready = false;
        if (t.shooter === p.id) t.shooter = Object.keys(t.seats)[0];
        if (!Object.keys(t.seats).length) delete this.crewTables[t.id];
      }
      return;
    }
    if (!s) {
      if (
        t.phase !== "betting" ||
        Object.keys(t.seats).length >= 4 ||
        this.busy(p.id)
      )
        return;
      s = t.seats[p.id] = {
        player: p.id,
        name: p.name,
        cost: 0,
        bets: [],
        ready: false,
      };
      t.shooter ||= p.id;
    }
    if (msg.choice === "bet" && t.phase === "betting") {
      const amount = msg.amount;
      if (
        !Number.isInteger(amount) ||
        amount < 10 ||
        amount > 500 ||
        amount % 5 ||
        p.chips < amount ||
        s.cost + amount > 1000
      )
        return;
      if (t.id === "roulette") {
        const bets = s.bets.map((b) => ({ ...b })),
          b = bets.find((b) => b.key === msg.bet);
        if (b) b.amount += amount;
        else bets.push({ key: msg.bet, amount });
        if (validateBets(bets, p.chips + s.cost) === null) return;
        s.bets = bets;
      } else if (t.id === "craps") {
        if (
          ![
            "pass",
            "dont",
            "come",
            "place:4",
            "place:5",
            "place:6",
            "place:8",
            "place:9",
            "place:10",
          ].includes(msg.bet) ||
          amount % 30 ||
          (t.point && ["pass", "dont"].includes(msg.bet)) ||
          (!t.point && msg.bet === "come") ||
          s.bets.length >= 12
        )
          return;
        s.bets.push({ key: msg.bet, amount, point: 0 });
      } else {
        if (
          s.cost ||
          (t.id === "baccarat" &&
            !["player", "banker", "tie"].includes(msg.bet)) ||
          (t.id === "blackjack" && ![50, 100, 200].includes(amount))
        )
          return;
        s.bet = msg.bet;
      }
      p.chips -= amount;
      s.cost += amount;
      for (const seat of Object.values(t.seats)) seat.ready = false;
      this.clearReady();
    }
    if (msg.choice === "clear" && t.phase === "betting") {
      if (t.id === "craps") {
        const removable = s.bets.filter((b) => b.key.startsWith("place:"));
        p.chips += removable.reduce((n, b) => n + b.amount, 0);
        s.bets = s.bets.filter((b) => !b.key.startsWith("place:"));
        s.cost = total(s);
      } else {
        p.chips += s.cost;
        s.cost = 0;
        s.bets = [];
      }
      s.ready = false;
    }
    if (msg.choice === "ready" && t.phase === "betting" && s.cost) {
      s.ready = !s.ready;
      if (
        t.id !== "craps" &&
        Object.values(t.seats).every((s) => s.cost > 0 && s.ready)
      )
        start(this, t);
    }
    if (
      msg.choice === "roll" &&
      t.id === "craps" &&
      t.phase === "betting" &&
      t.shooter === p.id &&
      Object.values(t.seats).some((s) => s.cost)
    )
      rollDice(this, t);
    if (
      msg.choice === "card" &&
      t.id === "blackjack" &&
      t.phase === "decision" &&
      s.hand
    ) {
      const before = s.hand.cost;
      if (playHand(s.hand, msg.action, p)) {
        s.cost = s.hand.cost;
        if (s.cost > before) this.recordWager(p, s.cost - before);
      }
    }
  },
  updateCrewTables(dt) {
    for (const t of Object.values(this.crewTables)) {
      // Disconnected players never hold a shared dealer hostage.
      for (const s of Object.values(t.seats))
        if (!this.players[s.player]) delete t.seats[s.player];
        else if (
          this.players[s.player].offline &&
          t.phase === "betting" &&
          (t.id !== "craps" || !s.cost)
        ) {
          this.players[s.player].chips += s.cost;
          delete t.seats[s.player];
          for (const seat of Object.values(t.seats)) seat.ready = false;
        }
      if (
        t.id === "craps" &&
        (this.players[t.shooter]?.offline || !t.seats[t.shooter])
      ) {
        t.shooter = Object.keys(t.seats).find(
          (id) => !this.players[id]?.offline,
        );
      }
      if (!Object.keys(t.seats).length) {
        delete this.crewTables[t.id];
        continue;
      }
      if (t.id === "blackjack" && t.phase === "decision") {
        for (const s of Object.values(t.seats))
          if (this.players[s.player]?.offline && s.hand?.phase === "decision") {
            for (const h of s.hand.hands)
              if (h.status === "playing") h.status = "stood";
            s.hand.phase = "dealer";
          }
        if (Object.values(t.seats).every((s) => s.hand.phase !== "decision")) {
          t.phase = "dealer";
          t.remaining = 0.7;
        }
      }
      if (t.remaining === null) continue;
      t.remaining -= dt;
      if (t.remaining > 0) continue;
      if (t.id === "craps") {
        resolveDice(this, t);
        continue;
      }
      if (t.id === "blackjack") {
        if (t.phase === "rolling") {
          t.phase = "decision";
          t.remaining = null;
          for (const s of Object.values(t.seats))
            if (score(t.dealer) === 21 || score(s.hand.hands[0].cards) === 21) {
              s.hand.hands[0].status = "stood";
              s.hand.phase = "dealer";
            }
          continue;
        }
        if (t.phase === "dealer" && score(t.dealer) < 17) {
          t.dealer.push(t.shoe.pop());
          t.remaining = 0.7;
          continue;
        }
        for (const s of Object.values(t.seats)) {
          const r = settleBlackjack(s.hand);
          s.hand.hands.forEach((h, i) => (h.result = s.hand.hands[i].result));
          payout(this, t, s, r.returned, r.result, r.awards);
        }
      } else if (t.id === "roulette") {
        t.pocket = Object.values(t.outcomes)[0].pocket;
        this.history.unshift(t.pocket);
        this.history = this.history.slice(0, 12);
        for (const s of Object.values(t.seats)) {
          const r = t.outcomes[s.player];
          payout(
            this,
            t,
            s,
            r.returned,
            r.result,
            r.reward === "dud" ? [] : [{ reward: r.reward, multiplier: 1 }],
          );
        }
        t.pocket = Object.values(t.outcomes)[0].pocket;
      } else
        for (const s of Object.values(t.seats)) {
          const r = s.outcome;
          payout(this, t, s, r.returned, r.result, r.awards);
        }
      t.phase = "result";
      t.remaining = null;
      this.event("notice", {
        text: `${t.id.toUpperCase()} · Crew table settled. Check your chips and equipment.`,
      });
    }
  },
  publicCrewTables() {
    return Object.fromEntries(
      Object.entries(this.crewTables).map(([id, t]) => [
        id,
        {
          id,
          startedAt: t.startedAt,
          phase: t.phase,
          point: t.point,
          shooter: t.shooter,
          rolls: t.rolls,
          dice: t.phase === "rolling" ? [] : t.dice,
          pocket: t.phase === "result" ? t.pocket : null,
          dealer: t.dealer?.map((c, i) =>
            t.phase === "result" || t.phase === "dealer" || i === 0
              ? c
              : hidden(),
          ),
          baccarat:
            t.phase === "result" && t.baccarat
              ? {
                  playerCards: t.baccarat.playerCards,
                  bankerCards: t.baccarat.bankerCards,
                  winner: t.baccarat.winner,
                }
              : null,
          seats: Object.values(t.seats).map((s) => ({
            player: s.player,
            name: s.name,
            cost: s.cost,
            bets: s.bets,
            bet: s.bet,
            ready: s.ready,
            returned: s.returned,
            result: s.result,
            hand: s.hand
              ? {
                  phase: s.hand.phase,
                  activeHand: s.hand.activeHand,
                  hands: s.hand.hands.map((h) => ({
                    ...h,
                    cards:
                      t.phase === "rolling" ? h.cards.map(hidden) : h.cards,
                  })),
                }
              : null,
          })),
        },
      ]),
    );
  },
};
