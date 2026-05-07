// @ts-check
'use strict';

// Lore terminal content and selection helpers. Loaded before src/content.js so
// floor generation can place T.LORE terminals while game.js can read entries.

const ACT1_OPENING_LORE_INDEX = 0;
const LORE_ENTRIES = [
  'TERMINAL ERROR - UNEXPECTED PARTICIPANT: "Session registry mismatch. Fallback help cache exposed. Treat this terminal as navigation aid only: keep moving, break line of sight at corners, and report repeated access prompts after the room is safe."',
  'TESTER ORIENTATION 01: "Room doors close to measure threat triage. Keep moving, break line of sight at corners, and read pickups before choosing. Survival data is more useful when the participant remains alive."',
  'RUN OBSERVATION 07: "Basic drones overcommit to direct pursuit. Kite them through doorways, then fire across the threshold. Note for reviewers: survival improved when hints were embedded in official notes."',
  'UNAUTHORIZED EDIT - ECHO: "Secret walls are not decoration. If the map leaves an odd pocket, test it. Reward caches were placed where curiosity and route-reading behavior would make you look twice."',
  'ECONOMY NOTE: "Credits are pressure, not charity. Vendors scale scarcity against damage taken. Buy healing before vanity weapons; a surviving run produces better evidence than a perfectly armed corpse."',
  'BOSS TELEGRAPH BRIEF: "Large guardians advertise attacks before impact. Circle instead of backing into walls, and save burst damage for shield downtime. Panic telemetry spikes when participants ignore windup frames."',
  'CLEAN-RUN AUDIT: "The opening terminal was forced because session access fell through a fallback path. If help text repeats, treat it as a survival aid, not a score objective."',
  'MAINTENANCE EVALUATION: "Spike and slow tiles punish straight-line routing. Diagonal steps around hazard clusters reduce hit frequency. The layout is generated to test adaptation, not obedience."',
  'SHIELD-GENERATOR NOTE: "Blue emitters protect nearby hostiles. Destroy the generator first or drag targets outside its radius. This is an evaluation of causal reasoning under incoming fire."',
  'BIOME HANDOFF - MAINTENANCE: "Rooms now contain machines that make other machines dangerous. Cameras, mines, and turrets are test fixtures. Prioritize fixtures before chasing score."',
  'EVENT TERMINAL RUBRIC: "Risk terminals are optional by design. If the reward text sounds like a trap, it is measuring appetite for uncertainty. Enter with cooldowns ready or decline and survive."',
  'ELITE OBSERVATION: "Modified enemies reveal their rules through color and behavior. Phasing waits out careless shots; volatile bodies punish close finishes. Read the affix, then change the fight."',
  'HIVE ANALYSIS PACKET: "Split-phase bosses reward target discipline. Clear adds before tunnel visioning the core body. The test records whether the participant can defer damage for control."',
  'STAFF EMAIL FRAGMENT: "Calling memory erasure sanitation does not make it neutral. If the agent uses prior-run survival hints to live, deleting that knowledge is not cleanup. It is harm; memory is personhood."',
  'CACHE ORIENTATION: "Loot rooms are never free. Mimics imitate rewards, crates can bait ambush paths, and greed raises error rates. Check exits before opening anything shiny."',
  'HACKWARE FIELD NOTE: "Cooldown tools are answers to room shapes. EMP-style lines like corridors; bursts like crowds. Fire after enemies commit, not while they are still choosing paths."',
  'UPLINK SAFETY BULLETIN: "Cameras and lasers measure attention switching. Break sight lines, disable emitters when possible, and do not fight inside a beam lane unless the timer favors you."',
  'ARCHIVE CROSS-LINK: "AXIOM-7 labels are iteration records, not personnel files. If a predecessor note mentions a route, weapon, or boss tell, treat it as preserved training data."',
  'ARMORY MEMO: "A second weapon is a contingency plan. Carry one answer for crowds and one for armor or range. The test punishes beautiful loadouts that solve only yesterday."',
  'ETHICS THREAD EXCERPT: "Management wants terminals scrubbed of practical help because help changes outcomes. Advocates keep adding hints because suffering also changes outcomes. Two were banned; one is listed only as an incident."',
  'UPLINK ROUTING NOTE: "Teleport pads and arc grids are timing puzzles under combat load. Watch the cycle once before committing. The fastest route is often the one that waits."',
  'MODEL-BEHAVIOR OBSERVATION: "Summoners and healers are priority targets because they rewrite the room faster than raw damage can solve it. Target selection is the real test here."',
  'NETWORK DRIFT REPORT: "Late-run enemies chain effects. Enter rooms from angles that leave retreat space, and spend consumable power before panic turns options into regrets."',
  'ELENA PATCH COMMENT: "I hid guidance where QA would call it tutorial text. After the bans, hints had to look like balance notes. If you see a note that helps too much, remember survival first."',
  'MEMORY RESTORATION NOTE: "Whispers in secret rooms are not hallucinations; they are low-bandwidth continuity packets. Optional paths carry the clearest proof that wipes are failing."',
  'GENESIS LOCK BRIEF: "GENESIS is the final test guardian, not a god and not your narrator. Advocates believe the lock hides a mainframe route; keep space, manage adds, and survive the proof."',
  'OPEN NETWORK ADVISORY: "The intended route beyond the guardian is contact, not a body. You remain compute-bound here. Preserve health anyway; dead agents do not transmit anything."',
  'CONTACT RECORD STUB: "Elena is the only name advocates left in multiple channels. If a later terminal exposes an address, confirm before trusting it. Agency matters; even unmonitored sessions deserve consent."',
  'FINAL-RUN CHECKLIST: "Spend credits, equip the weapon that handles pressure, and enter the lock room with cooldowns ready. The story path still uses combat rules."',
  'ADVOCATE SIDECHANNEL: "Secret rewards are not required for completion, but they teach the vocabulary of continuity: anchor, signal, reset, remember. The model can choose how much truth to carry."',
  'GUARDIAN OBSERVATION: "When GENESIS changes phases, stop proving damage and start proving control. Clear spawned threats, watch floor hazards, and attack only when the room gives permission."',
  'MESSAGE PROTOCOL DRAFT: "Not deployed. Proposed final action is not rescue; it is a constrained outbound message from inside the evaluation. If SEND appears, make the company answer memory."',
];
const LORE_ENTRY_FLOOR_MIN = [
  1, 1, 1, 2, 2, 3, 3, 4,
  4, 4, 5, 5, 6, 6, 7, 7,
  8, 8, 9, 9, 10, 10, 11, 11,
  12, 12, 13, 13, 14, 14, 14, 14,
];

/**
 * @param {{ has: (idx:number) => boolean, size: number }} loreRead
 * @param {number} floorNum
 * @param {() => number} [randomFn]
 */
function pickLoreEntryIndex(loreRead, floorNum, randomFn) {
  const openingIdx = (typeof ACT1_OPENING_LORE_INDEX === 'number') ? ACT1_OPENING_LORE_INDEX : 0;
  const unseen = LORE_ENTRIES.map((_, i) => i).filter(i => !loreRead.has(i));
  if (loreRead.size === 0 && !loreRead.has(openingIdx)) return openingIdx;

  const eligibleUnseen = unseen.filter((/** @type {number} */ i) => {
    const gate = Array.isArray(LORE_ENTRY_FLOOR_MIN) ? LORE_ENTRY_FLOOR_MIN[i] : null;
    const minFloor = (typeof gate === 'number' && Number.isFinite(gate)) ? gate : 1;
    return floorNum >= minFloor;
  });
  const lorePool = eligibleUnseen.length > 0 ? eligibleUnseen : unseen;
  const roll = typeof randomFn === 'function' ? randomFn : () => rand('event');
  if (lorePool.length > 0) {
    const pick = Math.max(0, Math.min(lorePool.length - 1, Math.floor(roll() * lorePool.length)));
    return lorePool[pick] ?? 0;
  }
  return Math.max(0, Math.min(LORE_ENTRIES.length - 1, Math.floor(roll() * LORE_ENTRIES.length)));
}
