# Crew update balance notes

`node tools/balance-report.js` reproduces these figures. The model is deliberately explicit: crew chips are pooled, all enemies drop the minimum seven chips, all drops are collected, and no chips are spent on gambling, equipment, power or repairs. It excludes combos, boss caches and contract rewards. These are economic baselines, not measured human completion times.

| Crew size | First room | Sapphire | All twelve rooms |
| --- | --- | --- | --- |
| Solo | Wave 1 | Wave 9 | Wave 21 |
| Two | Wave 1 | Wave 6 | Wave 15 |
| Four | Wave 1 | Wave 4 | Wave 11 |

Room costs remain 75–2,100 chips. Teammates can contribute in 50-chip increments; the last payment charges only the remainder. Wave clears pay each connected player `25 + min(100, (wave−1)×5)` chips, plus existing contract rewards. This gives later waves enough guaranteed income to support choices beyond ammunition.

Keno uses the exact hypergeometric probability of matching a ticket against 20 of 80 balls. The old ticket-size imbalance is replaced by 84.54–86.03% chip returns at the 20-chip stake. Equipment and comps are additional. Whole-chip flooring is included. Rules tests keep every 2–8 spot ticket within 84–87% at supported stakes.

Shared roulette retains a single-zero wheel. Shared blackjack uses one fresh shoe and a common dealer. Shared baccarat uses one tableau. Shared craps place bets use multiples of 30 for exact conventional payouts; come bets travel independently. Refunded pre-deal wagers do not earn comps. Free slot spins neither advance paid-spin features nor fund the progressive pool. Casino results are server-authoritative and credited once.

Every seventh paid slot spin grants a choice of 60 chips or three free single-line spins. This supplements the existing fifth-spin vault, with its pick/bank/alarm decisions. Theme selections change presentation, not hidden odds. Career unlocks are cosmetic; no saved damage bonus compounds the combat economy.

Long co-op sessions with real players remain useful for tuning ammo expenditure, time spent at tables, and difficulty at the final rooms. Automated tests verify rules and reachable progression; they do not establish how enjoyable a 60-minute run feels.
