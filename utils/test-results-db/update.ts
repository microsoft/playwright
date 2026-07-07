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
import os from 'os';
import path from 'path';

import { TestResultsDb, fileSize, formatBytes } from './db.ts';
import { GitHubClient, chunk, extractSingle } from './github.ts';

const PARQUET_ARTIFACT_PREFIX = 'parquet-report-';

export type UpdateOptions = {
  lookbackDays: number;
  concurrency: number;
  stopAfterSeen: number;
};

// Ingest the parquet artifacts that aren't in the database yet. Downloads run
// `concurrency`-wide in batches (network-bound, the slow part); each batch is
// then ingested serially on the single connection and its temp files removed,
// so disk usage stays bounded to one batch.
export async function cmdUpdate(dbPath: string, token: string, options: UpdateOptions): Promise<void> {
  const github = new GitHubClient(token);
  const db = await TestResultsDb.open(dbPath);
  try {
    const ingested = await db.ingestedArtifactIds();
    console.log(`Test results database`);
    console.log(`  ${await db.rowCount()} rows from ${ingested.size} artifacts`);

    const todo = await github.listArtifacts(PARQUET_ARTIFACT_PREFIX, {
      ingested,
      lookbackDays: options.lookbackDays,
      stopAfterSeen: options.stopAfterSeen,
    });
    console.log(`\nScanning for new artifacts (last ${options.lookbackDays} days)`);
    console.log(`  ${todo.length} new artifacts to import`);

    let imported = 0;
    for (const batch of chunk(todo, options.concurrency)) {
      const files = await Promise.all(batch.map(async artifact => {
        const zip = await github.downloadArtifactZip(artifact.id);
        const file = path.join(os.tmpdir(), `trdb-${artifact.id}.parquet`);
        await extractSingle(zip, '.parquet', file);
        return { id: artifact.id, file };
      }));
      for (const { id, file } of files) {
        try {
          await db.ingestParquet(file, id);
          imported++;
        } finally {
          fs.rmSync(file, { force: true });
        }
      }
      console.log(`  imported ${imported}/${todo.length}`);
    }

    console.log(`\nSummary`);
    console.log(`  imported ${imported} new artifacts`);
    console.log(`  ${await db.rowCount()} rows from ${await db.runCount()} runs`);
    console.log(`  size ${formatBytes(fileSize(dbPath))}`);

    if (process.env.GITHUB_OUTPUT)
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `imported=${imported}\n`);
  } finally {
    db.close();
  }
}
