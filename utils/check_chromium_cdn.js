#!/usr/bin/env node
/**
 * Copyright 2017 Google Inc. All rights reserved.
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

const assert = require('assert');
const https = require('https');
const util = require('util');
const URL = require('url');
const SUPPORTER_PLATFORMS = ['linux', 'mac', 'win64'];

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m'
};

class Table {
  /**
     * @param {!Array<number>} columnWidths
     */
  constructor(columnWidths) {
    this.widths = columnWidths;
  }

  /**
     * @param {!Array<string>} values
     */
  drawRow(values) {
    assert(values.length === this.widths.length);
    let row = '';
    for (let i = 0; i < values.length; ++i)
      row += padCenter(values[i], this.widths[i]);
    console.log(row);
  }
}

if (process.argv.length === 2) {
  checkOmahaProxyAvailability();
  return;
}
if (process.argv.length !== 4) {
  console.log(`
  Usage: node check_revisions.js [fromRevision] [toRevision]

This script checks availability of different prebuild chromium revisions.
Running command without arguments will check against omahaproxy revisions.`);
  return;
}

const fromRevision = parseInt(process.argv[2], 10);
const toRevision = parseInt(process.argv[3], 10);
checkRangeAvailability(fromRevision, toRevision, false /* stopWhenAllAvailable */);

async function checkOmahaProxyAvailability() {
  const lastchanged = (await Promise.all([
    fetch('https://storage.googleapis.com/chromium-browser-snapshots/Mac/LAST_CHANGE'),
    fetch('https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/LAST_CHANGE'),
    fetch('https://storage.googleapis.com/chromium-browser-snapshots/Win/LAST_CHANGE'),
    fetch('https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/LAST_CHANGE'),
  ])).map(s => parseInt(s, 10));
  const from = Math.max(...lastchanged);
  checkRangeAvailability(from, 0, true /* stopWhenAllAvailable */);
}

/**
 * @param {number} fromRevision
 * @param {number} toRevision
 * @param {boolean} stopWhenAllAvailable
 */
async function checkRangeAvailability(fromRevision, toRevision, stopWhenAllAvailable) {
  const table = new Table([15, 7, 7, 7]);
  table.drawRow([''].concat(SUPPORTER_PLATFORMS));
  const inc = fromRevision < toRevision ? 1 : -1;
  for (let revision = fromRevision; revision !== toRevision; revision += inc) {
    const allAvailable = await checkAndDrawRevisionAvailability(table, 'chromium', revision);
    if (allAvailable && stopWhenAllAvailable)
      break;
  }
}

async function canDownload(revision, platform) {
  const serverHost = 'https://storage.googleapis.com';
  const urlTemplate = new Map([
    ['linux', '%s/chromium-browser-snapshots/Linux_x64/%d/chrome-linux.zip'],
    ['mac', '%s/chromium-browser-snapshots/Mac/%d/chrome-mac.zip'],
    ['win64', '%s/chromium-browser-snapshots/Win_x64/%d/chrome-win.zip'],
  ]).get(platform);
  assert(urlTemplate, `ERROR: Playwright does not support ${platform}`);
  const url = util.format(urlTemplate, serverHost, revision);
  return await headRequest(url);
}

/**
 * @param {!Table} table
 * @param {string} name
 * @param {number} revision
 * @return {boolean}
 */
async function checkAndDrawRevisionAvailability(table, name, revision) {
  const promises = SUPPORTER_PLATFORMS.map(platform => canDownload(revision, platform));
  const availability = await Promise.all(promises);
  const allAvailable = availability.every(e => !!e);
  const values = [name + ' ' + (allAvailable ? colors.green + revision + colors.reset : revision)];
  for (let i = 0; i < availability.length; ++i) {
    const decoration = availability[i] ? '+' : '-';
    const color = availability[i] ? colors.green : colors.red;
    values.push(color + decoration + colors.reset);
  }
  table.drawRow(values);
  return allAvailable;
}

/**
 * @param {string} url
 * @return {!Promise<?string>}
 */
function fetch(url) {
  let resolve;
  const promise = new Promise(x => resolve = x);
  https.get(url, response => {
    if (response.statusCode !== 200) {
      resolve(null);
      return;
    }
    let body = '';
    response.on('data', function(chunk){
      body += chunk;
    });
    response.on('end', function(){
      resolve(body);
    });
  }).on('error', function(e){
    console.error('Error fetching json: ' + e);
    resolve(null);
  });
  return promise;
}

/**
 * @param {number} size
 * @return {string}
 */
function spaceString(size) {
  return new Array(size).fill(' ').join('');
}

/**
 * @param {string} text
 * @return {string}
 */
function filterOutColors(text) {
  for (const colorName in colors) {
    const color = colors[colorName];
    text = text.replace(color, '');
  }
  return text;
}

/**
 * @param {string} text
 * @param {number} length
 * @return {string}
 */
function padCenter(text, length) {
  const printableCharacters = filterOutColors(text);
  if (printableCharacters.length >= length)
    return text;
  const left = Math.floor((length - printableCharacters.length) / 2);
  const right = Math.ceil((length - printableCharacters.length) / 2);
  return spaceString(left) + text + spaceString(right);
}

async function headRequest(url) {
  return new Promise(resolve => {
    let options = URL.parse(url);
    options.method = 'HEAD';
    const request = https.request(options, res => resolve(res.statusCode === 200));
    request.on('error', error => resolve(false));
    request.end();
  });
}

