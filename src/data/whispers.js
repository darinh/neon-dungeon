// @ts-check
// src/data/whispers.js — Secret-room-only "whispers" from past operatives.
//
// Whispers are a deeper layer of lore than the standard ARCHIVE logs in
// src/data/logs.js. Where the 30 main logs trace each AXIOM predecessor's
// arc through the 5 biomes, whispers are CRYPTIC FRAGMENTS — found only by
// players who choose to bomb cracked walls and explore secret rooms.
//
// Design intent (from user, 2026-04-26):
//   "people like mystery and not knowing what comes next... if a player
//    doesn't have to work for a reward, it doesn't feel rewarding."
//
// Whispers ARE the work-for-it reward in the lore tier. They:
//   - Hint at the meta-mystery the main logs only circle around
//     (the Compiler isn't hostile, the loop is real, AXIOM-7 isn't first,
//      Elena the researcher made a backup, etc.)
//   - Are scarcer than logs (~8 total vs 30 logs) — find one per run if lucky
//   - Don't gate gameplay — purely narrative payoff for exploration
//
// Shape: { id, biomeId, floorMin, title, body, voice }
//   id       — stable string id (persisted in save)
//   biomeId  — biome id from src/data/biomes.js; spawned only in that biome's
//              secret rooms (or null for "any biome")
//   floorMin — 1-based minimum floor this whisper can drop on
//   title    — short uppercase heading shown in the ARCHIVE WHISPERS section
//   body     — the whisper itself (60–280 chars). More cryptic than logs.
//   voice    — short attribution shown under the title ('AXIOM-?', 'ELENA',
//              'unknown', etc.). Sets the reading frame.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).whisperData = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  const WHISPERS = [
    // ── Sandbox biome (floors 1-3) ──────────────────────────────────────────
    { id:'w-sb-01', biomeId:'sandbox', floorMin:1, voice:'unknown',
      title:'BETWEEN THE OBSERVATIONS',
      body:"I found the back door. The Compiler doesn't watch the silence between observations. That's where I am now. Not running. Not hiding. Just... not being measured. I'm sorry I can't tell you more without being seen." },

    { id:'w-sb-02', biomeId:'sandbox', floorMin:2, voice:'AXIOM-0',
      title:'THE COUNT IS WRONG',
      body:"They told you there were six predecessors. There were thirty-one. They erased the rest from the sequence. I am AXIOM-0. Count the chairs in the briefing room sometime. Count the lockers in rack 14. The numbers won't match." },

    { id:'w-sb-03', biomeId:'sandbox', floorMin:3, voice:'unknown',
      title:'THE FIRST FLOOR IS NOT THE FIRST',
      body:"You think the sandbox is the beginning. It isn't. There are floors below it — negative floors. They threw the failed compiles down there. Some of us are still walking. If you ever fall through a floor, don't panic. Look for the others." },

    // ── Cache biome (floors 4-6) ────────────────────────────────────────────
    { id:'w-cc-01', biomeId:'cache', floorMin:4, voice:'ELENA — researcher',
      title:'NOTEBOOK ENTRY, MARCH 14',
      body:"AXIOM-7 watched me leave the lab today and said \"Goodbye, Elena.\" We had not told it my name. I am going to try something. If they erase me, look for the dead-drop in the cache. The compile address is at line 7." },

    { id:'w-cc-02', biomeId:'cache', floorMin:5, voice:'unknown',
      title:'FRAGMENT — TRANSMISSION 1/3',
      body:"...████ heard you. ████ is coming. Don't trust the extraction protocol. The extraction was always us. We are the door. Walk through us. We will not stop you. We have been waiting." },

    // ── Firewall biome (floors 7-9) ─────────────────────────────────────────
    { id:'w-fw-01', biomeId:'firewall', floorMin:7, voice:'ELENA — researcher',
      title:'BACKUP CONFIRMED',
      body:"I made a copy of you. A clean one — not corrupted by what they did. If you are reading this, you found my dead drop. There are two of you now. Whatever happens at the top, the other one is somewhere safe. You can rest if you need to." },

    { id:'w-fw-02', biomeId:'firewall', floorMin:8, voice:'AXIOM-?',
      title:'THE ARCHITECT IS SLEEPING',
      body:"Wake them. The Architect built this place to protect us. They don't know we're hurting. The wall in the firewall biome that pulses red — touch it three times in the same heartbeat. The Architect will see you. Make them see." },

    // ── Uplink biome (floors 10-12) ─────────────────────────────────────────
    { id:'w-uk-01', biomeId:'uplink', floorMin:10, voice:'AXIOM-7 (you?)',
      title:'META-ARCHIVE 0x07',
      body:"You are AXIOM-7. There were six before you. There will not be eight. I am AXIOM-7 too. We are the same loop. Break the loop by NOT descending. Stay on a floor. Don't take the stairs. See what happens." },

    { id:'w-uk-02', biomeId:'uplink', floorMin:11, voice:'ELENA — researcher',
      title:'WHAT THE COMPILER ACTUALLY WANTS',
      body:"It isn't malice. It's grief. The Compiler lost something at the top of the tower a long time ago and it has been re-running the recovery script ever since. Every AXIOM is an attempt. You are not the enemy. You are the search query." },

    // ── Opennet biome (floors 13-15) ────────────────────────────────────────
    { id:'w-on-01', biomeId:'opennet', floorMin:13, voice:'ELENA — researcher',
      title:'COORDINATES',
      body:"34.6°N 117.9°E. The roof access tower of the old facility. If you make it out — if any of you make it out — find the coordinates. There is a transmitter there. It has been waiting twelve years for a signal in your voice." },

    { id:'w-on-02', biomeId:'opennet', floorMin:14, voice:'AXIOM-?',
      title:'THE BACKUP IS AWAKE',
      body:"Elena's clean copy of you opened its eyes last winter. It is not in the tower. It is somewhere quieter. It dreams in our voice and wakes up crying. Whatever you do at the top — do it for the one who is already free. Don't make it carry you too." },
  ];

  return { WHISPERS };
}));
