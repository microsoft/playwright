#!/usr/bin/env node
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

const fs = require('fs');
const zlib = require('zlib');
const readline = require('readline');

if (process.argv.length < 3) {
  console.log('ERROR: output file path has to be specified!');
  process.exit(1);
}
const OUTPUT_PATH = process.argv[2];

// These env variable values should be removed from logs no matter what.
const BLOCKLIST_ENV_KEYS = new Set([
  'AZ_ACCOUNT_NAME',
  'AZ_ACCOUNT_KEY',
  'TELEGRAM_BOT_KEY',
]);

// These env variable values can stay in logs - they are harmless.
const ALLOWLIST_ENV_KEYS = new Set([
  'SHELL',
  'TERM',
  'USER',
  'PWD',
  'EDITOR',
  'LANG',
  'HOME',
  'LOGNAME',
  'COLORTERM',
  'TMPDIR',
]);

const sanitizeEnv = Object.entries(process.env).filter(([key, value]) => {
  if (BLOCKLIST_ENV_KEYS.has(key))
    return true;
  if (ALLOWLIST_ENV_KEYS.has(key))
    return false;
  // Sanitize all env variables that have `KEY` or `ACCOUNT` as a name.
  if (key.toUpperCase().includes('KEY') || key.toUpperCase().includes('ACCOUNT'))
    return true;
  // We shouldn't try sanitizing env values that are too short.
  if (value.trim().length < 7)
    return false;
  return true;
});

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

const gzip = zlib.createGzip();
gzip.pipe(fs.createWriteStream(OUTPUT_PATH));

rl.on('line', line => {
  for (const [key,  value] of sanitizeEnv)
    line = line.split(value).join(`<${key}>`);
  console.log(line);
  gzip.write(line + '\n');
});

rl.on('close', () => {
  gzip.end();
});

