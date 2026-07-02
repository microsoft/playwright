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

import { isRegexString } from '@isomorphic/rtti';

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
      regex: z.string().optional().refine(v => !v || isRegexString(v), { message: 'Invalid regular expression' }).describe('Regular expression to search for in the page snapshot. Provide either text or regex, not both.'),
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

    const query = params.regex ? `/${params.regex}/` : `"${params.text}"`;
    const matches = params.regex ? regexMatcher(params.regex) : textMatcher(params.text!);

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

function textMatcher(text: string): (line: string) => boolean {
  const needle = text.toLowerCase();
  return line => line.toLowerCase().includes(needle);
}

function regexMatcher(source: string): (line: string) => boolean {
  const re = new RegExp(source);
  return line => {
    re.lastIndex = 0;
    return re.test(line);
  };
}

export default [
  find,
];
