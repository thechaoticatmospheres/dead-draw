# Local demonstrations and inspection

The normal multiplayer entry, opening 90-second intermission, server rules,
checkpoint recovery and career profile are unchanged. `PLAY COMBAT DEMO` starts
an isolated browser-local `Game` using the same rule modules as the server.
It opens wave one with three of that wave's ordinary enemies already present.
Weapon damage, enemy health, gambling odds, payouts and prices are unchanged.
The demo never opens a WebSocket or writes a session/checkpoint/career record.
Every local summary is marked `testing`, including after a restart.

## Controls without pointer lock

WASD works while the gameplay canvas is unlocked. Hold RMB and drag to look;
V toggles aim in this mode. Press H, or use the Controls button, to enable
keyboard look with I/K (up/down) and J/L (left/right). While keyboard look is on,
left click fires without requesting pointer lock. H returns to normal mouse
control. The first ordinary gameplay click captures the pointer; Esc releases.
Locked RMB retains its existing hold-to-aim behavior. Arrow keys remain reserved
for the existing testing sequence. Menus, text fields, focus loss and pointer
release clear or consume held gameplay input. Both held E and F revive.

Sound starts disabled each page load even if saved volume preferences are on.
Enable sound, the sound button or Test sound grants session permission. Ordinary
gameplay clicks, key presses and focus restoration do not. Approved recordings,
juke­box tracks and saved mix levels are retained.

## URLs

Any of `auto`, `seed`, `state`, `t` or `view` opts into an isolated local run.
Unknown unrelated URL parameters do not change normal multiplayer behavior.

| Parameter | Behavior |
| --- | --- |
| `?auto=1` | A repeatable two-minute tour, bot-driven through actual Game actions. |
| `seed=1978` | Seeds local rules and presentation effects. Integer seeds accepted. |
| `state=combat` | Playable wave-one fixture. No auto shooting unless auto=1. |
| `state=intermission` | Atrium, 90 seconds, 225 demo chips, in range of slots. |
| `state=power` | Power restored by the real 150-chip action in Sapphire. |
| `state=power-up&auto=1` | Start in emergency lighting; the bot restores Sapphire power after three seconds through the normal paid action. |
| `state=late-game` | All rooms accessible, late-game inventory and campaign prerequisites. |
| `state=house` | Live House encounter, ordinary boss health and weapon damage. |
| `state=extraction` | Defeated-House fixture in range of the Atrium extraction device. Press E. |
| `state=defeat` | Actual downed-player defeat and summary path. Restart remains available. |
| `state=restart` | Executes defeat then the normal restart path, including 90 seconds. |
| `state=atrium` | Normal opening state, only Atrium accessible. |
| `state=<room id>` | Each of all twelve rooms, with routes opened for inspection. |
| `state=<station id>` | Each casino station, 1,000 demo chips, in B interaction range. |
| `power=0` / `power=1` | Emergency/restored power override in a local inspection fixture. |
| `t=3` | Advance at exactly 60 rule ticks/second, then freeze locally; bounded to 600 seconds. |
| `view=player` | Normal third-person/optic gameplay camera (default). |
| `view=hero` or `view=wide` | Room-wide eye-level composition. |
| `view=entrance` | View into the current room from its south side. |
| `view=table` or `view=detail` | Table/station inspection camera. |

Room IDs: atrium, emerald, velvet, arcade, dice, crown, sapphire, ivory, jade,
neon, obsidian, eclipse. Station IDs: slots, roulette, blackjack, poker, craps,
baccarat, war, threecard, sicbo, keno, hilo, letitride.

Examples: `?state=combat&seed=1978&auto=1&t=3`,
`?state=sapphire&power=0&view=entrance&t=0`,
`?state=sapphire&power=1&view=entrance&t=0`,
`?state=blackjack` (press B to play a private hand).

Frozen captures settle rendering for sixty fixed presentation frames before
reporting `window.__deadDraw.captureReady`. Simulation remains frozen throughout
this settling. The diagnostic `world` exposes the actual live scene for exports;
`state`, `player`, `mode` and `audioEnabled` aid QA. `beginDemo(options)` refuses
to replace an existing socket session. No time controls are sent to multiplayer.

Restart remains usable from a frozen defeat or extraction ending. It clears the
capture clock and inspection camera, then starts a playable local run through
the normal 90-second opening intermission. Other actions cannot change a frozen
capture, and restarting never makes the demonstration eligible for career data.

## Tour fixture cuts (not an end-to-end campaign test)

The title's attract view and `?auto=1` use the actual environment and animation.
At 0s the bot fights the opening wave, then gathers dropped chips. At 20s a
documented intermission fixture plays slots, at 38s an Emerald fixture plays
roulette, at 56s Sapphire power is restored through its real interaction, at 78s
the bot fights the House, and at 111s an extraction fixture votes to leave.
Each wager and payout is authoritative inside its local Game. Fixtures provide
the resources, access and prerequisites for each cut; this compressed tour is
explicitly not evidence of a full natural campaign traversal. It loops at 120s.

Automated checks in `tests/demo.test.js` verify seed equality, real combat
kills, held-input rules, all room placements, power purchase cost, casino
settlements, actual House defeat in the tour, extraction and no career writes.
`tests/audio-activation.test.js` verifies playback cannot start from saved
preferences or incidental focus/start calls.
