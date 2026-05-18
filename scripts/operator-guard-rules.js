// @ts-check
'use strict';

const ACTIVE_ISSUE_NUMBER = '579';

/**
 * @param {string} command
 * @returns {boolean}
 */
function commandRunsRawGhPrMerge(command) {
  // Conservative text scan: harmless mentions are blocked so quoted shell
  // wrappers like `bash -lc 'gh pr merge ...'` cannot bypass the guard.
  return /(?:^|[^\w:-])gh\s+pr\s+merge\b/.test(String(command || ''));
}

module.exports = {
  ACTIVE_ISSUE_NUMBER,
  commandRunsRawGhPrMerge,
};
