/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Compresses an ARIA snapshot YAML string by collapsing repeated sibling nodes.
 *
 * Many real-world pages produce enormous snapshots: a GitHub issues list with
 * 100 items, a data grid with 500 rows, an autocomplete with 200 options.
 * Each item is structurally identical — only the text and ref differ — so the
 * model learns nothing from seeing item #51 through #200.
 *
 * Algorithm:
 *   1. Pre-scan: compute (indent, signature) counts across all lines.
 *      Signature normalises away refs ([ref=eN] → [ref=?]) and numbers
 *      so that "Item 1" and "Item 47" share the same key.
 *   2. Safety gate: only proceed if some signature appears > FIRE_THRESHOLD
 *      times.  This prevents false positives on diverse pages where every
 *      node is unique.
 *   3. Compression pass: keep the first KEEP_N occurrences of any repeated
 *      pattern; collapse the remainder (along with their descendant subtrees).
 *      Interactive elements (buttons, inputs, links, …) are always kept.
 *   4. Emit a trailing note explaining what was removed and how to retrieve
 *      the full list via browser_evaluate().
 */

/** Only fire when a (indent, sig) pair repeats more than this many times. */
const FIRE_THRESHOLD = 100;

/** Keep the first N occurrences of any repeated structural pattern. */
const KEEP_N = 10;

/**
 * Roles that are always kept even when they are repeated — they carry distinct
 * semantic or interactive meaning.
 */
const ALWAYS_KEEP_ROLES = /\b(button|input|textbox|checkbox|radio|select|dialog|alert|navigation|main|form|search|menuitem|tab|status|heading|link|banner|region|columnheader|rowheader|gridcell)\b/i;

/**
 * Compute a structural signature for an ARIA snapshot line.
 *
 * Normalises away instance-specific data so that repeated siblings share the
 * same key:
 *   - `[ref=eN]`  → `[ref=?]`  (element references are unique per snapshot)
 *   - double-quoted strings → `""`  (accessible names differ per item)
 *   - single-quoted role names → abbreviated to first word + `...`
 *   - bare numeric tokens → `N`  (list indices, IDs, counts)
 */
function signature(line: string): string {
  // Normalise element references first so they don't block later substitutions.
  let s = line.trimEnd().replace(/\[ref=[^\]]+\]/g, '[ref=?]');

  // Strip double-quoted accessible names ("Buy now", "Item 42", …).
  s = s.replace(/"[^"]*"/g, '""');

  // Abbreviate single-quoted role names that may contain spaces
  // e.g.  `- 'navigation landmark':` → `- 'navigation...':`
  const m = s.match(/^(\s*- )'(\w+)[^']*'(:.*)?$/);
  if (m) {
    s = `${m[1]}'${m[2]}...'${m[3] ?? ''}`;
  } else {
    // Strip other single-quoted strings (accessible names using single quotes).
    s = s.replace(/'[^']{0,200}'/g, "''");
  }

  // Strip bare numbers (list indices, IDs, pixel values, …).
  s = s.replace(/\b\d+\b/g, 'N');

  // Return only the structural portion, capped to avoid runaway keys.
  return s.trimStart().slice(0, 80);
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

export type CompressResult = {
  /** The (possibly-compressed) ARIA snapshot YAML. */
  output: string;
  /** Number of lines removed. 0 means passthrough. */
  removed: number;
};

/**
 * Compress a Playwright ARIA snapshot YAML string.
 *
 * @param yaml    The raw ariaSnapshot() output.
 * @returns       `{ output, removed }` where `removed === 0` means no-op.
 */
export function compressAriaSnapshot(yaml: string): CompressResult {
  const lines = yaml.split('\n');

  // --- Pre-scan: decide whether to fire at all ---
  const preCounts = new Map<string, number>();
  for (const line of lines) {
    if (!line.trim())
      continue;
    const key = `${indentOf(line)}:${signature(line)}`;
    preCounts.set(key, (preCounts.get(key) ?? 0) + 1);
  }

  let maxCount = 0;
  for (const v of preCounts.values()) {
    if (v > maxCount)
      maxCount = v;
  }

  if (maxCount <= FIRE_THRESHOLD)
    return { output: yaml, removed: 0 };

  // --- Compression pass ---
  const sigCounts = new Map<string, number>();
  const out: string[] = [];
  let totalRemoved = 0;
  let skipBelowIndent: number | undefined;

  for (const line of lines) {
    if (!line.trim()) {
      if (skipBelowIndent === undefined)
        out.push(line);
      else
        totalRemoved++;
      continue;
    }

    const indent = indentOf(line);

    // If we've risen back to or above the collapsed node's indent, stop skipping.
    if (skipBelowIndent !== undefined && indent <= skipBelowIndent)
      skipBelowIndent = undefined;

    // We're inside a collapsed subtree.
    if (skipBelowIndent !== undefined) {
      totalRemoved++;
      continue;
    }

    const important = ALWAYS_KEEP_ROLES.test(line);
    const key = `${indent}:${signature(line)}`;
    sigCounts.set(key, (sigCounts.get(key) ?? 0) + 1);

    if (sigCounts.get(key)! > KEEP_N && !important) {
      // Collapse this node and all its children.
      totalRemoved++;
      skipBelowIndent = indent;
    } else {
      out.push(line);
    }
  }

  if (totalRemoved === 0)
    return { output: yaml, removed: 0 };

  const note = `\n[playwright-compress: ${totalRemoved} repeated ARIA nodes collapsed — use browser_evaluate() to enumerate the full list]`;
  return { output: out.join('\n') + note, removed: totalRemoved };
}
