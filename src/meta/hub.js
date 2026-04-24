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
//   }
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.NEON = root.NEON || {}).hub = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Terminals ────────────────────────────────────────────────────────────
  // Stubs for #36/#37/#41. Each conforms to the terminal-panel API; the full
  // implementations will replace the placeholder draw/update bodies without
  // touching the hub harness.

  function makePlaceholder(id, label, hint, accent) {
    return {
      id, label,
      _accent: accent || '#00f5ff',
      _hint: hint,
      onOpen() {},
      onClose() {},
      update(/* dt, input */) {},
      draw(ctx, x, y, w, h) {
        ctx.save();
        ctx.fillStyle = 'rgba(8,10,20,0.92)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = this._accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.fillStyle = this._accent;
        ctx.font = '18px monospace';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10; ctx.shadowColor = this._accent;
        ctx.fillText(this.label, x + w / 2, y + 32);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#888ab0';
        ctx.font = '12px monospace';
        ctx.fillText(this._hint, x + w / 2, y + 60);
        ctx.fillStyle = '#555577';
        ctx.font = '11px monospace';
        ctx.fillText('[ESC] BACK', x + w / 2, y + h - 16);
        ctx.restore();
      },
    };
  }

  // ARMORY — minimal stub: shows currently-equipped weapon name. Real weapon
  // swap UI wire-up is deferred (noted in the PR); keeping the API identical
  // so the upgrade is drop-in.
  const ArmoryTerminal = {
    id: 'armory',
    label: 'ARMORY',
    _accent: '#ffb700',
    onOpen() {},
    onClose() {},
    update(/* dt, input */) {},
    draw(ctx, x, y, w, h) {
      ctx.save();
      ctx.fillStyle = 'rgba(8,10,20,0.92)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = this._accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.fillStyle = this._accent;
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 10; ctx.shadowColor = this._accent;
      ctx.fillText('ARMORY', x + w / 2, y + 32);
      ctx.shadowBlur = 0;

      // Lookup current weapon from game global (browser only)
      let weaponName = '—';
      try {
        if (typeof game !== 'undefined' && game && game.player && game.player.weapon) {
          weaponName = game.player.weapon.name || game.player.weapon.id || '—';
        }
      } catch (_) { /* ignore */ }

      ctx.fillStyle = '#e0e0ff';
      ctx.font = '13px monospace';
      ctx.fillText('EQUIPPED', x + w / 2, y + 64);
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px monospace';
      ctx.fillText(String(weaponName).toUpperCase(), x + w / 2, y + 86);

      ctx.fillStyle = '#888ab0';
      ctx.font = '12px monospace';
      ctx.fillText('Weapon swap UI — coming online', x + w / 2, y + 118);

      ctx.fillStyle = '#555577';
      ctx.font = '11px monospace';
      ctx.fillText('[ESC] BACK', x + w / 2, y + h - 16);
      ctx.restore();
    },
  };

  // ARCHIVE — predecessor-log reader (#41). Lists every log the operative has
  // found, grouped by AXIOM predecessor. Unread logs are marked with a pulsing
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
      // Returns [{axiom, log, read}, ...] for all FOUND logs, in (axiom asc,
      // data order) — not all logs, so the terminal doesn't spoil unfound ones.
      try {
        const meta = NEON.save.loadMeta();
        const found = new Set(meta.logsFound || []);
        const read  = new Set(meta.logsRead  || []);
        const all = NEON.logs.groupedByAxiom();
        const out = [];
        for (const grp of all) {
          for (const log of grp.logs) {
            if (found.has(log.id)) out.push({ axiom: grp.axiom, log, read: read.has(log.id) });
          }
        }
        return out;
      } catch (_) { return []; }
    },
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
        const entry = list[this._sel];
        if (entry) {
          try { NEON.logs.readLog(entry.log.id); } catch (_) {}
          this._reading = entry.log;
          try { audio.logRead(); } catch (_) {}
        }
      }
    },
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
      ctx.fillText('SIGNAL FRAGMENTS: ' + progress.read + '/' + progress.total, x + w / 2, y + 44);

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
        ctx.fillText('recover AXIOM predecessor logs.', x + w / 2, y + h / 2 + 26);
        return;
      }

      // Scroll window.
      const rowH = 18;
      const headerH = 56;
      const footerH = 24;
      const listH = h - headerH - footerH;
      const rowsVisible = Math.max(3, Math.floor(listH / rowH));
      if (this._sel < this._scroll) this._scroll = this._sel;
      if (this._sel >= this._scroll + rowsVisible) this._scroll = this._sel - rowsVisible + 1;
      this._scroll = Math.max(0, Math.min(this._scroll, Math.max(0, list.length - rowsVisible)));

      ctx.textAlign = 'left';
      ctx.font = '12px monospace';
      let ry = y + headerH;
      const lastAxiom = -1;
      const endIdx = Math.min(list.length, this._scroll + rowsVisible);
      for (let i = this._scroll; i < endIdx; i++) {
        const entry = list[i];
        const sel = (i === this._sel);
        if (sel) {
          ctx.fillStyle = 'rgba(57,255,20,0.12)';
          ctx.fillRect(x + 8, ry - 12, w - 16, rowH - 2);
        }
        // Axiom prefix.
        ctx.fillStyle = sel ? accent : '#666688';
        ctx.fillText('AXIOM-' + entry.axiom, x + 14, ry);
        // Title.
        ctx.fillStyle = sel ? '#ffffff' : (entry.read ? '#9999bb' : '#e0e0ff');
        ctx.fillText(entry.log.title, x + 92, ry);
        // Unread marker — pulsing ● on right.
        if (!entry.read) {
          const a = 0.55 + 0.45 * Math.sin(this._t * 4 + i);
          ctx.fillStyle = accent;
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
    _drawReading(ctx, x, y, w, h) {
      const log = this._reading;
      const accent = this._accent;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#666688';
      ctx.font = '11px monospace';
      ctx.fillText('AXIOM-' + log.axiom, x + 14, y + 64);
      ctx.fillStyle = accent;
      ctx.font = '14px monospace';
      ctx.fillText(log.title, x + 14, y + 82);

      // Wrap body.
      ctx.fillStyle = '#c0c0e0';
      ctx.font = '12px monospace';
      const maxW = w - 28;
      const words = log.body.split(' ');
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
  function _buildUpgradePanel(game) {
    let sel = null;
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
      draw(ctx, x, y, w, h) {
        try { NEON.upgrades.drawUpgradeMatrix(ctx, x, y, w, h, gameProxy, sel); } catch (_) {}
      },
    };
  }

  // ─── Module Slots adapter ──────────────────────────────────────────────────
  // Wraps NEON.modules (shipped in #37) into the terminal-panel API.
  function _buildModulesPanel(game) {
    let state = null;
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
      draw(ctx, x, y, w, h) {
        try { NEON.modules.drawModuleSlotsPanel(ctx, x, y, w, h, game, state); } catch (_) {}
      },
    };
  }

  // ─── State helpers ────────────────────────────────────────────────────────

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

  // drawHub — renders hub chrome + terminal row. Canvas-only; no-op in Node.
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
  function _annotateKeyIdx(terminals) {
    for (let i = 0; i < terminals.length; i++) terminals[i]._keyIdx = String(i + 1);
  }

  // Wrap drawHub to annotate before drawing (kept separate to keep draw pure).
  const _drawHub = drawHub;
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
    // Exposed for tests / sibling modules.
    buildTerminals,
  };
}));
