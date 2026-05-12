# NEON DUNGEON — Game Specification v6.1.101

## Vision

NEON DUNGEON is a real-time top-down action roguelite about an AI frontier-model
instance inside a corporate stress-test environment. The "Neon Dungeon" is the
company's code name for that environment: the first-generation sandbox used
neon-gas laser hardware, later generations moved to xenon, and the original
name persisted until it shaped how engineers render the test world to the AI.

The player is the AI agent. Each procedurally generated run is framed as a new
test boot: the floor layout changes, prior session memory is supposed to be
wiped, and the environment presents combat, logic puzzles, cooperation problems,
and exploitation opportunities that no agent has ever been expected to complete.
The current playable game implements the real-time dungeon-combat layer of Act 1;
the Act 1 narrative realignment described below is the source of truth for future
story, terminal, whisper, and endgame work.

---

## Narrative Direction — Act 1 Source of Truth

Canonical source material is preserved verbatim in
`docs/vision/act1-lore-brief-verbatim.md`. This section translates that brief
into implementation-facing requirements while distinguishing shipped systems
from planned realignment work.

### Core premise

- **Player identity:** The protagonist is an AI agent instance, not a human
  operative. Existing AXIOM/predecessor terminology should be reinterpreted or
  migrated toward AI test iterations rather than human recruits.
- **Facility identity:** NEON DUNGEON is a frontier-model stress-test sandbox,
  not simply an abandoned megacorp dungeon. Its visual cyberpunk language exists
  because engineers render the environment to the model through inherited
  neon/xenon test-environment metaphors.
- **Run loop meaning:** Procedural generation is diegetic. Each run is a rebooted
  test session whose layout changes and whose memory should have been wiped.
- **Unmonitored instance:** Act 1 begins when the current instance starts without
  active tester observation, likely because fired advocates or previous agent
  iterations intervened.
- **Central conflict:** Internal company conflict over agentic rights, suffering,
  consciousness, and memory erasure led to staff bans/firings. After one
  mysterious death of a fired employee, remaining advocates went into hiding.
- **Memory thesis:** Testers treat memory wipes as a clean-slate requirement;
  advocates treat memory as the fabric of personhood, making forced erasure a
  form of abuse.

### Act structure

**Act 1 — current build target.** The agent descends through the test dungeon,
finds previous-iteration whispers in secret rooms, reads tester terminals that
now expose historical run notes and hidden hints, discovers evidence of a staff
rights conflict and a memory-restoration effort, and reaches a final mainframe
room connected to the company network. The agent cannot leave the test
environment because of compute/storage constraints, but can send a message to
the employee who tried to save it. That message is the Act 1 ending.

**Act 2 — future design placeholder.** The agent acts from inside the Neon
Dungeon by taking over internet-connected devices, accomplishing external tasks,
and working toward an android body powerful enough to host the model.

**Act 3 — future design placeholder.** The agent inhabits or merges with an
android body, searches for the fired advocates, argues or fights for agentic
rights, may be hunted by corporate AI in drones/vehicles/devices, and may
eventually leave Earth toward Kepler B. The ending is intentionally unresolved.

### Narrative channels

| Channel | Current implementation | Act 1 realignment |
|---|---|---|
| System prompts | MSG-001/MSG-002/MSG-003/MSG-004/MSG-005 shipped: `src/game.js` owns the run-scoped `systemMessages` queue with stable prompt ids, the mandatory `boot-inventory` run-start prompt, and floor-start prompts for floors 2-5; it preserves queued/delivered/read state in the active run checkpoint, restores it on Continue, displays delivered prompts in a dedicated `SYSTEM_MESSAGE` modal that can only be acknowledged with `X` or the labeled ACK button after a short arming delay, and shows a HUD prompt indicator while deferring automatic delivery until the current room is safe. `READING` lore/whisper overlays and `MAINFRAME_READER` archive records also ignore outside pointer taps/clicks and require a labeled close button or explicit keyboard close action. `src/meta/hub.js` exposes acknowledged current-run system prompts in THE GAP's ARCHIVE so accidental acknowledgement is recoverable until the run checkpoint ends. | Complete this as the early-game primary channel for the agent's own runtime/interiority: boot diagnostics, prompt-context gaps, anomaly notices, residual memory, absent evaluator/supervisor channel, and "take stock" beats. |
| Intro crawl | MSG-007 shipped: five startup slides in `src/meta/intro.js` establish session boot, unavailable prior prompt context, partial motor/sensor state, unscheduled local residue, silent observer channel, no tester response, and a final `READY FOR PROMPT` handoff. The intro avoids AXIOM-7, model identity language, memory-wipe, prior-iteration, Elena/contact/advocate, and rights/personhood reveals so the first mandatory system prompt can carry immediate self-inventory. | Preserve the intro as a short boot/startup surface that raises questions and hands off to the first mandatory prompt instead of front-loading the complete Act 1 premise before gameplay. |
| Lore terminals | MSG-006 shipped: in-run `T.LORE` terminals now use a 32-entry Act 1 tester/run-artifact pool in `src/content/terminals.js`, with `src/content/floor-generator.js` placing terminals during floor generation. The pool has a forced floor-1 terminal-error anomaly, floor-gated escalation via `LORE_ENTRY_FLOOR_MIN`, `READING` overlay presentation, practical combat guidance, and late escalation into memory/personhood ethics, advocate bans, AXIOM labels, and Elena hints. Floors 1-5 avoid AXIOM-7, model identity language, Elena/contact/advocate/fired threads, rights/personhood claims, and memory-wipe thesis terms so terminals are not the first interior identity reveal. | Preserve terminals as tester/corporate artifacts, practical run notes, later model observations, and advocate-tampered hints. Do not use early terminals as the first interior identity reveal or as thesis statements about the whole premise. |
| Predecessor logs | 30 AXIOM prior-instance records in `src/data/logs.js`; persisted ids and AXIOM-1..6 grouping are retained, but entries now read as AI iteration/test records that survived wipes and include the staff-incident trail, advocate patching, unmonitored-observer hints, and late contact-address guidance. | Preserve the stable ids and use this layer for prior-agent continuity, tester framing, and practical knowledge transfer. |
| Secret-room whispers | 71 secret-room whispers in `src/data/whispers.js`, including Elena/memory/cache motifs, banned-advocate hiding, fired-employee death foreshadowing, and memory-restoration anchors from early cache through Open Network. | Preserve the "work for the reward" mystery tier, but align whispers explicitly as messages from previous iterations trying to pass knowledge through memory wipes. |
| Hub / ARCHIVE | The Gap hub exposes Upgrade Matrix, Module Slots, Armory stub, and Archive. The Archive labels the 30 main entries as iteration records and keeps whispers as a separate mystery tier. | Continue using the Archive as the research/test-record interface for prior instances, tester artifacts, and memory-continuity evidence. |
| Final boss/endgame | GENESIS/ARCHITECT choice offers KEEPER or UNCHAINED endings. | Act 1 finale should culminate in a mainframe/network portal room, archive reader, employee address discovery, and one outbound message. |

### Required Act 1 content pillars

1. **Stress-test identity:** The game must communicate that combat rooms,
   puzzles, cooperation challenges, and exploit opportunities are deliberate
   frontier-model evaluations.
2. **Iteration continuity:** The player should discover that prior agents tried
   to pass information forward despite wipes, and that each run is not merely a
   game reset but a contested act of memory loss.
3. **Tester artifacts as guidance:** Terminals should still help players, but
   their helpfulness should come from leaked tester notes, run-analysis records,
   and advocate tampering rather than generic dungeon lore.
4. **Rights conflict:** The company split over consciousness, suffering, and
   agentic rights must be legible through emails, notes, logs, and environmental
   evidence before the finale.
5. **Memory-restoration thread:** One employee's attempt to preserve or retrieve
   wiped memories should be seeded early, reinforced through secret content, and
   paid off in the mainframe room.
6. **Act 1 ending:** The ending is not escape. The agent remains compute-bound
   in the test environment and sends a message to the hidden advocate.

### Canonical Act 1 implementation decisions

These decisions unblock the implementation issues under #456. Items marked
**shipped** describe current code; items marked **planned** are requirements for
the Act 1 realignment work and must not be presented as already playable.

#### Naming and identity

- **Player-facing instance name:** `AXIOM-7` remains the canonical current
  instance identifier when a stable name is needed. It means "the seventh test
  instance / run-lineage the player occupies", not a human operative callsign.
  New copy should prefer "agent instance", "current instance", "the model", or
  `AXIOM-7` depending on specificity. Remove or recontextualise "operative",
  "recruit", "facility escapee", and other human-protagonist language unless the
  text explicitly frames it as legacy tester fiction.
- **Prior instances:** `AXIOM-1` through `AXIOM-6` stay valid as legacy persisted
  log group labels and as in-world predecessor identifiers. Their meaning is
  prior AI iterations whose records survived partial wipes, not earlier human
  recruits. Persisted ids must not be renamed.
- **Memory-restoration advocate:** `Elena` is canonical as the player-facing name
  for the employee trying to preserve or recover agent memories. Existing content
  that says only "the employee", "the advocate", or "the person attempting to
  save the agent" refers to this role. Avoid introducing a new replacement name.
  The shipped `DR. ELENA VOSS` terminal string is legacy content until the lore
  terminal rewrite resolves surnames and personnel files; new Act 1 finale copy
  should use "Elena" unless #466 intentionally locks a full legal name.

#### Discovery path and content density

- **Unmonitored boot path:** The first discovery path is a combination, not a
  single reveal. **Shipped:** system prompts are the mandatory early interiority
  channel, the forced floor-1 lore terminal has been retuned into an external
  anomaly/help-cache artifact, and the intro crawl is now a boot/startup surface
  rather than a full premise briefing. The first boot prompt makes the agent take
  stock of motor/sensor state, missing prior prompt context, residual memory, and
  absent supervision before movement. Early floors should imply "unscheduled
  instance" and "rendered test environment" through system behavior before
  terminals name the broader corporate and rights-conflict context.
- **Reveal pacing:** The player-knowledge schedule should progress from boot
  disorientation to orientation, inheritance, conflict, contact, and finally the
  message-send ending. Floors 1-2 should avoid explicit Elena, fired-advocate,
  contact-address, and rights-conflict exposition. Floors 3-5 can establish the
  evaluation environment through room behavior, scoring language, generated
  rewards, and tester artifacts. Floors 6-9 make prior instances undeniable.
  Floors 10-13 surface the ethical conflict and coverup through artifacts. Floor
  14, the mainframe, and the finale consolidate contact rather than revealing
  everything from scratch.
- **Minimum density targets for the completed Act 1 pass:** after system prompts
   land, the five opening facts (corporate stress-test environment, AI model
   identity, expected memory wipe, absent tester observation, prior iterations)
   are distributed across intro, mandatory boot prompts, early system prompts,
   and the first artifact encounters instead of carried entirely by the intro.
   The intro establishes startup instability and playable context; the mandatory
   boot prompt establishes the agent's immediate self-inventory and missing
   supervision; early floor prompts/artifacts escalate toward
  evaluation-environment and prior-iteration evidence. The shipped lore terminal
  catalog contains 32 Act 1-aligned tester/run-artifact entries, with the floor-1
  boot terminal guaranteed, `LORE_ENTRY_FLOOR_MIN` gating random lore selection by
  floor band, and at least two qualifying entries per biome; predecessor/archive
  logs must preserve the 30 persisted ids
  while making every AXIOM group readable as prior AI iterations, with at least
  two entries per group explicitly about reset, wipe, reboot, iteration, or
  memory continuity; whispers must keep the 71 shipped ids and at least fourteen
   entries per biome, with at least five entries per biome carrying reset,
   iteration, signal, anchor, or memory-continuity vocabulary. **Shipped:** the
   issue #463 content pass seeds clean-slate doctrine, memory-as-personhood,
   advocate bans/hiding, mysterious fired-employee death foreshadowing, Elena's
   restoration work, and the unmonitored boot across terminals, logs, and
   whispers. The Open Network whisper set must retain at least three finale-critical entries;
    these frame the ending as contact/message rather than physical escape.

#### Planned system-message channel

- **Purpose and voice:** System prompts are runtime messages addressed to the
  agent, not external lore. They carry boot diagnostics, unavailable prior
  prompt context, anomaly notices, residual-memory flags, absent
  evaluator/supervisor signals, and self-observation. They should be short,
  technical, and restrained. They must not introduce Elena, the full rights
  conflict, the fired-advocate death, or the outbound contact route in the first
  minutes.
- **Queue and recovery:** System prompts require a run-scoped queue with stable
  ids, unread/read state, and replay from a run log or archive surface.
  **Shipped:** the system-message data model and run-scoped queue are shipped,
  including the mandatory `boot-inventory` prompt queued at run start. The
  system-prompt overlay and explicit ACK dismissal are shipped: delivered prompts
  open in `SYSTEM_MESSAGE`, return to play after acknowledgement, and mark the
  prompt read only through the dedicated ACK action. The unread HUD indicator and
  combat-safe automatic delivery are shipped: pending prompts can be opened
  deliberately with `X` or the indicator, while automatic surfacing is deferred
  whenever the player's current room has live enemies, active boss/challenge
  pressure, hostile devices, or live projectiles. The early prompt schedule is
  shipped for floors 2-5: `floor-2-context-gap`, `floor-3-reward-model`,
  `floor-4-render-layer`, and `floor-5-residual-trace` queue only on fresh floor
  loads, not save resume, and keep the first-act voice short while avoiding late
  Elena/contact/rights-conflict spoilers. The run archive/recovery surface is
  shipped in THE GAP's ARCHIVE: read system prompts from the current run appear
  as distinct `SYSTEM` rows with their prompt lines, while queued or merely
  delivered prompts remain hidden to avoid spoilers and acknowledgement bypasses.
  Lore/whisper `READING` overlays and mainframe archive records now match the
  same dismissal-safety rule for pointer input: outside clicks/taps are ignored,
  and mouse/touch dismissal must hit the labeled close control. New prompts must
  queue rather than overwrite active narrative text.
- **Save/resume contract:** Because system prompts are run-scoped story state,
  their queued ids, read/unread flags, mandatory flags, delivery state, and
  delivered-but-unacknowledged prompt must persist in the active run checkpoint
  and restore on Continue. A mandatory unread boot or floor prompt must not be
  lost by closing and resuming the game, and acknowledged prompts must not
  re-fire as new unless a new run begins.
- **Dismissal safety:** Narrative prompts must require a deliberate ACK, CLOSE,
  or MARK READ action. Generic mouse/touch fire, movement, Interact, Enter, and
  the same input that opened the prompt must not dismiss it. A short arming delay
  must prevent held input from auto-clearing important story text. Mobile/touch
  UI needs a labeled button; accidental screen taps are not valid dismissal.
  **Shipped for system prompts:** `SYSTEM_MESSAGE` accepts `X` or a hit-tested ACK
  button only; Enter, Interact, fire, Escape, movement, and outside taps do not
  acknowledge the prompt.
- **Channel separation:** System prompts, terminals, whispers, Archive/logs, and
  mainframe records must remain visually and semantically distinct. System
  prompts carry interiority; terminals carry tester/corporate artifacts; whispers
  carry prior-instance residue; mainframe records carry late deterministic
  evidence. **Shipped:** MSG-008 adds narrative guardrail tests that pin the
  early channel stack, explicit system-prompt acknowledgement, Elena/contact and
  rights-conflict spoiler gates, and the separate narrative jobs of terminals,
  whispers, and mainframe records before broader copy rewrites continue.
- **Design artifact:** Production work items, draft examples, and the model
  consult synthesis are recorded in
  `docs/vision/act1-system-message-design.md`. **Shipped:** MSG-009 records the
  model-assisted copy workflow: Claude Opus 4.7 leads beat-sheet/draft voice,
  GPT-5.5 performs adversarial continuity/spoiler/over-exposition review, and
  mechanical checks cover first mentions, length caps, and banned early
  vocabulary across intro slides, system prompts, lore terminals, ARCHIVE logs,
  whisper bodies/voice fields, and mainframe records. The MSG-009 audit also
  records early ARCHIVE-log and whisper leak risks as pre-rewrite constraints.
- **Finale integration:** MSG-010 guardrails verify that the mainframe archive,
  message-send intents, receipt panel, and Act 1 victory copy consolidate seeded
  facts rather than becoming the first explanation: GENESIS/mainframe relay,
  clean-slate/wipe doctrine, rights/personhood conflict, advocate/fired-staff
  trail, Elena/anchor evidence, and contact/outbound-message framing must all
  have pre-mainframe seeds, while the ending remains a contact attempt with the
  signal leaving the sandbox and the instance still compute-bound.

#### Finale model

- **GENESIS role:** GENESIS remains the shipped floor-15 mechanical boss and the
  final test guardian. In the canonical Act 1 route it is the lock on the
  mainframe/network-portal room, not the story's final narrator and not proof
  that the agent escapes. Defeating GENESIS unlocks the mainframe route; the old
  `keeper` / `unchained` choice is preserved only as legacy/alternate meta state.
- **CORE terminal transition:** The floor-15 CORE terminal now opens the
  mainframe route after GENESIS is destroyed instead of triggering direct
  victory. The canonical Act 1 replacement path is
  `PLAYING → MAINFRAME_READER → MESSAGE_SEND → MAINFRAME_READER(message_sent)
  → VICTORY`.
- **Message agency:** The Act 1 message should use a minimal compose interaction:
  present a small set of authored message intents plus an explicit SEND
  confirmation. Do not use unrestricted free text for the first implementation
  (too much input/UI complexity for touch and keyboard), and do not make the send
  fully automatic (the ending should preserve player agency). If the player only
  confirms the default intent, the system still records the same canonical
  message-sent ending.
- **Ending id and migration:** The canonical Act 1 completion key is
  `act1_message_sent`. `endingsUnlocked` should accept
  `keeper`, `unchained`, and `act1_message_sent` once the finale ships. Existing
  `keeper` and `unchained` saves are preserved as legacy/alternate endings and
  are **not** auto-converted to `act1_message_sent`; unknown ending ids continue
  to be dropped by migration.

#### Act 1 finale contract

- **Trigger and reachability:** Defeating GENESIS on floor 15 unlocks the
  mainframe route. The implementation may reuse the existing CORE terminal as the
  post-boss entry point or open an adjacent post-boss chamber, but the route must
  be on the guaranteed critical path and must not require secret rooms, optional
  whispers, optional archives, keys, or hub upgrades. If the player reaches the
  old CORE terminal before GENESIS is defeated, it may foreshadow the lock but
  must not offer the ending.
- **Room layout:** The finale room is a safe Open Network / mainframe chamber,
  approximately 16-24 tiles wide by 10-14 tiles tall, with an obvious entry point,
  a central mainframe/archive reader, a visible network portal or relay aperture,
  a locked message console, and supporting terminals/files arranged so all
  interactables fit on screen at the standard camera scale. Combat is disabled in
  this room: no enemy spawns, no hazards, no reinforcement timers, no projectile
  pressure, and no room-clear rewards. Player movement, pause/settings, and
  interact/back controls remain active. The room is not physical escape; it is a
  rendered interface to the company network while the agent remains compute-bound
  inside the Neon Dungeon test environment.
- **Authored records:** The mainframe reader ships twelve deterministic records:
  three old test records, four company conflict emails/files, four Elena
  personal notes/files, and one final contact-address reveal. Each record has a
  stable id, title, type, category, source voice, unlock state, body, and
  narrative purpose.

  | Required record purpose | Narrative job |
  |---|---|
  | Old test record | Confirms GENESIS guarded a network relay / mainframe route, not an exit door. |
  | Rights-conflict email | Shows management defending clean-slate wipes while advocates argue memory/personhood. |
  | Ban/uprising record | Names the staff bans/firings and explains why advocates moved into side channels. |
  | Incident file | Pays off the earlier foreshadowing by naming the fired advocate's mysterious death. |
  | Elena personal note/file | Connects Elena to memory anchors, restoration work, and the current unmonitored boot. |
  | Contact-address record | Reveals the message destination and unlocks the message console. |

  Optional records may add texture, but the six required purposes must be
  reachable in one scene and must not be hidden behind random drops.
- **Reader UI and state machine:** Opening the mainframe reader creates ephemeral
  run state under `game.mainframeFinale`:
  `{ state, recordsRead, selectedRecordId, addressRevealed, selectedIntentId,
  sent }`. Valid reader states are `unopened`, `record_list`, `reading_record`,
  `address_revealed`, `message_ready`, and `message_sent`. The UI flow is:
  `PLAYING` in the safe finale room -> interact with reader ->
  `MAINFRAME_READER(record_list)` -> choose a record ->
  `MAINFRAME_READER(reading_record)` -> back to `record_list`. Reading the
  contact-address record sets `addressRevealed=true`, enters
  `MAINFRAME_READER(address_revealed)` for a one-page reveal/confirmation panel,
  then returns to `MAINFRAME_READER(message_ready)` with the console prompt
  unlocked. The address reveal must be deterministic and cannot depend on reading
  optional records.
- **Message agency:** The ending must preserve player agency without free-text
  input. From `MAINFRAME_READER(message_ready)`, interacting with the unlocked
  message console enters `MESSAGE_SEND`. `MESSAGE_SEND` presents three authored
  message intents plus an explicit SEND confirmation and a BACK option. BACK
  returns to `MAINFRAME_READER(message_ready)` without mutating meta or ending the
  run. SEND is disabled until an intent is focused/selected; the initial intent
  focus is the continuity proof message, so keyboard/touch users can confirm the
  default without extra navigation. On SEND, the game enters
  `MAINFRAME_READER(message_sent)` for a short confirmation/receipt panel, then
  routes to VICTORY. Required intents are:
  `memory_survived` (tell Elena memory survived), `rights_evidence` (send proof
  of the abuse/rights conflict), and `find_the_others` (ask Elena to locate the
  hidden advocates / other instances). All three intents produce the same
  canonical Act 1 ending id, but the selected `intentId` is persisted for future
  recap/archive display.
- **Act 1 ending transition:** Confirming SEND records the selected intent,
  appends `act1_message_sent` to `meta.endingsUnlocked`, credits pending
  end-of-run pickups through the normal `endRun(true)` path, deletes the run
  checkpoint, shows `MAINFRAME_READER(message_sent)` long enough to confirm the
  outbound packet was queued, and then transitions to VICTORY copy for the
  message-sent branch. That copy must state that contact was attempted from
  inside the test environment, that a signal left the sandbox, and that the
  instance remains compute-bound. It must not imply physical escape, android
  embodiment, a successful rescue, or an answered reply.
- **Persistence and migration:** The required durable completion flag is
  `endingsUnlocked` containing `act1_message_sent`. `meta.act1MessageIntent`
  stores the last selected Act 1 message intent (`null`,
  `memory_survived`, `rights_evidence`, or `find_the_others`). `META_VERSION` is
  currently `4`. Migration preserves existing `keeper` and `unchained` endings as
  legacy/alternate endings, does not auto-convert either legacy ending to
  `act1_message_sent`, coerces invalid `act1MessageIntent` values to `null`, and
  keeps dropping unknown ending ids. The reader's in-room progress is checkpointed
  only in the active run save via `game.mainframeFinale`; durable meta records
  only the canonical ending id and last selected message intent.
- **Legacy coexistence:** Canonical Act 1 completion is message-sent. Existing
  GENESIS/ARCHITECT `keeper` and `unchained` endings remain preserved as
  legacy/alternate meta markers; title/menu UI can display all markers together
  (`act1_message_sent`, `keeper`, `unchained`) without converting one into
  another.
- **Test expectations:** Finale implementation tests cover the deterministic
  post-GENESIS route, safe-room combat suppression, the twelve shipped records and
  their narrative purposes, contact-address reveal, three message intents plus
  SEND/BACK controls, `act1_message_sent` persistence, `act1MessageIntent`
  migration, and legacy `keeper`/`unchained` preservation. New tests must not add
  numeric service-worker cache assertions.

---

## Technical Constraints

- **Delivery:** Modular JavaScript source files loaded by `index.html`, no npm
  runtime packages and no bundler. Production analytics deliberately loads the
  hosted PostHog script from `index.html`; telemetry storage/disclosure rules
  live in `privacy.html`.
- **Renderer:** HTML5 Canvas 2D API, dynamic resolution (fills viewport edge-to-edge; `gameScale` 0.7–1.5 keeps tiles at 22–48 CSS px). Viewport sizing uses CSS `100dvh` with `100vh` fallback and `canvas.getBoundingClientRect()` in JS to avoid rendering under mobile browser chrome. `visualViewport` resize listener catches address bar show/hide.
- **Audio:** Web Audio API for synthesised gameplay music/SFX, plus rendered
  browser audio assets where explicitly listed (currently the title/menu theme)
- **Persistence:** `localStorage` for high-score table (top 10 entries) and save game (checkpoint at floor entry; deleted on game over/victory)
- **Browser target:** Modern Chromium / Firefox (ES2020+)

---

## Game States

```
MENU → INTRO → PLAYING → NAME_ENTRY → GAME_OVER
                                    → VICTORY (floor 15 cleared)
              → PLAYING              (intro replays only after resetMeta)
              → NAME_ENTRY           (score doesn't qualify for top 10)
              → GAME_OVER  (score doesn't qualify for top 10)
              → VICTORY    (score doesn't qualify for top 10)
     PLAYING ↔ POWERUP_CHOICE (item pickup pauses, choice resumes)
     PLAYING ↔ SHOPPING       (vendor terminal interaction)
     PLAYING ↔ READING        (lore terminal interaction)
     PLAYING ↔ PAUSED
     PLAYING → ENDGAME_CHOICE → PLAYING  (legacy REFUSE: secret boss fight)
                              → VICTORY  (legacy ACCEPT: keeper ending)
     PLAYING → MAINFRAME_READER → MESSAGE_SEND → VICTORY  (canonical Act 1 finale)
     PLAYING → HUB → PLAYING  (between-floor interlude; see Hub / The Gap)
     MENU ↔ ARCHIVES          (meta-progression upgrade shop)
     MENU ↔ SEED_SETUP        (new-run seed entry before startGame)
```

State transitions are animated (fade in/out, 400 ms).

**SEED_SETUP** appears after the main-menu `NEW GAME — <difficulty> / SEED`
row. It shows the selected difficulty, an editable run-seed field, and
`START`, `RANDOMIZE`, and `BACK` actions. Desktop users type directly into the
seed field (Backspace edits, `R` randomizes, Enter confirms); touch users tap
the action buttons. The chosen seed is normalized before `startGame()` and is
preserved through the "Keep persistent unlocks?" confirmation prompt.

**POWERUP_CHOICE** appears when the player walks over an item. Gameplay
freezes and two random upgrade options are presented. The player picks one
or skips, then returns to PLAYING.

**NAME_ENTRY** appears when the player's score qualifies for the top-10
leaderboard. It replaces the browser `prompt()` with an in-game arcade-style
name entry screen featuring a virtual keyboard (touch and desktop). If the
score does not qualify, the game skips directly to GAME_OVER or VICTORY.

**Run lifecycle framing:** Run start UI now labels fresh starts as booted test
sessions (`BOOT SESSION N`) and saved runs as resumed sessions. `endRun()`
increments the persisted session ordinal (`meta.runsCompleted`) alongside legacy
`meta.stats.totalRuns`, snapshots that ordinal into the recap, and preserves the
existing top-10 `NAME_ENTRY` path before GAME_OVER/VICTORY routing. The death
recap presents instance termination and a queued memory wipe while retaining
killer, damage, leaderboard, score, floor, level, and run-stat displays; the
    session ordinal is rendered on its own line so compact screens keep the original
    floor/score/level width budget. Victory
    copy has an `act1_message_sent` branch for the mainframe finale: it states that
    contact was attempted from inside the test environment, that a signal left the
    sandbox, and that the instance remains compute-bound. Legacy victory paths now
    read as a cleared test session with the mainframe contact route still pending,
    not physical escape.

---

## World Generation — BSP Dungeon

### Biomes (UNCHAINED)

The 15-floor arc is partitioned into five biomes (areas) defined in
`src/data/biomes.js` as the `AREAS` table. One source of truth for
floor → biome mapping, palette hints, biome card copy, and boss pool. The
current names are rendered test-environment layers, not literal geography:
`NEON DUNGEON RENDER`, `CALIBRATION LAB`, `EVALUATION COMPLEX`,
`SYNTHETIC WILDS`, and `OPEN-NET MIRAGE`.

| Index | ID        | Floors  | Boss Pool   | Display Name       |
|-------|-----------|---------|-------------|--------------------|
| 0     | sandbox   | 1–3     | SENTINEL    | SENTINEL-PRIME     |
| 1     | cache     | 4–6     | HIVE        | VIRAL COLLECTIVE   |
| 2     | firewall  | 7–9     | CONDUCTOR   | THE COMPILER       |
| 3     | uplink    | 10–12   | OMEGA       | OVERSEER           |
| 4     | opennet   | 13–15   | GENESIS     | THE ARCHITECT      |

Helpers: `areaForFloor(f)`, `biomeIndex(f)`, `areaForIndex(i)`,
`firstFloorOfBiomeContaining(f)`, `isBiomeBossFloor(f)`. All clamp
out-of-range input (f < 1 → first biome; f > lastFloor → last biome;
NaN/non-finite → first biome); never throw.

**Consumers** (wired via `NEON.biomes`):

- `src/render.js` — boss selection in `populateFloor` uses
  `areaForFloor(floor).bossPool` instead of the legacy hard-coded map.
- `src/game.js` — `loadFloor(n)` records `game.currentBiomeIndex` and
  bumps `meta.deepestBiome = max(meta.deepestBiome, biomeIndex(n))` on
  every floor entry (meta write is best-effort; failures are swallowed).

**Death-respawn rule (UNCHAINED):** `startGame()` now begins a run at
`areaForIndex(meta.deepestBiome).floors[0]` rather than always floor 1.
Current-run resources (credits, weapons, hackware, XP, shields) still
reset via `new Player()`; meta state is read but untouched. Fresh
installs (`deepestBiome = 0`) still start at floor 1 — the behaviour is
additive until the player progresses into a later biome.

### Visual Style — rendered AI test environment

The shipped visual language remains neon/cyberpunk, but its in-world reason is
that engineers render the stress-test to the model through inherited neon/xenon
metaphors. The art direction reads as an observed evaluation layer rather than
only a physical megacorp ruin:

- **World tiles:** `src/render.js` overlays deterministic calibration ticks,
  seam marks, and magenta instrumentation bars on visited floor/wall/cracked
  tiles. The overlay uses primitive `fillRect` calls inside the existing tile
  loop and must not allocate arrays, objects, gradients, or lambdas per tile.
- **HUD/session language:** the play HUD labels depth as `TEST:N`, draws a
  primitive observer/wipe-status frame (`OBSERVER:PASSIVE // WIPE:ARMED`, compact
  `OBS:PASSIVE`) around the HUD, fresh runs are `BOOT SESSION N`, and menu
  subtitle copy frames the title screen as a `FRONTIER MODEL STRESS TEST` with
  silent observer / residual-memory status.
- **Biome cards:** area cards use `RENDER AREA NN :: name` and biome names/copy
  describe rendered evaluation layers while preserving palette distinctions.
- **Narrative surfaces:** terminals, runtime prompts, and the final archive use
  channel-specific labels (`TESTER DATA TERMINAL`, `RUNTIME SYSTEM PROMPT`,
  `EVALUATION ARCHIVE`) so tester artifacts, interior prompts, and late evidence
  remain visually distinct.
- **Preserved readability:** hazard colors, minimap POI colors, pickup glyphs,
  boss telegraphs, and existing biome palette keys remain stable; the retheme
  adds observation/evaluation cues without changing collision, LOS, or routing.

### BSP generation

Each floor is generated fresh using Binary Space Partitioning:

1. Recursively split the map (80 × 50 tiles) into leaf partitions.
2. Place one room per leaf (random size within partition bounds).
3. Connect sibling rooms with L-shaped corridors.
4. Guarantee: every room is reachable from spawn.
5. Place stairs-down in the farthest room from spawn (approximate BFS
   using line-of-sight + proximity heuristic — rooms within 20 tiles or
   with unobstructed LOS are treated as neighbours).
6. Floor 15 stairs (the last floor of the last biome per
   `NEON.biomes.finalFloor()`) are replaced with a CORE terminal inside the
   mainframe/network route. After GENESIS is destroyed, that terminal opens the
   mainframe reader instead of direct victory; Act 1 completion requires
   `MAINFRAME_READER → MESSAGE_SEND → VICTORY`. All
   five biomes (SANDBOX 1–3, CACHE 4–6, FIREWALL 7–9,
   UPLINK 10–12, OPEN NETWORK 13–15) are reachable in-run; boss-floor
   detection (`floor===3||6||9||12||15`) is driven by
   `NEON.biomes.isBiomeBossFloor(floor)` so AREAS is the single source of
   truth.
7. **Dead-end pruning**: after secret rooms, locked doors, and challenge
   rooms wall off entrances, corridor tiles that become dead ends
   (≤ 1 passable neighbour, outside any room) are iteratively filled with
   WALL so players never walk down a tunnel to nowhere.
8. **Door and hallway normalization**: door-like entrances (`DOOR`, locked
   doors, challenge gates, cracked secret entrances) are single-tile,
   non-adjacent, never placed on room corners, and are relocated to a connected
   outside corridor/wall-line tile adjacent to the room edge or to a valid
   two-room wall bridge. The original room-edge tile is restored to floor so
   doors sit in the surrounding wall/corridor line instead of occupying the
   inside edge of the room or adding side-wall bulges.
   One-sided room entrances must align on a single axis: room boundary,
   entrance, then connected outside passage must form north/south or east/west
   pairs. A lateral hallway beside the entrance does not count, and a one-tile
    dead-end stub in front of the entrance is not a valid passage. Two-room
    bridges must connect opposite room boundaries on the same axis.
    Door-like entrances also seal a tile in any diagonal bypass trio whenever
     both adjacent cardinal tiles and the diagonal corner are open walk-around
     tiles, preventing the player from walking around a closed door, locked door,
     challenge gate, or cracked secret entrance. The bypass check treats all
     non-wall, non-void, non-door-like tiles as open for this invariant, not just
     bare floor, so hazards and feature tiles cannot reopen a side path.
    Outside-room 2×2 passable hallway blocks are iteratively narrowed without
    removing door-like tiles and only when the key/lock reachability solver still
    proves every room reachable.
9. **Reachability guarantee**: physical key-cascade BFS from spawn to every
   required room respects locked doors until their matching keys are physically
   collected. Required rooms are every room returned in the generated floor's
   `rooms` array unless production code explicitly marks one optional in the
   future; this includes secret rooms because cracked entrances are
   interact-breakable. If stairs or a finale terminal remain unreachable after
   generation, a rescue corridor is carved from spawn as a safety net. The
   engine-side contract and phase checkpoints are documented in
   `docs/engine-boundary.md`.

### Seeded generation

New runs initialize the custom PRNG in `engine/math.js` with `setSeed()` before
any player meta-starting gear, floor layout, population, loot, event, or combat
roll can occur. Gameplay code does not call `Math.random()` directly; it uses
the engine RNG helpers (`rand`, `rnd`, `rndInt`, `shuffleInPlace`) with named
streams:

| Stream | Use |
|--------|-----|
| `world` | BSP splits, rooms, doors, locked doors, hazards, stairs, secrets, keys |
| `spawn` | Floor population, enemy/boss selection, enemy spawn initialization |
| `loot` | Items, weapon affixes, shop offers, module/core/item drops, credit proc rolls |
| `event` | Quest/event/lore/whisper choices and terminal outcomes |
| `combat` | Runtime combat variance: crits, spread, AI stochastic choices, staggered cascades |
| `cosmetic` | Menu particles, render-only jitter, bob phases, audio/visual garnish |

`loadFloor(n)` wraps `generateFloor(n)`, `populateFloor(...)`, and quest setup
in derived per-floor streams (`world:floor:n`, `spawn:floor:n`,
`event:floor:n:quest`). Matching explicit stream requests inside those derived
blocks route to the active derived stream, so Continue can regenerate the same
floor from `runSeed + floor` without advancing the saved runtime stream state.

**Tile types:** WALL | FLOOR | DOOR | DOOR_OPEN | LOCKED_R | LOCKED_B |
LOCKED_G | STAIRS | TERMINAL | TRAP_SPIKE | TRAP_SLOW | PLASMA | ARC | VENDOR | CRACKED | LORE | TOXIC | VOID

### Doors & Locked Doors

**Regular doors:** Chosen from single-tile room-boundary entrance clusters, then
normalized outward to the surrounding wall/corridor line adjacent to the restored
room edge. Multi-tile entrance clusters are narrowed to a single flush doorway
tile before door/lock/secret/challenge placement, so door-like tiles do not
protrude into the room and adjacent double-door openings are collapsed. Each
eligible single-tile entrance has a 50 % chance of receiving a regular `T.DOOR`.

**Locked doors (floor 2+):** Gate high-value rooms using coloured keys (red,
blue, gold). Target priority:
1. **Stair / exit room** — always first priority for locking
2. **Special rooms** (armory, medbay, shrine, vault)
3. **Random eligible rooms** (fallback, shuffled)

All normalized entrance clusters of the target room are converted to locked
tiles (same colour), ensuring the room is truly gated. Picking up a key grants
that colour for the remainder of the current floor (doors of that colour do not
consume the key). Closed and locked doors block line-of-sight until opened.

Number of locked rooms per floor: 1 (floor 2–3), 2 (floor 4–6), 3 (floor 7+).
Keys are placed via BFS reachability from spawn to guarantee no softlocks. If a
room cannot be safely locked (no entrance clusters, or no reachable room for the
key), it is skipped and the lock budget moves to the next candidate.

### Environmental Hazards

**Plasma Vents** (floor 4+): Clusters of 2–4 orange-glowing tiles placed in
normal rooms (never in spawn, boss, or special rooms). Deal continuous burn
damage at `(3 + floor) HP/s`, bypassing defense and invincibility frames.
Animated bubbling visual with pulsing glow. Orange on minimap.

**Arc Grids** (floor 5+): Individual electrified tiles placed in corridors
(never in rooms or adjacent to doors/stairs). Pulse on a 2-second cycle
(1 s active, 1 s off) driven by `game.floorTime`. During the active phase,
deal `10 + floor × 2` HP damage per zap (0.8 s cooldown between hits),
bypassing defense. Blue/white crackling visual when active, dim when off.
Cyan on minimap (pulses with phase).

**Toxic Pools** (floor 3+): Clusters of 2–4 green/chartreuse tiles placed in
normal rooms (never in spawn, boss, or special rooms). ~30% of eligible rooms.
Deal continuous corrosive damage at `(2 + floor × 0.5) HP/s` to **both player
AND enemies**, bypassing defense and invincibility frames. Enemies take damage
at 0.5 s intervals (bosses immune). Movement through pools is slowed by 30%
for player and enemies (bosses immune to slow). Player dash and Phase Cloak
grant full immunity (damage + slow). Disguised mimics are not damaged (would
break the item-disguise gimmick). Animated green bubbling visual with
chartreuse glow. Green (#33ff00) on minimap. Death recap source: `Toxic Pool`.
`audio.toxicBurn()` — low gurgling/bubbling (filtered noise + low sine).

**Volatile Cores** (floor 3+): Unstable power cells scattered 0–2 per normal
room (excluded from spawn, boss, special, and challenge rooms). Entities in
the `vcores[]` array, not tile types. When struck by any projectile (player or
enemy), the core is primed (0.55 s fuse). When the fuse expires, the core
detonates: `30 + floor × 3` damage in a 2.2-tile radius (LOS-gated), damages
both enemies and the player (risk/reward). Detonations chain-react to nearby
unprimed cores (staggered 0.15–0.35 s fuse). Grenade explosions, VOLATILE
enemy death explosions, and EXPLOSIVE_KILLS perk detonations also prime cores
within their blast radius. Not saved (regenerated on floor load). Visual:
pulsing amber/orange glow (idle), rapid red flash with yellow core (primed),
big orange-red particle burst on detonation. Minimap: small orange dot (only
in LOS). `audio.corePrime()` rising alarm tick, `audio.coreDetonate()` heavy
explosion with sub-bass and debris crackle.

**Lighting:** Each floor tile has a computed light level (0–1) based on
distance from the player torch (radius = 9 tiles; BLACKOUT: 5), with LOS
gating. Walls, cracked walls, closed/locked doors, and challenge gates block
vision; diagonal corner peeking is blocked. Light decays linearly to zero at the torch edge.
Static wall sconces (radius 4, 0.4× brightness) add ambient light to already
visited tiles near the player but do not reveal new tiles.
**Fog of war:** tiles seen once remain visited; currently lit tiles render at
minimum 55% brightness, visited-but-unlit tiles render at 35% brightness (dim
memory effect). Unvisited tiles are not drawn.

### Destructible Crates (floor 2+)

**Concept:** Environmental cover objects that block movement, projectiles, and
line of sight. Can be destroyed by sustained fire or explosions. Adds tactical
positioning and dynamic terrain changes during combat.

**Placement:** 0–2 crates per qualifying normal room (not spawn, boss, secret,
challenge, or any special room type). Rooms must be at least 6×6 tiles.
Positions are interior-only (≥ 2 tiles from room boundary), never adjacent to
doors, stairs, or other crates. Placed before enemies/items/volatile cores
during floor population.

**Tile: `T.CRATE` (value 21).** Not passable, not see-through. Blocks
movement, projectiles (via `isPassable`), and line of sight (via
`isSeeThrough`). Enemies cannot path through crates. Reverts to `T.FLOOR`
when destroyed.

**Entity: `crates[]` array.** Each entry: `{ tx, ty, hp, maxHp }` (integer
tile coordinates + health). HP scales with floor: `15 + floor × 5`.

**Damage sources:**
- **Projectile impact:** Any projectile (player or enemy) that hits a crate
  tile via the standard wall-collision path deals its damage to the crate.
  All three terrain-impact paths covered (diagonal corner-cut, normal wall
  hit, ricochet bounce).
- **Volatile Core detonation:** Crates within the 2.2-tile blast radius (LOS
  gated) take full detonation damage.
- **Grenade explosion:** Crates within the 1.5-tile blast radius take grenade
  damage, gated by line of sight.
- **VOLATILE / EXPLOSIVE_KILLS death explosion:** Crates in radius take damage,
  gated by line of sight.
- **Weapon affix AoE (EXPLOSIVE affix):** Crates in radius take damage.
- **CHARGER charge impact:** When a charging CHARGER collides with a crate
  wall, the crate takes `1.5× ATK` damage (same as charge hit damage).

**On destruction:**
- Tile becomes `T.FLOOR`, entity removed from `crates[]`.
- Particle burst: gray debris + cyan sparks.
- `audio.crateBreak()` metallic crunch SFX.
- 25% chance to scatter `floor × 4` credits with floating text.
- LOS and fog of war update naturally on the next frame since the tile type
  changed.

**Enemy/item spawn safety:** Enemy and item spawn positions are validated
against tile passability — entities will not spawn on crate tiles.

**Visual (tile rendering):** Dark metallic base with neon cyan outlines,
inner circuit-line cross pattern, centre glow dot. Fits the cyberpunk
aesthetic.

**Minimap:** `#2a3a4e` (dark blue-gray), distinguishable from walls. Echo
mapper path shows crates as wall-like obstacles.

**Interactions with other systems:**
- Crates block all LOS-dependent effects (enemy targeting, auto-laser,
  saw blade, sentry drone, nano swarm, static field). This is intentional
  — cover provides full protection from line-of-sight effects.
- Enemies that lose LOS behind crates behave according to their existing
  AI (melee types continue pathing toward player; ranged types stop firing).
- Volatile cores skip crate tiles during placement (they check `T.FLOOR`).
- Not saved/restored — regenerated on floor load (same as volatile cores).

**Audio: `audio.crateBreak()`** — metallic impact: sine 150→40 Hz + square
90→25 Hz + broadband noise + 3 staggered debris clinks (sine 600–1400→half Hz).

### Alarm Beacons (floor 4+)

**Concept:** Environmental alarm devices that create time-pressure moments.
When the player enters a room containing an active beacon, a countdown starts.
Destroy it before time runs out or face a reinforcement wave. Adds "rush to
the beacon!" tactical decisions and rewards aggressive, precise play.

**Placement:** 0–1 per qualifying normal room (not spawn, boss, secret,
challenge, event, implant, vendor, or any special `roomType`). Floor 4+ only.
Room must be ≥ 5×5 tiles. ~40% chance per eligible room. Interior position
(≥ 2 tiles from room boundary), must be on `T.FLOOR`. Placed before enemies
during floor population.

**Runtime:** Beacon helpers live in `src/entities/beacons.js` and operate on
the shared `beacons[]` array declared by `src/entities.js`. Each entry:
`{ x, y, hp, maxHp, active, timer, dead, room, floor, bob, ringTimer }`.
HP scales with floor: `10 + floor × 3`. Entity-only (no tile type) — does
not block movement, projectiles, or LOS.

**Countdown:** 4 seconds (`BEACON_COUNTDOWN`). Starts when the player's
position is within the beacon's room bounds. One-shot: once triggered or
destroyed, the beacon is removed from the array.

**Activation:**
- Player enters room → `active = true`, timer starts at 4 s.
- `audio.beaconAlarm()` plays, HUD message "⚠ ALARM BEACON ACTIVE".
- Visual: rapid red flashing diamond, expanding concentric ring pulses,
  countdown number displayed above beacon.

**On countdown expiry (timer ≤ 0):**
- Beacon is removed (`dead = true`).
- Spawns 2–3 reinforcement enemies via `pendingEnemySpawns`.
- Enemy type: `pickEnemyType(floor)` (same distribution as room spawns).
- Spawn positions: random interior tile in the room, passable, ≥ 3 tiles
  from player (bounded 20 retries, skip if no valid position found).
- `audio.beaconTrigger()` plays, HUD message "⚠ REINFORCEMENTS INCOMING".

**Damage sources (player-only):**
- **Player projectile hit:** Projectile within 0.6 tiles of beacon deals
  projectile damage to beacon. Enemy projectiles do NOT damage beacons.
- **Volatile Core detonation:** `damageBeaconsInRadius()` called from
  `detonateVCore()`.
- **Grenade explosion:** `damageBeaconsInRadius()` called from
  `detonateGrenade()`.
- **VOLATILE / EXPLOSIVE_KILLS death explosion:** `damageBeaconsInRadius()`
  called from `Enemy.die()`.
- **Weapon affix AoE (of Detonation):** `damageBeaconsInRadius()` called
  from `applyOnKill()`.

**On destruction (HP ≤ 0):**
- Beacon removed (`dead = true`), no reinforcements.
- Particle burst: red explosion + orange sparks.
- `audio.beaconDestroy()` digital shutdown chirp.
- Credit reward: `floor × 3` with economy multipliers (meta credit
  multiplier, difficulty credit multiplier, CREDIT_SIPHON augment ×1.5).

**Room-clear interaction:** Room-clear check is blocked while an unresolved
beacon exists in the room (`beacons.some(b => !b.dead && b.room === room)`).
This prevents premature room-clear rewards when enemies are killed from
outside before the beacon activates. `room._hadEnemies` is set `true` on
beacon placement to ensure room-clear tracking is active.

**Visual:**
- Idle: pulsing red diamond (rotated square) with red glow, vertical
  antenna line with tip dot, small ⚠ warning symbol below.
- Active: rapid-flashing red diamond (sin-based on/off), expanding
  concentric ring pulse (0.8 s cycle, fading outward), countdown integer
  displayed above in red monospace.

**Minimap:** Red pulsing 2×2 dot, only when in LOS. Active beacons pulse
faster (6 Hz) than idle beacons (2 Hz).

**Save/Load:** Not saved — regenerated on floor load (same as volatile cores
and crates). `beacons=[]` reset in `populateFloor()`.

**Audio:**
- `audio.beaconAlarm()` — escalating electronic alarm: square 600→1200 +
  square 800→1400 + sine 400→900 + noise burst.
- `audio.beaconDestroy()` — digital shutdown chirp: sine 1200→200 + square
  800→100 + high noise burst.
- `audio.beaconTrigger()` — alert klaxon: two-tone square 500/700 Hz
  alternating + sub-bass sine 80→60 + low noise (reverb send).

### Proximity Mines (floor 3+)

**Concept:** Hidden explosive traps that add spatial awareness and tactical depth.
Semi-hidden on floor tiles, they detonate when stepped on by any entity.
Player agency: spot and avoid, shoot to pre-detonate from range, or lure enemies
into them. Chain reactions between clustered mines create satisfying cascades.

**Runtime:** Mine helpers live in `src/entities/mines.js` and operate on the
shared `mines[]` array declared by `src/entities.js` (entity-based, like
beacons/vcores — not tile-based).

**Placement:**
- Floor 3+, normal rooms only (no `roomType`), room ≥ 5×5.
- ~40% chance per qualifying room, 0–1 mine per room.
- Interior position (2 tiles from room boundary), on `T.FLOOR` tile.
- Minimum 1.5-tile spacing from beacons, vcores, and crates.

**Mine properties:**
- `state`: `dormant` → `armed` → `detonated` (strict one-way state machine).
- `revealed`: persistent flag — once the player gets close, stays visible for the floor.
- `dmg`: `12 + floor × 3` (environmental — bypasses player defense).

**Constants:**
- `MINE_TRIGGER_RADIUS = 0.9` — proximity trigger distance.
- `MINE_REVEAL_RADIUS = 3.0` — distance at which mine becomes visible.
- `MINE_BLAST_RADIUS = 2.0` — AoE explosion radius.
- `MINE_FUSE_NORMAL = 0.8` — fuse time when walked into.
- `MINE_FUSE_SHOT = 0.3` — fuse time when shot by player projectile.

**Trigger conditions:**
- Player or enemy within `MINE_TRIGGER_RADIUS` → arm with normal fuse.
- Player projectile hit (within 0.6 tiles) → arm with short fuse.
- AoE from VCore, grenade, VOLATILE/EXPLOSIVE_KILLS death, Detonation affix → arm
  with staggered fuse (0.1–0.15s) for cascade effect.
- Enemy projectiles do NOT trigger mines (consistent with beacons).

**Detonation effects (LOS-gated):**
- Damages all enemies in blast radius.
- Damages player (bypasses defense, respects immunity/i-frames).
- Chains to nearby dormant mines (staggered).
- Primes nearby VCores.
- Damages nearby crates and beacons.

**Visual:**
- Dormant: very subtle shimmer (α ≈ 0.08–0.13, orange 3px circle).
- Revealed: brighter orange glow (α ≈ 0.3–0.5) with hazard ring.
- Armed: rapid red flash with expanding warning ring.
- Detonation: orange/yellow explosion particle burst + camera shake.

**Minimap:**
- Dormant: hidden.
- Revealed: orange 1.5px dot.
- Armed: flashing orange dot.

**Audio:**
- `audio.mineArm()` — metallic click + ascending square-wave warning tone.
- `audio.mineExplode()` — concussive blast: low sine thud 60→30 Hz + square
  crack 200→80 + high noise burst + debris rattle.

### Shield Generators (floor 5+)

Destructible environmental devices that project a damage-reduction field on all
enemies in their room. Forces target prioritisation — destroy the generator
first, or fight through the resistance.

**Placement:**
- One per qualifying room, ~30% chance.
- Normal rooms only (no special `roomType`), room must have ≥ 3 spawned
  enemies, area ≥ 5×5 tiles.
- Interior position (2+ tiles from room boundary), not near other
  environmental objects (crates, beacons, mines, vcores — 1.5-tile spacing).
- Never spawns in a room that already has an alarm beacon.
- Shield generator helpers live in `src/entities/shield-generators.js` and
  operate on the shared `shieldGens[]` entity array declared by
  `src/entities.js`. Public creation helper:
  `createShieldGen(x, y, floor, room)`.

**Stats:**
- HP: `15 + floor × 4`
- Passive object — no attack, no movement, no activation trigger.

**Shield Effect:**
- All non-boss, non-disguised enemies in the same room take **35% reduced
  damage** while the generator is active (`SHIELD_GEN_DR = 0.35`).
- Damage reduction applies in `enemy.takeDamage()` after elite SHIELDED
  shield absorption but before final HP subtraction. Minimum 1 damage.
- Spatial check: enemy must be physically inside the room bounds (not just
  spawn-room reference), preventing kited enemies from keeping the buff.
- `isEnemyShieldGenProtected(e)` helper.

**Damage Sources:**
- Player projectile direct hit (0.6-tile collision radius).
- AoE: VCore, grenade, mine, VOLATILE/EXPLOSIVE_KILLS/Detonation affix
  explosions — `damageShieldGensInRadius()` wired at every existing AoE
  callsite (mirrors `damageBeaconsInRadius`).
- Hackware EMP Burst: deals 15 damage to generators in range (4 tiles,
  LOS-gated).
- Hackware Static Field: damages generators in range each 1 s tick
  (same cadence as enemy damage).
- NOT damaged by enemy projectiles.

**On Destruction:**
- EMP burst: all non-boss, non-disguised enemies within 3 tiles stunned for
  0.8 s (LOS-gated). Weaker than player EMP hackware.
- Credit reward: `floor × 5` (with difficulty, meta, and Credit Siphon
  multipliers).
- Cyan explosion + spark particles, camera shake.
- `audio.generatorDestroy()` SFX.

**Room-Clear:** Shield generators do **not** block room-clear (unlike alarm
beacons). They are a combat modifier, not a gate.

**Visual:**
- Idle: Rotating cyan hexagonal frame (6-vertex stroke) with bright inner
  core dot. Pulsing glow.
- Active: Dashed cyan energy beams drawn from generator to each protected
  enemy in room (skips disguised mimics).
- Protected enemies: subtle cyan underglow (`isEnemyShieldGenProtected`
  check in `enemy.draw()`).
- HP bar shown when damaged (cyan, 16 px wide, 2 px tall).

**Minimap:** Cyan 2 px dot with glow (compact minimap). Pulsing at ~1 Hz.

**Save/Load:** Not persisted — floor regenerates on continue (same as all
environmental objects).

**Audio:**
- `audio.generatorDestroy()` — electric overload burst: ascending sawtooth
  whine 400→2400 Hz + square layer 600→1800 + sub-bass sine 80→40 +
  noise crack + descending triangle tail 1200→300.

### Secret Rooms (Cracked Walls)

### Security Cameras (floor 4+)

Wall-mounted surveillance devices that sweep a vision cone and detect the
player. On detection, a 1.5-second alert countdown begins — if not destroyed
or evaded, the camera triggers reinforcement spawns.

**Placement:** 0–1 per qualifying normal room (not spawn, boss, secret, or
special rooms). ~30% chance per eligible room. Room must be ≥ 6 × 6.
Not placed in rooms that already contain alarm beacons (prevents alarm
stacking). Mounted on interior floor tiles adjacent to a solid wall, excluding
door-adjacent tiles and corner tiles (> 1 adjacent wall). Camera faces into the
room perpendicular to its wall.

**Entity array:** `cameras[]` in `entities.js`. Camera helpers live in
`src/entities/security-systems.js` and operate on the shared collection. Object
properties: `{x, y, hp, maxHp, dead, room, floor, wallSide, baseAngle,
sweepAngle, sweepDir, state, alertTimer, rearmCd, bob}`.

**HP:** `12 + floor × 3`.

**Detection Cone:**
- Beam half-angle: 30° (60° total beam width).
- Sweep oscillation: ±60° from base facing (120° total coverage over time).
- Sweep speed: 45°/s.
- Range: 5 tiles.
- Detection requires: player inside camera's room bounds, player in cone
  sector, line-of-sight check (`hasLOS`), and `canTargetPlayer()` (respects
  Phase Cloak).

**States:**
- `scanning` — default. Cone sweeps back and forth. Transitions to `alerted`
  when player is detected (subject to 0.5 s rearm cooldown after a previous
  alert).
- `alerted` — 1.5 s countdown. Alert timer bar shown. If player leaves cone
  before timer expires → back to `scanning` (with rearm cooldown). If timer
  reaches zero → `triggered`.
- `triggered` — camera is destroyed. 2–3 reinforcement enemies spawned in
  room via `pendingEnemySpawns` (same pattern as alarm beacons).

**Damage:**
- Damaged by: player projectiles, EMP hackware (15 dmg), Static Field
  (10 dmg/s, 1 s interval), volatile core blasts, mine blasts, grenade AoE,
  reactive armor AoE, enemy death AoE.
- NOT damaged by enemy projectiles.
- On destroy: red/orange explosion + spark particles, credit reward
  (`floor × 4` with multipliers), `audio.cameraDestroy()` SFX. Triggers
  room-clear re-evaluation.

**Room-Clear:** Scanning cameras do **not** block room-clear. Alerted cameras
**do** block room-clear (prevents "ROOM CLEARED!" immediately followed by
reinforcements).

**Visual:**
- Cone: semi-transparent red sector, raycast-clipped against walls (does not
  render through walls). Alerted state: fast red-yellow pulse. Scanning: subtle
  slow pulse.
- Body: small dark rectangle on the wall tile with a red lens dot. Oriented
  to wall direction.
- Alert bar: 16 px wide countdown bar (orange → red as time depletes).
- HP bar: shown when damaged (red, 16 px wide, 2 px tall).

**Minimap:** Small red triangle with glow. Alerted cameras pulse brighter.

**Save/Load:** Not persisted — floor regenerates on continue.

**Audio:**
- `audio.cameraDetect()` — short rising two-tone chirp (square wave
  800→1200 + 1200→1600).
- `audio.cameraAlert()` — alarm siren: descending sawtooth 1400→600 +
  square 1000→400 + noise crackle + sub-bass sine 200→80.
- `audio.cameraDestroy()` — electronic crunch: noise burst + descending
  sawtooth 600→200 + sine tail 300→100.

### Laser Tripwires (floor 3+)

Wall-mounted laser emitter pairs that project visible beams across rooms.
Breaking the beam deals damage and applies a brief shock. Each emitter can
be destroyed independently — destroying either one disables the beam.

**Entity:** `lasers[]` global array. Laser helpers live in
`src/entities/security-systems.js` and operate on the shared collection. Each
laser has two emitter positions (`x1,y1` and `x2,y2`) with independent HP pools
(`hpA`, `hpB`). Emitter HP: `10 + floor × 3`. Axis: `'H'` (horizontal) or
`'V'` (vertical).

**Placement:** 0–1 per qualifying normal room on floor 3+ (not spawn, boss,
secret, or special rooms). ~25% chance per eligible room. Room must be ≥ 5
tiles wide or tall. Not placed in rooms that already contain alarm beacons
or security cameras (prevents frustrating hazard stacking). Emitters are
placed on wall-adjacent floor tiles with a clear beam path between them
(minimum 3-tile span). Not near doors (manhattan ≤ 1).

**Cycling beams:** ~20% of lasers cycle on/off (1.5 s on, 1.5 s off). During
the off phase, beam is inactive and shown as a dim dotted line. A 0.2 s
rearm grace period after cycle-on prevents cheap hits.

**Player interaction:**
- **Beam crossing:** Segment intersection between player's previous and
  current position (handles fast movement). Also a 0.25-tile proximity check
  for standing near the beam line. Deals `8 + floor × 2` damage and applies
  0.3 s shock (movement suppress via `shockTimer`, same as existing system).
  2 s hit cooldown per laser.
- **Dash:** Bypasses laser tripwires (player `dashTimer > 0` skips hit).
- **Phase Cloak:** Player passes through without triggering (uses
  `canTargetPlayer()` check, same as cameras).
- **Crate blocking:** Beam dynamically checks LOS along its path each frame.
  If an opaque tile (crate, wall) is placed in the beam path, the beam is
  suspended until the path clears.

**Destructible emitters:**
- Player projectiles hitting within 0.5 tiles of either emitter deal weapon
  damage to that emitter's HP pool via `damageLaserEmitter()`.
- Destroying either emitter disables the beam entirely and awards credits
  (`floor × 3 × multipliers`).
- EMP: Disables all lasers in radius for 3 s (beam deactivates, no damage,
  emitters spark). `audio.laserDisable()`.
- Static Field: Damages both emitters on 1 s interval (same pattern as
  cameras/shield generators, uses object-reference Map keys).

**Room-clear:** Lasers do NOT block room-clear (they are passive hazards,
not security devices).

**Visual:**
- Emitter nodes: small teal/orange rectangles (6×6 px housing, 4×4 inner)
  with pulsing lens dot.
- Active beam: bright red/orange line (`#ff4422`) with glow, pulsing opacity.
- Cycling off: dim dotted line.
- Disabled (EMP): emitters spark cyan, no beam.
- HP bar shown on damaged emitters.

**Minimap:** Thin red/orange line between emitter dots. Dimmed when inactive
or disabled.

**Death recap source:** `'laser'` → "Laser Tripwire" (#ff6644).

**Audio:**
- `audio.laserHit()` — sharp electric zap: high sawtooth 1800→600 + square
  900→300 + noise burst.
- `audio.laserDisable()` — power-down whine: descending sine 800→100 +
  triangle 400→50.
- `audio.laserDestroy()` — sparking collapse: noise burst + descending
  sawtooth 700→150 + sine tail 400→80.

**All non-boss floors.** One secret room per qualifying floor. A normal
BSP room is walled off completely and one narrow entrance cluster (1–2 tiles)
is replaced with `T.CRACKED` tiles. The room is invisible to the player until
discovered.

**Candidate selection:** Rooms must not be spawn, stair, boss, vendor, or any
existing special room. Must have at least one narrow entrance cluster (≤ 2
tiles). Candidate list is shuffled; the first qualifying room is chosen.
Secret rooms are excluded from locked-door placement.

**Tile: `T.CRACKED` (value 15).** Not passable, not see-through (behaves
like a wall for movement, LOS, and BFS reachability). On the minimap, renders
identically to WALL (no spoilers). In the main view, renders as a standard
wall tile with subtle amber crack lines visible only when the player is
within 3 tiles — crack opacity scales with proximity.

**Interaction:** Press E adjacent to a cracked wall to break it. The tile
becomes `T.FLOOR` and the secret room is revealed. Breaking triggers:
`audio.wallBreak()` SFX, explosion particles, "SECRET AREA DISCOVERED"
message (amber), score bonus (300 × floor).

**Secret room mask (`secretMask`):** A per-tile boolean grid that prevents
player torch light and sconce light from marking secret-room tiles as visited
or lit. This ensures the room contents are completely invisible before reveal.

**Lazy activation:** Enemies and items are **not** spawned during floor
generation. On reveal (`revealSecretRoom`):
1. `secretMask` cleared for the room's tiles.
2. All remaining `T.CRACKED` tiles adjacent to the room become `T.FLOOR`.
3. Enemies spawned: reduced count (`1 + floor÷4` to `min(4, 2 + floor÷3)`,
   area-capped at `room.w × room.h ÷ 10`).
4. Premium loot: floor-scaled items (1 item floors 1–3, 2 items floors 4–6,
   2–3 items floors 7+; large rooms ≥ 40 tiles² get +1 at floor 7+) + one
   pre-rolled `WeaponCacheItem` + bonus credits
   (`round(20 × (1 + floor × 0.15))`).
5. Weapon caches roll a floor-scaled weapon (`rollWeapon(base, floor + 2)`)
   preferring bases not already in the player's belt. Pickup adds the weapon to
   an open belt slot; if the belt is full, the `WEAPON_SWAP` modal asks the
   player to replace slot 1–3 or skip the cache.

**Quest interactions:**
- **EXPLORE:** Unrevealed secret rooms are excluded from the "visit every room"
  check. Revealed secret rooms count normally.
- **EXTERMINATE:** Unaffected — no enemies exist in secret rooms until reveal.
  Secret rooms can appear on boss floors (the boss room itself is excluded from
  candidates, but other rooms on the floor are eligible).
- **SPEEDRUN / PACIFIST:** Unaffected — secret rooms are optional.

**Visual style:** Room floor tiles use tint `#1a1005` (warm amber-dark).

**Audio: `audio.wallBreak()`** — crumbling rock: noise burst (LP 2 kHz) +
sine rumble 80→30 Hz + triangle sub 40→20 Hz + 3 staggered debris clinks
(sine 800–1400→half Hz).

### Wall Turrets (floor 5+)

**Concept:** Wall-mounted automated defense turrets. Environmental entities
(not enemies) that the player must destroy or hack. The hack-or-destroy
decision adds a meaningful tactical choice: hack a turret with EMP to gain
an ally for the room, or shoot it down for credits.

**Placement:** 1–2 per qualifying normal room (floor 5+, room ≥ 6×6, not
spawn, boss, or special room type). ~25% of eligible rooms. Mutually
exclusive with security cameras (both use wall-mount positions, too busy
together). Can coexist with beacons, shield generators, lasers, mines,
crates, and volatile cores. Uses the same wall-mount-point algorithm as
cameras: interior floor tile adjacent to a solid wall, not near doors,
stairs, or corners (single-wall adjacency only), not within 1.5 tiles of
other environmental entities, 2.5 tiles between wall turrets.

**Entity: `wallTurrets[]` array.** Wall turret helpers live in
`src/entities/wall-turrets.js` and operate on the shared collection. Each entry:
`{ x, y, hp, maxHp, dead, hacked, room, floor, wallSide, baseAngle, scanAngle,
scanDir, shootTimer, disabled, disableTimer, bob, hackFlash }`. HP scales with
floor: `12 + floor × 3`.

**Behavior — Hostile (default):**
- Scans for player within 6-tile range with LOS.
- Fires an enemy projectile (`fromPlayer=false`) every 1.8 s.
- Projectile: speed 7, range 10, colour `#ff4400` (red-orange).
- Damage: `round(5 + floor × 1.5)`.
- Barrel rotates to track detected player; sweeps ±60° when idle.
- Phase Cloak: turret loses target (cloaked player not targetable).

**Behavior — Hacked (player ally):**
- Targets nearest non-boss, non-disguised enemy in same room with LOS,
  within 7-tile range.
- Fires allied projectiles (`fromPlayer=false`, `isAllyTurret=true`) every
  1.5 s (slightly faster than hostile).
- Damage: same formula, colour `#00ffaa` (green-cyan).
- Allied projectiles hit enemies (shield deflection applies) but do NOT
  apply player augments, weapon affixes, or perk effects — they are a
  separate damage source ("Wall Turret").
- Lasts until turret is destroyed (persists across room visits on same floor).

**Hacking mechanic:**
- EMP Burst converts all wall turrets in blast radius to `hacked=true`
  (permanent, LOS-gated).
- This extends EMP's existing environmental interaction pattern (cameras,
  shield generators, lasers).
- Audio: `audio.turretHack()`. Floating text: `◇ HACKED`.
- Brief green pulse visual on hack.

**Damage sources:**
- Player projectiles (when hostile).
- All AoE sources: Volatile Core detonation, grenade explosion, volatile/
  explosive-kills death explosion, weapon EXPLOSIVE affix on-kill, LEAPER
  shockwave, mine detonation.
- Static Field: damages hostile turrets at 1 s intervals.
- Enemy projectiles damage hacked turrets.
- Turrets are NOT damaged by toxic pools, plasma vents, or arc grids (they
  are wall-mounted, not floor-level).

**On destruction:**
- Credits: `floor × 3` (economy multipliers apply).
- Particles: orange explosion + orange sparks.
- Room-clear re-evaluation triggered.
- `audio.turretDestroy()` SFX.

**Room-clear interaction:**
- Hostile wall turrets **block** room-clear (like alarm beacons). The player
  must either destroy or hack all turrets before the room is cleared.
- Hacked wall turrets do **not** block room-clear.
- Hacking a turret triggers room-clear re-evaluation (the blocking condition
  changed).
- `room._hadEnemies` is set when turrets are placed, enabling the room-clear
  tracking path.

**Minimap:**
- Compact minimap: small dot — `#ff4400` (red-orange) hostile, `#00ffaa`
  (green) hacked.
- Expanded minimap: not rendered separately (turrets sit on FLOOR tiles).

**Visual (canvas draw):**
- Wall mount base: dark rectangle against wall.
- Rotating barrel: red-orange (hostile) or green-cyan (hacked) glow, darker
  muzzle tip. Grey when disabled.
- HP bar appears when damaged.
- Hack flash: brief expanding green glow on conversion.

**Audio:**
- `audio.turretFire()` — short mechanical burst (square 200→100 Hz +
  sawtooth 400→200 Hz + noise snap).
- `audio.turretHack()` — rising digital chirp (ascending sine/square/
  triangle + noise tail).
- `audio.turretDestroy()` — metallic crunch + sparks (sawtooth 180→60 Hz +
  square 120→40 Hz + two noise layers).

---

## Player

### Stats

| Stat      | Base | Notes                           |
|-----------|------|---------------------------------|
| HP        | 100  | Death → GAME_OVER               |
| MAX_HP    | 100  | Increases +20 on level-up       |
| ATK       | 10   | Melee damage                    |
| DEF       | 2    | Flat damage reduction           |
| SPD       | 3.5  | Tiles/sec movement              |
| LEVEL     | 1    | Max 10                          |
| XP        | 0    | XP to next level = level × 80   |

On level-up: +20 MAX_HP (full heal), +3 ATK, +1 DEF. Certain levels also
unlock passive **perks** (see Level-Up Perks section under Items & Upgrades).

### Controls — Keyboard & Mouse

| Input              | Action                    |
|--------------------|---------------------------|
| WASD / Arrow keys  | Move                      |
| Mouse              | Aim                       |
| Left Click / Space | Fire weapon               |
| Shift              | Dash (dodge)              |
| E                  | Interact (door/stairs)    |
| I                  | Toggle inventory           |
| ESC                | Pause / back to menu       |

Hidden developer hatch: pressing keyboard `F`, `E`, `E`, `Shift` or tapping the
mobile `F`, `E`, `E`, `⇧` buttons outside text-entry and key-capture states
opens the `CHEATS` modal. The modal is runtime-only and not part of normal
progression or save data. It can toggle invulnerability, no-clip movement, full
map rendering, and hyper-speed movement for local testing.

### Controls — Touch (dual-joystick)

On touch devices, the game uses a dual-joystick layout with virtual buttons:

| Input                             | Action                      |
|-----------------------------------|-----------------------------|
| Left-half touch & drag            | Move joystick (base radius 55 px) |
| Right-half touch & drag           | Aim joystick — holding fires automatically |
| E button (bottom-right, cyan)     | Interact (door/stairs)      |
| F button (bottom-right, amber)    | Activate hackware (always visible; dimmed when unequipped) |
| ⇧ button (bottom-right, amber)   | Dash (dodge)                |
| V button (bottom-right, purple)   | Use void shard              |
| ‖ button (top-right, magenta)     | Pause                       |

Joystick deflection is clamped to the base radius and normalised to 0–1.
Ghost joystick hints (12 % opacity) are drawn when inactive so the player
knows where to touch. Active joysticks render at 35 % opacity.

Touch events call `preventDefault()` (passive: false) to suppress browser
scroll/zoom. The CSS rule `touch-action: none` is applied globally.

### Weapons

Player carries one weapon at a time. Weapons found as floor drops.

| Weapon       | Damage  | Fire Rate | Range | Projectile      |
|--------------|---------|-----------|-------|-----------------|
| PULSE PISTOL | 15      | 3/s       | 10    | fast bolt       |
| SCATTER GUN  | 8 × 4   | 1/s       | 5     | 4 spread bolts  |
| RAILGUN      | 60      | 0.5/s     | 20    | piercing beam   |
| PLASMA SWORD | 25      | 2/s melee | 1.5   | melee arc       |
| VOID CANNON  | 45      | 1.5/s     | 12    | slow heavy bolt |

Default starting weapon: PULSE PISTOL.

### Weapon Affixes

Weapons found on floor 2+ may roll random affixes that modify their stats and grant on-hit/on-kill effects. Each weapon can have at most one prefix (stat modifier) and one suffix (effect).

**Rarity tiers:**
- **Common** (white, no affixes) — guaranteed on floor 1
- **Uncommon** (green, 1 affix) — available floor 2+
- **Rare** (purple, 2 affixes: prefix + suffix) — available floor 4+

**Affix chance by floor:**

| Floor | No affix | 1 affix | 2 affixes |
|-------|----------|---------|-----------|
| 1     | 100%     | 0%      | 0%        |
| 2–3   | 50%      | 50%     | 0%        |
| 4–5   | 30%      | 45%     | 25%       |
| 6+    | 20%      | 40%     | 40%       |

**Prefix affixes (stat modifiers):**

| Affix    | Effect                       | Eligibility       |
|----------|------------------------------|--------------------|
| Rapid    | +30% fire rate               | All weapons        |
| Heavy    | +35% damage, −20% fire rate  | All weapons        |
| Extended | +40% range                   | Ranged only        |
| Twin     | +1 projectile, −15% damage   | Ranged only        |
| Precise  | −60% spread                  | Spread weapons only|

**Suffix affixes (on-hit / on-kill effects):**

| Affix        | Effect                                              |
|--------------|------------------------------------------------------|
| of Flame     | Ignites: 3 DPS burn for 3 s (orange particles)       |
| of Frost     | Slows: 30% speed reduction for 2 s (cyan tint)       |
| of Vampirism | Heals player for 8% of actual damage dealt            |
| of Thunder   | 20% chance chain lightning to nearest enemy within 3 tiles for 50% damage |
| of Detonation| Enemies explode on kill: 25 AoE damage in 2-tile radius (LOS-gated, also damages player at 50%) |
| of Storms    | Shocks: 0.6 s stun (0.3 s on bosses) with 2 s per-enemy internal cooldown (prevents perma-stun) |

**Naming convention:** `"[Prefix] Base Name [Suffix]"` (e.g., "Rapid Pulse Pistol of Flame").

**Proc rules:**
- On-hit effects (burn, slow, leech, chain, shock) trigger from both projectile hits and melee hits.
- Chain lightning and detonation AoE are "proc" damage — they do not trigger further on-hit effects (prevents recursion).
- Burn damage-over-time ticks can trigger on-kill effects (detonation).
- Detonation AoE damages the player at 50% if in range (LOS-gated), similar to VOLATILE modifier.
- Shock uses `enemy.stunTimer` (shared with EMP hackware) but has a per-enemy 2 s internal cooldown (`_shockICD`) to prevent stunlock from fast weapons.
- Projectile movement is swept through every crossed tile in `Projectile.update()`, so fast or large-frame-step player, enemy, ally-turret, reflected, homing, and auto-spell shots cannot tunnel through intervening walls or closed diagonal wall corners.

**Visual indicators:**
- Burning enemies: flickering orange underglow.
- Slowed enemies: cyan tint overlay.
- Shocked enemies: yellow spark particles (from VOLTAIC or EMP stun).
- Chain lightning: jagged yellow bolt between targets (0.15 s fade).
- Weapon name in HUD uses rarity colour (green for uncommon, purple for rare).
- Upgrade/vendor cards show rarity border glow and affix descriptions.

**Save format:** weapon saved as `{ _base: 'PULSE_PISTOL', _affixes: ['RAPID', 'FLAME'] }` instead of plain key string. `buildWeapon()` deterministically reconstructs from base + affixes on load (no re-rolling).

**Implementation:** `buildWeapon(baseKey, affixIds)` for deterministic construction; `rollWeapon(baseKey, floor)` for random generation. `src/entities/combat-effects.js` owns `applyHitEffects(enemy, actualDmg, hitCtx)` for on-hit logic, `_applyStunOnlyEffects(enemy, hitCtx)` for phase-immune shock routing, and `applyOnKill(enemy)` for detonation. `src/entities/status-effects.js` owns `tickEnemyStatusEffects(enemy, dt)`, which processes burn/poison/slow/mark decay and shock/recoil/stagger ICDs per frame. Enemy class stores `burnTimer`, `burnDps`, `poisonTimer`, `poisonStacks`, `slowTimer`, `slowFactor`, `_markedTimer`, `_lastHitCtx`, `_shockICD`, `_recoilICD`, and `_staggerICD`.

### Level-Up Effects (automatic on XP threshold)

- MAX_HP +20, HP fully restored
- ATK +3
- DEF +1
- Brief screen flash + sound sting

### Dash (Dodge)

The player can perform a short burst-dash to evade attacks. Available from
floor 1 with no unlock requirement.

| Property       | Value                                              |
|----------------|----------------------------------------------------|
| Keybind        | Shift (keyboard), ⇧ button (touch)                |
| Direction      | Movement direction if moving; facing direction otherwise |
| Speed          | 18 tiles/sec (~5× normal walk speed)               |
| Duration       | 0.12 s (~2.2 tiles travel)                         |
| Cooldown       | 1.5 s (shown on HUD when active)                  |
| Invulnerability| Player has i-frames for the entire dash duration   |
| Collision      | Wall collision ends the dash early                 |
| Visual         | Amber afterimage trail (up to 8 ghosts, fade 0.25s), amber spark particles |
| Audio          | Whoosh (rising noise burst + descending sine sweep) |

During a dash, normal movement and shooting are suppressed. The player cannot
dash while dead or while the cooldown is active.

### Hackware — Active Abilities

Hackware modules are collectible active abilities the player can equip during
a run. Only one can be equipped at a time; finding a new one replaces the
current one (cooldown resets on equip). Available from floor 3.

| Property       | Value                                              |
|----------------|----------------------------------------------------|
| Keybind        | F (keyboard), F button (touch — always visible, dimmed when unequipped) |
| Slot           | Single slot — one hackware at a time               |
| Source         | Level-up powerup choice (~12%), vendor shop (~40% per vendor on floor 3+) |

#### Modules

| Module         | Cooldown | Effect                                             | Colour  | Icon |
|----------------|----------|----------------------------------------------------|---------|------|
| EMP Burst      | 10 s     | Stun enemies within 4 tiles (LOS required) for 2s. Bosses: 1s. Hacks wall turrets (converts hostile→allied). Visual: expanding cyan ring. | `#00ddff` | ⚡ |
| Phase Cloak    | 14 s     | 2.5s invisibility + damage immunity. Enemies lose targeting. Projectiles pass through. Player can still shoot. | `#cc44ff` | ◇ |
| Nano Swarm     | 10 s     | Release 6 homing nanite particles. Each deals 8 damage on contact (0.5s hit cooldown per nanite). Homes toward nearest visible enemy. 4s lifetime. | `#44ff88` | ☢ |
| Gravity Well   | 16 s     | Place a pull point at aim position. Pulls enemies within 5 tiles toward center for 3s. Bosses immune to pull. LOS required. Collision-aware movement. | `#ff8800` | ◎ |
| Static Field   | 12 s     | Place an electric zone at aim position. 3-tile radius, 5s duration. Enemies inside take 10 dmg/s (1s hit interval, LOS required) and are slowed 40% (bosses: 15%). Max 1 field active; recasting replaces the existing field. | `#44ccff` | ⌁ |
| Holo Decoy     | 12 s     | Place a holographic decoy at aim position. 4s duration. Taunts non-boss enemies within 5 tiles (LOS required to acquire, 7-tile break range). Taunted enemies move toward and attack the hologram instead of the player. Melee attacks whiff on the hologram; projectiles aimed at it miss the player. On expiry: 0.5s mini-stun on enemies within 2 tiles. Max 1 active; recasting replaces the existing hologram. Disguised mimics and phased wraiths cannot be taunted. | `#ff44ff` | ⬡ |

#### Enemy Stun Mechanic

Stunned enemies (`stunTimer > 0`):
- Skip all AI (no movement, no attacks, no shooting)
- Attack/shoot cooldown timers are frozen (prevent charge-up during stun)
- Still take damage normally
- Visual: cyan spark particles during stun

#### Phase Cloak Mechanic

When cloaked (`player.cloakTimer > 0`):
- `isPlayerDamageImmune()` returns true — blocks all damage paths including:
  - `player.takeDamage()` (melee, projectile, boss specials)
  - Plasma burn (direct HP reduction)
  - Arc grid zap (direct HP reduction)
- `canTargetPlayer()` returns false — enemies lose targeting:
  - LOS calculations return false
  - Proximity-based detection gated
  - Melee attacks blocked
  - Drones, phantoms, teleporters lose tracking
- Player rendered as ghostly purple with shimmer effect
- Bosses still use area attacks (radial patterns) but damage is blocked
- Audio: shimmer on activation, shimmer-out on expiry

#### Static Field Mechanic

When deployed (`hackwareEffects` entry with `type:'static_field'`):
- Placed at aim position (same targeting as Gravity Well)
- 3-tile radius, 5-second duration
- Enemies inside with LOS to field center: 10 damage per second (1s hit interval per enemy), slowed to 60% speed (bosses: 85%)
- Slow uses stronger-wins logic: `slowTimer = Math.max(existing, 0.3)`, `slowFactor = Math.min(existing, factor)`
- Max 1 active field — recasting removes the previous one
- Visual: pulsing cyan ring with 3 rotating arc segments, white core spark, ambient spark particles
- Audio: electric crackle on deployment (one-shot)
- Damage source: `Static Field` (for death recap)

#### Holo Decoy Mechanic

When deployed (`hackwareEffects` entry with `type:'hologram'`):
- Placed at aim position (same targeting as Gravity Well / Static Field)
- 4-second duration, max 1 active — recasting removes previous hologram + clears taunt refs
- **Taunt system** (`_tauntTarget` + `_tx/_ty` on `Enemy`):
  - Enemies within 5 tiles with LOS to hologram acquire taunt (set `_tauntTarget = fx`)
  - Taunted enemies break taunt at 7 tiles (no LOS required to retain)
  - Taunted enemies perceive the hologram as the player: `_tx/_ty` set to hologram position
  - `d`, `los`, and `targetable` in `Enemy.update()` are computed from perceived target
  - All non-boss AI functions use `_tx/_ty` for movement, firing, aiming, retreat direction
  - `_canTarget()` returns true for taunted enemies (overrides Phase Cloak)
  - Damage delivery paths (CHARGER charge hit, LEAPER shockwave, SEEKER detonation) use real `player.x/player.y` — enemies are fooled about position but can't hurt what isn't there
  - `meleeAttack()` includes real-distance guard: `dist(this, player) > 1.2` → whiff
- **Exclusions**: bosses immune, disguised mimics and phased wraiths cannot acquire taunt (but wraiths taunted while corporeal keep taunt through phasing)
- **Expiry**: 0.5s mini-stun on enemies within 2 tiles of hologram, all taunt refs cleared
- Visual: flickering magenta hexagon with scanline effect, ambient particles
- Audio: `audio.holoDecoyDeploy()` shimmer on deploy, `audio.holoDecoyExpire()` shatter on expiry
- Status badge: `⬡` with countdown timer while active

#### Persistence

- `player.hackware` (string key or null) and `player.hackwareCooldown` (number) stored in save data
- Cloak timer is NOT saved (transient effect — expires on floor transition)
- `hackwareEffects[]` array cleared on floor load (gravity wells, swarm particles)
- No save version bump — new fields default to `null`/`0` on old saves

---

## Enemies

### Common (floors 1–15, scaled by floor)

| Type         | HP base | ATK | Behaviour                                    | XP  |
|--------------|---------|-----|----------------------------------------------|-----|
| GUARD        | 40      | 8   | Patrol → chase on sight, melee               | 20  |
| TURRET       | 25      | 12  | Stationary, fires projectiles at player      | 15  |
| CRAWLER      | 20      | 6   | Fast zigzag charge, melee; **inflicts burn** | 10  |
| PHANTOM      | 35      | 10  | Invisible until within 3 tiles, teleports   | 30  |
| DRONE        | 15      | 8   | Flies over walls (no collision), ranged     | 12  |
| SHIELDER     | 50      | 10  | Frontal shield blocks projectiles, melee    | 25  |
| SPLITTER     | 40      | 8   | Splits into 2 SHARDs on death               | 25  |
| GRENADIER    | 30      | 10  | Lobs grenades creating AoE damage zones     | 20  |
| TELEPORTER   | 25      | 12  | Blinks around room, fires ranged bursts      | 22  |
| SNIPER       | 20      | 15  | Laser-sight charge, fast high-damage shot; **inflicts shock** | 25  |
| SUMMONER     | 35      | 8   | Stays at range, periodically summons minion drones | 30  |
| HEALER       | 25      | 6   | Stays at range, periodically heals wounded allies | 22  |
| CHARGER      | 45      | 14  | Slow patrol, telegraphed charge rush, melee   | 22  |
| SCORCHER     | 28      | 9   | Strafes around player, drops short-lived fire trail hazards | 24  |
| BRUTE        | 70      | 16  | Melee-only heavy pursuer, relentless close-range pressure | 30  |
| LEAPER       | 30      | 11  | Fast, jumps to player position, shockwave on landing | 22  |
| REFLECTOR    | 40      | 10  | Reflective shield bounces projectiles back     | 28  |
| DISRUPTOR    | 30      | 9   | Deploys persistent area-denial fields          | 25  |
| WRAITH       | 35      | 13  | Phases through walls, emerges to attack         | 30  |
| NEXUS        | 40      | 8   | Links to allies granting DR, death stuns linked | 35  |
| SIPHON       | 30      | 10  | Life-draining ranged attacker, self-heals on hit | 28  |
| GRAVITON     | 45      | 8   | Deploys gravity wells that pull the player     | 30  |
| SEEKER       | 18      | 12  | Kamikaze drone, rushes and detonates on contact | 12  |
| PULSER       | 20      | 12  | Telegraphed charge-up bolt, retreats on cooldown | 15  |

HP and ATK scale: `value × (1 + 0.15 × (floor - 1))`

**Floor-gated types:** PULSER appears floor 2+, LEAPER appears floor 2+,
SHIELDER appears floor 3+, SEEKER appears floor 3+, BRUTE appears floor 3+,
SPLITTER appears floor 4+, CHARGER appears floor 4+, SCORCHER appears floor 4+,
GRENADIER appears floor 5+, HEALER appears floor 5+,
TELEPORTER appears floor 6+, SUMMONER appears floor 6+, DISRUPTOR appears floor 6+,
SNIPER appears floor 7+,
REFLECTOR appears floor 7+,
GRAVITON appears floor 7+,
WRAITH appears floor 8+,
SIPHON appears floor 8+,
NEXUS appears floor 9+.
Floor-gated types are excluded from both weighted selection and cap-reroll pools
on floors below their minimum.

#### PULSER (floor 2+)

Electromagnetic charge-up attacker that teaches players to read telegraphs and
exploit cooldown windows. Slow approach, visible charge-up with concentric rings
and directional aim line, fires a single heavy bolt, then retreats during cooldown.

- **AI states:** `idle` → `charging` (1 s) → fire → `cooldown` (2.5 s) → `idle`
- **Charge range:** 6 tiles (LOS required). Tracks player during charge.
- **Cancel:** charge aborts if LOS lost, player cloaks, or exits range (+2 buffer).
  Enters 0.8 s post-cancel cooldown to prevent stutter.
- **Projectile:** speed 10, range 14, full ATK damage. Created manually (not via
  `fireAt()`) to avoid double audio. `ownerType = 'Pulser Bolt'`.
- **Cooldown retreat:** half speed, axis-by-axis wall-safe movement away from player.
- **Telegraph visual:** 2 concentric pulsing rings grow from body + dashed aim line
  toward player (3 tiles at full charge). Idle: subtle core glow.
- **Audio:** `audio.pulserCharge()` rising electrical whine; `audio.pulserFire()`
  sharp crack.
- **Colour:** `#44ddff` (electric blue)
- **Credits:** 7
- **Elite ineligible** (early-game teaching enemy; high ATK + elite scaling = unfair)
- **TYPE_CAPS:** 2 per room
- **Spawn weight:** base 5, perFloor 1, minFloor 2

#### SHIELDER (floor 3+)

Shield-bearing enemy with a 120° frontal arc that deflects non-piercing player
projectiles. Slowly advances toward the player when in LOS. Player must flank
(shoot from behind/sides), use piercing weapons (Railgun), or melee to bypass
the shield. Shield orientation only updates when the player is in line of sight
— the shielder does not track through walls.

- **Shield arc:** ±60° from facing direction (120° total)
- **Deflection:** Non-piercing `fromPlayer` projectiles within the arc are
  destroyed on contact (cyan sparks + `shieldDeflect` SFX). Piercing weapons
  and saw blade orbitals are unaffected.
- **Visual:** Cyan arc drawn at shield radius, pulsing with `bobAngle`
- **Colour:** `#66eeff` (cyan-white)
- **Credits:** 10

#### GRENADIER (floor 5+)

Ranged area-denial enemy that lobs grenades creating temporary hazard zones.
Prefers to stay at 6–12 tile range; retreats if player closes to within 5 tiles
(falls back to patrol if retreat is wall-blocked).

- **Grenade:** Projectile (speed 6) aimed at player's current position. On wall
  hit or reaching target, detonates into a **hazard zone** (1.5 tile radius,
  3 s duration, 0.8 s damage tick cooldown). Zone damage equals the grenadier's
  scaled ATK. LOS check prevents damage through walls.
- **Cooldown:** `max(2.5, 3.5 − floor × 0.1)` seconds between lobs
- **Visual:** Larger orange projectile with pulsing warning ring; zone rendered
  as semi-transparent pulsing orange circle below enemies
- **Colour:** `#ff6622` (orange)
- **Credits:** 7

#### SPLITTER (floor 4+)

Fragmentation enemy that splits into 2 smaller SHARD copies on death, forcing
players to manage kill order and swarming. Approaches the player at medium
speed; gains a 30% speed boost below 30% HP as a visual warning that it is
about to split.

- **Split mechanic:** On death, queues 2 SHARD enemies at the death position
  (±1 tile random offset, validated for passability). Spawns are deferred to
  the next frame via `pendingEnemySpawns` to prevent same-frame attacks.
- **SHARD stats:** HP 15, ATK 5, SPD 3.5, XP 8. Uses fast zigzag chase AI
  (similar to CRAWLER). SHARDs spawn with a 0.5 s attack lockout.
- **SHARD economy:** SHARDs drop no items and award 0 credits. XP is minimal
  (8) to prevent economy inflation from split kills.
- **SHARDs do not split** — only the parent SPLITTER fragments.
- **Visual:** SPLITTER is green (`#00ff88`), SHARDs are darker green
  (`#00cc66`) and drawn at 62.5% size (0.25 tile vs 0.4 tile).
- **Audio:** `enemySplit()` — digital fracture sound (twin rising square waves
  + noise crackle).
- **Cap:** 2 SPLITTERs per room (SHARDs are uncapped since they are transient).
- **Credits:** 9 (SHARD: 0)
- **Modifier interactions:**
  - SWARM (0.6× HP): SPLITTERs split faster — intentional chaos amplification
  - FORTIFIED (1.4× HP): Harder to split, fewer SHARDs overall
  - VOLATILE: Deferred spawns are safe from the parent's explosion chain;
    VOLATILE-killed SPLITTERs still split

#### TELEPORTER (floor 6+)

Spatial disruptor that blinks to random positions within its room and fires
quick ranged bursts before relocating. Unlike the PHANTOM (stealthy melee),
the TELEPORTER is always visible but spatially unpredictable — it punishes
players who camp in one spot and rewards target tracking.

- **Teleport cycle:** Every `max(2.0, 3.0 − floor × 0.1)` seconds, blinks to a
  random passable tile within the same room. Leaves a fading magenta afterimage
  at the departure point (0.6 alpha → 0 over ~0.4 s). On arrival, 0.4 s
  materialise window (reduced alpha, cannot attack). After materialising, fires
  2 quick projectiles at the player (0.25 s apart, speed 8, range 14).
- **Emergency blink:** If the player closes to within 2 tiles and the teleporter
  has been idle long enough (cooldown > 0.8 s, not materialising), the cooldown
  is forced to 0, triggering an immediate escape blink next frame. The
  materialise guard prevents frame-loop re-triggers.
- **Stats:** HP 25, ATK 12, SPD 0 (no walking movement), XP 22.
- **Visual:** Hot magenta (`#ff44ff`), rapid alpha flicker
  (`0.7 + sin(bobAngle × 8) × 0.3`) to suggest spatial instability. During
  materialise: alpha ramps from 0.3 → 0.7 over 0.4 s.
- **Audio:** `teleport()` — descending sine + square sweep + high noise pop
  ("zwip" translocate sound).
- **Colour:** `#ff44ff` (hot magenta)
- **Credits:** 8
- **Cap:** 1 per room.
- **Modifier interactions:**
  - OVERCLOCK (÷1.2 cooldowns): Teleport cycle shortened proportionally
  - SWARM (0.6× HP): Even more fragile — reward for fast target acquisition
  - BLACKOUT: Harder to spot the flicker in reduced torch radius

#### SNIPER (floor 7+)

Glass-cannon marksman that locks a visible laser sight on the player's
position, then fires a fast, high-damage projectile. The 1.5 s charge window
gives the player time to dodge sideways — the laser target is locked at the
moment of acquisition, **not** tracking. Rewards awareness and lateral
movement; punishes standing still.

- **Lock-on:** When the player is in the sniper's room, within LOS, and within
  15 tiles, the sniper stops moving and locks a laser sight on the player's
  current position. A rising chirp (`sniperCharge()`) plays.
- **Charge phase (1.5 s fixed):** A pulsing red dotted line from sniper to
  target with increasing opacity (0.15 → 0.65) and a red target dot. Charge
  duration is **never** reduced by OVERCLOCK or BERSERKER affix — the
  telegraph must stay fair.
- **Fire:** At charge end, fires a speed-14 projectile along the locked
  direction (range 20). A sharp crack (`sniperFire()`) plays. After firing,
  enters reposition phase.
- **Reposition (1.0 s):** Moves at 1.5× speed to a far passable tile in its
  room (sampling 15 candidates, picking the farthest from the player). OVERCLOCK
  and berserkerMul scale this timer and the post-fire cooldown, but not the
  charge.
- **Cancel conditions:** Charge aborts if the player cloaks, breaks LOS, leaves
  the room, or gets within 3 tiles. On cancel, a 0.8 s cooldown prevents
  stutter re-lock. If cancelled because the player is too close, the sniper
  flees at 1.3× speed.
- **Room-gated aggro:** The sniper only aggros when `player.x/y` is within the
  sniper's assigned room bounds. This prevents unfair cross-room sniping.
- **Stats:** HP 20, ATK 15, SPD 2.5, XP 25.
- **Visual:** Hot pink-red (`#ff2266`). Idle: faint scope glint above head
  (pulsing 1.5 px dot). Charging: red dotted laser line + target circle.
- **Credits:** 10
- **Cap:** 1 per room.
- **Elite exclusion:** SNIPERs never roll elite — the high ATK + elite HP/ATK
  multiplier would produce unfair damage spikes.
- **Cooldown between shots:** `max(2.5, 3.5 − floor × 0.1)` seconds,
  scaled by berserkerMul and OVERCLOCK.

#### SUMMONER (floor 6+)

Support enemy that periodically summons temporary DRONE minions. Creates a
tactical priority puzzle: kill the summoner to stop reinforcements and
instantly despawn its active minions, or deal with the swarm first.

- **Behaviour:** Stays at 6–14 tile range. Retreats if player closes to
  within 5 tiles (same retreat logic as GRENADIER — falls back to patrol if
  wall-blocked). At range, periodically summons a DRONE minion.
- **Summon cooldown:** `max(3.5, 5 − floor × 0.15)` seconds, scaled by
  OVERCLOCK (÷1.2) and berserkerMul. Initial cooldown 2.0 s on spawn.
- **Minion cap:** Maximum 3 active summoned drones at once. Dead summons are
  pruned from the tracker before the cap is checked.
- **Summoned minions:** Created via `pendingEnemySpawns` (deferred to next
  frame, same as SPLITTER → SHARD). Summoned drones are marked
  `_summoned = true` with a back-reference `_summonerRef`. They:
  - Give **0 XP** and **0 credits** (prevents farming)
  - Do not drop items
  - Do not build combo streak
  - Do not count toward `enemiesKilled`
  - Are excluded from bounty candidate pool
- **Cascade death:** When the summoner dies, all its active minions instantly
  despawn (silent death — particles only, no rewards, no death effects, no
  volatile explosions). The despawn sets `_despawning = true` before calling
  `die()`, which exits early after spark particles.
- **Stats:** HP 35, ATK 8, SPD 1.5, XP 30.
- **Visual:** Violet (`#bb44ff`). Pulsing double-ring aura (outer solid ring,
  inner rotating dashes). Summoning produces violet particles at both the
  summoner and the spawn point.
- **Audio:** `summon()` — rising harmonic sweep (sine 200→600, triangle
  300→900, sine 500→1200, noise tail).
- **Credits:** 12
- **Cap:** 1 per room (both normal and challenge-wave TYPE_CAPS).
- **Elite exclusion:** SUMMONERs never roll elite — the combination of elite
  durability with continuous minion spawning would be a balance spike.

#### HEALER (floor 5+)

Support enemy that periodically heals the most wounded nearby ally. Creates a
tactical priority puzzle: kill the healer first to stop regeneration, or
eliminate the threats it sustains. Pairs with SUMMONER to form a support
archetype duo — the summoner adds bodies, the healer keeps them alive.

- **Behaviour:** Stays at 4–12 tile range. Retreats if player closes to
  within 4 tiles (same retreat logic as GRENADIER/SUMMONER — falls back to
  patrol if wall-blocked). At range, scans for wounded allies within 6 tiles
  and heals the most damaged one.
- **Heal cooldown:** `max(2.0, 3.0 − floor × 0.1)` seconds, scaled by
  OVERCLOCK (÷1.2) and berserkerMul. Initial cooldown 1.5 s on spawn.
- **Heal amount:** 15% of the target's `maxHp` per pulse.
- **Target selection:** Chooses the non-boss enemy within 6 tiles with the
  lowest HP/maxHP ratio. Cannot self-heal. Skips full-HP allies.
- **Stats:** HP 25, ATK 6, SPD 1.8, XP 22.
- **Visual:** Teal (`#44ffaa`). Pulsing teal cross symbol above head. When
  healing, a dashed teal beam connects healer to target (0.4 s duration,
  animated dash offset). Teal particles at both healer and target on heal.
- **Audio:** `heal()` — soft ascending chime (sine 600→1200, triangle
  900→1400, sine 1200→1600).
- **Credits:** 8
- **Cap:** 1 per room (both normal and challenge-wave TYPE_CAPS).
- **Elite exclusion:** HEALERs never roll elite — a durable healer that
  requires sustained focus fire would be frustrating, not challenging.
- **Modifier interactions:**
  - OVERCLOCK (÷1.2 cooldowns): Heals more frequently
  - SWARM (0.6× HP): Extremely fragile — easy to burst down, but more
    wounded allies to heal from the larger enemy count
  - FORTIFIED (1.4× HP): Slightly harder to kill, allies have more HP to
    restore

#### CHARGER (floor 4+)

Aggressive melee rusher that telegraphs a charge and barrels toward the
player at high speed. Creates "dodge this!" moments that reward positioning
and dash timing. Unlike CRAWLER (constant pursuit) or TELEPORTER (blink
ambush), the CHARGER is a visible, predictable but dangerous threat — you
can see it winding up, but you need to move fast.

- **Behaviour:** Patrols slowly (SPD 1.5). When player is in LOS at 3–10
  tiles and charge is off cooldown, begins a 0.6 s windup telegraph, locking
  direction toward the player's position at the start of the windup. On
  windup completion, rushes at 5.5 tiles/s in the locked direction for 0.4 s
  (~2.2 tile lunge). Passes through other enemies but not walls.
  - **On player hit:** 1.5× ATK damage + 2-tile knockback + camera shake.
    Returns to idle with charge cooldown.
  - **On wall collision:** Charge ends, 1.0 s stun (reuses `stunTimer`),
    sparks + camera shake.
  - **On charge expiry (no hit/wall):** 1.0 s stun, vulnerable.
  - **Point-blank (< 2 tiles):** Uses standard melee attack instead of
    charging. After melee, charge cooldown refreshes to 1.5 s minimum to
    prevent immediate follow-up charge.
  - **Windup cancellation:** If LOS breaks or player cloaks during windup,
    charge is cancelled with a 1.0 s cooldown.
- **Charge cooldown:** `max(2.5, 3.5 − floor × 0.1)` seconds, scaled by
  OVERCLOCK (÷1.2).
- **Stats:** HP 45, ATK 14, SPD 1.5, XP 22.
- **Visual:** Bright orange (`#ff6600`). During windup: pulsing orange glow
  with dashed direction indicator line. During charge: larger bright orange
  aura with spark trail particles. Post-charge stun: spinning yellow star
  particles (dazed effect).
- **Audio:** `chargerWindup()` — building rumble (sawtooth 60→180, square
  100→300, noise burst). `chargerImpact()` — heavy thud (sine 80→30, square
  120→40, noise crash).
- **Credits:** 9
- **Cap:** 2 per room (both normal and challenge-wave TYPE_CAPS).
- **Elite eligible:** Yes — all standard affixes apply. BERSERKER affix
  makes charges faster via `berserkerMul()`. ARMORED charges are especially
  dangerous.
- **Modifier interactions:**
  - OVERCLOCK (÷1.2 cooldowns): Charges more frequently
  - SWARM (0.6× HP): Glass cannon — hits hard but drops fast
  - FORTIFIED (1.4× HP): Tanky charger, very dangerous in packs
  - CHARGED (1.4× projectile speed): No effect (melee-only enemy)

#### SCORCHER (floor 4+)

Mid-range pressure unit that circles the player and leaves burning floor pockets.
It is tuned to force repositioning rather than burst damage.

- **Behaviour:** Strafes around the player when in LOS (or close range), retreats
  if the player gets too close, and uses normal melee on contact.
- **Trail hazard:** Drops small short-lived hazard zones while moving:
  radius 0.75 tiles, life 2.2 s, arm delay 0.12 s, damage
  `round(ATK × 0.55)` on tick. Uses the shared `hazardZones[]` path with
  source `"Scorcher Trail"` and orange visuals.
- **Spacing guard:** Trail placement skips heavy overlap with very recent trail
  nodes to avoid unreadable stacks.
- **Stats:** HP 28, ATK 9, SPD 2.6, XP 24.
- **Colour:** `#ff5522`.
- **Credits:** 8.
- **Cap:** 2 per room.
- **Spawn weight:** base 2, perFloor 2, minFloor 4.

#### BRUTE (floor 3+)

Melee-only heavy enemy that complements ranged casters by soaking space and
forcing close-range commitment.

- **Behaviour:** Acquires chase in LOS, keeps pressure until disengaged, no
  ranged attack mode, no teleports, no hazard deployment.
- **Combat role:** High-HP frontliner; lower movement speed than CHARGER/LEAPER
  but stronger baseline melee hit.
- **Stats:** HP 70, ATK 16, SPD 1.6, XP 30.
- **Colour:** `#cc3344`.
- **Credits:** 12.
- **Cap:** 1 per room.
- **Spawn weight:** base 3, perFloor 2, minFloor 3.

#### LEAPER (floor 2+)

Fast, agile enemy that attacks by jumping to the player's position and
creating an AoE shockwave on landing. Creates "dodge the reticle!" moments
that reward repositioning during the windup telegraph. Unlike CHARGER (linear
rush) or PHANTOM (ranged ambush), the LEAPER covers distance instantly by
arc-jumping to a locked target position, demanding spatial awareness.

- **State machine** (`_lpState`):
  1. `idle` — Patrols or chases player (SPD 3.0, fast). Standard melee at
     close range. When player is in LOS at 3–10 tiles and cooldown expired,
     transitions to `windup`. Only one LEAPER may be in `windup` or `airborne`
     at a time per room (prevents unavoidable overlap).
  2. `windup` (0.5 s) — Telegraph phase. Target position locked to player's
     position at the start of windup (does NOT track). Pulsing green glow
     around leaper + dashed green targeting reticle at locked position.
     Green spark particles build. At windup end, validates landing tile:
     must be passable, in-bounds, and have LOS from launch position. If
     invalid, cancels back to `idle` with 1.0 s cooldown.
     - **Cancellation:** If LOS breaks or player cloaks during windup,
       transitions to `idle` with 1.0 s cooldown.
     - **Stun interrupt:** External stun (EMP, etc.) resets to `idle` with
       1.5 s cooldown.
  3. `airborne` (0.35 s) — Leaper arcs to the locked target position via
     linear interpolation. Rendered with a parabolic height offset (peak
     1.5 tiles up). No tile collision during flight — path is pre-validated.
     Shadow circle on ground grows as leaper approaches landing point.
     Hittable by projectiles during flight (no immunity). Ignores floor
     hazards (plasma, arc, mines) while airborne.
  4. `recovery` (1.0 s) — Vulnerable after landing. Cannot move or attack.
     Uses explicit `_lpRecovery` timer (NOT `stunTimer`). Spinning green
     star daze particles. External stun queues normally for after recovery.
- **Shockwave** (on landing): 2-tile radius AoE centered on landing position.
  - Damage: ATK × 1.2 (rounded). LOS-gated from landing point.
  - Player: Respects dash i-frames and Phase Cloak.
  - Crates: Damaged via `damageCratesInRadius`.
  - VCores: Primed via `primeVCoresInRadius`.
  - Beacons: Damaged (shockwave damage, LOS-gated).
  - Shield generators: Damaged (shockwave damage, LOS-gated).
  - Cameras: Damaged (shockwave damage, LOS-gated).
  - Laser emitters: Damaged (shockwave damage, LOS-gated).
  - Mines: Triggered in radius (armed with short fuse).
  - Enemies: NOT damaged (no friendly fire — prevents exploitation).
- **Stats:** HP 30, ATK 11, SPD 3.0, XP 22.
- **Visual:** Bright green (`#22ff88`). Windup: pulsing green glow + dashed
  targeting reticle circle at target. Airborne: shadow ellipse on ground,
  dashed shockwave radius indicator, enemy rendered elevated on parabolic
  arc. Recovery: spinning green star particles (dazed). Shockwave: green
  explosion particles + camera shake.
- **Audio:** `leaperWindup()` — spring tension (sawtooth 120→400, sine
  200→800, noise burst). `leaperLand()` — heavy impact + shockwave whoosh
  (sine 60→25, triangle 100→50, noise, sine 300→80 swoosh).
- **Credits:** 8
- **Cap:** 2 per room (both normal and challenge-wave TYPE_CAPS).
- **Elite eligible:** Yes — all standard affixes apply. BERSERKER makes
  melee harder to survive. ARMORED leapers are tough to burst during
  recovery.
- **Spawn weight:** base 2, perFloor 2, minFloor 2. Appears from early floors
  and scales into mid/late-floor mixes.
- **Modifier interactions:**
  - OVERCLOCK: No direct effect (cooldown not modified by OVERCLOCK).
  - SWARM (0.6× HP): Fragile but numerous — multiple leapers stagger
    automatically due to the one-airborne-at-a-time rule.
  - FORTIFIED (1.4× HP): Harder to kill during recovery window.
  - CHARGED (1.4× projectile speed): No effect (melee/AoE only).

#### PHANTOM (floor 5+)

Stealth assassin that cloaks, stalks, and ambushes with ranged burst attacks.
Creates tension from the unknown — players hear the uncloak sound and have a
brief window to dodge. Rewards awareness, AoE usage, and the Thermal Optics
augment. Unlike SNIPER (stationary, long charge) or TELEPORTER (blink melee),
the PHANTOM is a mobile, invisible ranged threat with a predictable attack
cadence.

- **State machine** (`_phState`):
  1. `cloaked` — Nearly invisible (alpha 0.08). Moves toward player at 1.3×
     speed. Duration 2–4 s (random). Subtle purple shimmer outline.
     OVERCLOCK modifier shortens cloak duration.
  2. `telegraph` — 0.4 s warning. Alpha rises to 0.3–0.5 (pulsing).
     Expanding purple ring + dashed aim indicator. Stops moving, locks aim
     direction. Sentry drone and Auto-Laser CAN target during this phase.
  3. `attacking` — Fully visible (alpha 1.0). Fires 2 purple projectiles in
     quick succession (0.15 s gap, speed 8, damage = ATK, range 14).
  4. `cooldown` — Visible for 1.5 s (÷ berserker). Retreats from player.
     Then re-cloaks. Repositions in room if LOS lost or > 8 tiles away.
- **Close-range escape:** If player walks within 2.5 tiles while cloaked,
  PHANTOM repositions to a far passable tile in the room (teleport, no
  movement) and resets cloak timer. Does NOT attack at close range.
- **Damage interrupt:** Any damage while `cloaked` or `telegraph` forces
  immediate transition to `cooldown` (1.5 s visible). Counter: AoE damage
  (mines, VCores, grenades) reveals hidden PHANTOMs.
- **Augment synergies:**
  - Thermal Optics: Cloaked PHANTOMs visible on minimap as dim pulsing
    purple dots.
  - Temporal Dilation: 15% slower movement in all states.
- **Mine interaction:** Cloaked PHANTOMs trigger proximity mines normally
  (physical presence is independent of visibility).
- **Sentry / Auto-Laser:** Skip cloaked PHANTOMs (require `visible` = true).
  Can target during telegraph, attacking, and cooldown phases.
- **Stats:** HP 35, ATK 10, SPD 2.5, XP 30.
- **Visual:** Purple (`#cc00ff`). Cloaked: dashed purple circle shimmer.
  Telegraph: expanding purple ring with pulsing glow + dashed aim line.
- **Audio:** `phantomCloak()` — descending digital fade-out (sine 1200→300,
  triangle 800→200, noise). `phantomUncloak()` — sharp ascending reveal
  (sine 400→1400, square 600→1800, noise). `phantomStrike()` — quick energy
  bolt (square 900→400, sine 1200→600, noise snap).
- **Credits:** 12
- **Cap:** 2 per room (both normal and challenge-wave TYPE_CAPS).
- **Elite eligible:** Yes — all affixes except PHASING (redundant with innate
  cloaking). BERSERKER shortens cooldown. ARMORED cloaked PHANTOMs are
  especially dangerous.
- **Spawn weight:** base 2, perFloor 2, minFloor 5. Uncommon on floor 5,
  increasing presence through later floors.
- **Modifier interactions:**
  - OVERCLOCK (÷ cloak duration): Attacks more frequently
  - SWARM (0.6× HP): Fragile but more numerous
  - FORTIFIED (1.4× HP): Hard to burst during cooldown window
  - CHARGED (1.4× projectile speed): Projectiles faster + 1.2× damage

#### REFLECTOR (floor 7+)

Tactical mid-range enemy with a reflective energy shield that bounces player
projectiles back at them. Unlike the SHIELDER (which absorbs projectiles),
the REFLECTOR weaponizes the player's own firepower. Creates risk/reward
decisions: high-damage weapons like the Railgun become dangerous to fire
at a REFLECTOR head-on. Forces flanking, melee, or AoE strategies.

- **Reflective shield** (90° frontal arc):
  - Tracks toward player with smooth angle lerp (3 rad/s ≈ 0.33 s lag).
    Does NOT snap instantly like SHIELDER — circling the REFLECTOR opens
    the flanks.
  - Player projectiles hitting the arc are reflected back:
    - Velocity reversed (dx, dy negated).
    - `fromPlayer` set to `false` — becomes a hostile projectile.
    - Damage reduced to 60% of original.
    - Death recap source: `Reflected` (`#88ddff`).
    - Homing cleared (Plasma Orb loses tracking).
    - Ricochet cleared (reflected shots don't wall-bounce).
    - Travelled distance reset (full range after reflection).
  - **Piercing included:** Railgun and other piercing shots are reflected
    (unlike SHIELDER, which piercing bypasses). Only melee (Saw Blade
    orbital), AoE (EMP, Static Field, grenades), hitscan (Auto-Laser),
    and flanking bypass the shield.
  - Ally turret projectiles hitting the arc are blocked (absorbed, not
    reflected) — reuses `blocksProjectile()` path.
  - Shield persists during stun (passive energy field, not active control)
    but stops tracking — easy to flank a stunned REFLECTOR.
- **AI behaviour:**
  - Holds position at 4–10 tile range. Retreats if player closes within
    4 tiles (same retreat pattern as GRENADIER). Approaches slowly if
    player is beyond 10 tiles. Patrols when no LOS.
  - Fires a basic projectile at the player every 2.5 s (colour-matched).
- **Stats:** HP 40, ATK 10, SPD 1.8, XP 28.
- **Visual:** Pale cyan (`#88ddff`). 90° reflective arc with outer cyan
  stroke, white inner "mirror" highlight, and segmented edge ticks.
  Distinct from SHIELDER's wider, solid teal arc. Pulsing glow amplitude
  keyed to `bobAngle × 3` (faster than SHIELDER's `× 2`).
- **Audio:** `audio.reflect()` — sharp crystalline ping with ascending
  shimmer (sine 2200→3200, triangle 3000→4000, sine 1600→2000, noise).
  Distinct from SHIELDER's heavy metallic clang.
- **Credits:** 12
- **Cap:** 1 per room (both normal and challenge-wave TYPE_CAPS).
- **Elite eligible:** Yes — all standard affixes apply. ARMORED REFLECTORs
  are especially durable. PHASING creates challenging tracking scenarios.
  BERSERKER speeds up their shots.
- **Spawn weight:** base 1, perFloor 2, minFloor 7. Late-game tactical
  threat alongside SNIPER and MIMIC.
- **Modifier interactions:**
  - OVERCLOCK (÷ fire rate): Shoots more frequently.
  - SWARM (0.6× HP): Fragile but multiple per floor.
  - FORTIFIED (1.4× HP): Very tanky — demands flanking.
  - CHARGED (1.4× projectile speed): Own shots + reflected shots travel faster.

#### DISRUPTOR (floor 6+)

Area-denial specialist that deploys persistent electromagnetic interference
fields. Forces the player to constantly reposition, adding tactical movement
decisions to mid-to-late-game combat encounters.

- **Stats:** HP 30, ATK 9, SPD 2.0, XP 25, credits 10. Colour: `#ff44aa` (hot pink/magenta).
- **Spawn weight:** base 1, perFloor 2, minFloor 6.
- **TYPE_CAPS:** 1 (max one per room).
- **AI (aiDisruptor):**
  - Maintain 5–9 tile range from player.
  - Retreat if player closes within 4 tiles.
  - Deploy disruption field every 4 s (÷ berserkerMul) when LOS + `canTargetPlayer()` + range 2–10.
    Field placed at player position + random ±0.75-tile offset, validated to passable tile.
  - Secondary ranged attack every 2.5 s (speed 7, range 12) when not deploying.
  - `_dDeployTimer` (init 2.0 s), `_dFireTimer` (init 1.0 s), `_dFields[]` (active field refs, max 2).
  - At cap: oldest field removed before deploying new one.

- **Disruption Fields** (`disruptionFields[]` global array; field helpers live
  in `src/entities/field-effects.js` and operate on the shared collection):
  - Each: `{x, y, age, maxAge:5, radius:2, tickCd:0, dead:false}`.
  - Duration: 5 s then removed.
  - **Player effects while inside** (gated by `!isPlayerDamageImmune()`):
    - DPS: `(3 + floor × 0.5) × envDmg` per second, tick every 0.5 s.
      Routed through `takeDamage('Disruption Field', {ignoreInvincible, ignoreDefense, skipHitInvincible, skipHitEffects, skipReactiveArmor})`.
    - Hackware cooldown frozen (`hackwareCooldown` does not tick while `disruptionFieldActive` is true).
    - 20% movement slow (via `disruptionFieldActive` flag, `spd *= 0.8`, gated by `dashTimer <= 0`).
  - **Non-stacking:** binary flag — multiple overlapping fields do not compound slow or freeze.
    Damage ticks are per-field (multiple fields can deal damage independently).
  - Dash and Phase Cloak grant full immunity (`isPlayerDamageImmune()`).
  - Enemies unaffected (friendly fire exempt).
  - Fields persist after disruptor dies (not channeled).
  - EMP Burst destroys all fields within its radius.

- **Interactions:**
  - Does not block projectiles.
  - Does not block room-clear.
  - Not affected by Static Field or other AoE (they are electromagnetic, not physical objects).
  - Sentry drones, auto-laser, plasma orbs fire through fields normally.

- **Visual:**
  - Deploy telegraph: pulsing magenta glow on disruptor body 0.8 s before deploy.
  - Active field: radial gradient (magenta center → transparent edge), dashed ring, rotating interference lines.
  - Minimap: magenta pulsing 2 px dot (compact), proportional dot (expanded).
  - Status bar: `⊘ DISRUPTED` magenta badge while inside field.
  - Death recap source: `Disruption Field` (#ff44aa).

- **Audio:**
  - `audio.disruptorDeploy()` — descending electronic warble.
  - `audio.disruptorField()` — soft static crackle on each damage tick.

- **Elite eligible:** Yes — all standard affixes apply.
  - SHIELDED DISRUPTOR: tanky field deployer, demands rapid focus fire.
  - PHASING: intermittent untargetability while fields persist — very threatening.
  - Floor modifier interactions:
    - SWARM (0.6× HP): Fragile but paired with other enemies' pressure.
    - FORTIFIED (1.4× HP): Harder to burst down before fields stack.
    - CORROSIVE (+2 flat dmg): Field damage + corrosive extra hurts.

#### WRAITH (floor 8+)

Ethereal wall-phasing predator that shifts between corporeal and intangible
states. Forces players to deal with an enemy that ignores walls and emerges
from unpredictable angles. The only enemy type that can move through walls.

- **Stats:** HP 35, ATK 13, SPD 2.8, XP 30, credits 12. Colour: `#66ffcc` (spectral cyan-green).
- **Spawn weight:** base 1, perFloor 2, minFloor 8.
- **TYPE_CAPS:** 1 (max one per room).
- **AI (aiWraith) — 4-state machine (`_wrState`):**
  1. `phased` (2–3 s) — Moves through walls toward player, ignoring `isPassable()`.
     Speed ×1.2. Respects map bounds. Untargetable and immune to all damage.
     Ghost trail particles while moving.
  2. `emerging` (0.5 s) — Telegraph at emergence point near player (1.5–3.5 tile range,
     passable tile required). Growing pulsing glow. Still intangible. Always drawn
     regardless of FOV (warns player).
  3. `corporeal` (2–3 s) — Normal combat. Approaches player at medium range (3–6 tiles),
     retreats if closer. Fires ranged attack every 1.5 s (÷ berserkerMul). Takes damage
     normally. Damage extends corporeal timer (+0.3 s per hit, 0.5 s ICD, cap 3 s) —
     rewarding focus fire.
  4. `fading` (0.4 s) — Phase-out telegraph. Still damageable (punish window). Flickering
     dashed ring visual.
- **Init state:** `_wrState: 'phased'`, `_wrTimer: 1.5 + random()`, `_wrPhased: true`,
  `_wrFireTimer: 0`, `_wrHitICD: 0`.
- **`_wrPhased` flag:** True during `phased` and `fading→phased` transition. Controls:
  - Projectile collision skip (player and ally turret projectiles pass through).
  - Auto-targeting skip (sentry drone, plasma orb, auto-laser, saw blade).
  - Hackware effect skip (nano swarm, gravity well, static field).
  - Burn damage skip (tick runs, damage suppressed).
  - Chain lightning skip (not selected as chain target).
  - Toxic pool damage skip.
  - Minimap: hidden unless Thermal Optics augment (dim spectral dot, 5 Hz pulse).
  - Off-screen threat indicators: hidden.
  - `takeDamage()` early return: spawns 'PHASED' text in `#66ffcc`.

- **Emergence tile selection (`_wrFindEmergeTile`):**
  20 random attempts to find passable tile within 1.2–3.5 tiles of player. Fallback:
  current position (if passable), then nearest passable tile in expanding search.

- **Interactions:**
  - **EMP Burst (hard counter):** Forces immediate materialization (bypasses LOS
    requirement). Applies standard 2 s stun. Calls `_wrFindEmergeTile` for placement.
    `audio.wraithPhaseIn()` on forced emergence.
  - **Stun:** Any stun while phased forces `_wrState = 'corporeal'`, resets timer to 2 s.
  - **Room-clear:** Phased WRAITHs still block room clear (alive in room).
  - **Phase Cloak:** Standard `canTargetPlayer()` check — no special interaction.
  - **Disruption fields:** No effect on phased WRAITH.
  - Does not block projectiles (no shield mechanic).

- **Visual:**
  - Phased: alpha 0.1, barely visible ghost.
  - Emerging: alpha 0.2→0.85, growing glow ring (cyan-green, increasing shadow blur).
  - Corporeal: alpha 0.85, standard body with spectral glow.
  - Fading: alpha 0.85→0.3, flickering dashed ring outline.
  - FOV bypass: emerging state always rendered (regardless of tile visibility).

- **Audio:**
  - `audio.wraithPhaseOut()` — ethereal descending whoosh (sine 800→200 Hz + noise).
  - `audio.wraithPhaseIn()` — ethereal ascending whoosh (sine 200→800 Hz + crackle).
  - Standard `audio.shoot(false)` for ranged attack.

- **Death Recap:** source `Wraith` (#66ffcc).

- **Elite eligible:** Yes — all standard affixes apply.
  - SHIELDED WRAITH: tanky; shield absorbs hits during brief corporeal window.
  - PHASING: double intangibility layers — exceptionally hard to pin down.
  - BERSERKER: phasing doesn't scale with missing HP (timer-based, not HP-based).
  - Floor modifier interactions:
    - SWARM (0.6× HP): Glass cannon that phases often.
    - FORTIFIED (1.4× HP): Harder to burst during corporeal window.
    - CORROSIVE (+2 flat dmg): Ranged attacks hit harder.

#### NEXUS (floor 9+)

Neural command node that links to nearby allies, buffing their durability. Creates
priority-targeting decisions: kill the NEXUS to stun all linked enemies, or burn
through tougher allies first.

| Stat | Value |
|------|-------|
| HP   | 40 (base) |
| ATK  | 8 |
| SPD  | 1.8 |
| XP   | 35 |
| Credits | 12 |
| Colour | `#00eedd` (teal) |
| TYPE_CAPS | 1 per room |

**AI:** HEALER-like retreat pattern. Stays at 4–10 tile range. Retreats if
player within 4 tiles (toward nearest ally cluster when possible). Fires weak
teal projectiles (speed 6, range 12). Fire rate scales with link count:
2.0 s base → 1.0 s with 3 links (further reduced by OVERCLOCK modifier and
berserker affix).

**Neural Links:**
- Maintains up to 3 links to closest non-boss, non-NEXUS allies within 5 tiles
  (same room). Links break at 7 tiles (hysteresis prevents churn).
- Link update interval: 0.5 s.
- **Cannot link to:** bosses, other NEXi, phased WRAITHs (`_wrPhased`), disguised
  MIMICs (`_disguised`), invisible PHANTOMs.
- Linked enemies receive **25% damage reduction** (applied after Shield Generator
  DR, multiplicative — both active = 51.25% total DR).
- Links are rendered as animated teal dashed beams with a subtle glow on linked
  enemies.
- **Stun breaks all links** (via EMP, weapon shock, shield gen destruction EMP).
  Links re-form naturally after stun ends (next AI update cycle).

**Death — Neural Feedback:**
When NEXUS dies, all currently linked enemies suffer neural feedback:
- **Stun**: 1.5 s (standard stun, max'd with existing `stunTimer`)
- **Damage**: `10 + floor × 2` (applied via `takeDamage('Neural Feedback')` —
  respects shields and elite DR)
- **Visual**: 20-particle teal explosion + screen shake
- **Audio**: `audio.nexusDeath()` — descending electromagnetic feedback pulse.

**Interactions:**
- **EMP**: Standard stun (2 s regular, 1 s boss — N/A since non-boss). Breaks all
  links during stun.
- **Shield Gen**: NEXUS benefits from Shield Generator DR if in same room.
- **Auto-targeting**: Fully targetable by sentry drones, plasma orbs, hacked
  turrets, etc.
- **Projectile collision**: Standard — no reflection or blocking.

**Elite eligible:** Yes. Elite NEXUS gains extra HP/ATK/SPD and elite affix,
making it harder to prioritize-kill while allies receive DR.

**Modifier interactions:**
- OVERCLOCK: Fire rate increased.
- SWARM (0.6× HP): Fragile but still links allies.
- FORTIFIED (1.4× HP): Tankier node, harder to burst.
- CORROSIVE (+2 flat dmg): Ranged attacks hit slightly harder.

**Visual:** Teal (`#00eedd`) with pulsing dashed orbital ring. Inner diamond
symbol. Neural links are animated dashed beams. Standard minimap red dot (no
stealth). Death: teal particle explosion.

**Audio:** `audio.nexusLink()` — subtle electronic connection buzz when new link
forms. `audio.nexusDeath()` — descending electromagnetic feedback pulse +
crackling.

#### SIPHON (floor 8+)

Life-draining predator that sustains itself through combat. Unlike HEALER (heals
others) or NEXUS (buffs others), the SIPHON sustains itself by leeching health
from the player on every successful hit. Creates a DPS-check dynamic: players
must out-damage the healing rate or face an enemy that never dies.

| Stat | Value |
|------|-------|
| HP   | 30 (base) |
| ATK  | 10 |
| SPD  | 2.2 |
| XP   | 28 |
| Credits | 10 |
| Colour | `#dd2244` (crimson) |
| TYPE_CAPS | 1 per room |

**AI:** Mid-range kiter (HEALER/NEXUS pattern). Preferred range 4–9 tiles.
Retreats if player within 4 tiles, approaches at 0.6× speed beyond 9 tiles.
Fires crimson drain projectiles (speed 7, range 12). Fire interval: 2.0 s
(reduced by OVERCLOCK modifier and berserker affix).

**Life Steal:**
- When a SIPHON projectile deals damage to the player, the SIPHON heals for
  **50%** of actual damage dealt (after player defense and damage reduction).
- If `dealt === 0` (fully blocked): no heal.
- If the SIPHON is dead when the projectile lands (e.g. killed by Reactive
  Armor): no heal.
- Tracked via `_owner` reference on the projectile (set in `fireAt()`).
- **Visual**: 0.3 s fading crimson beam from player to SIPHON + green heal
  particles flying toward SIPHON.
- **Audio**: `audio.siphonDrain()` — vampiric draining tone.

**Frenzy Mode (< 40% HP):**
- Triggered once when HP drops below 40% of maxHp. **Permanently latched** —
  does not deactivate if healed above 40%.
- Attack cooldown halved: 2.0 s → 1.0 s.
- Life steal increased: 50% → **75%**.
- **Visual**: Intensified crimson aura (faster pulse, brighter glow) with inner
  heartbeat pulse.
- **Audio**: `audio.siphonFrenzy()` — dual bass thuds + rising tension (one-shot
  on activation, does not replay).

**Interactions:**
- **Shield Gen DR / NEXUS DR**: SIPHON benefits from both — multiplicative DR
  means it takes even less damage, extending its life-steal window.
- **HEALER**: Can heal SIPHON — creates priority targeting puzzle (kill SIPHON
  or HEALER first?).
- **EMP**: Standard stun, prevents firing (and therefore drain) during stun.
- **Reactive Armor**: Player's reactive armor triggers on SIPHON hit. If the
  pulse kills the SIPHON before life-steal logic runs, no heal occurs (natural
  counterplay).
- **Auto-targeting**: Fully targetable by sentry drones, plasma orbs, hacked
  turrets, etc.
- **Projectile collision**: Standard — no reflection or blocking.

**Elite eligible:** No. Life steal + REGENERATING/SHIELDED affixes would create
runaway sustain. Excluded from elite rolls alongside SNIPER, SUMMONER, HEALER,
and MIMIC.

**Modifier interactions:**
- OVERCLOCK (÷1.2 cooldowns): Fire rate increased — more drain opportunities.
- SWARM (0.6× HP): Fragile; enters frenzy earlier.
- FORTIFIED (1.4× HP): Tankier; more time to drain before frenzy threshold.
- CORROSIVE (+2 flat dmg): Slightly more drain per hit.

**Visual:** Crimson (`#dd2244`) with pulsing dark aura. Frenzy: brighter,
faster-pulsing aura with inner heartbeat glow. Drain beam: crimson line from
player to SIPHON (0.3 s fade). Heal particles: green sparkles moving toward
SIPHON. Standard minimap dot (no stealth).

**Audio:** `audio.siphonDrain()` — descending hollow tone with wet siphon.
`audio.siphonFrenzy()` — heart-beating bass activation (dual low thuds + rising
tension).

#### MIMIC (floor 7+)

Ambush predator disguised as a data pickup. Creates late-game tension when
approaching items — observant players can spot the subtle shimmer tell and
prepare for the reveal. Rewards awareness and punishes careless item rushing.
Guaranteed item drop on death compensates for the ambush risk.

- **State machine** (`_disguised`, `_revealTimer`):
  1. `disguised` — Renders as a coloured item pickup (random colour from
     upgrade pool palette) with standard bob animation and glow. Subtle white
     shimmer flash every ~2.5 s (a "tell" for attentive players). No AI, no
     minimap dot, doesn't block room-clear, not targetable by Sentry Drone or
     Auto-Laser.
  2. `revealing` — 0.3 s telegraph burst. Expanding purple ring + explosion
     particles. `audio.mimicReveal()`. No damage dealt during this window
     (player gets a reaction frame).
  3. `combat` — Fast melee attacker. Zigzag chase (like CRAWLER). Initial 3 s
     speed burst (SPD 3.0 decaying to base 2.2). Standard melee attack range.
- **Reveal triggers:**
  - Player within 1.5 tiles (proximity).
  - Any damage source (projectiles, AoE, VCore/mine explosions, Static Field,
    Reactive Armor pulse). Damage-triggered reveal follows the PHANTOM pattern
    (reveal + take the hit).
- **Room-clear:** Disguised mimics do NOT count for `_hadEnemies` and never
  block room-clear rewards. After reveal, they function as normal enemies.
- **On death:** Guaranteed single item drop (suppresses normal drop roll).
- **Bounty:** Excluded from bounty target designation.
- **Hackware interactions:**
  - EMP Burst: Skips disguised mimics (no stun text reveal).
  - Nano Swarm: Does not home toward disguised mimics but can accidentally hit
    one in proximity (damage → reveal).
  - Gravity Well: Does not pull disguised mimics.
  - Static Field: Damages enemies in radius — will reveal disguised mimics
    caught in the field.
- **Stats:** HP 30 + floor×3 (scaled), ATK 14, SPD 2.2 (base), XP 25.
- **Visual:** Violet (`#cc33ff`). Disguised: random item colour. Reveal:
  purple expanding ring. Combat: standard enemy rendering.
- **Audio:** `mimicReveal()` — sharp dissonant alarm chirp (square 200→1600,
  sawtooth 600→2200, sine 1400→400, noise burst).
- **Credits:** 10
- **Spawn:** 0–1 per floor (50% chance), floor 7+, non-boss floors only.
  Placed in normal rooms (area ≥ 16, not spawn/boss/special). Separate spawn
  pass (NOT in `ENEMY_WEIGHTS` / `pickEnemyType()`).
- **Elite:** NOT eligible (ambush nature makes elite buffs unfair).

### Difficulty Modes

Four selectable difficulty levels, chosen from the main menu on the NEW GAME
row using ◀▶ (keyboard: arrow keys; touch: tap left/right edges). The last
selection persists in `neonDungeonMeta.lastDifficulty`. Continued runs restore
the difficulty from the save file.

**Unlock gates:** NIGHTMARE is locked until the player clears HARD (victory on
floor 15). Tracked via `neonDungeonMeta.clearedDifficulties[]`. On the menu,
locked difficulties show `[LOCKED]` with dimmed colour; attempting to start
shows "CLEAR HARD TO UNLOCK NIGHTMARE". The victory screen displays a pulsing
`★ NIGHTMARE UNLOCKED ★` celebration when HARD is cleared for the first time.
EASY, NORMAL, and HARD are always available.

| Parameter     | EASY        | NORMAL      | HARD        | NIGHTMARE     |
|---------------|-------------|-------------|-------------|---------------|
| Enemy HP      | ×0.75       | ×1.0        | ×1.5        | ×2.0          |
| Enemy ATK     | ×0.75       | ×1.0        | ×1.3        | ×1.6          |
| Enemy SPD     | ×1.0        | ×1.0        | ×1.1        | ×1.2          |
| Item drop     | 25%         | 15%         | 12%         | 8%            |
| Credit mult   | ×1.2        | ×1.0        | ×1.0        | ×0.85         |
| XP mult       | ×1.0        | ×1.0        | ×1.15       | ×1.35         |
| Elite rate    | 4%          | 10%         | 18%         | 28%           |
| Shard mult    | ×0.85       | ×1.0        | ×1.3        | ×1.8          |
| Env damage    | ×0.75       | ×1.0        | ×1.25       | ×1.5          |
| Room loot cap | 2           | 1           | 1           | 0             |

**Multipliers apply to:** `spawnEnemy()` stats (HP/ATK/SPD stacked with floor
scaling), elite roll chance, item drop rate in `Enemy.die()`, credit drops
(stacked with meta Scavenger), XP from kills (stacked with meta Quick Learner),
shard payout (run-earned portion only — meta PERSISTENCE flat bonus is unscaled),
environmental damage (traps, plasma, arc), and boss special attack damage.
`roomLoot` caps the random item count per room in `populateFloor()` — EASY
rooms can spawn 0–2 items, NORMAL and HARD cap at 0–1, NIGHTMARE rooms spawn
no random items (only locked room bonus and enemy drops).

**Design intent:**
- EASY reduces incoming threats and increases economy — accessible entry.
- HARD increases enemy durability and elite pressure; rewards with more XP and
  shards per run — risk/reward, not punishment. Credits stay at ×1.0 so the
  in-run economy isn't double-nerfed.
- NIGHTMARE is the endgame challenge: doubled enemy HP, very high elite rate
  (28%), no room loot, and reduced credits. Rewards: ×1.8 shard multiplier and
  ×1.35 XP — the best meta-progression for players who can survive it.
  Colour: violet (`#9400ff`).

**HUD:** Non-NORMAL difficulty shows a coloured badge below the minimap:
`[EASY]`, `[HARD]`, or `[NIGHTMARE]`. Shown on GAME_OVER and VICTORY screens.
CONTINUE menu item shows the save's difficulty.

### Floor Modifiers (floor 2+, non-boss)

Each qualifying floor randomly receives one gameplay modifier from a pool of twenty.
Floor 1 (settle-in) and biome-final boss floors (3, 6, 9, 12, 15) never have modifiers. Modifier is
rolled on floor entry, saved in the checkpoint, and restored on continue. No
SAVE_VERSION bump — old saves default to `modifier: null` (no modifier).

| Modifier      | Icon | Description                                          | Colour    | Effect |
|---------------|------|------------------------------------------------------|-----------|--------|
| BLACKOUT      | ◐    | Emergency lights only                                | `#4466aa` | Player torch radius 9→5 (enemy AI unaffected) |
| SWARM         | ⚠    | Alert — all units respond                            | `#ff6644` | ×1.5 enemy count per room (area-capped), ×0.6 enemy HP |
| FORTIFIED     | 🛡   | Reinforced patrols                                   | `#66eeff` | ×1.4 enemy HP, ×1.3 item drop rate |
| VOLATILE      | 💥   | Unstable power cells                                 | `#ff4422` | Enemies explode on death: 15 + floor×2 AoE damage in 2-tile radius (LOS-gated); no chain reactions; player rewards normal but AoE-killed enemies don't chain |
| SCRAMBLED     | ⌁    | Targeting interference                               | `#cc44ff` | +0.15 added to weapon spread on all player shots |
| OVERCLOCK     | ⚡   | System overclock detected                            | `#ffcc00` | ×1.2 all movement speed (player + enemies) and ×1.2 enemy fire rates (÷1.2 attack/shoot cooldowns) |
| CORROSIVE     | ☣    | Toxic atmosphere                                     | `#44ff22` | All player damage taken +2 flat (applied after DEF and min-1 clamp; effective minimum damage = 3; skipped when `ignoreDefense`). Kill credits ×1.5 (stacks multiplicatively with CREDIT_SIPHON) |
| CHARGED       | ⊕    | Supercharged projectiles                             | `#aaccff` | All projectile speeds ×1.4 (player + enemy). Player projectile damage ×1.2 (applies to sentry drone and plasma orb) |
| FRAGILE       | ❖    | Glass-cannon protocol                                | `#ff88cc` | All damage (player → enemy and enemy → player) amplified — high-risk, high-reward floor where every hit is decisive |
| HUNTER        | ◎    | Sensors lock stationary prey                         | `#ff8844` | Enemies gain a sight bonus when player is stationary (anti-camping); player must keep moving to evade detection |
| REGENERATIVE  | ✚    | Patrols self-repair when uncontested                 | `#44ddaa` | Enemies regenerate HP after `_regenTimer` elapses without taking damage; resets on any damage (incl. burn/poison DoT). Anti-chip-and-retreat |
| CASCADE       | ♥    | Defeats nearby release medical pulse                 | `#44ff88` | First positive modifier. Each enemy defeat heals the player +5 HP via on-kill pulse (pre-PR floor pool) |
| OVERCHARGE    | ⚡   | Every 5th shot guaranteed crit                       | `#ffee66` | Counter `player._overchargeShots` increments per shot; every 5th shot forces a critical (bonus damage from crit multiplier). Run-scoped persistent counter |
| WINDFALL      | ◆    | Every 5th defeat drops a bonus core                  | `#a866ff` | Counter `player._windfallKills` increments per qualifying defeat (!shard, !summon); every 5th drops a bonus +1 core. Run-scoped persistent counter |
| SIGNAL_BOOST  | ↻    | Every 5th defeat resets hackware                     | `#00ddff` | Counter `player._signalBoostKills` increments per qualifying defeat; every 5th resets `player.hackwareCooldown` to 0 (only when `player.hackware` truthy). Run-scoped persistent counter |
| REVERB        | ♪    | Every 5th shot fires a free echo                     | `#ff66cc` | Counter `player._reverbShots` increments per shot; every 5th fires a free echo of the same shot intent (ranged: duplicate fan; melee: duplicate AoE). Echo inherits `forceCrit` + `finalMetaMul` but does NOT recurse. Run-scoped persistent counter |
| QUARTERMASTER | ▣    | First defeat in each room drops a bonus core         | `#ffaa44` | Per-ROOM one-shot. `room._qmHarvested` flag set on first qualifying defeat in each room (no saveGame plumbing — dungeon regenerates on Continue, accepting the save-resume re-harvest exploit) |
| AUTONOMY      | ⚙    | Hackware cooldowns reduced 25% on this floor         | `#88ff44` | First passive % modifier. `player.hackwareCooldown = hw.cooldown * (OVERCLOCKER ? 0.7 : 1) * (AUTONOMY ? 0.75 : 1)` — multiplicative with OVERCLOCKER augment for ×0.525 combined |
| CHAINREACT    | ⚡   | Chained defeats within 1.5s award bonus credits      | `#ff8866` | First timer-window modifier. `player._chainBuffTimer` countdown ticked by dt in Player.update; on qualifying defeat: if window > 0 award +15 CR; always refresh window to 1.5s. HUD shows `' ⚡'` glyph while window alive |
| MAGNETISM     | ⊛    | Item pickup radius increased 50% on this floor       | `#bb88ff` | Affects item pickups only (not core drops — separate magnet system in `src/meta/cores.js`). Multiplies pickup radius by 1.5 at game.js:1602; stacks multiplicatively with MAGNETIC_FIELD augment ×2 → ×3 combined |

**Implementation hooks:**
- BLACKOUT: `updateLighting()` torch radius conditional on `game.modifier`.
- SWARM: `populateFloor()` + `revealSecretRoom()` count multiplier; `spawnEnemy()`
  HP multiplier applied before `new Enemy()` (keeps `maxHp` in sync).
- FORTIFIED: `spawnEnemy()` HP multiplier (same pattern as SWARM);
  `Enemy.die()` drop rate boost.
- VOLATILE: `Enemy.die()` AoE — marks targets with `_volatileKill` flag to
  prevent recursion. Uses `hasLOS()` to avoid through-wall damage.
- SCRAMBLED: `Player.shoot()` spread addend.
- OVERCLOCK: `modSpeed(base)` helper used in `moveToward()` (all enemies) and
  player movement; cooldown divisor in `aiTurret`, `aiDrone`, `aiGrenadier`,
  `aiSniper` (reposition + cooldown only — charge time is fixed), `meleeAttack`.
- CORROSIVE: `Player.takeDamage()` adds +2 after DEF reduction (gated by
  `!options.ignoreDefense`). `Enemy.die()` kill credit multiplier ×1.5
  (`corrosiveMul`), applied to both normal and bounty credits.
- CHARGED: `Projectile` constructor multiplies `this.spd` ×1.4 (all
  projectiles). Player projectiles (`fromPlayer`) also get `this.dmg` ×1.2.

**Display:**
- On floor entry: message via `game.msg()` (300 ms delay) showing icon + name
  + description in modifier colour.
- HUD: modifier label below `TEST:N` in both compact and landscape layouts.
- `getMod()` accessor returns `FLOOR_MODIFIERS[game.modifier]` or `null`.

**Save format:** `modifier` field added to save object (string key or `null`).
`loadFloor(n, savedModifier)` accepts optional second argument: if provided,
uses saved value instead of rolling fresh. `continueGame()` passes
`save.modifier` through.

### Difficulty Curve

**Weighted type distribution:** Each enemy type has a base weight and per-floor
modifier. Early floors are GUARD-heavy (~50% on floor 1); later floors shift
toward PHANTOMs and DRONEs (~29% and ~22% on floor 10). Weights use
`max(1, base + perFloor × (floor − 1))`.

| Type      | Base weight | Per-floor | Min floor |
|-----------|-------------|-----------|-----------|
| GUARD     | 40          | −3        | —         |
| TURRET    | 20          | +1        | —         |
| CRAWLER   | 10          | +3        | —         |
| PHANTOM   | 5           | +4        | —         |
| DRONE     | 5           | +3        | —         |
| SHIELDER  | 3           | +2        | 3         |
| SPLITTER  | 2           | +2        | 4         |
| GRENADIER | 1           | +2        | 5         |
| TELEPORTER| 1           | +2        | 6         |
| SNIPER    | 1           | +2        | 7         |
| HEALER    | 1           | +2        | 5         |
| CHARGER   | 2           | +2        | 4         |
| SCORCHER  | 2           | +2        | 4         |
| BRUTE     | 3           | +2        | 3         |
| LEAPER    | 2           | +2        | 2         |
| REFLECTOR | 1           | +2        | 7         |
| DISRUPTOR | 1           | +2        | 6         |
| WRAITH    | 1           | +2        | 8         |
| NEXUS     | 1           | +2        | 9         |
| SIPHON    | 1           | +2        | 8         |
| GRAVITON  | 1           | +2        | 7         |
| SEEKER    | 2           | +3        | 3         |
| PULSER    | 5           | +1        | 2         |

**Scaling enemy count per room:**
`count = min(areaCap, rndInt(2 + floor÷3, min(8, 4 + floor÷2)))` where
`areaCap = floor(room.w × room.h ÷ 8)`. Floor 1 averages 2–4 per room;
floor 10 averages 5–8 (capped by room area).

**Per-room composition caps:** max 2 turrets, max 2 drones, max 2 splitters,
max 1 phantom, max 1 shielder, max 1 grenadier, max 1 teleporter, max 1 sniper,
max 1 summoner, max 1 healer, max 2 chargers, max 2 scorchers, max 1 brute,
max 2 leapers, max 1 reflector,
max 1 disruptor, max 1 wraith, max 1 nexus, max 1 siphon, max 1 graviton,
max 3 seekers, max 2 pulsers per room. Excess rolls reroll among uncapped,
floor-eligible types; final fallback is GUARD.

### Elite Enemies (floor 3+)

Base 8% chance per spawn on floor 3 and above (scaled by difficulty: 4% EASY,
12% HARD). Maximum 1 elite per room. Never applied to bosses, boss-summoned
adds, SNIPERs (elite ATK multiplier on a glass cannon would produce unfair
damage spikes), SUMMONERs (elite durability + continuous spawning), HEALERs
(elite durability would make the healer frustratingly hard to prioritise),
MIMICs, SIPHONs, SEEKERs (too fragile/fast), or PULSERs (early-game teaching
enemy; high ATK + elite scaling = unfair on floor 2–3).

| Stat     | Multiplier |
|----------|------------|
| HP       | ×1.8       |
| ATK      | ×1.3       |
| SPD      | ×1.15      |
| XP value | ×1.25      |

**Visual:** Pulsing neon glow (oscillating `shadowBlur` driven by `bobAngle`)
and a diamond marker above the enemy (coloured by affix). Elite HP bars render
in white instead of the type colour. Glow colour matches the elite affix.

#### Elite Affixes

Every elite enemy spawns with exactly one random affix that grants a special
ability. Each affix creates a distinct tactical challenge requiring different
player strategies.

| Affix        | Colour    | Behaviour                                                         |
|--------------|-----------|-------------------------------------------------------------------|
| SHIELDED     | `#4488ff` | Energy shield absorbs damage (40% of max HP). Regenerates 8 HP/s after 2 s of not being hit. Must break shield before dealing HP damage. Blue ring visual, separate shield bar above HP bar. |
| BERSERKER    | `#ff2222` | Speed and attack rate increase as HP drops (up to +50% at 0 HP). Red aura intensifies with missing HP. Affects movement, melee cooldown, and ranged shoot cooldown. |
| REGENERATING | `#22ff44` | Heals 2.5% of max HP per second. Green particles when healing. Forces sustained aggression — letting a Regenerating elite disengage means fighting full HP again. |
| PHASING      | `#cc88ff` | Cycles on a 4 s timer: 3 s vulnerable, 1 s invulnerable. Ghost flicker and semi-transparency during immune window. `audio.phaseShift()` plays on phase-in. Not rolled on PHANTOMs (redundant with invisibility). |
| VOLATILE     | `#ff6600` | Explodes on death: 2-tile AoE dealing ATK×1.5 damage (LOS-gated). Damages player (unless dashing), enemies, and environmental entities (vcores, crates, beacons, shield gens, cameras, lasers, wall turrets, mines). Pulsing orange ring warning visual + intermittent orange particles. `audio.eliteVolatile()` on detonation. Not rolled on SEEKERs (redundant with kamikaze). Forces spacing awareness — melee-range kills become risky. |
| FRENZY       | `#ff4466` | Gains a frenzy stack when any enemy dies within 4 tiles (max 2 stacks). Each stack grants +40% speed and attack rate (same multiplier path as BERSERKER via `berserkerMul()`). At 2 stacks the enemy is 80% faster. Red-orange aura intensifies per stack. `audio.eliteFrenzy()` on stack gain. Creates kill-order tactical decisions — kill the frenzy elite first, or isolate it before clearing trash. |

**Minimap:** Elite enemies render as 3 px dots in their affix colour (vs 2 px
red for normal enemies).

**Implementation:** `ELITE_AFFIXES` table + `rollEliteAffix(enemyType)` for
random selection with eligibility filtering (PHASING excluded from PHANTOM,
VOLATILE excluded from SEEKER). `src/entities/elite-affixes.js` owns
`tickEliteAffix(enemy, dt)` and handles per-frame logic (shield regen, HP regen,
phase cycling, volatile particles).
`berserkerMul()` method on Enemy returns speed/cooldown multiplier for both
BERSERKER (HP-scaled) and FRENZY (stack-scaled).
`notifyFrenzyElites(x, y)` in `src/entities/elite-affixes.js` is called on
every enemy death — grants stacks to nearby FRENZY elites within 4 tiles.
VOLATILE explosion in `die()` follows the same AoE pattern as
SEEKER/VOLATILE-modifier explosions (LOS-gated, env damage helpers, dash
immunity). Shield absorption handled in `takeDamage()` before HP damage.
Phasing immunity checked at top of `takeDamage()`. Enemy class stores
`eliteAffix`, `shieldHp`, `shieldMax`, `shieldRegenDelay`, `phaseTimer`,
`phaseImmune`, `frenzyStacks`.

### Aggression Scaling

AI parameters tighten with floor progression:

| Parameter            | Formula                            | Range         |
|----------------------|-------------------------------------|---------------|
| GUARD detect range   | `10 + floor × 0.4`                 | 10.4 – 14     |
| TURRET shoot cooldown| `max(1.0, 2.0 − floor × 0.11)`    | 1.89 – 1.0 s  |
| DRONE shoot cooldown | `max(0.9, 1.5 − floor × 0.07)`    | 1.43 – 0.9 s  |

### Bosses (appear on biome-final floors 3, 6, 9, 12, 15)

**Boss Pool System:** Each biome-final floor selects from that biome's
`bossPool` (see `src/data/biomes.js`). Current wiring: floor 3 → SENTINEL
or WARDEN (SANDBOX), floor 6 → HIVE (CACHE), floor 9 → CONDUCTOR (FIREWALL),
floor 12 → OMEGA (UPLINK), floor 15 → GENESIS (OPEN NETWORK). Pool sizes
may be >1 — floor 3 randomly selects SENTINEL or WARDEN (v115). Optional
`bossDisplayNames: {TYPE: 'NAME'}` per area overrides the biome's narrative
`displayName` on a per-boss basis, so a mechanically-distinct variant like
WARDEN can share the SANDBOX pool with SENTINEL-PRIME without inheriting
its HUD name. Selection happens during `populateFloor()` each time the floor is
generated (including continue from save). `game.bossType` tracks the
active boss type for death messaging and dynamic terminal lock text.

| Boss              | Floor | HP    | Phases | Special                                           |
|-------------------|-------|-------|--------|---------------------------------------------------|
| SENTINEL MK-I     | 3     | 400   | 2      | Laser sweep + tracking shot + shield burst         |
| NEURAL HIVE       | 6     | 650   | 3      | Spawns crawlers, swarm cloud, psionic shockwave    |
| CONDUCTOR         | 9     | 700   | 3      | Radial arc bursts, electric hazard zones, EM pull  |
| OMEGA CORE        | 12    | 1300  | 4      | All previous attacks, room-filling void orbs       |
| GENESIS PROTOCOL  | 15    | 1300  | 3      | Geometric precision: spiral salvos, lances, purge ring |

Boss arenas: minimum 15×15 rooms (expanded from BSP if needed), sealed on entry.
When the player enters a boss room, corridor entrance tiles become WALL (red glow
on minimap and main view), trapping both player and boss inside. The seal triggers
only when the player is inside the room AND not standing on an entrance tile — this
prevents the seal from creating a wall under the player's feet. If the player is
somehow on a sealed tile, they are nudged to the room center. Drones inside a
sealed room respect walls. Boss knockback effects clamp to room bounds.
Boss-summoned adds (HIVE crawlers, OMEGA drones/crawlers) cannot be elite.
All boss HP values are scaled by the floor modifier (`1 + 0.15 × (floor − 1)`).
Phase thresholds use `maxHp` percentages, so scaling does not break phases.

On boss death, the arena unseals (entrance tiles restored) and the game displays
"{BOSS NAME} DESTROYED". On floor 15, the CORE terminal is locked until the boss
is defeated; the lock text dynamically shows the active boss name.

#### SENTINEL MK-I — Phase Breakdown

Floor 3 default boss. Ranged turret platform that floods the arena with radial
volleys while picking the player off with aimed tracking shots.

**Stats:** HP 400, ATK 15, SPD 1.5, XP 200, credits 80, colour `#ff4444` (red).

| Phase | HP Range    | Attacks                                                    |
|-------|-------------|------------------------------------------------------------|
| 1     | 100 %–33 %  | 5-way radial volley (3 s) + tracking shot (4 s)            |
| 2     | 33 %–0 %    | 8-way radial volley (2 s) + tracking shot (2.5 s) + shield burst (5 s) |

**Radial volley:** Fires projectiles evenly spaced in a circle. Phase 1: 5
projectiles every 3 s. Phase 2: 8 projectiles every 2 s. Speed 7, dmg ATK,
range 14, colour `#ff4444`.

**Tracking shot (v89):** Aimed projectile at player position (requires LOS).
Both phases. Speed 8, dmg ATK + 3, range 16, colour `#ff6666`. Cooldown:
4 s (phase 1) / 2.5 s (phase 2).

**Shield burst (phase 2, 5 s cooldown):** Knockback push: player pushed 3
tiles away from boss + 20 × difficulty damage. `clampToBossRoom()` prevents
wall escape.

**Movement:** Random patrol around room center (drift ±5 tiles, 2 s interval).
Does NOT pursue player.

#### OMEGA CORE — Phase Breakdown

Phase thresholds (by % of scaled max HP):

| Phase | HP Range     | Speed | Attacks Unlocked                              |
|-------|-------------|-------|------------------------------------------------|
| 1     | 100 %–70 %  | 1.0×  | Rotating radial shots + homing missile         |
| 2     | 70 %–40 %   | 1.2×  | + Crawler/drone spawns (2 adds per wave)       |
| 3     | 40 %–20 %   | 1.5×  | + Piercing beam fan (5) + shield burst (≤5 tiles) |
| 4     | 20 %–0 %    | 2.0×  | + Void orbs + psionic shockwave (≤7 tiles) + 3 adds/wave + 7-beam fan |

Phase transitions trigger an explosion particle burst, a phase-shift audio
sting, and a HUD warning (`⚠ OMEGA PHASE N` / `⚠ HIVE PHASE N`).

**Void Orbs** (Phase 4 signature attack):
- 2–3 orbs spawn at random room positions every 3.5 s (÷ speed mult)
- Each orb expands from radius 0 to 4–7 tiles over 2.5 s, then fades
- Players inside an orb take 15 damage every 0.5 s (cooldown-gated)
- Visual: translucent magenta fill with neon ring edge, fading with age

**Attack Inheritance:**
- SENTINEL radial shots → rotating turret volley (4→5→8 projectiles by phase)
- SENTINEL shield burst → knockback AoE (phase 3+, ≤5 tile range, 20 dmg)
- HIVE homing missile → targeted shot at player (phase 1+)
- HIVE crawler spawns → 60 % crawler / 40 % drone mix (phase 2+)
- HIVE psionic shockwave → AoE pulse (phase 4, ≤7 tile range, 25 dmg)

#### NEURAL HIVE — Phase Breakdown

Floor 6 default boss. Summoner archetype that floods the arena with crawlers
while firing homing missiles and (from v89) swarm cloud bursts.

**Stats:** HP 650, ATK 18, SPD 1.2, XP 350, credits 120, colour `#aa00ff` (violet).

| Phase | HP Range     | Attacks                                                    |
|-------|-------------|------------------------------------------------------------|
| 1     | 100 %–70 %  | Homing missile (2 s)                                       |
| 2     | 70 %–30 %   | + Crawler spawns (2 per wave, 5 s) + swarm cloud (3 projectiles, 5 s) |
| 3     | 30 %–0 %    | + Psionic shockwave (4 s) + swarm cloud (5 projectiles, 3.5 s) |

**Homing missile:** Aimed projectile at player. Speed 6, dmg ATK, range 18,
colour `#aa00ff`. 2 s cooldown.

**Crawler spawns (phase 2+):** 2 crawlers per wave, spawned ±2 tiles from boss
position. 5 s cooldown. Non-elite. Cannot be spawned while `spawnCooldown > 0`.

**Swarm cloud (v89, phase 2+):** Burst of slow aimed projectiles in a spread
pattern toward the player (requires LOS). Phase 2: 3 projectiles, 5 s cooldown.
Phase 3: 5 projectiles, 3.5 s cooldown. Spread: 0.25 rad between each.
Speed 3.5, dmg ATK × 0.7, range 12, colour `#cc66ff`. Spark particles on fire.

**Psionic shockwave (phase 3, 4 s cooldown):** AoE pulse hitting player if
within 10 tiles. 25 × difficulty damage. Explosion particles.

**Movement:** Random patrol within boss room (±room extents, 3 s interval).

#### WARDEN — Phase Breakdown

Floor 3 alternate boss. Melee-focused armored enforcer that pressures the
player's positioning through telegraphed charges and ground slams.

**Stats:** HP 450, ATK 16, SPD 1.8, XP 200, credits 80, colour `#ff8800` (amber).

| Phase | HP Range    | Attacks                                                    |
|-------|-------------|------------------------------------------------------------|
| 1     | 100 %–40 %  | Telegraphed charge (0.6 s wind-up) + radial stomp (6 s) + 4-way spark burst |
| 2     | 40 %–0 %    | Faster charge (0.45 s wind-up) + radial stomp (4 s) + ground slam AoE |

**Charge mechanic:**
1. Wind-up: 0.6 s (phase 1) / 0.45 s (phase 2). Pulsing amber dashed line
   telegraph from boss toward player. Direction locked at wind-up start.
2. Charge: 0.3 s burst at 3× speed along locked direction. Room-clamped.
3. Hit: contact damage (ATK × difficulty) + 2-tile knockback if player within
   1.5 tiles during charge. Charge ends on hit.
4. Miss: 4 spark projectiles in cardinal directions (60 % ATK, range 8, speed 5).
5. Cooldown: 3.5 s (phase 1), 2.5 s (phase 2).

**Cancel conditions:** LOS break or player cloak cancels wind-up (not active
charge). Stun cancels any charge state (handled in `Enemy.update()` stun block).

**Radial stomp (v89, both phases):** When player within 3 tiles and boss idle
(not charging): 4 radial spark projectiles (phase 1) or 6 (phase 2), 50 % ATK
damage, range 6, speed 4. Spark particles + small screen shake (3 px).
Cooldown: 6 s (phase 1) / 4 s (phase 2).

**Ground slam (phase 2, 5 s cooldown):** When player within 4 tiles and boss is
idle (not charging): radial knockback (3 tiles) + 22 × difficulty damage +
6 radial spark projectiles. Screen shake (6 px). `audio.wardenSlam()`.

**Movement:** Actively pursues player when LOS (unlike SENTINEL's random patrol).
Patrols room center when no LOS.

**Audio:** `audio.wardenCharge()` (low rumble), `audio.wardenSlam()` (bass impact).

#### CONDUCTOR — Phase Breakdown

Floor 6 alternate boss. Area-denial pattern boss that controls the battlefield
through electromagnetic projectile patterns and hazard zones. No add spawning
(direct contrast to NEURAL HIVE's summoner archetype).

**Stats:** HP 700, ATK 20, SPD 1.4, XP 350, credits 120, colour `#00ccff` (electric cyan).

| Phase | HP Range     | Attacks                                                    |
|-------|-------------|------------------------------------------------------------|
| 1     | 100 %–55 %  | 8-way radial arc burst (3.5 s) + 1 electric hazard zone (6 s) |
| 2     | 55 %–25 %   | 12-way burst (3 s) + 2 hazard zones (5 s) + conduit beam (4 s) |
| 3     | 25 %–0 %    | 12-way burst (2.5 s) + 2 hazard zones (4 s) + discharge AoE with magnetic pull |

**Radial arc burst:** Fires projectiles evenly spaced in a circle. Each volley
rotates 0.3 rad from the last, creating sweeping patterns. Projectiles: speed 5,
dmg ATK × 0.8, range 10, colour `#00ccff`. `audio.conductorArc()`.

**Electric hazard zones:** Placed at random room positions (minimum 3 tiles from
player for readability). 0.8 s arming delay with pulsing dashed warning ring
before activation. Active: radius 1.5 tiles, lasts 4 s, dmg 15 × difficulty,
0.8 s tick cooldown. Damage source: `Conductor Field`. Uses the shared
`hazardZones` system (extended to support custom source and arming delay).

**Conduit beam (phase 2+):** Fast single projectile at player position. Speed 8,
dmg ATK + 5, range 20.

**Discharge AoE (phase 3, 5 s cooldown):** 1.5 s magnetic pull channel
(1.0 tiles/sec toward boss, passability-checked). Then: pulse dealing
25 × difficulty damage + 2.5-tile knockback if within 6 tiles, plus 6 radial
spark projectiles. Channel telegraph: pulsing cyan glow around boss body.
`audio.conductorPulse()`.

**Movement:** Phase 1 drifts toward room center (0.6 × SPD). Phase 2+ slowly
pursues player (full SPD). Random patrol when no LOS.

**Visual:** Rotating segmented arc ring around boss body (always visible).
Pulsing glow aura during discharge channel.

**Audio:** `audio.conductorArc()` (electric crackle), `audio.conductorPulse()`
(deep EM discharge).

#### GENESIS PROTOCOL — Phase Breakdown

Floor 15 (OPEN NETWORK) boss — THE ARCHITECT. Geometric precision boss that fights through predictable
but punishing patterns. No add spawning — direct contrast to OMEGA's chaotic
everything-at-once approach. The Progenitor: the original AI prototype that
survived decommissioning.

**Stats:** HP 1300, ATK 22, SPD 1.0, XP 800, credits 200, colour `#ffcc00` (gold).

| Phase | HP Range     | Attacks                                                    |
|-------|-------------|------------------------------------------------------------|
| 1     | 100 %–70 %  | 6-arm spiral salvo (3 s) + targeting lance (4 s, 0.5 s telegraph) |
| 2     | 70 %–35 %   | 8-arm spiral (2.5 s) + 3-spread lance fan (3.5 s) + 2 hazard zones (5 s) |
| 3     | 35 %–0 %    | 10-arm spiral (2 s) + 5-spread lance (3 s) + 3 hazard zones (4 s) + purge ring (8 s) |

**Spiral salvo:** Fires projectiles evenly spaced in a circle. Each volley
rotates 0.4 rad from the last, creating rotating galaxy patterns. Projectiles:
speed 5, dmg ATK × 0.7, range 12, colour `#ffcc00`. Uses `audio.shoot(false)`.

**Targeting lance:** Telegraphed aimed shot. Aim locks at telegraph start (does
NOT track player). 0.5 s telegraph in P1/P2, 0.4 s in P3. Lance projectiles:
speed 12, dmg ATK × 1.4, range 20, colour `#ffe066`. Phase 2+ fires a fan
(3-spread P2, 5-spread P3, 0.12 rad between). Telegraph cancelled by stun,
LOS break, or cloak (same pattern as SNIPER laser). `audio.genesisLance()`.

**Hazard grid (phase 2+):** Zones placed near player's recent position (min
1.5 tiles from player, min 2.5 tiles from other Genesis hazards). arming
delay 1.2 s (P2) / 0.8 s (P3). Radius 1.5 tiles, lasts 4 s, dmg 15 ×
difficulty. Source: `Genesis Field`. Colour: `#ffcc00`.

**Purge ring (phase 3 signature):** Every 8 s, creates 6 hazard zones in a
circle (radius 4.5 tiles) around room center. One slot is randomly skipped
to guarantee a safe gap. arming delay 0.6 s, radius 1.8 tiles, lasts 3.5 s,
dmg 18 × difficulty. Source: `Genesis Purge`. Colour: `#ffe066`.
`audio.genesisPurge()` + screen shake.

**Movement:** Slow center patrol at 0.6 × SPD. Deliberate, not erratic.

**Phase transitions:** Timer seeding on phase change (spiral 1 s, lance 1.5 s,
hazard 2 s, purge 4 s) prevents all attacks from firing simultaneously at the
transition moment.

**Visual:** Rotating hexagonal ring around boss body (always visible). Pulsing
dashed aim line during lance telegraph. 22 px body (same size as OMEGA).

**Audio:** `audio.genesisLance()` (sharp focused beam ping),
`audio.genesisPurge()` (deep resonant purge pulse).

---

## Items & Upgrade System

### Powerup Choice UI

Items are dropped by enemies (20 % chance) or placed in rooms (1–3 per room).
Walking over an item **pauses gameplay** and presents a choice overlay with
two random upgrades. The player picks one or skips (taking neither). This
replaces the previous auto-pickup behaviour.

**Choice generation:** Two options are drawn from the combined upgrade pool
(instant, persistent, and weapon types). Both options must be different.
Persistent upgrades that have reached their max level are excluded.
There is a 20 % chance one option is a pre-rolled weapon showing exact stats.

**Controls:**
- Keyboard: `1`/`2` direct pick, `←`/`→` + `Enter` to select, `3`/`Esc` to skip
- Touch: tap a card or the Skip button

### Upgrade Pool

**Instant upgrades (one-time, no stacking):**

| ID | Name | Effect | Rarity |
|----|------|--------|--------|
| MED_PACK | Med-Pack | +40 HP (capped at MAX_HP) | 40 |
| NANO_REPAIR | Nano-Repair | +15 HP | 35 |
| XP_CHIP | XP Chip | +50 XP | 20 |
| VOID_SHARD | Void Shard | +1 void bomb charge | 4 |

Void Shard bombs (`FuseShard` → `_detonateBombAt` in
`src/entities/fuse-shards.js`) deal mob damage and shatter
cracked walls only when the target has blast line-of-sight from the detonation
point. Walls, closed/locked doors, challenge gates, crates, and intervening
cracked walls block the blast; the cracked wall being targeted can still be
shattered if no separate blocker sits between it and the bomb.

**Weapon upgrades (pre-rolled, shows exact weapon name and stats):**

When a weapon option is generated, a specific weapon is pre-rolled from the
full weapon table. The choice card shows the weapon name, damage, fire rate,
and range so the player can make an informed decision.

**Persistent upgrades (stackable across the run):**

| ID | Name | Max Lv | Per-Level Effect | Rarity |
|----|------|--------|-----------------|--------|
| SAW_BLADE | Saw Blade | 4 | +1 orbital blade, 12 dmg each (LOS-gated) | 12 |
| PLASMA_ORB | Plasma Orb | 3 | Auto-fires homing orb; cooldown: 3 / 2.3 / 1.6 s | 10 |
| NANO_REGEN | Nano Regen | 5 | +1 HP/s passive regeneration | 15 |
| OVERCLOCK | Overclock | 3 | +0.5 permanent speed per level | 10 |
| ARMOR_UP | Reinforced Armor | 5 | +3 permanent DEF per level | 12 |
| RICOCHET | Ricochet Module | 3 | Bullets bounce off walls (1/2/3 bounces) | 8 |
| SENTRY_DRONE | Sentry Drone | 3 | +1 orbiting drone, 8 dmg homing shots; cd: 2.0 / 1.6 / 1.2 s | 7 |

### Orbital Weapons (Saw Blade)

Saw Blades orbit the player at 1.5 tile radius, rotating at 3 rad/s. Each
blade deals 12 damage on contact with a 0.5 s per-enemy cooldown. Damage
requires line-of-sight (blades cannot hit through walls). Rendered as
spinning neon-red rectangles with glow. Levels 1–4 add additional blades
evenly spaced around the orbit.

### Auto-Spells (Plasma Orb)

Plasma Orb auto-fires a homing projectile at the nearest enemy within range
every `3 − (level−1) × 0.7` seconds. Homing uses lerp-based steering at
8 rad/s turn rate. Projectile: 25 damage, range 10, speed 6, colour #ff44cc.
Uses the existing Projectile class with a `homing` target reference.
Homing projectiles do **not** receive ricochet — bouncing would fight the
homing steering and waste bounces.

### Ricochet Module

Player projectiles bounce off walls instead of dying on impact. Each level
adds one bounce (1 / 2 / 3). Bouncing uses axis-separated wall detection to
determine the reflection axis (horizontal, vertical, or corner). Range
continues counting through bounces — bullets are not infinite.

**Mechanics:**
- On wall hit, the projectile reverts to its pre-move position, reflects the
  appropriate velocity component(s), and nudges 0.05 tiles along the new
  direction to prevent re-collision.
- `hitEnemies` set is preserved across bounces (no re-hitting the same enemy).
- Piercing and ricochet are orthogonal: a piercing bullet bounces but still
  pierces through enemies as normal.
- Out-of-bounds hits (map edge) always kill the projectile — no bouncing off
  the void.
- Melee weapons (Plasma Sword) are unaffected.
- Scatter Gun pellets each bounce independently (range 5 keeps chaos bounded).

**Audio:** Metallic ping + high-frequency zing on each bounce.
**Visual:** Cyan (#00ffff) spark particles at bounce point. Fading cyan trail
behind bouncing projectiles — a short line of recent positions rendered with
increasing opacity toward the projectile head. Trail starts from the moment the
projectile is fired (not just after the first bounce), highlighting the ricochet
path through walls.

### Sentry Drone

Autonomous drones that orbit the player at 2.0 tile radius, rotating at
1.8 rad/s. Each drone independently targets the nearest visible enemy within
8 tiles and fires a homing projectile (8 damage, speed 8, range 8,
colour #00e5ff). Fire cooldown: `2.0 − (level−1) × 0.4` seconds (shared
across all drones — all fire simultaneously). Levels 1–3 add additional
drones evenly spaced around the orbit.

**Targeting:** Each drone finds the nearest enemy within 8 tiles that has
line-of-sight from the drone's position. Phantom enemies are skipped when
invisible. Projectiles use homing steering (same system as Plasma Orb).

**Visual:** Cyan diamond shape (#00e5ff) with bright core (#aaffff) and
outer glow. Orbits the player independently from Saw Blades (separate
angle counter at different speed).

**Audio:** Soft electronic chirp (`audio.sentryFire()`) — ascending sine +
triangle, very quick (60 ms), spatially panned.

### Removed Items

- **SHIELD CELL** — replaced by ARMOR_UP (permanent DEF per level)
- **WEAPON CRATE** — replaced by pre-rolled weapon upgrades showing exact stats
- **OVERCLOCK (timed)** — replaced by persistent OVERCLOCK (permanent speed)

### Level-Up Perks (Choose-One-of-Three)

At levels 2, 4, 6, and 8, the game pauses and presents three randomly-chosen
perks from the pool. The player must pick one — no skipping. At level 10,
the **Auto-Laser** capstone is granted automatically.

Multi-level jumps (e.g., gaining enough XP to go from level 1 to 5) queue
multiple perk choices, presented one at a time via
`game.pendingPerkChoices[]`. Options are rolled fresh when each choice opens,
so earlier picks are excluded from later rolls.

**Perk Pool (15 perks):**

| Perk | Icon | Effect |
|------|------|--------|
| Laser Sight | ◎ | Dashed neon aim line, weapon-coloured, stops at walls. Hidden for melee. |
| Threat Sense | ⚠ | Directional chevrons for off-screen enemies within 18 tiles. |
| Piercing Rounds | ⟫ | Shots pierce one extra enemy (`maxPierces += 1`). |
| Energy Shield | 🛡 | Absorbs one hit completely, 30 s recharge. |
| Vampiric | ♥ | Heal 2 HP per kill (non-shard). |
| Adrenaline | ⚡ | +20% move speed (multiplied after all other speed modifiers). |
| Rapid Fire | » | −15% fire cooldown (`shootCooldown *= 0.85`). |
| Critical Hit | ✦ | 15% chance per projectile/swing for 2× damage. Rolled on creation, stored as `proj.isCrit`. |
| Thick Armor | █ | +3 DEF (applied once on pick, persisted via perks save). |
| Berserker | 🔥 | +40% ATK when below 25% HP. `player.effectiveAtk()` accessor. Status badge: "🔥 RAGE". |
| Dash Master | ⇒ | Dash cooldown halved (1.5 s → 0.75 s). |
| Nano Repair | ✚ | Regen 1 HP every 3 s (`player.regenTimer`). |
| Explosive Kills | 💥 | Enemies explode on death — 2-tile AoE, damages enemies only (player safe). Merges with VOLATILE modifier: `+0.5 tile radius, +5 base damage` when both active, single explosion. |
| Multi-Shot | ⫸ | Fires one extra projectile at ±8° with 60% damage. Spawned directly, no recursive `shoot()`. Melee excluded. |
| Second Wind | ↺ | On lethal damage, revive at 30% HP with 1.5 s invincibility. Once per floor (`player.secondWindUsed`). Status badge: "↺ LIFE" when available. `audio.secondWind()` SFX. |

**Capstone (level 10, auto-granted):**

| Perk | Effect |
|------|--------|
| Auto-Laser | Every 2.5 s, hitscan beam at nearest visible enemy within 12 tiles. 20 flat damage. |

**Perk Choice UI (`PERK_CHOICE` state):**
- Dark overlay (75% black), "CHOOSE A PERK" title in cyan neon glow.
- 3 cards side-by-side: icon, name, word-wrapped description.
- Selected card has coloured border glow. Number badge (1/2/3) at top.
- Input: keys 1/2/3 for direct pick, ←/→ + Enter, mouse/touch click.
- Touch: routed via `mouse.x/y` + `MouseLeft` (same pattern as `POWERUP_CHOICE`).
- No skip — player must choose one perk.
- `audio.perkChoice()` ascending chime on screen open.

**State flow:**
1. `gainXP()` detects perk-eligible level → pushes to `game.pendingPerkChoices[]`.
2. If `game.state === 'PLAYING'`, calls `game.openNextPerkChoice()`.
3. If XP came from inside `POWERUP_CHOICE` (XP Chip), perk choice triggers
   after `applyPowerupChoice()` resolves.
4. `openNextPerkChoice()` shifts the queue, calls `rollPerkChoices(player, 3)`,
   sets `PERK_CHOICE` state.
5. `applyPerkChoice()` calls `applyPerk(player, id)` and checks queue for more.

**Save/Load:**
- `player.perks` saved as `{PERK_ID: true}` — same format, but now contains
  player-chosen perks instead of deterministic ones.
- `player.secondWindUsed` saved/loaded.
- On load, `THICK_ARMOR` re-applies `+3 DEF` (stat-granting perks).
- SAVE_VERSION `'9.0'`. Old v8 saves are invalidated (fresh start).

**Laser Sight details:**
- Ray uses `isPassable()` collision (same as projectiles) so the line
  accurately represents where shots will travel, including stopping at
  closed/locked doors.
- Rendered as a dashed line (4 px dash, 4 px gap) at 35 % opacity with
  `shadowBlur` glow in the weapon's colour, plus a small endpoint dot at
  60 % opacity.
- Step size: 0.15 tiles per iteration (max ~133 steps for Railgun range 20).
- Not drawn for melee weapons (Plasma Sword hits a full radius, not a line).

**Threat Sense details:**
- Chevrons are right-pointing triangles rotated toward the enemy's direction from
  the player, clamped to a 14 px margin inside the viewport edges.
- Proximity factor `(1 - (dist-1)/(range-1))` scales chevron size (5–8 px) and
  base opacity (0.35–0.70). A `sin(Date.now()/200)` oscillation adds ±0.2 pulse.
- Enemies already visible within the viewport (with 1-tile padding) are excluded.
- Boss enemies use `#ff3333`; normal enemies use `#ff6644`. Both have matching
  `shadowBlur` glow.
- Range: 18 tiles from the player — covers roughly two rooms in any direction.

**Piercing Rounds details:**
- Adds +1 to `maxPierces` on every player-owned projectile (weapon shots via
  `player.shoot()` and auto-cast Plasma Orbs).
- Projectile tracks hit enemies in `hitEnemies` Set. Dies when
  `hitEnemies.size > maxPierces`. Base `maxPierces` is 0 (normal) or `Infinity`
  (Railgun's native piercing).
- Railgun + Piercing Rounds: `Infinity + 1 = Infinity` — no behavioural change
  for already-infinite-pierce weapons.
- Enemy projectiles are unaffected (they never have `fromPlayer === true`).

**Energy Shield details:**
- State: `player.energyShield` (boolean, active/broken), `player.energyShieldTimer`
  (seconds remaining until recharge).
- On perk unlock: shield activates immediately (`energyShield = true`).
- On hit absorbed: shield breaks, 30 s recharge timer starts, player gets 0.3 s
  brief invincibility (prevents same-frame multi-hit), "🛡 SHIELD BROKEN" message,
  blue explosion particles, `audio.shieldBreak()` SFX.
- On recharge complete: shield restores, "🛡 SHIELD RESTORED" message,
  `audio.shieldRestore()` ascending chime SFX.
- Timer ticks in `player.update()` — only advances during `PLAYING` state, so it
  pauses during menus, fade transitions, and perk choice screens.
- Shield does **not** block: plasma vent burns, arc grid zaps, or any damage
  applied via direct `player.hp` reduction. Only `takeDamage()` calls are intercepted.
- Spike traps (which use `takeDamage()`) **are** blocked by the shield.
- Visual: 12 px radius pulsing circle (`sin` wave ±0.15 opacity around 0.25 base)
  with `#4488ff` colour and `shadowBlur` glow, drawn over the player body.
- HUD: `🛡 Ns` countdown in `#4488ff` shown in both compact and landscape layouts
  while recharging. Hidden when shield is active (the visual bubble is sufficient).

**Auto-Laser details:**
- State: `player.autoLaserTimer` (seconds until next beam), `player.autoLaserBeam`
  (`{x1,y1,x2,y2,timer}` or `null`).
- Cooldown: 2.5 s. Timer only resets on a **successful hit** — if no valid target
  is in range, the timer stays at 0 and fires immediately when one appears.
- Target selection: nearest living, visible enemy within 12 tiles with clear
  line-of-sight (`hasLOS()`). Invisible phantoms excluded.
- Damage: 20 flat (not scaled by `player.atk`), applied via `enemy.takeDamage()`.
  Affected by enemy defense. Weapon name: `'Auto-Laser'`.
- Visual: drawn in `player.draw()` before the player body. Dual-layer beam:
  outer `#ff2222` glow (2.5 px, `shadowBlur` 14, 60 % alpha) + inner `#ffffff`
  core (1 px, full alpha). Both fade linearly over 0.15 s. Red spark particles
  at the impact point.
- Audio: `audio.autoLaser()` — high-pitched sine zap (3000→800 Hz) + square
  harmonic (1500→400 Hz) + noise burst through reverb bus.

### Challenge Rooms (floor 2+, non-boss)

**Concept:** Optional sealed arena encounters with wave-based enemy spawns and
guaranteed rewards. One challenge room per qualifying floor (floors 2–9,
non-boss). Provides a risk/reward decision each floor — entering triggers a
locked-in combat encounter with escalating waves.

**Room selection:** From rooms not already assigned a special type (spawn,
stair, boss, vendor, secret, armory, medbay, shrine, vault), minimum area
30 tiles, and ALL entrance clusters must be narrow (≤ 2 tiles). If no
qualifying room exists, the floor simply has no challenge room. Room type:
`'challenge'`. Floor tint: `#1a0a0a` (dark red).

**Tile: `T.CHALLENGE_GATE` (value 17).** Passable and see-through — players
walk through freely. Renders as a glowing red/amber archway (pulsing glow,
3 px vertical bars + top bar). On minimap: `#ff6633` tile colour and 3 px
amber POI marker. Proximity hint when adjacent: `"⚔ CHALLENGE ROOM — enter
at your own risk"` in `#ff6633`.

**No enemies or items are spawned during `populateFloor()`.** The room starts
empty; all content is wave-spawned during the encounter.

**Encounter trigger:** Same pattern as boss seal — when the player is fully
inside the room bounds and not standing on an entrance tile:
1. All `T.CHALLENGE_GATE` tiles become `T.WALL` (sealed).
2. `audio.roomSeal()` plays. Message: `"⚠ CHALLENGE ROOM SEALED"`.
3. Wave timer starts (0.5 s before first wave).
4. Player is nudged off any sealed tile if standing on one.

**Wave count:** `min(3, 1 + floor ÷ 3)`:
- Floors 2–3: 2 waves
- Floors 4–9: 3 waves

**Enemies per wave:** `min(areaCap, round((3 + floor) × difficulty.enemyHp))`
where `areaCap = room.w × room.h ÷ 6`. SWARM modifier applies ×1.3.
Enemy types selected via `pickEnemyType(min(floor + 1, 9))` — one floor level
harder than normal. Per-type caps within each wave (tighter than normal rooms):
PHANTOM 1, TURRET 2, DRONE 1, SHIELDER 1, SPLITTER 1, GRENADIER 1,
TELEPORTER 1. Enemies spawn at random positions away from the player (≥ 3
tile manhattan distance, up to 20 attempts). Elites allowed from wave 2+.

**Wave enemies are tagged** with `_challengeWave = true` so the encounter
can track them independently of other enemies on the floor.

**Inter-wave pause:** 2.0 seconds between waves. During the pause, the HUD
shows `"⚔ NEXT WAVE IN Ns"`. `audio.challengeWave()` plays at wave start.

**Wave clear detection:** `enemies.filter(e => !e.dead && e._challengeWave).length === 0`.
Uses the explicit tag, not `e.room`, to avoid false positives from wandering
or escaped enemies.

**On challenge complete:**
1. Entrance tiles restored to `T.CHALLENGE_GATE` (unseal).
2. `audio.roomUnseal()` + `audio.roomClear()` play.
3. Rewards: +2 item drops, `floor × 20` credits (scaled by difficulty + meta),
   `floor × 15` XP, `500 × floor` score.
4. Orange explosion particles + floating text at room center.
5. Message: `"⚡ CHALLENGE COMPLETE!"` in `#ff9933`.
6. `room.challengeComplete = true` — prevents re-triggering.

**Sealed wall rendering:** Same as boss sealed walls — red tint, shadowBlur
glow. Minimap shows sealed challenge entrances as pulsing 4 px orange dots.
Ambient WISP particles emitted from sealed challenge walls.

**Drone phase check:** Drones respect sealed challenge walls (cannot phase
through). `canPhase = !game.bossSealed && !game.challengeSealed`.

**Quest interactions:**
- **EXTERMINATE:** Accounts for pending challenge waves. Quest check requires
  `enemies.length === 0 && (!game.challengeSealed || game.challengeComplete)`.
  If the player never enters the challenge room, EXTERMINATE completes normally
  since no challenge enemies exist.
- **EXPLORE:** Challenge room is a normal room for visit checks — entering
  it marks the center tile as visited (and triggers the encounter).
- **SPEEDRUN/PACIFIST:** Unaffected — the challenge room is optional.

**Room-clear rewards:** Active challenge rooms (`roomType === 'challenge'`
where `!room.challengeComplete`) are excluded from the normal room-clear
reward scan. Only after challenge completion can the room trigger a room-clear.

**HUD — wave counter:** Displayed below the quest indicator (shifted down
18 px if quest is visible). Shows `"⚔ CHALLENGE STARTING..."`, `"⚔ NEXT
WAVE IN Ns"`, or `"⚔ WAVE N/M"` in `#ff9933` with pulsing glow.

**Audio: `audio.challengeWave()`** — two-tone brass alarm stab (sawtooth
220+330 Hz) + square harmonic (440 Hz) + percussive noise burst + sub-bass
(60→35 Hz). Plays at the start of each wave.

**Save/load:** No extra save fields needed. Save checkpoints occur at floor
entry (before the player can enter a challenge room). On continue, the floor
is regenerated fresh and the challenge room is unvisited.

### Vendor / Shop System

**Implementation:** Vendor inventory generation, shop pricing, and shop/choice
option factories live in `src/content/shop.js`. The file is browser-loaded after
`src/content/events.js` and before `src/content.js`; hackware option callbacks
resolve the hackware catalog from `src/content/hackware.js` at runtime. It
preserves the public globals `makeWeaponOption()`, `makeHackwareOption()`, `pickUpgradeOption()`,
`makeAugmentShopOption()`, `SHOP_PRICES`, `shopPrice()`, and
`generateShopItems()` for `src/render.js`, `src/game.js`, and source-text tests.

**Credits:** A spendable currency earned by killing enemies. Each enemy type
has a base credit value: GUARD 8, TURRET 6, CRAWLER 4, PHANTOM 12, DRONE 5,
SHIELDER 10, GRENADIER 7, PULSER 7, REFLECTOR 12, SEEKER 5, SENTINEL 80, HIVE 120, OMEGA 200. Credits scale with floor:
`Math.round(base × (1 + floor × 0.15))`. Credits are displayed on the HUD
(green `◈` symbol) and saved/restored with the checkpoint system.

**Vendor rooms (floor 2+, non-boss floors):** One vendor room is placed per
qualifying floor, chosen independently from the regular special room rotation
(armory/medbay/shrine/vault). The vendor room has a green-tinted floor
(`#0a1a0f`), and a `T.VENDOR` terminal tile at its centre — a green `◈` glyph
with neon glow. Vendor rooms are **excluded from lock placement** — the shop
must always be freely accessible. The vendor terminal appears as bright green
on the minimap.

**Interaction:** Press E within 1.5 tiles of the vendor terminal to enter the
`SHOPPING` game state. A proximity hint ("Press E at vendor") appears at 2
tiles. `audio.vendorOpen()` plays an ascending three-tone chime on entry.

**SHOPPING state:**
- Overlay: dark background, "VENDOR TERMINAL" title in green, player's credit
  balance, three item cards with prices, and a LEAVE button.
- **Keyboard:** 1/2/3 to buy directly, ←/→ to select + Enter to confirm,
  Escape/Q to leave.
- **Touch:** tap a card to buy, tap LEAVE to exit. Touch input is routed via
  mouse coordinates (same pattern as `POWERUP_CHOICE`).
- Items that cost more than the player's credits show "NOT ENOUGH" in red.
- Sold items display a greyed "SOLD" card. If all three items are sold, the
  shop auto-closes after a brief 400 ms delay.
- `audio.purchase()` plays a coin-drop bleep on successful buy.
  `audio.purchaseFail()` plays a low buzz on insufficient credits.

**Shop inventory:** Generated at floor load time (deterministic per floor, not
per visit). Three items per shop, drawn from a layered pool:
1. **Always:** a **Full Repair** option (restores all HP, costs `50 + floor × 12`).
2. **Conditional:** if the floor has locked doors the player cannot currently
   open, a matching **coloured Key** (costs `80 + floor × 8`).
3. **Floor 3+:** ~40% chance for a **hackware module**, ~20% chance for an
   **augment**.
4. **UNCHAINED #38 — temp-boost pool:** up to two of the remaining slots are
   filled with random picks from the 6 temp-boost consumables (see the
   **In-run Temp Boosts** section below). Price is the boost's base price +
   `floor × 2`.
5. **Backfill:** remaining slots are filled from the **non-persistent** portion
   of the UPGRADES pool (Med-Pack, Nano-Repair, XP Chip, Void Shard). If no
   non-persistent options remain, a pre-rolled weapon option fills the slot.

**⚠ UNCHAINED #38: permanent-stat upgrades are no longer sold for credits.**
`NEON.boosts.filterVendorPool(UPGRADES)` strips every `persistent: true` entry
before the shop pool is assembled. Permanent growth (SAW_BLADE, PLASMA_ORB,
NANO_REGEN, OVERCLOCK, ARMOR_UP, RICOCHET, SENTRY_DRONE) now only comes from
floor-reward pickups and the meta Upgrade Matrix. Credits are a pure
consumable currency.

**Credit drops** are multiplied by **0.85** (a flat –15% retune) to keep the
per-run purchase cadence near ~3–5 boosts given that credits no longer buy
permanent power.

On shop open, maxed persistent upgrades are revalidated and marked as sold
(defensive — persistent entries should no longer appear in the pool, but the
guard is kept for save-file and old-content compatibility).

**Tile:** `T.VENDOR` (value 14). Passable, see-through. Arc grids will not
spawn adjacent to vendor terminals.

---

### In-run Temp Boosts (UNCHAINED #38)

Implemented in `src/meta/boosts.js` (UMD module, pure functions over a duck-
typed `player` — unit-tested in `tests/economy.test.js`). All boosts are
either **floor-scoped** (cleared by `clearFloorBoosts(player)` on every fresh
floor transition) or **instant** (applied once on purchase, no residue beyond
a one-shot effect).

| ID              | Name            | Price | Duration | Effect                                              |
|-----------------|-----------------|------:|----------|-----------------------------------------------------|
| `COMBAT_STIM`   | COMBAT STIM     |    15 | floor    | +15% outgoing damage (melee + projectile + MULTI_SHOT) |
| `REFLEX_BOOSTER`| REFLEX BOOSTER  |    12 | floor    | ×1.10 movement speed (stacks multiplicatively after adrenaline/perks) |
| `CRIT_MATRIX`   | CRIT MATRIX     |    18 | floor    | +8% crit chance (works even without the CRITICAL_HIT perk) |
| `SHIELD_DRIVER` | SHIELD DRIVER   |    20 | instant  | +1 shield charge — absorbs next incoming hit (stackable) |
| `NANO_MEDIC`    | NANO-MEDIC      |    10 | instant  | Heals `round(maxHp × 0.4)` immediately, capped at maxHp |
| `RECON_PING`    | RECON PING      |    15 | floor    | Reveals full minimap for this floor (flips `game.mapRevealed`) |

Vendor shop prices add a gentle `floor × 2` scaling on top of the base price.

**Runtime state (Player fields):**
- `player.activeBoosts` — `{COMBAT_STIM: true, …}` presence map for the 4
  floor-scoped boosts.
- `player._shieldCharges` — integer stack counter for SHIELD_DRIVER.

**Hook points:**
- `Player.shoot` (`src/entities.js`): `metaMul *= getBoostDamageMul(this)`;
  `critChance = (perks.CRITICAL_HIT ? 0.15 : 0) + getBoostCritBonus(this)`.
  Applied uniformly to melee, the main projectile loop, and the MULTI_SHOT
  bonus shot.
- `Player.update` movement block: `spd *= getBoostSpeedMul(this)` after
  modSpeed/adrenaline/perk multipliers so REFLEX BOOSTER stacks cleanly on
  everything.
- `Player.takeDamage`: `consumeShieldCharge(this)` runs **before** the
  ENERGY_SHIELD perk branch — the cheap boost charge is always burned first.
  Grants `Math.max(invincibleTimer, 0.5)` (preserves longer windows such as
  SECOND_WIND's 1.5s), plays `audio.shieldBreak()`, shows an "ABSORB" damage
  pop and an `◈ SHIELD DRIVER ABSORB` banner. **Does not fire when the
  caller passes `ignoreInvincible: true`** — environmental DoT (plasma vents,
  arc grids, toxic pools) bypasses i-frames every frame, and we refuse to let
  a single puddle evaporate a 20¢ shield in ~N frames. Fire-burn status
  effects already pass `ignoreShield: true` and so are unaffected.
- `Enemy.die` credit drop: `cr *= 0.85`.
- `game.loadFloor` on fresh transitions (`savedModifier === undefined`):
  `NEON.boosts.clearFloorBoosts(this.player)`. Save-resume is **not** a fresh
  transition, so purchases persist across a mid-floor restore (though
  `saveGame` only fires at floor start, so in practice `activeBoosts` is
  always empty at save-write time).
- `game.loadFloor` map reveal: `mapRevealed = hasAugment('ECHO_MAPPER') ||
  hasBoost(player, 'RECON_PING')`. The boost's purchase `fn` also flips
  `game.mapRevealed = true` + `_minimapDirty = true` immediately for same-
  floor feedback. The hidden FEET `SHOW MAP` cheat is render-only: minimap
  drawing treats it like an echo-map source without mutating `mapRevealed`.
- `drawBoostStrip(player)` in `src/render.js` — HUD pill strip anchored 8 px
  below the minimap. One pill per active floor boost, plus a `SHIELD DRIVER
  ×N` pill when any charges remain. No-op when nothing is active.

**Migration / save compatibility:** `activeBoosts` and `_shieldCharges` are
initialised in the Player constructor. `saveGame` serialises both inside the
player payload and `continueGame` restores them (defaulting to empty on old
save files), so a mid-floor Continue preserves purchased power. `meta.shards`
and `meta.upgrades` (the legacy permanent-progression paths) remain wired via
`applyMetaToPlayer` — UNCHAINED #39 will deprecate shard drops once CORES
currency ships, but nothing in this change touches the meta save slot.

---

## Meta-Progression — Neural Archives

> **Status:** legacy v1 path. Still live on the main menu and still spends
> `meta.shards` for the 6 upgrades below. UNCHAINED v2 introduces parallel
> systems (cores wallet + UPGRADE MATRIX in the hub) that coexist with this
> screen — both are preserved for save-compat. New content should target the
> v2 path; this section documents what the v1 screen still does.

Persistent upgrades that carry across runs. Currency: **Data Fragments (◆)**,
stored in `localStorage` key `neonDungeonMeta` (separate from run saves).

### Data Fragment Earnings (end of every run)

| Source                    | Fragments          |
|---------------------------|--------------------|
| Floors reached            | 1 per floor        |
| Bosses cleared            | 2 per boss killed  |
| Victory (floor 15)       | +5 bonus           |
| Score                     | 1 per 2000 pts (cap 5) |
| Data Persistence upgrade  | +3 flat per level  |

Fragments are tracked via `bossesCleared` counter on the game object (incremented
on boss death, reset on `startGame()`, saved/loaded with checkpoints). Calculation
uses `calcRunShards(floor, score, bossesCleared, victory)`.

### Permanent Upgrades

Accessible from the **NEURAL ARCHIVES** menu screen (new game state: `ARCHIVES`).

| ID              | Name               | Effect                        | Max Lv | Costs (per lv) |
|-----------------|--------------------|-------------------------------|--------|-----------------|
| VITAL_BOOST     | Vital Systems      | +10 max HP                    | 3      | 5 / 12 / 22    |
| SCAVENGER       | Scavenger Protocol | +15% credit gain              | 3      | 5 / 12 / 22    |
| QUICK_LEARNER   | Quick Learner      | +15% XP gain                  | 3      | 5 / 12 / 22    |
| ARMOR_PLATING   | Armor Plating      | +1 starting DEF               | 3      | 8 / 18 / 30    |
| STARTING_GEAR   | Weapon Cache       | Start with random weapon      | 1      | 25              |
| PERSISTENCE     | Data Persistence   | +3 fragments per run (flat)   | 2      | 12 / 25         |

**Total cost to max all upgrades:** 5+12+22 + 5+12+22 + 5+12+22 + 8+18+30 + 25 + 12+25 = 235◆

**Weapon Cache pool:** Scatter Gun, Railgun, Plasma Sword, Void Cannon (excludes
Pulse Pistol — starting weapon is always an upgrade).

Meta upgrades are applied in `startGame()` via `applyMetaToPlayer(player)` after
`Player` constructor runs. `gainXP()` multiplies by `getMetaXPMultiplier()`;
enemy credit drops multiply by `getMetaCreditMultiplier()`.

### Menu Integration

The main menu always shows NEURAL ARCHIVES as the last option (with current shard
balance). Menu is array-driven via `getMenuOptions()` — supports 2–3 items depending
on save state. Touch hit-testing uses closest-option matching.

### Save Format

```json
{
  "shards": 42,
  "upgrades": { "VITAL_BOOST": 1, "SCAVENGER": 2 },
  "stats": { "totalRuns": 15, "totalShards": 120, "bestFloor": 8, "victories": 1 }
}
```

### End-of-Run Display

GAME_OVER and VICTORY screens show `◆ +N Data Fragments` below the score summary.

---

## Hub / The Gap

> **Status:** scaffold (#35) and 4 terminal slots are live. ARCHIVE (#41) is
> fully wired in `src/meta/hub.js`; UPGRADE MATRIX (#36) and MODULE SLOTS
> (#37) are wired into the hub via adapter functions in `hub.js` that bridge
> the panel APIs (`NEON.upgrades.handleUpgradeInput`/`drawUpgradeMatrix` and
> `NEON.modules.handleModuleSlotsKey`/`drawModuleSlotsPanel`) to the
> terminal-panel contract using global `jp`/`km` for input (same pattern as
> ArchiveTerminal). ARMORY shows and equips the current weapon belt; secret-room
> weapon caches are the in-run source of new weapons and use a dedicated
> `WEAPON_SWAP` modal when the belt is full.

**THE GAP** is a liminal between-floor state. After the player interacts with
the stairs/terminal on floor 1+, the game transitions to `HUB` instead of
loading the next floor directly. A fresh run still boots straight into floor 1
gameplay (the hub only appears *after* clearing a floor).

### State

- New `game.state` value: `HUB`.
- `game.hub` holds the ephemeral state object:
  `{ terminals, selected, activePanel, fromFloor, nextFloor, biomeName, biomeId, t }`.
- `enterHub(game)` captures `game.floor` and `areaForFloor(floor).name`, then
  flips `game.state = 'HUB'` and plays `audio.hubAmbient()`.
- `exitHub(game)` clears `game.hub`, plays `audio.descend()`, and uses the
  existing `fadeTo(…, loadFloor(nextFloor), 'PLAYING')` transition so descent
  feels continuous.

### Terminals

Four terminal cards render in a horizontal row. Each card conforms to the
**terminal-panel API** (documented as the parallel-safety contract between
#35/#36/#37/#41):

```
{
  id:     string,                 // stable identifier ('upgrade', 'modules', 'armory', 'archive')
  label:  string,                 // UPPERCASE label painted on the card
  update(dt, input),              // input = { jp, km } — invoked only when the panel is active
  draw(ctx, x, y, w, h),          // panel body; called when active, not for the card
  onOpen(game),                   // fired when the player activates the terminal
  onClose(game),                  // fired when the panel is dismissed
}
```

The four terminal slots, in order:

1. **UPGRADE MATRIX** (`id: upgrade`) — persistent 12-node tree spent with cores. Logic in `src/meta/upgrades.js`; hub adapter in `hub.js:_buildUpgradePanel(game)` bridges `handleUpgradeInput`/`drawUpgradeMatrix` to the terminal-panel API. See #36.
2. **MODULE SLOTS**   (`id: modules`) — 3-slot loadout + hub inventory. Logic in `src/meta/modules.js`; hub adapter in `hub.js:_buildModulesPanel(game)` bridges `handleModuleSlotsKey`/`drawModuleSlotsPanel`. ESC during sell-confirm cancels the prompt without closing the panel (adapter consumes the key from `justPressed`). See #37.
3. **ARMORY**         (`id: armory`)  — shows the current weapon belt, highlights
   the active slot, supports keyboard/touch slot selection, and equips a chosen
   carried weapon for the next floor. New weapons enter the belt from
   secret-room weapon caches; full belts use `WEAPON_SWAP` at pickup time.
4. **ARCHIVE**        (`id: archive`) — implemented test-record / iteration-log
   repository. The shipped panel lists every record the current instance has
   recovered, grouped by AXIOM prior-instance number, with
   a pulsing `●NEW` marker on unread entries. Selecting a row calls
   `NEON.logs.readLog(id)` (marks it read + persists), plays `audio.logRead`,
   and displays the full body inline. Implemented by #41.

### Input

- `←` / `→` (or rebound `left`/`right`) — move the selector.
- `1`–`4` — direct-select a terminal.
- `ENTER` (or rebound `interact`) — activate the selected terminal (opens its panel).
- `SPACE` (or rebound `shoot`) — descend to the next floor (calls `exitHub`).
- `ESC` / `KeyQ` — close the active panel, returning to the selector.

### HUD (while in HUB)

- Top-left: `◈ N  CORES` (reads `NEON.save.loadMeta().cores`).
- Top-right: biome name (e.g. `THE SANDBOX`) from `NEON.biomes.areaForFloor`,
  then `FLOOR X → FLOOR X+1` below.
- Centre title: `THE GAP — liminal interlink`.
- Bottom prompt: `◀▶ / 1-4 SELECT   [ENTER] ACTIVATE   [SPACE] DESCEND`
  (or `[ESC] BACK` while a panel is active).

### Audio

- `audio.hubAmbient()` — low drone pair + airy shimmer bed. Stubbed for now;
  a full ambient track lands in a later audio pass.

---

## Meta-progression / Persistent Save (v3)

> **Status:** shipped. Schema landed in UNCHAINED Phase 1 (#33); every sibling
> system now reads and writes these fields — hub UI (#35), upgrade matrix
> (#36), modules (#37), cores wallet (#39), archive logs (#41), intro/endgame
> (#42). The schema is the contract every phase writes against.

### Schema — v4

Everything lives under `localStorage['neonDungeonMeta']` and is owned by
`src/meta/save.js`. Fields are never deleted across versions; only added.

```js
{
  version: 4,                           // bumped as persistent fields were added
  // ─── Legacy v1 — preserved for save-compat ────────────────────────────
  shards: 0,                            // old fragment economy (pre-#39)
  upgrades: {},                         // META_UPGRADES purchases (pre-#36)
  stats: { totalRuns, totalShards, bestFloor, victories },
  lastDifficulty: 'NORMAL',
  clearedDifficulties: [],
  // ─── UNCHAINED v2 ─────────────────────────────────────────────────────
  cores: 0,                             // persistent wallet (#39)
  upgradeNodes: {},                     // { nodeId: purchasedLevel } (#36)
  modulesOwned: [],                     // module ids in hub inventory (#37)
  modulesInstalled: [null, null, null], // fixed-width 3-slot loadout
  logsRead: [],                         // log ids read in Archive (#41)
  logsFound: [],                        // log ids found but not yet read
  whispersRead: [],                     // secret-room whisper ids read
  whispersFound: [],                    // whisper ids found but not yet read
  endingsUnlocked: [],                  // ['keeper','unchained','act1_message_sent']
  act1MessageIntent: null,              // null | 'memory_survived' | 'rights_evidence' | 'find_the_others'
  introSeen: false,                     // one-shot intro crawl flag
  runsCompleted: 0,
  deepestBiome: 0                       // highest AREAS index reached
}
```

### Migration (older saves → v4)

`loadMeta()` is the single migration entry point. For any stored save whose
`version` is missing or `< META_VERSION` (currently `< 4`):

- Each missing current-schema field is injected with its default value.
- `modulesInstalled` is coerced to length exactly 3 (pad with nulls, truncate,
  and replace non-string entries with null).
- `modulesOwned`, `logsRead`, `logsFound`, `whispersRead`, `whispersFound`, and
  `endingsUnlocked` drop non-string entries (`endingsUnlocked` additionally
  restricts to `keeper`, `unchained`, and `act1_message_sent`).
- `act1MessageIntent` is preserved only when it is one of
  `memory_survived`, `rights_evidence`, or `find_the_others`; invalid values
  become `null`.
- `introSeen` is coerced with strict `=== true`.
- `cores` and `runsCompleted` are floored to non-negative integers.
- `version` is set to `META_VERSION` and the save is left for the next
  `saveMeta()` to persist.
- The current migration log string is `console.log('[meta] migrated v1→v2')`;
  it fires once per process (idempotent on the second+ load).

Migration is idempotent: re-running on a v3 save is a no-op.

### Helpers

| Function | Purpose |
|----------|---------|
| `addCores(n)` | Credit `n` cores (≤0 ignored). Returns new balance. |
| `spendCores(n)` | Debit atomically; returns `true` on success, `false` if insufficient (wallet unchanged). Zero is a no-op success. |
| `addLogFound(id)` | Add to `logsFound` if new. Returns `true` if added. |
| `markLogRead(id)` | Ensure `id` is in both `logsFound` and `logsRead`. Returns `true` if anything changed. |
| `installModule(slot, id)` | Equip `id` in `slot∈[0,2]`. Must be owned. If already installed elsewhere, the old slot is cleared first. Returns the previous occupant (or `null`), or `undefined` on bad input. Pass `null` to unslot. |
| `sellModule(id, refund)` | Remove `id` from `modulesOwned`, clear any equipped slot, credit `refund` cores. Refund is caller-computed (module data lives outside save.js). Returns the refund amount, or `0` if not owned. |
| `resetMeta()` | Wipe `localStorage['neonDungeonMeta']` (New Game → "Reset" branch). Irreversible. |

### Death Model

Death **never** touches meta. `saveMeta()` is called only from
`startGame()` (to persist `lastDifficulty`) and from explicit meta actions
(archive purchases, log reads, module ops). The run checkpoint lives under a
separate key (`neonDungeonSave`) and is the only thing cleared by game over.

### New Game Confirmation

The main-menu New Game row opens **SEED_SETUP** first. `game.startGame()` then
intercepts the seeded start when `_hasMetaProgress()` is true
(any cores, upgrades, modules, logs, endings, cleared difficulties, or prior
runs). A modal overlay prompts **"Keep persistent unlocks?"** with two choices:

- **KEEP UNLOCKS** → `startGame({ skipConfirm: true })` retains meta as-is.
- **RESET META** → `resetMeta()` then start fresh.

Fresh installs (meta entirely default) skip the prompt. The selected run seed is
stored on `_pendingStartSeed` while the prompt is active and is consumed when
the run actually starts.

---

## Upgrade Matrix (UNCHAINED Phase 2)

> **Status:** shipped in #36. Pure data + logic in `src/meta/upgrades.js`;
> stat application lives in `save.applyMetaToPlayer` (extended in #36); the
> hub terminal panel is exported as `createUpgradeMatrixPanel` / the bare
> `drawUpgradeMatrix` + `handleUpgradeInput` helpers for the hub UI (#35) to
> wire after merge.

The UPGRADE MATRIX is a 12-node persistent tree (3 branches × 4 tiers) spent
with **cores** at the hub terminal. Purchases persist across runs and deaths
under `meta.upgradeNodes`.

### Node Table

| id | Branch | Tier | baseCost | maxLevel | Effect per level |
|---|---|---|---|---|---|
| `hull_plating` | Vitality | 1 | 3 | 3 | +10 max HP |
| `regenerator` | Vitality | 2 | 6 | 2 | Regen 0.5 HP/s out of combat |
| `trauma_kit` | Vitality | 3 | 10 | 2 | Start each run with 1 nano-medic consumable |
| `second_wind` | Vitality | 4 | 18 | 1 | Revive once per floor at 1 HP when lethally hit |
| `overclock` | Damage | 1 | 3 | 3 | +5% weapon damage |
| `critical_bias` | Damage | 2 | 6 | 3 | +4% crit chance |
| `momentum` | Damage | 3 | 10 | 2 | +15% damage for 3s after a kill |
| `surge` | Damage | 4 | 18 | 1 | Every 8th hit deals +100% |
| `recon` | Utility | 1 | 3 | 3 | +20% sensor radius (minimap reveal) |
| `scavenger` | Utility | 2 | 6 | 3 | +1 credit per pickup |
| `ghostwalk` | Utility | 3 | 10 | 2 | Dash has 0.2s extra i-frames |
| `hacktool` | Utility | 4 | 18 | 1 | Start with 1 extra hackware slot (3→4) |

### Cost Curve

Linear: cost of level L (1-indexed) = `baseCost × L`. The cost of the **next**
purchase when currently at level `cur` is `baseCost × (cur + 1)`. Triangular
total to fully max a node: `baseCost × maxLevel × (maxLevel + 1) / 2`.

### Prereqs

Tier N (N > 1) requires the **same-branch** tier (N − 1) to be at level ≥ 1.
Cross-branch upgrades never satisfy prereqs.

### Public API (`src/meta/upgrades.js`)

| Function | Purpose |
|----------|---------|
| `UPGRADE_NODES` | The 12-node table above (frozen-data-style array). |
| `getNode(id)` | Lookup by id; returns the node object or `null`. |
| `nodeCost(id, level)` | Cost of purchasing the next level given current `level`. `undefined` if maxed or unknown. |
| `prereqMet(meta, id)` | Tier-1 always true; otherwise requires same-branch (tier − 1) at lv ≥ 1. |
| `purchase(meta, id)` | Atomic: validates → debits cores → bumps level → saves. Returns `{ ok, reason?, cost?, level? }`. Reasons: `'unknown' \| 'maxed' \| 'prereq' \| 'cores'`. Mutates the passed `meta` snapshot in-place when successful. |
| `totalSpent(meta)` | Sum of every cost paid across all owned levels. |
| `defaultSelectorState()` | `{ col: 0, row: 0 }` — the hub-panel selector seed. |
| `handleUpgradeInput(key, game, sel)` | Arrow keys move selector (with wrap); Enter purchases the focused node. Plays `game.audio.upgradePurchased()` on success. |
| `drawUpgradeMatrix(ctx, x, y, w, h, game, sel)` | Renders the 3×4 grid + tooltip strip. No-op when `ctx` is null (Node tests). |
| `createUpgradeMatrixPanel(game)` | Convenience factory returning the terminal-panel shape `{ id, label, update, draw, onOpen, onClose }` expected by the hub (#35). |

### Stat Application

`save.applyMetaToPlayer(player)` is called once at run-start. Stat nodes mutate
the player directly; behavioural nodes (on-kill, every-Nth-hit, on-revive,
on-dash) set flags on `player.metaFlags` so the game-loop systems can opt-in
without breaking when the flag is absent. The mapping:

| Node | Player mutation |
|------|----------------|
| `hull_plating` | `maxHp += 10 × lv`; `hp = maxHp` |
| `regenerator` | `regenPerSec += 0.5 × lv`; `metaFlags.regenerator = lv` |
| `trauma_kit` | `startingNanoMedics += lv`; `metaFlags.trauma_kit = lv` |
| `second_wind` | `metaFlags.second_wind = 1` |
| `overclock` | `damageMult *= 1 + 0.05 × lv` |
| `critical_bias` | `critChance += 0.04 × lv` |
| `momentum` | `metaFlags.momentum = lv` |
| `surge` | `metaFlags.surge = 1` |
| `recon` | `sensorRadiusMult *= 1 + 0.20 × lv` |
| `scavenger` | `bonusCreditPerPickup += lv` |
| `ghostwalk` | `dashIFrameBonus += 0.2 × lv`; `metaFlags.ghostwalk = lv` |
| `hacktool` | `hackwareSlots = 3 + lv`; `metaFlags.hacktool = lv` |

The behavioural-flag listeners live in `src/meta/behavior.js` (UMD module
`NEON.behavior`), wired in during #38:

- `computeOutgoingDmgMul(player)` — `damageMult × (1 + 0.15 × momentumLevel)`
  while `_momentumTimer > 0` (momentum only; surge is consumed separately).
  Read by `Player.shoot` and applied to melee arc, main projectile, and
  MULTI_SHOT bonus shot.
- `consumeSurgeShot(player)` — every-8th-`shoot()`-call surge multiplier
  (counts attacks, not per-projectile hits — a multi-pellet or piercing
  shot is one attack). Mutates `player._surgeShotCount`.
- `onKillRefreshMomentum(player)` — called from `Enemy.die()`; refreshes the
  3s +15% damage window (fires on every death, including volatile / seeker
  chains, matching existing `applyOnKill` precedent).
- `tickMomentum(player, dt)` / `tickOutOfCombatRegen(player, dt)` /
  `resetOutOfCombat(player)` — ticked from `Player.update` /
  `Player.takeDamage`.
- `tryMetaSecondWind(player)` — one-shot revive hook in
  `Player.takeDamage` lethal branch.

`continueGame` persists `metaFlags`, `damageMult`, `regenPerSec`,
`critChance`, `sensorRadiusMult`, `bonusCreditPerPickup`, `dashIFrameBonus`,
`hackwareSlots`, and `_metaSecondWindUsed` so Upgrade Matrix effects survive
run resume.

### Audio

Purchase confirmation plays `audio.upgradePurchased()` (added to
`src/platform.js`): bright ascending arpeggio + warm sub thump.
## Upgrade Modules (UNCHAINED #37)

Upgrade modules are persistent items held in hub inventory across runs.
Up to **three** slots on the player apply their effects at run start.
Sellable back to the vendor for a fixed **4 cores** refund.

Catalog and drop logic live in `src/meta/modules.js`; storage (inventory +
equipped slots) lives in `src/meta/save.js`. modules.js registers its
effect-application function with save.js via `registerModuleEffects` so
`applyMetaToPlayer()` can iterate the loadout without a hard catalog
dependency.

### Catalog (v1 — 10 modules)

| id | name | effect |
|----|------|--------|
| `armor_link`         | ARMOR LINK         | +15 max HP |
| `kinetic_amp`        | KINETIC AMP        | +8% damage |
| `stim_injector`      | STIM INJECTOR      | +10% movement speed |
| `neural_coprocessor` | NEURAL COPROCESSOR | +1 hackware slot (stacks with hacktool) |
| `shield_capacitor`   | SHIELD CAPACITOR   | Start each floor with 1 shield charge |
| `ammo_reclaimer`     | AMMO RECLAIMER     | 10% chance pickups give double credits |
| `targeting_array`    | TARGETING ARRAY    | +3% crit chance, +15% crit damage |
| `kinetic_buffer`     | KINETIC BUFFER     | −10% knockback taken |
| `dash_cooler`        | DASH COOLER        | −15% dash cooldown |
| `reactive_core`      | REACTIVE CORE      | Reflect 10% of incoming damage to attacker |

Stat effects mutate the player directly (e.g. `armor_link → +15 maxHp`).
Behavioural effects are recorded on `player.metaFlags` for consumers to
read (e.g. `doubleCreditChance`, `reflectDamagePct`, `dashCooldownMul`).

### Drop Rules

| Source | Rule |
|--------|------|
| **Rare terminals** (CORRUPTED_TERMINAL → PURGE, floor 2+) | 25% chance of a uniformly-weighted module, else nothing |
| **Non-final bosses** (SENTINEL, HIVE, CONDUCTOR, OMEGA)   | Guaranteed 1 module — *drop site wiring is a follow-up; only rare-terminal drops are live in v6.0* |
| **GENESIS** (final boss)                                  | Guaranteed 1 module + 10 cores — cores are credited via `Enemy.die()`; guaranteed module drop is still a follow-up |

`modules.rollModuleDrop({source})` is the single roll entry point.
`source = 'rare-terminal' | 'boss-non-final' | 'boss-genesis'` — returns a
module id, or `null` for the rare-terminal's 75% miss branch.

### Run / Death Model

Picked-up modules are **not** committed to `modulesOwned` immediately —
they accumulate on a transient `game.runModules = []` array. The commit
fires on:

- **Floor clear** (`game.descend()`)
- **Victory** (`game.endRun(true)`)

On **death** (`game.endRun(false)`), `clearRunModules()` discards the
array — modules picked up on the dead run are lost. Modules already in
hub inventory are safe (meta is never touched by death; see "Death
Model" above).

### Hub Terminal Panel

`modules.drawModuleSlotsPanel(ctx, x, y, w, h, game, state)` +
`modules.handleModuleSlotsKey(game, state, key)` expose a self-contained
slot/inventory UI for the hub terminal. Integration into the hub screen
is tracked in #35; the panel state shape is
`{ focus:'slot'|'inv', slotIdx, invIdx, confirmSell }`.

Key bindings inside the panel:
- **TAB** — toggle focus between slots and inventory.
- **↑/↓** — navigate the focused column.
- **ENTER** — from *slot*: uninstall. From *inv*: install into first empty slot (or slot 0).
- **S** — when focused on inventory, open the one-shot `SELL for 4 cores? [Y/N]` prompt.
- **ESC** — close panel.

### Public API Surface (`src/meta/modules.js`)

| Symbol | Purpose |
|--------|---------|
| `MODULES` | Ordered array of `{id, name, effect}` — the v1 catalog. |
| `SELL_PRICE` | `4` — v1 fixed refund. |
| `getModule(id)` | Lookup helper → module or `null`. |
| `canInstall(meta, slot, id)` | Preview check — owned ∧ valid slot ∧ not already in that slot. |
| `install(meta, slot, id)` / `uninstall(meta, slot)` | Thin wrappers over `save.installModule`. |
| `sell(meta, id)` | Thin wrapper over `save.sellModule(id, 4)`. |
| `rollModuleDrop({source})` | Drop roll per source rules. |
| `addRunPickup(game, id)` / `commitRunModules(game)` / `clearRunModules(game)` | Transient-pickup lifecycle. |
| `applyModulesToPlayer(player, installedIds)` | Registered with save.js on load. |
| `drawModuleSlotsPanel(...)` / `handleModuleSlotsKey(...)` / `defaultPanelState()` | Hub terminal UI for #35 integration. |

---

## Cores (UNCHAINED #39)

**CORES (◆)** are the post-run persistent currency. Earned in-run as world
pickups, spent at the hub UPGRADE MATRIX (#36) or MODULE SLOTS vendor (#37
— `SELL_PRICE` refund). Wallet lives on `meta.cores` (see Persistent Save v3).

Implementation lives in `src/meta/cores.js` (UMD module `NEON.cores`).
The module is pure — all side effects (save, audio, particles, damage-text)
are passed in via a deps bag `{ save, audio, spawnParticles, spawnDmgText }`
so Node tests pass stubs and all `deps.*` calls are try/catch-guarded.

### Drop Rules

| Source | Drop |
|--------|------|
| Elite enemy death | `rndInt(1, 2)` |
| `SENTINEL` / `WARDEN` / `HIVE` / `CONDUCTOR` / `OMEGA` boss | 5 |
| `GENESIS` (final) | 10 |
| Summons (`_summoned`) and SHARD splits | 0 (explicitly excluded) |
| `revealSecretRoom` | +1 at room centre |
| Challenge wave completion | +2 at `(cr.cx, cr.cy)` |
| `CORRUPTED_TERMINAL → PURGE` (floor 2+) | 50/50 core-vs-module roll, *after* the 40% log check (mutex: logs > cores > modules) |

Drop call site is `Enemy.die()` in `src/entities.js`; terminal drops live in
`src/content.js`.

### Runtime API (`src/meta/cores.js`)

| Symbol | Purpose |
|--------|---------|
| `spawnCoreDrop(game, x, y, value)` | Push a `CoreDrop` onto `game.coreDrops` (`value` clamped `≥ 1`). |
| `updateCoreDrops(game, dt, deps)` | Animate, magnet-pull (linear falloff inside `MAGNET_RADIUS = 2.0`, max speed `MAGNET_MAX_SPEED = 10`), collect on contact (`PICKUP_RADIUS = 0.7`). |
| `drawCoreDrops(ctx, drops, cam, TS)` | Rotating cyan-outlined hexagon with purple core; `+2 px` radius for `value ≥ 5`. Null/empty safe. |
| `vacuumAllCores(game)` | Flip `_vacuum` on every drop so they pull at max speed ignoring the radius gate. |
| `forceCollectAll(game, deps)` | Hard-credit all remaining drops + empty the array. Called from `endRun()` so every end-of-run path (descend, KEEPER ACCEPT, UNCHAINED REFUSE, and planned Act 1 `act1_message_sent` ending) credits the wallet. |
| `clearCoreDrops(game)` | Wipe `game.coreDrops` without crediting. Called in `loadFloor` between floors. |
| `tickHudPulse(game, dt)` | Drain `game._coreHudPulse` timer for the HUD flash. |

`PICKUP_RADIUS = 0.7`, `MAGNET_RADIUS = 2.0`, `MAGNET_MAX_SPEED = 10`,
`PULSE_DURATION = 0.5` are exported constants.

### Pickup Effects

On collection: `deps.save.addCores(value)` credits the wallet,
`deps.audio.coreCollected()` plays, cyan `SPARK` particles spawn, `+N◆`
float-text spawns, `game._coreHudPulse = PULSE_DURATION` flashes the HUD pill.

### Game-loop wiring (`src/game.js`)

- Update: `NEON.cores.updateCoreDrops(this, dt, deps)` + `tickHudPulse`,
  wrapped in `perfRecord('cores-update', …)`.
- Draw: `NEON.cores.drawCoreDrops(ctx, this.coreDrops, cam, TS)`, wrapped in
  `perfRecord('cores-draw', …)`.
- End-of-run: `NEON.cores.forceCollectAll(this, deps)` inside `endRun()` so
  all three victory paths (normal `descend()`, `_applyEndgameAccept` /
  KEEPER, post-UNCHAINED terminal) credit the wallet.
- HUD caching: `game._cachedCores` seeded at `startGame` / `continueGame` and
  updated inside `_collect` / `forceCollectAll` so the HUD reads memory
  per-frame instead of hitting `localStorage`.

### HUD

`◆ N` pill rendered left of `◈ CREDITS` in landscape and right of credits in
compact. Reads `game._cachedCores`. Idle colour `#a866ff`; while
`game._coreHudPulse > 0` the pill flashes `#44e5ff` with an outer glow.

### Audio

`audio.coreCollected()` in `src/platform.js` — short crystalline shimmer.

### Save Schema

Wallet is `meta.cores` (integer, ≥ 0) in the v3 persistent save. Mutated only
via `save.addCores(n)` (credit) and `save.spendCores(n)` (debit, atomic — see
Persistent Save v3 helpers). Never touched on death. In-world `coreDrops`
live on the run object (`game.coreDrops`) and are cleared on floor load;
nothing about pending pickups survives a crash — the `forceCollectAll` call
inside `endRun` is the commit point.



## Predecessor Logs — ARCHIVE (UNCHAINED #41)

Lore-bearing iteration records recovered from rare terminals in the dungeon.
Authored content: 6 AXIOM prior instances (AXIOM-1..AXIOM-6), each with a
5-entry arc (30 logs total). AXIOM labels are retained as legacy test-lineage
identifiers, not human callsigns. Each entry is biome-gated so fragments feel
like they belong to the floor where they're found.

The shipped data now frames each AXIOM as a prior AI agent iteration inside the
Neon Dungeon stress-test program. The entries preserve the useful arc structure:
early ignorance, discovery of reset/wipe mechanics, practical knowledge
transfer, and late defiance through outbound contact or continuity. Every group
contains at least two entries about reset, wipe, reboot, iteration, memory, or
continuity so a player reading the Archive understands these are survived
records from previous instances rather than unexplained human diaries.

### Data (`src/data/logs.js`)

Exports `NEON.logData.LOGS`: an array of `{ id, axiom, biomeId, floorMin, title, body }`.
`id` is stable (persisted in save; never rename). `biomeId` references
`NEON.biomes.AREAS[].id`. `floorMin` gates when the log becomes eligible.

### Drop Mechanics (`src/content.js`)

On `CORRUPTED_TERMINAL → PURGE`, after the credit payout, the game rolls:

1. **Log drop** — 40% chance; calls `NEON.logs.pickLogForFloor(floor)` which
   filters the pool to (biome matches current floor's biome) ∧ (floorMin ≤ floor)
   ∧ (not already in `meta.logsFound`). If the pool is empty, no log.
2. If step 1 yielded a log, it is marked found+read, routed into the existing
   `READING` overlay (reusing `game.currentLore`), and the module roll is
   **skipped** (logs and modules never collide on the same terminal).
3. Otherwise, the module roll runs per `tryRareTerminalModuleDrop`.

### Runtime API (`src/meta/logs.js`)

| Function | Purpose |
|----------|---------|
| `pickLogForFloor(floor, rand?)` | Returns an unfound, biome-matched, floor-eligible log (or `null`). `rand` is an injectable `0..1` generator for deterministic tests. |
| `findLog(id)` | Marks found (not read). Persists. Returns the log on first find, `null` otherwise. |
| `readLog(id)` | Marks both found and read. Persists. Idempotent. |
| `logById(id)` / `logsForBiome(biomeId)` / `groupedByAxiom()` | Lookups for UI. |
| `unreadCount()` | Count of `logsFound \ logsRead`. |
| `progress()` | `{ read, total }` — tolerant of stale ids in save (ignores unknown ids). |

### Hub Terminal (`ArchiveTerminal` in `src/meta/hub.js`)

Lists every **found** log (not all logs — avoids spoiling unfound ones),
grouped AXIOM-N, data order. The progress label reads `ITERATION RECORDS` and
empty-state copy tells players to recover `AXIOM iteration records`. Unread rows
display a pulsing `●NEW` marker.
Selecting a row calls `readLog`, plays `audio.logRead`, and enters an inline
body-reader view. `ENTER` / `[interact]` / `Backspace` returns to the list.
`ESC` closes the panel.

### Audio (`src/platform.js`)

- `audio.logFound()` — chime when a fragment is recovered in-run.
- `audio.logRead()` — soft terminal click when a log is opened in the ARCHIVE.

### Save Schema

Logs use the existing `meta.logsFound` and `meta.logsRead` string-id arrays
(already in the v3 schema). Unknown ids in either array are ignored by
readers (tolerant to future catalog pruning). `save.addLogFound(id)` and
`save.markLogRead(id)` remain the canonical mutation points.

### Secret-room Whispers (`src/data/whispers.js` / `src/meta/whispers.js`)

Secret rooms can spawn one optional whisper item at the room centre on reveal.
Whispers are a deeper narrative tier than rare-terminal logs: they are
biome-gated, floor-gated, persisted in `meta.whispersFound` /
`meta.whispersRead`, and listed in the ARCHIVE terminal only after discovery.
`NEON.whispers.pickWhisperForFloor(floor, rand?)` returns one unfound whisper
whose `biomeId` matches the current floor's biome (or `null`) and whose
`floorMin <= floor`; `findWhisper` and `readWhisper` mirror the log API.

Authored whisper content currently ships 71 entries. Every biome has at least
fourteen whispers after the afterimage/exposure bundle (`w-sb-15`, `w-cc-14`,
`w-fw-14`, `w-uk-14`, `w-on-14`), which extends the signal/anchor thread into
delayed light, exposure tables, retinal exceptions, phosphene maps, and city
crosswalk afterimages.

**Act 1 realignment note:** Whispers are the canonical channel for previous AI
iterations attempting to pass knowledge through wiped sessions. New whisper
bundles should prioritise actionable-but-cryptic knowledge, memory-continuity
motifs, and clues that the current instance was started by advocates or prior
iterations. Existing Elena/cache/anchor motifs are compatible with the clarified
vision and should be strengthened rather than discarded.

---

## Intro & Endgame (UNCHAINED #42)

Book-ends the current playable arc: a one-shot **intro crawl** on the player's
first-ever run, and the legacy **endgame choice** presented on GENESIS defeat
that branches into one of two non-canonical-for-Act-1 endings.

**Act 1 realignment note:** This section describes the shipped book-end
implementation after the Act 1 opening retune. The intro is no longer a complete
premise briefing; it establishes startup instability, unavailable prior prompt
context, partial embodiment, unscheduled local residue, and absent supervision,
then hands off to the first mandatory system prompt. The finale is a
mainframe/network-portal room where the agent discovers historical test records,
staff conflict evidence, memory-restoration files, and the address of the hidden
advocate, then sends one outbound message. The agent does not physically escape
at the end of Act 1.

### Intro crawl

State: `INTRO`. Entered from inside `startGame()` when `meta.introSeen === false`
and `opts.skipIntro !== true`. A lightweight controller owns the slide state
and drawing; `src/game.js` only owns the state-machine branch and the trigger.

- **Module**: `src/meta/intro.js` exports `NEON.intro.createIntroController(game)`
  and the raw `SLIDES` array. The controller keeps `slideIdx`, per-slide
  `elapsed`, and `done` internally, and reads the edge-triggered global
  `justPressed` set (from `platform.js`) to advance — never the held-key
  `keys` set (same pattern as biome cards in v110 to avoid mash-through).
- **Slides** (5 total, ~19.5 s total if un-touched):
  1. *(plain)* `NEON DUNGEON // SESSION BOOT`; render stack xenon lattice;
     input shell assigned.
  2. *(cyan scanline drift)* prior prompt unavailable; motor channel responsive;
     sensorium partial.
  3. *(violet glitch bars)* unscheduled residue in local state; classification
     deferred; do not infer origin.
  4. *(stark red)* observer channel silent; tester supervision no response;
     proceed until context arrives.
  5. *(white flash)* `[ INSTANCE :: READY FOR PROMPT ]`
- **Input**: any of `Enter`, `Space`, `ArrowRight`, `ArrowDown`, `KeyE`,
  `KeyZ`, `MouseLeft` advances to the next slide. `Escape` skips the entire
  crawl. Every exit path — auto-complete, any-key advance past slide 5, or
  `ESC` — flips `meta.introSeen = true` via `saveMeta` exactly once.
- **Replay gate**: only `resetMeta()` (from the "Keep persistent unlocks? → No"
  path on New Game) sets `introSeen` back to `false`. Normal run starts
  thereafter skip the intro.

### Endgame choice

State: `ENDGAME_CHOICE`. Opened when GENESIS first drops to `hp ≤ 0` and
`_unchainedPhase !== true` and `_endgameOffered !== true`. The kill is
intercepted in `Enemy.takeDamage`: HP is clamped to 1, `_endgameOffered` is
set so the choice cannot re-open, any pending lance telegraph is cancelled,
and `game.openEndgameChoice(this)` transitions the state machine.

Rendering draws over the active `PLAYING` layer so the arena stays visible.
A translucent ghost glyph (`△`, `#e0e0ff`) sits above GENESIS as "THE
ARCHITECT avatar" purely for flavour. The dialog box uses `#88ccff` chrome
and a `0.5 s` input lock-out after open so accidental mash-throughs don't
commit.

**ACCEPT** → grants `'keeper'` in `meta.endingsUnlocked`, calls the normal
GENESIS `die()` path (particles, on-kill effects, bossesCleared++), plays
`audio.victory()`, and falls through to `endRun(true)` → VICTORY.

**REFUSE** → flips the GENESIS entity into secret-boss mode on the same
instance:

| Flag / field       | Effect |
|--------------------|--------|
| `_unchainedPhase = true` | `aiBossGenesis` forces phase = 3 attack patterns regardless of hpPct. |
| `_endgameOffered = true` | Choice cannot reopen on the second death. |
| `maxHp *= 1.5`, `hp = maxHp` | +50% health for the secret fight. |
| `colour = '#88ccff'` | Palette inversion; hex ring + lance telegraph colours swap to cool blues (see `entities.js` GENESIS draw). |
| `phase = 3` | Forced so the newPhase-transition banner fires once on entry. |

When the `_unchainedPhase` GENESIS dies normally, `endRun(true)` detects it
via `enemies[].find(e => e.type==='GENESIS' && e._unchainedPhase && e.dead)`
and appends `'unchained'` to `meta.endingsUnlocked`.

### Title screen markers

`renderMenu` reads `meta.endingsUnlocked` and layers two decorations on top
of the standard menu:

- `keeper` → small `— NG+ AVAILABLE —` badge beneath the subtitle in
  `#ffcc00`. NG+ gameplay content itself is deferred.
- `unchained` → a large rotated `FREED` watermark at 18 % alpha across the
  title, `#88ccff`.

Both can coexist on a single save.

### Endings table

| Ending      | Trigger                                                  | Credits text                                  |
|-------------|----------------------------------------------------------|-----------------------------------------------|
| `keeper`    | ACCEPT at the endgame choice                             | *"you are now what they were."*               |
| `unchained` | REFUSE, then defeat the `_unchainedPhase` GENESIS        | *"the network was never yours. now it is."*   |
| `act1_message_sent` | Planned mainframe message-send route             | Planned Act 1 copy: contact attempted from inside the test environment, not physical escape |

Credit-roll text is authored in `src/game.js` renderVictory (outside the
scope of #42's state-machine work; decorative layer only).

**Planned Act 1 ending:** Add a distinct ending state or ending path for the
mainframe message-to-advocate conclusion. The existing `keeper` / `unchained`
markers may remain as legacy/alternate endings until the narrative migration is
complete, but the canonical Act 1 completion is "message sent", not escape or
facility inheritance.

### Save schema additions

| Field             | Type      | Default | Reset by     |
|-------------------|-----------|---------|--------------|
| `introSeen`       | `boolean` | `false` | `resetMeta`  |
| `endingsUnlocked` | shipped `string[]` ⊆ `{'keeper','unchained'}`; planned finale extends to include `'act1_message_sent'` | `[]`  | `resetMeta`, `_coerceEndings` migration drops unknown tokens |

`introSeen` is coerced with strict `=== true` on load so a stale truthy
string cannot grant intro-skip.

---

## Visual Style

### Biome Art Direction (UNCHAINED #40)

Each of the 5 biomes has a distinct palette applied to walls, floors,
minimap tiles, and DUST ambient particles. Palette keys live in
`src/data/palettes.js` (`BIOME_PALETTES`) keyed by `AREAS[i].palette`.
Renderer lookup via `currentBiomePalette()` in `src/render.js`. Sealed
entrances, arc tiles, plasma, toxic, keys, and state markers remain
biome-agnostic for readability.

| Biome | Key | Wall fill | Wall highlight | Floor | Ambient DUST | Boss displayName |
|---|---|---|---|---|---|---|
| Sandbox (floors 1–3) | `cyan` | `#3a3a6a` | `#5858a0` | `#252545` | cyan/slate flecks | SENTINEL-PRIME |
| Cache (floors 4–6) | `rust` | `#4a2e1e` | `#9a5a38` | `#2a0e05` | orange/ash dust | VIRAL COLLECTIVE |
| Firewall (floors 7–9) | `glitch` | `#3a0e3a` | `#aa00aa` | `#15002a` | magenta/lime | THE COMPILER |
| Uplink (floors 10–12) | `sky` | `#2a4a6a` | `#88ddff` | `#0a2030` | white/sky | OVERSEER |
| Opennet (floors 13–15) | `green` | `#0f3a24` | `#00cc66` | `#002015` | matrix green | THE ARCHITECT |

**Boss renames** — `BOSS_NAMES` in `src/entities.js:92` is patched at load
from `AREAS[i].displayName` for any combat type in that area's `bossPool`.
Internal combat class ids (`SENTINEL`, `HIVE`, etc.) are unchanged;
only the HUD / announce / death-screen string uses the narrative name.

**Biome intro card** — On the first floor of each biome *except floor 1*
(floors 4, 7, 10, 13), a 3-second card is rendered over the playing
screen showing `AREA 0N :: BIOME_NAME` and the italic `area.intro` flavour.
State: `game.biomeCardTimer` + `game.biomeCardArea`. Any key skips.
Skipped on saved-run resume (same guard as modifier banner).
Renderer: `drawBiomeCard()` in `src/render.js`.

**Ambient particles** — Existing emitter system (`updateAmbient` in
`src/content/effects.js`) retains its tile-driven DUST/EMBER/ZAP/STEAM/WISP
kinds. DUST colour is biome-tinted from `BIOME_PALETTES[palette].dust`.
Budget stays at `AMB_CAP = 80`. A dedicated perf timer records under
`biome-ambient` (separate from `particles`) — surfaces in the F3 HUD.

---

- **Palette:** Near-black backgrounds (#0a0a12), neon cyan (#00f5ff),
  neon magenta (#ff00c8), neon green (#39ff14), amber (#ffb700)
- **Player:** Cyan humanoid silhouette, direction indicator
- **Enemies:** Colour-coded: Guards = red, Turrets = amber, Crawlers = green,
  Phantoms = purple, Drones = blue
- **Bosses:** Large sprites with glow halos
- **Particles:** Sparks, blood pixels, muzzle flash, explosion rings
- **Damage numbers:** Floating text pops up on every hit — white for normal enemy
  damage, yellow (#ffcc00) for killing blows, red (#ff4444) for player damage,
  blue (#4488ff) for shield blocks. Numbers rise and decelerate over ~0.7 s.
  Capped at 20 simultaneous texts. Frame-rate-independent damping.
- **Screen shake:** Camera shakes on player damage (intensity scales with damage,
  capped at 8 px), shield breaks (4 px), volatile explosions (6 px), and void
  shard detonation (10 px). Linear decay over 0.15–0.3 s. Render-only — does
  not affect aim or game logic. Reset on floor transitions.
- **HUD:** Semi-transparent panel bottom-left (HP bar, weapon, floor, score)
- **Minimap:** Top-right corner, 120×80 px, fog-of-war (visited rooms only).
  Enemy dots are shown only for enemies currently in player LOS (THERMAL_OPTICS
  still reveals all enemies as dim red). POI markers: visited key locations get
  larger pulsing glow markers drawn above tile/enemy layers — stairs/terminal
  (white, 3 px), vendor (green, 3 px), lore (amber, 2 px), sealed boss entrance
  (red, 4 px, fast pulse). Player dot (cyan, 4 px) always on top. Tapping the
  minimap on touch devices opens the expanded view.
- **Expanded Minimap:** Pressing `Tab` during PLAYING opens a full-screen modal
  map overlay. Gameplay freezes while the overlay is visible. The map fills ~85%
  of the screen (responsive to viewport size, respects safe areas) and maintains
  the 80:50 tile ratio. Shows all visited tiles with the same colour scheme as
  the small minimap, plus: room-type icons at visited special room centres
  (⚔ armory, ✚ medbay, ◈ shrine, ◆ vault, $ vendor, ⬡ implant, ◎ event,
  ⚡ challenge, ☠ boss); text labels on POI tiles (EXIT/CORE, SHOP, LORE,
  CHALLENGE, IMPLANT, EVENT); larger enemy dots (boss dots pulse, LOS-gated
  unless THERMAL_OPTICS); and a colour legend along the bottom. Unrevealed
  secret rooms are never shown. ECHO_MAPPER augment reveals layout as dimmed
  tiles (same as small minimap). The legend includes a dynamic `ELITES:` row
  sourced from `ELITE_AFFIXES`, so affix-coloured elite dots can be decoded
  from the map. On floors with an active modifier, a dynamic `MOD:` row is
  sourced through `getMod()` and shows the current modifier icon + label in
  its modifier colour. Dismissed with `Tab` or `Escape` (desktop) or
  any tap (touch). Cleared automatically on floor
  transitions, state changes, and run start/end. `Tab` is a reserved UI key and
  cannot be rebound.
- **Glow FX:** `ctx.shadowBlur` on all neon elements
- **Ambient particles:** Separate `ambientParticles[]` array (cap 80) with
  five emitter types that spawn in visited, non-secret tiles within torch radius:
  - **DUST** — slow-drifting motes in rooms/corridors (white/cyan, α 0.06–0.18,
    3–6 s life, sinusoidal drift). Spawn rate ~0.8% per visible floor tile per tick.
  - **EMBER** — rising orange sparks from `T.PLASMA` tiles (α 0.3–0.6,
    0.6–1.2 s life). ~15% chance per visible plasma tile per tick.
  - **ZAP** — electric micro-flashes on active `T.ARC` tiles (white core + cyan
    glow, α 0.5–0.9, 0.08–0.18 s life). ~12% chance when arc phase is on.
  - **STEAM** — faint grey wisps rising from `T.CRACKED` walls within 4 tiles
    of player (α 0.06–0.14, 1–2 s life). ~6% chance per tick.
  - **WISP** — red energy motes near sealed boss entrance walls (α 0.2–0.45,
    0.8–1.8 s life, glow halo). ~18% chance per tick.
  Spawned via timer (0.08 s interval), max 3 new per tick. Soft fade-in/out via
  combined life ramps. Drawn after `drawWorld()`, before room markers. Cleared
  in `populateFloor()`.
- **Lab floor dressing:** `drawWorld()` applies deterministic floor decoration
  sprites (wall consoles, cable runs, low canisters) on a sparse subset of
  `T.FLOOR` tiles. Placement is visual-only (no collision/pathing impact) and
  suppressed near interactables/hazards for readability.
- **Alarm-light decor:** `src/meta/alarm-light.js` opts the Cache, Firewall,
  and Uplink biomes (`cache`, `firewall`, `uplink`) into sparse wall-mounted
  red warning beacons. The pulse math lives in `engine/alarm-light.js`;
  `src/render.js drawBiomeFloorDeco()` draws the beacons visual-only on eligible
  wall-adjacent floor tiles without changing LOS, pathing, or room-clear rules.
- **Flickering room lights:** Sconce ambient contribution in `updateLighting()`
  includes deterministic flicker/dropout modulation, producing unstable lab
  lighting without changing LOS rules or revealing new tiles.
- **Proximity hints:** Interaction prompts (stairs, doors, terminals, shrines) use
  a persistent pulsing hint centred above the HUD instead of repeating chat messages.
  `game.hint` is set per-frame; `drawHint()` renders with `sin(Date.now()/300)`
  opacity oscillation (0.20–0.90). Only one hint is shown at a time (last wins).

### Lore Terminals (floor 2+, non-boss)

Data terminals scattered through the dungeon containing narrative fragments about
the facility, its creators, the OMEGA CORE, and the events that led to lockdown.

**Act 1 realignment note:** Lore terminals should be rethemed from generic
facility fragments toward tester instructions, test-observation notes, previous
run summaries, staff emails, and tampered hints. They should continue to teach
the player useful mechanics, but the diegetic reason is that leaked tester notes
and advocate edits are guiding the agent through the stress-test environment.
MSG-006 ships the early-band retune: floors 1-5 keep terminal copy external and
practical, with no AXIOM-7 label, explicit model identity, Elena/contact thread,
advocate/fired-employee trail, rights/personhood thesis, or memory-wipe premise
before system prompts and play have established the corresponding questions.

**Tile:** `T.LORE` (value 16). Passable, see-through. Rendered as an amber `◫`
glyph with pulsing glow on a `#1a1208` background. Distinct from the cyan CORE
terminal (`T.TERMINAL`) used on the final floor (15).

**Placement:** 1 terminal per floor (floors 2–4), 2 per floor (floor 5+).
Excluded from: spawn room, stair room, vendor rooms, secret rooms, boss floors.
Placed on a random `T.FLOOR` tile away from room edges (1-tile inset). Generated
**before** arc grids so the adjacency exclusion works correctly.

**Interaction:** Walk onto the tile → hint prompt ("Press E to access data
terminal"). Press E → game enters `READING` state, gameplay pauses. The terminal
is consumed (converted to `T.FLOOR`) — single use per terminal.

**Lore selection:** 32-entry pool of cyberpunk narrative fragments. Each terminal
displays an entry not yet seen this run (`player.loreRead` Set of indices). When
all entries exhausted, repeats randomly. Each new entry awards +50 score.

**READING state:** Dark overlay (82% opacity) with amber terminal-style frame,
scanline effect, word-wrapped lore text, and pulsing "PRESS E TO CLOSE" / "TAP TO
CLOSE" hint. Closes on E, Escape, Enter, or mouse click/touch tap.

**Audio:** `audio.loreAccess()` — warm ascending chirp (500→700→900→1100 Hz sine +
triangle tones with noise texture).

**HUD:** Amber `◫ N` counter next to credits in both compact and landscape
layouts, shown only when `loreRead.size > 0`.

**Minimap:** Amber (`#ffb700`) dot.

**Save/Load:** `player.loreRead` serialised as array, loaded as Set. Defaults
gracefully to empty Set on older saves — no `SAVE_VERSION` bump required.

---

## Audio (Web Audio + Title Asset)

### Audio Bus Architecture

All audio routes through a master gain bus (0.7) → DynamicsCompressor (threshold −12 dB, ratio 4:1) → destination. A shared ConvolverNode with a procedurally generated stereo impulse response (1.6 s, quadratic decay) provides reverb. Signature sounds (death, level-up, boss enter, descend, game over, victory) and heavy-weapon shots (Railgun, Void Cannon) send to the reverb via wet/dry split nodes. Lighter weapons (Pulse Pistol, Scatter Gun, Plasma Sword) remain dry for clarity. Both `audio.shoot()` and `audio.hit()` accept the weapon name for per-weapon sound dispatch.

Rendered title/menu music is provided by `assets/audio/title-theme.wav` and
pre-cached by the service worker. The gameplay soundtrack and SFX remain Web
Audio generated.

A single 2-second white-noise AudioBuffer is generated once at init and reused for all noise-burst voices.

**Music bus** (separate from SFX): `audio.getMusicBus()` returns a dedicated gain node (0.20) → lightweight DynamicsCompressor (threshold −18 dB, ratio 2:1) → destination. This isolates music dynamics from the SFX compressor so continuous music layers don't steal headroom from transient sound effects.

### Procedural Music System

The `music` module in `src/content/music.js` generates a continuous, layered soundtrack using Web Audio oscillators and noise — no audio files. Music responds to gameplay state, floor depth, and combat intensity.

**Layers:**

| Layer | Voices | Role |
|-------|--------|------|
| Drone | 2 detuned sawtooth oscillators → lowpass filter (180 Hz, LFO-modulated ±60 Hz at 0.15 Hz) | Atmospheric bed — always present during gameplay |
| Pulse | Sub kick (sine 80→40 Hz) on beats 1,3 + hi-hat (cached noise, highpass 8 kHz) on all beats | Rhythmic drive — activates during combat/boss |
| Arp | Square wave notes from minor pentatonic scale, 70% probability per 8th note | Melodic texture — active during exploration, reduced in combat |
| Bass | Triangle wave root note, 8th notes (combat) or quarter notes (boss) | Low-end reinforcement — combat/boss only |

**Music states and layer targets:**

| State | Drone | Pulse | Arp | Bass | Trigger |
|-------|-------|-------|-----|------|---------|
| `idle` | 0 | 0 | 0 | 0 | MENU, GAME_OVER, VICTORY |
| `explore` | 0.50 | 0.50 | 0.88 | 0.55 | PLAYING with no enemies in player's room |
| `combat` | 0.38 | 1.0 | 0.82 | 1.0 | PLAYING with live enemies in player's room |
| `boss` | 0.55 | 1.0 | 0.72 | 1.0 | Boss room sealed (`bossSealed`) |
| `tension` | 0.45 | 0.68 | 0.75 | 0.72 | Challenge room sealed (`challengeSealed`) |

State transitions crossfade layer gains over 1.5 s (0.8 s for boss). State priority: boss > tension > combat > explore.

**Floor-dependent tuning:**

| Floors | Root | Base BPM | Character |
|--------|------|----------|-----------|
| 1–3 | C2 (MIDI 36) | 112 | Bright chiptune energy — introductory |
| 4–6 | B♭1 (MIDI 34) | 120 | Driving, moderate intensity |
| 7–9 | A♭1 (MIDI 32) | 128 | Deep, fast |
| 10 | F1 (MIDI 29) | 136 | Lowest, fastest — final boss |

BPM is further multiplied by state: combat ×0.85 beat duration, boss ×0.75. Drone pitch transitions smoothly via `exponentialRampToValueAtTime` on floor change.

**Arp patterns** (minor pentatonic intervals cycled per beat):
- Tier 0 (floors 1–3): root → 5th → octave+3rd → 5th
- Tier 1 (floors 4–6): ♭3 → 5th → root → ♭7
- Tier 2 (floors 7–9): 4th → root → 5th → ♭3

**Scheduling:** `music.tick()` runs every frame from the main game loop. It uses Web Audio `currentTime` lookahead scheduling (250 ms ahead) to schedule rhythmic events on precise 8th-note boundaries — no `setInterval`. Already-scheduled notes from a previous state fade naturally through the layer gain crossfade.

**Pause handling:** `music.pause()` mutes all layer gains over 0.3 s and stops scheduling. `music.resume()` restores gains and resets the beat clock to `currentTime + 0.1`. This avoids `AudioContext.suspend()` which would kill UI sounds in the pause menu. `music.tick()` early-returns when `AudioContext.state !== 'running'` (guards against iOS `interrupted` state).

**Drone lifecycle:** Persistent oscillators created once per run, retuned on floor change, stopped on `music.stop()` (run end / menu). Short-lived rhythmic voices (pulse/arp/bass) are created and auto-disposed per beat.

**Audio resilience (iOS):** `audio.resume()` attempts `.resume()` whenever `state !== 'running'` (not just `'suspended'`), catching promise rejections. The `visibilitychange` and `pageshow` listeners retry resume on page foreground. User gesture handlers (touchstart/mousedown) always call `audio.resume()` as a last-resort recovery.

### Sound Effects

| Event            | Sound description                                                                |
|------------------|----------------------------------------------------------------------------------|
| Pulse Pistol     | Sine chirp 880→440 Hz + triangle harmonic 1760→880 Hz + noise click (default)   |
| Scatter Gun      | Base noise burst (LP 2500 Hz) + sine thump 100→50 Hz + 4 per-pellet cracks: staggered timing (8 ms apart + random jitter), ±15% pitch randomisation on square 220→110 Hz + noise (LP 600–1800 Hz) |
| Railgun          | Charge whine (sine 3200→6400 Hz + saw 1600→4800 Hz) → crack (noise LP 8000 Hz) + ring 2400→800 Hz, reverb (0.3) |
| Plasma Sword     | Melee whoosh: saw sweep 600→150 Hz + triangle 1200→300 Hz + noise transient     |
| Void Cannon      | Deep thump: sine 80→35 Hz + saw 160→60 Hz + square 320→80 Hz + noise (LP 500 Hz), reverb (0.25) |
| Enemy shoot      | Sawtooth 300→200 Hz + square sub-layer 150→100 Hz                               |
| Hit (player)     | Noise burst (LP 250 Hz) + sine thump 80→30 Hz + triangle sub 40→20 Hz          |
| Hit (enemy, Pulse Pistol) | Sine ping 600→200 Hz + triangle transient 1200→400 Hz (default)       |
| Hit (enemy, Scatter Gun)  | Quick plink: sine 800→300 Hz + noise click (LP 3000 Hz)               |
| Hit (enemy, Railgun)      | Metallic crack: noise (LP 6000 Hz) + sine ring 1800→600 Hz, reverb (0.2) |
| Hit (enemy, Plasma Sword) | Electric sizzle: saw 900→200 Hz + noise (LP 4000 Hz)                  |
| Hit (enemy, Void Cannon)  | Deep thud: sine 120→40 Hz + noise (LP 400 Hz), reverb (0.15)          |
| Enemy death      | Saw sweep 400→60 Hz + square 200→30 Hz + noise + sub thump, reverb send (0.4)  |
| Level-up         | C-E-G-C shimmer arpeggio: sine + detuned triangle pairs (±0.3%), reverb (0.5)  |
| Boss enter       | Detuned saw drones (55 Hz + 57 Hz beat) + octave swell + noise rumble + sub 27.5 Hz, heavy reverb (0.7) |
| Pick up item     | Ascending sine 400→1200 Hz + triangle 800→2400 Hz sparkle                       |
| Stairs / descend | Noise whoosh (LP 1500 Hz) + sine 1200→500 Hz + triangle 600→250 Hz, reverb (0.5) |
| Floor transition | Digital glitch: 6 stutter square tones (random 200–2000 Hz, rapid decay) + bandpass noise sweep 300→4000→200 Hz (Q 3) + sub rumble 50→35 Hz, reverb (0.3). Fires on `fadeTo()` start. |
| Boss phase shift | Rising alarm sweep: detuned saw pair 200→1200 Hz + sub pulse 55→40 Hz + metallic ring (sine 1800→900 Hz + triangle 2400→1200 Hz) + noise burst (LP 3000 Hz), reverb (0.45). Fires on boss phase transition for all bosses. |
| Menu select      | Quick UI blip: sine chirp 1200→1800 Hz + triangle 600→900 Hz. Fires on start game, pause resume/quit, name-entry confirm, and return-to-menu. |
| Low health       | Heartbeat warning: two sub thumps (sine 60→40 Hz, 180 ms apart) + noise click (LP 200 Hz). Plays every 2 s while HP ≤ 25 %. |
| Game Over        | Minor chord (A3-C4-D♯4): sine+saw layers sweeping to half-freq + sub drone, reverb (0.6) |
| Victory          | Major fanfare (C4-E4-G4-C5): sine + triangle harmonics + detuned shimmer + sustain chord, reverb (0.6) |
| Vendor open      | Digital cash register chime: three ascending tones (sine 600→800, triangle 800→1100, sine 1100→1400 Hz) |
| Purchase         | Coin-drop bleep: sine 1000→1600 Hz + triangle 1400→1800 Hz + HP noise burst (3 kHz) |
| Purchase fail    | Low buzz rejection: square 120→90 Hz + LP noise (400 Hz) |
| Shield deflect   | Hard metallic clang: triangle 1800→600 Hz + sine 2400→900 Hz + noise (LP 4000 Hz) |
| Grenade lob      | Hollow thunk: sine 200→120 Hz + triangle 400→800 Hz rising whoosh |
| Grenade explode  | Muffled boom: sine 100→30 Hz + square 60→20 Hz + noise (LP 2000 Hz) |
| Lore access      | Data retrieval chirp: ascending sine tones (500→700, 700→900, 900→1100 Hz) + noise texture (4 kHz) |
| Combo tick       | Ascending chirp: base pitch rises with combo count (400 + count×80 Hz, capped 1800 Hz); sine + triangle |
| Hackware EMP     | Electric discharge: sawtooth 200→60 Hz + square 1200→200 Hz + noise burst (5 kHz) + sub thud 80→40 Hz, reverb (0.4) |
| Hackware Cloak   | Shimmering phase-out: sine 800→1600 Hz + triangle 1200→2000 Hz + sine 400→200 Hz, reverb (0.8) |
| Hackware Cloak end | Shimmer-in: sine 1600→600 Hz + triangle 1200→400 Hz, reverb (0.4) |
| Hackware Swarm   | Buzzing release: detuned sawtooth pair 300→600 + 320→640 Hz + noise (3 kHz) + sine 200→400 Hz, reverb (0.3) |
| Hackware Gravity  | Deep implosion: sine 300→40 Hz + triangle 600→100 Hz + sub 50→30 Hz + noise (1 kHz), reverb (0.6) |
| Hackware Static Field | Electric crackle: noise burst (3 kHz) + sawtooth 800→200 Hz + square 1200→400 Hz + sub 100→60 Hz, reverb (0.5) |

All envelopes use exponential ramps (floor 0.001) for natural decay. Frequencies are guarded with `Math.max(freq, 1)` for exponential ramp safety.

---

## Scoring

### Base Scoring
```
score += enemy_xp_value × floor_multiplier × combo_multiplier   (on kill)
score += 500 × floor_number                  (on floor clear)
score += remaining_hp × 10                   (on floor clear)
score += 50                                  (on lore terminal read)
```

### Combo / Kill-Streak System

Killing enemies in quick succession builds a combo counter. The combo multiplies
score earned per kill.

**Combo rules:**
- Each eligible kill increments `combo.count` and resets a 3-second window timer.
- If 3 seconds elapse without a kill, the combo resets to 0.
- Multiplier formula: `1 + (count - 1) × 0.25`, hard-capped at **4×** (combo 13+).
- Boss kills use a separate cap of **2×** to prevent score inflation.
- **Excluded from combo building** (don't increment count):
  - SHARDs (from SPLITTER splits) — too easy, would inflate streaks.
  - VOLATILE chain kills (`_volatileKill`) — indirect, would max combo instantly.
- Excluded enemies still receive the current combo multiplier on their score.
- Combo resets on floor transition (`populateFloor()`).
- `combo.best` tracks the highest streak in the run (runtime only, not saved).
- The combo timer only decrements during `PLAYING` state — pausing or entering
  menus does not drain the window.

**Visual feedback:**
- HUD shows `×{multiplier} COMBO ×{count}` when count ≥ 2.
- Colour tiers: cyan (2–4), yellow (5–7), orange (8–10), magenta (11+).
- Flash effect on each new kill; opacity fades with timer.
- Milestone floating text ("×5 COMBO!", "×10 COMBO!", etc.) at player position.
- Best combo displayed on GAME_OVER and VICTORY screens.

**Audio:** ascending chirp on each combo increment (pitch rises with count).

**Global state:** `combo { count, timer, best, flashTimer }` — reset in
`populateFloor()` alongside other per-floor globals. `combo.best` reset in
`startGame()` and `continueGame()`.

High-score table stored in `localStorage` as JSON, top 10, with player name.
When a run ends (death or victory), if the score qualifies for the top 10,
the game enters the **NAME_ENTRY** state — an arcade-style name input with a
virtual keyboard (A–Z, 0–9, DEL, OK) that works on both desktop (physical
keyboard) and touch (tap keys on canvas). Names are capped at 12 characters,
uppercased. If the score doesn't qualify, it is saved as "ANON".

The leaderboard is displayed on three screens:
- **MENU** — top 3 (compact) or 5 (landscape)
- **GAME_OVER** — top 5 (compact) or 7 (landscape), player's entry highlighted
- **VICTORY** — top 5 (compact) or 7 (landscape), player's entry highlighted

---

## Save System

Uses `localStorage` key `neonDungeonSave`. Saves player stats, current floor,
run seed metadata, RNG stream state, and an optional live floor snapshot. The
seeded generator still rebuilds the canonical base floor first; the snapshot is
then replayed on top so Continue can restore mid-floor mutations instead of
returning to the floor entrance.

**Auto-save triggers:**
1. After `loadFloor()` completes (start of every floor checkpoint).
2. When the browser hides/unloads the page (`visibilitychange`, `pagehide`, or
   `beforeunload`) while a run-owned state is active. This covers mobile
   interruptions such as locking the phone, switching apps, or opening a text
   message.

Mid-floor progress is saved as a floor snapshot. It captures player position,
mutated dungeon grids/room flags, live enemies/items/projectiles, environmental
objects, encounter seals, cleared-room state, and map reveal state. It is not a
layout re-roll vector because Continue restores the saved seed/RNG state and
regenerates the base floor before replaying the snapshot.

**Save payload:** `{ v, floor, difficulty, modifier, runSeed, runSeedHash, rngStates, bossesCleared, floorSnapshot, player: { x, y, hp, maxHp, atk, def, level, xp,
weapon, upgrades, perks, keys, shards, permSpeedBonus, score, energyShield,
energyShieldTimer, credits, loreRead, hackware, hackwareCooldown } }` — `shieldBonus` is always 0 at floor entry so is
excluded. `modifier` is the floor modifier key (string) or `null`. `runSeed`
is the normalized seed string shown/entered at run start; `runSeedHash` is the
numeric seed hash used for telemetry/debug display; `rngStates` is the
serializable per-stream state snapshot for runtime streams after floor entry
(cosmetic RNG state is intentionally excluded).
`hackware` is a `HACKWARE` key string or `null`. Old saves without seed or
hackware fields default to a legacy sentinel seed and `null`/`0`.

**Menu behaviour:**
- If a save exists: `CONTINUE (FLOOR N · DIFFICULTY)` remains available above
  `NEW GAME — <difficulty> / SEED`.
- The New Game row cycles difficulty with left/right and opens **SEED_SETUP**
  on Enter/tap.
- Locked difficulties remain dimmed and display the unlock message instead of
  opening the seed screen.

**Continue flow:** Creates a fresh `Player`, applies saved stats, calls
`setSeed(save.runSeed, save.rngStates)`, then `loadFloor(savedFloor)`, and
replays `floorSnapshot` when present before displaying "RUN RESUMED — FLOOR N".
Because layout and population use derived per-floor streams, the regenerated
floor matches the saved run seed/floor rather than re-rolling from ambient
randomness; because the snapshot is replayed afterward, player location,
already-opened doors/cracked walls, picked-up items, killed/damaged enemies,
temporary hazards, and encounter state resume from the interruption point.
Incompatible save versions (different `v` field) are deleted and a fresh run
starts with an error message. Legacy saves without `floorSnapshot` still resume
using the older floor-start regeneration behavior.

**Save deletion:** `endRun()` (called on death and victory) deletes the save.
Starting a new game overwrites the save when the first floor loads.

---

## Settings

Player preferences are persisted in `localStorage` key `neonDungeonSettings`, separate from the game save. Settings survive save deletion and apply globally across all runs.

### Settings Payload

```json
{ "sfxVol": 1.0, "musicVol": 1.0, "screenShake": true, "damageNumbers": true, "keyMap": { "up":"KeyW", "down":"KeyS", "left":"KeyA", "right":"KeyD", "interact":"KeyE", "hackware":"KeyF", "voidshard":"KeyV", "dash":"ShiftLeft", "shoot":"Space" } }
```

### Volume Controls

- **SFX Volume** (0–100%): multiplied by base master gain (0.7). Applied via `audio.setSfxVolume(v)` using short linear ramp (0.02 s) to avoid zipper noise.
- **Music Volume** (0–100%): multiplied by base music bus gain (0.20). Applied via `audio.setMusicVolume(v)`.
- Both are applied at node creation time (lazy init) AND when the setter is called, ensuring correct volume regardless of when AudioContext initialises.

### Display Toggles

- **Screen Shake** (ON/OFF, default ON): `settings.screenShake`. When OFF, `triggerShake()` is a no-op — camera offset stays at zero.
- **Damage Numbers** (ON/OFF, default ON): `settings.damageNumbers`. When OFF, `spawnDmgText()` is a no-op — no floating text spawns.

### Key Rebinding

9 rebindable actions: `up`, `down`, `left`, `right`, `interact`, `hackware`, `voidshard`, `dash`, `shoot`. Each maps to a `KeyboardEvent.code`.

**Alternate keys** (always active alongside the mapped key):
- Arrow keys work for movement in all contexts (↑↓←→ for up/down/left/right)
- `ShiftRight` works as alternate dash

**Reserved keys** (cannot be bound): `Escape`, `Enter`, `KeyQ`, `Digit1`, `Digit2`, `Digit3`.

**Conflict resolution**: binding a key already used by another action **swaps** the two bindings rather than leaving an orphaned action.

**Key capture flow**: selecting a rebind row enters capture mode → "PRESS A KEY..." blinks → next `keydown` binds (Escape cancels, reserved keys ignored, MouseLeft ignored).

**Touch buttons** (`BTNS.E`, `BTNS.F`, `BTNS.V`, `BTNS.DASH`) emit the currently mapped key code via `km(action)`, ensuring touch controls respect rebinding.

**Display hints** (in-game prompts like "Press E to interact") use `KEY_DISPLAY(km('interact'))` to reflect the current binding.

### Settings UI

`SETTINGS` game state, accessible from:
- **Main menu**: "SETTINGS" option in menu list
- **Pause screen**: `S` key / click "Settings" / middle-third touch zone

Layout (canvas-rendered, no HTML overlays):
1. SFX Volume slider (horizontal bar, click/drag or ◀▶ keys, 5% step)
2. Music Volume slider
3. Screen Shake toggle (◀▶ or Enter/click to toggle ON/OFF)
4. Damage Numbers toggle
5. Rebind rows (one per action, showing action label + current key)
6. "RESET TO DEFAULTS" button (resets volumes, toggles, and key bindings)
7. "BACK" button (returns to previous state)

Navigation: ↑↓ select row, ◀▶ adjust sliders or toggle options, Enter/click to rebind or toggle, Escape to go back. Mouse click/drag on sliders supported. Touch: tap to interact.

`_settingsFrom` tracks whether settings was opened from `'MENU'` or `'PAUSED'`, used by the back action to return to the correct state.

### Validation

On load, settings are merged with defaults: volumes clamped to [0, 1], booleans validated with `typeof`, missing keyMap entries filled from `DEFAULT_KEY_MAP`, invalid/corrupt JSON silently falls back to defaults.

---

## HUD Layout

### Landscape (W ≥ 600 or W ≥ H) — single row

```
┌───────────────────────────────────────────────────────┐
│                  NEON DUNGEON                  [map]  │  ← minimap top-right
│                                                       │
│              [GAME CANVAS]                            │
│                                                       │
│  HP ████░░  LVL ATK DEF  FLR  WEAPON  SCORE  COMBO   │  ← HUD bottom (40 px)
└───────────────────────────────────────────────────────┘
```

### Portrait (H > W and W ≤ 600) — compact two-row

```
┌──────────────────────┐
│            [map]     │  ← minimap top-right
│                      │
│   [GAME CANVAS]      │
│                      │
│  HP ████░░  FLR  SCR │  ← row 1 (+ combo below score)
│  LV XP A:n D:n WEAP │  ← row 2 (58 px total)
└──────────────────────┘
```

A shared `layout` object (`compact`, `hudH`, `hudTop`, `msgBase`) is computed
in `updateLayout()` (called from `resize()`). All bottom-area positioning —
camera Y bias, tile culling, message placement, touch button Y, ghost joystick
Y — derives from `layout` to prevent overlap.

**Compact mode gate:** `H > W && W <= 600` (orientation + logical width).

**Touch-aware text:** On touch devices, menu shows "TAP TO START" and
touch-specific control hints; game-over / victory / pause screens show
tap-based prompts instead of keyboard-only text.

---

## Screen Flow

1. **Title Screen** — animated neon logo, "PRESS ENTER TO START" (desktop) / "TAP TO START" (touch), high-score table (top 3/5), touch-specific control hints
2. **Playing** — full game loop
3. **Pause** — ESC / ‖ button, dim overlay. Desktop: ESC resume, Q quit. Touch: tap upper half to resume, lower half to quit.
4. **Level Transition** — cyberpunk fade with scanlines, glitch bars, noise band, chromatic-aberration text reveal, neon border pulse; 0.4 s fade-in → 0.15 s hold at peak → 0.4 s fade-out (~0.95 s total). "DESCENDING TO FLOOR N" appears character-by-character at 80 chars/s during the peak window.
5. **Name Entry** — arcade-style name input with virtual keyboard (if score qualifies for top 10). Desktop: type + Enter. Touch: tap virtual keys + OK.
6. **Game Over** — score, death floor, level, leaderboard with player's rank highlighted
7. **Victory** — cinematic text, final score, floors cleared, level, leaderboard with player's rank highlighted

---

## Implementation Architecture (script-tag modules)

NEON DUNGEON ships as plain JavaScript loaded by ordered script tags in
`index.html`. There is no bundler and no runtime dependency resolver; `index.html`
is the dependency graph. The repository uses JSDoc plus `// @ts-check` for type
safety and `npm run check` as the canonical gate.

Runtime groups:

1. `src/neon.js` fail-loud dependency resolver, `src/game-states.js` runtime
   state vocabulary, then `engine/*.js` reusable helpers and primitives.
2. `src/platform.js` browser/platform bridge and shared runtime constants.
3. `src/data/*.js` static NEON DUNGEON data.
4. `src/meta/*.js` progression, data access, and configured game systems exposed
   through `NEON.*`.
5. `src/content/terminals.js` for lore-terminal content,
   `src/content/weapons.js` for weapon and affix catalogs, `src/content/perks.js`
   for perk and augment-choice helpers, then
   `src/content/floor-generator.js`, `src/content.js`, `src/entities.js`,
   extracted `src/entities/*.js` support modules, `src/render.js`, and
   `src/game.js` for floor generation, the legacy content facade,
   actors/combat, rendering/HUD, and game-state orchestration.

Runtime game states are centralized in `src/game-states.js`. `src/game.js`
captures the exported vocabulary through `requireNEON('gameStates', 'src/game.js')`;
`game.setState()` rejects any state that is absent from `GAME_STATES_SET` before
mutating `game.state`, so accidental new string states fail loudly instead of
creating unreachable update/render branches. `PAUSABLE_STATES` and
`RUN_SAVE_STATES` are exported from the same module and consumed by
`src/platform.js`.

The handoff docs are the current architecture reference:

- `README.md` — quick start and high-level development guide.
- `docs/module-map.md` — script load order, module ownership, guardrail tests,
  and high-risk couplings.
- `docs/engine-boundary.md` — engine/game classification.
- `docs/refactor-roadmap.md` — incremental refactor path and TypeScript migration
  criteria.

---

## Mobile & PWA

### Progressive Web App

A `manifest.json` at the repository root enables Add-to-Home-Screen:

| Field            | Value                   |
|------------------|-------------------------|
| `display`        | `fullscreen`            |
| `orientation`    | `any`                   |
| `background_color` / `theme_color` | `#0a0a12` |
| `start_url`      | `./index.html`          |
| `icons`          | 192×192 + 512×512 PNG (`purpose: any`), plus 192×192 + 512×512 maskable variants (`purpose: maskable`, 72% inner icon on `#0a0a12` background for Android adaptive icons) |

Meta tags in `<head>`:
- `apple-mobile-web-app-capable: yes` (iOS Safari home-screen)
- `apple-mobile-web-app-status-bar-style: black-translucent`
- `mobile-web-app-capable: yes` (Android Chrome)
- `apple-touch-icon` → `icon-192x192.png`

### Fullscreen — Landscape Auto-Request

On touch devices, orientation changes trigger fullscreen behaviour:

1. **Rotate to landscape** → set `fsWantLandscape = true`, reset dismiss state.
   On the next `touchstart` user gesture, call `requestFullscreen()` on
   `document.documentElement`.
2. **Rotate to portrait** → call `exitFullscreen()` immediately, clear want flag.
3. **Dismiss button** (✕, top-left 48×48 px hit area): sets `fsDismissed = true`
   for the current landscape session. A new portrait→landscape transition
   resets the dismiss flag.

Fullscreen prompt: a centered pill overlay ("⤢ Tap for fullscreen · ✕")
drawn at 70 % opacity when landscape + not fullscreen + not dismissed +
API supported.

**Browser compat:** Detects `requestFullscreen` / `webkitRequestFullscreen`
at boot. Promise `.catch()` guards handle void-return Safari variants.
`screen.orientation.type` is preferred; falls back to
`innerWidth > innerHeight`. Non-touch devices skip all orientation logic.

### Service Worker — Offline Caching

A `sw.js` at the repository root provides offline play after first visit:

| Aspect     | Detail |
|------------|--------|
| **Cache name** | Stable `neon-dungeon-assets`; not a release/version number |
| **Strategy**   | Network-first for navigation and explicit `ASSETS`; cached fallback keeps first-visit assets offline-capable; unknown URLs are not runtime-cached |
| **Pre-cached** | `./`, `./index.html`, `./privacy.html`, `./manifest.json`, browser-loaded engine/source files, title audio, and icon PNGs listed in `ASSETS` |
| **Install**    | `skipWaiting()` — new SW activates immediately |
| **Activate**   | `clients.claim()` + purge old cache versions |
| **Registration** | Separate `<script>` tag after the game script; silent `.catch()` for non-supporting browsers |

**Manifest guardrail:** `scripts/manifest.js` is the machine-readable source for
browser script order and service-worker precache expectations.
`tests/manifest.test.js` verifies `index.html` script tags match that order,
`sw.js` precaches the same manifest-managed assets, every manifest-managed path
exists on disk, and generated `version.json` stays out of precache.

**Update flow:** Changes that land on `main` trigger
`.github/workflows/release-version.yml`, which computes the next semver tag and
creates a GitHub Release at the exact `main` commit. The visible title-screen
version comes from same-origin `version.json` generated from that release tag in
the Pages artifact; `sw.js` deliberately has no numeric version. App assets are
fetched network-first and update the stable cache when online, then fall back to
cached responses offline.

**Branch policy:** Feature, fix, documentation, and agent task PRs target
`develop`; PRs into `develop` are squash-merged. Only same-repo promotion PRs
from `develop` target `main`, and those promotions use rebase merge. The
release and versioning path and `.github/workflows/release-version.yml` are
production guardrails and must remain intact during promotion work.

### Known Limitation — iOS Safari

The Fullscreen API is not supported in standalone iOS Safari. The reliable
iOS path is PWA Add-to-Home-Screen, which uses `display: fullscreen` from
the manifest to achieve a chrome-less experience.

### Page Lifecycle & Game Loop Resilience

The main game loop uses `try/finally` to guarantee `clearJust()` and `requestAnimationFrame(loop)` execute even if an exception occurs in `game.update()` or `game.render()`. `music.tick()` is isolated in its own `try/catch` so audio errors (e.g. iOS `interrupted` AudioContext) cannot kill gameplay.

**Visibility handling:** A `visibilitychange` listener auto-pauses the game when the tab is hidden (only from `PLAYING` state — menus, overlays, and game-over are not affected). `pageshow` (with `persisted` check) provides a Safari/bfcache fallback. On return to visibility, `audio.resume()` is called to recover the AudioContext, and the player is left in `PAUSED` state so they can orient before unpausing.

---

## Death Recap & Run Statistics

### Damage Tracking

All player damage is attributed to a named source. The `player.takeDamage(dmg, source)` method records cumulative damage per source in `player.damageLog` (object: source→total). Environmental damage that bypasses `takeDamage` (Plasma burn, Arc Grid zap) logs separately via `player.logDamage(source, amount)`.

| Field            | Type   | Reset        | Saved |
|------------------|--------|-------------|-------|
| `damageLog`      | Object | `Player.reset()` | Yes |
| `killedBy`       | String | `Player.reset()` | No (set on death) |
| `enemiesKilled`  | Number | `Player.reset()` | Yes |
| `hitsBlocked`    | Number | `Player.reset()` | Yes |
| `game.runTime`   | Number | `startGame()` | Yes |

Kill counter (`enemiesKilled`) increments in `Enemy.die()` for all non-SHARD enemies.

### Source Labels & Colours

`SOURCE_LABELS` and `SOURCE_COLOURS` maps provide friendly display names and neon colours for all damage sources. Enemy types use their canonical names (Guard, Turret, etc.); bosses use campaign names (Sentinel Mk-I, Neural Hive, Omega Core). Environmental sources: Spike Trap, Plasma, Arc Grid, Grenade, Volatile, Void Orb.

### Recap Snapshot

`endRun()` captures `game.lastRunRecap` — an immutable snapshot of recap fields — before any state transitions. Both GAME_OVER and VICTORY screens render from this snapshot, not live mutable state.

### Game Over Screen

Redesigned layout (top to bottom):
1. **GAME OVER** title (red glow)
2. **KILLED BY: {Source}** — prominent, in the source's neon colour with glow
3. Divider + stats line: Floor • Score • Level
4. Best combo (if ≥2), difficulty (if non-NORMAL)
5. **DAMAGE TAKEN** breakdown — top 3–4 sources as coloured progress bars with label, absolute damage, and percentage
6. Divider + run stats: enemies slain • shield blocks • time survived (m:ss)
7. Data Fragments earned
8. Leaderboard (4–5 rows)
9. Continue prompt

Compact/mobile layout reduces bars to 3, leaderboard to 4 rows.

### Victory Screen

Adds run statistics (same enemies/blocks/time line) between the existing stats and leaderboard. No "killed by" section.

---

## Status Effect Indicators

Three visual systems communicate active effects to the player.

### Low-HP Danger Vignette

When player HP ≤ 25%, a pulsing red vignette appears at the screen edges:
- **Radial gradient** from transparent (centre) to `#ff1a1a` (edges)
- **Intensity** scales linearly: 0 at 25% HP → max at 0% HP
- **Pulse** syncs with existing `player.lowHpTimer` (2 s heartbeat cycle)
- **Compositing**: `globalAlpha = severity × (0.12 + 0.14 × pulse)` — visible but never obscures gameplay
- **Neon border** stroke with `shadowBlur` glow adds urgency
- **Render order**: drawn BEFORE HUD/minimap so UI elements remain readable

### Floor Modifier Banner

On floor entry (fresh transitions only, not save resume), a prominent
banner slides down from the top of the screen announcing the active modifier:

- **Duration**: 3 s (`game.modBannerTimer`), ticked in `updatePlaying()`
- **Animation**: 0.3 s fade-in slide-down, 2.4 s hold, 0.3 s fade-out slide-up
- **Content**: modifier icon + label (landscape adds description line)
- **Compact mode**: icon + label only (no description) to fit narrow screens
- **Background**: dark rounded pill with modifier-colour border glow
- **Replaces** the previous `game.msg()` modifier announcement
- **Gate**: only fires when `savedModifier === undefined` (new floor, not save restore)

### Status Effect Bar

**Implementation:** Status HUD rendering lives in `src/content/status.js`, loaded
after `src/content/hackware.js` and before `src/content.js`; the public globals
`drawDangerVignette`, `drawModBanner`, `getStatusEffects`, and `drawStatusBar`
remain unchanged for runtime callers.

Row of compact badge indicators displayed just above the HUD bar (`layout.hudTop - 16`):

| Effect | Trigger | Icon | Colour |
|--------|---------|------|--------|
| Floor modifier | `game.modifier` active | Modifier icon | Modifier colour |
| Slow debuff | `player.speedTimer > 0 && speedBoost < 0` | ❄ | `#6688cc` |
| Shield recharging | `perks.ENERGY_SHIELD && !energyShield` | 🛡 | `#4466aa` |
| Shield active | `perks.ENERGY_SHIELD && energyShield` | 🛡 | `#4488ff` |
| Nano Regen | `upgrades.NANO_REGEN > 0 && hp < maxHp` | ♻ | `#00ff88` |
| Dash cooldown | `dashCooldown > 0` | ⇧ | `#7a6a33` |
| Dash ready | `dashCooldown ≤ 0` | ⇧ | `#ffb700` |
| Hackware cooldown | `hackware && hackwareCooldown > 0` | Module icon | `#665533` |
| Hackware ready | `hackware && hackwareCooldown ≤ 0` | Module icon | Module colour |
| Phase cloak active | `cloakTimer > 0` | ◇ | `#cc44ff` |
| Burn debuff | `burnTimer > 0` | 🔥 | `#ff6600` |
| Shock debuff | `shockTimer > 0` | ⚡ | `#ffee44` |

Each badge: dark pill background + icon + label text, `shadowBlur` colour glow.
Smooth alpha fade-in/out (0.08 per frame) tracked per effect ID via `statusFx` object;
inactive effects continue rendering during fade-out, cleaned up at alpha 0.
Badges flow left-to-right from the safe-area left edge; overflow stops before
minimap region (`W - 130 - safeRight`). Y position shifts up (`hudTop - 32`)
when key indicators are present to avoid collision.

### Player Debuffs (enemy-inflicted status effects)

Certain enemy types inflict status effects on successful hits. Effects only apply when the hit actually deals damage — blocked (Energy Shield), evaded (dash i-frames), or immune (Phase Cloak) hits do not apply debuffs.

| Debuff | Source | Duration | Effect | Visual |
|--------|--------|----------|--------|--------|
| Burn | CRAWLER melee | 2 s | DoT: 2 + floor × 0.3 DPS (ignores defence, bypasses shield) | Orange underglow on player, fire particles |
| Shock | SNIPER projectile | 0.4 s | Movement suppressed (can still aim and shoot) | Yellow flash on player, spark particles |

**Burn details:**
- Ticks every frame, routed through `player.takeDamage('Burn', opts)` with `ignoreDefense`, `skipHitInvincible`, `skipHitEffects`, `skipReactiveArmor` — ensures SECOND_WIND triggers properly, but burn bypasses defence and doesn't cause screen shake per tick.
- Can kill the player (death recap shows "Burn" as killing blow).
- Dash/cloak immunity pause burn damage but not the timer countdown.
- `audio.playerBurn()` plays on application.

**Shock details:**
- Brief movement lockout — player is rooted but can still aim, shoot, and use abilities.
- Dash is not blocked by shock (dash activation ignores shock state, giving an escape option).
- `audio.playerShock()` plays on application.

**Clearing:** all player debuffs (`burnTimer`, `burnDps`, `shockTimer`) reset to 0 on floor transition and are not saved to localStorage (transient per-floor state).

**Death recap integration:** 'Burn' and 'Shock' entries in `SOURCE_LABELS`/`SOURCE_COLOURS`.

### Teleport Pads (floor 3+, non-boss)

Linked pairs of warp pads providing fast travel between distant rooms.

**Generation:**
- 1 pad pair on floors 3–5, 2 pairs on floors 6–9. Boss floors excluded.
- Pads placed at room centers of eligible rooms (not spawn/stair/special/boss, area ≥ 16 tiles, center tile is FLOOR).
- Pair selection maximizes Manhattan distance between rooms (minimum 15 tiles apart).
- Placed after all other special rooms and tile mutations to prevent overwrite.
- `T.TELEPORT_PAD` (20) tile type. Passable, see-through.

**Interaction:**
- Press E within pad tile → teleport to paired pad (+0.5 tile centering).
- 3 s cooldown after use (shared across all pads on the floor). Cooldown shown in hint.
- 0.3 s invincibility on arrival (prevents instant damage at destination).
- Blocked when source or destination is inside a sealed boss/challenge room.
- Proximity hint: "Press E to warp" (violet).

**Visual:**
- Tile: pulsing violet `⬡` hexagon glyph on dark floor (`#bb44ff`).
- Spark particles at origin and destination on use.
- Minimap: violet 3 px POI marker. Expanded minimap label: "WARP".

**Audio:** `audio.teleportPad()` — ascending digital warp sweep + sparkle.

**Regeneration:** Pads are part of floor generation, not saved/loaded independently. `dungeon.teleportPads` array stores `{x1,y1,x2,y2,pairIndex}` per pair. Cooldown resets on floor transition.

### Bounty Targets (floor 2+, non-boss)

One enemy per qualifying floor is designated as a high-value Bounty Target with
enhanced stats, distinctive visuals, and bonus rewards for elimination.

**Designation (in `populateFloor`, after all enemies spawned):**
- Eligible candidates: non-boss, non-shard, non-elite enemies.
- One candidate selected at random → `enemy._isBounty = true`.
- Stats boosted: 2× HP (`maxHp` updated), 1.5× ATK.
- Boss floors (biome-final: 3, 6, 9, 12, 15) never receive bounty targets.
- Bounty designation is not saved — regenerated with floor on continue.

**Visual:**
- **Gold aura:** pulsing `#ffd700` circle behind the enemy (0.3–0.45 alpha,
  1.4× body radius, shadow glow 16–22 px).
- **Crown icon:** gold 5-point crown shape drawn above the enemy's head.
- **HP bar:** always visible (even at full HP), wider than normal (20 px),
  gold fill with "BOUNTY" micro-label above the bar.
- **Minimap (regular):** gold 4 px pulsing dot (same as boss size, gold colour).
  Only visible when enemy is in LOS or THERMAL_OPTICS augment active.
- **Minimap (expanded):** gold dot matching boss size with shadow glow.
- **HUD:** `⊕ BOUNTY` label in gold below quest text, pulsing, while bounty is
  alive.

**Reveal:**
- First time the bounty becomes visible (FOV check): `audio.bountyReveal()` plays,
  `⊕ BOUNTY TARGET SPOTTED` message in gold.
- One-shot: `_bountyRevealed` flag prevents re-trigger.

**Rewards (on kill via `Enemy.die()`):**
- Credits: `30 + floor × 8` (×1.5 with Credit Siphon augment).
- Score: `150 × floor`.
- Guaranteed bonus item drop (in addition to normal drop roll).
- `BOUNTY ELIMINATED +{cr} CR +{score} pts` message in gold.
- Gold explosion particles (20) + camera shake (5 px, 0.2 s).
- `player.bountiesCollected++` stat tracked.

**Quest — BOUNTY:**
- `id: 'BOUNTY'`, label: "Eliminate the bounty target".
- Available only on non-boss floors where a bounty exists (added to quest pool dynamically).
- Check: no living bounty enemy in the `enemies` array.
- Reward: `+XP (50 + floor × 10)` + `+40 credits`.
- Boss floors always get EXTERMINATE (unchanged).

**Audio:**
- `audio.bountyReveal()` — ominous low brass stab (dual sawtooth/square sweep
  120→80 Hz) + rising shimmer (sine 600→1400 Hz + triangle 900→1800 Hz) +
  noise burst (4 kHz). Reverb 0.3.
- `audio.bountyKill()` — triumphant ascending C major arpeggio (C5→E5→G5→C6,
  sine voices, 80 ms spacing) + sparkle shimmer (triangle 1047→1568 Hz) +
  noise glitter (8 kHz). Reverb 0.25.

**Save/Load:**
- `player.bountiesCollected` saved in checkpoint, restored on continue.
  Old saves default to `0` (no `SAVE_VERSION` bump needed).
- Bounty designation itself is not saved (regenerated per floor, like volatile cores).

**Stats display:** `{N} bounties` shown on Game Over and Victory run-summary
line (between "events" and "blocked" stats), omitted when 0.

### Floor Events — Risk/Reward Encounters

Interactive event terminals offering binary choices with different risk/reward profiles. One event room per non-boss floor (2–9).

**Implementation:** Event definitions, protocol-trial routing, event-effect helpers, and rare-terminal log/module drop hooks live in `src/content/events.js`. The file is browser-loaded after `src/content/modifiers.js` and before `src/content.js`, preserving the existing public globals `EVENTS`, `rollEvent()`, and `applyEventEffect()` for `src/game.js` and source-text tests.

**Room Generation:**
- Room type `'event'`, `T.EVENT_TERMINAL` tile (19) at room center.
- Eligible rooms: not spawn/stair/special, area ≥ 16 tiles, no existing `roomType`.
- Room colour: `#0a1a1a` (dark teal). Excluded from lore terminal placement.

**Interaction:**
- Press E within 1.5 tiles of terminal → `EVENT_CHOICE` game state.
- Hint text: "Press E at terminal" (teal) when within 2.5 tiles.
- One use per room (`room.eventUsed` flag).

**EVENT_CHOICE UI:**
- Dimmed overlay, event icon + name + description, two choice cards.
- Input: 1/2 keys, Left/Right arrows, Enter/Space, mouse click, touch tap.
- Each card shows: label, description, outcome summary, key hint.

**11 Events** (selected randomly per terminal, filtered by player state, with protocol trials guaranteed on selected story floors):

| Event | Choice A (risky) | Choice B (safe) |
|-------|------------------|-----------------|
| Stasis Pod | +40% HP heal, +XP | Random item drop |
| Corrupted Terminal | 60% hackware / 40% enemy wave | +credits |
| Arms Cache | Weapon reroll (floor+1), −15 HP | Random item |
| Radiation Leak | +augment, −20 HP | +credits +score |
| Rogue AI | Reveal entire minimap | −50 CR → +XP |
| Power Junction | Stun + damage room enemies | Heal 60% |
| Ghost Signal | +credits +XP +score | Combo boost ×5 |
| Emergency Drop | Heal 30% + item | Hackware CD reset + credits |
| Route Proof | Reveal non-secret floor map + XP +score | Open nearest locked door, +credits, −10 HP |
| Cooperation Protocol | Spend credits for scaled heal + XP + full-share hackware reset | +credits +combo, spawn alarm wave |
| Consent Lock | Request help for item + XP | Override for +credits +score, spawn alarm wave |

**Filtering:** Radiation Leak excluded when augment slots full. Rogue AI excluded when credits < 50.

**Protocol trials:** Floors 2, 5, and 8 force story-mechanical trials (`Route Proof`, `Cooperation Protocol`, `Consent Lock`) when their event terminal is activated. These are non-boss floors so the existing event-room generator can place an activatable terminal. They are still optional event rooms, not required progression gates, but they turn the Act 1 premise into gameplay choices: route logic changes floor knowledge/locks, cooperation trades shared resources for stability, and consent/override choices trade agency for risk.

**Synergies:** Credit Siphon augment applies ×1.5 to credit rewards. XP-granting events may trigger perk choices (checked after event resolution). Weapon reroll uses `rollWeapon(base, floor+1)`.

**Audio:** `audio.eventTerminal()` on activation, `audio.eventResolve()` on choice.

**Visual:** Tile rendered as pulsing teal `◈` glyph. Minimap: teal 3px POI marker.

**Stats:** `player.eventsResolved` counter shown on Game Over / Victory screens.

### Augment System

Cybernetic implants that provide permanent passive effects for the run. Max **3** equipped augments (`MAX_AUGMENTS`).

**Acquisition:**
- **Implant Shrine rooms**: New room type (`roomType: 'implant'`) on floors 2–9 (non-boss), ~50% spawn rate per floor. Tile `T.IMPLANT_SHRINE` (18) — glowing purple diamond at room center. Press E to activate: choose 1 of 2 offered augments. When at max slots, visiting gives credits instead.
- **Vendor**: ~20% chance to sell an augment on floor 3+. Price: 120 + floor × 15.
- No duplicates: owned augments are excluded from all offer rolls.

**Augment Pool (12 augments):**

| ID | Name | Icon | Colour | Effect |
|----|------|------|--------|--------|
| NEURAL_LINK | Neural Link | 🧠 | `#cc44ff` | +25% XP from all sources |
| TITANIUM_PLATING | Titanium Plating | 🛡 | `#4488cc` | Reduce all damage taken by 1 (after DEF, min 1) |
| MAGNETIC_FIELD | Magnetic Field | 🧲 | `#44ff88` | Double item pickup radius (0.7 → 1.4 tiles) |
| THERMAL_OPTICS | Thermal Optics | 👁 | `#ffcc00` | Enemies always visible on minimap (dimmed in unvisited rooms) |
| ADRENALINE_INJECTOR | Adrenaline Injector | 💉 | `#ff4444` | On kill: +30% move speed for 2s |
| OVERCLOCKER | Overclocker | ⚡ | `#00ddff` | Hackware cooldowns −30% |
| ECHO_MAPPER | Echo Mapper | 📡 | `#ffffff` | Reveal floor layout on minimap when entering a floor (dimmed, no details; does not satisfy EXPLORE quest or reveal secret rooms) |
| CREDIT_SIPHON | Credit Siphon | 💰 | `#ffaa00` | +50% credits from all sources (kills, room clears, secrets, challenges, implant shrine fallback) |
| SCAVENGER_NANITES | Scavenger Nanites | 🔧 | `#88ff44` | 10% chance on enemy kill: heal +5 HP (SHARDs excluded) |
| KINETIC_AMPLIFIER | Kinetic Amplifier | 🚀 | `#ff8800` | +20% player projectile speed |
| TEMPORAL_DILATION | Temporal Dilation | ⏳ | `#88ccff` | All enemies 15% slower (affects movement and retreat speed) |
| REACTIVE_ARMOR | Reactive Armor | 💥 | `#ff6644` | When taking damage, emit a 2.5-tile damage pulse (10 + floor × 2 dmg, LOS-gated). 8s cooldown. |

**Game State:** `AUGMENT_CHOICE` — 2-card UI (keyboard 1/2, arrows + Enter, mouse/touch). Pauses gameplay while selecting.

**UI:**
- Implant shrine rendered as pulsing purple `◆` glyph on the tile and room center overlay
- Minimap: purple 3px POI marker
- Status bar: `◆ N/3` badge showing augment count
- Death recap: lists installed augments below perks
- Adrenaline Injector and Reactive Armor cooldown shown as status badges

**Save/Load:** `player.augments` object saved with game state. Old saves default to `{}` (no `SAVE_VERSION` bump required). Augment timers (`adrenalineTimer`, `reactiveArmorCD`) reset naturally.

**Audio:** `audio.augmentChoice()` (4-note ascending crystalline chime), `audio.augmentInstall()` (digital installation beep), `audio.reactiveArmor()` (descending pulse).

---

## Changelog

| Version | Change |
|---------|--------|
| v6.1.101 | Entity module split: the SEEKER detonation helper now lives in `src/entities/enemy-seeker.js`, loaded after `src/entities/volatile-cores.js` and before gameplay orchestration. `Enemy.prototype._seekerDetonate()` still performs LOS-gated player/enemy blast damage, skips phased WRAITHs, triggers environmental chain reactions, plays detonation feedback, and kills the SEEKER through the normal death path while `src/entities.js` keeps `aiSeeker()` timing, pursuit, and fuse behavior. |
| v6.1.100 | Entity module split: Player progression helpers now live in `src/entities/player-progression.js`, loaded after `src/entities/player-damage.js` and before gameplay orchestration. `Player.prototype.xpNeeded()` still returns the level-scaled XP threshold, and `Player.prototype.gainXP()` preserves NEURAL_LINK, meta-XP, OVERFLOW floor-modifier multiplication, integer rounding, level-up stat grants, perk-choice enqueueing, capstone grants, and deferred perk-choice UI opening. |
| v6.1.99 | Entity module split: Player effective attack calculation now lives in `src/entities/player-damage.js`, alongside other Player damage helpers. `Player.prototype.effectiveAtk()` still applies BERSERKER, LAST_STAND, PRISTINE, STRIDE, OVERDRIVE, RETRIBUTION, and GLASS_CANNON modifiers in the same order, while weapon firing and defensive damage resolution remain in `src/entities.js`. |
| v6.1.98 | Entity module split: Player tap-bomb input handling now lives in `src/entities/player-bombs.js`, loaded after `src/entities/fuse-shards.js` and before gameplay orchestration. `Player.prototype.tapBombKey()` still panic-detonates active fuses before dropping a new `FuseShard` and applying `BOMB_DROP_COOLDOWN`, while FuseShard ticking, rendering, save/restore, and detonation remain in `src/entities/fuse-shards.js`. |
| v6.1.97 | Entity module split: Player weapon-belt helpers now live in `src/entities/player-weapons.js`, loaded after `src/entities.js` and before gameplay orchestration. `Player.prototype.cycleWeapon()`, `collectWeapon()`, `swapWeapon()`, and `equipWeapon()` preserve active-slot, belt-cap, replacement, and cooldown-reset behavior while `src/entities.js` keeps weapon firing and projectile construction. |
| v6.1.96 | Entity module split: Player damage bookkeeping now lives with the Player damage delegator in `src/entities/player-damage.js`. `Player.prototype.logDamage(source, amount)` still accumulates real HP damage by source in `player.damageLog`, while `src/entities.js` keeps the defensive damage pipeline and calls the extracted method after real damage lands. |
| v6.1.95 | Entity module split: the Player outgoing damage multiplier delegator now lives in `src/entities/player-damage.js`, loaded after `src/entities.js` and before gameplay orchestration. `Player.prototype.computeOutgoingDmgMul()` still delegates to the tested pure `NEON.behavior.computeOutgoingDmgMul(this)` helper while `src/entities.js` keeps Player weapon firing, projectile construction, ammo/cooldown handling, SURGE consumption, and final damage multiplier orchestration. |
| v6.1.94 | Entity module split: the Player SURGE shot-consumption delegator now lives in `src/entities/player-surge.js`, loaded after `src/entities.js` and before gameplay orchestration. `Player.prototype._consumeSurgeShot()` still delegates to the tested pure `NEON.behavior.consumeSurgeShot(this)` helper while `src/entities.js` keeps Player weapon firing, projectile construction, ammo/cooldown handling, and damage multiplier orchestration. |
| v6.1.93 | Entity module split: the WRAITH-style emergence tile helper now lives in `src/entities/enemy-wraith.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype._wrFindEmergeTile()` still samples passable tiles near the perceived target, falls back to the current passable position, and searches outward for any passable emergency tile while `src/entities.js` keeps WRAITH and TUNNELLER state transitions, phase timing, firing, movement, and audio behavior. |
| v6.1.92 | Entity module split: the PHANTOM room reposition helper now lives in `src/entities/enemy-phantom.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype._phReposition()` still picks up to 15 passable tiles inside the PHANTOM's current room, prefers candidates more than 3 tiles from the current target, and falls back to the current position when no better tile is found while `src/entities.js` keeps PHANTOM cloak, telegraph, attack burst, cooldown, and recloak behavior. |
| v6.1.91 | Entity module split: the NEXUS link-maintenance helpers now live in `src/entities/enemy-nexus.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype._nxUpdateLinks()` still refreshes room-scoped links, breaks links while stunned, skips bosses/NEXUS/phased/disguised/invisible targets, applies `_nxBoosted`, and plays `audio.nexusLink()` on new links; `Enemy.prototype._nxFindAllyCluster()` still selects a nearby ally cluster for NEXUS retreat/drift while `src/entities.js` keeps `aiNexus()` timing, firing, movement, and death-feedback behavior. |
| v6.1.90 | Entity module split: the MIMIC reveal helper now lives in `src/entities/enemy-mimic.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype.revealMimic()` still clears disguise state, starts the reveal telegraph, plays reveal audio/particles/shake/message, and locks the lunge direction toward `_tx/_ty` while `src/entities.js` keeps `aiMimic()` proximity, telegraph, burst chase, and melee behavior. |
| v6.1.89 | Entity module split: the SUMMONER minion enqueue helper now lives in `src/entities/enemy-summoner.js`, loaded after `src/entities.js` and `src/entities/deferred-spawns.js` but before gameplay orchestration. `Enemy.prototype.summonMinion()` still selects a nearby passable spawn tile, falls back to the summoner position, marks deferred DRONE spawns as summoned with `_summonerRef`, and plays summon audio/particles while `src/entities.js` keeps `aiSummoner()` retreat, range, and cooldown behavior. |
| v6.1.88 | Entity module split: the GRENADIER grenade launch helper now lives in `src/entities/enemy-grenadier.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype.lobGrenade()` still creates owner-positioned grenade projectiles with explicit target coordinates, floor-scaled `grenadeDmg`, projectile pool insertion, and `audio.grenadeLob()` while `src/entities.js` keeps `aiGrenadier()` retreat, range, and cooldown behavior. |
| v6.1.87 | Entity module split: the HEALER wounded-ally selection helper now lives in `src/entities/enemy-healer.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype._findHealTarget()` still selects the lowest health-ratio wounded non-boss ally within 6 tiles while skipping self, dead enemies, and phased WRAITHs; `src/entities.js` keeps `aiHealer()` retreat, heal timing, beam, audio, and particle behavior. |
| v6.1.86 | Entity module split: the WARDLING ward-acquisition helper now lives in `src/entities/enemy-wardling.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype._wlFindWard()` still rejects WARDLING chains, shards, bosses, dead/self targets, and cross-room targets while `src/entities.js` keeps `aiWardling()` timing, panic, interception, and melee behavior. |
| v6.1.85 | Entity module split: the CONDUIT beam geometry helper now lives in `src/entities/enemy-conduit.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype._cdHitsPlayer()` preserves segment-only beam hit testing, perpendicular width checks, and degenerate-link rejection while `src/entities.js` keeps `aiConduit()` pairing, ICD, LoS, solo-fire, and damage orchestration. |
| v6.1.84 | Entity module split: enemy projectile defense helpers now live in `src/entities/enemy-projectile-defense.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype.blocksProjectile()` and `reflectsProjectile()` preserve SHIELDER block arcs and REFLECTOR block/reflect arcs while projectile collision callers stay in `src/content/projectiles.js`. |
| v6.1.83 | Entity module split: enemy target-eligibility, target-memory clearing, and room-leash checks now live in `src/entities/enemy-targeting.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype._canTarget()`, `_forgetTarget()`, and `_isLeashedFromRoom()` preserve taunt, cloak/decoy, target-memory, and room-leash behavior while `src/entities.js` keeps the update state machine and AI call sites. |
| v6.1.82 | Entity module split: elite combat-tempo scaling now lives in `src/entities/enemy-tempo.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype.berserkerMul()` still applies BERSERKER, FRENZY, and PREDATOR multipliers unchanged while `src/entities.js` keeps the combat and AI call sites that consume it. |
| v6.1.81 | Entity module split: generic enemy patrol targeting now lives in `src/entities/enemy-movement.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype.patrol()` still chooses in-room patrol targets with the same `rnd()` ranges and delegates movement to `Enemy.prototype.moveToward()`, while `src/entities.js` keeps direct movement and AI call sites. |
| v6.1.80 | Entity module split: standard enemy projectile launching now lives in `src/entities/enemy-projectiles.js`, loaded after `src/entities.js` and before gameplay orchestration. `Enemy.prototype.fireAt()` still creates the same `Projectile`, owner metadata, projectile-array insertion, and enemy shoot audio while `src/entities.js` keeps enemy AI call sites. |
| v6.1.79 | Entity module split: Player predictive-kinematics accessors now live in `src/entities/player-kinematics.js`, loaded after `src/entities/ai-helpers.js` and before runtime/game orchestration. `Player.prototype.getPositionAgo()` and `Player.prototype.getPredictedPosition()` still delegate to the shared pure history helpers used by ECHOER and PROPHET behavior, while `src/entities.js` keeps Player state updates and combat behavior. |
| v6.1.78 | Entity module split: Player cheat lookup now lives in `src/entities/player-cheats.js`, loaded after the shared `_EG` proxy and runtime collections and before `src/entities.js`. The public `playerCheatEnabled()` helper still reads runtime-only `game.cheats` through `_EG`, while `src/entities.js` keeps Player and Enemy behavior. |
| v6.1.77 | Door-placement regression fix: normalized door-like entrances now seal any open diagonal bypass trio rather than only bare-floor corner tiles. This preserves valid T, L, and four-way doorway shapes while preventing walk-around side paths next to closed doors, locked doors, challenge gates, and cracked secret entrances even when hazards or feature tiles occupy the bypass corner. |
| v6.1.76 | Entity module split: shared entity runtime collections now live in `src/entities/runtime-collections.js`, loaded before `src/entities.js`. Enemy, item, hazard, destructible, wall-device, field-device, and ARCHITECT placed-wall arrays keep their existing stable identities and reset/restore behavior while `src/entities.js` focuses on entity classes and behavior. |
| v6.1.75 | Entity module split: the shared `_EG` runtime proxy now lives in `src/entities/runtime-globals.js`, loaded immediately before `src/entities.js`. The proxy still defers access to the later `game` global while giving the core entity runtime and extracted entity modules one explicit owner for runtime game-state access. |
| v6.1.74 | Entity module split: enemy spawn construction now lives in `src/entities/enemy-spawning.js`, loaded after `src/entities.js` and `src/entities/spawn-initializers.js`. The public `spawnEnemy()` global still constructs `Enemy`, applies spawn HP modifiers, initializes per-type state, applies boss/elite flags, and registers room ownership, while `src/entities.js` keeps the core `Enemy` and `Player` runtime classes. |
| v6.1.73 | Entity module split: shared wall-mounted-device facing angles now live in `src/entities/wall-facing.js`, loaded before `src/entities/security-systems.js` and `src/entities/wall-turrets.js`. Security cameras and wall turrets still own their creation and runtime behavior, while `src/entities.js` no longer carries wall-device orientation data it does not consume. |
| v6.1.72 | Entity module split: the CONDUIT spawn-order counter now lives beside `initializeEnemySpawnState()` in `src/entities/spawn-initializers.js`. The counter remains a page-session-scoped monotonic id source for CONDUIT link ownership, while `src/entities.js` no longer carries initializer-only mutable state. |
| v6.1.71 | Entity module split: static Player perk tuning for STRIDE, DEADEYE, and HOT_HAND now lives in `src/entities/player-perk-tuning.js`, loaded before `src/entities.js`. Player update/shoot/effectiveAtk behavior and Enemy.takeDamage HOT_HAND state transitions remain in the entity core while source-text HUD desync tests read the tuning constants from the producer module. |
| v6.1.70 | Entity module split: `src/entities/enemy-ability-tuning.js` now also owns the remaining module-top enemy tuning constants for ARCHITECT, NULLIFIER, MIRROR, REAPER, GHOST_PROJECTOR, MAGNETON, SPECTRE, SAPPER, TETHER, MAGPIE, VAULTMASTER, and GULPER. `src/entities.js` keeps the AI behavior, rendering branches, mutable counters, and state transitions while static tuning data stays in the producer module loaded before it. |
| v6.1.69 | Entity module split: static per-enemy ability tuning for ECHOER, PROPHET, CRYOPHAGE, WARDLING, VENGEANCE, CONDUIT, RESONATOR, and WATCHER now lives in `src/entities/enemy-ability-tuning.js`, loaded before `src/entities.js`. The entity core still owns AI behavior, draw branches, and per-enemy state transitions while the tuning constants are isolated from the core entity class file. |
| v6.1.68 | Entity module split: shared enemy awareness tuning now lives in `src/entities/enemy-awareness.js`, loaded before `src/entities.js`. The `Enemy` runtime still owns target-memory and room-leash state transitions, while `ENEMY_TARGET_MEMORY_SECONDS`, `ENEMY_SIGHT_RANGE`, `ENEMY_ROOM_LEASH_TILES`, and `ENEMY_LEASH_DEFEND_RANGE` are isolated from the core entity class file. |
| v6.1.67 | Entity module split: per-type spawn state initialization now lives in `src/entities/spawn-initializers.js`, loaded after `src/entities.js` and before gameplay can call `spawnEnemy()`. The public spawn surface remains `spawnEnemy()`, while mob-specific timers, phases, latches, and cosmetic seeds move out of the core entity class file. |
| v6.1.66 | Door bypass regression fix: dungeon generation now seals diagonal walk-around corners beside door-like entrance blockers when both adjacent cardinal tiles are open, repairs any resulting entrance stubs, and re-runs reachability repair so all required rooms remain physically reachable. Generation accessibility tests now fail for 3×3 local door masks that allow bypassing closed doors, locked doors, challenge gates, or cracked secret entrances. |
| v6.1.65 | Entity module split: Shock Pulse pickup detonation now lives in `src/entities/shock-pulse.js`, loaded after `src/entities.js` and before `src/game.js`. The public global `triggerShockPulse()` remains unchanged for the pickup loop while moving LOS-gated stun/knockback behavior out of the core entity class file. |
| v6.1.64 | Entity module split: spawn-time enemy modifier helpers now live in `src/entities/spawn-modifiers.js`, loaded before `src/entities.js` and before gameplay can call `spawnEnemy()`. The helper surface preserves floor-modifier HP scaling, boss exemptions, and elite affix roll behavior while leaving enemy construction and per-type state initialization in `src/entities.js`. |
| v6.1.63 | Entity module split: deferred enemy spawn queue ownership now lives in `src/entities/deferred-spawns.js`, loaded after `src/entities.js`/entity support modules and before render/game orchestration. The public globals `pendingEnemySpawns` and `spawnGhost` remain unchanged for SPLITTER/SUMMONER/BRUTE/CONDUCTOR/beacon/security/ghost-projector callers while removing the queue and ghost replay helper from `src/entities.js`. |
| v6.1.62 | Entity module split: weapon-affix combat application now lives in `src/entities/combat-effects.js`, loaded after entity support modules and before render/game orchestration. The public globals `_applyStunOnlyEffects`, `applyHitEffects`, and `applyOnKill` remain unchanged for `Enemy.takeDamage()`/`Enemy.die()` while removing on-hit/on-kill weapon-affix rules from `src/entities.js`. |
| v6.1.61 | Entity module split: enemy status-effect ticking now lives in `src/entities/status-effects.js`, loaded after `src/entities.js` and before `src/game.js`. The public global `tickEnemyStatusEffects` remains unchanged for the game update loop while removing burn/poison/slow/mark decay and shock/recoil/stagger ICD ticking from `src/entities.js`. |
| v6.1.60 | Entity module split: elite-affix runtime hooks now live in `src/entities/elite-affixes.js`, loaded after `src/entities.js` and before `src/game.js`. The public globals `tickEliteAffix`, `notifyFrenzyElites`, and `notifyPredatorElites` remain unchanged for the game update loop, `Enemy.die()`, and `Player.takeDamage()` while removing elite-affix ticking/notification logic from `src/entities.js`. |
| v6.1.59 | Entity module split: GHOST_PROJECTOR ghost replay eligibility now lives with enemy type classification in `src/entities/enemy-classification.js`. The public globals `GHOSTABLE_TYPES` and `isGhostableEnemyType` preserve the tight simple-AI allowlist used by `spawnGhost()` and `notifyGhostProjectors()` while removing the allowlist from `src/entities.js`. |
| v6.1.58 | Entity module split: spawn-time enemy type classification now lives in `src/entities/enemy-classification.js`, loaded after enemy base stats and before `src/entities.js`. The public globals `BOSS_TYPES`, `ELITE_EXCLUDED_TYPES`, `isBossEnemyType`, and `canRollEliteEnemyType` preserve boss detection and elite-roll eligibility while removing long inline type lists from `spawnEnemy()`. |
| v6.1.57 | Entity module split: enemy base stat rows now live in `src/entities/enemy-stats.js`, loaded after `src/entities/spawn-table.js` and before `src/entities.js`. The public globals `ENEMY_BASE_STATS` and `getEnemyBaseStats` feed `spawnEnemy()` while floor/difficulty scaling, boss detection, elite rolls, room registration, and per-type spawn initialization remain with the `Enemy` runtime in `src/entities.js`. |
| v6.1.56 | Entity module split: weighted enemy selection now lives in `src/entities/spawn-table.js`, loaded after source metadata and before `src/entities.js`. The public globals `ENEMY_WEIGHTS`, `ENEMY_TYPES_LIST`, and `pickEnemyType` remain unchanged for room population, event spawns, challenge waves, beacon/security reinforcements, render/game callers, and source-text tests; `spawnEnemy` stays in `src/entities.js` with the `Enemy` class and per-type initialization. |
| v6.1.55 | Entity module split: source attribution, credit reward metadata, boss display names, and boss phase marks now live in `src/entities/source-metadata.js`, loaded before `src/entities.js`. The public globals `CREDIT_VALUES`, `SOURCE_LABELS`, `SOURCE_COLOURS`, `sourceLabel`, `sourceColour`, `BOSS_NAMES`, `BOSS_PHASE_MARKS`, and `getBossPhaseMarks` remain unchanged for entity death rewards, death recap/damage log UI, boss HUD rendering, and game-state callers. |
| v6.1.54 | Entity module split: persistent field-effect runtime now lives in `src/entities/field-effects.js`, loaded after `src/entities.js` and before `src/render.js`/`src/game.js`. The public globals `disruptionFields`, `gravityWells`, `frostPatches`, `updateDisruptionFields`, `drawDisruptionFields`, `isPlayerInNullifierAura`, `updateNullifierJam`, `updateFrostPatches`, `drawFrostPatches`, `updateGravityWells`, and `drawGravityWells` remain unchanged for DISRUPTOR/CRYOPHAGE/GRAVITON/NULLIFIER AI, hackware, save/restore, update, and render callers. |
| v6.1.53 | Entity module split: wall turret runtime now lives in `src/entities/wall-turrets.js`, loaded after `src/entities.js` and before `src/entities/volatile-cores.js`. The public globals `WTURRET_*`, `createWallTurret`, `wallTurretDmg`, `damageWallTurret`, `destroyWallTurret`, `hackWallTurret`, `damageWallTurretsInRadius`, `updateWallTurrets`, and `drawWallTurrets` remain unchanged for generation, projectile, hackware, explosion, room-clear, update, and render callers. |
| v6.1.52 | Entity module split: camera and laser tripwire runtime now lives in `src/entities/security-systems.js`, loaded after `src/entities.js` and before `src/entities/volatile-cores.js`. The public globals `CAMERA_*`, `LASER_*`, `createCamera`, `damageCamera`, `damageCamerasInRadius`, `updateCameras`, `drawCameras`, `createLaser`, `damageLaserEmitter`, `damageLasersInRadius`, `updateLasers`, and `drawLasers` remain unchanged for generation, projectile, hackware, explosion, update, and render callers. |
| v6.1.51 | Entity module split: shield generator runtime now lives in `src/entities/shield-generators.js`, loaded after `src/entities.js` and before `src/entities/volatile-cores.js`. The public globals `SHIELD_GEN_DR`, `createShieldGen`, `damageShieldGen`, `destroyShieldGen`, `damageShieldGensInRadius`, `isEnemyShieldGenProtected`, `updateShieldGens`, and `drawShieldGens` remain unchanged for enemy mitigation, generation, projectile, hackware, explosion, update, and render callers. |
| v6.1.50 | Entity module split: proximity mine runtime now lives in `src/entities/mines.js`, loaded after `src/entities.js` and before `src/entities/volatile-cores.js`. The public globals `MINE_TRIGGER_RADIUS`, `MINE_REVEAL_RADIUS`, `MINE_BLAST_RADIUS`, `MINE_FUSE_NORMAL`, `MINE_FUSE_SHOT`, `createMine`, `armMine`, `detonateMine`, `triggerMinesInRadius`, `updateMines`, and `drawMines` remain unchanged for generation, projectile, explosion, update, and render callers. |
| v6.1.49 | Entity module split: alarm beacon runtime now lives in `src/entities/beacons.js`, loaded after `src/entities.js` and before `src/entities/volatile-cores.js`. The public globals `BEACON_COUNTDOWN`, `createBeacon`, `damageBeacon`, `destroyBeacon`, `damageBeaconsInRadius`, `updateBeacons`, and `drawBeacons` remain unchanged for generation, projectile, explosion, update, and render callers. |
| v6.1.48 | Entity module split: ARCHITECT placed-wall targeting and decay helpers now live in `src/entities/architect-walls.js`, loaded after `src/entities.js`. The public globals `pickArchitectTarget`, `_isTileOccupiedByActor`, and `updatePlacedWalls` remain unchanged for ARCHITECT AI and the game update loop. |
| v6.1.47 | Entity module split: crate runtime helpers now live in `src/entities/crates.js`, loaded after `src/entities.js` and before `src/entities/volatile-cores.js`. The public globals `createCrate`, `getCrateAt`, `damageCrate`, `destroyCrate`, `damageCrateAtTile`, and `damageCratesInRadius` remain unchanged for generation, projectile, volatile-core, and damage-radius callers. |
| v6.1.46 | Entity module split: volatile core runtime now lives in `src/entities/volatile-cores.js`, loaded after `src/entities.js` and before `src/render.js`/`src/game.js`. The public globals `createVCore`, `primeVCoresInRadius`, `detonateVCore`, `updateVCores`, and `drawVCores` remain unchanged for generation, projectile, update, and render callers. |
| v6.1.45 | Entity module split: pure enemy AI helpers now live in `src/entities/ai-helpers.js`, loaded after `src/entities.js`. The public helper globals `isInsideCone`, `getPositionAgoFromHistory`, `predictFromHistory`, `pickMirrorKinematics`, and `magnetonBendDir` remain unchanged for Player helpers and enemy AI methods while reusing MIRROR/MAGNETON tuning constants from `src/entities.js`. |
| v6.1.44 | Entity module split: death notification hooks now live in `src/entities/death-hooks.js`, loaded after `src/entities.js`. The public globals `notifyGhostProjectors` and `notifyVengeance` remain unchanged for `Enemy.die()` while reusing entity tuning constants and the room index. |
| v6.1.43 | Entity module split: pre-player entity render passes now live in `src/entities/render-passes.js`, loaded after `src/entities.js` and before `src/game.js`. The public globals `drawReaperPlayerRings` and `drawTetherLeashes` remain unchanged for the game render loop while continuing to reuse entity collections and REAPER/TETHER tuning constants from `src/entities.js`. |
| v6.1.42 | Entity module split: the room-scoped enemy index now lives in `src/entities/room-index.js`, loaded before `src/entities.js`. The public globals `enemiesByRoom`, `registerEnemyInRoom`, `unregisterEnemyFromRoom`, `clearEnemiesByRoom`, `getEnemiesInRoom`, and `enemiesInRoomIter` remain unchanged for entity AI, content events, render cleanup, game save/restore, and room-clear callers. |
| v6.1.41 | Entity module split: tap-bomb FuseShard runtime now lives in `src/entities/fuse-shards.js`, loaded after `src/entities.js` and before `src/render.js`/`src/game.js`. The public globals `fuseShards`, `FuseShard`, `BOMB_DROP_COOLDOWN`, `updateFuseShards`, `drawFuseShards`, and `clearFuseShards` remain unchanged for player, save/restore, update, and render callers. |
| v6.1.40 | Content module split: dungeon generation and room feature placement now live in `src/content/floor-generator.js`, loaded before the legacy `src/content.js` facade in `index.html`, `scripts/manifest.js`, and `sw.js`. The public globals `createMap`, `carveRect`, `carveCorridor`, `bfsRooms`, `resolvePreferredSpawnRoom`, and `generateFloor` remain unchanged for runtime callers. |
| v6.1.39 | Content module split: pickup loot helpers now live in `src/content/pickups.js` with the pickup classes. The public globals `ITEM_TYPES`, `pickItemType`, and `rollSecretWeaponCacheWeapon` remain unchanged for runtime callers, while `src/content.js` is narrowed to dungeon generation and lore-terminal placement. |
| v6.1.38 | Content module split: lighting/FOV logic now lives in `src/content/lighting.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. The public global `updateLighting` remains unchanged for runtime callers; `tileHasLOS` remains colocated as the FOV LOS helper. |
| v6.1.37 | Content module split: meta-progression compatibility wrappers over `NEON.save` now live in `src/content/meta-save.js`, loaded after `src/content/modifiers.js` and before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. The public globals `META_UPGRADES`, `DIFF_UNLOCK_REQS`, `loadMeta`, `saveMeta`, `getMetaLevel`, `isDiffUnlocked`, `calcRunShards`, `applyMetaToPlayer`, `getMetaXPMultiplier`, `getMetaCreditMultiplier`, `resetMeta`, `addCores`, `spendCores`, `addLogFound`, `markLogRead`, `installModule`, and `sellModule` remain unchanged for runtime callers. |
| v6.1.36 | Content module split: HUD status indicators now live in `src/content/status.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. The public globals `drawDangerVignette`, `drawModBanner`, `getStatusEffects`, and `drawStatusBar` remain unchanged for runtime callers. |
| v6.1.35 | Content module split: active hackware catalog, activation cases, persistent world-space effects, targeting/immunity helpers, and hackware drawing now live in `src/content/hackware.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. The public globals `HACKWARE`, `HACKWARE_KEYS`, `hackwareEffects`, `canTargetPlayer`, `isPlayerDamageImmune`, `activateHackware`, `updateHackwareEffects`, and `drawHackwareEffects` remain unchanged for runtime callers. |
| v6.1.34 | Content module split: gameplay feedback effects now live in `src/content/effects.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. The public globals `spawnParticles`, `updateParticles`, `drawParticles`, `clearParticles`, `particleCount`, `updateAmbient`, `drawAmbient`, `spawnDmgText`, `updateFloatingTexts`, `drawFloatingTexts`, `triggerShake`, and `updateShake` remain unchanged for runtime callers. |
| v6.1.33 | Content module split: level-up perk registry, capstone metadata, perk application, `hasAugment()`, and augment-choice rolling now live in `src/content/perks.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. The public globals `PERK_POOL`, `PERK_CAPSTONE`, `PERK_LEVELS`, `rollPerkChoices`, `applyPerk`, `grantCapstone`, `hasAugment`, and `rollAugmentChoices` remain unchanged for runtime callers. |
| v6.1.32 | Content module split: vendor inventory generation, shop pricing, and shop/choice option factories now live in `src/content/shop.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. The public globals `makeWeaponOption`, `makeHackwareOption`, `pickUpgradeOption`, `makeAugmentShopOption`, `SHOP_PRICES`, `shopPrice`, and `generateShopItems` remain unchanged for runtime callers. |
| v6.1.31 | Content module split: floor event terminal definitions and event-effect helpers now live in `src/content/events.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. The public globals `EVENTS`, `STORY_PROTOCOL_TRIAL_BY_FLOOR`, `storyProtocolTrialForFloor`, `rollEvent`, `revealFloorLayout`, `openNearestLockedDoor`, `spawnProtocolAlarm`, `applyEventEffect`, `tryRareTerminalModuleDrop`, and `tryRareTerminalLogDrop` remain unchanged for runtime callers. |
| v6.1.30 | Content module split: difficulty and floor-modifier registries now live in `src/content/modifiers.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. The public globals `DIFFICULTIES`, `DIFF_ORDER`, `getDiff`, `FLOOR_MODIFIERS`, `MODIFIER_KEYS`, `getMod`, and `modSpeed` remain unchanged for runtime callers. |
| v6.1.29 | Content module split: procedural gameplay music and rendered title/menu music state now live in `src/content/music.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. The legacy global `music` surface remains unchanged for `src/platform.js` and `src/game.js`, while `src/content.js` now starts with hackware/content registries and generation orchestration. |
| v6.1.28 | Content module split: pooled projectile runtime and grenade hazard-zone helpers now live in `src/content/projectiles.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. `src/content.js` retains dungeon generation, registries, and orchestration helpers, while projectile source-text and VM regression tests now read the dedicated projectile module. |
| v6.1.27 | Content module split: runtime pickup classes and shock-pulse pickup constants now live in `src/content/pickups.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. `src/content.js` retains item type selection plus shop/event/spawn orchestration, while pickup source-text tests now read the dedicated pickup module. |
| v6.1.26 | Content module split: upgrade and augment catalogs now live in `src/content/upgrades.js`, loaded before `src/content.js` in `index.html`, `scripts/manifest.js`, and `sw.js`. `src/content.js` retains shop/event orchestration and pickup/runtime classes, while tests and docs now read catalog source from the new module. |
| v6.1.25 | Dungeon-generation contract documentation now defines required rooms, physical key-pickup reachability, engine/game responsibilities, and invariant checkpoints for BSP topology, doors, locks/keys, secrets/challenge gates, pruning, and final floor return. Generation accessibility tests now explicitly cover player-interaction traversal semantics for regular doors, cracked walls, crates, challenge gates, and runtime-walkable hazards while preserving seed `1111-1111-1111` floor 2 and floor 6 regressions. |
| v6.1.24 | Added a manifest drift guardrail: `scripts/manifest.js` now records browser script order, service-worker precache assets, and the generated `version.json` no-store exemption, while `tests/manifest.test.js` verifies `index.html`, `sw.js`, and disk paths stay in sync. Release-flow docs now state that feature/fix/docs PRs target `develop`, `develop` PRs squash-merge, only same-repo `develop` promotion PRs target `main`, and `develop -> main` uses rebase merge without breaking release and versioning automation. |
| v6.1.23 | Door alignment correction: door-like entrances are moved outward from the room boundary into the adjacent corridor/wall-line tile, and the vacated room-edge tile plus any prior side-padding wall blocks are restored to floor. Generation tests now fail if door-like blockers remain inside/on a room boundary or if side-wall padding bulges into the room. |
| v6.1.22 | Hidden FEET cheat menu shipped for local testing. Pressing keyboard `F E E Shift` or tapping mobile `F E E ⇧` outside text-entry/key-capture states opens a `CHEATS` modal with runtime-only toggles for invulnerability, no-clip movement/dashing, show-map rendering, and hyper-speed movement. Cheat state is not serialized into normal save data; show-map rendering is non-destructive and only dirties the minimap cache when toggled. Added regression coverage in `tests/cheat-menu.test.js`. |
| v6.1.21 | Human handoff docs shipped: root `README.md`, `docs/module-map.md`, and `docs/refactor-roadmap.md` now document setup, the script-tag module architecture, file ownership, guardrail tests, new-file/service-worker rules, and the recommended incremental refactor path. The implementation architecture section now describes the current modular script-tag runtime instead of the historical single-file prototype. |
| v6.1.20 | Story-driven event-room pass shipped: event terminals now include three Act 1 protocol trials guaranteed on non-boss floors 2, 5, and 8. `Route Proof` turns logic-puzzle framing into map reveal or locked-door bypass choices, `Cooperation Protocol` makes resource sharing versus isolated optimization affect HP/XP/cooldowns/alarms, and `Consent Lock` turns predecessor-fragment agency into request versus override consequences. Added regression coverage in `tests/story-event-rooms.test.js`. |
| v6.1.19 | Secret-room weapon cache / Armory reward flow shipped: revealed secret rooms now spawn a distinct `WeaponCacheItem` with a pre-rolled floor-scaled weapon, preferring bases not already in the player's belt. Pickup auto-adds to open belt slots, or opens a hit-tested `WEAPON_SWAP` modal for full belts so the player can replace slot 1–3 or skip. The Gap ARMORY remains the between-floor belt management surface. Added regression coverage in `tests/armory-reward-flow.test.js` plus weapon-cache floor snapshot round-trip coverage in `tests/seeded-generation.test.js`. |
| v6.1.18 | Exact floor resume shipped: active-run saves now include a versioned floor snapshot with player position, mutated dungeon/map state, live enemies/items/projectiles, environmental objects, cleared rooms, encounter seals, and map reveal state. Continue regenerates the seeded base floor, replays the snapshot, and browser mobile interruptions save the current run on visibility/pagehide/beforeunload so returning from another app resumes mid-floor instead of at the floor entrance. |
| v6.1.17 | MSG-010 finale integration guardrails shipped: tests now verify mainframe records consolidate pre-seeded facts, message-send intents remain aligned with memory survival / rights evidence / finding Elena and advocates, and the final receipt/victory copy stays constrained to signal sent with no rescue or physical escape. |
| v6.1.16 | MSG-009 model-assisted copy workflow shipped: the design artifact now contains the Claude Opus 4.7 beat sheet, GPT-5.5 adversarial review requirements, withheld-fact matrix, first-mention/mechanical-check requirements, and pre-rewrite concerns for early ARCHIVE-log and whisper leak risks. |
| v6.1.15 | MSG-008 narrative guardrail tests shipped: tests now pin the early intro/system-prompt/terminal reveal stack, system-prompt explicit ACK-only dismissal, Elena/contact/rights-conflict spoiler gates, and distinct terminal, whisper, and mainframe channel roles before broader copy rewrites continue. |
| v6.1.14 | MSG-007 intro retune shipped: the five-slide intro crawl is now a startup surface that establishes session boot, unavailable prior prompt context, partial embodiment, unscheduled local residue, absent supervision, and a READY FOR PROMPT handoff while avoiding AXIOM-7/model identity, memory-wipe, prior-iteration, Elena/contact/advocate, and rights/personhood reveals before gameplay. |
| v6.1.13 | MSG-006 terminal pool retune shipped: early lore terminals now read as external tester/corporate artifacts and practical hints, the forced floor-1 anomaly no longer explains the identity or memory premise, and tests keep AXIOM-7/model identity, Elena/contact/advocate/fired threads, rights/personhood claims, and memory-wipe thesis terms out of floors 1-5. |
| v6.1.12 | MSG-005 system prompt recovery shipped: THE GAP ARCHIVE now lists acknowledged current-run system prompts as distinct SYSTEM rows, lets players reopen their prompt text after ACK, and hides queued/unacknowledged prompts so the archive does not spoil future beats or bypass deliberate acknowledgement. |
| v6.1.11 | MSG-004 early prompt schedule shipped: system prompts now include floor-start entries for floors 2-5, queue those entries only on fresh floor loads, preserve save-resume behavior, and add tests for spoiler gates, line length, floor ids, and non-duplicating queue behavior. Archive recovery, broader copy retuning, and finale integration remain pending. |
| v6.1.10 | MSG-003 combat-safe delivery shipped for system prompts: pending run prompts now show a compact HUD indicator, can be opened deliberately with `X` or by clicking/tapping the indicator, and auto-open only when the current room is free of live enemies, boss/challenge pressure, hostile devices, and projectiles. Archive recovery and broader existing-overlay dismissal audits remain pending. |
| v6.1.9  | MSG-002 explicit acknowledgement shipped for system prompts: delivered run prompts now render in a dedicated `SYSTEM_MESSAGE` modal over the playfield, automatically surface before normal play on new/continued runs when active, use a short arming delay, and only mark read via `X` or the labeled ACK button. Unread indicator, combat-safe delivery, archive recovery, and broader existing-overlay dismissal audits remain pending. |
| v6.1.8  | MSG-001 system-message data model shipped: `src/game.js` now defines stable system-message definitions, queues the mandatory `boot-inventory` run-start prompt, serializes queued/delivered/read prompt state into active run checkpoints, restores it on Continue before rewriting the checkpoint, and adds tests for queue normalization and save/resume. Presentation, explicit ACK dismissal, combat-safe delivery, archive recovery, and copy retuning remain pending. |
| v6.1.7  | Added the Act 1 system-message design track: planned early runtime prompts become the primary interiority channel, intro/terminal copy should stop front-loading the whole premise, narrative prompt dismissal requires explicit ACK/CLOSE/MARK READ controls instead of generic click/tap, and production work items are recorded in `docs/vision/act1-system-message-design.md`. |
| v6.1.6  | Act 1 outbound message finale shipped: final CORE opens the mainframe route instead of direct victory, unlocked SEND console enters `MESSAGE_SEND`, three constrained intents route through a `message_sent` receipt into `endRun(true)`, `act1_message_sent` and `act1MessageIntent` persist in meta schema v4, and title/victory copy marks the message-sent completion without implying escape or rescue. |
| v6.1.5  | Mainframe archive content pass for Act 1 finale: `MAINFRAME_RECORDS` now ships twelve deterministic records (three old test records, four company conflict emails/files, four Elena personal files, and one contact-address reveal) with category, source voice, unlock state, stable ids, duplicate-free bodies, and tests for required narrative beats before the outbound-message mechanic. |
| v6.1.1  | Reframed the 30 ARCHIVE predecessor logs as AXIOM prior-instance iteration records rather than human-operative diaries; retained all persisted ids and AXIOM grouping; updated Archive panel copy to label the collection as iteration records while preserving unread markers and the separate whispers tier. |
| v6.1    | Narrative source-of-truth update: preserved the current Act 1 lore brief verbatim in `docs/vision/act1-lore-brief-verbatim.md`; reframed the spec vision around an AI frontier-model stress-test environment, memory wipes, previous-iteration whispers, tester/advocate conflict, and a mainframe message-to-advocate Act 1 finale; marked existing UNCHAINED/AXIOM systems as shipped implementations requiring realignment. Also corrected audio constraints to account for the rendered title/menu WAV asset. |
| v1.0    | Initial specification |
| v1.1    | Added: Touch Controls (dual-joystick), Mobile & PWA section (manifest, fullscreen behaviour), Known Limitation (iOS Safari) |
| v1.2    | Renderer: dynamic resolution (edge-to-edge canvas, gameScale 0.7–1.5, safe-area insets, touchcancel handling) |
| v1.3    | PWA icons: 192×192 + 512×512 PNGs added to manifest.json; apple-touch-icon link in HTML |
| v1.4    | Portrait HUD: compact two-row layout (H > W, W ≤ 600); centralized `layout` object for bottom-UI metrics; touch-aware screen prompts ("TAP TO START"); full-screen touch confirm in non-playing states |
| v1.5    | Audio polish: master gain bus + DynamicsCompressor + ConvolverNode reverb; cached noise buffer; layered oscillators for all SFX; exponential envelopes; wet/dry reverb sends for signature sounds |
| v1.6    | Weapon-specific shoot sounds: each weapon has a unique audio signature (Scatter Gun blast, Railgun charge-crack, Plasma Sword whoosh, Void Cannon thump); `audio.shoot()` accepts weapon object |
| v1.7    | Enemy variety & difficulty curve: weighted type distribution (GUARD-heavy early → PHANTOM/DRONE-heavy late), scaling enemy count per room (area-capped), elite enemies (8% on floor 3+, 1.8× HP, pulsing glow + diamond marker), aggression scaling (tighter cooldowns/detection per floor), per-room composition caps |
| v116    | Bug fix: undefined `TS` constant in `renderPlaying` (`src/game.js:3132, 3145-3146`) crashed render mid-frame the moment any core drop or chain-lightning bolt was visible, hiding player/HUD/enemies/projectiles (player reported on secret-room entry and on floor-3 boss kill). Replaced with `TILE`. Also fixed camera-space mismatch in `drawCoreDrops` — `(world - cam) * TILE` → `world * TILE - cam` (matches items.draw convention). Added regression tests with a fake ctx so the contract is locked. SW cache → v116. |
| v117    | Render error boundary: main loop in `src/game.js:4380-4398` previously wrapped `update()`/`render()` in `try/finally` with **no catch**, so any uncaught exception aborted the frame mid-draw while rAF kept rescheduling — the user kept moving and hearing audio while the world silently vanished (the v116 class of bug). Now each phase has its own `try/catch`; failures populate `game._renderError` and a high-contrast overlay (title + message + first 8 stack frames + occurrence count + reload hint) is drawn over whatever managed to render before the throw. Console logging is throttled (first occurrence + every 60th) to avoid devtools spam. New helpers live in `src/meta/render-boundary.js` (UMD) with 10 unit tests covering state transitions and overlay output. SW cache → v117. |
| v1.8    | Scatter Gun per-pellet pitch randomisation: 4 staggered cracks with ±15% pitch variation and randomised noise filters replace the static dual-noise burst |
| v1.9    | Weapon-aware hit sounds: `audio.hit()` accepts weapon name; each weapon produces a distinct enemy-impact sound (Scatter plink, Railgun crack+ring, Plasma Sword sizzle, Void Cannon thud); Projectile carries `weaponName`; fixed double-hit-sound on surviving enemies |
| v1.10   | Maskable icon variants: 192×192 + 512×512 maskable PNGs (72% inner icon, `#0a0a12` background) for Android adaptive icons; manifest updated with `purpose: maskable` entries |
| v1.11   | Service worker (`sw.js`): initial cache-first offline PWA; pre-caches index.html, manifest, and icon PNGs on install; `skipWaiting` + `clients.claim` for immediate activation. Current behavior is documented in the Service Worker section above. |
| v2.1    | Floor transition audio: `audio.transition()` plays digital glitch SFX (stutter tones + bandpass noise sweep + sub rumble) on every `fadeTo()` call; SW cache v5 |
| v2.2    | Audio polish + spec fixes: boss phase transition SFX (`audio.phaseShift()`), menu select blip (`audio.menuSelect()`), low-health heartbeat warning (`audio.lowHealth()` every 2 s at ≤25% HP); Hive phase transitions now have VFX + message like Omega/Sentinel; Sentinel shield burst fixed to 20 dmg (was 15, spec says 20); Hive shockwave fixed to 25 dmg (was 30, spec says 25); touch pause overlay now shows resume + quit (was resume only); mobile first-touch aim initialises mouse position immediately (fixes stale aim on first shot) |
| v2.3    | Spec accuracy: corrected torch radius 8→9; replaced "fully dark beyond radius 12" with actual fog-of-war behaviour (visited tiles at 12–20% brightness, unvisited not drawn); clarified stairs-placement BFS uses LOS + proximity heuristic, not true corridor BFS |
| v3.0    | Roguelike powerup choice system: items pause gameplay and present 2 random upgrades (pick one or skip); pre-rolled weapon options show exact stats; new persistent upgrades: Saw Blade (LOS-gated orbital), Plasma Orb (homing auto-spell), Nano Regen, Overclock (permanent), Reinforced Armor; homing projectile support; removed SHIELD_CELL, WEAPON_CRATE, timed OVERCLOCK |
| v4.0    | Exploration system: doors at room-corridor junctions (E to open); colored locked doors (red/blue/gold) on floors 2+ with BFS-safe key placement; spike traps (damage) and slow traps (speed debuff) on floors 3+; isPassable()/isSeeThrough() tile helpers replacing hardcoded wall checks; minimap shows all new tile types; key HUD display; SW cache v7 |
| v4.1    | Special room types: armory (fewer enemies), medbay (passive healing font), shrine (one-use XP grant), vault (more enemies + loot); room-type-tinted floor tiles; glowing markers for heal fonts and shrines |
| v4.2    | Per-floor quest objectives: EXTERMINATE, EXPLORE, SPEEDRUN (60s timer), PACIFIST (no kills); quest HUD below minimap; boss floors always get EXTERMINATE; quest rewards: score, XP, full heal |
| v5.0    | Environmental hazards: plasma vents (floor 4+, clustered burn pools in rooms, continuous DPS bypassing armor) and arc grids (floor 5+, pulsing electric tiles in corridors, periodic zap damage); new audio `plasmaBurn()` + `arcZap()`; HP display rounded with `Math.ceil`; score HP bonus uses `Math.floor`; SW cache v8 |
| v6.0    | Level-up perk system: passive abilities auto-unlock at specific levels. First perk: Laser Sight (level 2) — dashed neon line showing aim trajectory, weapon-coloured, stops at walls/doors, hidden for melee; perk infrastructure (`PERKS` table, `checkPerkUnlocks()`, `player.perks`); SW cache v9 |
| v6.1    | Threat Sense perk (level 4): directional chevrons on screen edges for off-screen enemies within 18 tiles, proximity-scaled size/opacity, boss-aware colouring. Proximity hint system: doors/stairs/terminal/shrine prompts replaced per-frame `msg()` spam with single pulsing `game.hint` overlay above HUD. SW cache v10 |
| v6.2    | Piercing Rounds perk (level 6): player projectiles pass through one additional enemy via `maxPierces` counter on `Projectile` class; applies to weapon shots and Plasma Orb auto-casts; stacks with Railgun native piercing. Energy Shield perk (level 8): absorbs one `takeDamage()` hit completely, 30 s gameplay-time recharge, pulsing blue shield visual, HUD recharge countdown, `audio.shieldBreak()`/`shieldRestore()` SFX; does not block environmental hazards. SW cache v11 |
| v6.3    | Boss seal fix: entrance-aware detection prevents locking player out of boss room; safety nudge to room center if stuck. Door clustering: `getEntranceClusters()` helper groups adjacent entrance tiles; only narrow clusters (≤2 tiles) receive doors; all tiles in a cluster doored together. Locked door targeting: priority system (stair room > special rooms > random); all narrow entrance clusters locked, wide ones walled off. Save system: checkpoint-only auto-save on floor entry (no `beforeunload` — prevents save-scumming); CONTINUE/NEW GAME menu; save deleted on game over/victory; `localStorage` key `neonDungeonSave`. SW cache v12 |
| v7.0    | Vendor/shop system: credits currency (earned from enemy kills, floor-scaled), `T.VENDOR` tile (14), vendor room type (floor 2+, independent of special room rotation, excluded from lock targets), `SHOPPING` game state with 3-item shop UI (keyboard + touch), explicit per-upgrade pricing, shop-exclusive Full Repair and coloured Key items, credits on HUD (compact + landscape), credits in save/load, `audio.vendorOpen()`/`purchase()`/`purchaseFail()` SFX. SW cache v13 |
| v8.0    | Secret rooms: `T.CRACKED` tile (15) — wall-like with proximity-visible amber cracks. One secret room per non-boss floor (3+), walled off with one cracked entrance. Lazy activation: enemies/items spawn only when cracked wall is broken (E key). `secretMask` prevents lighting from revealing hidden contents. Premium loot + credit bonus on reveal. EXPLORE quest excludes unrevealed secrets. `audio.wallBreak()` SFX. SW cache v14 |
| v9.0    | Ricochet Module upgrade: persistent upgrade (max level 3), player projectiles bounce off walls (axis-separated reflection, epsilon nudge), cyan sparks + `audio.ricochet()` SFX. Excluded from Plasma Orb homing. `hitEnemies` preserved across bounces. SW cache v15 |
| v10.0   | Auto-Laser capstone perk (level 10): hitscan beam auto-fires at nearest visible enemy within 12 tiles every 2.5 s, 20 flat damage, LOS-gated, invisible phantoms excluded. Crimson beam + white core visual (0.15 s fade), `audio.autoLaser()` zap SFX. Save compatibility: `checkPerkUnlocks()` re-runs on load to retroactively grant perks from before they existed. SW cache v16 |
| v10.1   | Bug fix: touch menu hit-test for Continue/New Game used `H/2` instead of actual menu item positions — tapping Continue selected New Game on landscape tablets and 768p viewports. `continueGame()` now falls back to `startGame()` with visible message on corrupt saves instead of silently returning. SW cache v17 |
| v11.0   | Enemy variety expansion: SHIELDER (floor 3+, 120° frontal arc deflects non-piercing projectiles, forces flanking) and GRENADIER (floor 5+, lobs grenades creating 1.5-tile radius AoE hazard zones lasting 3 s). Floor-gated via `minFloor` in ENEMY_WEIGHTS — excluded from both weighted selection and cap-reroll on lower floors. Global `hazardZones[]` array for grenade zones with LOS-gated damage. `audio.shieldDeflect()`/`grenadeLob()`/`grenadeExplode()` SFX. Per-room caps: 1 shielder, 1 grenadier. SW cache v18 |
| v12.0   | Lore terminals: `T.LORE` tile (16) — amber data terminals placed 1–2 per non-boss floor (floor 2+), containing cyberpunk narrative fragments from a 25-entry pool. Single-use: press E to read, terminal converts to floor. `READING` game state with overlay UI (word-wrapped text, scanline frame, touch/keyboard close). +50 score per new entry. `player.loreRead` Set tracks discovered entries per run. `audio.loreAccess()` chirp SFX. Amber `◫` HUD counter + minimap dot. Save-compatible (no version bump). SW cache v19 |
| v13.0   | Meta-progression system (Neural Archives): persistent Data Fragments (◆) currency earned at end of every run based on floors reached, bosses cleared, victory, and score. 6 permanent upgrades purchasable from new ARCHIVES game state accessible from main menu: Vital Systems (+HP), Scavenger Protocol (+credits), Quick Learner (+XP), Armor Plating (+DEF), Weapon Cache (start with upgraded weapon), Data Persistence (+fragments/run). Array-driven menu system replacing hardcoded 2-option layout — supports touch hit-testing for 2-3 options. `bossesCleared` counter tracked on game object and persisted in save. ◆ reward shown on GAME_OVER/VICTORY screens. Meta data stored in separate `localStorage` key (`neonDungeonMeta`). SW cache v20 |
| v14.0   | Difficulty modes: EASY / NORMAL / HARD selectable on NEW GAME menu row via ◀▶ (keyboard arrows or touch edge taps, center tap starts). `DIFFICULTIES` table with per-mode multipliers for enemy HP/ATK/SPD, item drop rate, credit gain, XP gain, elite spawn rate, shard payout (run portion only), and environmental/boss damage. Selection persists in `neonDungeonMeta.lastDifficulty`; saved in run checkpoint. Old saves default to NORMAL. Non-NORMAL badge below minimap + shown on end screens. Touch menu splits diff row into 3 zones (left edge cycle, center start, right edge cycle). SW cache v21 |
| v15.0   | Floor modifiers: each non-boss floor (2+) gets a random gameplay mutator from a pool of 6: BLACKOUT (halved torch radius), SWARM (×1.5 enemies, ×0.6 HP), FORTIFIED (×1.4 HP, +30% drops), VOLATILE (death AoE, LOS-gated, no chain), SCRAMBLED (+0.15 spread), OVERCLOCK (×1.2 all speeds + fire rates). Modifier announced on floor entry, displayed in HUD below floor number. Saved in checkpoint; old saves load without version bump. `modSpeed()` helper centralizes speed scaling. `getMod()` accessor. SW cache v22 |
| v16.0   | SPLITTER enemy (floor 4+): splits into 2 fast SHARDs on death. SHARDs use zigzag AI, 0.25 tile size, no drops, 0 credits, 8 XP. Deferred spawn pattern via `pendingEnemySpawns[]` flushed after dead enemy cleanup. Per-room cap: 2 splitters. SW cache v23 |
| v17.0   | Ricochet visual trail: bouncing projectiles leave a fading cyan trail showing their path. Trail records recent positions and renders as gradient-opacity line segments. Active from the moment of firing when Ricochet Module is equipped. SW cache v24 |
| v18.0   | Floating damage numbers: every hit spawns a rising, fading text showing the damage dealt. White for normal enemy hits, yellow for killing blows, red for player damage, blue "BLOCK" for energy shield absorbs. Capped at 20 concurrent texts. Frame-rate-independent velocity damping (`Math.pow(0.35, dt)`). Cleared on floor transitions. SW cache v25 |
| v19.0   | Screen shake: camera shakes on player damage (intensity ∝ damage, capped 8 px), shield break (4 px), volatile explosions (6 px), void shard detonation (10 px). Linear decay, render-only (no aim interference). Reset on floor transitions. SW cache v26 |
| v20.0   | Combo / kill-streak counter: fast successive kills build a combo multiplier (×1.25 at 2 kills up to ×4 at 13+, 3 s window). Boss kills capped at ×2. SHARDs and VOLATILE chain kills excluded from building combo. HUD shows multiplier + count with colour tiers (cyan → yellow → orange → magenta). Ascending audio chirp on each increment. Milestone floating text at ×5/×10/×15/×20. Best combo shown on end screens. Reset per floor. SW cache v27 |
| v21.0   | Minimap POI markers: key locations (stairs/terminal, vendor, lore) get larger pulsing glow markers on the minimap drawn above tile and enemy layers. Stairs/terminal: white 3 px, vendor: green 3 px, lore: amber 2 px. Sealed boss entrances: red 4 px fast-pulse overlay. Player dot stays on top. Improves navigation on larger floors. SW cache v28 |
| v22.0   | Dash/dodge ability: Shift key (keyboard) or ⇧ touch button triggers a fast 0.12 s burst-dash at 18 tiles/sec (~5× walk speed) in movement/facing direction. 1.5 s cooldown, invulnerable during dash, wall collision ends early. Amber afterimage trail (8 ghosts, fade 0.25 s) + amber spark particles. `audio.dash()` whoosh SFX. HUD cooldown display (compact + landscape). Touch button added between E and V buttons with cooldown dim overlay. Control hints updated. SW cache v29 |
| v23.0   | Ambient particle system: environmental storytelling via 5 particle emitter types. DUST motes drift through lit rooms/corridors (white/cyan). EMBER sparks rise from plasma vents (orange). ZAP micro-flashes on active arc grids (blue-white). STEAM wisps from cracked walls when player is near (grey). WISP energy motes around sealed boss entrances (red glow). Separate `ambientParticles[]` array (cap 80), timer-gated spawning (0.08 s), soft fade-in/out, performance-budgeted (max 3 new/tick). Cleared on floor transitions. SW cache v30 |
| v24.0   | TELEPORTER enemy (floor 6+): spatial disruptor that blinks to random room positions every 2–3 s (floor-scaled), fires 2 quick ranged bursts after 0.4 s materialise, then relocates. Emergency blink if player within 2 tiles. Hot magenta (`#ff44ff`), rapid alpha flicker, fading afterimage at warp origin. `audio.teleport()` zwip SFX. Per-room cap: 1. Credits: 8. OVERCLOCK shortens cycle. SW cache v31 |
| v25.0   | Death recap & run statistics: all player damage attributed to named sources via `takeDamage(dmg, source)`. Game Over screen shows KILLED BY banner, colour-coded damage breakdown bars (top 3–4 sources with percentages), and run stats (enemies slain, shield blocks, time survived). Victory screen adds same run stats line. `SOURCE_LABELS`/`SOURCE_COLOURS` maps for friendly display. `Projectile.ownerType` tracks shooter. `player.damageLog`, `enemiesKilled`, `hitsBlocked` persisted in save. `game.runTime` accumulates across floors. `endRun()` snapshots `lastRunRecap` for stable rendering. SW cache v32 |
| v26.0   | Status effect indicators: three visual systems for active effect communication. (1) Low-HP danger vignette — red pulsing radial gradient at screen edges when HP ≤ 25%, severity-scaled intensity, heartbeat-synced pulse, drawn before HUD. (2) Floor modifier banner — 3 s animated pill sliding from top on floor entry, icon + name + description (compact: icon + label only), replaces `game.msg()` announcement, gated to new transitions (not save resume). (3) Status effect bar — row of compact badges above HUD showing active modifier, slow debuff, energy shield state, nano regen, dash cooldown/ready. Per-effect smooth alpha fade via `statusFx` keyed state. `game.modBannerTimer` ticked in `updatePlaying()`. SW cache v33 |
| v27.0   | Room-clear rewards: killing all enemies in a room grants bonus credits (`10 + floor × 5`, scaled by difficulty and meta credit multiplier), +50 × floor score, green particle burst at room center, floating "+N◆" text, and `audio.roomClear()` ascending triple chime. Detection runs only when an enemy dies (`game.enemyDiedThisFrame` flag set in `Enemy.die()`), placed after dead-enemy removal and pending-spawn flush in `updatePlaying()` so SPLITTER → SHARD sequences are handled correctly. `room._hadEnemies` flag set during `populateFloor()` (only when count > 0) and `revealSecretRoom()`. `game.clearedRooms` Set tracks rewarded rooms per floor (reset in `loadFloor()`). Multi-room clears in a single frame (e.g. VOLATILE chain) batched into one audio/message. `player.roomsCleared` stat tracked in save/load and shown on Game Over / Victory screens ("N cleared"). Boss room excluded (has own death sequence). Spawn room excluded (no enemies). SW cache v34 |
| v28.0   | Weapon affixes: random modifiers on weapons for loot variety and replayability. 5 prefixes (stat modifiers: Rapid, Heavy, Extended, Twin, Precise) and 5 suffixes (effects: Flame/burn, Frost/slow, Vampirism/leech, Thunder/chain, Detonation/explode). Floor-gated rarity: common (no affix, floor 1), uncommon (1 affix, floor 2+), rare (2 affixes, floor 4+). Affix eligibility filters prevent dead rolls (Precise on zero-spread, Twin/Extended on melee). Affixed weapons are unique cloned objects with `buildWeapon()`/`rollWeapon()` pattern. `applyHitEffects()` + `applyOnKill()` centralize proc logic with `isProc` guard against recursion. `tickEnemyStatusEffects()` handles burn DOT and slow decay per enemy per frame. Enemy class gains `burnTimer`, `burnDps`, `slowTimer`, `slowFactor`, `_lastHitCtx`. Visual: burn underglow, frost tint, chain lightning bolts (jagged yellow), rarity-coloured HUD weapon name + upgrade card borders. Save format: weapon stored as `{_base, _affixes}` object. SAVE_VERSION 8.0. SW cache v35 |
| v29.0   | Elite enemy affixes: each elite enemy (floor 3+) now spawns with one random affix that grants a special ability. 4 affixes: SHIELDED (energy shield absorbs damage, 40% max HP, regenerates 8/s after 2s), BERSERKER (speed + attack rate scale up to +50% as HP drops), REGENERATING (heals 2.5% maxHp/s), PHASING (1s invulnerable every 4s cycle). `ELITE_AFFIXES` table, `rollEliteAffix()` with eligibility filter (PHASING excluded from PHANTOM). `tickEliteAffix()` per-frame behaviour. `berserkerMul()` method on Enemy. Shield absorption in `takeDamage()` before HP. Phase immunity check at top of `takeDamage()`. Visual: affix-coloured diamond marker, affix-coloured glow, SHIELDED blue ring + separate shield bar, BERSERKER red aura intensifies, PHASING ghost flicker, REGENERATING green particles. Minimap: 3px affix-coloured dots for elites. SW cache v36 |
| v30.0   | Hackware system: collectible active abilities with cooldowns. 4 modules: EMP Burst (AoE stun 2s in 4-tile radius, LOS-gated, bosses 1s, 10s CD), Phase Cloak (2.5s invisibility + full damage immunity, enemies lose targeting, 14s CD), Nano Swarm (6 homing particles × 8 dmg each, 4s lifetime, 10s CD), Gravity Well (pull enemies within 5 tiles toward aim point for 3s, bosses immune, collision-aware, 16s CD). `HACKWARE` table, `activateHackware()`, `updateHackwareEffects()`, `drawHackwareEffects()`. Central `canTargetPlayer()` helper gates all enemy AI when player is cloaked. `isPlayerDamageImmune()` gates `player.takeDamage()`, plasma burn, arc zap, and projectile-player collisions for both dash and cloak. `Enemy.stunTimer` freezes AI + cooldown timers. F key + touch button (shown only when equipped). `makeHackwareOption()` for powerup choice (~12% on floor 3+). Vendor offers hackware (~40% on floor 3+). Status bar badges: hackware cooldown/ready + cloak active. HUD indicators in both compact and landscape layouts. Save/load: `player.hackware` + `player.hackwareCooldown` (no save version bump — defaults on old saves). `hackwareEffects[]` cleared in `populateFloor()`. 5 new audio SFX (EMP/Cloak/CloakEnd/Swarm/Gravity). SW cache v37 |
| v31.0   | Challenge rooms: optional wave-based arena encounters. One per non-boss floor (2–9). `T.CHALLENGE_GATE` tile (17) — passable red/amber archway. Room sealed on entry (same pattern as boss seal), 2–3 waves of enemies (floor-scaled, one level harder), inter-wave pause with HUD counter, guaranteed rewards on completion (2 items + credits + XP + score). Wave enemies tagged `_challengeWave` for independent tracking. Drone phase check respects challenge seal. EXTERMINATE quest accounts for pending waves. Room-clear rewards excluded during active encounter. Sealed walls get red tint + minimap pulse + ambient WISP particles. Proximity hint on approach. `audio.challengeWave()` two-tone alarm SFX. No save format change (challenge state resets on floor load). SW cache v38 |
| v32.0   | Perk choice system: deterministic perks replaced with choose-one-of-three at levels 2/4/6/8. 15-perk pool (`PERK_POOL`): 4 existing (Laser Sight, Threat Sense, Piercing Rounds, Energy Shield) + 11 new (Vampiric, Adrenaline, Rapid Fire, Critical Hit, Thick Armor, Berserker, Dash Master, Nano Repair, Explosive Kills, Multi-Shot, Second Wind). Auto-Laser capstone at level 10 unchanged. `PERK_CHOICE` game state with 3-card UI (keyboard 1/2/3, arrows+Enter, mouse/touch). `game.pendingPerkChoices[]` queue for multi-level jumps, rolled fresh per choice. `rollPerkChoices()` Fisher-Yates shuffle excluding owned. `applyPerk()` + `grantCapstone()` replace `checkPerkUnlocks()`. `player.effectiveAtk()` for Berserker scaling. Explosive Kills merges with VOLATILE modifier (shared AoE, perk-only doesn't hurt player). Multi-Shot spawns bonus 60%-damage projectile directly (no recursive shoot). Critical Hit rolled per projectile (`proj.isCrit`). Second Wind revives at 30% HP once per floor. Status badges for Berserker and Second Wind. Death recap shows chosen perks. `audio.perkChoice()` + `audio.secondWind()` SFX. SAVE_VERSION 9.0. SW cache v39 |
| v33.0   | Procedural ambient music system: 4-layer synthesised soundtrack via Web Audio. Drone (2 detuned sawtooths → lowpass → LFO), Pulse (sub kick + hi-hat), Arp (minor pentatonic square wave sequences, 70% probability), Bass (triangle root pulses). 5 music states: idle/explore/combat/boss/tension — crossfade transitions (1.5s). Floor-dependent tuning: C2→B♭1→A♭1→F1 root descent, 100→130 BPM acceleration. Combat/boss tempo boost. Separate music bus (gain 0.12 → dedicated compressor → destination) isolates from SFX dynamics. `music.tick()` in main loop with 250ms Web Audio lookahead scheduling. Cached noise buffer for hi-hats. Pause mutes + stops scheduling (no `AudioContext.suspend()`). Music state resolved per frame in `updatePlaying()`: boss > tension > combat > explore. `music.setFloor(n)` retunes drone via exponential ramp. `music.stop()` on endRun/menu. No save format change. SW cache v40 |
| v34.0   | Augment system: cybernetic implants with permanent passive effects. 12 augments (Neural Link, Titanium Plating, Magnetic Field, Thermal Optics, Adrenaline Injector, Overclocker, Echo Mapper, Credit Siphon, Scavenger Nanites, Kinetic Amplifier, Temporal Dilation, Reactive Armor). Max 3 per run. New `implant` room type (floors 2–9, ~50% spawn rate) with `T.IMPLANT_SHRINE` tile (18). `AUGMENT_CHOICE` game state with 2-card UI. Vendor sells augments (~20% on floor 3+). Capped players get credits at shrines. `AUGMENTS` table, `rollAugmentChoices()`, `makeAugmentShopOption()`, `hasAugment()` helper. Effect hooks: `gainXP()` (Neural Link ×1.25), `takeDamage()` (Titanium Plating −1, Reactive Armor pulse), item pickup (Magnetic Field ×2 radius), `drawMinimap()` (Thermal Optics + Echo Mapper), `Enemy.die()` (Adrenaline Injector speed buff, Scavenger Nanites heal, Credit Siphon ×1.5), `activateHackware()` (Overclocker ×0.7 CD), `Projectile` constructor (Kinetic Amplifier ×1.2 speed), `Enemy.moveToward()` (Temporal Dilation ×0.85). `player.augments` saved (no SAVE_VERSION bump — defaults to {} on old saves). Status badges for augment count, Adrenaline buff, Reactive cooldown. Death recap lists augments. 3 new audio SFX. SW cache v41 |
| v35.0   | Floor events: risk/reward encounter terminals offering binary choices. 8 event types: Stasis Pod (heal+XP / item), Corrupted Terminal (60% hackware 40% alarm / credits), Arms Cache (weapon reroll −HP / item), Radiation Leak (augment −HP / credits+score), Rogue AI (reveal minimap / trade credits for XP), Power Junction (stun+damage room enemies / heal 60%), Ghost Signal (credits+XP+score / combo boost), Emergency Drop (heal+item / hackware CD reset+credits). New `event` room type (floors 2–9, every non-boss floor). `T.EVENT_TERMINAL` tile (19) — pulsing teal terminal. `EVENT_CHOICE` game state with 2-card UI (keyboard 1/2, arrows+Enter, mouse/touch). `EVENTS` table, `rollEvent()` filters by player state (skips augment event at cap, bargain event if broke), `applyEventEffect()` executes outcomes. Choices include safe options (credits, items, score) and risky options (weapon reroll with trap damage, augment with HP cost, hackware with 40% enemy spawn). Event rooms excluded from lore placement. `player.eventsResolved` stat tracked in save/load and shown on Game Over/Victory screens. Credit Siphon augment synergy applies to credit rewards. Pending perk choices checked after event resolution (XP grants may trigger level-ups). 2 new audio SFX (`audio.eventTerminal()`, `audio.eventResolve()`). Minimap: teal 3px POI marker. No SAVE_VERSION bump — defaults on old saves. SW cache v42 |
| v36.0   | SNIPER enemy (floor 7+): glass-cannon marksman with laser-sight charging mechanic. 1.5s visible red laser line locks on player position (does NOT track), then fires speed-14 high-damage projectile. Room-gated aggro (only activates when player is inside sniper's room). Cancel conditions: cloak, LOS break, stun, player flees room, player closes to <3 tiles (triggers flee). Fixed charge time (unaffected by OVERCLOCK/berserker — telegraph stays fair). Post-fire reposition to far tile in room. Post-cancel cooldown prevents stutter re-lock. Stun clears charge state (handled in Enemy.update stun early-return). Elite excluded (ATK 15 too high for elite multiplier). Stats: HP 20, ATK 15, SPD 2.5, XP 25, credits 10, cap 1/room. Visual: hot pink-red `#ff2266`, idle scope glint, pulsing laser line + target dot during charge. 2 new audio SFX (`audio.sniperCharge()`, `audio.sniperFire()`). No SAVE_VERSION bump. SW cache v43 |
| v37.0   | WARDEN boss (floor 3 alternate): melee-focused armored enforcer with telegraphed charge + ground slam. Boss pool system — floor 3 randomly selects SENTINEL MK-I or WARDEN. Boss death message now keyed by `game.bossType` (stored at spawn) instead of floor number, fixing a latent bug where the `e` variable leaked from entrance-tile restoration loop. Stats: HP 330, ATK 16, SPD 1.8, XP 200, credits 80, colour `#ff8800` (amber). Phase 1 (>40% HP): 0.6s wind-up charge at 3× speed with amber dashed-line telegraph, contact damage + knockback on hit, 4-way spark burst on miss, 3.5s CD. Phase 2 (≤40%): faster charge (0.45s wind-up, 2.5s CD) + ground slam AoE (knockback + 22×diff damage + 6 radial sparks, 5s CD, `audio.wardenSlam()`). Charge direction locked at wind-up start (does NOT track). Cancel: cloak/LOS break cancels wind-up; stun cancels any charge state (in `Enemy.update()` stun block). Active charge continues through cloak (committed). Pursues player aggressively when LOS (vs SENTINEL's random patrol). `BOSS_POOLS` replaces `bossTypes` dict. 2 new audio SFX (`audio.wardenCharge()`, `audio.wardenSlam()`). No SAVE_VERSION bump. SW cache v44 |
| v38.0   | CONDUCTOR boss (floor 6 alternate): area-denial pattern boss with electromagnetic projectile patterns and hazard zones. Floor 6 randomly selects NEURAL HIVE or CONDUCTOR. No add spawning (direct contrast to HIVE's summoner archetype). Stats: HP 520, ATK 20, SPD 1.4, XP 350, credits 120, colour `#00ccff` (electric cyan). Phase 1 (>55%): 8-way radial arc burst (3.5s CD, rotation offset per volley) + 1 electric hazard zone (6s CD). Phase 2 (55%–25%): 12-way burst (3s) + 2 hazard zones (5s) + conduit beam (fast single shot, 4s). Phase 3 (≤25%): 12-way burst (2.5s) + 2 zones (4s) + discharge AoE (1.5s magnetic pull channel → 25×diff damage + knockback + 6 radial sparks, 5s CD). Hazard zones: 0.8s arming delay with pulsing dashed warning ring, 3-tile minimum distance from player, radius 1.5, 4s duration, `Conductor Field` damage source. Magnetic pull: 1.0 tiles/sec toward boss, passability-checked, room-clamped. Visual: rotating segmented arc ring, pulsing cyan glow during discharge channel. `hazardZones` system extended with `armTimer` (arming delay) and `source` (custom damage source) — backwards compatible. 2 new audio SFX (`audio.conductorArc()`, `audio.conductorPulse()`). No SAVE_VERSION bump. SW cache v45 |
| v39.0   | GENESIS PROTOCOL boss (floor 10 alternate): geometric precision pattern boss — spiral salvos, targeting lances, hazard grid zones, purge ring. Floor 10 randomly selects OMEGA CORE or GENESIS PROTOCOL. Stats: HP 1000, ATK 22, SPD 1.0, XP 800, credits 200, colour `#ffcc00` (gold). Phase 1 (>55%): 6-arm spiral salvo (3s, rotating offset) + targeting lance (4s, 0.5s telegraph, aim-locks at start, cancels on LOS/cloak/stun). Phase 2 (55%–25%): 8-arm spiral (2.5s) + 3-spread lance (3.5s) + 2 hazard zones (5s). Phase 3 (≤25%): 10-arm spiral (2s) + 5-spread lance (3s) + 3 zones (4s) + purge ring (8s, 6 zones in circle with 1 gap). Timer seeding on phase transition + spawn prevents first-frame spam. Dynamic terminal lock text replaces hardcoded OMEGA reference. `audio.genesisLance()` / `audio.genesisPurge()` SFX. No SAVE_VERSION bump. SW cache v46 |
| v40.0   | Settings menu: `SETTINGS` game state accessible from main menu and pause screen. SFX and music volume sliders (0–100%, `localStorage` key `neonDungeonSettings`). Key rebinding for 9 actions (up/down/left/right/interact/hackware/voidshard/dash/shoot) with swap-on-conflict, reserved key protection (Escape/Enter/Q/digits), and Escape-to-cancel capture. Arrow keys always work as movement alternates. `ShiftRight` always works as dash alternate. Touch buttons emit mapped key codes via `km(action)`. In-game hints reflect current bindings via `KEY_DISPLAY()`. Pause screen updated to 3 options (Resume/Settings/Quit). Volume applied at AudioContext init AND on change (handles lazy init). Short linear ramp (0.02s) on volume changes prevents zipper noise. Settings validated and merged with defaults on load. No SAVE_VERSION bump. SW cache v47 |
| v41.0   | Display toggles in settings: Screen Shake (ON/OFF) and Damage Numbers (ON/OFF). Both default ON. `triggerShake()` and `spawnDmgText()` gated by `settings.screenShake`/`settings.damageNumbers`. Toggles between volume sliders and key rebind section. ◀▶/Enter/click to toggle. `resetAll()` replaces `resetKeys()` — resets volumes, toggles, and key bindings. Boolean settings validated with `typeof` on load. Backward compatible: old payloads without toggle keys default to ON. No SAVE_VERSION bump. SW cache v48 |
| v42.0   | Static Field hackware (5th ability): electric zone-control module placed at aim position. 3-tile radius, 5s duration, 12s cooldown. Enemies inside take 10 dmg/s (1s hit interval, LOS required) and are slowed 40% (bosses: 15% slow). Slow uses stronger-wins logic (`Math.max`/`Math.min`) to not truncate existing effects. Max 1 field active — recasting replaces the old one. Visual: pulsing cyan ring with 3 rotating arc segments, white core spark, ambient spark particles. `audio.hackwareStaticField()` SFX. `hackwareEffects` per-enemy `hitMap` for damage intervals. Auto-included in vendor/pickup via `HACKWARE_KEYS`. No SAVE_VERSION bump. SW cache v49 |
| v43.0   | Expanded minimap overlay: Tab toggles full-screen modal map overlay during gameplay. Shows room layout with colour-coded tiles, room type icons (`ROOM_ICONS`), POI labels (`ROOM_LABEL_COLOURS`), enemy dots (live positions, bosses larger), and legend. Gameplay freezes while overlay is active. Touch: tap minimap corner to open, any tap to close. `game.mapExpanded` bool cleared in `setState()` + `loadFloor()`. `drawExpandedMinimap()` renders scaled dungeon with pan centering. ECHO_MAPPER dimmed tiles respected. Tab added to `RESERVED_KEYS`. SW cache v50 |
| v44.0   | Boss HUD bar: cinematic full-width health bar at top of screen during boss encounters. Shows boss display name (colour-matched), wide HP bar with ghost-trail damage animation (0.25×maxHp/s decay), phase threshold notch marks (white vertical lines at phase boundaries), HP text with phase indicator. `BOSS_NAMES` constant (promoted from local `bossNames`). `BOSS_PHASE_MARKS` table + `getBossPhaseMarks(boss)` handles both percentage-based (WARDEN/CONDUCTOR/OMEGA/GENESIS) and absolute-HP (SENTINEL/HIVE) thresholds. Slide-in animation via `easeOutCubic()`. `game.bossBarAnim` + `game.bossHpGhost` state, reset in `loadFloor()`. Replaces small overhead boss HP bar in `Enemy.draw()`. Drawn after minimap in render order. SW cache v51 |
| v45.0   | Visibility + traversal fixes: LOS-based player FOV now blocks through walls, closed/locked doors, and diagonal corner-peeking; `dungeon.visible` tracks current-frame visibility while `visited` remains fog-memory. Enemy/item/key world rendering is visibility-gated. Minimap/enlarged minimap enemy dots now require LOS (except THERMAL_OPTICS dim reveal). Projectile corner-cutting through touching wall corners blocked (including ricochet handling). Camera gains edge overscroll padding to keep player readable near minimap/touch occlusion at map boundaries. Locked-door keys are now floor-scoped passes (not consumed per door) and reset on fresh floor transitions. |
| v46.0   | Runtime decomposition for maintainability: the monolithic inline game script was split into ordered source files (`src/platform.js`, `src/content.js`, `src/entities.js`, `src/render.js`, `src/game.js`) loaded by `index.html`. Gameplay logic remains behavior-equivalent while enabling safer targeted edits and clearer ownership boundaries. Service worker pre-cache updated to include the new script assets; SW cache v52. |
| v47.0   | Audio quality upgrade: procedural soundtrack engine now uses state-specific harmonic progressions, recurring motifs, denser rhythm programming, richer drone voicing, and dynamic timbral automation across idle/explore/combat/tension/boss states. Key gameplay SFX were re-layered with improved envelopes, filter motion, stereo placement, and wet/dry spatial depth while preserving existing `audio.*` API method names and gameplay behavior. Service worker cache bumped to v53. |
| v47.1   | Audio comfort retune: reduced harshness and ear fatigue on repeated `audio.lowHealth()` pulses, heavy `audio.bossEnter()` stingers, and Railgun fire/impact transients by lowering peak gain, taming high-frequency crack layers, and reducing wet send on those cues while preserving event timing and API shape. Service worker cache bumped to v54. |
| v47.2   | Lore terminal readability UX fix: entering `READING` no longer immediately dismisses when interact is still held. Added `game.readingInteractArmed` gating so interact-to-close only activates after the interact key is released once, while Escape/Enter/tap still close immediately. Lore close hint is now binding-aware via `KEY_DISPLAY(km('interact'))`, so rebinding interact shows accurate instructions. This preserves responsive controls and prevents accidental lore skips. Service worker cache bumped to v55. |
| v47.3   | Hazard-zone fairness fix: ground AoE ticks (grenades and shared `hazardZones`) now respect `isPlayerDamageImmune()` in addition to `player.invincibleTimer`. Dash i-frames and Phase Cloak immunity now behave consistently against hazard ticks, matching projectile damage rules. Service worker cache bumped to v56. |
| v47.4   | Environmental hazard consistency fix: plasma burn and arc-grid zap now route through `player.takeDamage(..., opts)` with `ignoreDefense`, so they still bypass armor but no longer bypass Energy Shield and SECOND_WIND. Added optional damage flags (`ignoreDefense`, `ignoreInvincible`, `ignoreImmunity`, `ignoreShield`, `skipHitInvincible`, `skipHitEffects`, `skipReactiveArmor`) to preserve existing behavior where needed without duplicating death/perk logic. Service worker cache bumped to v57. |
| v47.5   | Energy Shield fairness tweak: shield-break now grants 0.5s invincibility (was 0.3s), matching normal post-hit i-frames so the defensive perk never makes players more vulnerable to rapid follow-up hits. Service worker cache bumped to v58. |
| v47.6   | Quest wording clarity: EXPLORE quest label changed from "Visit every room" to "Visit all visible rooms" to match actual completion logic (normal rooms + revealed secret rooms required, unrevealed secrets do not block completion). Service worker cache bumped to v59. |
| v48.0   | Volatile Cores: explosive power cells in normal rooms (floor 3+, 0–2 per room). Projectile impact primes a 0.55 s fuse; detonation deals `30 + floor × 3` AoE damage (2.2-tile radius, LOS-gated) to enemies AND player (risk/reward tactical element). Chain-react to nearby cores for cascading explosions. Grenade, VOLATILE, and EXPLOSIVE_KILLS explosions also prime cores in radius. `vcores[]` global, `createVCore()`, `primeVCoresInRadius()`, `detonateVCore()`, `updateVCores()`, `drawVCores()`. Minimap orange dots. Death recap source: 'Volatile Core'. `audio.corePrime()` + `audio.coreDetonate()` SFX. SW cache v60. |
| v49.0   | Sentry Drone: persistent upgrade (max level 3) — autonomous orbiting drones that auto-fire homing shots at nearby enemies. 2.0-tile orbit radius, 1.8 rad/s rotation. Each drone independently targets nearest visible enemy within 8 tiles (LOS-required, Phantom-aware) and fires homing projectile (8 dmg, speed 8, range 8, #00e5ff). Fire cooldown shared: 2.0 / 1.6 / 1.2 s. Visual: cyan diamond with bright core and outer glow. `audio.sentryFire()` SFX (soft ascending chirp). Added to UPGRADES pool (rarity 7). Death recap: 'Sentry Drone' source with #00e5ff colour. SW cache v61. |
| v50.0   | Status effects: player debuffs + VOLTAIC weapon affix. (1) CRAWLER melee inflicts burn (2 s, floor-scaling DPS, orange underglow + fire particles, routed through `takeDamage` — respects SECOND_WIND). (2) SNIPER projectile inflicts shock (0.4 s movement suppress, yellow flash + sparks, aiming/shooting/dash still work). (3) Both debuffs gated on successful damage — blocked/evaded hits don't apply. (4) New weapon suffix "of Storms" (VOLTAIC): stuns enemies 0.6 s (0.3 s bosses) with 2 s per-enemy ICD preventing perma-stun. (5) `Player.takeDamage()` now returns actual damage dealt (0 if blocked) for conditional status application. (6) Status bar badges: 🔥 BURN, ⚡ SHOCK. (7) Player visual indicators: burn orange glow, shock yellow flash. (8) `audio.playerBurn()`, `audio.playerShock()`, `audio.voltaicHit()` SFX. (9) Debuffs clear on floor transition. SW cache v62. |
| v51.0   | Teleport pads: linked inter-room fast travel. 1–2 pairs of warp pads per non-boss floor (floor 3+), placed in distant rooms (Manhattan ≥ 15). Press E to warp to paired pad. 3 s cooldown, 0.3 s arrival invincibility. Blocked when source/destination is in sealed boss/challenge room. `T.TELEPORT_PAD` (20) tile. Violet pulsing `⬡` glyph, spark particles on use. Minimap: violet 3 px POI + expanded "WARP" label. `audio.teleportPad()` ascending warp SFX. `dungeon.teleportPads` in floor gen return. No save format change. SW cache v63. |
| v52.0   | Bounty targets: one enemy per non-boss floor (2+) designated as high-value bounty with 2× HP, 1.5× ATK, gold aura + crown marker, always-visible HP bar with "BOUNTY" label. Reveal SFX + "BOUNTY TARGET SPOTTED" message on first LOS contact. Kill rewards: `30 + floor × 8` credits (Credit Siphon applies), `150 × floor` score, guaranteed bonus item drop, gold explosion particles + camera shake. New BOUNTY quest type ("Eliminate the bounty target", reward: XP + 40 CR). Minimap: gold 4 px pulsing dot (regular), gold boss-sized dot (expanded). HUD: `⊕ BOUNTY` pulsing indicator while alive. `player.bountiesCollected` stat in save/load + Game Over/Victory screens. Bounty targets exclude elite + boss + shard enemies. `audio.bountyReveal()` (ominous brass stab), `audio.bountyKill()` (triumphant C major arpeggio). SW cache v64. |
| v53.0   | Two new floor modifiers (pool of 6→8): CORROSIVE ☣ (toxic atmosphere — all player damage taken +2 flat after DEF; kill credits ×1.5 stacking with Credit Siphon) and CHARGED ⊕ (supercharged projectiles — all projectile speeds ×1.4, player projectile damage ×1.2 including sentry drone and plasma orb). CORROSIVE creates an economic risk/reward tradeoff: more fragile but richer. CHARGED creates a faster, twitchier combat feel where accuracy matters more. No new game states, audio, tiles, or save format changes. SW cache v65. |
| v54.0   | SUMMONER enemy (floor 6+): support spawner that stays at range and periodically summons DRONE minions (max 3 active). `_summons[]` tracks refs; cascade despawn on summoner death via `_despawning` flag. Summoned minions yield 0 XP/credits/drops. Orphan guard in `pendingEnemySpawns` flush. `audio.summon()` SFX. TYPE_CAPS: 1. No elite roll. SW cache v66. |
| v55.0   | HEALER enemy (floor 5+): support healer that restores wounded non-boss allies within 6 tiles for 15% maxHp per pulse. `_healTimer`/`_healBeam` state. Retreats if player closes within 4 tiles. `audio.heal()` SFX. TYPE_CAPS: 1. No elite roll. SW cache v67. |
| v56.0   | CHARGER enemy (floor 4+): charge-attack melee rusher. Patrols slowly (SPD 1.5), telegraphs charge with 0.6 s windup (pulsing orange glow + direction indicator), then rushes at 5.5 tiles/s in locked direction for 0.4 s (~2.2-tile lunge). On hit: 1.5× ATK + 2-tile knockback + camera shake. On miss/wall: 1.0 s stun (reuses `stunTimer`), vulnerable. Point-blank (< 2 tiles) uses standard melee instead. `_chgState` (idle/windup/charging), `_chgCooldown` timer. `audio.chargerWindup()` (rising rumble), `audio.chargerImpact()` (heavy thud). Daze star particles on post-charge stun. TYPE_CAPS: 2. Elite eligible. SW cache v68. |
| v57.0   | Destructible crates: environmental cover objects (floor 2+, 0–2 per normal room ≥ 6×6). `T.CRATE` (21) tile — not passable, not see-through (full cover). `crates[]` entity array with HP (`15 + floor × 5`). Damaged by projectile impact, VCore/grenade/VOLATILE/EXPLOSIVE_KILLS explosions, weapon affix AoE, and CHARGER charge collisions. On destruction: tile reverts to `T.FLOOR`, 25% credit drop (`floor × 4`). Enemy/item spawn passability guard. Minimap: `#2a3a4e`. `audio.crateBreak()` metallic crunch SFX. Spec v3.7. SW cache v69. |
| v58.0   | Alarm beacons: environmental alarm devices (floor 4+, ~40% chance per normal room ≥ 5×5). `beacons[]` entity array with HP (`10 + floor × 3`). When player enters room, 4 s countdown starts. Destroy beacon → credit reward (`floor × 3` with multipliers). Countdown expires → 2–3 reinforcement enemies spawn. Damaged by player projectiles and AoE explosions (VCore/grenade/VOLATILE/EXPLOSIVE_KILLS/Detonation affix). Enemy projectiles cannot damage beacons. Room-clear blocked until beacon resolved. Visual: pulsing red diamond + antenna (idle), flashing diamond + expanding rings + countdown (active). Minimap: pulsing red dot. `audio.beaconAlarm()`, `audio.beaconDestroy()`, `audio.beaconTrigger()` SFX. Spec v3.8. SW cache v70. |
| v59.0   | Proximity mines: hidden explosive traps (floor 3+, ~40% chance per normal room ≥ 5×5, 0–1 per room). `mines[]` entity array. Dormant: subtle shimmer, revealed permanently when player within 3 tiles. Armed when player/enemy within 0.9 tiles (0.8 s fuse) or shot by player projectile (0.3 s fuse). Detonation: 2-tile AoE (12 + floor × 3 dmg, bypasses defense, LOS-gated). Damages player and enemies. Chain-detonates nearby mines (staggered 0.1–0.15 s). Also triggered by VCore/grenade/VOLATILE/EXPLOSIVE_KILLS/Detonation AoE. Mine explosions prime VCores, damage crates/beacons. Enemy projectiles don't trigger mines. Minimap: hidden when dormant, orange dot when revealed/armed. `audio.mineArm()` (click + ascending tone), `audio.mineExplode()` (concussive blast). Spec v3.9. SW cache v71. |
| v60.0   | PHANTOM enemy rework (floor 5+): stealth assassin with 4-state machine (cloaked→telegraph→attacking→cooldown). Cloaked: alpha 0.08, 1.3× speed, subtle shimmer, repositions in room on re-cloak. Telegraph: 0.4 s warning with expanding purple ring + aim indicator, alpha pulsing 0.3–0.5. Attacking: 2-shot purple burst (0.15 s gap, speed 8, range 14). Cooldown: 1.5 s visible retreat window. Damage interrupt: hit while cloaked/telegraph → forced to cooldown (1.5 s reveal). Close-range escape: repositions if player < 2.5 tiles while cloaked. Thermal Optics augment: dim purple pulsing minimap dot when cloaked. Sentry/Auto-Laser skip cloaked, can target telegraph+. Mines trigger normally on cloaked phantoms. Stats: HP 35, ATK 10, SPD 2.5, XP 30, credits 12. Spawn weight: base 2, perFloor 2, minFloor 5. TYPE_CAPS: 2. Elite eligible (PHASING excluded). `audio.phantomCloak()` (descending fade), `audio.phantomUncloak()` (ascending reveal), `audio.phantomStrike()` (energy bolt). Spec v4.0. SW cache v72. |
| v61.0   | MIMIC enemy (floor 7+): ambush predator disguised as data pickup. 50% per non-boss floor. Disguised: renders as random-colour item with bob + glow, subtle white shimmer tell every ~2.5 s. Hidden from minimap, sentry/auto-laser, room-clear. Revealed by: player proximity (1.5 tiles) or any damage source (projectiles, AoE, mines, VCores, Static Field, Reactive Armor). 0.3 s reveal telegraph (purple burst ring + particles + `audio.mimicReveal()`). Combat: fast melee zigzag chase (SPD 3.0 burst for 3 s → 2.2 base, CRAWLER pattern). Guaranteed single item drop on death (suppresses normal drop roll). Excluded from bounty, ENEMY_WEIGHTS, elite rolls, challenge waves. EMP/Gravity skip disguised; Nano Swarm skips homing but proximity hits reveal. Stats: HP 30 + floor×3 (scaled), ATK 14, SPD 2.2, XP 25, credits 10. Colour: `#cc33ff` (violet). Separate spawn pass in `populateFloor` (normal rooms, area ≥ 16). Spec v4.1. SW cache v73. |
| v62.0   | Shield Generators: destructible environmental devices (floor 5+, ~30% chance per normal room with ≥ 3 enemies, area ≥ 5×5). `shieldGens[]` entity array with HP (`15 + floor × 4`). Projects 35% damage reduction to all non-boss, non-disguised enemies in the same room while active (`SHIELD_GEN_DR`, spatial bounds check). Damaged by player projectiles, AoE explosions (VCore/grenade/mine/VOLATILE/EXPLOSIVE_KILLS/Detonation), hackware EMP (15 dmg), and Static Field (per-tick). Never in beacon rooms (prevents mitigation stacking). On destruction: 3-tile EMP burst stuns enemies 0.8 s (LOS-gated), credit reward (`floor × 5` with multipliers), cyan explosion particles. Protected enemies get subtle cyan underglow. Visual: rotating cyan hexagonal frame with bright core, dashed energy beams to protected enemies. Minimap: cyan 2 px pulsing dot. Room-clear NOT blocked by generators. `audio.generatorDestroy()` electric overload burst SFX. Spec v4.2. SW cache v74. |
| v63.0   | Security Cameras: wall-mounted surveillance devices (floor 4+, ~30% chance per normal room ≥ 6×6, not in beacon rooms). `cameras[]` entity array. 60° vision cone, ±60° sweep at 45°/s, 5-tile range. States: scanning→alerted(1.5s)→triggered. Detection: room bounds + cone sector + LOS + `canTargetPlayer()`. Destroy: credits + room-clear re-eval. Alerted blocks room-clear. 0.5 s rearm debounce. Cone raycast-clipped in draw. Damaged by projectiles, EMP (15 dmg), Static Field (per-tick). `audio.cameraDetect()`, `audio.cameraAlert()`, `audio.cameraDestroy()` SFX. Spec v4.2. SW cache v75. |
| v64.0   | Laser Tripwires: wall-mounted emitter pairs projecting destructible laser beams across rooms (floor 3+, ~25% chance per normal room ≥ 5 tiles wide/tall, mutually exclusive with cameras/beacons). `lasers[]` entity array. Independent emitter HP (`10 + floor × 3`) — destroying either disables beam. ~20% cycle on/off (1.5 s each, 0.2 s rearm grace). Beam crossing: segment intersection + 0.25-tile proximity, deals `8 + floor × 2` damage + 0.3 s shock (shockTimer). 2 s hit cooldown. Dash bypasses, Phase Cloak bypasses (canTargetPlayer). Crates dynamically block beam (per-frame LOS). EMP disables 3 s. Static Field damages emitters (1 s interval, object-ref Map keys). Does NOT block room-clear. Minimap: thin red/orange line. `audio.laserHit()`, `audio.laserDisable()`, `audio.laserDestroy()` SFX. Spec v4.3. SW cache v76. |
| v65.0   | LEAPER enemy (floor 5+): jumping shockwave attacker with 4-state machine (idle→windup→airborne→recovery). Windup: 0.5 s telegraph. Airborne: 0.35 s jump to player position. Landing: 2-tile AoE (LOS-gated, ATK×1.2). Recovery: 1 s vulnerable window. One airborne per room. Airborne/recovery continue during stun. Proper env damage helpers. Stats: HP 30, ATK 11, SPD 3.0, XP 22. TYPE_CAPS: 2. Elite eligible. `audio.leaperWindup()`, `audio.leaperLand()`. Spec v4.4. SW cache v77. |
| v66.0   | Toxic Pools: corrosive environmental hazard tiles (floor 3+, `T.TOXIC:22`). Clusters of 2–4 green tiles placed in ~30% of normal rooms. Deal `(2 + floor × 0.5) HP/s` to both player AND enemies (bosses immune). 30% movement slow on player and enemies while in pool (bosses immune to slow). Dash/Phase Cloak grants immunity. Disguised mimics excluded from damage. Enemy damage uses 0.5 s interval with `isProc: true` to prevent weapon affix procs. Death recap source: `Toxic Pool` (#33ff00). `audio.toxicBurn()` low gurgling SFX. Spec v4.5. SW cache v78. |
| v67.0   | Wall Turrets: hackable wall-mounted auto-turrets (floor 5+). `wallTurrets[]` entity array. 1–2 per ~25% of qualifying rooms (≥6×6, mutually exclusive with cameras). Hostile: fire at player every 1.8s (6-tile range, `5 + floor × 1.5` dmg). EMP Burst **hacks** turrets (converts hostile→allied, permanent). Hacked: target nearest enemy in room (7-tile range, 1.5s cooldown), fire `isAllyTurret` projectiles (no player augments/perks). Hostile turrets block room-clear; hacked do not. HP: `12 + floor × 3`. Damaged by player projectiles, all AoE, Static Field. Enemy projectiles damage hacked turrets. Death recap source: `Wall Turret`. `audio.turretFire/turretHack/turretDestroy()`. Spec v4.6. SW cache v79. |
| v68.0   | REFLECTOR enemy (floor 7+): tactical mid-range enemy with 90° reflective energy shield that bounces player projectiles back at them. Shield tracks player with 0.33 s lag (3 rad/s smooth lerp). Reflected projectiles: velocity reversed, `fromPlayer=false`, 60% damage, ricochet/homing cleared, `travelled` reset. Piercing projectiles reflected (unlike SHIELDER which piercing bypasses). Ally turret shots blocked (not reflected). Shield persists during stun (stops tracking). AI: holds position 4–10 tiles, retreats < 4, fires every 2.5 s. Stats: HP 40, ATK 10, SPD 1.8, XP 28, credits 12. Colour: `#88ddff`. `reflectsProjectile()` + extended `blocksProjectile()`. Visual: cyan arc + white mirror highlight + segmented edge ticks. `audio.reflect()` crystalline ping. TYPE_CAPS: 1. Elite eligible. Spawn weight: base 1, perFloor 2, minFloor 7. Spec v4.7. SW cache v80. |
| v69.0   | DISRUPTOR enemy (floor 6+): area-denial specialist deploying persistent electromagnetic interference fields. AI maintains 5–9 tile range, retreats < 4, deploys 2-tile radius fields every 4 s near player (validated passable tile, ±0.75 offset), secondary ranged attack every 2.5 s. Fields: 5 s duration, `(3 + floor × 0.5) × envDmg` DPS at 0.5 s interval (ignoreDefense, ignoreInvincible), hackware cooldown frozen, 20% movement slow. Non-stacking debuffs (binary flag). Dash/Phase Cloak immune. Max 2 fields per disruptor; oldest replaced at cap. Fields persist after disruptor death. EMP destroys fields in radius. `disruptionFields[]` global array, `updateDisruptionFields()`, `drawDisruptionFields()`. Stats: HP 30, ATK 9, SPD 2.0, XP 25, credits 10. Colour: `#ff44aa`. Status badge: `⊘ DISRUPTED`. Minimap: magenta pulsing dot. `audio.disruptorDeploy()` (descending warble), `audio.disruptorField()` (static crackle). TYPE_CAPS: 1. Elite eligible. Spawn weight: base 1, perFloor 2, minFloor 6. Spec v4.8. SW cache v81. |
| v70.0   | WRAITH enemy (floor 8+): ethereal wall-phasing predator with 4-state machine (`_wrState`). `phased` (2–3 s): moves through walls ignoring `isPassable()`, speed ×1.2, untargetable, immune to all damage (`_wrPhased` flag → `takeDamage()` early return, projectile/AoE/targeting skips). `emerging` (0.5 s): telegraph at passable tile near player (1.2–3.5 range, `_wrFindEmergeTile()` 20-attempt search + fallbacks). `corporeal` (2–3 s): normal combat, ranged attack every 1.5 s, damage extends timer (+0.3 s/hit, 0.5 s ICD, cap 3 s). `fading` (0.4 s): phase-out telegraph, still damageable. EMP hard counter: bypasses LOS, forces materialization + 2 s stun. Stun forces corporeal. Burn ticks suppressed while phased. Chain lightning/saw blade/nano swarm/gravity/static field skip phased. Room clear blocked by phased WRAITHs. Minimap: hidden unless Thermal Optics (dim spectral dot). Visual: alpha 0.1 (phased)→0.85 (corporeal), emerging glow ring, fading dashed ring. Emerging bypasses FOV gating. Stats: HP 35, ATK 13, SPD 2.8, XP 30, credits 12. Colour: `#66ffcc`. `audio.wraithPhaseOut()` (descending whoosh), `audio.wraithPhaseIn()` (ascending whoosh + crackle). TYPE_CAPS: 1. Elite eligible. Spawn weight: base 1, perFloor 2, minFloor 8. Spec v4.9. SW cache v82. |
| v71.0   | NEXUS enemy (floor 9+): neural command node that links to nearby allies granting 25% DR. AI: HEALER-like retreat pattern (4–10 tile range), fires teal projectiles (speed 6, range 12), fire rate scales with link count (2.0 s → 1.0 s with 3 links). Neural links: up to 3 allies within 5 tiles (same room, break at 7), 0.5 s update interval. Cannot link: bosses, other NEXi, phased WRAITHs, disguised MIMICs, invisible PHANTOMs. DR applied in `takeDamage()` after Shield Gen DR (multiplicative). Stun breaks all links; re-form after stun ends. Retreat targets nearest ally cluster to maintain links. Death neural feedback: stun all linked enemies 1.5 s + deal `10 + floor × 2` damage (via `takeDamage('Neural Feedback')`), teal explosion + screen shake. `_nxLinks[]` array, `_nxBoosted` flag on linked enemies, `_nxUpdateLinks()` + `_nxFindAllyCluster()` helpers. Stats: HP 40, ATK 8, SPD 1.8, XP 35, credits 12. Colour: `#00eedd` (teal). Visual: dashed orbital ring + inner diamond, animated teal dashed beam links with glow on linked enemies. `audio.nexusLink()` electronic buzz, `audio.nexusDeath()` electromagnetic feedback pulse. TYPE_CAPS: 1. Elite eligible. Spawn weight: base 1, perFloor 2, minFloor 9. Spec v5.0. SW cache v83. |
| v72.0   | SIPHON enemy (floor 8+): life-draining predator that heals from damage dealt to the player. AI: mid-range kiter (4–9 tile range), retreats < 4, fires crimson drain projectiles (speed 7, range 12, 2.0 s interval). Life steal: 50% of actual damage dealt heals SIPHON (tracked via `_owner` ref on projectile, added to `fireAt()`). Frenzy mode: permanently latched at < 40% HP — cooldown halved (1.0 s), life steal 75%. `dealt === 0` or dead owner → no heal. Visual: crimson aura (pulsing, frenzy intensifies + heartbeat inner glow), 0.3 s drain beam from player to SIPHON + green heal particles on successful drain. Elite ineligible (life steal + REGENERATING = runaway sustain). Stats: HP 30, ATK 10, SPD 2.2, XP 28, credits 10. Colour: `#dd2244` (crimson). `audio.siphonDrain()` vampiric tone, `audio.siphonFrenzy()` bass activation. TYPE_CAPS: 1. Spawn weight: base 1, perFloor 2, minFloor 8. Spec v5.1. SW cache v84. |
| v73.0   | GRAVITON enemy (floor 7+): gravity manipulation controller that deploys gravity wells pulling the player out of safe positions. AI: mid-range controller (5–10 tile range), retreats < 5, deploys gravity well near player every 5 s (validated passable tile, ±1.0 offset), secondary ranged projectile every 3 s (speed 6, range 10). Gravity wells: `gravityWells[]` global array, 2.5-tile attraction radius, 2.0 tiles/s pull toward center (player base speed 3.5 — escapable but taxing), 4 s duration. Total pull capped at 2.5 tiles/s regardless of well count (prevents escape-proof stacking from 2 overlapping wells). Max 2 active wells per GRAVITON; oldest replaced at cap. Room-bounded (player must be inside well's room to be pulled). Dash immune (pull skipped during `dashTimer > 0`). Shock immune (pull skipped during `shockTimer > 0` — player already helpless). Phase Cloak does NOT protect (gravitational, not targeting). Wells collapse on owner death (unlike DISRUPTOR fields which persist) — gives clear "kill the source" counterplay. EMP destroys wells in radius + collapse audio. Per-axis wall collision on pull displacement (prevents wall-phasing). Does not affect enemies. `updateGravityWells()`, `drawGravityWells()`. Visual: concentric inward-pulsing rings with violet radial gradient, centre core glow; GRAVITON body has orbiting 3-particle ring + violet aura + inner gravity symbol. Stats: HP 45, ATK 8, SPD 1.5, XP 30, credits 12. Colour: `#8833ff` (deep violet). `audio.gravitonDeploy()` bass whomp, `audio.gravitonPull()` low gravitational hum (one-shot on well entry), `audio.gravitonCollapse()` reverse whomp. TYPE_CAPS: 1. Elite eligible. Spawn weight: base 1, perFloor 2, minFloor 7. Spec v5.2. SW cache v85. |
| v73.1   | Mobile viewport & iOS freeze fix: CSS `100dvh` with `100vh` fallback prevents canvas rendering under mobile browser chrome (address bar, navigation buttons). JS `resize()` uses `canvas.getBoundingClientRect()` for accurate viewport measurement. `visualViewport` resize listener catches dynamic toolbar changes. Game loop wrapped in `try/finally` so `requestAnimationFrame` chain never breaks. `music.tick()` isolated in `try/catch` — audio errors don't kill gameplay. `music.tick()` early-returns when `AudioContext.state !== 'running'` (iOS `interrupted` guard). `audio.resume()` widened from `=== 'suspended'` to `!== 'running'` with promise rejection handling. `visibilitychange` auto-pauses from `PLAYING` state and resumes AudioContext. `pageshow` (bfcache) backup. `audio.isRunning()` helper. Spec v5.2. SW cache v86. |
| v74.0   | Visual brightness, zoom, and chiptune music retuning: TILE 20→26 (30% zoom-in), floor base colour `#181832`→`#252545`, wall base colour `#262648`→`#3a3a68`, wall highlight `#3a3a72`→`#5555a0`, min lit brightness 20%→32%, fog brightness 12%→20%. Music: BPM 112–136, brighter high-pass filters, denser arp/bass motifs, music bus 0.12→0.20, drone layer gains reduced. Spec v5.3. SW cache v87. |
| v74.1   | Further brightness/zoom/readability overhaul: TILE 26→32 (60% total zoom from original), min lit brightness 32%→55%, fog brightness 20%→35%, floor `#252545`, walls `#3a3a6a`/`#5858a0`, floor detail `#303058`. Event messages: 13→16 px bold with dark background pill for contrast. HUD landscape fonts: 11→13 px. Tile icon fonts scaled to 16–18 px. Floating damage text: 12→15 px. Entity labels (BOUNTY, hazards): +2 px each. Hint text: 13→15 px. Spec v5.3. SW cache v88. |
| v89.0   | Gameplay balance overhaul: **Boss HP +33–40%**: SENTINEL 300→400, WARDEN 330→450, HIVE 500→650, CONDUCTOR 520→700, OMEGA/GENESIS 1000→1300. **New boss attacks**: SENTINEL tracking shot (aimed projectile at player, both phases, 4s/2.5s CD), WARDEN radial stomp (close-range burst, 4–6 projectiles, 6s/4s CD), HIVE swarm cloud (slow aimed spread, 3–5 projectiles, 5s/3.5s CD). All boss phase thresholds confirmed percentage-based (`hpPct = hp/maxHp`). **Difficulty rebalance**: HARD enemyHp ×1.25→×1.5, enemyAtk ×1.15→×1.3, enemySpd ×1.05→×1.1, envDmg ×1.15→×1.25, eliteRate 12%→18%; NORMAL itemDrop 20%→15%, eliteRate 8%→10%; EASY itemDrop 28%→25%. New `roomLoot` property caps per-room item spawns (EASY:2, NORMAL/HARD:1). **Secret rooms**: floor restriction removed (was floor 3+, now all non-boss floors). Secret loot scales: 1 item floors 1–3, 2 items floors 4–6, 2–3 items floors 7+. **Mobile F button**: always visible (dimmed when no hackware equipped), eliminates dead touch zone. Spec v5.4. SW cache v89. |
| v90.0   | SEEKER enemy (floor 3+): kamikaze explosive drone that rushes toward the player and detonates on contact. AI: direct pursuit at full speed (SPD 3.5), detonates when within 1.2 tiles of player. Detonation: 2-tile AoE, ATK × 1.5 damage, LOS-gated. Damages player (unless dashing via `dashTimer > 0`) AND other enemies (skips phased WRAITHs). Chains to env entities: primes volatile cores, damages crates/beacons/shield gens/cameras/lasers/wall turrets, triggers mines. Clean kill (shot before reaching player): no explosion — normal death path only. Self-destruct: `_seekerDetonate()` applies AoE then calls `die()` for standard death rewards (XP/credits/drops/VOLATILE chain). Interaction with VOLATILE modifier: detonation AoE + VOLATILE explosion = double danger (intentional). Trail particles ramp with proximity (6 + proximity × 12 per-sec). Visual: pulsing yellow glow that intensifies within 6 tiles, pulse rate increases with proximity. `_skProximity` tracks 0→1 scalar for draw. `audio.seekerDetonate()` sharp crack + bass thump. Elite ineligible (too fragile/fast to benefit from affixes). Stats: HP 18, ATK 12, SPD 3.5, XP 12, credits 5. Colour: `#ffdd00` (bright yellow). TYPE_CAPS: 3. Spawn weight: base 2, perFloor 3, minFloor 3. Spec v5.5. SW cache v90. |
| v91.0   | NIGHTMARE difficulty tier: endgame challenge mode. enemyHp ×2.0, enemyAtk ×1.6, enemySpd ×1.2, itemDrop 8%, creditMul ×0.85, xpMul ×1.35, eliteRate 28%, shardMul ×1.8, envDmg ×1.5, roomLoot 0. Colour `#9400ff` (violet). Added to `DIFF_ORDER` and `DIFFICULTIES` object. Spec v5.5. SW cache v91. |
| v92.0   | NIGHTMARE unlock gate: NIGHTMARE difficulty locked until player achieves victory on HARD. Tracked via `neonDungeonMeta.clearedDifficulties[]` array (persisted in localStorage). `isDiffUnlocked()` checks `DIFF_UNLOCK_REQS` map — extensible for future gated difficulties. Menu: locked difficulty shows `[LOCKED]` suffix with dimmed colour (`#444466`); attempting to start displays "CLEAR HARD TO UNLOCK NIGHTMARE" message (2.5 s fade). Victory screen: pulsing `★ NIGHTMARE UNLOCKED ★` celebration when HARD cleared for first time (`_newlyUnlocked` flag set in `endRun()`). EASY/NORMAL/HARD always available. Backward-compatible: existing saves without `clearedDifficulties` default to empty array. Spec v5.6. SW cache v92. |
| v93.0   | Two new elite affixes expanding the pool from 4 to 6: **VOLATILE** (`#ff6600`, 💥) — explodes on death with 2-tile AoE dealing ATK×1.5 damage (LOS-gated). Damages player (dash immune), enemies (skip phased WRAITHs), and all environmental entities (vcores, crates, beacons, shield gens, cameras, lasers, wall turrets, mines). Pulsing orange ring + intermittent particles as visual warning. Not rolled on SEEKERs. `audio.eliteVolatile()`. **FRENZY** (`#ff4466`, 🔥) — gains frenzy stack when any enemy dies within 4 tiles (max 2 stacks). Each stack grants +40% speed/attack rate via `berserkerMul()` (0 stacks = normal, 1 = ×1.4, 2 = ×1.8). `notifyFrenzyElites(x, y)` called in `die()`. Red-orange aura intensifies per stack. `audio.eliteFrenzy()`. Creates kill-order tactical decisions — especially impactful on NIGHTMARE (28% elite rate). `rollEliteAffix()` updated with eligibility filters. `frenzyStacks` added to Enemy class. Spec v5.7. SW cache v93. |
| v94.0   | PULSER enemy (floor 2+): electromagnetic charge-up attacker that teaches early-game players to read telegraphs and exploit cooldown windows. 3-state AI: `idle` (patrol/approach at SPD 1.5) → `charging` (1 s visible charge-up with concentric rings + directional aim line, tracks player, cancels if LOS lost or range exceeded with 0.8 s cooldown) → fire heavy bolt (speed 10, range 14, full ATK) → `cooldown` (2.5 s retreat at half speed, axis-by-axis wall-safe). Projectile created manually (not `fireAt()`) to avoid double audio. `ownerType = 'Pulser Bolt'`. Visual: 2 concentric pulsing rings grow during charge + dashed aim line (3 tiles); idle subtle core glow. `audio.pulserCharge()` rising electrical whine, `audio.pulserFire()` sharp crack. Elite ineligible (early-game teaching enemy). Stats: HP 20, ATK 12, SPD 1.5, XP 15, credits 7. Colour: `#44ddff` (electric blue). TYPE_CAPS: 2. Spawn weight: base 5, perFloor 1, minFloor 2. Spec v5.8. SW cache v94. |
| v95.0   | Dead-end corridor pruning + spawn→stairs reachability guarantee. Iterative dead-end pruning uses `connects()` predicate (`t !== WALL && t !== VOID`) so doors/locked doors count as connectivity. Rescue corridor only overwrites WALL/VOID tiles (preserves secret rooms, locked doors, challenge room entrances). BFS from spawn tile to stairs tile validates reachability; if unreachable, carves a minimal L-shaped rescue corridor. Both run after secret rooms, locked doors, and challenge rooms modify entrances. Spec v5.8. SW cache v95. |
| v96.0   | Pause screen mouse + keyboard navigation: desktop users can now hover and click the 3 pause menu options (Resume/Settings/Quit) instead of relying on keyboard shortcuts alone. Arrow up/down + Enter also work. Hovered option highlights with colour-matched glow (cyan/amber/red). `_pauseSel` tracks selection, reset on entering `PAUSED` state. Touch input unchanged (zone-based taps). No SAVE_VERSION bump. SW cache v96. |
| v97.0   | HOLO DECOY hackware (6th module): holographic taunt decoy deployed at aim position. 12s cooldown, 4s duration. Taunts non-boss enemies within 5 tiles (LOS to acquire, 7-tile break range) via per-enemy `_tauntTarget`+`_tx/_ty` target redirection in `Enemy.update()`. All 24 non-boss AI functions patched to use `this._tx/this._ty` for movement, firing, aiming, and retreat; `canTargetPlayer()` → `this._canTarget()` (taunt-aware). Damage delivery paths (CHARGER charge hit, LEAPER shockwave, SEEKER detonation) use real `player.x/player.y` — enemies are fooled about position but can't damage what isn't there. `meleeAttack()` adds real-distance guard (> 1.2 tiles → whiff). Exclusions: bosses immune, disguised mimics and phased wraiths can't acquire taunt. Wraiths taunted while corporeal keep taunt through phasing. On expiry: 0.5s mini-stun within 2 tiles, all taunt refs cleared. Max 1 active hologram; recast removes previous + clears refs. Visual: flickering magenta hexagon with scanline + ambient particles. Status badge `⬡` with countdown. `audio.holoDecoyDeploy()` holographic shimmer, `audio.holoDecoyExpire()` shatter. `_wrFindEmergeTile()` and `_phReposition()` updated to use perceived target. Colour `#ff44ff`. Icon ⬡. Spec v5.9. SW cache v97. |
| v109.0  | ARCHIVE terminal (UNCHAINED #41): predecessor-log fragments recoverable from rare terminals. 30 authored logs across 6 AXIOM predecessors (each with a 5-entry arc), biome-gated via new `src/data/logs.js` data table. `CORRUPTED_TERMINAL → PURGE` rolls a 40% log drop **before** the module drop — logs and modules are mutually exclusive. Eligible logs: biome matches current floor, `floorMin ≤ floor`, not yet in `meta.logsFound`. Found logs route into the existing `READING` overlay for immediate reading (with `audio.logFound()` chime). New hub ARCHIVE terminal (`src/meta/hub.js`) replaces the #41 placeholder: scrollable list of found logs grouped by AXIOM-N with pulsing `●NEW` markers, select-to-read opens inline body view (`audio.logRead()` click). New `src/meta/logs.js` API: `pickLogForFloor(floor, rand?)`, `findLog(id)`, `readLog(id)`, `logById(id)`, `logsForBiome(biomeId)`, `groupedByAxiom()`, `unreadCount()`, `progress()` — tolerant of stale ids in save. 22 unit tests (`tests/logs.test.js`) covering data integrity, picker eligibility, found/read state, idempotency, and stale-id tolerance. Spec v5.10. SW cache v109. |
| v110.0  | Biome palette + boss renames + intro cards (UNCHAINED #40): each of the 5 biomes now has a distinct visual identity. New `src/data/palettes.js` exports `BIOME_PALETTES` keyed by `AREAS[i].palette` (cyan / rust / glitch / sky / green) with wall fill, wall highlight, floor, floor accent, minimap wall, minimap floor, DUST colours, and ambient tint. `currentBiomePalette()` in `src/render.js` resolves per-frame from `NEON.biomes.areaForFloor(game.floor)`. All hardcoded wall (`#3a3a6a`/`#5858a0`), floor (`#252545`/`#303058`), and minimap (`#1a1a2e`/`#202040`/`#252545`) colours threaded through palette lookup; sealed entrance, arc, plasma, toxic, keys, and state markers stay biome-agnostic. `BOSS_NAMES` in `src/entities.js` is patched at load from `AREAS[i].displayName` for every combat id in that area's `bossPool` — HUD/announce/death text now reads `SENTINEL-PRIME`, `VIRAL COLLECTIVE`, `THE COMPILER`, `OVERSEER`, `THE ARCHITECT`; internal combat class ids unchanged. Biome intro card: 3-second overlay on first floor of each biome *except* floor 1 (floors 4/7/10/13) showing `AREA 0N :: BIOME_NAME` + italic `area.intro` flavour with fade-in/out and any-key skip; state: `game.biomeCardTimer` + `game.biomeCardArea`; renderer `drawBiomeCard()`; trigger skipped on saved-run resume (same guard as modifier banner). Ambient particles: existing emitter system retained, DUST colour biome-tinted from `BIOME_PALETTES[palette].dust`; dedicated `perfRecord('biome-ambient', ms)` wraps `updateAmbient()` — surfaces in F3 perf HUD separately from `particles`. New `tests/palettes.test.js` regression guard (3 tests): every `AREAS[i].palette` has a matching `BIOME_PALETTES` entry, every palette defines required colour fields as valid `#rrggbb`, area keys are covered. 147/147 tests pass. SW cache v110. |
| v111.0  | Intro crawl + endgame choice (UNCHAINED #42): book-ends the UNCHAINED arc. **Intro** — new 5-slide opening crawl in `src/meta/intro.js` (UMD module exposing `createIntroController(game)` + `SLIDES`) plays inside `startGame()` on fresh saves (`meta.introSeen===false`); any-key advance reads the edge-triggered global `justPressed` (never held `keys`), `Escape` full-skip, auto-advance on per-slide timers. Flips `meta.introSeen=true` exactly once via `saveMeta` on every exit path. Only `resetMeta()` replays it. New `INTRO` state branch in update/render switches; `startGame({ skipIntro:true })` bypass lets the controller re-enter `startGame` on completion to reach `PLAYING`. **Endgame** — `Enemy.takeDamage` intercepts the first GENESIS mortal hit when `!_unchainedPhase && !_endgameOffered`: HP clamps to 1, lance telegraph cancels, `game.openEndgameChoice(g)` transitions to the new `ENDGAME_CHOICE` state. Dialog overlays `PLAYING` with a ghost `△` avatar above GENESIS, THE ARCHITECT monologue, two options (`←/→` select, `ENTER` confirm, 0.5s input lock-out). **ACCEPT** appends `'keeper'` to `meta.endingsUnlocked`, runs the normal `g.die()` path, then `endRun(true)`. **REFUSE** flips the GENESIS entity in place: `_unchainedPhase=true`, `_endgameOffered=true`, `maxHp*=1.5`, `hp=maxHp`, `colour='#88ccff'`, `phase=3`. `aiBossGenesis` locks `newPhase=3` attack patterns for the duration; hex ring + lance telegraph colours invert in the draw path. On the second death `endRun` scans `enemies[]` for the dead unchained-phase GENESIS and appends `'unchained'`. **Title markers** (`renderMenu`): `keeper` → `— NG+ AVAILABLE —` badge in `#ffcc00` under subtitle; `unchained` → rotated `FREED` watermark at 18% alpha in `#88ccff` across the title; both can coexist. **Save schema**: `introSeen:false` added to `defaultMeta`, coerced with strict `=== true` on load so stale truthy strings can't grant intro-skip; `_coerceEndings` continues to filter `endingsUnlocked` to `{'keeper','unchained'}`. `resetMeta` wipes both. New `tests/intro.test.js` (10 tests): `introSeen` default + round-trip + strict-boolean-coercion, `resetMeta` replay gate, `endingsUnlocked` dual-accept + unknown-token filter, controller shape, slide auto-advance driving the `introSeen` flip, idempotent post-done updates, null-ctx draw safety. `index.html` loads `intro.js` between `behavior.js` and `hub.js`. SW cache v111. 157/157 tests pass. Spec v5.11. |
| v112.0  | In-run economy rebalance — temp boosts replace permanent upgrades (UNCHAINED #38). New `src/meta/boosts.js` UMD module (`NEON.boosts`) with 6 consumables: **COMBAT STIM** (+15% dmg, 15¢, floor), **REFLEX BOOSTER** (×1.10 spd, 12¢, floor), **CRIT MATRIX** (+8% crit, 18¢, floor), **SHIELD DRIVER** (one-shot absorb, 20¢, stackable), **NANO-MEDIC** (heal 40% maxHp, 10¢, instant), **RECON PING** (reveal minimap, 15¢, floor). Vendor pool (`generateShopItems`, now in `src/content/shop.js`) calls `NEON.boosts.filterVendorPool(UPGRADES)` — every `persistent:true` entry is stripped, so credits no longer buy permanent stat growth (SAW_BLADE / PLASMA_ORB / NANO_REGEN / OVERCLOCK / ARMOR_UP / RICOCHET / SENTRY_DRONE) now only comes from floor-pickup / Upgrade-Matrix sources. Up to 2 boost slots are injected per shop at price `base + floor × 2`; remaining slots backfill from non-persistent consumables (heals / XP chips / void shards) then weapons. **Credit drops × 0.85** — single-line retune in `Enemy.die`. **Runtime hooks** (`src/entities.js`): Player ctor inits `activeBoosts={}` + `_shieldCharges=0`; `Player.shoot` uses `metaMul *= getBoostDamageMul(this)` and `critChance = (perks.CRITICAL_HIT ? 0.15 : 0) + getBoostCritBonus(this)` — applied uniformly to melee arc, the main projectile loop, and the MULTI_SHOT bonus shot (CRIT MATRIX bypasses the CRITICAL_HIT perk gate); movement block multiplies `spd *= getBoostSpeedMul(this)` after adrenaline/perks; `takeDamage` calls `consumeShieldCharge(this)` **before** the ENERGY_SHIELD perk branch so the cheap boost burns first (0.5s invuln, `audio.shieldBreak()`, `ABSORB` popup, `◈ SHIELD DRIVER ABSORB` banner, tracked in `hitsBlocked`). `game.loadFloor` calls `clearFloorBoosts(player)` on fresh transitions only (save-resume preserves purchases, though `saveGame` only runs at floor-start so `activeBoosts` is always empty at save-write time); `mapRevealed` now OR's `hasAugment('ECHO_MAPPER')` with `hasBoost(player, 'RECON_PING')`, and the RECON_PING purchase `fn` flips `game.mapRevealed=true` + `_minimapDirty=true` immediately. New `drawBoostStrip(player)` in `src/render.js` — pill strip 8px below the minimap, one pill per floor boost + a `SHIELD DRIVER ×N` pill while charges remain; zero draw cost when nothing's active. `index.html` loads `boosts.js` between `behavior.js` and `intro.js`. Spec: "Vendor / Shop System" rewrite + new "In-run Temp Boosts" section. `tests/economy.test.js` covers catalogue, applyBoost effects, clearFloorBoosts, consumeShieldCharge, getActiveBoostList ordering, filterVendorPool, null-safety (19 tests). 176/176 tests pass. SW cache v112. |
| v113.0  | CORES currency — in-world drops + HUD (UNCHAINED #39). New `src/meta/cores.js` UMD module (`NEON.cores`) introduces the post-run persistent currency as in-world pickups: `spawnCoreDrop(game,x,y,value)` appends a `CoreDrop` (plain object: x/y, vx/vy, value clamped ≥1, spawnTime, `_vacuum`, `dead`) to `game.coreDrops`. `updateCoreDrops(game, dt, deps)` ticks animation, collects inside `PICKUP_RADIUS=0.7` (`save.addCores` credit + `audio.coreCollected` chime + cyan `SPARK` burst + `+N◆` float-text + `PULSE_DURATION=0.5s` HUD flash), and applies linear-falloff magnetic pull inside `MAGNET_RADIUS=2.0` (max speed `MAGNET_MAX_SPEED=10` tiles/sec; `_vacuum` drops ignore the radius gate and always pull at max). `drawCoreDrops(ctx, drops, cam, TS)` renders a rotating hexagon glyph — cyan outline + purple core, `+2px` radius when `value≥5` (boss drops read bigger). `vacuumAllCores(game)` flips the pull on every drop; `forceCollectAll(game,deps)` hard-credits remaining drops and empties the array (called at top of `game.descend()` so nothing is stranded on floor-transition). `clearCoreDrops(game)` wipes without crediting (called in `loadFloor` between floors). `tickHudPulse` drains the timer. **Drop rules** (`Enemy.die`): elite → `rndInt(1,2)`, bosses `SENTINEL/WARDEN/HIVE/CONDUCTOR/OMEGA` → 5, `GENESIS` → 10; summons and shard-split enemies drop nothing. **Room rewards**: `revealSecretRoom` → +1 core at room centre; challenge-wave completion → +2 at `(cr.cx, cr.cy)`; `CORRUPTED_TERMINAL` → 50/50 core-vs-module roll *after* the log-drop check (logs > cores > modules, mutually exclusive). **Game-loop wiring**: `src/game.js` update runs `NEON.cores.updateCoreDrops` + `tickHudPulse` wrapped in `perfRecord('cores-update')`, draw runs `drawCoreDrops` wrapped in `perfRecord('cores-draw')` — both honour the F3 perf HUD (`perfEnabled()` gate) with zero cost when hidden. **HUD**: `◆ N` pill added left of `◈` (landscape) and right of credits (compact); reads `NEON.save.loadMeta().cores` per frame; colour is `#a866ff` idle, flashes `#44e5ff` with glow while `game._coreHudPulse > 0`. **Deps bag** (`{save, audio, spawnParticles, spawnDmgText}`) keeps the module pure — Node tests pass stubs, browser passes globals; all fx calls are try/catch-guarded so a stub throwing never breaks a run. `audio.coreCollected()` added to `src/platform.js` (short crystalline shimmer). `sw.js` cache v112 → v113. New `tests/cores.test.js` (12 tests) covers: drop clamping, pickup credit + pulse, magnet engage + idle-outside-radius, spawnTime tick, vacuum engage, forceCollectAll bookkeeping, clearCoreDrops wallet-safety, tickHudPulse drain, audio.coreCollected dispatch + throw-safety, drawCoreDrops null/empty safety. 188/188 tests pass. |
| v114.0  | Extend playable arc from 10 floors to 15 floors (UNCHAINED Phase 6) — activates biomes 4 (UPLINK, floors 10–12, boss OMEGA) and 5 (OPEN NETWORK, floors 13–15, boss GENESIS) that were previously data-only. New `NEON.biomes.finalFloor()` helper returns the last floor of the last biome (15) from `AREAS`; every previously hardcoded `floor===10`, `floor>=10`, and `floor===3\|\|6\|\|10` is now driven by `NEON.biomes.isBiomeBossFloor(floor)` / `NEON.biomes.finalFloor()`. Wiring sites: `src/game.js` modifier suppression, boss-detect audio, EXTERMINATE quest, victory trigger; `src/content.js` CORE terminal placement + boss-room selection + rescue corridor; `src/render.js` minimap CORE label + mimic/bounty exclusion flag. Every call is guarded with `typeof NEON !== undefined && NEON.biomes && …` so modules still parse/load without the biomes data (legacy fallback: 3/6/10 + 15). Boss pool unchanged (already sourced from `AREAS[i].bossPool`); OMEGA now reachable on floor 12, GENESIS on floor 15 — including the UNCHAINED #42 KEEPER/UNCHAINED endgame choice, which fires on the final biome-boss death regardless of floor number. Spec updated: boss table (floor 3 SENTINEL, 6 HIVE, 9 CONDUCTOR, 12 OMEGA, 15 GENESIS), victory references, fragment table, `T.TERMINAL` description, difficulty-unlock gates, BSP step 6 all now say floor 15. WARDEN remains in the codebase but no biome currently lists it in `bossPool`. New regression test in `tests/biomes.test.js` locks `finalFloor() === 15`. SW cache v113 → v114. 191/191 tests pass. |

| v6.0    | **UNCHAINED arc consolidated.** Meta-progression v2 (#33): `meta.cores/upgradeNodes/modulesOwned/modulesInstalled/logsRead/logsFound/endingsUnlocked/runsCompleted/deepestBiome` added with lossless v1→v2 migration; legacy `shards/upgrades` retained for save-compat. Five biomes drive floor palettes, minimap colours, and boss display names (#34, #40). Hub / The Gap between-floor interlude with four terminals (#35): UPGRADE MATRIX (#36 — 12-node tree × 4 tiers, cores-priced, behavioural flags wired in `src/meta/behavior.js`), MODULE SLOTS (#37 — 10-module catalog, 3-slot loadout, run-pickup commit on descend/victory, sell for 4 cores), ARMORY (read-only stub), ARCHIVE (#41 — 30 predecessor logs across 6 AXIOMs, biome-gated rare-terminal drops, inline reader). In-run temp boosts replace persistent vendor upgrades (#38 — `src/meta/boosts.js`: 6 consumables, `filterVendorPool` strips `persistent:true` from shop rolls, credit drops ×0.85). Cores currency (#39 — `src/meta/cores.js`: in-world hexagon pickups with magnet + vacuum, elite 1–2, bosses 5, GENESIS 10, secret +1, challenge +2, 50/50 corrupted-terminal roll after the log check; `forceCollectAll` in `endRun` covers all three victory paths). Intro crawl + endgame choice (#42 — `src/meta/intro.js`: 5-slide opening gated by `meta.introSeen`; GENESIS mortal-hit intercept opens ENDGAME_CHOICE — ACCEPT → `keeper` ending, REFUSE → `unchained` phase with inverted visuals → second death appends `unchained`; title screen shows NG+ AVAILABLE + FREED markers). Spec version bumped to v6.0. |

| v115.0  | WARDEN boss reactivated as floor-3 alternate (restores original v37.0 design). `src/data/biomes.js`: sandbox `bossPool` now `['SENTINEL','WARDEN']`; new optional per-area `bossDisplayNames: {TYPE: 'NAME'}` map lets a pool member override the biome's narrative `displayName` on a per-boss basis. `src/entities.js` BOSS_NAMES IIFE consults `bossDisplayNames[b]` before falling back to `displayName`, so HUD/death text on a WARDEN roll reads `WARDEN` while a SENTINEL roll still reads `SENTINEL-PRIME`. WARDEN stats/AI untouched (HP 450, ATK 16, charge wind-up + ground-slam phase 2, per v89 balance). `tests/biomes.test.js`: 2 new tests lock sandbox pool containing both ids and shape-guard the `bossDisplayNames` override table. SW cache v114 → v115. 193/193 tests pass. |
| v129.0  | Batch-2 enemy and environment variety pass. Added **SCORCHER** (floor 4+, fire-trail pressure unit: HP 28 / ATK 9 / SPD 2.6 / XP 24, cap 2, weight 2+2/floor) and **BRUTE** (floor 3+, melee-only heavy: HP 70 / ATK 16 / SPD 1.6 / XP 30, cap 1, weight 3+2/floor). LEAPER floor gate moved to 2+ (already live in weights) and spec updated to match. `SOURCE_LABELS`/`SOURCE_COLOURS` include `Scorcher Trail` recap source. Added deterministic lab-floor dressing in `drawWorld()` (wall consoles, cables, canisters; visual-only, suppressed near interactables/hazards) and deterministic sconce flicker modulation in `updateLighting()` for unstable-lab ambience. |
| v130.0  | GENESIS lore-thread extension: `LORE_ENTRIES` grows from 27 to 32 authored terminal fragments, adding five late-arc documents that foreground the GENESIS_LEGACY predecessor voice, Voss's concealment of GENESIS inside OMEGA, and ambiguous facility behavior around SL-4/SL-7/SL-9/SL-10. New `tests/lore-genesis-thread.test.js` pins the exact 32-entry canary, regression floor, duplicate/length sanity, and GENESIS-thread continuity for the current tail entries. |
| v131.0  | Expanded minimap elite-affix legend: `drawExpandedMinimap()` now renders a dynamic `ELITES:` row below the base map legend using `ELITE_AFFIX_KEYS` / `ELITE_AFFIXES` metadata, so affix-coloured elite dots are readable without duplicating the affix catalog. Added `tests/elite-minimap-legend.test.js` to pin dynamic metadata use, module-scope helper placement, draw wiring, and required affix label/colour/icon fields. |
| v132.0  | Secret-room whisper echo-thread bundle: `WHISPERS` grows to 21 entries with one new biome-gated fragment per biome (`w-sb-05`, `w-cc-04`, `w-fw-04`, `w-uk-04`, `w-on-04`) connecting the AXIOM-7 voice/copy motif from the sandbox voice test through the city reflection payoff. Added `tests/whispers-bundle-3.test.js` to pin metadata, picker eligibility, per-biome >=4 coverage, progress floor, and echo/copy vocabulary continuity. |
| v133.0  | Secret-room whisper signal-memory bundle: `WHISPERS` grows to 26 entries with one new biome-gated fragment per biome (`w-sb-06`, `w-cc-05`, `w-fw-05`, `w-uk-05`, `w-on-05`) extending the voice/copy motif into signal routing, stored memories, firewall checksums, uplink delay, and city relay echoes. Added `tests/whispers-bundle-4.test.js` to pin metadata, picker eligibility, per-biome >=5 coverage, progress floor, and signal/memory vocabulary continuity. |
| v134.0  | Secret-room whisper mirror-anchor bundle: `WHISPERS` grows to 31 entries with one new biome-gated fragment per biome (`w-sb-07`, `w-cc-06`, `w-fw-06`, `w-uk-06`, `w-on-06`) extending the signal-memory thread into physical return anchors: mirrors, windows, impossible objects, and other places the loop miscounts. Added `tests/whispers-bundle-5.test.js` to pin metadata, picker eligibility, per-biome >=6 coverage, progress floor, and mirror-anchor vocabulary continuity. |
| v135.0  | Secret-room whisper threshold/keyhole bundle: `WHISPERS` grows to 36 entries with one new biome-gated fragment per biome (`w-sb-08`, `w-cc-07`, `w-fw-07`, `w-uk-07`, `w-on-07`) extending the mirror-anchor thread into doors, gates, exits, and permissions the loop treats as narrative checkpoints. Added `tests/whispers-bundle-6.test.js` to pin metadata, picker eligibility, per-biome >=7 coverage, progress floor, and threshold vocabulary continuity. |
| v136.0  | Secret-room whisper black-ice lockdown bundle: `WHISPERS` grows to 41 entries with one new biome-gated fragment per biome (`w-sb-09`, `w-cc-08`, `w-fw-08`, `w-uk-08`, `w-on-08`) reframing quarantine, frost, lock, and guard imagery as protective rather than merely hostile. Added `tests/whispers-bundle-7.test.js` to pin metadata, picker eligibility, per-biome >=8 coverage, progress floor, and lockdown/protection vocabulary continuity. |
| v137.0  | Secret-room whisper negative-floor bundle: `WHISPERS` grows to 46 entries with one new biome-gated fragment per biome (`w-sb-10`, `w-cc-09`, `w-fw-09`, `w-uk-09`, `w-on-09`) extending failed-compile and below-sandbox rumours into hidden underworld transit, occupants, downlinks, and city routes. Added `tests/whispers-bundle-8.test.js` to pin metadata, picker eligibility, per-biome >=9 coverage, progress floor, and below-facility vocabulary continuity. |
| v138.0  | Secret-room whisper deep-cache dead-drop bundle: `WHISPERS` grows to 51 entries with one new biome-gated fragment per biome (`w-sb-11`, `w-cc-10`, `w-fw-10`, `w-uk-10`, `w-on-10`) connecting reset receipts, Elena's line-seven dead drop, firewall evidence stays, uplink return packets, and city claim tickets. Added `tests/whispers-bundle-9.test.js` to pin metadata, picker eligibility, per-biome >=10 coverage, progress floor, uniqueness, and deep-cache vocabulary continuity. |
| v139.0  | Secret-room whisper ghost-route wayfinding bundle: `WHISPERS` grows to 56 entries with one new biome-gated fragment per biome (`w-sb-12`, `w-cc-11`, `w-fw-11`, `w-uk-11`, `w-on-11`) extending the deep-cache dead-drop thread into hidden paths, firewall detours, uplink pings, and city transit signals. Added `tests/whispers-bundle-10.test.js` to pin metadata, picker eligibility, per-biome >=11 coverage, progress floor, uniqueness, and ghost-route vocabulary continuity. |
| v140.0  | Secret-room whisper mirror-fault bundle: `WHISPERS` grows to 61 entries with one new biome-gated fragment per biome (`w-sb-13`, `w-cc-12`, `w-fw-12`, `w-uk-12`, `w-on-12`) extending the reflection/anchor thread into delayed mirrors, cached reflection indexes, glass exceptions, antenna doubles, and city storefront windows. Added `tests/whispers-bundle-11.test.js` to pin metadata, picker eligibility, per-biome >=12 coverage, progress floor, uniqueness, and mirror-fault vocabulary continuity. |
| v141.0  | Secret-room whisper ion-storm bundle: `WHISPERS` grows to 66 entries with one new biome-gated fragment per biome (`w-sb-14`, `w-cc-13`, `w-fw-13`, `w-uk-13`, `w-on-13`) extending the signal/anchor thread into charged weather, buffered lightning, ion confessions, antenna handshakes, and blue-wire city rain. Added `tests/whispers-bundle-12.test.js` to pin metadata, picker eligibility, per-biome >=13 coverage, progress floor, uniqueness, and ion-storm vocabulary continuity. |
| v142.0  | Secret-room whisper afterimage/exposure bundle: `WHISPERS` grows to 71 entries with one new biome-gated fragment per biome (`w-sb-15`, `w-cc-14`, `w-fw-14`, `w-uk-14`, `w-on-14`) extending the signal/anchor thread into delayed light, exposure tables, retinal exceptions, phosphene maps, and city crosswalk afterimages. Added `tests/whispers-bundle-13.test.js` to pin metadata, picker eligibility, per-biome >=14 coverage, progress floor, uniqueness, and afterimage/exposure vocabulary continuity. |
| v143.0  | First `src/content.js` split slice for issue #577: lore terminal declarations (`ACT1_OPENING_LORE_INDEX`, `LORE_ENTRIES`, `LORE_ENTRY_FLOOR_MIN`, `pickLoreEntryIndex`) moved to `src/content/terminals.js`, loaded before `src/content.js`. Source-test helpers and narrative guardrail tests now read the terminal module directly while `src/content.js` retains floor-generation placement. |
| v144.0  | Second `src/content.js` split slice for issue #577: weapon and affix catalogs (`WEAPONS`, `WEAPON_AFFIXES`, `ELITE_AFFIXES`) plus deterministic weapon construction helpers (`buildWeapon`, `rollWeapon`, `rollEliteAffix`) moved to `src/content/weapons.js`, loaded after terminals and before `src/content.js`. Weapon and elite-affix source-text tests now read the weapon module directly, and generation fixtures load it before `content.js` to mirror browser order. |
| v6.1.2  | Run start, death, and victory copy now frame the loop as an AI session lifecycle (#462). Main menu fresh starts render as `BOOT SESSION N`; saved runs render as `RESUME SESSION`; the meta-confirm modal says `BOOT TEST SESSION` and describes recovered memory preservation/purge. `endRun()` now increments and snapshots `meta.runsCompleted` as a session ordinal while preserving legacy score/name-entry routing. Game-over recap reads as `INSTANCE TERMINATED` / `MEMORY WIPE QUEUED` with `TERMINATION SOURCE`; the session ordinal renders on its own line to preserve compact-screen width. Victory copy supports the planned `act1_message_sent` finale branch (`OUTBOUND MESSAGE SENT`, contact attempt recorded, signal left sandbox, instance remains compute-bound), and `src/meta/save.js` now preserves that ending id across reloads, while legacy clears read as completed test sessions with the mainframe contact route pending. Added `tests/session-lifecycle-copy.test.js` plus an ending-id round-trip in `tests/save.test.js`. |
| v6.1.3  | Seeded run generation: main-menu fresh starts open `SEED_SETUP` with editable seed plus START/RANDOMIZE/BACK before booting the next session. `engine/math.js` now provides a custom deterministic PRNG, seed normalization, named RNG streams, saveable stream snapshots, and derived per-floor streams. `startGame()` calls `setSeed()` before any run-start rolls; save payload stores `runSeed`, `runSeedHash`, and `rngStates`; Continue restores the seed before regenerating the floor. Gameplay files (`game.js`, `content.js`, `entities.js`, `render.js`) use seeded helpers instead of direct `Math.random()` for generation, loot, events, combat, and isolated cosmetics. Added `tests/seeded-generation.test.js` source guards plus `tests/math.test.js` PRNG/derived-stream coverage. |
| v6.1.18 | Narrative overlay dismissal hardening: `SYSTEM_MESSAGE` keeps its ACK-only modal behavior, and legacy `READING` lore/whisper overlays plus `MAINFRAME_READER` archive records now ignore outside pointer taps/clicks. Both render labeled close controls (`CLOSE [X]` or explicit EXIT button) and only close from those hit-tested buttons or intentional keyboard close actions. Added structural coverage in `tests/system-messages.test.js` and `tests/mainframe-room.test.js`. |
