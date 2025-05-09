/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import * as fs from 'fs/promises';
import * as path from 'path';

import { monotonicTime, parseErrorStack, raceAgainstDeadline } from 'playwright-core/lib/utils';
import { yaml } from 'playwright-core/lib/utilsBundle';

import { stripAnsiEscapes } from './util';
import { codeFrameColumns } from './transform/babelBundle';

import type { MetadataWithCommitInfo } from './isomorphic/types';
import type { TestInfoImpl } from './worker/testInfo';
import type { Location } from '../types/test';
import type { Frame, FrameLocator } from 'playwright-core';

export async function attachErrorContext(testInfo: TestInfoImpl, format: 'markdown' | 'json', sourceCache: Map<string, string>, ariaSnapshot: string | undefined) {
  if (format === 'json') {
    if (!ariaSnapshot)
      return;

    testInfo._attach({
      name: `_error-context`,
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({
        pageSnapshot: ariaSnapshot,
      })),
    }, undefined);

    return;
  }

  const meaningfulSingleLineErrors = new Set(testInfo.errors.filter(e => e.message && !e.message.includes('\n')).map(e => e.message!));
  for (const error of testInfo.errors) {
    for (const singleLineError of meaningfulSingleLineErrors.keys()) {
      if (error.message?.includes(singleLineError))
        meaningfulSingleLineErrors.delete(singleLineError);
    }
  }

  const errors = [...testInfo.errors.entries()].filter(([, error]) => {
    if (!error.message)
      return false;

    // Skip errors that are just a single line - they are likely to already be the error message.
    if (!error.message.includes('\n') && !meaningfulSingleLineErrors.has(error.message))
      return false;

    return true;
  });

  for (const [index, error] of errors) {
    const metadata = testInfo.config.metadata as MetadataWithCommitInfo;
    if (testInfo.attachments.find(a => a.name === `_error-context-${index}`))
      continue;

    const lines = [
      `# Test info`,
      '',
      `- Name: ${testInfo.titlePath.slice(1).join(' >> ')}`,
      `- Location: ${testInfo.file}:${testInfo.line}:${testInfo.column}`,
      '',
      '# Error details',
      '',
      '```',
      stripAnsiEscapes(error.stack || error.message || ''),
      '```',
    ];

    if (ariaSnapshot) {
      lines.push(
          '',
          '# Page snapshot',
          '',
          '```yaml',
          ariaSnapshot,
          '```',
      );
    }

    const parsedError = error.stack ? parseErrorStack(error.stack, path.sep) : undefined;
    const inlineMessage = stripAnsiEscapes(parsedError?.message || error.message || '').split('\n')[0];
    const loadedSource = await loadSource(parsedError?.location, testInfo, sourceCache);
    if (loadedSource) {
      const codeFrame = codeFrameColumns(
          loadedSource.source,
          {
            start: {
              line: loadedSource.location.line,
              column: loadedSource.location.column
            },
          },
          {
            highlightCode: false,
            linesAbove: 100,
            linesBelow: 100,
            message: inlineMessage || undefined,
          }
      );
      lines.push(
          '',
          '# Test source',
          '',
          '```ts',
          codeFrame,
          '```',
      );
    }

    if (metadata.gitDiff) {
      lines.push(
          '',
          '# Local changes',
          '',
          '```diff',
          metadata.gitDiff,
          '```',
      );
    }

    const filePath = testInfo.outputPath(errors.length === 1 ? `error-context.md` : `error-context-${index}.md`);
    await fs.writeFile(filePath, lines.join('\n'), 'utf8');

    (testInfo as TestInfoImpl)._attach({
      name: `_error-context-${index}`,
      contentType: 'text/markdown',
      path: filePath,
    }, undefined);
  }
}

async function loadSource(
  errorLocation: Location | undefined,
  testLocation: Location,
  sourceCache: Map<string, string>
): Promise<{ location: Location, source: string } | undefined> {
  if (errorLocation) {
    const source = await loadSourceCached(errorLocation.file, sourceCache);
    if (source)
      return { location: errorLocation, source };
  }
  // If the error location is not available on the disk (e.g. fake page.evaluate in-browser error), then fallback to the test file.
  const source = await loadSourceCached(testLocation.file, sourceCache);
  if (source)
    return { location: testLocation, source };
  return undefined;
}

async function loadSourceCached(file: string, sourceCache: Map<string, string>): Promise<string | undefined> {
  let source = sourceCache.get(file);
  if (!source) {
    try {
      // A mild race is Ok here.
      source = await fs.readFile(file, 'utf8');
      sourceCache.set(file, source);
    } catch (e) {
      // Ignore errors.
    }
  }
  return source;
}

export async function takeAriaSnapshot(frame: Frame | FrameLocator, { timeout }: { timeout: number }) {
  const result = await _takeAriaSnapshot(frame, monotonicTime() + timeout);
  return result?.toString({ indentSeq: false });
}

async function _takeAriaSnapshot(frame: Frame | FrameLocator, deadline: number) {
  if (monotonicTime() > deadline)
    return;

  const snapshotString = await raceAgainstDeadline(() => frame.locator('body').ariaSnapshot({ ref: true, timeout: 5000 }), deadline);
  if (snapshotString.timedOut)
    return;

  const snapshot = yaml.parseDocument(snapshotString.result);

  const visit = async (node: any): Promise<unknown> => {
    if (yaml.isPair(node)) {
      await Promise.all([
        visit(node.key).then(k => node.key = k),
        visit(node.value).then(v => node.value = v)
      ]);
    } else if (yaml.isSeq(node) || yaml.isMap(node)) {
      node.items = await Promise.all(node.items.map(visit));
    } else if (yaml.isScalar(node)) {
      if (typeof node.value === 'string') {
        const value = node.value;
        node.value = node.value.replace(/ \[ref=(.*)\]/, '');
        if (value.startsWith('iframe ')) {
          const ref = value.match(/\[ref=(.*)\]/)?.[1];
          if (ref) {
            try {
              const childSnapshot = await _takeAriaSnapshot(frame.frameLocator(`aria-ref=${ref}`), deadline);
              if (!childSnapshot)
                return snapshot.createPair(node.value, '<snapshot timed out>');
              return snapshot.createPair(node.value, childSnapshot);
            } catch (error) {
              return snapshot.createPair(node.value, '<could not take iframe snapshot>');
            }
          }
        }
      }
    }

    return node;
  };
  await visit(snapshot.contents);
  return snapshot;
}
