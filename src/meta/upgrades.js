// @ts-check
// save.js owns storage and stat application. This file owns the node table, cost curve, prereqs, and hub panel.
// The persistent field is upgradeNodes, not upgradesPurchased. See save.applyMetaToPlayer().
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./save.js'));
  } else {
    const ns = /** @type {any} */ ((root.NEON = root.NEON || {}));
    ns.upgrades = factory(ns.save);
  }
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function (/** @type {any} */ save) {
  'use strict';

  const UPGRADE_NODES = [
    { id:'hull_plating', branch:'Vitality', tier:1, baseCost:3,  maxLevel:3, effect:'+10 max HP per level' },
    { id:'regenerator',  branch:'Vitality', tier:2, baseCost:6,  maxLevel:2, effect:'Regen 0.5 HP/s out of combat (per level)' },
    { id:'trauma_kit',   branch:'Vitality', tier:3, baseCost:10, maxLevel:2, effect:'Start each run with 1 nano-medic consumable (per level)' },
    { id:'second_wind',  branch:'Vitality', tier:4, baseCost:18, maxLevel:1, effect:'Revive once per floor at 25% HP when lethally hit' },
    { id:'overclock',     branch:'Damage', tier:1, baseCost:3,  maxLevel:3, effect:'+5% weapon damage per level' },
    { id:'critical_bias', branch:'Damage', tier:2, baseCost:6,  maxLevel:3, effect:'+4% crit chance per level' },
    { id:'momentum',      branch:'Damage', tier:3, baseCost:10, maxLevel:2, effect:'+15% damage for 3s after a kill (per level)' },
    { id:'surge',         branch:'Damage', tier:4, baseCost:18, maxLevel:1, effect:'Every 8th shot deals +100% damage' },
    { id:'recon',     branch:'Utility', tier:1, baseCost:3,  maxLevel:3, effect:'+20% sensor radius (minimap reveal) per level' },
    { id:'scavenger', branch:'Utility', tier:2, baseCost:6,  maxLevel:3, effect:'+1 credit per pickup per level' },
    { id:'ghostwalk', branch:'Utility', tier:3, baseCost:10, maxLevel:2, effect:'Dash has 0.2s extra i-frames (per level)' },
    { id:'hacktool',  branch:'Utility', tier:4, baseCost:18, maxLevel:1, effect:'Start each run with a random hackware module pre-installed' },
  ];

  const BRANCHES = ['Vitality', 'Damage', 'Utility'];

  // O(1) id and branch:tier lookup; the table is scanned only for totals.
  const BY_ID = Object.create(null);
  const BY_BRANCH_TIER = Object.create(null);
  for (const n of UPGRADE_NODES) {
    BY_ID[n.id] = n;
    BY_BRANCH_TIER[n.branch + ':' + n.tier] = n;
  }

  /** @param {string} id */
  function getNode(id) { return BY_ID[id] || null; }

  // `level` is the current level, so the next purchase costs baseCost × (level + 1). undefined if unknown or maxed.
  /** @param {string} id @param {number} level */
  function nodeCost(id, level) {
    const node = BY_ID[id];
    if (!node) return undefined;
    const cur = Math.max(0, Math.floor(Number(level) || 0));
    if (cur >= node.maxLevel) return undefined;
    return node.baseCost * (cur + 1);
  }

  // Triangular sum of baseCost × 1..L.
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

  // Reloads from storage for the mutation (same as save.spendCores). The meta arg is not the source of truth.
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

  // selectorState: col 0..2 is branch, row 0..3 is tier-1. The hub owns it.

  function defaultSelectorState() { return { col: 0, row: 0 }; }

  /** @param {number} col @param {number} row */
  function _nodeAt(col, row) {
    const branch = BRANCHES[col];
    return branch ? BY_BRANCH_TIER[branch + ':' + (row + 1)] || null : null;
  }

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
      // purchase() reloads meta itself; game.meta is not the source of truth.
      const result = purchase(null, node.id);
      if (result.ok) {
        const audio = game && game.audio;
        if (audio && typeof audio.upgradePurchased === 'function') {
          try { audio.upgradePurchased(); } catch (_) { /* optional sfx */ }
        }
      }
      return true;
    }
    return false;
  }

  // Reads save.loadMeta() because the game object does not own a meta snapshot.
  /** @param {any} ctx @param {number} x @param {number} y @param {number} w @param {number} h @param {any} _game @param {any} selectorState */
  function drawUpgradeMatrix(ctx, x, y, w, h, _game, selectorState) {
    if (!ctx || typeof ctx.fillRect !== 'function') return;
    void _game; // Panel API passes game; meta comes from save.
    const sel = selectorState || defaultSelectorState();
    const meta = save ? save.loadMeta() : { cores: 0, upgradeNodes: {} };
    const nodes = meta.upgradeNodes || {};

    const narrow = w < 420;
    const hdrFs = narrow ? 12 : 14;
    const cellFs = narrow ? 10 : 11;
    const ttTitleFs = narrow ? 11 : 12;
    const ttFs = narrow ? 10 : 11;
    const pad = narrow ? 10 : 16;

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

    const gridTop = y + 34;
    const tooltipH = narrow ? 70 : 80;
    const gridH = Math.max(100, h - gridTop + y - tooltipH - 12);
    const cellW = Math.floor((w - pad * 2) / 3);
    const cellH = Math.floor((gridH - 18) / 4);

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

        ctx.fillStyle = locked ? '#101018' : (maxed ? '#0d2018' : '#0d1422');
        ctx.fillRect(cx, cy, cw, ch);
        ctx.strokeStyle = isSel
          ? '#ffe66d'
          : (locked ? '#222' : (maxed ? '#0f8' : (affordable ? '#0ff' : '#345')));
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);

        ctx.fillStyle = locked ? '#445' : (maxed ? '#7f9' : '#cfe');
        ctx.font = cellFs + 'px monospace';
        let title = node.id.toUpperCase().replace(/_/g, ' ');
        while (title.length > 2 && ctx.measureText(title).width > cw - 12) {
          title = title.slice(0, -1);
        }
        ctx.fillText(title, cx + 5, cy + 5);

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

      ctx.fillStyle = '#cfe';
      ctx.font = ttTitleFs + 'px monospace';
      let ttTitle = node.id.toUpperCase().replace(/_/g, ' ') + '  [' + node.branch + ' T' + node.tier + ']';
      if (ctx.measureText(ttTitle).width > ttMaxW) {
        ttTitle = node.id.toUpperCase().replace(/_/g, ' ');
      }
      ctx.fillText(ttTitle, x + ttPad, ttY + 8);

      // Cumulative x so a narrow panel does not use absolute offsets.
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

  // Hub panel shape: { id, label, update, draw, onOpen, onClose }.
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
