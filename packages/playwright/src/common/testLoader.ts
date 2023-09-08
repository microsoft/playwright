/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';
import util from 'util';
import type { TestError } from '../../types/testReporter';
import { isWorkerProcess, setCurrentlyLoadingFileSuite } from './globals';
import { Suite } from './test';
import { requireOrImport } from '../transform/transform';
import { filterStackTrace } from '../util';
import { startCollectingFileDeps, stopCollectingFileDeps } from '../transform/compilationCache';
import * as esmLoaderHost from './esmLoaderHost';

export const defaultTimeout = 30000;

// To allow multiple loaders in the same process without clearing require cache,
// we make these maps global.
const cachedFileSuites = new Map<string, Suite>();

export async function loadTestFile(file: string, rootDir: string, testErrors?: TestError[]): Promise<Suite> {
  if (cachedFileSuites.has(file))
    return cachedFileSuites.get(file)!;
  const suite = new Suite(path.relative(rootDir, file) || path.basename(file), 'file');
  suite._requireFile = file;
  suite.location = { file, line: 0, column: 0 };

  setCurrentlyLoadingFileSuite(suite);
  if (!isWorkerProcess()) {
    startCollectingFileDeps();
    await esmLoaderHost.startCollectingFileDeps();
  }
  try {
    await requireOrImport(file);
    cachedFileSuites.set(file, suite);
  } catch (e) {
    if (!testErrors)
      throw e;
    testErrors.push(serializeLoadError(file, e));
  } finally {
    setCurrentlyLoadingFileSuite(undefined);
    if (!isWorkerProcess()) {
      stopCollectingFileDeps(file);
      await esmLoaderHost.stopCollectingFileDeps(file);
    }
  }

  {
    // Test locations that we discover potentially have different file name.
    // This could be due to either
    //   a) use of source maps or due to
    //   b) require of one file from another.
    // Try fixing (a) w/o regressing (b).

    const files = new Set<string>();
    suite.allTests().map(t => files.add(t.location.file));
    if (files.size === 1) {
      // All tests point to one file.
      const mappedFile = files.values().next().value;
      if (suite.location.file !== mappedFile) {
        // The file is different, check for a likely source map case.
        if (path.extname(mappedFile) !== path.extname(suite.location.file))
          suite.location.file = mappedFile;
      }
    }
  }

  return suite;
}

function serializeLoadError(file: string, error: Error | any): TestError {
  if (error instanceof Error) {
    const result: TestError = filterStackTrace(error);
    // Babel parse errors have location.
    const loc = (error as any).loc;
    result.location = loc ? {
      file,
      line: loc.line || 0,
      column: loc.column || 0,
    } : undefined;
    return result;
  }
  return { value: util.inspect(error) };
}
