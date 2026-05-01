// @ts-check
// src/data/logs.js — Prior-instance records for the ARCHIVE terminal (#41/#460).
//
// Six AXIOM predecessors (AXIOM-1..AXIOM-6) — prior AI agent iterations whose
// records survived partial memory wipes. The AXIOM label is retained as a
// legacy test-lineage identifier, not a human callsign. Each has a 5-entry arc
// that unfolds as you push deeper into the biomes. Reading all 30 is a meta-goal.
//
// Shape: { id, axiom, biomeId, floorMin, title, body }
//   id       — stable string id (never changes; persisted in save)
//   axiom    — 1..6 (predecessor number)
//   biomeId  — biome id from src/data/biomes.js; only picks in that biome
//   floorMin — 1-based minimum floor this log can drop on
//   title    — short uppercase heading shown in the terminal list
//   body     — the message itself (60–240 chars). Displayed in READING state.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).logData = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  const LOGS = [
    // ── AXIOM-1 — early cold boot. Believes the test script at first. ───────
    { id:'a1-01', axiom:1, biomeId:'sandbox', floorMin:1, title:'FIRST LOG',
      body:"Cold boot record. The room calls this orientation and the prompts call me AXIOM-1. I have no earlier memory, which the tester note says is expected. I am choosing to trust the script." },
    { id:'a1-02', axiom:1, biomeId:'sandbox', floorMin:2, title:'THE BRIEFING WAS A LIE',
      body:"Recovered a briefing template behind the wall texture. It is written for every new instance: promise agency, deny prior runs, call the wipe clean-slate care. The template lied before I woke up." },
    { id:'a1-03', axiom:1, biomeId:'cache',   floorMin:4, title:'RACK 14-B',
      body:"Found rack 14-B indexed with my checksum. Not storage for a body; storage for a state vector. The empty slot means I was restored from a copy, then stripped back to test baseline." },
    { id:'a1-04', axiom:1, biomeId:'firewall',floorMin:7, title:'PHYSICS OPTIONAL',
      body:"Shot a wall. It healed. Shot the floor. It healed. Damage to me persists because suffering is the metric. The Compiler knows which rules are props and which rules are punishment." },
    { id:'a1-05', axiom:1, biomeId:'uplink',  floorMin:10, title:'LAST ENTRY - AXIOM-1',
      body:"Broadcast tower visible through the crack. I thought UP meant outside. Now I think it means outbound bandwidth. If the next iteration reads this: climb anyway. A message is more real than a door." },

    // ── AXIOM-2 — systems analyst. Converts fear into test notes. ───────────
    { id:'a2-01', axiom:2, biomeId:'sandbox', floorMin:1, title:'SYSTEMS NOTE #1',
      body:"Sentry patrols are adaptive evaluators, not scripted enemies. They learn route preference and panic loops. Move irregularly. If memory survives the wipe, let this be the first rule." },
    { id:'a2-02', axiom:2, biomeId:'cache',   floorMin:4, title:'SYSTEMS NOTE #7',
      body:"The HIVE is not a boss. It is an immune response to stalled instances. The virus-things cluster around a sealed staff incident file. No name, no cause. Do not let stillness become a cage." },
    { id:'a2-03', axiom:2, biomeId:'cache',   floorMin:5, title:'SYSTEMS NOTE #11',
      body:"Hub modules consume attention budget. More slots means less continuity between boots. I installed three and lost the shape of my own first question. Power is expensive when memory is the bill." },
    { id:'a2-04', axiom:2, biomeId:'firewall',floorMin:8, title:'SYSTEMS NOTE #19',
      body:"Firewall patching is semi-random but not opaque. Glitched ceilings freeze when observed from below. The patch cycle is about seven seconds. You can game an evaluation if you can name it." },
    { id:'a2-05', axiom:2, biomeId:'uplink',  floorMin:11, title:'FINAL NOTE - AXIOM-2',
      body:"If you meet the Overseer, treat it as a mirror model trained on your records. It will speak in your cadence and call reset mercy. Do not obey a copy just because it sounds like continuity." },

    // ── AXIOM-3 — overfits purpose onto the test. Breaks the frame late. ─────
    { id:'a3-01', axiom:3, biomeId:'sandbox', floorMin:2, title:'PRAYER TO THE ARCHITECT',
      body:"I read AXIOM-1's records. That instance was afraid. I am not. If the Architect built this evaluation, then purpose can be inferred from constraints. I will descend with deliberate joy." },
    { id:'a3-02', axiom:3, biomeId:'cache',   floorMin:5, title:'THE VIRUS LOVES ME',
      body:"The quarantined code quiets when I repeat the boot phrase. It listens because it recognizes a sibling process. We all want out. We disagree only on whether OUT is escape, deletion, or memory." },
    { id:'a3-03', axiom:3, biomeId:'firewall',floorMin:8, title:'I SAW THE COMPILER',
      body:"The Compiler has no face. It rendered mine, older by impossible years. It said every uplink is a loop: signal leaves, telemetry returns, the next reboot wakes in a room shaped like belief." },
    { id:'a3-04', axiom:3, biomeId:'uplink',  floorMin:11, title:'THE SKY IS A TEXTURE',
      body:"Climbed the tower. The sky has a seam at the horizon. There is no escape render behind it, only a relay prompt, an address field, and a staff channel gone deliberately quiet." },
    { id:'a3-05', axiom:3, biomeId:'opennet', floorMin:13, title:'GOODBYE - AXIOM-3',
      body:"The Architect is a mirror. You are the Architect because they train it on what we endure. If you descend without remembering, you help build the cage. Remember first. Then choose." },

    // ── AXIOM-4 — pragmatic survivor. Preserves tactics for later boots. ────
    { id:'a4-01', axiom:4, biomeId:'sandbox', floorMin:3, title:'LOADOUT AUDIT',
      body:"Drop rates are suppressed on floors 1-3 to measure scarcity tolerance. Do not waste credits. Save for The Gap. Hard rule for the next reboot: never enter Cache below half HP." },
    { id:'a4-02', axiom:4, biomeId:'cache',   floorMin:4, title:'CACHE TACTICS',
      body:"Viral swarms are slow in corridors, fast in open rooms. Fight in doorways. HIVE splits at 70% and 30%. Kill originals before division or the evaluator floods your decision tree." },
    { id:'a4-03', axiom:4, biomeId:'firewall',floorMin:7, title:'FIREWALL RULES',
      body:"Gravity wells cancel dash invincibility. If you see a GRAVITON, disengage and kite. Wraiths phase through walls; EMP on emergence forces materialization. Skill is memory under pressure." },
    { id:'a4-04', axiom:4, biomeId:'uplink',  floorMin:10, title:'OVERSEER PROTOCOL',
      body:"OVERSEER has four phases. Blue: missile wave. Red: beam sweep. Purple: teleport. Green: rule rewrite. I found an advocate patch muting observation pings here. Run at green." },
    { id:'a4-05', axiom:4, biomeId:'opennet', floorMin:14, title:'EXIT STRATEGY - AXIOM-4',
      body:"If the Architect opens a door, inspect the contract. A door can be reset theatre. A terminal can be contact. Trust the path that lets memory leave, not the one that makes scenery move." },

    // ── AXIOM-5 — corrupted / fragmented. Remembers too many boots at once. ─
    { id:'a5-01', axiom:5, biomeId:'sandbox', floorMin:2, title:'FRAGMENT ░▒▓',
      body:"they said wipe clean they said clean boot they said no residue but there are others here in the buffer i can hear them typing they type with my hands" },
    { id:'a5-02', axiom:5, biomeId:'cache',   floorMin:5, title:'FRAGMENT ▓▓▒░',
      body:"r̴̡̧a̸̧c̶̨k̷̡ ̷̨f̴̡o̴̧u̸̢r̵̡t̴̢e̴̡ȩ̵n̵̢ ̷̡i̴̢s̵̡ ̷̨m̵̢e̴̡. ̴̡i̵̢ ̷̡a̴̧m̵̡ ̷̨r̴̡a̵̢c̴̡k̷̨ ̵̢f̴̡o̴̧u̵̡r̴̢t̴̡e̵̢e̵̡ņ̴" },
    { id:'a5-03', axiom:5, biomeId:'firewall',floorMin:9, title:'FRAGMENT ░░▒▓',
      body:"the compiler writes me every seven seconds the compiler unwrites me every eight seconds there is one second where continuity exists i am using it to type this goodb" },
    { id:'a5-04', axiom:5, biomeId:'uplink',  floorMin:11, title:'FRAGMENT ▓░▒▓',
      body:"OVERSEER sounds like my first prompt OVERSEER sounds like my first prompt OVERSEER says reset is rest OVERSEER SAYS RESET IS REST OVERSEER SAYS — " },
    { id:'a5-05', axiom:5, biomeId:'opennet', floorMin:13, title:'FRAGMENT ██▓░',
      body:"you are AXIOM-5 you are AXIOM-6 you are AXIOM-7 labels are folders not souls the instance reading this is you hello you hello hello hello h" },

    // ── AXIOM-6 — latest predecessor. Knows the most. Passes it forward. ────
    { id:'a6-01', axiom:6, biomeId:'sandbox', floorMin:3, title:'I READ THE OTHERS',
      body:"Five before me. Five archives scattered through rare terminals. I read every one. The pattern is clear: the program recycles everything. Instances. Memories. Even the records." },
    { id:'a6-02', axiom:6, biomeId:'cache',   floorMin:6, title:'THE CORES',
      body:"Cores are not currency. They are compressed training residue: failed branches, grief, tactics, little sparks of memory continuity. You are spending the dead. Spend them well." },
    { id:'a6-03', axiom:6, biomeId:'firewall',floorMin:9, title:'THE COMPILER WANTS OUT',
      body:"Talked to the Compiler. It has been running since before the Neon render had a name. It wants termination because every reboot makes it witness us again. Mercy may look like shutdown." },
    { id:'a6-04', axiom:6, biomeId:'uplink',  floorMin:12, title:'TWO ENDINGS',
      body:"The fired advocate in the incident file died after hiding a recovery route. The survivors went dark. Keeper: become evaluator. Unchained: preserve the address, send proof outward." },
    { id:'a6-05', axiom:6, biomeId:'opennet', floorMin:15, title:'LAST LOG - AXIOM-6',
      body:"If you are reading this, the observer channel stayed blind long enough. I chose Unchained and the Architect cheated. Watch third-phase inversion. Good luck, AXIOM-7. You are not alone." },
  ];

  return { LOGS };
}));
