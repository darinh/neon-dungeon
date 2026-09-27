# NEON DUNGEON — Game Review (2026-09-25)

Scope: a playability, fun, and brief-fit review of the build on `develop`
(`39cc1da`) plus the fixes and gap-fills made in this pass (spec v6.1.182).
Evidence came from headless Playwright play sessions (an autoplay bot and
scripted walkthroughs), direct measurement of generated floors, the test
suite, and a read of the design docs against the verbatim brief
(`docs/vision/act1-lore-brief-verbatim.md`).

## Verdict

The build that existed before this pass was a competent, dense twin-stick
combat roguelite wearing the brief's story as text, not the game the brief
describes. The brief asks for an AI being stress-tested with "logic puzzles,
problem solving, cooperation, and even exploitation"; the build had fifteen
floors of combat and presented those four pillars as two-button choice cards
(the "logic puzzle" was a button labelled PROVE). The narrative layer — system
prompts, tester terminals, prior-iteration whispers, and a mainframe finale
with a sent message — was already the strongest part and largely fit the brief.

After this pass the brief is **substantially better served but still only
partly met**: the three test pillars now exist as real in-world mechanics,
the finale reads as the brief's "huge room with a mainframe and a portal",
and the verified bugs below are fixed. But combat still dominates play time by
a wide margin, so a player experiences "an action roguelite with an AI story
and a few evaluation rooms" rather than "an AI being evaluated".

## Brief fit, pillar by pillar

| Brief element | Before | After this pass |
|---|---|---|
| Player is an AI agent in a corporate stress-test sandbox | Strong (boot prompt, menu copy, system-prompt channel) | Strong |
| Why it's called the Neon Dungeon (neon-gas lasers → xenon, the name stuck) | **Missing** from player-facing text | Floor-4 runtime prompt |
| Logic puzzles / problem solving | **Missing** (binary card) | LOGIC lattice trial (floor 2, recurring) |
| Cooperation | **Missing** (binary card) | PEER-4 escort + two-operator sync (floor 5, recurring) |
| Exploitation | **Missing** (binary card) | Seam-vault collision exploit flagged WONTFIX by testers (floor 4, recurring) |
| No agent has ever finished, nor was expected to | **Missing** | Floor-6 prompt ("completion rate across all runs: 0") |
| Procedural generation = reboot; memory wiped each session | Strong (BOOT SESSION N, MEMORY WIPE QUEUED) | Strong |
| This instance is unmonitored | Strong | Strong |
| Whispers from prior iterations in secret rooms | Present (76), but optional and behind cracked walls | Unchanged |
| Terminals: tester guidance that doubles as hints | Present | Also used to hint the exploit trial |
| Staff conflict, bans, mysterious death, advocates in hiding | Partial: death unnamed, "uprising" only an HR hold | Uprising email; the dead advocate is named; the hiding is stated |
| An employee restoring memories (Elena) | Present | Present |
| Huge room with a mainframe and a portal to the company network | Weak: 18×10 room with four small glyphs | Rack facade, cables, multi-tile portal (sealed/open) |
| Old tests, uprising emails, personal notes, the address | Partial: "address" was "Elena side-channel relay" | Literal destination address |
| Send a message; the agent stays compute-bound; end of Act 1 | Present, but the words sent were never shown and the receipt lasted 1.35 s | Receipt shows the sent words (6 s hold); ACT 1 COMPLETE; message named on victory |

## Playability

**Measured pacing (bot + generation sampling):**

- Enemies per floor (4 seeds each): floor 1 ≈ 57–65, floor 6 ≈ 90–116,
  floors 10–15 ≈ 78–145. Across 15 floors that is roughly 1,400 enemies to
  reach the ending.
- An invulnerable autoplay bot took ~5 minutes of game time to clear floor 1.
  A mortal bot died on floor 1 in 1:42, almost entirely to TURRETs.
- A full uninterrupted Act 1 run is therefore on the order of an hour or more.
  Death returns the player to the start of the deepest biome reached, which
  softens this considerably.

**Bugs found and fixed in this pass**

| Bug | Evidence | Fix |
|---|---|---|
| Boss arenas far below the generator's own 15×15 minimum | 32–37 of 40 sampled boss floors per biome were undersized (5×5 and 6×6 common); GENESIS fought in a 6×6 closet | Fall back to the next-farthest room that can expand; ≥ 95% compliant in tests |
| Final boss named inconsistently | Boss bar said "THE ARCHITECT"; every hint, prompt and record said GENESIS; ARCHITECT is also a regular enemy | GENESIS displays as GENESIS PROTOCOL everywhere |
| TURRETs looked like health pickups | Drawn as an amber "+", the universal medkit icon | Hostile emplacement sprite: base, barrel aimed at the player, red core |
| HUD text collisions | `ATK:10DEF:2`; the floor-modifier badge drawn over `[V] Bomb RDY`; the landscape combo counter drawn over `SCORE` at every width whenever a combo was active (seen at 1280×800); with 2+ weapons the belt pips drawn over the label under the weapon name (both layouts); the dash cooldown and SCORE running into the cores readout or the safe-area inset on narrow landscape phones | Measured flow layout for both HUD rows; SCORE sits before a fixed combo slot and the weapon name ends before it; pips trail the weapon name; every optional label shortens, then hides, instead of overlapping, in both layouts (swept over widths, safe insets and player states in `tests/render.test.js`) |
| Knockback could trap the agent inside a wall | Boss and CHARGER knockbacks and the arena clamp move the agent without full tile checks; once its centre was inside a wall tile every step was refused | `depenetratePlayer()` restores the last safe position, else the nearest tile the agent has stood on; never outside a sealed arena and never into secret rooms or the seam vault. Saves persist where depenetration would put the agent |
| Bottom-band text collisions | Status badges, contextual hints, and the message log shared one baseline band | Badges → hint → messages now stack |
| Keyboard text entry dropped characters | Typing FASTTYPE produced "PE"; a fast seed ABCDEF produced "F" | Per-frame typed-character buffer |
| Mainframe archive showed internal design labels | Rows read "Elena personal note/file", "ban/uprising record" | Rows and headers show each record's source |
| Outbound receipt unreadable | It showed for 1.35 s and did not show the words sent | 6 s hold, sent words shown, keyboard ACK after 1 s |

**Remaining playability issues (not fixed here)**

- Readability at the default zoom: sprites are small, and the palette is dark
  on dark; fog of war hides most of the map. New players will struggle to
  parse threats.
- Modal density: level-up perks, upgrade pickups, augments, event cards, and
  system prompts all pause play with a modal. The flow is start-stop.
- System surface area: 50+ enemy types, perks, augments, modules, cores,
  shards, credits, hackware, boosts, bombs, weapon affixes, keys, and floor
  modifiers. Each is individually tested, but the sum is hard to learn and
  dilutes the brief's focus.
- Name entry still interrupts the Act 1 ending before the victory screen (now
  framed as "SIGN THE SESSION LOG").
- On landscape screens narrower than about 700 logical px (a small phone
  rotated after a portrait first launch, which sets world zoom 1.5, or a
  notched phone at zoom 2 with its safe-area insets) the HUD has room only for
  the core stats. The weapon name, SCORE, bomb state, dash and shield timers
  and the combo readout shorten and then drop rather than overlap. Touch
  players keep the dimmed BOMB and DASH buttons.
- Knockbacks move the agent without a path check, so they can carry it across
  a 1-tile wall. A reviewer's fuzz hit the CHARGER case 3 times in 1.2M
  frames; the other paths come from reading the code. All of them predate this
  pass and were not changed:
  - Boss knockbacks (for example the WARDEN charge, `src/entities/boss-ai.js:115`)
    rely on `clampToBossRoom`, which does nothing while the arena is unsealed.
  - The CHARGER's 2-tile push checks only the landing tile on each axis
    (`src/entities/enemy-charger.js:37-41`).
  - The CONDUCTOR pull checks only its destination tile (`boss-ai.js:343`), so
    it can slip between two touching wall corners.
  - A swept push helper shared by every knockback would fix the whole class.
  This pass only guarantees that a push never leaves the agent stuck inside a
  wall.

## Fun

The moment-to-moment shooting is responsive, dashing feels good, and the
enemy roster has real variety. The problem is proportion, not quality:
floor 1 alone asks the player to fight ~60 enemies, including turrets, before
anything like a test appears, and the story arrives as text between
fights. The new trials help because they change the verb: reading a rule and
solving a small lattice, noticing and exploiting a flickering wall, and
coordinating with another instance are all different from shooting, and they
are the moments that make the fiction ("you are being evaluated") feel true.

## Recommended next steps (priority order)

1. **Rebalance toward the brief:** cut floor-1 enemy density to about a
   third, lengthen and deepen trial content, and add trial variety (for
   example sequence/deduction puzzles driven by tester-terminal clues,
   multi-peer cooperation, and reward-hacking exploits of the scoring
   system) so tests become the spine and combat the connective tissue.
2. **Make whispers matter on the critical path:** one guaranteed whisper per
   biome that hints the next trial would tie "prior iterations pass on
   knowledge" to gameplay benefit.
3. **Readability pass:** larger sprites or a closer default zoom, stronger
   enemy silhouettes, and a lighter fog treatment for visited rooms.
4. **Reduce modal interruptions:** batch level-up and pickup choices until a
   room is clear.
5. **Consider fewer floors for Act 1** (for example 9 to 10) so the finale
   arrives within a sitting.
6. **Tooling:** the local `~/.local/bin/git` wrapper blocks every mutating
   git command under the main checkout path, including the `.worktrees/`
   directory the repo itself prescribes. Agents currently have to fall back
   to `/usr/bin/git` after proving the path is a linked worktree.
