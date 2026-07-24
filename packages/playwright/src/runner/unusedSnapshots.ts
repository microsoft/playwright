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

import type { UsedSnapshotPayload } from '../common/ipc';
import type { TestRun } from './tasks';

export type UsedSnapshot = UsedSnapshotPayload & { testFile: string };

export async function deleteUnusedSnapshots(testRun: TestRun) {
  // Deleting baselines of tests that did not run would lose data, so only proceed
  // when every test has actually finished successfully.
  if (testRun.result() !== 'passed')
    return;

  // Snapshots of skipped tests are never reported as used. Do not clean up snapshot
  // directories used by files that contain skipped tests.
  const filesWithSkippedTests = new Set<string>();
  for (const test of testRun.rootSuite?.allTests() || []) {
    if (test.outcome() === 'skipped')
      filesWithSkippedTests.add(test.location.file);
  }

  // Only ever delete inside directories that contain at least one used snapshot.
  // Everything outside of them, e.g. snapshots of test files filtered out on the
  // command line, is left untouched.
  const dirs = new Set<string>();
  const skippedDirs = new Set<string>();
  for (const snapshot of testRun.usedSnapshots) {
    const dir = path.dirname(snapshot.path);
    dirs.add(dir);
    // A custom snapshotPathTemplate may map multiple test files to the same
    // directory, so mark the whole directory as excluded rather than skipping
    // this snapshot's entry.
    if (filesWithSkippedTests.has(snapshot.testFile))
      skippedDirs.add(dir);
  }

  // Paths on disk may differ in case from the resolved snapshot paths on
  // case-insensitive file systems.
  const caseInsensitive = process.platform === 'win32' || process.platform === 'darwin';
  const normalize = (p: string) => caseInsensitive ? p.toLowerCase() : p;
  const usedPrefixes = [...new Set(testRun.usedSnapshots.map(snapshot => normalize(snapshot.prefix)))];

  const deleted: string[] = [];
  for (const dir of dirs) {
    if (skippedDirs.has(dir))
      continue;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    // Every used path is covered by its own prefix, so prefixes alone determine
    // which files to keep.
    const dirWithSep = normalize(dir + path.sep);
    const dirPrefixes = usedPrefixes.filter(prefix => prefix.startsWith(dirWithSep) || dirWithSep.startsWith(prefix));
    for (const entry of entries) {
      if (!entry.isFile())
        continue;
      const filePath = path.join(dir, entry.name);
      const normalized = normalize(filePath);
      if (dirPrefixes.some(prefix => normalized.startsWith(prefix)))
        continue;
      try {
        await fs.promises.unlink(filePath);
        deleted.push(filePath);
      } catch {
      }
    }
  }

  if (deleted.length) {
    const fileList = deleted.sort().map(file => '  ' + colors.dim(path.relative(process.cwd(), file))).join('\n');
    testRun.reporter.onStdErr(`\nDeleted unused snapshots:\n\n${fileList}\n`);
  }
}
