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

import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'util';

import { cmdDownload } from './download.ts';
import { cmdTruncate } from './truncate.ts';
import { cmdUpdate } from './update.ts';

const USAGE = `Usage: node utils/test-results-db/cli.ts <command> [options]

Compacts the per-run parquet CI artifacts into a single queryable DuckDB file.

Commands:
  download                 Fetch the latest maintained database artifact.
                           Starts a fresh database if none exists yet.
  update [options]         Ingest parquet artifacts that aren't in the database yet.
    --lookback-days <n>    How many days back to scan (default 7).
    --concurrency <n>      Parallel downloads per batch (default 16).
    --stop-after-seen <n>  Stop after this many consecutive already-ingested
                           artifacts (default 100). The list is newest-first, so
                           this short-circuits the scan once caught up.
  truncate --max-runs <n>  Keep only the newest <n> runs, delete the rest, compact.

Environment:
  GITHUB_TOKEN             Required for 'download' and 'update'.
  TRDB_DB_PATH             Database file path (default utils/test-results-db/test-results.duckdb).
`;

function defaultDbPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, 'test-results.duckdb');
}

const UPDATE_OPTIONS = {
  'lookback-days': { type: 'string' },
  'concurrency': { type: 'string' },
  'stop-after-seen': { type: 'string' },
} as const;

const TRUNCATE_OPTIONS = {
  'max-runs': { type: 'string' },
} as const;

type Flags = Record<string, string | boolean | undefined>;

function intFlag(flags: Flags, name: string, fallback: number): number {
  const raw = flags[name];
  if (raw === undefined)
    return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`--${name} must be a positive integer, got "${raw}"`);
  return value;
}

function requireToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token)
    throw new Error('GITHUB_TOKEN is required for this command.');
  return token;
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const dbPath = process.env.TRDB_DB_PATH || defaultDbPath();

  switch (command) {
    case 'download': {
      await cmdDownload(dbPath, requireToken());
      break;
    }
    case 'update': {
      const { values } = parseArgs({ args: rest, options: UPDATE_OPTIONS, allowPositionals: false });
      await cmdUpdate(dbPath, requireToken(), {
        lookbackDays: intFlag(values, 'lookback-days', 7),
        concurrency: intFlag(values, 'concurrency', 16),
        stopAfterSeen: intFlag(values, 'stop-after-seen', 100),
      });
      break;
    }
    case 'truncate': {
      const { values } = parseArgs({ args: rest, options: TRUNCATE_OPTIONS, allowPositionals: false });
      if (values['max-runs'] === undefined)
        throw new Error('truncate requires --max-runs <n>');
      await cmdTruncate(dbPath, intFlag(values, 'max-runs', 0));
      break;
    }
    case undefined:
    case 'help':
    case '--help':
    case '-h': {
      process.stdout.write(USAGE);
      break;
    }
    default: {
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
      process.exitCode = 1;
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
