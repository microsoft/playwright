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
import { types, traverse, parse } from '../transform/babelBundle';
import { MultiMap } from 'playwright-core/lib/utils';
import { generateUnifiedDiff } from 'playwright-core/lib/utils';
import type { FullConfigInternal } from '../common/config';
import { filterProjects } from './projectUtils';
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

export async function applySuggestedRebaselines(config: FullConfigInternal) {
  if (config.config.updateSnapshots !== 'all' && config.config.updateSnapshots !== 'missing')
    return;
  const [project] = filterProjects(config.projects, config.cliProjectFilter);
  if (!project)
    return;

  for (const fileName of suggestedRebaselines.keys()) {
    const source = await fs.promises.readFile(fileName, 'utf8');
    const lines = source.split('\n');
    const replacements = suggestedRebaselines.get(fileName);
    const fileNode = parse(source, { sourceType: 'module' });
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
          const newText = replacement.code.replace(/\$\{indent\}/g, indent);
          ranges.push({ start: matcher.start!, end: node.end!, oldText: source.substring(matcher.start!, node.end!), newText });
        }
      }
    });

    ranges.sort((a, b) => b.start - a.start);
    let result = source;
    for (const range of ranges)
      result = result.substring(0, range.start) + range.newText + result.substring(range.end);

    const relativeName = path.relative(process.cwd(), fileName);

    const patchFile = path.join(project.project.outputDir, 'rebaselines.patch');
    await fs.promises.mkdir(path.dirname(patchFile), { recursive: true });
    await fs.promises.writeFile(patchFile, generateUnifiedDiff(source, result, relativeName));
  }
}
