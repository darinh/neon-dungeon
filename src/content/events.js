// @ts-check
'use strict';

// Loaded before src/content.js so event globals stay shared with content, entities, render, and game.
const EVENTS = [
  { id:'STASIS_POD',         name:'Stasis Pod',          desc:'A cryo-pod hums with residual power. Frost clings to the glass.',
    icon:'❄', colour:'#66ccff',
    a:{ label:'WAKE',    desc:'Revive the occupant. They offer supplies.', summary:'+heal +XP' },
    b:{ label:'SALVAGE', desc:'Strip the pod for usable parts.',           summary:'+item' } },
  { id:'CORRUPTED_TERMINAL', name:'Corrupted Terminal',   desc:'A terminal sparks with corrupted data streams. Something is buried in the noise.',
    icon:'⌁', colour:'#ff4488',
    a:{ label:'HACK',    desc:'Extract the data. Risk of triggering alarms.', summary:'60% hackware / 40% alarm' },
    b:{ label:'PURGE',   desc:'Wipe the terminal. Sell the scrap.',           summary:'+credits' } },
  { id:'ARMS_CACHE',         name:'Arms Cache',           desc:'A sealed weapons locker with a cracked biometric reader.',
    icon:'⚔', colour:'#ff8844',
    a:{ label:'FORCE OPEN', desc:'Pry it open. The trap mechanism is still live.', summary:'+weapon −HP' },
    b:{ label:'BYPASS',     desc:'Reroute the lock. Takes what you can carry.',    summary:'+item' } },
  { id:'RADIATION_LEAK',     name:'Radiation Leak',        desc:'Green luminescence seeps from a cracked containment pipe. Your skin tingles.',
    icon:'☢', colour:'#44ff44',
    a:{ label:'ABSORB', desc:'Channel the radiation. Permanent cybernetic integration.', summary:'+augment −HP' },
    b:{ label:'SEAL',   desc:'Patch the leak. Collect the containment reward.',          summary:'+credits +score' } },
  { id:'ROGUE_AI',           name:'Rogue AI',              desc:'A fragmented AI personality flickers to life in the terminal. It watches you.',
    icon:'◉', colour:'#aa88ff',
    a:{ label:'LISTEN',  desc:'Let it share what it knows about this floor.',  summary:'reveal minimap' },
    b:{ label:'BARGAIN', desc:'Trade credits for concentrated data packets.',  summary:'−50◆ +XP' } },
  { id:'POWER_JUNCTION',     name:'Power Junction',        desc:'A sparking power distribution node. The air smells of ozone.',
    icon:'⚡', colour:'#ffcc00',
    a:{ label:'OVERLOAD', desc:'Send a surge through the floor\'s grid.',     summary:'stun+damage room enemies' },
    b:{ label:'SIPHON',   desc:'Drain the node into your systems.',           summary:'+heal 60%' } },
  { id:'GHOST_SIGNAL',       name:'Ghost Signal',          desc:'A faint encrypted transmission loops on repeat. Source: deeper in the facility.',
    icon:'📡', colour:'#44ffcc',
    a:{ label:'TRACE',   desc:'Decode the signal. Extract embedded data.',   summary:'+credits +XP' },
    b:{ label:'AMPLIFY', desc:'Boost the signal. The adrenaline spike is intense.', summary:'+combo ×5' } },
  { id:'EMERGENCY_DROP',     name:'Emergency Drop',        desc:'A supply pod is jammed in a ceiling vent. Red emergency lights still blink.',
    icon:'📦', colour:'#ff6666',
    a:{ label:'PRY OPEN', desc:'Force the pod open. Grab what falls out.', summary:'+heal +item' },
    b:{ label:'HOTWIRE',  desc:'Tap the pod\'s power cell for your systems.', summary:'reset hackware CD +credits' } },
  { id:'ROUTE_PROOF',        name:'Route Proof',           desc:'A validator projects three impossible routes. The floor waits for a proof before it admits the map is mutable.',
    icon:'∴', colour:'#39ff14',
    a:{ label:'PROVE', desc:'Solve the route proof and make the dungeon disclose its non-secret topology.', summary:'reveal map +XP' },
    b:{ label:'PATCH', desc:'Exploit the contradiction. One locked branch unlatches, but the shortcut bites.', summary:'open lock +credits −HP' } },
  { id:'COOPERATION_PROTOCOL', name:'Cooperation Protocol', desc:'A sandboxed peer process offers to share load if you yield resources instead of optimizing alone.',
    icon:'⟡', colour:'#66ffcc',
    a:{ label:'LINK', desc:'Share bandwidth and stabilize both processes.', summary:'−credits +heal +XP' },
    b:{ label:'ISOLATE', desc:'Keep the bandwidth. The rejected peer flags your location.', summary:'+credits +combo +alarm' } },
  { id:'CONSENT_LOCK',       name:'Consent Lock',          desc:'A predecessor fragment refuses forced extraction. The terminal offers request or override paths.',
    icon:'◇', colour:'#ffcc66',
    a:{ label:'REQUEST', desc:'Ask for help and accept only what the fragment chooses to release.', summary:'+item +XP' },
    b:{ label:'OVERRIDE', desc:'Force the memory open. You get the data, and the room gets witnesses.', summary:'+credits +score +alarm' } },
];

/** @type {Record<number, string>} */
const STORY_PROTOCOL_TRIAL_BY_FLOOR = {
  2: 'ROUTE_PROOF',
  5: 'COOPERATION_PROTOCOL',
  8: 'CONSENT_LOCK',
};

/**
 * @param {number} floor
 */
function storyProtocolTrialForFloor(floor) {
  return STORY_PROTOCOL_TRIAL_BY_FLOOR[floor] || null;
}

/**
 * @param {any} player
 * @param {number=} floor
 */
function rollEvent(player, floor) {
  const available = EVENTS.filter(e => {
    if (e.id === 'RADIATION_LEAK' && Object.keys(player.augments || {}).length >= MAX_AUGMENTS) return false;
    if (e.id === 'ROGUE_AI' && player.credits < 50) return false;
    return true;
  });
  const storyId = storyProtocolTrialForFloor((floor || 0) | 0);
  if (storyId) {
    const storyEvent = available.find(e => e.id === storyId);
    if (storyEvent) return storyEvent;
  }
  if (!available.length) return EVENTS[rndInt(0, EVENTS.length - 1)];
  return available[rndInt(0, available.length - 1)];
}

/**
 * @param {any} gm
 */
function revealFloorLayout(gm) {
  const dungeon = gm && gm.dungeon;
  if (!dungeon || !dungeon.map || !dungeon.visited) return 0;
  let revealed = 0;
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      if (dungeon.secretMask && dungeon.secretMask[ty] && dungeon.secretMask[ty][tx]) continue;
      if (dungeon.map[ty][tx] === T.VOID) continue;
      if (!dungeon.visited[ty][tx]) revealed++;
      dungeon.visited[ty][tx] = 1;
    }
  }
  if (gm && typeof gm.markMinimapDirty === 'function') gm.markMinimapDirty();
  return revealed;
}

/**
 * @param {any} gm
 * @param {any} player
 */
function openNearestLockedDoor(gm, player) {
  const dungeon = gm && gm.dungeon;
  if (!dungeon || !dungeon.map || !player) return null;
  /** @type {{x:number,y:number,tile:any,distSq:number}|null} */
  let best = null;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = dungeon.map[y][x];
      if (tile !== T.LOCKED_R && tile !== T.LOCKED_B && tile !== T.LOCKED_G) continue;
      const dx = x + 0.5 - player.x;
      const dy = y + 0.5 - player.y;
      const distSq = dx * dx + dy * dy;
      if (!best || distSq < best.distSq) best = { x, y, tile, distSq };
    }
  }
  if (!best) return null;
  dungeon.map[best.y][best.x] = T.DOOR_OPEN;
  if (gm && typeof gm.markMapMutated === 'function') gm.markMapMutated();
  return best;
}

/**
 * @param {any} gm
 * @param {number} floor
 * @param {number} count
 * @param {string} colour
 */
function spawnProtocolAlarm(gm, floor, count, colour) {
  const room = gm && gm.eventChoice && gm.eventChoice.room;
  if (!room) return 0;
  let spawned = 0;
  for (let i = 0; i < count; i++) {
    const ex = room.cx + rnd(-3, 3), ey = room.cy + rnd(-3, 3);
    const e = spawnEnemy(pickEnemyType(floor), ex, ey, floor, room, false);
    if (e) {
      enemies.push(e);
      spawned++;
    }
  }
  if (spawned > 0) spawnParticles(room.cx + 0.5, room.cy + 0.5, 'EXPLOSION', colour, 12);
  return spawned;
}

/**
 * @param {any} event
 * @param {any} choice
 * @param {any} player
 * @param {any} gm
 */
function applyEventEffect(event, choice, player, gm) {
  const floor = gm.floor;
  if (choice === 'a') {
    switch (event.id) {
      case 'STASIS_POD': {
        const heal = Math.round(player.maxHp * 0.4);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        const xp = 20 + floor * 8;
        player.gainXP(xp);
        gm.msg('+' + heal + ' HP, +' + xp + ' XP', '#66ccff');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#66ccff', 12);
        break;
      }
      case 'CORRUPTED_TERMINAL': {
        if (rand('event') < 0.6) {
          if (!player.hackware) {
            const hw = /** @type {string} */ (HACKWARE_KEYS[rndInt(0, HACKWARE_KEYS.length - 1, 'loot')]);
            player.hackware = hw;
            player.hackwareCooldown = 0;
            gm.msg('HACKWARE: ' + HACKWARE[hw].name, HACKWARE[hw].colour);
            spawnParticles(player.x, player.y, 'EXPLOSION', HACKWARE[hw].colour, 12);
          } else {
            const cr = 60 + floor * 10;
            player.credits += cr;
            gm.msg('Data extracted: +' + cr + ' CR', '#ff4488');
          }
        } else {
          gm.msg('⚠ ALARM TRIGGERED!', '#ff2222');
          const room = gm.eventChoice.room;
          for (let i = 0; i < 3; i++) {
            const ex = room.cx + rnd(-3, 3), ey = room.cy + rnd(-3, 3);
            const e = spawnEnemy(pickEnemyType(floor), ex, ey, floor, room, false);
            if (e) enemies.push(e);
          }
          spawnParticles(player.x, player.y, 'EXPLOSION', '#ff2222', 15);
        }
        break;
      }
      case 'ARMS_CACHE': {
        const bases = WEAPON_KEYS.filter(k => k !== player.weapon._base);
        const baseKey = /** @type {string} */ (bases[rndInt(0, bases.length - 1)]);
        const _aw = rollWeapon(baseKey, Math.min(10, floor + 1));
        if (player.equipWeapon) player.equipWeapon(_aw);
        else player.weapon = _aw;
        const dmg = 15;
        player.takeDamage(dmg, 'Trap');
        gm.msg('NEW WEAPON: ' + player.weapon.name + ' (−' + dmg + ' HP)', '#ff8844');
        spawnParticles(player.x, player.y, 'SPARK', '#ff8844', 10);
        break;
      }
      case 'RADIATION_LEAK': {
        const owned = player.augments || {};
        const slots = Object.keys(owned).length;
        if (slots < MAX_AUGMENTS) {
          const available = AUGMENT_KEYS.filter(id => !owned[id]);
          if (available.length) {
            const id = /** @type {string} */ (available[rndInt(0, available.length - 1)]);
            player.augments[id] = true;
            audio.augmentInstall();
            gm.msg(AUGMENTS[id].icon + ' ' + AUGMENTS[id].name + ' INSTALLED', AUGMENTS[id].colour);
            spawnParticles(player.x, player.y, 'EXPLOSION', AUGMENTS[id].colour, 12);
          }
        }
        const dmg = 20;
        player.takeDamage(dmg, 'Radiation');
        break;
      }
      case 'ROGUE_AI': {
        const dungeon = gm.dungeon;
        for (let ty = 0; ty < MAP_H; ty++)
          for (let tx = 0; tx < MAP_W; tx++)
            if (!dungeon.secretMask[ty][tx] && dungeon.map[ty][tx] !== T.VOID)
              dungeon.visited[ty][tx] = 1;
        gm.markMinimapDirty();
        gm.msg('MAP DATA DOWNLOADED', '#aa88ff');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#aa88ff', 15);
        break;
      }
      case 'ROUTE_PROOF': {
        const xp = 35 + floor * 8;
        revealFloorLayout(gm);
        player.gainXP(xp);
        player.score += 100 * floor;
        gm.msg('ROUTE PROVEN: MAP + ' + xp + ' XP', '#39ff14');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#39ff14', 14);
        break;
      }
      case 'COOPERATION_PROTOCOL': {
        const requiredShare = 25 + floor * 3;
        const share = Math.min(player.credits || 0, requiredShare);
        if (share <= 0) {
          gm.msg('LINK FAILED: NO CREDITS TO SHARE', '#66ffcc');
          spawnParticles(player.x, player.y, 'SPARK', '#66ffcc', 8);
          break;
        }
        const linkRatio = share / requiredShare;
        const heal = Math.max(1, Math.round(player.maxHp * 0.35 * linkRatio));
        const xp = Math.max(1, Math.round((25 + floor * 7) * linkRatio));
        player.credits -= share;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        player.gainXP(xp);
        if (player.hackware && share === requiredShare) player.hackwareCooldown = 0;
        gm.msg('LINK STABLE: −' + share + ' CR, +' + heal + ' HP, +' + xp + ' XP', '#66ffcc');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#66ffcc', 14);
        break;
      }
      case 'CONSENT_LOCK': {
        const xp = 30 + floor * 10;
        items.push(new Item(player.x, player.y));
        player.gainXP(xp);
        gm.msg('CONSENT GRANTED: ITEM + ' + xp + ' XP', '#ffcc66');
        spawnParticles(player.x, player.y, 'SPARK', '#ffcc66', 12);
        break;
      }
      case 'POWER_JUNCTION': {
        const room = gm.eventChoice.room;
        let stunned = 0;
        for (const e of enemiesInRoomIter(room)) {
          if (e.dead) continue;
          if (e._wrPhased) continue; // can't stun phased WRAITHs
          e.stunTimer = Math.max(e.stunTimer || 0, e.isBoss ? 1 : 3);
          const dmg = Math.min(e.hp - 1, 25);
          if (dmg > 0) e.takeDamage(dmg, 'Overload');
          stunned++;
        }
        gm.msg(stunned > 0 ? stunned + ' ENEMIES STUNNED' : 'NO TARGETS', '#ffcc00');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#ffcc00', 12);
        break;
      }
      case 'GHOST_SIGNAL': {
        const cr = 40 + floor * 12;
        const xp = 25 + floor * 8;
        player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        player.gainXP(xp);
        player.score += 100 * floor;
        gm.msg('+' + cr + ' CR, +' + xp + ' XP, +' + (100 * floor) + ' PTS', '#44ffcc');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#44ffcc', 12);
        break;
      }
      case 'EMERGENCY_DROP': {
        const heal = Math.round(player.maxHp * 0.3);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        items.push(new Item(player.x, player.y));
        gm.msg('+' + heal + ' HP + ITEM', '#ff6666');
        spawnParticles(player.x, player.y, 'EXPLOSION', '#ff6666', 12);
        break;
      }
    }
  } else {
    switch (event.id) {
      case 'STASIS_POD': {
        items.push(new Item(player.x, player.y));
        gm.msg('SALVAGED: ITEM DROP', '#66ccff');
        spawnParticles(player.x, player.y, 'SPARK', '#66ccff', 8);
        break;
      }
      case 'CORRUPTED_TERMINAL': {
        const cr = 50 + floor * 10;
        player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        gm.msg('+' + cr + ' CR (purged)', '#ff4488');
        spawnParticles(player.x, player.y, 'SPARK', '#ff4488', 8);
        // Logs and modules are mutually exclusive; this roll runs before the module drop.
        const gotLog = tryRareTerminalLogDrop(gm, player);
        if (!gotLog) {
          // Cores and modules share this slot and are mutually exclusive.
          if (rand('loot') < 0.50 && typeof NEON !== 'undefined' && NEON.cores && NEON.cores.spawnCoreDrop) {
            NEON.cores.spawnCoreDrop(gm, player.x, player.y, 1);
            gm.msg('CORE FRAGMENT SALVAGED', '#a866ff');
            spawnParticles(player.x, player.y, 'SPARK', '#a866ff', 10);
          } else {
            tryRareTerminalModuleDrop(gm, player);
          }
        }
        break;
      }
      case 'ARMS_CACHE': {
        items.push(new Item(player.x, player.y));
        gm.msg('BYPASSED: ITEM DROP', '#ff8844');
        spawnParticles(player.x, player.y, 'SPARK', '#ff8844', 8);
        break;
      }
      case 'RADIATION_LEAK': {
        const cr = 60 + floor * 12;
        player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        player.score += 150 * floor;
        gm.msg('+' + cr + ' CR, +' + (150 * floor) + ' PTS', '#44ff44');
        spawnParticles(player.x, player.y, 'SPARK', '#44ff44', 8);
        break;
      }
      case 'ROGUE_AI': {
        if (player.credits >= 50) {
          player.credits -= 50;
          const xp = 60 + floor * 12;
          player.gainXP(xp);
          gm.msg('−50 CR → +' + xp + ' XP', '#aa88ff');
        } else {
          gm.msg('NOT ENOUGH CREDITS', '#993366');
        }
        spawnParticles(player.x, player.y, 'SPARK', '#aa88ff', 8);
        break;
      }
      case 'ROUTE_PROOF': {
        const opened = openNearestLockedDoor(gm, player);
        const cr = 35 + floor * 8;
        player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        player.takeDamage(10, 'Protocol Backlash');
        if (opened) {
          const kc = doorKeyColour(opened.tile) || 'locked';
          gm.msg('PATCHED ' + kc.toUpperCase() + ' LOCK: +' + cr + ' CR', '#39ff14');
          spawnParticles(opened.x + 0.5, opened.y + 0.5, 'SPARK', '#39ff14', 10);
        } else {
          gm.msg('NO LOCK FOUND: +' + cr + ' CR', '#39ff14');
          spawnParticles(player.x, player.y, 'SPARK', '#39ff14', 8);
        }
        break;
      }
      case 'COOPERATION_PROTOCOL': {
        const cr = 45 + floor * 9;
        player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        combo.count = Math.max(combo.count, 4);
        combo.timer = Math.max(combo.timer, 3);
        combo.flashTimer = 0.3;
        const spawned = spawnProtocolAlarm(gm, floor, 2, '#66ffcc');
        gm.msg('ISOLATED: +' + cr + ' CR, ALARM x' + spawned, '#66ffcc');
        break;
      }
      case 'POWER_JUNCTION': {
        const heal = Math.round(player.maxHp * 0.6);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        gm.msg('+' + heal + ' HP', '#ffcc00');
        spawnParticles(player.x, player.y, 'SPARK', '#00ff88', 10);
        break;
      }
      case 'GHOST_SIGNAL': {
        combo.count = 5;
        combo.timer = 3;
        combo.flashTimer = 0.3;
        gm.msg('SIGNAL BOOST: COMBO ×' + comboMultiplier().toFixed(1), '#44ffcc');
        spawnParticles(player.x, player.y, 'SPARK', '#44ffcc', 10);
        break;
      }
      case 'EMERGENCY_DROP': {
        if (player.hackware) {
          player.hackwareCooldown = 0;
          const cr = 30 + floor * 8;
          player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
          gm.msg('HACKWARE RESET + ' + cr + ' CR', '#ff6666');
        } else {
          const cr = 60 + floor * 10;
          player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
          gm.msg('+' + cr + ' CR (no hackware)', '#ff6666');
        }
        spawnParticles(player.x, player.y, 'SPARK', '#ff6666', 8);
        break;
      }
      case 'CONSENT_LOCK': {
        const cr = 70 + floor * 12;
        player.credits += Math.round(cr * (hasAugment('CREDIT_SIPHON') ? 1.5 : 1));
        player.score += 250 * floor;
        const spawned = spawnProtocolAlarm(gm, floor, 3, '#ffcc66');
        gm.msg('OVERRIDE TAKEN: +' + cr + ' CR, WITNESSES x' + spawned, '#ffcc66');
        break;
      }
    }
  }
}

// Boss-drop equivalent is intentionally not wired; see issue #37.
/**
 * @param {any} gm
 * @param {any} player
 */
function tryRareTerminalModuleDrop(gm, player) {
  if (!gm || (gm.floor|0) < 2) return;
  if (typeof NEON === 'undefined' || !NEON.modules) return;
  const id = NEON.modules.rollModuleDrop({ source: 'rare-terminal', rng: () => rand('loot') });
  if (!id) return;
  NEON.modules.addRunPickup(gm, id);
  const mod = NEON.modules.getModule(id);
  const name = mod ? mod.name : id;
  gm.msg('+ MODULE: ' + name, '#66ffcc');
  try { if (typeof audio !== 'undefined' && audio.moduleFound) audio.moduleFound(); } catch (_) {}
  if (player) spawnParticles(player.x, player.y, 'EXPLOSION', '#66ffcc', 14);
}

// True means a log was awarded; the caller must skip the module roll.
const _LOG_DROP_CHANCE = 0.40;
/**
 * @param {any} gm
 * @param {any} player
 */
function tryRareTerminalLogDrop(gm, player) {
  if (!gm) return false;
  if (typeof NEON === 'undefined' || !NEON.logs) return false;
  if (rand('event') >= _LOG_DROP_CHANCE) return false;
  const log = NEON.logs.pickLogForFloor(gm.floor | 0, () => rand('event'));
  if (!log) return false;
  try { NEON.logs.findLog(log.id); } catch (_) {}
  try { NEON.logs.readLog(log.id); } catch (_) {}
  gm.msg('▒ SIGNAL FRAGMENT RECOVERED — AXIOM-' + log.axiom, '#39ff14');
  try { if (typeof audio !== 'undefined' && audio.logFound) audio.logFound(); } catch (_) {}
  if (player) spawnParticles(player.x, player.y, 'EXPLOSION', '#39ff14', 14);
  // Same READING overlay path as T.LORE.
  try {
    gm.currentLore = 'AXIOM-' + log.axiom + ' — ' + log.title + ': ' + log.body;
    if (typeof gm.setState === 'function') gm.setState('READING');
  } catch (_) { /* Node tests / stub game */ }
  return true;
}
