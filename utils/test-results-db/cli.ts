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

// Parse `--flag value` pairs into a map. Positional args are not expected after
// the command, so anything not starting with `--` is an error.
function parseFlags(args: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--'))
      throw new Error(`Unexpected argument: ${arg}`);
    const value = args[++i];
    if (value === undefined)
      throw new Error(`Missing value for ${arg}`);
    flags.set(arg.slice(2), value);
  }
  return flags;
}

function intFlag(flags: Map<string, string>, name: string, fallback: number): number {
  const raw = flags.get(name);
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
      const flags = parseFlags(rest);
      await cmdUpdate(dbPath, requireToken(), {
        lookbackDays: intFlag(flags, 'lookback-days', 7),
        concurrency: intFlag(flags, 'concurrency', 16),
        stopAfterSeen: intFlag(flags, 'stop-after-seen', 100),
      });
      break;
    }
    case 'truncate': {
      const flags = parseFlags(rest);
      if (!flags.has('max-runs'))
        throw new Error('truncate requires --max-runs <n>');
      await cmdTruncate(dbPath, intFlag(flags, 'max-runs', 0));
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
