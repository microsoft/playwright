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


import { MultiMap } from 'playwright-core/lib/utils';
import { colors } from 'playwright-core/lib/utils';
import { diff } from 'playwright-core/lib/utilsBundle';

import { filterProjects } from './projectUtils';
import { babelParse, traverse, types } from '../transform/babelBundle';

import type { FullConfigInternal } from '../common/config';
import type { InternalReporter } from '../reporters/internalReporter';
import type { T } from '../transform/babelBundle';
const t: typeof T = types;

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

export async function applySuggestedRebaselines(config: FullConfigInternal, reporter: InternalReporter) {
  if (config.config.updateSnapshots === 'none')
    return;
  if (!suggestedRebaselines.size)
    return;
  const [project] = filterProjects(config.projects, config.cliProjectFilter);
  if (!project)
    return;

  const patches: string[] = [];
  const files: string[] = [];
  const gitCache = new Map<string, string | null>();

  const patchFile = path.join(project.project.outputDir, 'rebaselines.patch');

  for (const fileName of [...suggestedRebaselines.keys()].sort()) {
    const source = await fs.promises.readFile(fileName, 'utf8');
    const lines = source.split('\n');
    const replacements = suggestedRebaselines.get(fileName);
    const fileNode = babelParse(source, fileName, true);
    const ranges: { start: number, end: number, oldText: string, newText: string }[] = [];

    traverse(fileNode, {
      CallExpression: path => {
        const node = path.node;
        if (node.arguments.length < 1)
          return;
        if (!t.isMemberExpression(node.callee))
          return;
        const argument = node.arguments[0];
        if (!t.isStringLiteral(argument) && !t.isTemplateLiteral(argument))
          return;
        const prop = node.callee.property;
        if (!prop.loc || !argument.start || !argument.end)
          return;
        // Replacements are anchored by the location of the call expression.
        // However, replacement text is meant to only replace the first argument.
        for (const replacement of replacements) {
          // In Babel, rows are 1-based, columns are 0-based.
          if (prop.loc.start.line !== replacement.location.line)
            continue;
          if (prop.loc.start.column + 1 !== replacement.location.column)
            continue;
          const indent = lines[prop.loc.start.line - 1].match(/^\s*/)![0];
          const newText = replacement.code.replace(/\{indent\}/g, indent);
          ranges.push({ start: argument.start, end: argument.end, oldText: source.substring(argument.start, argument.end), newText });
          // We can have multiple, hopefully equal, replacements for the same location,
          // for example when a single test runs multiple times because of projects or retries.
          // Do not apply multiple replacements for the same assertion.
          break;
        }
      }
    });

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
