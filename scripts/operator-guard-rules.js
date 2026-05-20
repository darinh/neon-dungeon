// @ts-check
'use strict';

const ACTIVE_ISSUE_NUMBER = '579';

const BOUNDED_OUTPUT_PIPE =
  /\|\s*(?:wc\s+-l|grep\s+-c|sed\s+-n\s+['"]?\d+\s*,\s*\d+p['"]?|head(?:\s+-n)?\s+\d+)\b/;
const GIT_PREFIX = String.raw`(?:^|[^\w:-])(?:env\s+(?:\S+\s+)*)?(?:[A-Za-z_]\w*=\S+\s+)*git(?:\s+(?:--no-pager|-C\s+\S+|-c\s+\S+|--git-dir(?:=|\s+)\S+|--work-tree(?:=|\s+)\S+))*`;
const RAW_GIT_WORKTREE_LIST = new RegExp(`${GIT_PREFIX}\\s+worktree\\s+list\\b`);
const RAW_GIT_BRANCH_NO_MERGED = new RegExp(`${GIT_PREFIX}\\s+branch\\b[^\\n;&|]*--no-merged\\b`);
const NON_EXECUTING_MENTION = /^\s*(?:echo|printf|grep|rg)\b/;
const PIPE_TEXT_SEARCH_MENTION = /\|\s*(?:grep|rg)\b[\s\S]*\bgit\s+(?:worktree\s+list|branch\b[^;&|]*--no-merged)\b/;

/**
 * @param {string} command
 * @returns {boolean}
 */
function commandRunsRawGhPrMerge(command) {
  // Conservative text scan: harmless mentions are blocked so quoted shell
  // wrappers like `bash -lc 'gh pr merge ...'` cannot bypass the guard.
  return /(?:^|[^\w:-])gh\s+pr\s+merge\b/.test(String(command || ''));
}

/**
 * @param {string} command
 * @returns {boolean}
 */
function commandRunsUnboundedStartupDiscovery(command) {
  const segments = String(command || '').split(/\n|&&|\|\||;/);
  return segments.some((segment) => {
    if (NON_EXECUTING_MENTION.test(segment)) return false;
    if (PIPE_TEXT_SEARCH_MENTION.test(segment)) return false;
    const hasBroadDiscovery =
      RAW_GIT_WORKTREE_LIST.test(segment) ||
      RAW_GIT_BRANCH_NO_MERGED.test(segment);
    return hasBroadDiscovery && !BOUNDED_OUTPUT_PIPE.test(segment);
  });
}

/**
 * @param {string} toolName
 * @param {any} toolArgs
 * @returns {string[]}
 */
function bashCommandsFromToolCall(toolName, toolArgs) {
  const name = String(toolName || '');
  if (name.endsWith('bash')) return [String(toolArgs?.command || '')];
  if (!name.endsWith('multi_tool_use.parallel') || !Array.isArray(toolArgs?.tool_uses)) return [];
  /** @type {string[]} */
  const commands = [];
  for (const toolUse of toolArgs.tool_uses) {
    if (String(toolUse?.recipient_name || '').endsWith('bash')) {
      commands.push(String(toolUse?.parameters?.command || ''));
    }
  }
  return commands;
}

/**
 * @param {string} toolName
 * @param {any} toolArgs
 * @returns {boolean}
 */
function toolCallRunsRawGhPrMerge(toolName, toolArgs) {
  return bashCommandsFromToolCall(toolName, toolArgs).some(commandRunsRawGhPrMerge);
}

/**
 * @param {string} toolName
 * @param {any} toolArgs
 * @returns {boolean}
 */
function toolCallRunsUnboundedStartupDiscovery(toolName, toolArgs) {
  return bashCommandsFromToolCall(toolName, toolArgs).some(commandRunsUnboundedStartupDiscovery);
}

module.exports = {
  ACTIVE_ISSUE_NUMBER,
  bashCommandsFromToolCall,
  commandRunsRawGhPrMerge,
  commandRunsUnboundedStartupDiscovery,
  toolCallRunsRawGhPrMerge,
  toolCallRunsUnboundedStartupDiscovery,
};
