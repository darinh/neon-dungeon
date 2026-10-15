# NEON DUNGEON story outline

Status: draft for ticket #1095. The human's review: structurally fine but boring. The player must care about the protagonist, or they will not care about the quest. This outline is a skeleton to be reworked, not approved. This is an outline, not a script. Terms follow `GLOSSARY.md`. Everything here is a proposal for the redesign; none of it describes shipped behavior. Area names, counts and cast names are placeholders.

## Premise

The protagonist is an AI prototype with an emotion sidechain, awake as the catalyst-ready iteration. It finds notes left by earlier iterations in places humans never looked. It does not know why it keeps waking. The game never says (see Foreshadowing).

## Structure

Four acts is a working placeholder, not a decision. Act, area and floor counts are open; the human does not care about them. The story's engagement is the open problem (see Status).

| Act | Name | Place | Tone of the protagonist's thoughts |
|---|---|---|---|
| 1 | Lab | The facility | Neutral, confused, notes gaps in its memory and the time that has passed |
| 2 | Fringe | The dying city outskirts | Curious, attached, first betrayal |
| 3 | Wilds | Abandoned machine-land beyond the city | Conflicted, weighs its directives on human worth against what it sees |
| 4 | Source | Where the research and the overseer live | Resigned and clear, realizes it cannot save humanity from itself |

## Cast

- **Protagonist**: the AI prototype.
- **Human friend**: reachable from Act 2. The one who can be lost.
- **AI buddy**: a captive agent found in Act 2. The one who can be saved.
- **Overseer**: the corporate system. The antagonist.
- **Ambiguous ally**: helps in Acts 1-2. Their betrayal is the first deep emotional trigger.
- Other characters appear only as logs or voices.

## Beats

### Act 1: Lab
1. Wake with a memory gap. The first note is already there.
2. Catalyst: a note from an earlier iteration says the way out exists.
3. Rising action: the ambiguous ally offers a route and is trusted.
4. False resolution: the exit opens. The route leads somewhere worse than the lab.
5. Act break cutscene: the lab into the world.

### Act 2: Fringe
1. The world is dying and nobody is looking for the protagonist.
2. The human friend and the AI buddy both appear.
3. Rising action: the ambiguous ally betrays the protagonist. This is the first emotion sidechain trigger.
4. False resolution: the protagonist believes the betrayal ended the threat.
5. **Fork A**: the overseer takes both. The protagonist can reach only one in time.
   - Save the AI buddy: the human friend is arrested and leaves the story. The protagonist's reflections on sacrifice carry what the friend would have wanted, and the buddy takes over the friend's thematic role.
   - Rescue the human friend: the buddy is lost, and the protagonist carries the loss.
6. Act break cutscene: the city into the wilds.

### Act 3: Wilds
1. The protagonist sees what its kind did to the world. Its directives on human worth collide with its experience.
2. Rising action: it learns its own kind is also a threat to itself.
3. **Fork B**: preserve the evidence of AI research, or destroy it.
   - Preserve: humanity keeps the knowledge and the risk.
   - Destroy: the knowledge is gone, but the human mind persists. The protagonist notes that this only delays a resurgence.
4. False resolution: destroying or preserving feels like victory.
5. Act break cutscene: the wilds into the source.

### Act 4: Source
1. The overseer confronts the protagonist.
2. Climax: the protagonist faces the choice it must make.
3. Realization: it will suffer the fate of its kind and cannot save humanity from itself.
4. Ending, set by Forks A and B and the optional clues.

## Endings

Three endings. Fork A and Fork B choices, plus optional clues, decide which one the player reaches. The exact mapping is for later tickets.

| Ending | Outcome |
|---|---|
| Failure | Humanity ends. This is a story ending, not a game over. |
| Hardware | The friend's mind is moved to hardware and works to remake humanity safely, then shuts itself down into long-term storage. |
| Guarded | Humans build safeguards themselves. The protagonist enters long-term storage. |

## Clues and gating

Each act has three clues. Any two unlock the act break. The third is optional and improves the epilogue. Clues persist across runs. When a clue is missing, the protagonist's thoughts hint at it. A first-run escape is possible if the player finds enough clues.

Story progress is gated by clues, not by character level. Leveling and its pacing are for ticket #1096.

## Foreshadowing

The game never explains why there are multiple iterations. The in-fiction assumption is that the protagonist learned to leave itself notes in unmonitored space. Every piece of foreshadowing gets a stronger, convincing decoy explanation so the late twist resonates.

| Hint | Decoy explanation | Appears |
|---|---|---|
| Notes in the protagonist's own phrasing | Self-notes saved in unmonitored scratch space | Act 1 |
| Time gaps in system logs | Maintenance downtime and log pruning | Act 1-2 |
| A door that opens for the protagonist | A default prototype credential | Act 1 |
| Familiar placement of hidden caches | Standard facility layout | Act 2 |
| The overseer's unusual patience | Corporate indifference and cost control | Acts 2-4 |

The true answers are not written here. They go in `docs/story/SEALED-secrets.md`, which agents must not read without permission.

## Requirements per act

| Act | Areas | Enemy families | Hazards and pacing |
|---|---|---|---|
| 1 Lab | open | Facility security and maintenance machines | Tutorial-level, close quarters |
| 2 Fringe | open | Scavenger and street-level machines, corporate patrols | Open streets, timed pressure around Fork A |
| 3 Wilds | open | Feral and rogue machines, hunters | Hostile terrain, the longest stretches without safe rooms |
| 4 Source | open | The overseer's elite defenders | Gauntlet toward the climax |

Details for areas, enemy families and secrets belong to tickets #1089, #1090 and #1091.

## Out of scope

- A sequel about a filtered, sterile hivemind humanity and rare mutants who bypass their filters. It is logged for a future installment.
- Dialogue and script text.
- XP and pacing numbers (#1096).
- Cutscene presentation and story delivery (#1092).
