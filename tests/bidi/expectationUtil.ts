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
import type { TestInfo } from 'playwright/test';

export type TestExpectation = 'unknown' | 'flaky' | 'pass' | 'fail' | 'timeout';

type ShouldSkipPredicate = (info: TestInfo) => boolean;

export async function createSkipTestPredicate(projectName: string): Promise<ShouldSkipPredicate> {
  if (!process.env.PWTEST_USE_BIDI_EXPECTATIONS)
    return () => false;
  const expectationsMap = await parseBidiExpectations(projectName);
  return (info: TestInfo) => {
    const key = info.titlePath.join(' › ');
    const expectation = expectationsMap.get(key);
    return expectation === 'timeout';
  };
}

export async function parseBidiExpectations(projectName: string): Promise<Map<string, TestExpectation>> {
  const filePath = projectExpectationPath(projectName);
  try {
    await fs.promises.access(filePath);
  } catch (e) {
    return new Map();
  }
  const content = await fs.promises.readFile(filePath);
  const pairs = content.toString().split('\n').map(line => {
    const match = /(?<titlePath>.+) \[(?<expectation>[^\]]+)\]$/.exec(line);
    if (!match) {
      console.error('Bad expectation line: ' + line);
      return undefined;
    }
    return [match.groups!.titlePath, match.groups!.expectation];
  }).filter(Boolean) as [string, TestExpectation][];
  return new Map(pairs);
}

export function projectExpectationPath(project: string): string {
  return path.join(__dirname, 'expectations', project + '.txt');
}
