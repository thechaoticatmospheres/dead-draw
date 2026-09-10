# Crew update balance notes

`node tools/balance-report.js` reproduces these figures. The model is deliberately explicit: crew chips are pooled, all enemies drop the minimum seven chips, all drops are collected, and no chips are spent on gambling, equipment, power or repairs. It excludes combos, boss caches and contract rewards. These are economic baselines, not measured human completion times.

| Crew size | First room | Sapphire | All twelve rooms |
| --------- | ---------- | -------- | ---------------- |
| Solo      | Wave 1     | Wave 9   | Wave 21          |
| Two       | Wave 1     | Wave 6   | Wave 15          |
| Four      | Wave 1     | Wave 4   | Wave 11          |

Room costs remain 75–2,100 chips. Teammates can contribute in 50-chip increments; the last payment charges only the remainder. Wave clears pay each connected player `25 + min(100, (wave−1)×5)` chips, plus existing contract rewards. This gives later waves enough guaranteed income to support choices beyond ammunition.

Keno uses the exact hypergeometric probability of matching a ticket against 20 of 80 balls. The old ticket-size imbalance is replaced by 84.54–86.03% chip returns at the 20-chip stake. Equipment and comps are additional. Whole-chip flooring is included. Rules tests keep every 2–8 spot ticket within 84–87% at supported stakes.

All stations now resolve independently per survivor. Free slot spins neither advance paid-spin features nor fund the progressive pool. Casino results remain server-authoritative and credit once. Breaks last 90 seconds; the deadline resolves pending hands automatically.

Every seventh paid slot spin grants a choice of 60 chips or three free single-line spins. This supplements the existing fifth-spin vault, with its pick/bank/alarm decisions. Theme selections change presentation, not hidden odds. Career unlocks are cosmetic; no saved damage bonus compounds the combat economy.

Long co-op sessions with real players remain useful for tuning ammo expenditure, time spent at tables, and difficulty at the final rooms. Automated tests verify rules and reachable progression; they do not establish how enjoyable a 60-minute run feels.

Version 0.7 adds seven weapons, the 500–1,500-chip prize wheel, special-wave bonus income, and eleven comp perks. The projections above predate those additions and remain baseline estimates; they exclude wheel spending and new perk/special-wave income.
