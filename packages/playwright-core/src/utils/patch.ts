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

import { diffMatchPatch } from '../utilsBundle';

type Hunk = {
  lines: string[];
  startNew: number;
  startOld: number;
  contextBefore: number;
  contextAfter: number;
};

export function generateUnifiedDiff(text1: string, text2: string, relativeName: string = 'file'): string {
  const { diff_match_patch, DIFF_EQUAL, DIFF_DELETE, DIFF_INSERT } = diffMatchPatch;
  const dmp = new diff_match_patch();

  const a = text1.replace(/\r\n/g, '\n');
  const b = text2.replace(/\r\n/g, '\n');

  const { chars1, chars2, lineArray } = dmp.diff_linesToChars_(a, b);
  const diffs = dmp.diff_main(chars1, chars2, false);
  dmp.diff_charsToLines_(diffs, lineArray);

  const contextSize = 3;
  const hunks: Hunk[] = [];
  let lineOld = 1;
  let lineNew = 1;
  let hunk: Hunk | null = null;
  let contextBuffer: string[] = [];

  for (const diff of diffs) {
    const op = diff[0];
    const data = diff[1];
    const lines = data.split('\n');

    // Remove the last empty line if data ends with '\n'
    if (lines[lines.length - 1] === '')
      lines.pop();

    for (const line of lines) {
      if (op === DIFF_EQUAL) {
        if (hunk) {
          hunk.lines.push(' ' + line);
          hunk.contextAfter++;

          if (hunk.contextAfter >= contextSize) {
            // Close the hunk
            hunks.push(hunk);
            hunk = null;
            contextBuffer = [];
          }
        } else {
          contextBuffer.push(' ' + line);
          if (contextBuffer.length > contextSize)
            contextBuffer.shift();
        }
        lineOld++;
        lineNew++;
      } else {
        if (!hunk) {
          // Start a new hunk
          const hunkStartOld = lineOld - contextBuffer.length;
          const hunkStartNew = lineNew - contextBuffer.length;
          hunk = {
            startOld: hunkStartOld,
            startNew: hunkStartNew,
            lines: [...contextBuffer],
            contextBefore: contextBuffer.length,
            contextAfter: 0,
          };
        }
        hunk.contextAfter = 0;

        if (op === DIFF_DELETE) {
          hunk.lines.push('-' + line);
          lineOld++;
        } else if (op === DIFF_INSERT) {
          hunk.lines.push('+' + line);
          lineNew++;
        }
      }
    }
  }

  if (hunk)
    hunks.push(hunk);

  // Build the unified diff text
  let diffText = `--- a/${relativeName}\n+++ b/${relativeName}\n`;
  for (const hunk of hunks) {
    // Calculate hunk ranges
    const oldRangeStart = hunk.startOld;
    const newRangeStart = hunk.startNew;
    let oldRangeLines = 0;
    let newRangeLines = 0;

    for (const line of hunk.lines) {
      if (line.startsWith('-') || line.startsWith(' '))
        oldRangeLines++;
      if (line.startsWith('+') || line.startsWith(' '))
        newRangeLines++;
    }

    // Adjust starting line numbers when range is empty
    const oldStartLine = oldRangeLines === 0 ? oldRangeStart - 1 : oldRangeStart;
    const newStartLine = newRangeLines === 0 ? newRangeStart - 1 : newRangeStart;

    diffText += `@@ -${oldStartLine},${oldRangeLines} +${newStartLine},${newRangeLines} @@\n`;
    diffText += hunk.lines.map(line => line + '\n').join('');
  }

  return diffText;
}
