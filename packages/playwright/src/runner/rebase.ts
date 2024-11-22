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

import path from 'path';
import fs from 'fs';
import type { T } from '../transform/babelBundle';
import { types, traverse, babelParse } from '../transform/babelBundle';
import { MultiMap } from 'playwright-core/lib/utils';
import { colors, diff } from 'playwright-core/lib/utilsBundle';
import type { FullConfigInternal } from '../common/config';
import { filterProjects } from './projectUtils';
import type { InternalReporter } from '../reporters/internalReporter';
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

export async function applySuggestedRebaselines(config: FullConfigInternal, reporter: InternalReporter) {
  if (config.config.updateSnapshots !== 'all' && config.config.updateSnapshots !== 'missing')
    return;
  if (!suggestedRebaselines.size)
    return;
  const [project] = filterProjects(config.projects, config.cliProjectFilter);
  if (!project)
    return;

  const patches: string[] = [];
  const files: string[] = [];
  const gitCache = new Map<string, string | null>();

  for (const fileName of [...suggestedRebaselines.keys()].sort()) {
    const source = await fs.promises.readFile(fileName, 'utf8');
    const lines = source.split('\n');
    const replacements = suggestedRebaselines.get(fileName);
    const fileNode = babelParse(source, fileName, true);
    const ranges: { start: number, end: number, oldText: string, newText: string }[] = [];

    traverse(fileNode, {
      CallExpression: path => {
        const node = path.node;
        if (node.arguments.length !== 1)
          return;
        if (!t.isMemberExpression(node.callee))
          return;
        const argument = node.arguments[0];
        if (!t.isStringLiteral(argument) && !t.isTemplateLiteral(argument))
          return;

        const matcher = node.callee.property;
        for (const replacement of replacements) {
          // In Babel, rows are 1-based, columns are 0-based.
          if (matcher.loc!.start.line !== replacement.location.line)
            continue;
          if (matcher.loc!.start.column + 1 !== replacement.location.column)
            continue;
          const indent = lines[matcher.loc!.start.line - 1].match(/^\s*/)![0];
          const newText = replacement.code.replace(/\{indent\}/g, indent);
          ranges.push({ start: matcher.start!, end: node.end!, oldText: source.substring(matcher.start!, node.end!), newText });
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

    const gitFolder = findGitRoot(path.dirname(fileName), gitCache);
    const relativeName = path.relative(gitFolder || process.cwd(), fileName);
    files.push(relativeName);
    patches.push(createPatch(relativeName, source, result));
  }

  const patchFile = path.join(project.project.outputDir, 'rebaselines.patch');
  await fs.promises.mkdir(path.dirname(patchFile), { recursive: true });
  await fs.promises.writeFile(patchFile, patches.join('\n'));

  const fileList = files.map(file => '  ' + colors.dim(file)).join('\n');
  reporter.onStdErr(`\nNew baselines created for:\n\n${fileList}\n\n  ` + colors.cyan('git apply ' + path.relative(process.cwd(), patchFile)) + '\n');
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
