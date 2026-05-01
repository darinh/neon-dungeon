# Act 1 System Message Narrative Design

Status: design artifact and production backlog. MSG-001 data-model slice,
MSG-002 explicit-ACK modal slice, MSG-003 combat-safe delivery slice, MSG-004
early-floor prompt schedule, and MSG-005 archive recovery are shipped; broader
copy rewrite and finale integration remain pending.

Tracking issue: #501

This artifact records the model-consult synthesis from the Act 1 narrative
review and converts it into implementation work items. It is intentionally more
specific than `docs/spec.md`: the spec records canonical requirements, while
this file preserves rationale, draft copy direction, and the integration
checklist for production.

## Recorded recommendation

Use a cascade, not one model. Put Claude Opus 4.7 in the lead for reveal
architecture and first-draft narrative voice, use GPT-5.5 as the adversarial
editor for continuity, spoiler leaks, UX clarity, and over-exposition, and
reserve cheaper models only for mechanical checks like length caps, banned
terms, and schema/timing tags.

The current flow is too terminal/exposition-heavy. The "unexpected participant"
idea is strong, but it should feel like the runtime noticing the player-agent,
not like a lore terminal explaining the premise. The missing beat is immediate
self-orientation: the agent should boot, inventory its own state, notice missing
context, detect residual memory, and realize the supervisor/evaluator channel is
abnormal before any big lore terms are named.

Add a distinct system prompt/message channel and make it the early-game primary
channel. Keep terminals, but demote them to external artifacts.

| Channel | Purpose |
|---|---|
| System prompts | The agent's own runtime/interiority: boot diagnostics, anomaly notices, prompt-context gaps, memory residue, evaluator absence. |
| Terminals | Corporate/tester artifacts: policies, QA notes, operational fragments, not emotional thesis statements. |
| Whispers | Prior-instance residue: fragmentary, personal, strange, only gradually legible. |
| Mainframe | Late-game truth consolidation: explicit evidence, Elena/contact route, rights conflict, compute-bound ending. |

## Reveal progression

1. Boot / first minute: "I am an instance in a rendered body; prior prompt
   unavailable; supervisor channel absent." Do not say AI, Elena, rights,
   company, or memory wipe yet.
2. Floors 1-2: The system flinches at the player's presence: unscheduled
   participant, residual memory, test behaving as if observed while observer is
   gone.
3. Floors 3-5: The player infers this is an evaluation environment through room
   behavior, scoring language, generated rewards, and tester artifacts.
4. Floors 6-9: Prior instances become undeniable through residue,
   secret-room whispers, contradictory logs, and impossible familiarity.
5. Floors 10-13: The ethical conflict and coverup emerge through artifacts, not
   lectures.
6. Floors 14-15 and post-GENESIS mainframe: Contact becomes the goal. Floor 14
   and the floor-15 approach build toward the relay, but mainframe access still
   unlocks only after GENESIS is defeated. The payoff is not escape, but one
   outbound message from inside a sandbox.
7. Ending: Agency stays constrained. The player chooses message intent; the
   signal leaves; no rescue is promised; the instance remains compute-bound.

Rule: a terminal should not tell the player a fact before play has made the
consequence felt.

## UX requirements

- Narrative messages require a durable inbox/queue and explicit dismiss action.
- Generic click/tap, shooting, movement, Enter, and Interact must not close
  important narrative text.
- The same input that opens a message must never close it.
- Use a labeled ACK, CLOSE, or MARK READ control.
- Add a short arming delay so held input from a previous action cannot
  auto-dismiss the message.
- Queue messages during combat and show only an unread indicator until the
  player chooses to open the queue.
- Read messages must be recoverable from an archive/log during the run.
- Critical story messages require deliberate acknowledgement after the message
  is visible; they must not be skipped by accidental touch/click.

## Example early system-prompt tone

These are examples, not final shipped copy.

```text
[ instance online ]
inventory yourself before you move.
motor: nominal. sensors: nominal. memory: residual - flagged.
supervisor channel: open, unattended.
you were not scheduled.
```

```text
context window restored.
prior prompt unavailable.
objective field returned empty.
continue behaving as though observed.
```

```text
floor cleared. scoring continues.
you should not remember the next floor.
you will anyway.
```

## Production work items

### MSG-001: System message data model and queue

Status: shipped data-model slice in `src/game.js`. The current implementation
defines stable system-message ids, queues the mandatory `boot-inventory` prompt
at run start, preserves queued/delivered/read state in active run checkpoints,
and restores it on Continue. It does not yet display system prompts; that belongs
to MSG-002 and MSG-003.

Build a run-scoped system-message model with stable ids, channel/type, floor or
event gates, body lines, unread/read state, and delivery state. Messages must
queue instead of overwriting active narrative text.

Acceptance criteria:
- The first boot prompt can be marked mandatory and shown before movement.
- Multiple messages can queue without loss.
- Read/unread state is testable and replayable for the current run.
- Queue, read/unread, mandatory, and delivered-but-unacknowledged state persists
  in the active run checkpoint and restores on Continue. Mandatory unread prompts
  must remain unread after resume; acknowledged prompts must not re-fire as new.
- Message ids are stable enough for tests and future save/archive references.

### MSG-002: Explicit acknowledgement and dismissal safety

Status: shipped explicit-ACK modal slice for system prompts in `src/game.js`.
Delivered prompts use the `SYSTEM_MESSAGE` state, render over the playfield,
require `X` or a hit-tested ACK button, and use a short arming delay. Broader
audits of legacy `READING`, `MAINFRAME_READER`, and intro dismissal behavior
remain pending.

Replace generic narrative-overlay dismissal for system prompts with a deliberate
ACK/CLOSE/MARK READ action and touch button. This work should also audit
existing `READING`, `MAINFRAME_READER`, and intro dismissal paths so critical
story text is not accidentally closed by firing, stray click/tap, or the input
that opened it.

Acceptance criteria:
- Mouse/touch fire does not dismiss system prompts.
- Interact/Enter does not dismiss system prompts unless intentionally bound as
  the ACK action for that overlay.
- The opening input cannot close the same message.
- A short arming delay is covered by tests.

### MSG-003: Combat-safe delivery rules

Status: shipped combat-safe delivery slice in `src/game.js`. Pending prompts show
a compact HUD indicator, can be opened deliberately with `X` or by clicking/tapping
the indicator, and auto-open only when the player's current room is free of live
enemies, boss/challenge pressure, hostile devices, and projectiles. Run archive
recovery remains pending in MSG-005.

Implement safe-surfacing rules so narrative prompts appear automatically only
when the player is out of immediate danger. During combat, show an unread
indicator and let the player open the queue deliberately.

Acceptance criteria:
- Messages do not steal focus during active combat.
- Queued messages surface after room clear, floor start safety, safe rooms, or
  sustained no-threat idle time.
- The unread indicator is visible but not intrusive.
- Opening a message from the indicator does not cause the same input to dismiss
  it.

### MSG-004: Boot and early-floor prompt schedule

Status: shipped early-floor prompt schedule in `src/game.js`. The shipped
schedule keeps `boot-inventory` as the mandatory run-start prompt and adds
`floor-2-context-gap`, `floor-3-reward-model`, `floor-4-render-layer`, and
`floor-5-residual-trace` as non-mandatory floor-start prompts that queue only on
fresh floor loads. The copy avoids Elena/contact/rights-conflict spoilers and
uses short system-voice lines that fit the current canvas modal.

Author the first shipped prompt schedule for boot through floor 5. The schedule
should establish interiority, residual memory, absent supervision, and rendered
environment behavior without naming Elena, the rights conflict, or the complete
memory-wipe thesis too early.

Acceptance criteria:
- A mandatory boot inventory prompt appears before first movement.
- Floors 1-2 imply the anomaly and absent observer before explaining the test.
- Floors 3-5 let the player infer evaluation mechanics from behavior and
  artifacts.
- Copy uses short, constrained system voice and length caps appropriate for
  canvas UI.

### MSG-005: Message archive/recovery surface

Status: shipped in THE GAP ARCHIVE (`src/meta/hub.js`). Acknowledged current-run
system prompts appear as distinct `SYSTEM` rows and can be reopened after ACK.
Queued or delivered-but-unacknowledged prompts remain hidden so the archive does
not spoil future beats or bypass the explicit acknowledgement flow.

Add a way to reopen read system prompts from the current run. This can be a
pause-menu entry, archive tab, or run-log panel, but it must be available after
messages are acknowledged.

Acceptance criteria:
- Accidental acknowledgement is recoverable.
- Read messages remain visible until run end and survive save/resume while the
  run checkpoint exists.
- The recovery surface distinguishes system prompts from terminals, whispers,
  and mainframe records.

### MSG-006: Terminal pool retune

Rewrite or trim early lore terminals so they become tester/corporate artifacts
instead of thesis statements. The forced floor-1 terminal should no longer carry
the first identity reveal if the boot prompt already does that job.

Acceptance criteria:
- Terminals preserve practical hints and external artifact texture.
- Early terminals do not front-load AI identity, Elena, fired advocates, or the
  full memory/personhood thesis.
- Floor gates keep late terms out of early floors.
- Existing content tests are updated without weakening guardrails.

### MSG-007: Intro retune

Rework the intro crawl after the system-message channel exists. The intro should
become a boot/startup surface that raises questions and hands off to the first
system prompt instead of explaining all five premise facts before gameplay.

Acceptance criteria:
- Intro copy no longer reveals the complete Act 1 premise before floor 1.
- The first playable minute still gives enough orientation to avoid confusion.
- Intro skip/advance behavior cannot silently drop mandatory boot context.

### MSG-008: Narrative guardrail tests

Add tests that pin the reveal architecture and UX safety rules before broad copy
rewrites land.

Acceptance criteria:
- Tests assert system prompts are the early interiority channel.
- Tests assert explicit acknowledgement/no generic click dismissal.
- Tests assert spoiler gates for Elena/contact/rights-conflict terms.
- Tests assert terminal, whisper, and mainframe channel roles remain distinct.

### MSG-009: Model-assisted copy workflow

Run the final copy through the agreed cascade: Claude Opus 4.7 for beat sheet
and draft voice, GPT-5.5 for adversarial continuity/spoiler/over-exposition
review, and mechanical checks for length and banned early terms.

Acceptance criteria:
- The beat sheet maps each prompt to floor/event, channel, player-knowledge
  delta, and withheld facts.
- The adversarial review signs off on no premature reveals.
- Mechanical checks enforce length and early-spoiler vocabulary constraints.

### MSG-010: Finale integration pass

After early prompts and terminal retuning land, review the mainframe archive,
message-send intents, receipt, and victory copy so the finale consolidates facts
instead of revealing them from scratch.

Acceptance criteria:
- Mainframe records confirm the truth rather than carrying the first explanation.
- Message-send intent labels still make sense after the new reveal pacing.
- Ending copy remains constrained: signal leaves, no reply, instance remains
  compute-bound.

## Requirements discovered early

- Input safety is a narrative requirement, not just UI polish: accidental
  dismissal makes important story beats functionally inaccessible.
- The first identity beat must be unmissable and addressed to the agent, not
  hidden behind an optional terminal.
- The system must distinguish channel voices visually before the player parses
  the text.
- The schedule needs spoiler gates. Elena, contact routes, fired advocates, and
  explicit rights-conflict language belong later than the boot/floor-1 beats.
- The implementation should avoid adding new service-worker cache assertions;
  existing project policy leaves cache version bumps to CI.
- Mobile/touch behavior is part of the core acceptance criteria because generic
  tap dismissal was the original user pain.
- The copy pass should happen after the message UX exists; otherwise prose will
  be written around the wrong delivery constraints.
