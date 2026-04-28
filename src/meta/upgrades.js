// @ts-check
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
    const ns = /** @type {any} */ ((root.NEON = root.NEON || {}));
    ns.upgrades = factory(ns.save);
  }
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function (/** @type {any} */ save) {
  'use strict';

  // ─── Node Table ────────────────────────────────────────────────────────────
  // 12 nodes: 3 branches × 4 tiers. Capstone nodes (tier 4) are maxLevel 1;
  // naturally-scaling stat nodes are maxLevel 3.
  const UPGRADE_NODES = [
    // Vitality
    { id:'hull_plating', branch:'Vitality', tier:1, baseCost:3,  maxLevel:3, effect:'+10 max HP per level' },
    { id:'regenerator',  branch:'Vitality', tier:2, baseCost:6,  maxLevel:2, effect:'Regen 0.5 HP/s out of combat (per level)' },
    { id:'trauma_kit',   branch:'Vitality', tier:3, baseCost:10, maxLevel:2, effect:'Start each run with 1 nano-medic consumable (per level)' },
    { id:'second_wind',  branch:'Vitality', tier:4, baseCost:18, maxLevel:1, effect:'Revive once per floor at 25% HP when lethally hit' },
    // Damage
    { id:'overclock',     branch:'Damage', tier:1, baseCost:3,  maxLevel:3, effect:'+5% weapon damage per level' },
    { id:'critical_bias', branch:'Damage', tier:2, baseCost:6,  maxLevel:3, effect:'+4% crit chance per level' },
    { id:'momentum',      branch:'Damage', tier:3, baseCost:10, maxLevel:2, effect:'+15% damage for 3s after a kill (per level)' },
    { id:'surge',         branch:'Damage', tier:4, baseCost:18, maxLevel:1, effect:'Every 8th shot deals +100% damage' },
    // Utility
    { id:'recon',     branch:'Utility', tier:1, baseCost:3,  maxLevel:3, effect:'+20% sensor radius (minimap reveal) per level' },
    { id:'scavenger', branch:'Utility', tier:2, baseCost:6,  maxLevel:3, effect:'+1 credit per pickup per level' },
    { id:'ghostwalk', branch:'Utility', tier:3, baseCost:10, maxLevel:2, effect:'Dash has 0.2s extra i-frames (per level)' },
    { id:'hacktool',  branch:'Utility', tier:4, baseCost:18, maxLevel:1, effect:'Start each run with a random hackware module pre-installed' },
  ];

  const BRANCHES = ['Vitality', 'Damage', 'Utility'];

  // Index by id and by (branch,tier) for O(1) lookups.
  const BY_ID = Object.create(null);
  const BY_BRANCH_TIER = Object.create(null);
  for (const n of UPGRADE_NODES) {
    BY_ID[n.id] = n;
    BY_BRANCH_TIER[n.branch + ':' + n.tier] = n;
  }

  /** @param {string} id */
  function getNode(id) { return BY_ID[id] || null; }

  // ─── Cost Curve ────────────────────────────────────────────────────────────
  // Linear: cost of level L (1-indexed) = baseCost × L. So purchasing the next
  // level when currently at level `level` costs baseCost × (level + 1).
  // Returns undefined if the node is unknown or already at maxLevel.
  /** @param {string} id @param {number} level */
  function nodeCost(id, level) {
    const node = BY_ID[id];
    if (!node) return undefined;
    const cur = Math.max(0, Math.floor(Number(level) || 0));
    if (cur >= node.maxLevel) return undefined;
    return node.baseCost * (cur + 1);
  }

  // Sum of every cost paid to reach `level` from 0: baseCost × L(L+1)/2.
  /** @param {any} node @param {number} level */
  function _spentForLevel(node, level) {
    const L = Math.max(0, Math.min(node.maxLevel, Math.floor(Number(level) || 0)));
    return node.baseCost * (L * (L + 1)) / 2;
  }

  /** @param {any} meta */
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
  /** @param {any} meta @param {string} id */
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
  /** @param {any} meta @param {string} id */
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

  /** @param {number} col @param {number} row */
  function _nodeAt(col, row) {
    const branch = BRANCHES[col];
    return branch ? BY_BRANCH_TIER[branch + ':' + (row + 1)] || null : null;
  }

  // handleUpgradeInput(key, game, selectorState) → boolean (true if consumed).
  // `key` is a normalized key string ('ArrowUp', 'ArrowDown', 'ArrowLeft',
  // 'ArrowRight', 'Enter'). `game` may expose `game.audio` for sfx and
  // `game.meta` for the live meta snapshot.
  /** @param {string} key @param {any} game @param {any} selectorState */
  function handleUpgradeInput(key, game, selectorState) {
    const sel = selectorState || defaultSelectorState();
    if (key === 'ArrowLeft')  { sel.col = (sel.col + BRANCHES.length - 1) % BRANCHES.length; return true; }
    if (key === 'ArrowRight') { sel.col = (sel.col + 1) % BRANCHES.length; return true; }
    if (key === 'ArrowUp')    { sel.row = (sel.row + 4 - 1) % 4; return true; }
    if (key === 'ArrowDown')  { sel.row = (sel.row + 1) % 4; return true; }
    if (key === 'Enter' || key === ' ' || key === 'Space') {
      const node = _nodeAt(sel.col, sel.row);
      if (!node) return true;
      // purchase() ignores its `meta` arg and reads via save.loadMeta() (L115),
      // so passing `game.meta` is meaningless. Pass null for clarity.
      const result = purchase(null, node.id);
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
  // missing (Node tests). Reads cores + upgradeNodes from save.loadMeta()
  // directly — `game.meta` is never assigned anywhere in the codebase
  // (verified by grep), so the previous `(game && game.meta)` path always
  // fell through to the `{cores:0, upgradeNodes:{}}` defaults. Result:
  // upgrade matrix showed CORES: 0 + every node appeared unaffordable +
  // selection state didn't reflect actual purchases — even though the
  // player had cores in their wallet (visible in The Gap's hub chrome).
  // Reported by user 2026-04-25 (6bc2e985): 'in the gap, i have no way of
  // upgrading anything (on mobile - havent rrie desktop) even though i
  // have cores the upgrade matrix items dont respond to my touches'.
  // Mirrors the modules.js pattern at L210 which also reads via save.
  /** @param {any} ctx @param {number} x @param {number} y @param {number} w @param {number} h @param {any} _game @param {any} selectorState */
  function drawUpgradeMatrix(ctx, x, y, w, h, _game, selectorState) {
    if (!ctx || typeof ctx.fillRect !== 'function') return;
    void _game; // legacy param — meta is read from save directly now
    const sel = selectorState || defaultSelectorState();
    const meta = save ? save.loadMeta() : { cores: 0, upgradeNodes: {} };
    const nodes = meta.upgradeNodes || {};

    // Responsive font sizes — scale down on narrow panels.
    const narrow = w < 420;
    const hdrFs = narrow ? 12 : 14;
    const cellFs = narrow ? 10 : 11;
    const ttTitleFs = narrow ? 11 : 12;
    const ttFs = narrow ? 10 : 11;
    const pad = narrow ? 10 : 16;

    // Header.
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#00f5ff';
    ctx.font = hdrFs + 'px monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('UPGRADE MATRIX', x + pad - 4, y + 10);
    ctx.fillStyle = '#ffe66d';
    ctx.textAlign = 'right';
    ctx.fillText('CORES: ' + (meta.cores | 0), x + w - pad + 4, y + 10);
    ctx.textAlign = 'left';

    // Grid layout: top area for the 3×4 grid, bottom strip for the tooltip.
    const gridTop = y + 34;
    const tooltipH = narrow ? 70 : 80;
    const gridH = Math.max(100, h - gridTop + y - tooltipH - 12);
    const cellW = Math.floor((w - pad * 2) / 3);
    const cellH = Math.floor((gridH - 18) / 4);

    // Branch headers.
    ctx.fillStyle = '#9ad';
    ctx.font = cellFs + 'px monospace';
    for (let c = 0; c < BRANCHES.length; c++) {
      ctx.fillText(/** @type {string} */ (BRANCHES[c]).toUpperCase(), x + pad + c * cellW + 6, gridTop);
    }

    const gridY0 = gridTop + 16;
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < 4; r++) {
        const node = _nodeAt(c, r);
        if (!node) continue;
        const cx = x + pad + c * cellW;
        const cy = gridY0 + r * cellH;
        const cw = cellW - 6;
        const ch = cellH - 6;
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

        // Title — measure and truncate if needed.
        ctx.fillStyle = locked ? '#445' : (maxed ? '#7f9' : '#cfe');
        ctx.font = cellFs + 'px monospace';
        let title = node.id.toUpperCase().replace(/_/g, ' ');
        while (title.length > 2 && ctx.measureText(title).width > cw - 12) {
          title = title.slice(0, -1);
        }
        ctx.fillText(title, cx + 5, cy + 5);

        // Level + status — only if cell is tall enough for a second line.
        if (ch >= 30) {
          ctx.fillStyle = locked ? '#334' : '#9ad';
          ctx.fillText('LV ' + lv + '/' + node.maxLevel, cx + 5, cy + 20);
          if (!maxed && !locked) {
            ctx.fillStyle = affordable ? '#ffe66d' : '#a55';
            ctx.textAlign = 'right';
            ctx.fillText(cost + 'c', cx + cw - 5, cy + 20);
            ctx.textAlign = 'left';
          } else if (maxed) {
            ctx.fillStyle = '#0f8';
            ctx.textAlign = 'right';
            ctx.fillText('MAX', cx + cw - 5, cy + 20);
            ctx.textAlign = 'left';
          } else {
            ctx.fillStyle = '#556';
            ctx.textAlign = 'right';
            ctx.fillText('LOCK', cx + cw - 5, cy + 20);
            ctx.textAlign = 'left';
          }
        }
      }
    }

    // Tooltip strip.
    const ttY = gridY0 + 4 * cellH + 4;
    const ttH = Math.max(50, y + h - ttY - 6);
    ctx.fillStyle = '#06060c';
    ctx.fillRect(x + pad - 4, ttY, w - (pad - 4) * 2, ttH);
    ctx.strokeStyle = '#234';
    ctx.strokeRect(x + pad - 3.5, ttY + 0.5, w - (pad - 4) * 2 - 1, ttH - 1);

    const ttPad = pad;
    const ttMaxW = w - ttPad * 2 - 8;
    const node = _nodeAt(sel.col, sel.row);
    if (node) {
      const lv = nodes[node.id] || 0;
      const cost = nodeCost(node.id, lv);
      const locked = !prereqMet(meta, node.id);

      // Row 1: name + branch/tier.
      ctx.fillStyle = '#cfe';
      ctx.font = ttTitleFs + 'px monospace';
      let ttTitle = node.id.toUpperCase().replace(/_/g, ' ') + '  [' + node.branch + ' T' + node.tier + ']';
      if (ctx.measureText(ttTitle).width > ttMaxW) {
        ttTitle = node.id.toUpperCase().replace(/_/g, ' ');
      }
      ctx.fillText(ttTitle, x + ttPad, ttY + 8);

      // Row 2: level + cost/status + lock (all relative, no absolute offsets).
      ctx.font = ttFs + 'px monospace';
      let infoX = x + ttPad;
      ctx.fillStyle = '#9ad';
      const lvText = 'Lv ' + lv + '/' + node.maxLevel;
      ctx.fillText(lvText, infoX, ttY + 24);
      infoX += ctx.measureText(lvText + '  ').width;

      if (cost != null) {
        ctx.fillStyle = (meta.cores || 0) >= cost ? '#ffe66d' : '#a55';
        const costText = 'Next: ' + cost + 'c';
        ctx.fillText(costText, infoX, ttY + 24);
        infoX += ctx.measureText(costText + '  ').width;
      } else {
        ctx.fillStyle = '#0f8';
        ctx.fillText('MAXED', infoX, ttY + 24);
        infoX += ctx.measureText('MAXED  ').width;
      }
      if (locked) {
        ctx.fillStyle = '#a55';
        const lockText = 'REQ: ' + node.branch + ' T' + (node.tier - 1);
        if (infoX + ctx.measureText(lockText).width <= x + w - ttPad) {
          ctx.fillText(lockText, infoX, ttY + 24);
        } else {
          ctx.fillText(lockText, x + ttPad, ttY + 38);
        }
      }

      // Row 3: effect description with word-wrap.
      ctx.fillStyle = '#bdd';
      ctx.font = ttFs + 'px monospace';
      const effectY0 = locked && (infoX + ctx.measureText('REQ: ' + node.branch + ' T' + (node.tier - 1)).width > x + w - ttPad) ? ttY + 52 : ttY + 40;
      const words = node.effect.split(' ');
      let line = '';
      let ey = effectY0;
      for (const word of words) {
        const test = line ? (line + ' ' + word) : word;
        if (ctx.measureText(test).width > ttMaxW && line) {
          ctx.fillText(line, x + ttPad, ey);
          ey += ttFs + 3;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, x + ttPad, ey);
    }
  }

  // Convenience factory mirroring the terminal-panel API shape that #35 will
  // expect ({ id, label, update, draw, onOpen, onClose }). #35 may call this
  // directly or build its own panel using the bare draw/input helpers above.
  /** @param {any} game */
  function createUpgradeMatrixPanel(game) {
    const sel = defaultSelectorState();
    return {
      id: 'upgrade_matrix',
      label: 'UPGRADE MATRIX',
      /** @param {any} _dt @param {any} input */
      update: function (_dt, input) {
        if (!input) return;
        const keys = input.justPressed || input.pressed || null;
        if (!keys) return;
        // Accept either a Set-like (has) or array (includes) interface.
        /** @param {string} k */
        const has = (k) => (keys.has ? keys.has(k) : (keys.includes ? keys.includes(k) : false));
        const candidates = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space'];
        for (const k of candidates) {
          if (has(k)) { handleUpgradeInput(k === 'Space' ? ' ' : k, game, sel); break; }
        }
      },
      /** @param {any} ctx @param {number} x @param {number} y @param {number} w @param {number} h */
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
