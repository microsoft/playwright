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

import { TestResultsDb, fileSize, formatBytes } from './db.ts';

// Keep only the newest `maxRuns` runs (a run is a `(run_id, run_attempt)` pair),
// delete the rest, and compact to reclaim the freed disk space.
export async function cmdTruncate(dbPath: string, maxRuns: number): Promise<void> {
  const db = await TestResultsDb.open(dbPath);
  try {
    const before = await db.runCount();
    await db.truncateToRuns(maxRuns);
    const after = await db.runCount();
    console.log(`Truncated ${before} -> ${after} runs (cap ${maxRuns})`);
    console.log(`  ${await db.rowCount()} rows, size ${formatBytes(fileSize(dbPath))}`);
  } finally {
    db.close();
  }
}
