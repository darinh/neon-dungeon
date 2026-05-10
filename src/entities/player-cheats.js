// @ts-check
'use strict';

// Player cheat bridge. Runtime-only cheat toggles live on game.cheats and are
// accessed through the entity runtime proxy because game is declared later.
/** @param {string} id */
function playerCheatEnabled(id) {
  return !!(_EG.cheats && _EG.cheats[id]);
}
