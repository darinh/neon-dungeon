// @ts-check
'use strict';

(function (root, factory) {
  const v = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = v;
    return;
  }
  const r = /** @type {any} */ (root);
  const neon = /** @type {any} */ (r.NEON = r.NEON || {});
  neon.gameStates = v;
}(/** @type {any} */ (typeof globalThis !== 'undefined'
  ? globalThis
  : (typeof self !== 'undefined' ? self : this)), function () {
  'use strict';

  const GAME_STATES = Object.freeze({
    MENU: 'MENU',
    CHEATS: 'CHEATS',
    SEED_SETUP: 'SEED_SETUP',
    INTRO: 'INTRO',
    ENDGAME_CHOICE: 'ENDGAME_CHOICE',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    POWERUP_CHOICE: 'POWERUP_CHOICE',
    WEAPON_SWAP: 'WEAPON_SWAP',
    PERK_CHOICE: 'PERK_CHOICE',
    AUGMENT_CHOICE: 'AUGMENT_CHOICE',
    EVENT_CHOICE: 'EVENT_CHOICE',
    SHOPPING: 'SHOPPING',
    READING: 'READING',
    SYSTEM_MESSAGE: 'SYSTEM_MESSAGE',
    MAINFRAME_READER: 'MAINFRAME_READER',
    MESSAGE_SEND: 'MESSAGE_SEND',
    ARCHIVES: 'ARCHIVES',
    SETTINGS: 'SETTINGS',
    FADE: 'FADE',
    HUB: 'HUB',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY',
    NAME_ENTRY: 'NAME_ENTRY',
  });

  /** @type {Set<string>} */
  const GAME_STATES_SET = new Set(Object.values(GAME_STATES));
  /** @type {Set<string>} */
  const PAUSABLE_STATES = new Set([GAME_STATES.PLAYING]);
  /** @type {Set<string>} */
  const RUN_SAVE_STATES = new Set([
    GAME_STATES.PLAYING,
    GAME_STATES.PAUSED,
    GAME_STATES.READING,
    GAME_STATES.SYSTEM_MESSAGE,
    GAME_STATES.POWERUP_CHOICE,
    GAME_STATES.WEAPON_SWAP,
    GAME_STATES.PERK_CHOICE,
    GAME_STATES.AUGMENT_CHOICE,
    GAME_STATES.EVENT_CHOICE,
    GAME_STATES.SHOPPING,
    GAME_STATES.MAINFRAME_READER,
    GAME_STATES.MESSAGE_SEND,
  ]);
  /** @type {Set<string>} */
  const TOUCH_ROUTE_AS_CLICK_STATES = new Set([
    GAME_STATES.POWERUP_CHOICE,
    GAME_STATES.WEAPON_SWAP,
    GAME_STATES.SHOPPING,
    GAME_STATES.PERK_CHOICE,
    GAME_STATES.AUGMENT_CHOICE,
    GAME_STATES.EVENT_CHOICE,
    GAME_STATES.READING,
    GAME_STATES.MAINFRAME_READER,
    GAME_STATES.MESSAGE_SEND,
    GAME_STATES.SYSTEM_MESSAGE,
    GAME_STATES.CHEATS,
    GAME_STATES.ARCHIVES,
    GAME_STATES.GAME_OVER,
    GAME_STATES.VICTORY,
  ]);
  /** @type {Set<string>} */
  const MENU_MUSIC_STATES = new Set([
    GAME_STATES.MENU,
    GAME_STATES.SEED_SETUP,
    GAME_STATES.ARCHIVES,
  ]);
  /** @type {Set<string>} */
  const CHEAT_NO_PLAYFIELD_STATES = new Set([
    GAME_STATES.MENU,
    GAME_STATES.SEED_SETUP,
    GAME_STATES.ARCHIVES,
    GAME_STATES.SETTINGS,
    GAME_STATES.HUB,
  ]);
  const PAUSE_ACTION_STATES = Object.freeze([
    GAME_STATES.PLAYING,
    GAME_STATES.SETTINGS,
    GAME_STATES.MENU,
  ]);

  /**
   * @param {Iterable<string>} states
   * @param {string} label
   */
  function assertKnownStates(states, label) {
    for (const state of states) {
      if (!GAME_STATES_SET.has(state)) {
        throw new Error(label + ' contains unknown game state "' + state + '"');
      }
    }
  }

  assertKnownStates(PAUSABLE_STATES, 'PAUSABLE_STATES');
  assertKnownStates(RUN_SAVE_STATES, 'RUN_SAVE_STATES');
  assertKnownStates(TOUCH_ROUTE_AS_CLICK_STATES, 'TOUCH_ROUTE_AS_CLICK_STATES');
  assertKnownStates(MENU_MUSIC_STATES, 'MENU_MUSIC_STATES');
  assertKnownStates(CHEAT_NO_PLAYFIELD_STATES, 'CHEAT_NO_PLAYFIELD_STATES');
  assertKnownStates(PAUSE_ACTION_STATES, 'PAUSE_ACTION_STATES');

  /**
   * @param {string} state
   * @param {string | null | undefined} settingsFrom
   */
  function isMenuMusicState(state, settingsFrom) {
    return MENU_MUSIC_STATES.has(state) ||
      (state === GAME_STATES.SETTINGS && settingsFrom === GAME_STATES.MENU);
  }

  /** @param {string | null | undefined} returnState */
  function shouldRenderPlayfieldBehindCheats(returnState) {
    return !CHEAT_NO_PLAYFIELD_STATES.has(returnState || '');
  }

  return Object.freeze({
    GAME_STATES,
    GAME_STATES_SET,
    PAUSABLE_STATES,
    RUN_SAVE_STATES,
    TOUCH_ROUTE_AS_CLICK_STATES,
    PAUSE_ACTION_STATES,
    isMenuMusicState,
    shouldRenderPlayfieldBehindCheats,
  });
}));
