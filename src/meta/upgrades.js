// src/meta/upgrades.js — UNCHAINED Phase 2 (#36) — persistent UPGRADE MATRIX
//
// Pure data + pure functions for the 12-node upgrade tree spent with cores at
// the hub's UPGRADE MATRIX terminal. Storage and stat-application live in
// save.js; this module owns the node table, cost curve, prereq rules, and the
// terminal-panel renderer/input handler exported for the hub UI (#35) to glue
// in after merge.
//
// Naming note: the persistent meta field is `upgradeNodes` (already in v2
// schema). The issue text calls it `upgradesPurchased`; we reuse the existing
// field rather than introduce a duplicate. See save.js applyMetaToPlayer().
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./save.js'));
  } else {
    const ns = (root.NEON = root.NEON || {});
    ns.upgrades = factory(ns.save);
  }
}(typeof self !== 'undefined' ? self : this, function (save) {
  'use strict';

  // ─── Node Table ────────────────────────────────────────────────────────────
  // 12 nodes: 3 branches × 4 tiers. Capstone nodes (tier 4) are maxLevel 1;
  // naturally-scaling stat nodes are maxLevel 3.
  const UPGRADE_NODES = [
    // Vitality
    { id:'hull_plating', branch:'Vitality', tier:1, baseCost:3,  maxLevel:3, effect:'+10 max HP per level' },
    { id:'regenerator',  branch:'Vitality', tier:2, baseCost:6,  maxLevel:2, effect:'Regen 0.5 HP/s out of combat (per level)' },
    { id:'trauma_kit',   branch:'Vitality', tier:3, baseCost:10, maxLevel:2, effect:'Start each run with 1 nano-medic consumable (per level)' },
    { id:'second_wind',  branch:'Vitality', tier:4, baseCost:18, maxLevel:1, effect:'Revive once per floor at 1 HP when lethally hit' },
    // Damage
    { id:'overclock',     branch:'Damage', tier:1, baseCost:3,  maxLevel:3, effect:'+5% weapon damage per level' },
    { id:'critical_bias', branch:'Damage', tier:2, baseCost:6,  maxLevel:3, effect:'+4% crit chance per level' },
    { id:'momentum',      branch:'Damage', tier:3, baseCost:10, maxLevel:2, effect:'+15% damage for 3s after a kill (per level)' },
    { id:'surge',         branch:'Damage', tier:4, baseCost:18, maxLevel:1, effect:'Every 8th hit deals +100% damage' },
    // Utility
    { id:'recon',     branch:'Utility', tier:1, baseCost:3,  maxLevel:3, effect:'+20% sensor radius (minimap reveal) per level' },
    { id:'scavenger', branch:'Utility', tier:2, baseCost:6,  maxLevel:3, effect:'+1 credit per pickup per level' },
    { id:'ghostwalk', branch:'Utility', tier:3, baseCost:10, maxLevel:2, effect:'Dash has 0.2s extra i-frames (per level)' },
    { id:'hacktool',  branch:'Utility', tier:4, baseCost:18, maxLevel:1, effect:'Start with 1 extra hackware slot (3→4)' },
  ];

  const BRANCHES = ['Vitality', 'Damage', 'Utility'];

  // Index by id and by (branch,tier) for O(1) lookups.
  const BY_ID = Object.create(null);
  const BY_BRANCH_TIER = Object.create(null);
  for (const n of UPGRADE_NODES) {
    BY_ID[n.id] = n;
    BY_BRANCH_TIER[n.branch + ':' + n.tier] = n;
  }

  function getNode(id) { return BY_ID[id] || null; }

  // ─── Cost Curve ────────────────────────────────────────────────────────────
  // Linear: cost of level L (1-indexed) = baseCost × L. So purchasing the next
  // level when currently at level `level` costs baseCost × (level + 1).
  // Returns undefined if the node is unknown or already at maxLevel.
  function nodeCost(id, level) {
    const node = BY_ID[id];
    if (!node) return undefined;
    const cur = Math.max(0, Math.floor(Number(level) || 0));
    if (cur >= node.maxLevel) return undefined;
    return node.baseCost * (cur + 1);
  }

  // Sum of every cost paid to reach `level` from 0: baseCost × L(L+1)/2.
  function _spentForLevel(node, level) {
    const L = Math.max(0, Math.min(node.maxLevel, Math.floor(Number(level) || 0)));
    return node.baseCost * (L * (L + 1)) / 2;
  }

  function totalSpent(meta) {
    if (!meta || !meta.upgradeNodes) return 0;
    let sum = 0;
    for (const node of UPGRADE_NODES) {
      const lv = meta.upgradeNodes[node.id] || 0;
      sum += _spentForLevel(node, lv);
    }
    return sum;
  }

  // ─── Prereqs ───────────────────────────────────────────────────────────────
  // Tier N requires the same-branch tier (N-1) at level >= 1.
  function prereqMet(meta, id) {
    const node = BY_ID[id];
    if (!node) return false;
    if (node.tier <= 1) return true;
    const prev = BY_BRANCH_TIER[node.branch + ':' + (node.tier - 1)];
    if (!prev) return true;
    const owned = (meta && meta.upgradeNodes && meta.upgradeNodes[prev.id]) || 0;
    return owned >= 1;
  }

  // ─── Purchase ──────────────────────────────────────────────────────────────
  // Atomically: load meta, validate, deduct cores, record level, save. Returns
  // { ok, reason?, cost?, level? }. Reasons: 'unknown' | 'maxed' | 'prereq' |
  // 'cores'. Caller is expected to refresh its own view of meta after success.
  //
  // The `meta` argument is accepted for ergonomics (tests can pass a snapshot)
  // but we always re-load from storage to do the mutation atomically — same
  // pattern as save.spendCores. The passed meta is updated in-place to reflect
  // the new state so callers holding a reference see the change.
  function purchase(meta, id) {
    const node = BY_ID[id];
    if (!node) return { ok: false, reason: 'unknown' };

    const m = save.loadMeta();
    if (!m.upgradeNodes || typeof m.upgradeNodes !== 'object') m.upgradeNodes = {};
    const cur = m.upgradeNodes[id] || 0;
    if (cur >= node.maxLevel) return { ok: false, reason: 'maxed' };
    if (!prereqMet(m, id))    return { ok: false, reason: 'prereq' };

    const cost = node.baseCost * (cur + 1);
    if ((m.cores || 0) < cost) return { ok: false, reason: 'cores' };

    m.cores -= cost;
    m.upgradeNodes[id] = cur + 1;
    save.saveMeta(m);

    // Sync passed-in meta snapshot so callers holding a reference see the change.
    if (meta && typeof meta === 'object') {
      if (!meta.upgradeNodes || typeof meta.upgradeNodes !== 'object') meta.upgradeNodes = {};
      meta.upgradeNodes[id] = cur + 1;
      meta.cores = m.cores;
    }
    return { ok: true, cost, level: cur + 1 };
  }

  // ─── Terminal Panel — exported for hub UI (#35) to glue in after merge ─────
  // Selector state shape: { col: 0..2 (branch), row: 0..3 (tier-1) }.
  // The hub will own creation/persistence of selectorState and pass it in.

  function defaultSelectorState() { return { col: 0, row: 0 }; }

  function _nodeAt(col, row) {
    const branch = BRANCHES[col];
    return branch ? BY_BRANCH_TIER[branch + ':' + (row + 1)] || null : null;
  }

  // handleUpgradeInput(key, game, selectorState) → boolean (true if consumed).
  // `key` is a normalized key string ('ArrowUp', 'ArrowDown', 'ArrowLeft',
  // 'ArrowRight', 'Enter'). `game` may expose `game.audio` for sfx and
  // `game.meta` for the live meta snapshot.
  function handleUpgradeInput(key, game, selectorState) {
    const sel = selectorState || defaultSelectorState();
    if (key === 'ArrowLeft')  { sel.col = (sel.col + BRANCHES.length - 1) % BRANCHES.length; return true; }
    if (key === 'ArrowRight') { sel.col = (sel.col + 1) % BRANCHES.length; return true; }
    if (key === 'ArrowUp')    { sel.row = (sel.row + 4 - 1) % 4; return true; }
    if (key === 'ArrowDown')  { sel.row = (sel.row + 1) % 4; return true; }
    if (key === 'Enter' || key === ' ' || key === 'Space') {
      const node = _nodeAt(sel.col, sel.row);
      if (!node) return true;
      const result = purchase((game && game.meta) || null, node.id);
      if (result.ok) {
        const audio = game && game.audio;
        if (audio && typeof audio.upgradePurchased === 'function') {
          try { audio.upgradePurchased(); } catch (_) { /* ignore */ }
        }
      }
      return true;
    }
    return false;
  }

  // drawUpgradeMatrix — renders the 3×4 grid + tooltip on `ctx` within bounds.
  // Pure-ish: depends on canvas API only. Skips draw entirely when ctx is
  // missing (Node tests). game.meta supplies cores + upgradeNodes.
  function drawUpgradeMatrix(ctx, x, y, w, h, game, selectorState) {
    if (!ctx || typeof ctx.fillRect !== 'function') return;
    const sel = selectorState || defaultSelectorState();
    const meta = (game && game.meta) || { cores: 0, upgradeNodes: {} };
    const nodes = meta.upgradeNodes || {};

    // Header.
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#00f5ff';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('UPGRADE MATRIX', x + 12, y + 10);
    ctx.fillStyle = '#ffe66d';
    ctx.fillText('CORES: ' + (meta.cores | 0), x + w - 130, y + 10);

    // Grid layout: top area for the 3×4 grid, bottom strip for the tooltip.
    const gridTop = y + 36;
    const gridH = Math.max(120, h - 120);
    const cellW = Math.floor((w - 32) / 3);
    const cellH = Math.floor((gridH - 24) / 4);

    // Branch headers.
    ctx.fillStyle = '#9ad';
    ctx.font = '11px monospace';
    for (let c = 0; c < BRANCHES.length; c++) {
      ctx.fillText(BRANCHES[c].toUpperCase(), x + 16 + c * cellW + 6, gridTop);
    }

    const gridY0 = gridTop + 18;
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < 4; r++) {
        const node = _nodeAt(c, r);
        if (!node) continue;
        const cx = x + 16 + c * cellW;
        const cy = gridY0 + r * cellH;
        const cw = cellW - 8;
        const ch = cellH - 8;
        const lv = nodes[node.id] || 0;
        const maxed = lv >= node.maxLevel;
        const locked = !prereqMet(meta, node.id);
        const cost = nodeCost(node.id, lv);
        const affordable = cost != null && (meta.cores || 0) >= cost;
        const isSel = (c === sel.col && r === sel.row);

        // Body.
        ctx.fillStyle = locked ? '#101018' : (maxed ? '#0d2018' : '#0d1422');
        ctx.fillRect(cx, cy, cw, ch);
        // Border — selector colour wins.
        ctx.strokeStyle = isSel
          ? '#ffe66d'
          : (locked ? '#222' : (maxed ? '#0f8' : (affordable ? '#0ff' : '#345')));
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);

        // Title + level.
        ctx.fillStyle = locked ? '#445' : (maxed ? '#7f9' : '#cfe');
        ctx.font = '11px monospace';
        ctx.fillText(node.id.toUpperCase().replace(/_/g, ' '), cx + 6, cy + 6);
        ctx.fillStyle = locked ? '#334' : '#9ad';
        ctx.fillText('LV ' + lv + '/' + node.maxLevel, cx + 6, cy + 22);
        if (!maxed && !locked) {
          ctx.fillStyle = affordable ? '#ffe66d' : '#a55';
          ctx.fillText(cost + 'c', cx + cw - 38, cy + 22);
        } else if (maxed) {
          ctx.fillStyle = '#0f8';
          ctx.fillText('MAX', cx + cw - 32, cy + 22);
        } else {
          ctx.fillStyle = '#556';
          ctx.fillText('LOCK', cx + cw - 36, cy + 22);
        }
      }
    }

    // Tooltip strip.
    const ttY = gridY0 + 4 * cellH + 4;
    const ttH = Math.max(60, y + h - ttY - 8);
    ctx.fillStyle = '#06060c';
    ctx.fillRect(x + 12, ttY, w - 24, ttH);
    ctx.strokeStyle = '#234';
    ctx.strokeRect(x + 12.5, ttY + 0.5, w - 25, ttH - 1);

    const node = _nodeAt(sel.col, sel.row);
    if (node) {
      const lv = nodes[node.id] || 0;
      const cost = nodeCost(node.id, lv);
      const locked = !prereqMet(meta, node.id);
      ctx.fillStyle = '#cfe';
      ctx.font = '12px monospace';
      ctx.fillText(node.id.toUpperCase().replace(/_/g, ' ') + '   [' + node.branch + ' T' + node.tier + ']', x + 20, ttY + 8);
      ctx.fillStyle = '#9ad';
      ctx.font = '11px monospace';
      ctx.fillText('Level ' + lv + ' / ' + node.maxLevel, x + 20, ttY + 26);
      if (cost != null) {
        ctx.fillStyle = (meta.cores || 0) >= cost ? '#ffe66d' : '#a55';
        ctx.fillText('Next: ' + cost + ' cores', x + 140, ttY + 26);
      } else {
        ctx.fillStyle = '#0f8';
        ctx.fillText('MAXED', x + 140, ttY + 26);
      }
      if (locked) {
        ctx.fillStyle = '#a55';
        ctx.fillText('LOCKED — requires ' + node.branch + ' T' + (node.tier - 1) + ' Lv1+', x + 280, ttY + 26);
      }
      ctx.fillStyle = '#bdd';
      ctx.fillText(node.effect, x + 20, ttY + 44);
    }
  }

  // Convenience factory mirroring the terminal-panel API shape that #35 will
  // expect ({ id, label, update, draw, onOpen, onClose }). #35 may call this
  // directly or build its own panel using the bare draw/input helpers above.
  function createUpgradeMatrixPanel(game) {
    const sel = defaultSelectorState();
    return {
      id: 'upgrade_matrix',
      label: 'UPGRADE MATRIX',
      update: function (_dt, input) {
        if (!input) return;
        const keys = input.justPressed || input.pressed || null;
        if (!keys) return;
        // Accept either a Set-like (has) or array (includes) interface.
        const has = (k) => (keys.has ? keys.has(k) : (keys.includes ? keys.includes(k) : false));
        const candidates = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space'];
        for (const k of candidates) {
          if (has(k)) { handleUpgradeInput(k === 'Space' ? ' ' : k, game, sel); break; }
        }
      },
      draw: function (ctx, x, y, w, h) {
        drawUpgradeMatrix(ctx, x, y, w, h, game, sel);
      },
      onOpen: function () { sel.col = 0; sel.row = 0; },
      onClose: function () { /* no-op */ },
      _selector: sel  // exposed for tests
    };
  }

  return {
    UPGRADE_NODES,
    BRANCHES,
    getNode,
    nodeCost,
    prereqMet,
    purchase,
    totalSpent,
    defaultSelectorState,
    handleUpgradeInput,
    drawUpgradeMatrix,
    createUpgradeMatrixPanel,
  };
}));
