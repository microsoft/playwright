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

import * as z from 'zod';

import { defineTabTool } from './tool';

// Number of context lines to show around each match, like `grep -C`.
const contextLines = 3;

const find = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_find',
    title: 'Find in page snapshot',
    description: 'Search the accessibility snapshot of the current page for text or a regular expression. Returns matching snapshot nodes with a few lines of surrounding context (like search snippets), which is cheaper than capturing the whole snapshot when you only need to locate an element and its ref.',
    inputSchema: z.object({
      text: z.string().optional().describe('Plain text to search for in the page snapshot (case-insensitive substring match). Provide either text or regex, not both.'),
      regex: z.string().optional().refine(v => !v || isValidRegex(v), { message: 'Invalid regular expression' }).describe('Regular expression to search for in the page snapshot. Matching is case-sensitive by default; wrap the pattern in slashes to add flags, e.g. "/error/i" for case-insensitive. Provide either text or regex, not both.'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    if (!params.text && !params.regex) {
      response.addError('Provide either "text" or "regex" to search for.');
      return;
    }
    if (params.text && params.regex) {
      response.addError('Provide only one of "text" or "regex", not both.');
      return;
    }

    let query: string;
    let matches: (line: string) => boolean;
    if (params.regex) {
      const re = compileRegex(params.regex);
      query = String(re);
      matches = line => {
        re.lastIndex = 0;
        return re.test(line);
      };
    } else {
      query = `"${params.text}"`;
      const needle = params.text!.toLowerCase();
      matches = line => line.toLowerCase().includes(needle);
    }

    const snapshot = await tab.page.ariaSnapshot({ mode: 'ai' });
    const lines = snapshot.split('\n');
    const matchedLines: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (matches(lines[i]))
        matchedLines.push(i);
    }

    if (!matchedLines.length) {
      response.addTextResult(`No matches found for ${query}.`);
      return;
    }

    // Merge matched lines into windows of context, coalescing overlapping ones.
    const windows: { start: number, end: number }[] = [];
    for (const line of matchedLines) {
      const start = Math.max(0, line - contextLines);
      const end = Math.min(lines.length - 1, line + contextLines);
      const last = windows[windows.length - 1];
      if (last && start <= last.end + 1)
        last.end = Math.max(last.end, end);
      else
        windows.push({ start, end });
    }

    const snippets = windows.map(window => lines.slice(window.start, window.end + 1).join('\n'));
    const matchWord = matchedLines.length === 1 ? 'match' : 'matches';
    response.addTextResult(`Found ${matchedLines.length} ${matchWord} for ${query}:\n\n${snippets.join('\n\n----\n\n')}`);
  },
});

// Accept either a bare pattern or a `/pattern/flags` literal, mirroring the
// test runner's forceRegExp. Matching is line-oriented, so the global flag is
// dropped: it only makes `.test()` stateful without changing which lines match.
function compileRegex(source: string): RegExp {
  const literal = /^\/(.*)\/([a-z]*)$/.exec(source);
  const pattern = literal ? literal[1] : source;
  const flags = literal ? literal[2].replace(/g/g, '') : '';
  return new RegExp(pattern, flags);
}

function isValidRegex(source: string): boolean {
  try {
    compileRegex(source);
    return true;
  } catch {
    return false;
  }
}

export default [
  find,
];
