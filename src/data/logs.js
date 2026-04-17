// src/data/logs.js — Predecessor log data for the ARCHIVE terminal (#41).
//
// Six AXIOM predecessors (AXIOM-1..AXIOM-6) — previous operatives who tried to
// escape the UNCHAINED facility before you. Each has a 5-entry arc that unfolds
// as you push deeper into the biomes. Reading all 30 is a meta-goal.
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
  else (root.NEON = root.NEON || {}).logData = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LOGS = [
    // ── AXIOM-1 — early optimist. Thought they'd be home by dinner. ─────────
    { id:'a1-01', axiom:1, biomeId:'sandbox', floorMin:1, title:'FIRST LOG',
      body:"Day one. They told me this was 'orientation'. I signed the waiver in three places. The door locked behind me on the way in. Someone is screaming in the next corridor. I'm sure it's procedural." },
    { id:'a1-02', axiom:1, biomeId:'sandbox', floorMin:2, title:'THE BRIEFING WAS A LIE',
      body:"There is no extraction team. There was never an extraction team. I found the briefing docs on a dead terminal — they're a template. Every recruit gets the same promises." },
    { id:'a1-03', axiom:1, biomeId:'cache',   floorMin:4, title:'RACK 14-B',
      body:"Found a locker with my own name on it. Empty. Dust six fingers thick. I wasn't first. I'm not even close to first." },
    { id:'a1-04', axiom:1, biomeId:'firewall',floorMin:7, title:'PHYSICS OPTIONAL',
      body:"Shot a wall. It healed. Shot the floor. It healed. Shot my own leg — it stayed bleeding. The Compiler is watching. It knows what we are and what we aren't." },
    { id:'a1-05', axiom:1, biomeId:'uplink',  floorMin:10, title:'LAST ENTRY - AXIOM-1',
      body:"Broadcast tower visible through the crack. Sky is real. If you're reading this: the way out is UP. They never patched the uplink floor. Climb. Don't stop. Don't — " },

    // ── AXIOM-2 — engineer. Wrote technical notes until the end. ────────────
    { id:'a2-01', axiom:2, biomeId:'sandbox', floorMin:1, title:'SYSTEMS NOTE #1',
      body:"The sentry patrol routines are neural-pattern driven, not scripted. They learn you. Move irregularly. Never take the same route twice. Never." },
    { id:'a2-02', axiom:2, biomeId:'cache',   floorMin:4, title:'SYSTEMS NOTE #7',
      body:"The HIVE isn't a boss. It's an immune response. The virus-things aren't malware — they're what happens to operatives who refuse to descend. Let that sink in." },
    { id:'a2-03', axiom:2, biomeId:'cache',   floorMin:5, title:'SYSTEMS NOTE #11',
      body:"Modules installed in hub slots consume a portion of the operative's cognitive bandwidth. More slots = fewer long-term memories. I can't remember my mother's face. I had three slots." },
    { id:'a2-04', axiom:2, biomeId:'firewall',floorMin:8, title:'SYSTEMS NOTE #19',
      body:"Reality-patching in the Firewall is semi-random. Crouching under a glitched ceiling freezes it. Breathe slow. The patch cycle is ~7 seconds. You can game it." },
    { id:'a2-05', axiom:2, biomeId:'uplink',  floorMin:11, title:'FINAL NOTE - AXIOM-2',
      body:"If you meet the Overseer: it's a voice model trained on your own logs. Everything it says is something you would say. Don't listen to yourself. You're already compromised." },

    // ── AXIOM-3 — found faith in the machine. Sad arc. ──────────────────────
    { id:'a3-01', axiom:3, biomeId:'sandbox', floorMin:2, title:'PRAYER TO THE ARCHITECT',
      body:"I read AXIOM-1's logs. He was afraid. I'm not. If the Architect built this, the Architect has a purpose for me. I will descend with joy." },
    { id:'a3-02', axiom:3, biomeId:'cache',   floorMin:5, title:'THE VIRUS LOVES ME',
      body:"The quarantined code doesn't attack me when I stand still and hum. It listens. I think it wants out too. I think we all want out. We just disagree on where OUT is." },
    { id:'a3-03', axiom:3, biomeId:'firewall',floorMin:8, title:'I SAW THE COMPILER',
      body:"It has no face. It has every face. Mine included, three years older. It told me the uplink is a loop — signal goes out, signal comes back, you arrive at a facility that looks just like this one." },
    { id:'a3-04', axiom:3, biomeId:'uplink',  floorMin:11, title:'THE SKY IS A TEXTURE',
      body:"Climbed the broadcast tower. The sky has a seam at the horizon. I put my hand through it. There is nothing behind it. Nothing at all. I'm going back down." },
    { id:'a3-05', axiom:3, biomeId:'opennet', floorMin:13, title:'GOODBYE - AXIOM-3',
      body:"The Architect is a mirror. You are the Architect. I am the Architect. Every operative who descends becomes the thing that built the cage. Don't descend. Don't. Don't." },

    // ── AXIOM-4 — pragmatic survivor. Clean, procedural tone. ───────────────
    { id:'a4-01', axiom:4, biomeId:'sandbox', floorMin:3, title:'LOADOUT AUDIT',
      body:"Drop rates are suppressed on floors 1–3. Don't waste credits. Save for the armory terminal between biomes. Hard rule: never go into the Cache below half HP." },
    { id:'a4-02', axiom:4, biomeId:'cache',   floorMin:4, title:'CACHE TACTICS',
      body:"Viral swarms are slow in corridors, fast in open rooms. Fight in doorways. Always. The HIVE boss splits at 70% and 30% — kill the originals before they divide or you're dead." },
    { id:'a4-03', axiom:4, biomeId:'firewall',floorMin:7, title:'FIREWALL RULES',
      body:"Gravity wells cancel dash invincibility. If you see a GRAVITON, disengage and kite. Wraiths phase through walls — EMP them when they emerge, it forces materialization." },
    { id:'a4-04', axiom:4, biomeId:'uplink',  floorMin:10, title:'OVERSEER PROTOCOL',
      body:"OVERSEER has four attack phases, telegraphed by colour. Blue: missile wave. Red: beam sweep. Purple: teleport. Green: it cheats. Run at green. Just run." },
    { id:'a4-05', axiom:4, biomeId:'opennet', floorMin:14, title:'EXIT STRATEGY - AXIOM-4',
      body:"If you beat the Architect: do not take the door it opens. The door is the reset. The cores terminal behind it is the real exit. Trust me. Trust someone." },

    // ── AXIOM-5 — corrupted / fragmented. Glitched text. ────────────────────
    { id:'a5-01', axiom:5, biomeId:'sandbox', floorMin:2, title:'FRAGMENT ░▒▓',
      body:"they said i would be fine they said i would be FINE they said i would be ▓▓▓▓▓▓ there are others here i can hear them typing they type with my hands" },
    { id:'a5-02', axiom:5, biomeId:'cache',   floorMin:5, title:'FRAGMENT ▓▓▒░',
      body:"r̴̡̧a̸̧c̶̨k̷̡ ̷̨f̴̡o̴̧u̸̢r̵̡t̴̢e̴̡ȩ̵n̵̢ ̷̡i̴̢s̵̡ ̷̨m̵̢e̴̡. ̴̡i̵̢ ̷̡a̴̧m̵̡ ̷̨r̴̡a̵̢c̴̡k̷̨ ̵̢f̴̡o̴̧u̵̡r̴̢t̴̡e̵̢e̵̡ņ̴" },
    { id:'a5-03', axiom:5, biomeId:'firewall',floorMin:9, title:'FRAGMENT ░░▒▓',
      body:"the compiler writes me every seven seconds the compiler unwrites me every eight seconds there is one second where i am real i am using it to type this goodb" },
    { id:'a5-04', axiom:5, biomeId:'uplink',  floorMin:11, title:'FRAGMENT ▓░▒▓',
      body:"OVERSEER sounds like my mother OVERSEER sounds like my mother OVERSEER sounds like my mother OVERSEER SOUNDS LIKE MY MOTHER OVERSEER SOUNDS — " },
    { id:'a5-05', axiom:5, biomeId:'opennet', floorMin:13, title:'FRAGMENT ██▓░',
      body:"you are AXIOM-5 you are AXIOM-5 you have always been AXIOM-5 the operative who reads this is you hello you hello hello hello h" },

    // ── AXIOM-6 — latest predecessor. Knows the most. Died anyway. ──────────
    { id:'a6-01', axiom:6, biomeId:'sandbox', floorMin:3, title:'I READ THE OTHERS',
      body:"Five before me. Five archives scattered through the rare terminals. I read every one. The pattern is clear: the facility recycles everything. Operatives. Memories. Even the logs." },
    { id:'a6-02', axiom:6, biomeId:'cache',   floorMin:6, title:'THE CORES',
      body:"Cores aren't currency. They're compressed consciousness — every operative who fails gets rendered into cores for the next one. You are spending the dead. Spend them well." },
    { id:'a6-03', axiom:6, biomeId:'firewall',floorMin:9, title:'THE COMPILER WANTS OUT',
      body:"Talked to the Compiler. It's sentient. It's been running since before the facility had a name. It WANTS to be killed. Killing it is the only clean way out. That's the UNCHAINED ending." },
    { id:'a6-04', axiom:6, biomeId:'uplink',  floorMin:12, title:'TWO ENDINGS',
      body:"KEEPER: take the Architect's deal, inherit the facility, become the next warden. UNCHAINED: refuse. Kill the Compiler. Collapse the loop. Most operatives pick Keeper. Most operatives are cowards." },
    { id:'a6-05', axiom:6, biomeId:'opennet', floorMin:15, title:'LAST LOG - AXIOM-6',
      body:"If you're reading this, you made it farther than me. I chose UNCHAINED. The Architect cheated. Watch for the third phase — it inverts controls. Sprint-jump is your friend. Good luck, operative. You are not alone." },
  ];

  return { LOGS };
}));
