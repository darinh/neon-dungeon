#!/usr/bin/env node
// scripts/check-engine-purity.js
//
// Phase D: enforce that engine/*.js stays free of NEON DUNGEON-specific
// narrative tokens. Files in engine/ are meant to be reusable across
// games; if a game-specific noun creeps in, this gate fails and points
// to the line.
//
// Forbidden tokens are deliberately narrative-specific (AXIOM, UNCHAINED,
// SENTINEL, etc.) so the false-positive rate stays low. Common words like
// "core", "shard", "boost", "module" are NOT in the list — they have
// non-NEON meanings and would constantly trip on UMD boilerplate.
//
// Comments and string literals inside UMD mounting glue (anything mentioning
// `NEON.*Engine` namespacing) are skipped per-line.

'use strict';
const fs = require('fs');
const path = require('node:path');

const ENGINE_DIR = path.resolve(__dirname, '..', 'engine');

// Case-sensitive narrative tokens that have no non-NEON meaning. Match as
// whole-word identifiers so we don't false-positive on substrings.
const FORBIDDEN = [
  'AXIOM',          // AXIOM-1..7 predecessor logs
  'UNCHAINED',      // UNCHAINED narrative arc
  'SENTINEL',       // SENTINEL-PRIME boss
  'WARDEN',         // WARDEN boss
  'OVERSEER',       // OVERSEER boss
  'ARCHITECT',      // THE ARCHITECT boss
  'GENESIS',        // GENESIS boss
  'CONDUCTOR',      // CONDUCTOR boss
  'OMEGA',          // OMEGA boss
  'HIVE',           // HIVE boss
  'COMPILER',       // THE COMPILER
  'NEON DUNGEON',   // game name
  'THE GAP',        // hub name
  // Lowercase biome ids — caught only when quoted as string literals so
  // we don't fire on e.g. `cache.put(...)` from a real cache API.
  "'sandbox'", '"sandbox"',
  "'opennet'", '"opennet"',
  // 'cache', 'firewall', 'uplink' deliberately omitted — too common as
  // generic words to flag without a parser.
];

function isPureLineCommentOrUmdLine(line) {
  const trimmed = line.trim();
  // Only full-line // comments (block comments are handled by scanText).
  if (trimmed.startsWith('//')) return true;
  // Skip UMD mount lines that legitimately mention NEON for namespacing.
  if (/NEON\s*=\s*root\.NEON/.test(line)) return true;
  if (/globalThis.*NEON/.test(line)) return true;
  return false;
}

function scan() {
  if (!fs.existsSync(ENGINE_DIR)) {
    console.error('engine/ directory not found at ' + ENGINE_DIR);
    process.exit(2);
  }
  const files = fs.readdirSync(ENGINE_DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(ENGINE_DIR, f));

  const findings = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    let inBlockComment = false;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      // Compute the "code-only" portion of this line by stripping block-
      // comment regions across multi-line state. A line can both close
      // and re-open a block comment; we process left-to-right.
      let scanText = '';
      let cursor = 0;
      while (cursor <= raw.length) {
        if (inBlockComment) {
          const close = raw.indexOf('*/', cursor);
          if (close === -1) { cursor = raw.length + 1; break; }
          cursor = close + 2;
          inBlockComment = false;
        } else {
          const open = raw.indexOf('/*', cursor);
          if (open === -1) { scanText += raw.slice(cursor); break; }
          scanText += raw.slice(cursor, open);
          cursor = open + 2;
          inBlockComment = true;
        }
      }
      // Strip trailing line comment from the code-only portion.
      const lineCommentIdx = scanText.indexOf('//');
      if (lineCommentIdx !== -1) scanText = scanText.slice(0, lineCommentIdx);
      if (!scanText.trim()) continue;
      // Final UMD/comment-line skip on the original line (full-line // only).
      if (isPureLineCommentOrUmdLine(raw)) continue;
      for (const token of FORBIDDEN) {
        const isQuoted = token.startsWith("'") || token.startsWith('"');
        // Identifier tokens: require a non-identifier char (or BOL) BEFORE
        // the token, but allow ANY suffix. This catches AXIOM, AXIOM_1,
        // AXIOM1, AXIOMS — all NEON-suffix patterns leak otherwise.
        const hit = isQuoted
          ? scanText.includes(token)
          : new RegExp('(^|[^A-Za-z0-9_$])' + token.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')).test(scanText);
        if (hit) {
          findings.push({
            file: path.relative(path.resolve(__dirname, '..'), file),
            line: i + 1,
            token,
            text: raw.trim(),
          });
        }
      }
    }
  }
  return findings;
}

const findings = scan();
const fileCount = fs.readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.js')).length;
if (findings.length === 0) {
  console.log('engine purity: ok (' + fileCount + ' files clean)');
  process.exit(0);
}

console.error('engine purity: FAIL — NEON-specific narrative tokens found in engine/:');
for (const f of findings) {
  console.error('  ' + f.file + ':' + f.line + '  [' + f.token + ']  ' + f.text);
}
console.error('\nengine/ files must be reusable across games. Move NEON-specific');
console.error('content to a wiring shim under src/ and inject it via a factory.');
process.exit(1);
