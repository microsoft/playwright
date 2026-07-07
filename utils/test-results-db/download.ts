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
import { GitHubClient, extractSingle } from './github.ts';

const DB_ARTIFACT_NAME = 'test-results-db';

// Fetch the latest maintained database artifact. If none exists yet (the cron
// hasn't produced one), start from a fresh empty file.
export async function cmdDownload(dbPath: string, token: string): Promise<void> {
  const github = new GitHubClient(token);
  const artifactId = await github.findLatestArtifact(DB_ARTIFACT_NAME);
  if (!artifactId) {
    const db = await TestResultsDb.open(dbPath);
    db.close();
    console.log(`No "${DB_ARTIFACT_NAME}" artifact yet; started a fresh database at ${dbPath}`);
    return;
  }
  console.log(`Downloading "${DB_ARTIFACT_NAME}" artifact #${artifactId} ...`);
  const zip = await github.downloadArtifactZip(artifactId);
  await extractSingle(zip, '.duckdb', dbPath);
  console.log(`Downloaded database to ${dbPath} (${formatBytes(fileSize(dbPath))})`);
}
