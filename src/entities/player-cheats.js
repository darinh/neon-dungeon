// @ts-check
'use strict';

// Cheat toggles live on game.cheats, read through the entity runtime proxy
// because game is declared later.
/** @param {string} id */
function playerCheatEnabled(id) {
  return !!(_EG.cheats && _EG.cheats[id]);
}
