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

import { DuckDBInstance } from '@duckdb/node-api';

import type { DuckDBConnection } from '@duckdb/node-api';

const TABLE_NAME = 'test_results';

// The parquet already carries the full per-result schema (see
// tests/config/parquetReporter.ts). We deliberately do not re-declare those
// columns here: the table is created lazily from the first parquet we ingest,
// so it always matches whatever the reporter currently emits, plus these two
// trailing columns we add ourselves:
//   - artifact_id: the GitHub artifact this row came from (our dedupe key)
//   - ingested_at: when we imported it (debug only)
const INGEST_SELECT =
  `SELECT *, $id AS artifact_id, now() AS ingested_at FROM read_parquet($file)`;

// A row lives in the `test_results` table and originates from a GitHub artifact
// identified by an opaque string id.
export class TestResultsDb {
  private _instance: DuckDBInstance;
  private _conn: DuckDBConnection;
  readonly path: string;

  private constructor(instance: DuckDBInstance, conn: DuckDBConnection, path: string) {
    this._instance = instance;
    this._conn = conn;
    this.path = path;
  }

  static async open(path: string): Promise<TestResultsDb> {
    const instance = await DuckDBInstance.create(path);
    const conn = await instance.connect();
    return new TestResultsDb(instance, conn, path);
  }

  private async _tableExists(): Promise<boolean> {
    const reader = await this._conn.runAndReadAll(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $name`,
        { name: TABLE_NAME });
    return reader.getRows().length > 0;
  }

  // The set of artifact ids already imported. Empty on a fresh (table-less) db.
  async ingestedArtifactIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    if (!await this._tableExists())
      return ids;
    const reader = await this._conn.runAndReadAll(
        `SELECT DISTINCT artifact_id FROM ${TABLE_NAME}`);
    for (const row of reader.getRows())
      ids.add(String(row[0]));
    return ids;
  }

  // Ingest one parquet file, tagging every row with `artifactId`. The table is
  // created (schema inferred) on the first ingest; later ingests are matched by
  // column name, so a reordered/extended parquet schema still lands correctly.
  async ingestParquet(parquetFile: string, artifactId: string): Promise<void> {
    const params = { id: artifactId, file: parquetFile };
    if (!await this._tableExists())
      await this._conn.run(`CREATE TABLE ${TABLE_NAME} AS ${INGEST_SELECT} LIMIT 0`, params);
    await this._conn.run(`INSERT INTO ${TABLE_NAME} BY NAME ${INGEST_SELECT}`, params);
  }

  async runCount(): Promise<number> {
    if (!await this._tableExists())
      return 0;
    const reader = await this._conn.runAndReadAll(
        `SELECT count(DISTINCT (run_id, run_attempt)) FROM ${TABLE_NAME}`);
    return Number(reader.getRows()[0][0]);
  }

  async rowCount(): Promise<number> {
    if (!await this._tableExists())
      return 0;
    const reader = await this._conn.runAndReadAll(`SELECT count(*) FROM ${TABLE_NAME}`);
    return Number(reader.getRows()[0][0]);
  }

  // Keep the newest `maxRuns` runs (a run is a (run_id, run_attempt) pair,
  // ordered by run_started_at), delete the rest, then compact to reclaim disk.
  async truncateToRuns(maxRuns: number): Promise<void> {
    if (!await this._tableExists())
      return;
    await this._conn.run(
        `DELETE FROM ${TABLE_NAME}
         WHERE (run_id, run_attempt) NOT IN (
           SELECT run_id, run_attempt FROM ${TABLE_NAME}
           GROUP BY run_id, run_attempt
           ORDER BY max(run_started_at) DESC NULLS LAST
           LIMIT $n)`,
        { n: maxRuns });
    await this._compact();
  }

  // Copy the live rows into a fresh database file and swap it in — DuckDB's
  // DELETE leaves the space allocated, so this is what actually shrinks the file.
  private async _compact(): Promise<void> {
    const tmpPath = `${this.path}.compact.tmp`;
    for (const p of [tmpPath, `${tmpPath}.wal`]) {
      if (fs.existsSync(p))
        fs.rmSync(p);
    }
    await this._conn.run(`ATTACH '${tmpPath.replace(/'/g, `''`)}' AS compacted`);
    await this._conn.run(`CREATE TABLE compacted.${TABLE_NAME} AS SELECT * FROM ${TABLE_NAME}`);
    await this._conn.run(`DETACH compacted`);
    this.close();

    fs.rmSync(this.path);
    if (fs.existsSync(`${this.path}.wal`))
      fs.rmSync(`${this.path}.wal`);
    fs.renameSync(tmpPath, this.path);

    this._instance = await DuckDBInstance.create(this.path);
    this._conn = await this._instance.connect();
  }

  close(): void {
    this._conn.closeSync();
    this._instance.closeSync();
  }
}

export function fileSize(path: string): number {
  try {
    return fs.statSync(path).size;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
