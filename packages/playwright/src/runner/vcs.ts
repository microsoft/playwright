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

import childProcess from 'child_process';
import { affectedTestFiles } from '../transform/compilationCache';
import path from 'path';

export async function detectChangedTestFiles(baseCommit: string, configDir: string): Promise<Set<string>> {
  function gitFileList(command: string) {
    try {
      return childProcess.execSync(
          `git ${command}`,
          { encoding: 'utf-8', stdio: 'pipe', cwd: configDir }
      ).split('\n').filter(Boolean);
    } catch (_error) {
      const error = _error as childProcess.SpawnSyncReturns<string>;

      const unknownRevision = error.output.some(line => line?.includes('unknown revision'));
      if (unknownRevision) {
        const isShallowClone = childProcess.execSync('git rev-parse --is-shallow-repository', { encoding: 'utf-8',  stdio: 'pipe', cwd: configDir }).trim() === 'true';
        if (isShallowClone) {
          throw new Error([
            `The repository is a shallow clone and does not have '${baseCommit}' available locally.`,
            `Note that GitHub Actions checkout is shallow by default: https://github.com/actions/checkout`
          ].join('\n'));
        }
      }

      throw new Error([
        `Cannot detect changed files for --only-changed mode:`,
        `git ${command}`,
        '',
        ...error.output,
      ].join('\n'));
    }
  }

  const untrackedFiles = gitFileList(`ls-files --others --exclude-standard`).map(file => path.join(configDir, file));

  const [gitRoot] = gitFileList('rev-parse --show-toplevel');
  const trackedFilesWithChanges = gitFileList(`diff ${baseCommit} --name-only`).map(file => path.join(gitRoot, file));

  return new Set(affectedTestFiles([...untrackedFiles, ...trackedFilesWithChanges]));
}