# Mobile interaction & readability evidence brief

Research ticket: [#1085](https://github.com/darinh/neon-dungeon/issues/1085)
"Which mobile interaction and readability principles should govern the
redesign?" — child of the wayfinding map
[#1084](https://github.com/darinh/neon-dungeon/issues/1084).

**Status**: evidence brief only. It does not choose a control scheme, HUD
layout, or interruption pattern. It separates sourced guidance from opinion and
lists candidate measurable criteria, explicitly marked provisional, for later
prototyping and human decision. All sources below were accessed **2026-10-14**.

**Scope note**: public web research only. No repository source code or private
material was sent to any external service. The only repository facts used here
are the current-config inventory in the "Baseline: current config" section
below, drawn from `docs/spec.md` and `src/game.js` at
`1ec9a65dc076f11d49e662cd90ab1dbb5d5cb6b6` (this worktree's base), used to
ground comparisons — not to audit the implementation.

---

## How to read the tags

Every claim below is tagged:

- **[REQUIREMENT]** — normative wording *within that standard's or platform's
  own conformance/certification scope* (WCAG conformance, or Xbox's XAG
  certification program for titles seeking Xbox accessibility certification).
  This project has not stated it is pursuing WCAG conformance or Xbox
  certification, so a **[REQUIREMENT]** tag here means "mandatory if you claim
  conformance to that specific standard/program," not "mandatory for this
  project." Imperative wording in a source (e.g., XAG's "must"/"not fine to
  require") does not, by itself, make that wording binding on this project —
  it becomes a requirement here only if the project explicitly adopts that
  standard or program. Treat every **[REQUIREMENT]** item as *sourced,
  scoped, optional-to-adopt guidance* unless a separate decision says
  otherwise.
- **[EMPIRICAL]** — a measured/observed finding from a named study or field
  observation.
- **[CONVENTION]** — expert consensus, heuristic, or widely repeated industry
  practice without a controlled study behind it.
- **[HYPOTHESIS]** — untested for this project; something to prototype and
  playtest, not something to assume.

None of the pixel/mm/dp figures below are claimed as universal cutoffs for
*this* game. They are reference points from general UI or other games'
certification programs, several explicitly built for discrete tap targets, not
continuous-drag virtual sticks or fast-moving combat telegraphs. Where a source
itself says its figures don't transfer to twitch gameplay, that caveat is kept.

**Xbox Accessibility Guidelines (XAG) specifically**: XAG is Microsoft's own
accessibility program for games seeking Xbox/Microsoft accessibility
certification. Its "must"/"not fine to require" language is normative *for
that certification program*, not a universal law or an automatic obligation
for a web game that isn't pursuing Xbox certification. XAG citations below are
tagged **[PLATFORM GUIDANCE — Xbox certification scope]** rather than a bare
**[REQUIREMENT]**, and are included because they are a well-documented,
concrete reference point, not because this project has adopted them.

---

## Baseline: current config (what already exists, not what should change)

Per `docs/spec.md` and `src/game.js` at the branch base commit:

- Touch scheme is dual virtual sticks (left: move, right: aim/fire) plus
  discrete action buttons USE / HACK / DASH / BOMB (`docs/spec.md:1367`,
  `4743`).
- Two player-facing settings already exist and both default **off**:
  `settings.lockAimToMove` ("Lock Aim To Move") and `settings.aimAssist` ("Aim
  Assist") (`docs/spec.md:4597`, `4582`). In code, when `aimAssist` is on the
  game searches for a target and overrides aim to face it; when off and
  `lockAimToMove` is on, aim is derived from movement direction instead of the
  right stick (`src/game.js:3706-3727`).
- So manual dual-stick aiming, movement-direction aiming, and assisted/auto
  aiming are **already all implemented as player-selectable options**, not a
  green-field choice. Any redesign discussion should start from "which of
  these three remains, changes default, or is removed/merged," not "should we
  add auto-aim."
- Five area/biome bands exist, keyed by floor ranges, each with its own
  palette/boss pool (`src/data/biomes.js`), and the shared enemy table adds
  types as floors progress (`src/entities/spawn-table.js`, per the map body).
  These are backdrop facts for the readability/combat-interruption sections
  below (growing enemy variety competes for HUD/telegraph attention as runs
  progress) — not re-litigated here.

---

## 1. Touch target size, spacing, and reachability

- **[REQUIREMENT]** WCAG 2.2 SC 2.5.8 *Target Size (Minimum)*, Level AA:
  pointer targets must be at least **24×24 CSS px**, with defined exceptions
  (spacing, equivalent control elsewhere, inline text, user-agent-rendered,
  "essential" dense layouts such as map pins).
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — W3C
  WAI. Verified by direct fetch.
- **[REQUIREMENT, AAA/aspirational]** WCAG 2.2 SC 2.5.5 *Target Size
  (Enhanced)*: "Make custom targets at least 44 by 44 pixels." Rationale given:
  touch is "an input mechanism with coarse precision... a finger is larger
  than a mouse pointer."
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html — W3C
  WAI.
- **[REQUIREMENT]** Google's official Android accessibility help page:
  "Consider making touch targets at least 48×48dp, separated by 8dp... A touch
  target of 48×48dp results in a physical size of about 9mm... recommended
  target size for touchscreen objects is 7–10mm," attributed to Material
  Design accessibility guidance.
  https://support.google.com/accessibility/android/answer/7101858?hl=en —
  Google (undated help article).
- **[PLATFORM GUIDANCE — Xbox certification scope]** Xbox Accessibility Guidelines
  (XAG) v3.2, "XAG 107: Input," gives separate mobile and tablet figures:
  mobile **15mm × 15mm** (59px @100dpi / 118px @200dpi / 236px @400dpi);
  tablet **24mm × 24mm**.
  https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-107-input
  — Microsoft (v3.2, published 2023-06-08). Verified by direct fetch.
- **Apple HIG's commonly-cited 44×44pt figure could not be directly verified**
  — developer.apple.com/design/human-interface-guidelines is a client-rendered
  SPA; a live fetch and a Wayback snapshot both returned an empty shell. The
  figure is extremely consistently reported by independent secondary sources
  but is flagged here as **corroborated-but-not-directly-quoted**, pending a
  JS-capable fetch if it must be cited as an exact platform quote.
- **Discrepancy, not a contradiction to resolve by picking one**: WCAG's
  24–44 CSS px, Google's 9mm, and Xbox's 15mm mobile figure are all legitimate
  within their own programs, and disagree by roughly 2x. **None were validated
  for continuous-drag virtual joysticks or fast-reaction combat buttons** —
  all three are framed around discrete, static tap targets. Treat any of them
  as a floor to check against, not as this project's answer.
- **[EMPIRICAL]** NN/g's "Touch Target Size" article reports two named
  external studies: Parhi/Karlson/Bederson found a minimum size of **1cm ×
  1cm** for quick/accurate selection; the MIT Touch Lab found average
  fingertip width **1.6–2cm**, with average thumb contact area **~2.5cm**. NN/g
  also invokes Fitts's Law (smaller/farther targets take longer and are less
  accurate to reach). https://www.nngroup.com/articles/touch-target-size/ —
  NN/g, citing Parhi, Karlson & Bederson and the MIT Touch Lab.
- **[CONVENTION — community guideline, no certification program behind it]**
  Game Accessibility Guidelines, "Ensure interactive
  elements/virtual controls are large and well spaced": states "2.4cm has
  been found to be the ideal size for touch screens, but impractical for
  smaller phone screens, so 0.96cm is the recommendation for phones... use
  them as a minimum rather than a fixed size," and that buttons placed close
  together need to be larger again to compensate.
  https://gameaccessibilityguidelines.com/ensure-interactive-elements-virtual-controls-are-large-and-well-spaced-particularly-on-small-or-touch-screens/
  — Game Accessibility Guidelines. Note: GAG's page does not itself name the
  underlying study for the 2.4cm/0.96cm figures — treat those two numbers as
  GAG's own synthesized guidance, not independently re-verified empirical
  data.

**Candidate measurable criteria (provisional, to validate by prototype +
playtest, not to adopt as-is):**

- *[PROVISIONAL]* Discrete action buttons (USE/HACK/DASH/BOMB) meet or exceed
  the WCAG AAA 44×44 CSS px figure, independent of any native-vs-web gap (see
  §3), since these are literally the kind of static tap target that figure was
  designed for.
- *[PROVISIONAL]* Virtual stick *base* size and *drag range* are evaluated
  separately from button-tap guidance, since no sourced figure above covers
  continuous-drag input; use the stick's actual in-game miss/overshoot rate in
  playtesting as the metric, not a borrowed tap-target number.
- *[PROVISIONAL]* On-screen controls avoid the bottom-corner/edge zones that
  Hoober's data (below) shows are least reachable one-handed, as a layout
  constraint to check in prototypes, not a specific pixel offset to hard-code.

---

## 2. Thumb reachability and one-/two-handed ergonomics

- **[EMPIRICAL]** Steven Hoober's field-observation study: 36% of users
  "cradle" the phone (two hands holding, one thumb/finger touching); within
  that group, thumb-on-screen 72% vs. finger-on-screen 28%, and left-hand 79%
  vs. right-hand 21%. Two-handed use (both thumbs active) occurred in only
  ~15% of observed users; of those, **90% held the phone in portrait**, only
  10% in landscape. https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
  — Steven Hoober, UXmatters, Feb 2013. Verified by direct fetch.
- **[CONVENTION]** Hoober's own follow-on design advice in the same article
  (e.g., caution about assuming low-priority controls can be safely tucked in
  "hard to reach" corners) is explicitly his interpretive recommendation layered
  on the data above, not a separate measurement — same source/URL.
- The popular "thumb zone" easy/stretch/hard heatmap diagrams circulated in UX
  blogs trace back to Hoober's work but are **popularized visual heuristics**,
  not an independently replicated dataset. No distinct Nielsen Norman Group
  "thumb zone" primary article was found (`nngroup.com/articles/thumb-zone-mobile-ux/`
  and `/mobile-thumb-zones/` both 404 as of 2026-10-14). *[HYPOTHESIS]*: treat
  the colored heatmap diagrams as a design heuristic to test on real devices
  for this game's control layout, not as validated fact.
- **[CONVENTION — community guideline, no certification program behind it]**
  Game Accessibility Guidelines, "Allow
  play in both landscape and portrait," gives a concrete accessibility
  rationale beyond preference: "Some mobile/tablet players have their devices
  mounted in a fixed position, such as on a wheelchair mount or bed frame, so
  are only able to play in a specific orientation."
  https://gameaccessibilityguidelines.com/allow-play-in-both-landscape-and-portrait/
  — Game Accessibility Guidelines. This is a real accessibility rationale, not
  a binding requirement on this project, and happens to align with the map's
  existing "full landscape also supported" direction.

**Candidate measurable criteria (provisional):**

- *[PROVISIONAL]* Primary combat controls (move stick, aim stick, the most
  time-pressured action button) stay reachable for a one-handed-portrait grip
  per device-class, verified on real phones in the verification skill's
  `--viewport phone --touch` mode, not only inferred from Hoober's diagrams.
- *[PROVISIONAL]* Secondary/rare actions may use less-reachable screen regions
  deliberately, if playtesting shows no meaningful mid-combat latency cost —
  this trades off against the occlusion concern in §4.

---

## 3. Mobile web vs. native input: pixel and coordinate models

This directly matters because the game is a canvas-rendered HTML5 app, not a
native app, and the three coordinate spaces below are genuinely different
things, not three names for the same number.

- **[REQUIREMENT/spec definition]** A **CSS pixel** is normatively "exactly
  1/96th of 1 CSS inch" — a resolution-independent unit, not a physical
  measurement and not a device pixel.
  https://developer.mozilla.org/en-US/docs/Glossary/CSS_pixel — MDN (modified
  2025-11-07).
- **[REQUIREMENT/spec definition]** `window.devicePixelRatio` "returns the
  ratio of the resolution in physical pixels to the resolution in CSS pixels
  for the current display device... value of 1 indicates a classic 96 DPI
  display... 2 expected for HiDPI/Retina." Pinch-zoom does not change it
  (magnifies without changing CSS-pixel size); browser UI page-zoom does.
  Practical canvas implication: backing-store size should scale by
  `devicePixelRatio` (with a matching `ctx.scale()`), while hit-testing/layout
  math stays in CSS-pixel space.
  https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio —
  MDN (modified 2026-08-21).
- **[REQUIREMENT/spec definition]** Touch objects can expose contact-ellipse
  data (`Touch.radiusX`/`radiusY`/`rotationAngle`, in CSS pixels), i.e. a
  touch is not really a point — but exposure is optional and inconsistent
  across browsers; not verified further here.
  https://developer.mozilla.org/en-US/docs/Web/API/Touch/radiusX — MDN
  (modified 2025-04-03).
- **[REQUIREMENT/spec definition]** The W3C Pointer Events spec unifies
  mouse/touch/pen into one event model "without writing device-specific logic
  for each input type." It is a **Working Draft** — the document's own status
  section says it is "inappropriate to cite... as other than a work in
  progress." https://www.w3.org/TR/pointerevents/ — W3C.
- **Gap, explicitly flagged**: this research did not find a reputable primary
  source quantifying *latency or precision differences* between native touch
  APIs and mobile-browser touch/pointer events for canvas games, within the
  public, non-paywalled search performed. It is discussed informally in
  game-dev forums, but this brief did not locate an authoritative benchmark
  behind that discussion. **[HYPOTHESIS]**: do not treat "browser touch has
  higher input latency than native" as a sourced fact for planning on the
  strength of this search; if input feel becomes a concern, this needs its
  own measurement (e.g., high-speed camera or `requestAnimationFrame`
  timestamp logging against raw touch timestamps), not an assumption, and a
  further targeted search could still surface a source this pass missed.

**Implication for the redesign (not a new finding, a consequence of the
above):** any control-layout or hit-test spec written for this game should
state which of the three spaces (CSS px, device px, logical canvas
coordinates) a number is in, because "44px" means different physical sizes on
different devices and different things depending on which layer measured it.

---

## 4. Manual dual-stick vs. assisted/auto-aim vs. movement-locked aim vs. contextual actions

This is the weakest-sourced area in the brief — flagged per the research
skill's instruction not to fabricate authority where none exists.

- **[CONVENTION]** Mark Venturelli (developer, *Relic Hunters Zero*),
  "Everything I Learned About Dual-Stick Shooter Controls": explains that a
  naive per-axis deadzone check produces directional input that "feels
  'sticky' on the diagonals, like a square," and that combining both axes into
  a vector and comparing magnitude against the deadzone threshold produces "a
  nice radial deadzone" instead. Cites Josh Sutphin's "Scaled Gradient
  Deadzone" as suited to FPS precision aiming but "overkill" for a dual-stick
  game. This is one developer's trial-and-error writeup, not a controlled
  study. https://www.gamedeveloper.com/design/everything-i-learned-about-dual-stick-shooter-controls
  — Game Developer/Gamasutra.
- **[PLATFORM GUIDANCE — Xbox certification scope]** Xbox Accessibility Guidelines
  v3.2, "XAG 107: Input" — directly bears on the manual-vs-assisted-vs-locked
  question: "It's fine to offer a primary input for your game. It's **not**
  fine to require it. Always provide alternate inputs with equivalent
  functionality," and explicitly calls out "Don't require two sticks (or
  stick + D-pad) to complete mechanics" as an accessibility bar, plus "Provide
  in-game sensitivity adjustment for each analog input individually... with a
  range of at least ±50% of the default," and mobile-specific: "Allow
  adjusting size, spacing, and position of all touch targets. Provide a range
  of pre-set layout options."
  https://devdocs.xbox.com/build/game-principles/accessibility/xag-deep-dives/xag-107-input
  — Microsoft, v3.2 (2023-06-08). Verified by direct fetch. Within Xbox's own
  certification program, XAG treats single-stick/assisted-aim operability as
  something to **offer alongside** manual dual-stick, not as a replacement for
  it or a "casual mode" value judgment; this project is not pursuing Xbox
  certification, so XAG 107 is cited here as well-documented, concrete
  guidance to weigh, not as a rule this project is bound by. The project
  already has this general shape (`aimAssist`/`lockAimToMove` as opt-in
  toggles alongside manual dual-stick) — that is a pre-existing design choice
  noted for context, not evidence that the choice was made to satisfy XAG.
- **[CONVENTION]** Game Accessibility Guidelines, "Include an option to adjust
  the sensitivity of controls": "There is no one-size-fits-all sensitivity
  level... Allow players to set it at game level... This applies to all types
  of input – mouse, touch, tilt, analogue stick, ideally gesture too."
  https://gameaccessibilityguidelines.com/include-an-option-to-adjust-the-sensitivity-of-controls/
  — Game Accessibility Guidelines.
- **No GDC Vault talk specifically on mobile twin-stick auto-aim design was
  locatable** via public, non-paywalled search. **[GAP, explicitly flagged]**:
  this means area-4 claims about accuracy, conversion, or player preference
  across manual/assisted/locked schemes should be treated as **[CONVENTION]**
  at best (sticky-aim-snap-in-a-cone, bullet homing, auto-fire-on-reticle-over
  target are commonly described patterns in uncredentialed community/forum
  discussion) or **[HYPOTHESIS]**, not as citable authority, pending a
  dedicated paid/session-access search of GDC Vault or a published playtest
  dataset.

**Trade-offs to carry into design discussion (not a recommendation):**

| Scheme | Claimed upside (source quality) | Claimed cost (source quality) |
|---|---|---|
| Manual dual-stick | Full player expression/precision; matches genre convention — [CONVENTION], no controlled-study citation found | Two simultaneous thumb inputs; XAG 107 flags "requiring two sticks" as a barrier *within Xbox's certification scope* — [PLATFORM GUIDANCE — Xbox certification scope], not this project's requirement |
| Movement-locked aim (existing `lockAimToMove`) | Frees a thumb/reduces simultaneous-input demand — inferred from XAG's single-stick operability goal [PLATFORM GUIDANCE — Xbox certification scope], not measured for this game | Couples facing to movement, which can't aim away from travel direction without further design (strafing, lock-on, etc.) — [HYPOTHESIS], untested here |
| Assisted/auto-aim (existing `aimAssist`) | Lowers precision demand, matching XAG's "alternate input, equivalent functionality" goal [PLATFORM GUIDANCE — Xbox certification scope] | Can reduce perceived player agency/skill expression if poorly tuned — [CONVENTION]/[HYPOTHESIS], not measured for this game |
| Contextual actions (e.g., single context button vs. USE/HACK/DASH/BOMB separately) | Fewer simultaneous targets to hit under thumb occlusion — inferred from §1/§2 reachability sources, not measured directly | Can create ambiguity about which action will fire — [HYPOTHESIS] |

All four options are already partially present in the codebase as toggles
(manual, assisted, locked) or discrete buttons (contextual actions are not yet
unified). This brief does not recommend removing, defaulting, or merging any
of them — see "Outstanding decisions" below.

---

## 5. Accessibility specific to games (beyond input)

- **[CONVENTION — community guideline, no certification program behind it]**
  GAG, "Use an easily readable default font size": cites
  "Amazon TV['s] 10-foot-UI guidelines... text size recommendations[] of 28px
  minimum when viewed on a 1080p screen... use 28px as a minimum rather than a
  target," and separately asserts (without its own inline citation) that small
  text is harder to read with dyslexia "due to the differences between letter
  shapes being less pronounced at smaller pixel sizes" — the font-size figure
  traces to a named external spec; the dyslexia claim does not and should be
  treated as **[CONVENTION]**, not independently verified here.
  https://gameaccessibilityguidelines.com/use-an-easily-readable-default-font-size/
  — Game Accessibility Guidelines.
- **[PLATFORM GUIDANCE — Xbox certification scope]** XAG 101 "Text display" gives concrete,
  rigorously defined minimums for mobile: "100 DPI → 18px, 200 DPI → 36px, 400
  DPI → 72px" minimum default text body-height, with body-height explicitly
  defined as "the pixel distance from the lowest descender to the highest
  ascender" (measured by a described screenshot methodology), plus "players
  can resize text up to 200% of the minimum without losing content," and
  "Platform-provided screen magnifiers are not a substitute for meeting
  minimum text size."
  https://devdocs.xbox.com/build/game-principles/accessibility/xag-101-text-display
  — Microsoft, v3.2.
- Apple HIG Dynamic Type figures (commonly cited 11pt floor / 17pt default
  body) have the same **not directly fetchable** caveat as §1 — corroborated
  by secondary sources only.
- **[PLATFORM GUIDANCE — Xbox certification scope]** XAG 107 again: "Provide in-game sensitivity adjustment for
  each analog input individually... ±50% of the default" and mobile
  touch-target layout presets, both already summarized in §4.
- **[gap]** XAG 102 "Contrast" (colorblind-safe readability) exists in the
  Xbox docs index but was not opened in this pass — flagged as **not yet
  verified**, follow-up if color-coded telegraphs/HUD states become a design
  question.

**Candidate measurable criteria (provisional):**

- *[PROVISIONAL]* HUD/dialogue body text meets or exceeds the XAG 101 mobile
  minimum body-height for the relevant DPI tier, as a floor to check in
  prototypes — not as proof that any specific chosen size will be readable
  mid-combat (see §6's explicit caveat).
- *[PROVISIONAL]* A text-scale/zoom option exists for HUD and dialogue text,
  consistent with XAG's "resize up to 200% without losing content" pattern and
  the project's existing `textScale` setting (`docs/spec.md:4582`).

---

## 6. Readability / information hierarchy on small screens, with an explicit caveat

- **[REQUIREMENT]** WCAG 2.2 SC 1.4.4 *Resize Text* (AA): content must be
  scalable "up to 200%... without loss of content or functionality." This SC
  is written for general web UI text, not fast-moving game telegraphs.
  https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html — W3C WAI.
- **[REQUIREMENT, scoped]** WCAG 2.2 SC 1.4.10 *Reflow* (AA) requires no
  two-dimensional scrolling at a 320 CSS px equivalent viewport width,
  **except for "parts of the content which require two-dimensional layout for
  usage or meaning."** The SC's own Note 2 lists examples of such content:
  "images required for understanding (such as maps and diagrams), video,
  **games**, presentations, data tables (not individual cells), and
  interfaces where it is necessary to keep toolbars in view while
  manipulating content." **Precise scope, corrected from an earlier overbroad
  reading**: this is an exception for *parts of content that themselves
  require 2D layout* (the game's real-time play canvas is a clear case), not
  a blanket exemption for every screen a game shows — a game's settings
  menu, text-heavy dialogue screen, or other section that does not itself
  require 2D layout would not automatically inherit the exception merely for
  being part of a game. Still useful as a signal that WCAG's own authors
  recognize real-time play canvases as a different case from ordinary
  reflowable text, but not a general "games are exempt from readability
  rules" license.
  https://www.w3.org/WAI/WCAG22/Understanding/reflow.html — W3C WAI. Verified
  by direct fetch, including Note 2's exact wording.
- **[PLATFORM GUIDANCE — Xbox certification scope]** XAG 101's concrete DPI-tiered minimums (see
  §5) are the most directly game-relevant sourced figures found for text size.
- **Explicit, load-bearing caveat for this project**: none of the above
  sources address minimum legible size/contrast for **time-pressured, moving**
  telegraphs (e.g., a boss attack-warning glyph that must be read in well
  under a second while the screen is busy with other enemies and effects).
  **[HYPOTHESIS]**: any specific telegraph-readability threshold for this game
  must come from this project's own playtesting, not from general text-resize
  guidance. Do not adopt a borrowed number here as if it were validated for
  combat telegraphs.

---

## 7. Modal/overlay interruption for story-choice and dialogue systems

This is the weakest-sourced area overall — flagged explicitly, as anticipated.

- **[CONVENTION, expert-consensus]** NN/g, "Modal & Nonmodal Dialogs": a modal
  dialog "disables the main content until the user explicitly interacts with
  [it]." Listed costs: it "require[s] immediate attention," "interrupt[s] the
  user's workflow," can "cause users to forget what they were doing" (added
  cognitive load), and adds "interaction cost" (an extra goal just to dismiss
  it). This article synthesizes general cognitive-load/interaction-cost
  research but does not cite a single discrete controlled study inline — treat
  as expert consensus, not a specific measurement.
  https://www.nngroup.com/articles/modal-nonmodal-dialog/ — NN/g.
- **This research did not find a game-specific authoritative source**
  comparing diegetic vs. non-diegetic interruption patterns for pausing
  real-time combat to present a story-choice overlay, within the search
  performed. The commonly cited "diegetic/non-diegetic/meta/ spatial" HUD
  taxonomy appears in game-design blogs/talks, but this pass did not verify a
  primary authoritative source for that taxonomy, nor find a source
  quantifying player confusion/drop-off from combat-interrupting dialogue.
  **[GAP, explicitly flagged]**: a further targeted search (e.g., published
  game-UX research databases, academic HCI venues) could still surface
  something this pass missed.
- **Practical implication, not a citation**: any choice-overlay/interruption
  design for this game should be treated as informed by the general
  modal-interruption cost model above plus XAG's general "let the player
  control pacing" ethos (§4/§5: adjustable sensitivity, no forced holds, no
  required simultaneous inputs) — not as implementing a dedicated, validated
  "game UX" citation, because none was found.

---

## Prototype / playtest scenarios suggested by the gaps above

These are suggestions for what a later *prototype* ticket (not this research
ticket) could test; none are decisions.

1. **One-handed portrait combat reachability**: have 3–5 testers play a combat
   encounter one-handed in portrait on a representative phone, logging which
   screen regions caused mis-taps or required regrips, to check against
   Hoober's cradling/thumb-zone data rather than assuming it transfers
   directly to this control layout.
2. **Manual vs. locked vs. assisted aim, same encounter**: run the same
   scripted encounter three times (toggle each existing setting), logging
   hit-rate, time-to-kill, and a post-session preference/confidence survey,
   since this research did not find a published comparison for this
   project's genre and input context.
3. **Telegraph legibility under load**: present the same attack telegraph at
   candidate sizes/contrasts in low-threat and high-threat (busy-screen)
   moments, measuring reaction success, since §6 found no source within the
   search performed addressing telegraph legibility under time pressure.
4. **Combat-interruption pacing for story choices**: compare a hard-pause
   modal choice overlay against a time-pressured or diegetic-in-world choice
   prompt, measuring task (choice) completion and self-reported
   disruption/immersion, since §7 found no game-specific authoritative source
   within the search performed to rely on instead.

---

## Limits of this evidence

- Several widely repeated figures (Apple HIG 44×44pt and Dynamic Type
  11pt/17pt) could not be directly quoted from Apple's own site in this pass
  because developer.apple.com/design/human-interface-guidelines renders via
  client-side JavaScript and both a live fetch and a Wayback Machine snapshot
  returned an empty app shell. They are corroborated by many independent
  secondary developer sources but are flagged, not presented as directly
  verified quotations.
- Material Design 3's own site (m3.material.io) has the same client-rendering
  problem; Google's official Android accessibility help page was used instead
  as an official (if not literally identical) substitute.
- This research did not locate a GDC Vault talk on mobile twin-stick/auto-aim
  design that was freely accessible; GDC Vault is largely
  paywalled/session-gated and was not searched with paid/session access. Area
  4 (control scheme comparison) is therefore the weakest-sourced section and
  should not be treated as settled by citation alone.
- This research did not find an authoritative benchmark for
  native-vs-mobile-browser touch input latency/precision (§3), for
  combat-telegraph legibility under time pressure (§6), or for
  combat-interruption-overlay best practice (§7), within the public,
  non-paywalled search performed. All three are explicit, load-bearing gaps
  in this pass, not claims that no such evidence exists anywhere.
- This brief distinguishes "general UI/accessibility requirement" (and, for
  XAG specifically, "requirement within Xbox's own certification scope") from
  "validated for fast-paced game combat" throughout; it does not assume either
  one proves the other, and it does not treat a cited standard's normative
  wording as automatically binding on this project. Every "candidate
  measurable criterion" above is marked **provisional** and is meant to be
  tested, not adopted outright.
- This brief does not select a world/story direction, an area design, an
  encounter grammar, a replay/reward model, or a specific control scheme —
  those remain open decisions for other child tickets or the human.

---

## Outstanding decisions for the human / other tickets (not resolved here)

- Whether manual dual-stick, movement-locked aim, and/or assisted aim remain
  as player-selectable options, change default, or are consolidated — informed
  by §4's trade-off table and the suggested prototype in scenario 2, not
  decided here.
- Concrete touch-target, text-size, and contrast thresholds for this game's
  HUD and controls — informed by §1/§5/§6, explicitly left as provisional
  candidates pending prototyping, not finalized figures.
- How story-choice/dialogue overlays should interrupt (or not interrupt)
  real-time combat — §7 found the weakest external evidence of all seven
  areas; this needs this project's own prototype/playtest data per scenario 4
  above.
- Whether and how a unified "contextual action" model replaces or supplements
  USE/HACK/DASH/BOMB as discrete buttons — touched on in §4's trade-off table
  only as a hypothesis, not resolved.

These belong to the existing controls-prototype and other child tickets on
the map, not to a new research ticket.
