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

  function buildTerminals() {
    return [
      makePlaceholder('upgrade', 'UPGRADE MATRIX', 'Cortex upgrades — coming online (#36)', '#00f5ff'),
      makePlaceholder('modules', 'MODULE SLOTS',   'Module install/sell — coming online (#37)', '#bb44ff'),
      ArmoryTerminal,
      makePlaceholder('archive', 'ARCHIVE',        'Data logs — coming online (#41)', '#39ff14'),
    ];
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
      terminals: buildTerminals(),
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
    const gap = 14;
    const margin = 40;
    const tw = Math.min(180, Math.floor((W_ - margin * 2 - gap * (n - 1)) / n));
    const th = 150;
    const rowY = Math.floor(H_ / 2 - th / 2 + 20);
    const rowX = Math.floor((W_ - (tw * n + gap * (n - 1))) / 2);

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
      ctx.fillText('[ESC] BACK', W_ / 2, promptY);
    } else {
      ctx.fillText('◀▶ / 1-4 SELECT   [ENTER] ACTIVATE   [SPACE] DESCEND', W_ / 2, promptY);
    }

    // ─── Active panel (drawn on top).
    if (hub.activePanel) {
      const pw = Math.min(520, W_ - 80);
      const ph = Math.min(320, H_ - 160);
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
    // Exposed for tests / sibling modules.
    buildTerminals,
  };
}));
