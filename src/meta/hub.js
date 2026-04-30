// @ts-check
// src/meta/hub.js — THE GAP (liminal hub between floors)
//
// UNCHAINED #35. Appears after every cleared floor (1+). Houses 4 terminals:
//   1. UPGRADE MATRIX  (#36 — placeholder stub here)
//   2. MODULE SLOTS    (#37 — placeholder stub here)
//   3. ARMORY          (placeholder; real weapon-swap wire-up in a follow-up)
//   4. ARCHIVE         (#41 — placeholder stub here)
//
// Follows the NEON "UMD-lite" IIFE pattern so Node tests can require() it and
// the browser binds it to window.NEON.hub. All DOM/canvas/audio refs are looked
// up through globals at call time so the module is importable without them.
//
// Terminal-panel API (documented for sibling issues #36/#37/#41):
//   {
//     id:     string,                              // stable terminal id
//     label:  string,                              // short UPPERCASE label
//     update(dt, input),                           // input = {jp,km} helpers
//     draw(ctx, x, y, w, h),                       // panel body bounds
//     onOpen(game),                                // called when activated
//     onClose(game),                               // called when dismissed
//     onTap?(cx, cy, bounds, game),                // OPTIONAL — touch hit-test
//                                                  //   bounds = { x, y, w, h }
//                                                  //   only fires for taps
//                                                  //   inside the panel rect.
//   }
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (/** @type {any} */ (root.NEON = root.NEON || {})).hub = factory();
}(/** @type {any} */ (typeof self !== 'undefined' ? self : this), function () {
  'use strict';


  // ─── Terminals ────────────────────────────────────────────────────────────

  // ARMORY — view weapon belt + tap-to-equip (issue P1: hub backlog).
  // Reads game.player.weapons[] (belt array) and game.player.weaponIdx
  // (active slot). Selecting a weapon mirrors the runtime cycleWeapon()
  // path in entities.js — sets weaponIdx + weapon, fires audio.menuSelect.
  const ArmoryTerminal = {
    id: 'armory',
    label: 'ARMORY',
    _accent: '#ffb700',
    _sel: 0,
    _t: 0,
    onOpen() {
      this._t = 0;
      // Initialise selection to the active slot so opening the panel
      // doesn't surprise the player by moving the cursor.
      try {
        const g = /** @type {any} */ (game);
        this._sel = (g && g.player && typeof g.player.weaponIdx === 'number')
          ? g.player.weaponIdx
          : 0;
      } catch (_) { this._sel = 0; }
    },
    onClose() {},
    /** Returns the player.weapons array (belt) or [] if unavailable. */
    _getBelt() {
      try {
        const g = /** @type {any} */ (game);
        if (g && g.player && Array.isArray(g.player.weapons)) return g.player.weapons;
      } catch (_) { /* ignore */ }
      return [];
    },
    /** Equip slot index. Idempotent if already active. @param {number} idx */
    _equip(idx) {
      try {
        const g = /** @type {any} */ (game);
        if (!g || !g.player) return;
        const belt = g.player.weapons;
        if (!Array.isArray(belt) || idx < 0 || idx >= belt.length) return;
        const next = belt[idx];
        if (!next) return;
        if (g.player.weaponIdx === idx && g.player.weapon === next) return;
        g.player.weaponIdx = idx;
        g.player.weapon = next;
        // Mirror runtime cycleWeapon() / number-key swap (entities.js:6234-6239,
        // 6704) — both reset shootCooldown so the newly-equipped weapon can fire
        // immediately. Without this, a player who tapped to swap in Armory would
        // descend with an arbitrarily-long cooldown carried over from the prior
        // weapon's last shot.
        g.player.shootCooldown = 0;
        try { audio.menuSelect(); } catch (_) {}
      } catch (_) { /* ignore */ }
    },
    /** @param {number} dt */
    update(dt /* , input */) {
      this._t += (dt || 0);
      if (typeof jp !== 'function') return;
      const km_ = (typeof km === 'function') ? km : () => null;
      const belt = this._getBelt();
      const n = belt.length;
      if (n === 0) return;
      if (this._sel >= n) this._sel = n - 1;
      if (this._sel < 0) this._sel = 0;
      if (jp('ArrowUp') || jp(km_('up'))) {
        this._sel = (this._sel + n - 1) % n;
        try { audio.menuSelect(); } catch (_) {}
      }
      if (jp('ArrowDown') || jp(km_('down'))) {
        this._sel = (this._sel + 1) % n;
        try { audio.menuSelect(); } catch (_) {}
      }
      if (jp('Enter') || jp(km_('interact'))) {
        this._equip(this._sel);
      }
      // Number-key shortcuts mirror runtime weapon-belt hotkeys.
      if (jp('Digit1') && n >= 1) { this._sel = 0; this._equip(0); }
      if (jp('Digit2') && n >= 2) { this._sel = 1; this._equip(1); }
      if (jp('Digit3') && n >= 3) { this._sel = 2; this._equip(2); }
    },
    // Touch hit-test. Layout mirrors draw() row positions; if either
    // changes, update both.
    /** @param {number} cx @param {number} cy @param {{x:number,y:number,w:number,h:number}} bounds @param {any} game */
    onTap(cx, cy, bounds, game) {
      void game;
      const { x, y, w } = bounds;
      const belt = this._getBelt();
      if (belt.length === 0) return;
      const headerH = 86;  // header + EQUIPPED line
      const rowH = 26;
      // Rows are drawn left-padded so the hit-test is row-band based on cy.
      const k = Math.floor((cy - (y + headerH)) / rowH);
      if (k < 0 || k >= belt.length) return;
      // Optional horizontal sanity check — reject taps far outside the panel.
      if (cx < x + 8 || cx > x + w - 8) return;
      this._sel = k;
      this._equip(k);
    },
    /** @param {any} ctx @param {number} x @param {number} y @param {number} w @param {number} h */
    draw(ctx, x, y, w, h) {
      const accent = this._accent;
      ctx.save();
      ctx.fillStyle = 'rgba(8,10,20,0.92)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

      // Header
      ctx.fillStyle = accent;
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10; ctx.shadowColor = accent;
      ctx.fillText('ARMORY', x + w / 2, y + 32);
      ctx.shadowBlur = 0;

      const belt = this._getBelt();
      const activeIdx = (() => {
        try {
          const g = /** @type {any} */ (game);
          return (g && g.player && typeof g.player.weaponIdx === 'number') ? g.player.weaponIdx : 0;
        } catch (_) { return 0; }
      })();

      // EQUIPPED summary
      ctx.fillStyle = '#e0e0ff';
      ctx.font = '13px monospace';
      ctx.fillText('EQUIPPED', x + w / 2, y + 56);
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px monospace';
      const activeWeapon = belt[activeIdx];
      const activeName = activeWeapon ? String(activeWeapon.name || activeWeapon.id || '—') : '—';
      ctx.fillText(activeName.toUpperCase(), x + w / 2, y + 76);

      // Belt rows. 3 max; empty slots render dim "EMPTY".
      const headerH = 86;
      const rowH = 26;
      const MAX_BELT = 3;
      ctx.textAlign = 'left';
      ctx.font = '13px monospace';
      for (let i = 0; i < MAX_BELT; i++) {
        const ry = y + headerH + i * rowH;
        const isActive = (i === activeIdx);
        const isSel = (i === this._sel);
        const w2 = belt[i];

        // Selection hilite
        if (isSel) {
          ctx.fillStyle = 'rgba(255,183,0,0.16)';
          ctx.fillRect(x + 8, ry - 2, w - 16, rowH - 4);
          ctx.strokeStyle = accent;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 8.5, ry - 1.5, w - 17, rowH - 5);
        }

        // Slot number
        ctx.fillStyle = isSel ? accent : '#888ab0';
        ctx.fillText('[' + (i + 1) + ']', x + 16, ry + 14);

        // Weapon name
        if (w2) {
          ctx.fillStyle = isActive ? '#ffffff' : (isSel ? '#ffe8a3' : '#c8c8e0');
          const name = String(w2.name || w2.id || '—').toUpperCase();
          ctx.fillText(name, x + 48, ry + 14);
          if (isActive) {
            ctx.fillStyle = accent;
            ctx.textAlign = 'right';
            ctx.font = 'bold 11px monospace';
            ctx.fillText('◀ ACTIVE', x + w - 16, ry + 14);
            ctx.font = '13px monospace';
            ctx.textAlign = 'left';
          }
        } else {
          ctx.fillStyle = '#3a3a55';
          ctx.font = 'italic 13px monospace';
          ctx.fillText('— empty —', x + 48, ry + 14);
          ctx.font = '13px monospace';
        }
      }

      // Footer hint
      ctx.fillStyle = '#555577';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      const hint = (typeof isTouchDevice === 'function' && isTouchDevice())
        ? 'TAP A SLOT TO EQUIP   ·   [ESC] BACK'
        : '[↑↓] SELECT   [ENTER] EQUIP   [1-3] HOTKEYS   [ESC] BACK';
      ctx.fillText(hint, x + w / 2, y + h - 16);
      ctx.restore();
    },
  };

  // ARCHIVE — prior-instance record reader (#41/#460). Lists every log the
  // current instance has found, grouped by AXIOM lineage. Unread logs use a
  // ●. Select to read → plays audio.logRead + marks as read + displays body.
  const ArchiveTerminal = {
    id: 'archive',
    label: 'ARCHIVE',
    _accent: '#39ff14',
    _sel: 0,
    _scroll: 0,
    _reading: null, // log being read (body view)
    _t: 0,
    onOpen() { this._sel = 0; this._scroll = 0; this._reading = null; this._t = 0; },
    onClose() { this._reading = null; },
    _getFoundList() {
      // Returns mixed list: AXIOM iteration records first (grouped by lineage), then
      // WHISPERS (the secret-room subplot — see src/data/whispers.js). Each
      // entry is discriminated by `kind` so the row render + reading pane
      // can switch on it. Only FOUND entries are included so unfound ones
      // aren't spoiled.
      /** @type {Array<{kind:'log',axiom:any,log:any,read:boolean}|{kind:'whisper',whisper:any,read:boolean}>} */
      const out = [];
      try {
        const meta = NEON.save.loadMeta();
        const foundLogs = new Set(meta.logsFound || []);
        const readLogs  = new Set(meta.logsRead  || []);
        const all = NEON.logs.groupedByAxiom();
        for (const grp of all) {
          for (const log of grp.logs) {
            if (foundLogs.has(log.id)) {
              out.push({ kind: 'log', axiom: grp.axiom, log, read: readLogs.has(log.id) });
            }
          }
        }
      } catch (_) { /* ignore */ }
      try {
        if (NEON && NEON.whispers) {
          const meta = NEON.save.loadMeta();
          const foundW = new Set(meta.whispersFound || []);
          const readW  = new Set(meta.whispersRead  || []);
          const all = NEON.whispers.groupedByBiome();
          for (const grp of all) {
            for (const w of grp.whispers) {
              if (foundW.has(w.id)) {
                out.push({ kind: 'whisper', whisper: w, read: readW.has(w.id) });
              }
            }
          }
        }
      } catch (_) { /* ignore */ }
      return out;
    },
    /** @param {number} dt */
    update(dt /* , input */) {
      this._t += (dt || 0);
      // Input routed via hub harness' jp/km globals (browser only; Node tests
      // won't exercise this path).
      if (typeof jp !== 'function') return;
      const km_ = (typeof km === 'function') ? km : () => null;
      if (this._reading) {
        if (jp('Enter') || jp(km_('interact')) || jp('Backspace')) {
          this._reading = null;
          try { audio.menuSelect(); } catch (_) {}
        }
        return;
      }
      const list = this._getFoundList();
      const n = list.length;
      if (n === 0) return;
      if (jp('ArrowUp')   || jp(km_('up')))    { this._sel = (this._sel + n - 1) % n; try { audio.menuSelect(); } catch(_){} }
      if (jp('ArrowDown') || jp(km_('down')))  { this._sel = (this._sel + 1) % n;     try { audio.menuSelect(); } catch(_){} }
      if (jp('Enter') || jp(km_('interact'))) {
        const entry = /** @type {any} */ (list[this._sel]);
        if (entry) {
          try {
            if (entry.kind === 'whisper' && NEON && NEON.whispers) {
              NEON.whispers.readWhisper(entry.whisper.id);
            } else if (entry.log) {
              NEON.logs.readLog(entry.log.id);
            }
          } catch (_) {}
          this._reading = entry;
          try { audio.logRead(); } catch (_) {}
        }
      }
    },
    // Touch hit-test. Tap anywhere while reading → back to list. Tap on a
    // visible row → select + open. Layout mirrors _drawList; if either
    // changes, update both (single source of truth would be nicer but the
    // panel is small enough that drift risk is low).
    /** @param {number} cx @param {number} cy @param {{x:number,y:number,w:number,h:number}} bounds @param {any} game */
    onTap(cx, cy, bounds, game) {
      void game;
      const { x, y, w, h } = bounds;
      void x; void w;
      if (this._reading) {
        this._reading = null;
        try { audio.menuSelect(); } catch (_) {}
        return;
      }
      const list = this._getFoundList();
      if (list.length === 0) return;
      const headerH = 72, footerH = 24, rowH = 18;  // headerH matches _drawList
      const listH = h - headerH - footerH;
      const rowsVisible = Math.max(3, Math.floor(listH / rowH));
      // _drawList paints each row's hilite at (x+8, ry-12, w-16, rowH-2)
      // where ry = y + headerH + k*rowH for k = 0..rowsVisible-1.
      const visibleTopY = y + headerH - 12;
      const k = Math.floor((cy - visibleTopY) / rowH);
      if (k < 0 || k >= rowsVisible) return;
      const idx = this._scroll + k;
      if (idx < 0 || idx >= list.length) return;
      this._sel = idx;
      const entry = /** @type {any} */ (list[idx]);
      if (entry) {
        try {
          if (entry.kind === 'whisper' && NEON && NEON.whispers) {
            NEON.whispers.readWhisper(entry.whisper.id);
          } else if (entry.log) {
            NEON.logs.readLog(entry.log.id);
          }
        } catch (_) {}
        this._reading = entry;
        try { audio.logRead(); } catch (_) {}
      }
    },
    /** @param {any} ctx @param {number} x @param {number} y @param {number} w @param {number} h */
    draw(ctx, x, y, w, h) {
      const accent = this._accent;
      ctx.save();
      ctx.fillStyle = 'rgba(8,10,20,0.95)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

      // Header.
      ctx.fillStyle = accent;
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10; ctx.shadowColor = accent;
      ctx.fillText('ARCHIVE', x + w / 2, y + 26);
      ctx.shadowBlur = 0;

      // Progress.
      let progress = { read: 0, total: 0 };
      try { progress = NEON.logs.progress(); } catch (_) {}
      ctx.fillStyle = '#888ab0';
      ctx.font = '11px monospace';
      ctx.fillText('ITERATION RECORDS: ' + progress.read + '/' + progress.total, x + w / 2, y + 44);

      // Whispers progress (secret-room subplot — see src/data/whispers.js).
      // Shown as a separate counter so the player can tell at a glance there's
      // a deeper layer to discover. Empty progress (0/0 or 0/N) renders dim.
      let wprog = { read: 0, total: 0 };
      try { if (NEON && NEON.whispers) wprog = NEON.whispers.progress(); } catch (_) {}
      if (wprog.total > 0) {
        ctx.fillStyle = wprog.read > 0 ? '#aa66cc' : '#444466';
        ctx.font = '10px monospace';
        ctx.fillText('WHISPERS: ' + wprog.read + '/' + wprog.total, x + w / 2, y + 58);
      }

      // Body.
      if (this._reading) {
        this._drawReading(ctx, x, y, w, h);
      } else {
        this._drawList(ctx, x, y, w, h);
      }

      // Footer.
      ctx.fillStyle = '#555577';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      if (this._reading) {
        ctx.fillText('[ENTER] BACK   [ESC] CLOSE', x + w / 2, y + h - 12);
      } else {
        ctx.fillText('▲▼ SELECT   [ENTER] READ   [ESC] CLOSE', x + w / 2, y + h - 12);
      }
      ctx.restore();
    },
    /** @param {any} ctx @param {number} x @param {number} y @param {number} w @param {number} h */
    _drawList(ctx, x, y, w, h) {
      const list = this._getFoundList();
      const accent = this._accent;
      if (list.length === 0) {
        ctx.fillStyle = '#888ab0';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NO FRAGMENTS RECOVERED', x + w / 2, y + h / 2 - 10);
        ctx.fillStyle = '#555577';
        ctx.font = '11px monospace';
        ctx.fillText('Purge rare terminals in the dungeon to', x + w / 2, y + h / 2 + 10);
        ctx.fillText('recover AXIOM iteration records.', x + w / 2, y + h / 2 + 26);
        return;
      }

      // Scroll window.
      const rowH = 18;
      const headerH = 72;  // 56 base + 16 for the WHISPERS counter line
      const footerH = 24;
      const listH = h - headerH - footerH;
      const rowsVisible = Math.max(3, Math.floor(listH / rowH));
      if (this._sel < this._scroll) this._scroll = this._sel;
      if (this._sel >= this._scroll + rowsVisible) this._scroll = this._sel - rowsVisible + 1;
      this._scroll = Math.max(0, Math.min(this._scroll, Math.max(0, list.length - rowsVisible)));

      ctx.textAlign = 'left';
      ctx.font = '12px monospace';
      let ry = y + headerH;
      const endIdx = Math.min(list.length, this._scroll + rowsVisible);
      for (let i = this._scroll; i < endIdx; i++) {
        const entry = /** @type {any} */ (list[i]);
        const sel = (i === this._sel);
        const isWhisper = entry.kind === 'whisper';
        // Whisper rows use the violet accent matching the WhisperItem render
        // and the WHISPERS counter line above. Logs keep the green accent.
        const rowAccent = isWhisper ? '#cc99ee' : accent;
        if (sel) {
          ctx.fillStyle = isWhisper ? 'rgba(204,153,238,0.14)' : 'rgba(57,255,20,0.12)';
          ctx.fillRect(x + 8, ry - 12, w - 16, rowH - 2);
        }
        // Prefix: 'AXIOM-N' for iteration records, 'WHISPER' for the secret-room subplot.
        ctx.fillStyle = sel ? rowAccent : (isWhisper ? '#7755aa' : '#666688');
        ctx.fillText(isWhisper ? 'WHISPER' : ('AXIOM-' + entry.axiom), x + 14, ry);
        // Title.
        const title = isWhisper ? entry.whisper.title : entry.log.title;
        ctx.fillStyle = sel ? '#ffffff' : (entry.read ? '#9999bb' : (isWhisper ? '#e8d5ff' : '#e0e0ff'));
        ctx.fillText(title, x + 92, ry);
        // Unread marker — pulsing ● on right.
        if (!entry.read) {
          const a = 0.55 + 0.45 * Math.sin(this._t * 4 + i);
          ctx.fillStyle = rowAccent;
          ctx.globalAlpha = a;
          ctx.fillText('●NEW', x + w - 48, ry);
          ctx.globalAlpha = 1;
        }
        ry += rowH;
      }

      // Scroll hint.
      if (list.length > rowsVisible) {
        ctx.fillStyle = '#555577';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText((this._sel + 1) + '/' + list.length, x + w - 12, y + 44);
      }
    },
    /** @param {any} ctx @param {number} x @param {number} y @param {number} w @param {number} h */
    _drawReading(ctx, x, y, w, h) {
      const entry = /** @type {any} */ (this._reading);
      const isWhisper = entry && entry.kind === 'whisper';
      const accent = isWhisper ? '#cc99ee' : this._accent;
      ctx.textAlign = 'left';
      ctx.fillStyle = isWhisper ? '#7755aa' : '#666688';
      ctx.font = '11px monospace';
      const prefix = isWhisper
        ? ('WHISPER · ' + (entry.whisper.voice || 'unknown'))
        : ('AXIOM-' + entry.axiom + ' · PRIOR INSTANCE');
      ctx.fillText(prefix, x + 14, y + 64);
      ctx.fillStyle = accent;
      ctx.font = '14px monospace';
      const title = isWhisper ? entry.whisper.title : entry.log.title;
      ctx.fillText(title, x + 14, y + 82);

      // Wrap body.
      ctx.fillStyle = isWhisper ? '#e8d5ff' : '#c0c0e0';
      ctx.font = '12px monospace';
      const maxW = w - 28;
      const body = isWhisper ? entry.whisper.body : entry.log.body;
      const words = String(body || '').split(' ');
      let line = '';
      let yy = y + 108;
      for (const word of words) {
        const test = line ? (line + ' ' + word) : word;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, x + 14, yy);
          yy += 16;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, x + 14, yy);
    },
  };

  /** @param {any} game */
  function buildTerminals(game) {
    return [
      _buildUpgradePanel(game),
      _buildModulesPanel(game),
      ArmoryTerminal,
      ArchiveTerminal,
    ];
  }

  // ─── Upgrade Matrix adapter ────────────────────────────────────────────────
  // Wraps NEON.upgrades (shipped in #36) into the terminal-panel API. Uses
  // the global jp/km for input (same pattern as ArchiveTerminal).
  /** @param {any} game */
  function _buildUpgradePanel(game) {
    /** @type {any} */ let sel = null;
    // handleUpgradeInput expects game.audio for sfx — bridge the global.
    const gameProxy = Object.create(game || {});
    Object.defineProperty(gameProxy, 'audio', {
      get() { try { return (typeof audio !== 'undefined') ? audio : null; } catch (_) { return null; } }
    });
    return {
      id: 'upgrade',
      label: 'UPGRADE MATRIX',
      _accent: '#00f5ff',
      onOpen() { sel = NEON.upgrades.defaultSelectorState(); },
      onClose() {},
      update() {
        if (typeof jp !== 'function' || !sel) return;
        const km_ = (typeof km === 'function') ? km : () => null;
        const arrows = [
          ['ArrowUp', km_('up')], ['ArrowDown', km_('down')],
          ['ArrowLeft', km_('left')], ['ArrowRight', km_('right')],
        ];
        for (const [key, alt] of arrows) {
          if (jp(key) || (alt && jp(alt))) {
            NEON.upgrades.handleUpgradeInput(key, gameProxy, sel);
            try { audio.menuSelect(); } catch (_) {}
            return;
          }
        }
        if (jp('Enter') || jp(km_('interact'))) {
          NEON.upgrades.handleUpgradeInput('Enter', gameProxy, sel);
        }
      },
      draw(/** @type {any} */ ctx, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ h) {
        try { NEON.upgrades.drawUpgradeMatrix(ctx, x, y, w, h, gameProxy, sel); } catch (_) {}
      },
      // Touch hit-test for the 3×4 upgrade grid. Layout mirrors
      // upgrades.js drawUpgradeMatrix — if cell math changes there, update
      // here too.
      /** @param {number} cx @param {number} cy @param {{x:number,y:number,w:number,h:number}} bounds */
      onTap(cx, cy, bounds) {
        if (!sel) return;
        const { x, y, w, h } = bounds;
        const narrow = w < 420;
        const pad = narrow ? 10 : 16;
        const tooltipH = narrow ? 70 : 80;
        const gridTop = y + 34;
        const gridH = Math.max(100, h - gridTop + y - tooltipH - 12);
        const cellW = Math.floor((w - pad * 2) / 3);
        const cellH = Math.floor((gridH - 18) / 4);
        const gridY0 = gridTop + 16;
        if (cellW <= 0 || cellH <= 0) return;
        const c = Math.floor((cx - (x + pad)) / cellW);
        const r = Math.floor((cy - gridY0) / cellH);
        if (c < 0 || c >= 3 || r < 0 || r >= 4) return;
        sel.col = c; sel.row = r;
        try { if (typeof audio !== 'undefined') audio.menuSelect(); } catch (_) {}
        try { NEON.upgrades.handleUpgradeInput('Enter', gameProxy, sel); } catch (_) {}
      },
    };
  }

  // ─── Module Slots adapter ──────────────────────────────────────────────────
  // Wraps NEON.modules (shipped in #37) into the terminal-panel API.
  /** @param {any} game */
  function _buildModulesPanel(game) {
    /** @type {any} */ let state = null;
    return {
      id: 'modules',
      label: 'MODULE SLOTS',
      _accent: '#bb44ff',
      onOpen() { state = NEON.modules.defaultPanelState(); },
      onClose() { state = null; },
      update() {
        if (typeof jp !== 'function' || !state) return;
        const km_ = (typeof km === 'function') ? km : () => null;
        const keyMap = [
          ['ArrowUp', km_('up')], ['ArrowDown', km_('down')],
          ['Enter', km_('interact')], ['Tab', null],
        ];
        for (const [key, alt] of keyMap) {
          if (jp(key) || (alt && jp(alt))) {
            NEON.modules.handleModuleSlotsKey(game, state, key);
            try { audio.menuSelect(); } catch (_) {}
            return;
          }
        }
        // ESC during sell-confirm cancels the prompt but should NOT close the
        // whole panel. Consume the key from justPressed so the hub harness
        // doesn't also see it.
        if (jp('Escape') && state.confirmSell) {
          NEON.modules.handleModuleSlotsKey(game, state, 'Escape');
          try { justPressed.delete('Escape'); } catch (_) {}
          return;
        }
        // S key for sell
        if (jp('KeyS')) {
          NEON.modules.handleModuleSlotsKey(game, state, 'S');
          return;
        }
        // Y/N for confirm dialog
        if (state.confirmSell) {
          if (jp('KeyY')) { NEON.modules.handleModuleSlotsKey(game, state, 'Y'); try { audio.menuSelect(); } catch (_) {} }
          if (jp('KeyN')) { NEON.modules.handleModuleSlotsKey(game, state, 'N'); }
        }
      },
      draw(/** @type {any} */ ctx, /** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ w, /** @type {number} */ h) {
        try { NEON.modules.drawModuleSlotsPanel(ctx, x, y, w, h, game, state); } catch (_) {}
      },
      // Touch hit-test for slot/inventory rows. Layout mirrors
      // modules.js drawModuleSlotsPanel — if column math changes there,
      // update here too. Tap a slot row → focus+Enter (uninstall if filled).
      // Tap an inv row → focus+Enter (install into first empty slot).
      // Sell is intentionally NOT exposed via tap (avoids accidental sell);
      // S key still works for tablets w/ keyboards.
      /** @param {number} cx @param {number} cy @param {{x:number,y:number,w:number,h:number}} bounds @param {any} g */
      onTap(cx, cy, bounds, g) {
        if (!state || state.confirmSell) return;
        const { x, y, w } = bounds;
        let meta = null;
        try { if (typeof NEON !== 'undefined' && NEON.save) meta = NEON.save.loadMeta(); } catch (_) {}
        if (!meta) return;
        const slots = meta.modulesInstalled || [];
        const owned = meta.modulesOwned || [];
        const col1X = x + 12, col1W = Math.floor(w * 0.42);
        const col2X = x + col1W + 24, col2W = w - col1W - 36;
        const topY = y + 40, rowH = 22;
        if (cx >= col1X && cx <= col1X + col1W) {
          const i = Math.floor((cy - topY) / rowH);
          if (i >= 0 && i < slots.length) {
            state.focus = 'slot'; state.slotIdx = i;
            try { if (typeof audio !== 'undefined') audio.menuSelect(); } catch (_) {}
            try { NEON.modules.handleModuleSlotsKey(g, state, 'Enter'); } catch (_) {}
            return;
          }
        }
        if (cx >= col2X && cx <= col2X + col2W) {
          const i = Math.floor((cy - topY) / rowH);
          // Match drawModuleSlotsPanel: inv column only renders min(owned, maxRows).
          const maxRows = Math.floor((bounds.h - 80) / rowH);
          const shown = Math.min(owned.length, Math.max(0, maxRows));
          if (i >= 0 && i < shown) {
            state.focus = 'inv'; state.invIdx = i;
            try { if (typeof audio !== 'undefined') audio.menuSelect(); } catch (_) {}
            try { NEON.modules.handleModuleSlotsKey(g, state, 'Enter'); } catch (_) {}
            return;
          }
        }
      },
    };
  }

  // ─── State helpers ────────────────────────────────────────────────────────

  /** @param {number} floor */
  function _area(floor) {
    try {
      if (typeof NEON !== 'undefined' && NEON.biomes) return NEON.biomes.areaForFloor(floor);
    } catch (_) { /* ignore */ }
    return { name: 'UNKNOWN', id: 'unknown' };
  }

  function _cores() {
    try {
      if (typeof NEON !== 'undefined' && NEON.save) return (NEON.save.loadMeta().cores | 0);
    } catch (_) { /* ignore */ }
    return 0;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  // enterHub captures the current floor/biome and flips state to 'HUB'.
  // Called from game.js after the stairs/terminal interaction on floors 1+.
  /** @param {any} game */
  function enterHub(game) {
    if (!game) return;
    const fromFloor = game.floor | 0;
    const area = _area(fromFloor);
    game.hub = {
      terminals: buildTerminals(game),
      selected: 0,
      activePanel: null,
      fromFloor,
      nextFloor: fromFloor + 1,
      biomeName: area.name || 'UNKNOWN',
      biomeId: area.id || 'unknown',
      t: 0, // ambient anim clock
    };
    if (typeof game.setState === 'function') {
      game.setState('HUB');
    } else {
      game.state = 'HUB';
    }
    try { if (typeof audio !== 'undefined' && audio.hubAmbient) audio.hubAmbient(); } catch (_) {}
    // Telemetry
    try { if (typeof NEON !== 'undefined' && NEON.telemetry) NEON.telemetry.track('hub_enter', { floor: fromFloor }); } catch (_) {}
  }

  // exitHub advances to the next floor and restores 'PLAYING'. Uses the
  // existing fadeTo transition so it feels continuous with normal descent.
  /** @param {any} game */
  function exitHub(game) {
    if (!game || !game.hub) return;
    const next = game.hub.nextFloor | 0;
    // Close any open panel so its onClose hook fires.
    if (game.hub.activePanel) {
      try { game.hub.activePanel.onClose(game); } catch (_) {}
      game.hub.activePanel = null;
    }
    try { if (typeof audio !== 'undefined' && audio.descend) audio.descend(); } catch (_) {}
    game.hub = null;
    if (typeof game.fadeTo === 'function') {
      game.fadeTo('DESCENDING TO FLOOR ' + next, () => {
        if (typeof game.loadFloor === 'function') game.loadFloor(next);
      }, 'PLAYING');
    } else {
      // Node / no-canvas path (tests): just advance state + floor.
      game.floor = next;
      game.state = 'PLAYING';
    }
  }

  // updateHub — input dispatch. Requires globals jp(), km() in browser; in
  // Node tests pass a stub via game._hubInput = { jp, km } if you want to
  // exercise input paths (not required for the basic transition tests).
  /** @param {any} game @param {number} dt */
  function updateHub(game, dt) {
    const hub = game && game.hub;
    if (!hub) return;
    hub.t += (dt || 0);

    // Resolve input helpers. Default to globals (browser).
    const input = game._hubInput || (typeof jp === 'function'
      ? { jp, km: (typeof km === 'function' ? km : () => null) }
      : null);
    if (!input) return;
    const _jp = input.jp, _km = input.km;

    // Route to active panel if open.
    if (hub.activePanel) {
      hub.activePanel.update(dt, input);
      if (_jp('Escape') || _jp('KeyQ')) {
        try { hub.activePanel.onClose(game); } catch (_) {}
        hub.activePanel = null;
        try { if (typeof audio !== 'undefined' && audio.menuSelect) audio.menuSelect(); } catch (_) {}
      }
      // Touch/click: tap outside panel or on the BACK prompt area to close.
      if (_jp('MouseLeft')) {
        const W_ = (typeof W !== 'undefined') ? W : 900;
        const H_ = (typeof H !== 'undefined') ? H : 600;
        const pw = Math.min(560, W_ - 60);
        const ph = Math.min(380, H_ - 120);
        const px = Math.floor((W_ - pw) / 2);
        const py = Math.floor((H_ - ph) / 2);
        const mx = (typeof mouse !== 'undefined') ? mouse.x : 0;
        const my = (typeof mouse !== 'undefined') ? mouse.y : 0;
        // Outside panel bounds = close
        if (mx < px || mx > px + pw || my < py || my > py + ph) {
          try { hub.activePanel.onClose(game); } catch (_) {}
          hub.activePanel = null;
          try { if (typeof audio !== 'undefined' && audio.menuSelect) audio.menuSelect(); } catch (_) {}
        }
      }
      return;
    }

    // Selector navigation.
    const n = hub.terminals.length;
    if (_jp('ArrowLeft')  || _jp(_km('left')))  { hub.selected = (hub.selected + n - 1) % n; _blip(); }
    if (_jp('ArrowRight') || _jp(_km('right'))) { hub.selected = (hub.selected + 1) % n;     _blip(); }
    // Number-key direct-select.
    for (let i = 0; i < n && i < 4; i++) {
      if (_jp('Digit' + (i + 1))) { hub.selected = i; _blip(); }
    }

    // Activate / descend.
    if (_jp('Enter') || _jp(_km('interact'))) {
      const term = hub.terminals[hub.selected];
      if (term) {
        hub.activePanel = term;
        try { term.onOpen(game); } catch (_) {}
        try { if (typeof audio !== 'undefined' && audio.menuSelect) audio.menuSelect(); } catch (_) {}
        try { if (typeof NEON !== 'undefined' && NEON.telemetry) NEON.telemetry.track('hub_terminal', { terminal: term.id }); } catch (_) {}
      }
      return;
    }
    if (_jp(_km('shoot')) || _jp('Space')) {
      exitHub(game);
      return;
    }
  }

  function _blip() {
    try { if (typeof audio !== 'undefined' && audio.menuSelect) audio.menuSelect(); } catch (_) {}
  }

  // Single source of truth for hub layout. Used by drawHub AND hitTestHub so
  // touch hit-tests cannot drift out of sync with rendered positions
  // (a class of bug we've hit before — see menu touch coupling memory).
  /** @param {number} W_ @param {number} H_ @param {number} n @param {boolean} isTouch */
  function _layoutHub(W_, H_, n, isTouch) {
    const gap = 14;
    const margin = 40;
    const tw = Math.min(180, Math.floor((W_ - margin * 2 - gap * (n - 1)) / n));
    const th = 150;
    const rowY = Math.floor(H_ / 2 - th / 2 + 20);
    const rowX = Math.floor((W_ - (tw * n + gap * (n - 1))) / 2);
    let descendBtn = null;
    if (isTouch) {
      // Bottom-center pill. Preferred position is well below the prompt line
      // (rowY+th+40), but on short viewports we clamp the button so it never
      // overlaps the terminal card row visually — gating both ends:
      //   floor (no overlap with cards):  rowY + th + 16
      //   ceiling (stay on screen):       H - bh - 12
      // If the screen is so short that floor > ceiling, the button takes
      // priority over staying fully on-screen so it remains tappable.
      const bw = Math.min(260, W_ - 80);
      const bh = 56;
      const bx = Math.floor((W_ - bw) / 2);
      const preferred = rowY + th + 80;
      const ceiling = H_ - bh - 12;
      const floor = rowY + th + 16;
      const by = Math.max(floor, Math.min(ceiling, preferred));
      descendBtn = { x: bx, y: by, w: bw, h: bh };
    }
    return { rowX, rowY, tw, th, gap, descendBtn };
  }

  /** @param {any} ctx @param {any} btn @param {number} t */
  function _drawDescendButton(ctx, btn, t) {
    const { x, y, w, h } = btn;
    const pulse = 0.5 + 0.5 * Math.sin((t || 0) * 2.4);
    ctx.save();
    ctx.fillStyle = 'rgba(0,40,30,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#00ffaa';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10 + pulse * 6;
    ctx.shadowColor = '#00ffaa';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#bfffe6';
    ctx.font = '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▼ DESCEND', x + w / 2, y + h / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // Hit-test screen-space (cx,cy) against the hub layout. Returns one of:
  //   { kind: 'terminal', index }   — tap on a terminal card
  //   { kind: 'descend' }           — tap on the touch DESCEND button
  //   null                           — tap on empty hub space
  // Returns null when a panel is open (panel-close is handled separately by
  // updateHub's MouseLeft branch).
  /** @param {any} game @param {number} cx @param {number} cy */
  function hitTestHub(game, cx, cy) {
    const hub = game && game.hub;
    if (!hub || hub.activePanel) return null;
    const W_ = (typeof W !== 'undefined') ? W : 900;
    const H_ = (typeof H !== 'undefined') ? H : 600;
    const n = hub.terminals.length;
    const isTouch = (typeof isTouchDevice === 'function') ? isTouchDevice() : false;
    const { rowX, rowY, tw, th, gap, descendBtn } = _layoutHub(W_, H_, n, isTouch);
    // Terminal cards. Pad vertically a bit for fat-finger tolerance.
    // Checked BEFORE descendBtn so on short viewports where the button
    // clamps into the card row, card taps still win (selection is the
    // primary action; descend is recoverable via re-tap).
    const pad = 8;
    if (cy >= rowY - pad && cy <= rowY + th + pad) {
      for (let i = 0; i < n; i++) {
        const tx = rowX + i * (tw + gap);
        if (cx >= tx - pad / 2 && cx <= tx + tw + pad / 2) {
          return { kind: 'terminal', index: i };
        }
      }
    }
    if (descendBtn) {
      const b = descendBtn;
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        return { kind: 'descend' };
      }
    }
    return null;
  }

  // hitTestActivePanel — when a panel is open, route the tap to its onTap
  // (if implemented) or report it as outside-panel so the caller can close.
  // Returns true if the tap was inside the panel rect (consumed); false if
  // it was outside (caller should fall through to its existing close-on-
  // outside behavior). Returns false if no panel is active.
  /** @param {any} game @param {number} cx @param {number} cy */
  function hitTestActivePanel(game, cx, cy) {
    const hub = game && game.hub;
    if (!hub || !hub.activePanel) return false;
    const W_ = (typeof W !== 'undefined') ? W : 900;
    const H_ = (typeof H !== 'undefined') ? H : 600;
    const pw = Math.min(560, W_ - 60);
    const ph = Math.min(380, H_ - 120);
    const px = Math.floor((W_ - pw) / 2);
    const py = Math.floor((H_ - ph) / 2);
    if (cx < px || cx > px + pw || cy < py || cy > py + ph) return false;
    const panel = hub.activePanel;
    if (typeof panel.onTap === 'function') {
      try { panel.onTap(cx, cy, { x: px, y: py, w: pw, h: ph }, game); } catch (_) {}
    }
    return true;
  }

  // drawHub — renders hub chrome + terminal row. Canvas-only; no-op in Node.
  /** @param {any} ctx @param {any} game */
  function drawHub(ctx, game) {
    if (!ctx || !game || !game.hub) return;
    const hub = game.hub;
    const W_ = (typeof W !== 'undefined') ? W : (ctx.canvas ? ctx.canvas.width : 900);
    const H_ = (typeof H !== 'undefined') ? H : (ctx.canvas ? ctx.canvas.height : 600);

    // Backdrop — deep void with a subtle horizon glow.
    ctx.save();
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, W_, H_);
    const grd = ctx.createLinearGradient(0, 0, 0, H_);
    grd.addColorStop(0, 'rgba(0,50,80,0.18)');
    grd.addColorStop(0.55, 'rgba(20,0,40,0.10)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W_, H_);

    // Ambient scanlines.
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#00f5ff';
    for (let y = (hub.t * 18) % 4; y < H_; y += 4) ctx.fillRect(0, y, W_, 1);
    ctx.globalAlpha = 1;

    // ─── HUD: top-left cores wallet.
    const cores = _cores();
    ctx.textAlign = 'left';
    ctx.font = '13px monospace';
    ctx.shadowBlur = 8; ctx.shadowColor = '#00f5ff';
    ctx.fillStyle = '#00f5ff';
    ctx.fillText('◈ ' + cores + '  CORES', 16, 24);
    ctx.shadowBlur = 0;

    // ─── HUD: top-right biome + floor progression.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffb700';
    ctx.font = '13px monospace';
    ctx.fillText(hub.biomeName, W_ - 16, 24);
    ctx.fillStyle = '#888ab0';
    ctx.font = '11px monospace';
    ctx.fillText('FLOOR ' + hub.fromFloor + ' → FLOOR ' + hub.nextFloor, W_ - 16, 42);

    // ─── Title.
    ctx.textAlign = 'center';
    ctx.font = '28px monospace';
    ctx.fillStyle = '#e0e0ff';
    ctx.shadowBlur = 14; ctx.shadowColor = '#bb44ff';
    ctx.fillText('THE GAP', W_ / 2, 78);
    ctx.shadowBlur = 0;
    ctx.font = '11px monospace';
    ctx.fillStyle = '#666688';
    ctx.fillText('— liminal interlink —', W_ / 2, 96);

    // ─── Terminal row.
    const n = hub.terminals.length;
    const _isTouch = (typeof isTouchDevice === 'function') ? isTouchDevice() : false;
    const layout = _layoutHub(W_, H_, n, _isTouch);
    const { rowX, rowY, tw, th, gap, descendBtn } = layout;

    for (let i = 0; i < n; i++) {
      const term = hub.terminals[i];
      const sel = i === hub.selected && !hub.activePanel;
      const tx = rowX + i * (tw + gap);
      _drawTerminalCard(ctx, tx, rowY, tw, th, term, sel, hub.t);
    }

    // ─── Prompt.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888ab0';
    ctx.font = '12px monospace';
    const promptY = rowY + th + 40;
    if (hub.activePanel) {
      ctx.fillText(_isTouch ? 'TAP OUTSIDE TO CLOSE' : '[ESC] BACK', W_ / 2, promptY);
    } else if (_isTouch) {
      ctx.fillText('TAP TERMINAL TO ACTIVATE', W_ / 2, promptY);
    } else {
      ctx.fillText('◀▶ / 1-4 SELECT   [ENTER] ACTIVATE   [SPACE] DESCEND', W_ / 2, promptY);
    }

    // ─── Touch-only DESCEND button (no keyboard equivalent on mobile).
    if (descendBtn && !hub.activePanel) {
      _drawDescendButton(ctx, descendBtn, hub.t);
    }

    // ─── Active panel (drawn on top).
    if (hub.activePanel) {
      const pw = Math.min(560, W_ - 60);
      const ph = Math.min(380, H_ - 120);
      const px = Math.floor((W_ - pw) / 2);
      const py = Math.floor((H_ - ph) / 2);
      // Dim backdrop.
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W_, H_);
      try { hub.activePanel.draw(ctx, px, py, pw, ph); } catch (_) {}
    }

    ctx.restore();
  }

  /** @param {any} ctx @param {number} x @param {number} y @param {number} w @param {number} h @param {any} term @param {boolean} sel @param {number} t */
  function _drawTerminalCard(ctx, x, y, w, h, term, sel, t) {
    const accent = term._accent || '#00f5ff';
    ctx.save();
    ctx.fillStyle = sel ? 'rgba(20,28,44,0.95)' : 'rgba(10,12,22,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.lineWidth = sel ? 2 : 1;
    ctx.strokeStyle = sel ? accent : '#333355';
    if (sel) { ctx.shadowBlur = 12; ctx.shadowColor = accent; }
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.shadowBlur = 0;

    // Icon slot.
    ctx.fillStyle = accent;
    ctx.globalAlpha = sel ? 0.9 : 0.55;
    ctx.fillRect(x + 12, y + 14, w - 24, 3);
    ctx.globalAlpha = 1;

    // Label.
    ctx.textAlign = 'center';
    ctx.fillStyle = sel ? '#ffffff' : '#b8b8d0';
    ctx.font = '13px monospace';
    if (sel) { ctx.shadowBlur = 8; ctx.shadowColor = accent; }
    const parts = term.label.split(' ');
    let ly = y + Math.floor(h / 2) - (parts.length > 1 ? 8 : 0);
    for (const part of parts) { ctx.fillText(part, x + w / 2, ly); ly += 16; }
    ctx.shadowBlur = 0;

    // Number hint.
    ctx.fillStyle = sel ? accent : '#555577';
    ctx.font = '11px monospace';
    ctx.fillText('[' + (term._keyIdx || '?') + ']', x + w / 2, y + h - 12);
    ctx.restore();
  }

  // Attach key hint numbers to terminals as they're rendered. We do it here
  // rather than in buildTerminals so the hub harness owns ordering.
  /** @param {any[]} terminals */
  function _annotateKeyIdx(terminals) {
    for (let i = 0; i < terminals.length; i++) terminals[i]._keyIdx = String(i + 1);
  }

  // Wrap drawHub to annotate before drawing (kept separate to keep draw pure).
  const _drawHub = drawHub;
  /** @param {any} ctx @param {any} game */
  function drawHubWithAnnotations(ctx, game) {
    if (game && game.hub && game.hub.terminals) _annotateKeyIdx(game.hub.terminals);
    return _drawHub(ctx, game);
  }

  return {
    enterHub,
    exitHub,
    updateHub,
    drawHub: drawHubWithAnnotations,
    hitTestHub,
    hitTestActivePanel,
    // Exposed for tests / sibling modules.
    buildTerminals,
  };
}));
