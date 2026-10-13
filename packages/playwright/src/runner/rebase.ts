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

import fs from 'fs';
import path from 'path';

import colors from 'colors/safe';
import * as diff from 'diff';
import { MultiMap } from '@isomorphic/multimap';

import { config as commonConfig, FullConfigInternal } from '../common';

import type { InternalReporter } from '../reporters/internalReporter';

type Location = {
  file: string;
  line: number;
  column: number;
};

type Replacement = {
  // Points to the call expression.
  location: Location;
  code: string;
};

const suggestedRebaselines = new MultiMap<string, Replacement>();

export function addSuggestedRebaseline(location: Location, suggestedRebaseline: string) {
  suggestedRebaselines.set(location.file, { location, code: suggestedRebaseline });
}

export function clearSuggestedRebaselines() {
  suggestedRebaselines.clear();
}

export async function applySuggestedRebaselines(config: FullConfigInternal, reporter: InternalReporter, filteredProjects: commonConfig.FullProjectInternal[]) {
  if (config.config.updateSnapshots === 'none')
    return;
  if (!suggestedRebaselines.size)
    return;
  const [project] = filteredProjects;
  if (!project)
    return;

  const patches: string[] = [];
  const files: string[] = [];
  const gitCache = new Map<string, string | null>();

  const patchFile = path.join(project.project.outputDir, 'rebaselines.patch');

  for (const fileName of [...suggestedRebaselines.keys()].sort()) {
    const source = await fs.promises.readFile(fileName, 'utf8');
    const lineStarts = [0];
    for (const match of source.matchAll(kLineBreak))
      lineStarts.push(match.index + match[0].length);
    const replacements = suggestedRebaselines.get(fileName);
    const ranges: { start: number, end: number, newText: string }[] = [];

    for (const replacement of replacements) {
      const lineStart = lineStarts[replacement.location.line - 1];
      if (lineStart === undefined)
        continue;
      // Replacements are anchored by the location of the matcher name in the call expression.
      // However, replacement text is meant to only replace the first argument.
      const calleeStart = lineStart + replacement.location.column - 1;
      const argument = firstArgumentRange(source, calleeStart);
      // We can have multiple, hopefully equal, replacements for the same location,
      // for example when a single test runs multiple times because of projects or retries.
      // Do not apply multiple replacements for the same assertion.
      if (!argument || ranges.some(range => range.start === argument.start))
        continue;
      const indent = source.substring(lineStart, calleeStart).match(/^\s*/)![0];
      ranges.push({ ...argument, newText: replacement.code.replace(/\{indent\}/g, indent) });
    }

    ranges.sort((a, b) => b.start - a.start);
    let result = source;
    for (const range of ranges)
      result = result.substring(0, range.start) + range.newText + result.substring(range.end);

    const relativeName = path.relative(process.cwd(), fileName);
    files.push(relativeName);

    if (config.config.updateSourceMethod === 'overwrite') {
      await fs.promises.writeFile(fileName, result);
    } else if (config.config.updateSourceMethod === '3way') {
      await fs.promises.writeFile(fileName, applyPatchWithConflictMarkers(source, result));
    } else {
      const gitFolder = findGitRoot(path.dirname(fileName), gitCache);
      const relativeToGit = path.relative(gitFolder || process.cwd(), fileName);
      patches.push(createPatch(relativeToGit, source, result));
    }
  }

  const fileList = files.map(file => '  ' + colors.dim(file)).join('\n');
  reporter.onStdErr(`\nNew baselines created for:\n\n${fileList}\n`);
  if (config.config.updateSourceMethod === 'patch') {
    await fs.promises.mkdir(path.dirname(patchFile), { recursive: true });
    await fs.promises.writeFile(patchFile, patches.join('\n'));
    reporter.onStdErr(`\n  ` + colors.cyan('git apply ' + path.relative(process.cwd(), patchFile)) + '\n');
  }
}

const kLineBreak = /\r\n|[\n\r\u2028\u2029]/g;
const kName = /[\p{ID_Start}$_][\p{ID_Continue}$]*/uy;
const kSpaceAndComments = /(?:\s+|\/\/.*|\/\*[\s\S]*?\*\/)*/y;
const kQuotedString = /'(?:[^'\\\n\r]|\\[\s\S])*'|"(?:[^"\\\n\r]|\\[\s\S])*"/y;

function matchEnd(regex: RegExp, source: string, index: number): number {
  regex.lastIndex = index;
  return regex.test(source) ? regex.lastIndex : -1;
}

function skipSpaceAndComments(source: string, index: number): number {
  return matchEnd(kSpaceAndComments, source, index);
}

function firstArgumentRange(source: string, calleeStart: number): { start: number, end: number } | undefined {
  const calleeEnd = matchEnd(kName, source, calleeStart);
  if (calleeEnd === -1)
    return;
  const parenthesis = skipSpaceAndComments(source, calleeEnd);
  if (source[parenthesis] !== '(')
    return;
  const start = skipSpaceAndComments(source, parenthesis + 1);
  const end = literalEnd(source, start);
  if (end === -1)
    return;
  const next = source[skipSpaceAndComments(source, end)];
  if (next !== ',' && next !== ')')
    return;
  return { start, end };
}

function literalEnd(source: string, index: number): number {
  if (source[index] === '`')
    return templateEnd(source, index);
  return matchEnd(kQuotedString, source, index);
}

function templateEnd(source: string, index: number): number {
  for (let i = index + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++;
    } else if (source[i] === '`') {
      return i + 1;
    } else if (source[i] === '$' && source[i + 1] === '{') {
      i = substitutionEnd(source, i + 2) - 1;
      if (i < 0)
        return -1;
    }
  }
  return -1;
}

function substitutionEnd(source: string, index: number): number {
  let depth = 0;
  for (let i = index; i < source.length;) {
    const end = Math.max(skipSpaceAndComments(source, i), literalEnd(source, i));
    if (end > i) {
      i = end;
      continue;
    }
    if (source[i] === '{')
      depth++;
    else if (source[i] === '}' && depth-- === 0)
      return i + 1;
    i++;
  }
  return -1;
}

function createPatch(fileName: string, before: string, after: string) {
  const file = fileName.replace(/\\/g, '/');
  const text = diff.createPatch(file, before, after, undefined, undefined, { context: 3 });
  return [
    'diff --git a/' + file + ' b/' + file,
    '--- a/' + file,
    '+++ b/' + file,
    ...text.split('\n').slice(4)
  ].join('\n');
}

function findGitRoot(dir: string, cache: Map<string, string | null>): string | null {
  const result = cache.get(dir);
  if (result !== undefined)
    return result;

  const gitPath = path.join(dir, '.git');
  if (fs.existsSync(gitPath) && fs.lstatSync(gitPath).isDirectory()) {
    cache.set(dir, dir);
    return dir;
  }

  const parentDir = path.dirname(dir);
  if (dir === parentDir) {
    cache.set(dir, null);
    return null;
  }

  const parentResult = findGitRoot(parentDir, cache);
  cache.set(dir, parentResult);
  return parentResult;
}

function applyPatchWithConflictMarkers(oldText: string, newText: string) {
  const diffResult = diff.diffLines(oldText, newText);

  let result = '';
  let conflict = false;

  diffResult.forEach(part => {
    if (part.added) {
      if (conflict) {
        result += part.value;
        result += '>>>>>>> SNAPSHOT\n';
        conflict = false;
      } else {
        result += '<<<<<<< HEAD\n';
        result += part.value;
        result += '=======\n';
        conflict = true;
      }
    } else if (part.removed) {
      result += '<<<<<<< HEAD\n';
      result += part.value;
      result += '=======\n';
      conflict = true;
    } else {
      if (conflict) {
        result += '>>>>>>> SNAPSHOT\n';
        conflict = false;
      }
      result += part.value;
    }
  });

  if (conflict)
    result += '>>>>>>> SNAPSHOT\n';
  return result;
}
