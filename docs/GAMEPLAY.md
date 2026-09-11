# DEAD DRAW gameplay and development notes

## Crew, recovery and campaign

**T / D-pad left** opens Crew & Objectives. Ping with **Z**, request ammunition or share one matching magazine within three meters, contribute up to 50 chips to nearby doors, and repair entrance boards for 10 chips each. Each entrance holds three boards; an incoming enemy consumes a board and waits two seconds. **C / LT + LS click** shoves nearby enemies, consuming 20 stamina with a one-second cooldown. Teammate ground outlines and location pings remain visible through walls. Downed players spectate standing teammates with **[ / ]** or **Y/RB**.

Power costs 150 chips at the Sapphire terminal. Two ordinary boss kills supply two keys; the Neon archive supplies the vault code once power is on. Activate the Eclipse terminal; the House arrives when the break ends. Below two-thirds health it calls collectors; below one-third it also targets survivors with telegraphed acid. After victory, all connected players can vote at the atrium exit to extract. Ignoring the exit continues endless play. Traps in Jade and Ivory cost 75 chips, run for eight seconds and have a 28-second cooldown; they require power. New room cover uses the same collision data on server and client.

Every player has a private game at each station. Four players can use the same machine at once, with independent decisions, wagers and rewards. Cards and unrevealed outcomes stay private. Craps retains pass/don’t-pass bets and optional true odds.

Slots have three visual themes and a bank-or-free-spin feature every seventh paid spin, in addition to the five-safe vault. Choose 60 chips or three free 25-chip single-line spins. Free spins cannot recursively earn paid-spin features or comps. Keno now has comparable returns across ticket sizes; see [balance notes](BALANCE.md).

**Resume saved run** uses a browser-held reconnect token and encrypted checkpoint. With teammates online, a disconnected survivor is reserved for two minutes; an entirely offline room pauses for up to 30 minutes. After a server restart, resume restores the last safe intermission, including weapons, modifications, chips, unlocked rooms and campaign. Checkpoints save about every 1.5 seconds only when no casino stake or decision is pending, expire after 90 days, and require the same server `CHECKPOINT_SECRET`. Combat since the last checkpoint can be lost after a server restart. Do not clear this site's localStorage if you want to keep saves.

Career records accumulate on completed runs: cleared waves, kills/headshots, revives, casino hands, net winnings, extractions and per-weapon kills. Five cumulative challenges unlock cosmetic armbands; weapon mastery awards bronze/silver/gold charms at 50/200/500 kills. Neither cosmetics nor mastery change damage. Records and settings are local to this browser; there is no cloud account sync. The end-run report shows combat, casino and exploration results.

## High Rollers update

The survival-and-casino loop now includes five enemy profiles, telegraphed area attacks, stamina dodges, grenades, chip streaks, combat pickups, rotating crew contracts, and a boss every fifth wave. Spitters keep their distance; Pit Bosses wind up a ground slam; the High Roller attacks faster as its health falls. Boss caches refill ammo, health and grenades and award three comps.

- **Shift / B:** roll, spending stamina. **G / right-stick click:** grenade. Charges refill at the start of every wave.
- **U / D-pad right:** Survivor’s Club during intermission. Twelve ranked perks use comps; supplies, guaranteed room-gated weapons and three weapon upgrade ranks use chips. All progression lasts for the current run.
- **Comps:** one per 50 chips wagered at the base casino games, including blackjack doubles/splits. True-odds and double-or-bank bets do not earn comps. Each completed crew contract adds chips and one comp per crew member at wave clear.
- **Slot vault:** every fifth paid spin opens five shuffled safes: four cash prizes and an alarm. Pick up to three or bank after a safe. An alarm loses only vault winnings. One safe contains the crew progressive pot, starting at 250 and funded by 5% of slot stakes (minimum one chip). Banking that safe resets the pot.
- **Double or bank:** optionally risk a credited chip payout on a fresh card’s color, at 50% red / 50% black. Correct doubles the risked chips; wrong loses them. Maximum three attempts; equipment is retained. Close the result or play again to keep the credited amount. Risking more than 10,000 chips at once is disabled.
- **Craps odds:** after a point is established, add or take down up to twice the line stake in 30-chip units. Odds settle alongside the line at true odds; no rounded fractional payouts.
- **Session ledger:** the Club records the last 12 settlements and casino chip profit/loss, including vault and double-or-bank results.

Table interactions and combat action shortcuts work without recapturing the mouse. Menus consume gameplay keys; mouse look and WASD movement still use pointer capture. Controller menus support the new choices. Casino bonuses and pending color calls settle when the break ends.

## Round flow

Start the run to enter a **90-second intermission**. All waves start automatically when the clock reaches zero, including with downed teammates. Revive your crew before the bell. The last ten seconds sound a countdown; new wagers and wheel spins close at seven seconds.

At the deadline: blackjack stands; poker keeps all five cards; craps finishes committed rolls; War surrenders ties; Three Card folds unpaid play bets; Let It Ride keeps outstanding wagers; Hi-Lo and vault bonuses bank their current value. Pending reveals and color bets finish. Each hand pays once; there is no readiness vote. Closing a menu leaves your hand running until the deadline.

## Controls

WASD move, mouse look, left click fire, right click aim, Shift roll, Space jump, R reload, Q cycle owned weapons, **E use a nearby table or purchase a shutter**, **M open the floor plan**, hold F near a downed teammate for three seconds to revive. Escape releases the mouse. Click the floor to recapture it. Intermissions release the pointer for casino and Club menus. Touch controls are not implemented.

### Controller

Standard mapped Xbox and PlayStation-compatible controllers use the browser [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API). Connect the controller, focus the game, release its controls, then press a button. Prompts switch when you use the controller or return to keyboard/mouse. Gamepads require localhost or HTTPS; plain HTTP on a LAN address may not expose the API.

| Input (Xbox labels) | Action                                 |
| ------------------- | -------------------------------------- |
| Left / right stick  | Move / look                            |
| LT / RT             | Aim / fire                             |
| A                   | Interact, buy access, select menu item |
| X                   | Reload                                 |
| Y or RB             | Cycle weapons                          |
| Left stick click    | Jump                                   |
| Hold LB             | Revive                                 |
| View or D-pad up    | Floor plan                             |
| D-pad down          | Jump                                   |
| Menu                | Controls and settings                  |
| B                   | Roll / close menus                     |

Menus support D-pad/left-stick spatial navigation, LB/RB cycling, A selection and right-stick scrolling. Settings include look sensitivity, inverted vertical look, optional vibration, and cinematic/performance graphics. Controller settings persist locally. Names and room codes use keyboard text entry; a blank room code hosts a run. Browsers may require a mouse/keyboard gesture before audio can start. One local controller controls one survivor; co-op still uses separate browser clients.

Input uses a radial deadzone and analog movement. Menus consume movement/fire input. Losing focus, changing tabs or disconnecting clears held controls; returning to the game requires neutral sticks/buttons before control resumes. Vibration is used when supported. Automated controller tests inject standard Gamepad API samples; physical controller compatibility and rumble require hardware verification.

## Sound effects

The sound pass adds 56 original procedural cues, including fourteen distinct weapon profiles, surface-aware footsteps, reload/ready/empty-magazine sounds, hit and headshot feedback, dodging, grenade throws and explosions, armor and health damage, down/revive cues, low-health heartbeats, enemy voices and telegraphed attacks. Room shutters, supplies, upgrades, crew contracts and round transitions also have dedicated cues.

All six casino games have synchronized Foley: slot motors and individual reel stops, roulette ball clicks and landing, card shuffles/deals/holds, dice rattles and impacts, chip stacks, wins/losses/pushes, jackpot fanfares, vault doors/safes/alarms and double-or-bank reveals. Sounds follow public state; they cannot reveal hidden outcomes.

Open **? → Sound & volume** for master, combat/effects, casino and ambience sliders, mute and a sound preview. Settings persist locally and support keyboard/controller adjustment. Nearby sounds pan relative to your view, fade with distance, and become quieter/muffled behind walls. Subtle room ambience and casino sounds duck during combat. A shared compressor, bounded voice count and per-cue cooldowns control busy multiplayer mixes. Leaving the game window suspends audio; browsers may require a click or key press to enable it again.

`src/audio-cues.js` contains the original sound recipes; `src/audio.js` owns synthesis, mixing and cleanup; `src/soundscape.js` observes snapshots and events. No sound downloads, external audio services or licensed samples are required. `tests/audio.test.js` checks timing, spatial math, persistence, mute/focus, cleanup and voice limits. With the dev server running, open `/tests/audio-browser.html` to render all cues through the browser's real Web Audio engine and check silence/headroom, including a four-player mix at maximum volume. That diagnostic page is not included in production builds.

## Graphics and assets

The Art Deco casino uses marble paths, patterned carpets, paneled walls, brass trims, luminous chandeliers and modeled casino furniture. Eighteen optimized, self-contained GLBs total approximately 5.1 MB: four textured, rigged character variants and fourteen original casino/weapon props. Characters animate idle/run with procedural weapon and shamble poses. Weapons have separate sidearm, SMG, rifle and shotgun models.

The renderer adds environment lighting, material reflections, dynamic shadows and restrained bloom. **Cinematic lighting** enables post-processing and shadows; **Performance** disables both and limits pixel ratio. Model geometry/materials are shared, static architecture is batched, and props in locked rooms are hidden during play. Gameplay simulation and collision remain separate from rendering.

Characters come from Kenney's CC0 [Animated Characters Survivors](https://kenney.nl/assets/animated-characters-survivors). Original source assets, license and processing provenance are retained; see `public/assets/CREDITS.md`. Runtime assets load from this project, without third-party requests. With the dev server running, `node tools/build-assets.js` regenerates and optimizes GLBs using Three.js exporters and glTF Transform. Generated props are authored in `tools/author-props.js`.

## Unlockable casino rooms

The 48×32-meter floor has six rooms, separated by solid walls and purchasable shutters. One player pays from their own chips; the entire crew gains access for the current run. Doors can be bought during combat or intermissions. Purchases are validated on the server for price, proximity and prerequisite access. A fresh run resets all access to the Atrium.

| Room           | Access cost | Game        | Equipment                  |
| -------------- | ----------: | ----------- | -------------------------- |
| Palm Atrium    |        Free | Slots       | Sidearms                   |
| Emerald Lounge |          75 | Roulette    | Automatics                 |
| Velvet Room    |         125 | Blackjack   | Rifles                     |
| Draw Arcade    |         200 | Video poker | Pit Viper shotgun / shells |
| Dice Hall      |         250 | Craps       | Armor                      |
| Crown Salon    |         350 | Baccarat    | Elite rifles               |

Routes: **Atrium → Emerald → Draw Arcade → Crown**, or **Atrium → Velvet → Dice Hall → Crown**. Prices are per room, additional to earlier purchases and table wagers. Crown opens a free shortcut to the Atrium; opening both wings joins the outer loop. M shows costs, access and the current room.

Each newly opened room activates two additional zombie entrances. Total wave size still follows round/co-op difficulty; opening space changes the possible spawn locations. Zombies navigate through open doorways using a shared grid flow field. Walls and closed shutters stop movement, gunfire, chip attraction and revives across partitions.

The branching door economy takes inspiration from the access-gate and route-planning loop described in Activision’s [Black Ops 4 Zombies guide](https://blog.activision.com/call-of-duty/archives/getting-started-in-call-of-duty-black-ops-4-zombies) and [Forsaken guide](https://news.blizzard.com/en-us/article/23733292/surviving-forsakena-guide-to-the-final-chapter-of-call-of-duty-black-ops-cold-war-zombies). The casino layout, names, assets and rewards are original.

## Co-op difficulty

For round R and P players (1–4):

- Total zombies: `ceil((6 + (R−1)×4) × (1 + .85×(P−1)))`.
- Health: `round((62 + min(110, R×7)) × (1 + .10×(P−1)))`.
- Spawn interval: `max(.22, (1.2−R×.04) / (1+.35×(P−1)))` seconds.
- Simultaneously alive: `min(36, 12+R×2+(P−1)×5)`.
- Speed: `1.05+min(1.3,R×.075)` meters/second.

Round one contains 6 / 12 / 17 / 22 zombies for 1 / 2 / 3 / 4 players. Mid-round arrivals increase the remaining wave and scale living zombie health proportionally. Departures do not weaken a wave already underway; the next wave uses the current roster. Long-session balancing still needs human co-op playtests.

Start with Courtesy .38 (12 loaded, 60 reserve), 25 chips. Kills drop at least seven chips; nearby chips collect automatically. Round clears grant 25 chips plus five per previous wave (125 total cap), 12 current-weapon rounds, and 25 health to standing players.

## Casino games

**Slots:** three independent 20-stop reel strips, showing three rows. Select the center payline or all three horizontal lines; wager 25, 50, or 100 chips per line. Matches evaluate left to right. Triple 7 awards a gilded Velvet and 250 chips; triple BAR a Switch; triple diamond a Velvet; triple ammo 72 rounds; triple cherries 60 chips. Two leading ammo symbols award 18 rounds, two cherries 20 chips. Higher stakes multiply chips/ammo, not weapon quality. The visible paytable lists exact base probabilities; 777 is 1/8,000 per line. After two losses, a third losing spin grants 36 safety rounds without altering the actual reel stops. Reels stop sequentially and remain visible for inspection.

**Roulette:** European single-zero wheel and numbered felt. Place 10/25/50/100-chip denominations on individual numbers or red, black, even, odd, low, high, or any dozen. Multiple bets per spin; undo, clear and rebet controls. Minimum 10 and maximum 500 per position; 1,000 total. Outside wins pay 1:1, dozens 2:1, numbers 35:1, plus returned winning stakes. Zero loses all outside bets. The highest qualifying winning bet supplies one equipment reward: an outside/small win gives 96 automatic rounds; a winning dozen staked at 25+ gives House Special; a winning number staked at 50+ gives the gilded SMG. Equipment is additional to chip returns. Recent results are displayed and do not influence subsequent spins. Bet structure and chip payouts follow [European roulette rules](https://games.everymatrix.com/wp-content/uploads/2021/10/European-Roulette-Game-Rules.pdf); equipment rewards are original game rules.

**Blackjack:** choose 50, 100, or 200 chips. Fresh 52-card deck; dealer peeks for blackjack, then stands on all 17s. Hit/stand, double any two-card hand, split equal ranks once, or surrender the original two-card hand for half back. Split aces receive one card; split 21 pays as an ordinary win. No insurance. Wins pay 1:1, naturals 3:2, pushes return the stake. Equipment is awarded per hand: win gives Dividend, natural gives Sovereign, push gives 90 rifle rounds. The dealer reveals and draws cards sequentially. Decisions have no timeout. These are selected conventional [blackjack options](https://www.mgmresorts.com/en/gamesense/guide-to-blackjack.html) with original equipment rewards; the UI states the specific house rules.

**Video poker:** five-card Jacks or Better with one draw from a fresh 52-card deck. Wager 25/50/100; select individual cards to hold and replace the rest, or hold all five to stand pat. The visible 9/6 paytable returns 800× royal flush, 50× straight flush, 25× quads, 9× full house, 6× flush, 4× straight, 3× trips, 2× two pair, 1× jacks or better. Returns include the wager; the 800× royal applies at every offered stake. A high pair gives 18 shells; two pair through quads give the Pit Viper; straight/royal flushes give its gilded variant. The Pit Viper fires seven pellets per shell from a six-round magazine. Decisions have no timeout.

**Craps:** Pass / Don’t Pass line bets, 25/50/100 chips. Come-out 7/11 wins Pass; 2/3/12 loses. Other totals establish a point; roll the point before a seven to win. Don’t Pass reverses the result, except come-out 12 pushes. Each roll is player-triggered; point bets wait without a timer. Wins pay 1:1 plus the returned stake and refill armor to 75 (no stacking). Armor absorbs melee damage before health. Animated dice, point puck and roll history show the state. This version includes line bets only, following [MGM’s craps rules](https://www.mgmresorts.com/en/gamesense/guide-to-craps.html), with original armor rewards.

**Baccarat:** choose Player, Banker or Tie; wager 20/40/100. Six decks freshly shuffled per hand; natural 8/9 and the standard third-card tableau are automatic. Player pays 1:1, Banker 0.95:1 after commission, Tie 8:1, plus winning stakes. Ties push Player/Banker bets. Cards reveal in stages. A winning Player/Banker bet gives 90 rifle rounds, or Sovereign at 100 chips; a winning Tie gives Gilded Sovereign. Rules reference [Bellagio’s gaming guide](https://static.mgmresorts.com/content/dam/MGM/bellagio/casino/bellagio-casino-gaming-guide.pdf); equipment is additional.

## Validation

`npm test`: automated checks covering sound timing/mixing/lifecycle, game rules, room progression, casino accounting, combat, controller deadzones/button edges/focus handling, GLB containers/embedded resources/animation rigs, and wall collision matching the upgraded geometry.

With Microsoft Edge installed:

- `node tests/browser-smoke.js`: two real browser clients, movement/shooting/reload, shared slot outcomes, and team readiness.
- `node tests/network-smoke.js`: four real WebSocket clients, fifth-player rejection, shared movement, unanimous start and four-player scaling.
- `node tests/tables-browser.js`: isolated funded fixture on 5190; multi-bet roulette, blackjack split/double, three-line slots, safety payout, round button and combat restrictions. Screenshots go in `test-results/`.
- `node tests/rooms-browser.js`: isolated two-player fixture on 5191; crew-wide purchases, keyboard movement through shutters, Crown shortcut, all three new games and equipment payouts, map at 1440×900 and 1024×768, co-op readiness and combat lockout. Screenshots go in `test-results/`. Funding, card sequences and seating are controlled fixture setup; all interactions use the live UI and WebSocket simulation.
- `node tests/controller-browser.js`: injected gamepad samples exercise host/start, analog movement/look, aim/fire/reload, map, settings, neutral rearm after simulated focus loss, and disconnect handling on the local server.
- `node tests/controller-tables-browser.js`: isolated fixture on 5192; controller-only room purchases, all six casino games, options and round start. Also captures and measures a 36-zombie scene in both graphics modes. Input uses simulated Gamepad API samples; funding, seating and enemy population are controlled fixtures.

`npm run build` produces the client bundle and copies local GLBs. Vite issues a size advisory for the main Three.js/client chunk.

## Modules and remaining work

`shared/map.js`: rooms, doors, wall geometry and visibility. `shared/data.js`: weapons, stations and movement. `shared/casino-rules.js` / `shared/extra-rules.js`: paytables, card/dice rules and difficulty. `server/table-games.js` / `server/extra-games.js`: casino state machines and settlements. `server/casino.js`: deck shuffle and reward delivery. `server/navigation.js`: grid flow field through accessible rooms. `server/game.js`: authoritative 30 Hz simulation. `server/index.js`: room transport. `src/casino-ui.js` / `src/extra-casino-ui.js`: table presentation. `src/render/world.js`: procedural scene, actors, effects and shoulder camera. `src/main.js`: input, floor plan and HUD.

`src/gamepad.js` handles controller sampling, menu navigation and focus state. `src/render/assets.js` loads/clones GLBs and animates characters; `environment.js` builds the casino; `surfaces.js` creates materials. Navigation uses a one-meter grid with circle/rectangle collision and refreshes four times per second. Multiplayer smooths snapshots without local prediction or latency compensation. Reconnection persistence, richer combat animations, hardware controller checks and extended co-op balancing remain future work. See the root README for permanent GitHub Pages and multiplayer hosting.

`tests/expansion.test.js` checks progression, enemy rosters, dodge and grenade authority, hazard timing, crew payouts, vault concealment and settlement, double-or-bank and true-odds craps. `node tests/expansion-fixture.js` runs loopback-only deterministic browser QA scenes on port 5194; those fixture controls are never included in the production server.

## Jukebox & Club cashier

The starting Palm Atrium contains the Golden Hour Jukebox and a Survivor’s Club cashier window. Click either prop, or approach and press **E / A**. The cashier opens the Club between rounds; **U / D-pad right** remains a shortcut from anywhere. The HUD now names the Club and shows its binding.

The jukebox plays five supplied three-minute songs in a repeating playlist. Players near it can choose a record, skip forward/back, and pause/resume for the whole crew. Opening it does not prevent a new round; its panel closes when combat starts. Your own music-volume slider persists across refreshes, while playlist position is included in safe run checkpoints. Master volume, Sound Off and window focus also apply, and music gets quieter during combat. If a browser blocks autoplay, click once or use the jukebox's Enable Music button.

## Casino staff & regulars

- **Dead Dealer (wave 1+):** burgundy uniform, chips/cards and a craps rake. Slightly tougher than a drifter, with a longer melee reach.
- **Drunken Crawler (wave 1+):** slowly drags across the floor holding a bottle. Aim down at its head; standing-height shots pass overhead.
- **Last Call Regular (wave 2+):** an older zombie in a wheelchair, rolling faster than a drifter. Its seated head and body are lower targets.
- **Casino Security (wave 4+):** a larger uniformed guard with a baton, 2.6 times base health, and a warned close-range heavy strike. Keep clear of the ground warning or dodge away. Drops an extra 10 chips on defeat.

These join the existing drifters, runners, spitters, pit bosses and High Roller bosses. Normal five-wave boss/key progression remains intact.

**Power shortcut:** stand near the Sapphire terminal and press **E / controller A** during an intermission to buy power for 150 chips. Finish active casino hands first. The prompt changes to ONLINE once purchased for the crew. Repeated presses do not charge again.

## Roaming arsenal & mascot waves

The Grand Prize Wheel is marked in the location HUD. Approach and press E / A during a break. Each of eleven equally likely prizes is a weapon or special supply. Spins resolve after five seconds. Cost starts at 500 chips and rises by 100 per crew spin, capped at 1,500. After at least three spins, the wheel moves to a different unlocked room once all ongoing spins finish. With only the atrium open it stays there. Duplicate weapons add reserve ammo; the sword has unlimited swings. Max Ammo fills all weapons; Golden Vest grants 150 armor; Second Chance adds one automatic revive token. Wheel stakes do not earn comps.

| Weapon              | Use                                    | Availability                     |
| ------------------- | -------------------------------------- | -------------------------------- |
| Velvet Saber        | Wide, close-range cleave; no ammo      | Natural blackjack + wheel        |
| Pit Boss Crossbow   | Powerful single bolt; reload each shot | Flush or better in poker + wheel |
| Housebreaker RPG    | Rocket impact blasts a 4 m area        | Wheel only                       |
| Dragon’s Breath     | Continuous short-range flame cone      | Wheel only                       |
| Debt Collector      | Rapid fire after 0.35 s spin-up        | Wheel only                       |
| Royal Flush Railgun | Pierces up to four aligned enemies     | Wheel only                       |
| Static Jackpot      | Chains to up to four nearby enemies    | Wheel only                       |

Every fourth wave becomes **Mascot Meltdown**, except fifth-wave bosses and the campaign finale. Jackpot geese waddle, flap, honk and attack quickly; clearing them grants 75 extra chips and two extra magazines. Boss keys remain on the normal fifth-wave schedule.

Existing comp prices rise by 50%, rounded up. New ranks: Field Medic (5 comps, max 2, +40% revive speed/rank); Scavenger (4, max 2, +25% purchased/pickup ammo/rank); Thick Skin (6, max 3, 8% damage reduction/rank); High Interest (5, max 3, +15% wave-clear base chips/rank); Hot Streak (8, max 3, +10% weapon damage/rank). Each next rank costs its base price times rank number. These are run upgrades and persist in safe checkpoints.

**Auto Reload (6 comps, one rank, starting atrium):** automatically reloads your equipped weapon when its magazine empties. Uses reserve ammunition and the normal reload delay, including Quick Hands and Speed Loader bonuses. Available throughout the run after purchase, saved in checkpoints. Does not reload while downed or rolling, and never applies to the sword.
