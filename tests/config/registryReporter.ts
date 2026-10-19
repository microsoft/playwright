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

import type { FullResult, Reporter, Suite, TestError } from '@playwright/test/reporter';

const testsDir = path.join(__dirname, '..');
const registryFile = path.join(testsDir, 'registry.md');
const idPattern = /^(?<code>[A-Z]{2})-(?:[A-Z]{2,3}-)?\d{3} /;
const updateCommand = 'PWTEST_UPDATE_REGISTRY=1 npm run test -- --list --reporter=./tests/config/registryReporter.ts';

type Entry = {
  id: string;
  code: string;
  file: string;
  location: string;
  titlePaths: Map<string, string[]>;
};

// Checks tests/registry.md against the test titles. Use with --list.
class RegistryReporter implements Reporter {
  private _errors = new Set<string>();

  printsToStdio() {
    return true;
  }

  onBegin(_: unknown, suite: Suite) {
    const entries = this._collectEntries(suite);
    const text = fs.readFileSync(registryFile, 'utf8');
    const subsystemsIndex = text.indexOf('\n## Subsystems\n');
    if (subsystemsIndex === -1) {
      this._errors.add('tests/registry.md: the "## Subsystems" section is missing');
      return;
    }
    const names = new Map<string, string>();
    for (const match of text.matchAll(/^\| `([A-Z]{2})` \| ([^|]+?) \|/gm))
      names.set(match[1], match[2]);
    for (const entry of entries.values()) {
      if (!names.has(entry.code))
        this._errors.add(`${entry.location}: code ${entry.code} is not in the Subsystems table of tests/registry.md`);
    }

    const expected = renderRegistry(text.substring(0, subsystemsIndex + 1), names, entries);
    if (expected === text)
      return;
    if (process.env.PWTEST_UPDATE_REGISTRY) {
      fs.writeFileSync(registryFile, expected);
      console.log(`Updated ${path.relative(process.cwd(), registryFile)}`);
      return;
    }
    const actualLines = new Set(text.split('\n'));
    const expectedLines = new Set(expected.split('\n'));
    const missing = [...expectedLines].filter(line => !actualLines.has(line));
    const extra = [...actualLines].filter(line => !expectedLines.has(line));
    this._errors.add([
      `tests/registry.md does not match the test titles. To update it, run:`,
      `  ${updateCommand}`,
      ...missing.slice(0, 10).map(line => `  + ${line}`),
      ...extra.slice(0, 10).map(line => `  - ${line}`),
    ].join('\n'));
  }

  onError(error: TestError) {
    this._errors.add(error.stack ?? error.message ?? String(error.value));
  }

  async onEnd(): Promise<{ status?: FullResult['status'] } | undefined> {
    for (const error of this._errors)
      console.error(error);
    if (this._errors.size)
      return { status: 'failed' };
  }

  private _collectEntries(suite: Suite) {
    const entries = new Map<string, Entry>();
    for (const test of suite.allTests()) {
      const file = path.relative(testsDir, test.location.file).split(path.sep).join('/');
      const location = `${file}:${test.location.line}:${test.location.column}`;
      const match = idPattern.exec(test.title);
      if (!match) {
        this._errors.add(`${location}: the title must start with an identifier, for example "CL-001 ": ${test.title}`);
        continue;
      }
      const id = match[0].trim();
      let entry = entries.get(id);
      if (!entry) {
        entry = { id, code: match.groups!.code, file, location, titlePaths: new Map() };
        entries.set(id, entry);
      } else if (entry.location !== location) {
        this._errors.add(`${location}: identifier ${id} is already used by the test at ${entry.location}`);
        continue;
      }
      const titlePath = [...test.titlePath().slice(3, -1), test.title.substring(match[0].length)];
      entry.titlePaths.set(titlePath.join('\0'), titlePath);
    }
    return entries;
  }
}

function renderRegistry(header: string, names: Map<string, string>, entries: Map<string, Entry>): string {
  const byCode = new Map<string, Entry[]>([...names.keys()].map(code => [code, []]));
  for (const entry of [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)))
    byCode.get(entry.code)?.push(entry);
  const lines = [
    header.trimEnd(),
    '',
    '## Subsystems',
    '',
    '| Code | Subsystem | Files | Tests |',
    '|---|---|---|---|',
  ];
  for (const [code, name] of names)
    lines.push(`| \`${code}\` | ${name} | ${renderFiles(byCode.get(code)!)} | ${byCode.get(code)!.length} |`);
  lines.push('', '## Tests');
  for (const [code, name] of names) {
    const list = byCode.get(code)!;
    if (!list.length)
      continue;
    lines.push('', `### ${code} — ${name}`, '', '| ID | File | Title |', '|---|---|---|');
    for (const entry of list) {
      const count = entry.titlePaths.size;
      lines.push(`| \`${entry.id}\` | \`${entry.file}\` | ${escapeMarkdown(renderTitle([...entry.titlePaths.values()]))}${count > 1 ? ` *(${count} copies)*` : ''} |`);
    }
  }
  return lines.join('\n') + '\n';
}

function renderFiles(list: Entry[]): string {
  const byDir = new Map<string, Set<string>>();
  for (const entry of list) {
    const dir = path.posix.dirname(entry.file);
    if (!byDir.has(dir))
      byDir.set(dir, new Set());
    byDir.get(dir)!.add(path.posix.basename(entry.file, '.spec.ts'));
  }
  return [...byDir].map(([dir, names]) => names.size > 1 ? `\`${dir}/{${[...names].join(', ')}}\`` : `\`${dir}/${[...names][0]}\``).join('<br>');
}

function renderTitle(titlePaths: string[][]): string {
  if (titlePaths.length === 1)
    return titlePaths[0].join(' › ');
  const describes = titlePaths.map(titlePath => titlePath.slice(0, -1));
  const depth = Math.max(...describes.map(describe => describe.length));
  const parts: string[] = [];
  for (let i = 0; i < depth; i++)
    parts.push(mergeVariants(describes.map(describe => describe[i]).filter(title => title !== undefined)));
  parts.push(mergeVariants(titlePaths.map(titlePath => titlePath[titlePath.length - 1])));
  return parts.join(' › ');
}

function mergeVariants(values: string[]): string {
  const unique = [...new Set(values)];
  if (unique.length === 1)
    return unique[0];
  let prefix = unique.reduce((common, value) => common.substring(0, commonLength(common, value)));
  prefix = prefix.substring(0, prefix.lastIndexOf(' ') + 1);
  const rests = unique.map(value => value.substring(prefix.length));
  const reversed = (text: string) => [...text].reverse().join('');
  let suffix = reversed(rests.map(reversed).reduce((common, value) => common.substring(0, commonLength(common, value))));
  const space = suffix.indexOf(' ');
  suffix = space === -1 ? '' : suffix.substring(space);
  return `${prefix}{${rests.map(rest => rest.substring(0, rest.length - suffix.length)).join(', ')}}${suffix}`;
}

function commonLength(a: string, b: string): number {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length])
    length++;
  return length;
}

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]<>|]/g, char => '\\' + char);
}

export default RegistryReporter;
