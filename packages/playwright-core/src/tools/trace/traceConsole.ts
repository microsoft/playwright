/**
 * Copyright (c) Microsoft Corporation.
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

/* eslint-disable no-console */

import { loadTrace, formatTimestamp } from './traceUtils';

export type TraceConsoleItem = {
  ordinal: number;
  type: 'browser' | 'stdout' | 'stderr';
  level: string;
  text: string;
  location?: string;
  timestamp: number;
};

type RawConsoleItem = Omit<TraceConsoleItem, 'ordinal'>;

export async function traceConsole(options: { grep?: string, errorsOnly?: boolean, warnings?: boolean, browser?: boolean, stdio?: boolean, json?: boolean }) {
  const trace = await loadTrace();
  const model = trace.model;

  const items: RawConsoleItem[] = [];

  for (const event of model.events) {
    if (event.type === 'console') {
      if (options.stdio)
        continue;
      const level = event.messageType;
      if (options.errorsOnly && level !== 'error')
        continue;
      if (options.warnings && level !== 'error' && level !== 'warning')
        continue;
      const url = event.location.url;
      const filename = url ? url.substring(url.lastIndexOf('/') + 1) : '<anonymous>';
      items.push({
        type: 'browser',
        level,
        text: event.text,
        location: `${filename}:${event.location.lineNumber}`,
        timestamp: event.time,
      });
    }
    if (event.type === 'event' && event.method === 'pageError') {
      if (options.stdio)
        continue;
      const error = event.params.error;
      items.push({
        type: 'browser',
        level: 'error',
        text: error?.error?.message || String(error?.value || ''),
        timestamp: event.time,
      });
    }
  }

  for (const event of model.stdio) {
    if (options.browser)
      continue;
    if (options.errorsOnly && event.type !== 'stderr')
      continue;
    if (options.warnings && event.type !== 'stderr')
      continue;
    let text = '';
    if (event.text)
      text = event.text.trim();
    if (event.base64)
      text = Buffer.from(event.base64, 'base64').toString('utf-8').trim();
    if (!text)
      continue;
    items.push({
      type: event.type as 'stdout' | 'stderr',
      level: event.type === 'stderr' ? 'error' : 'info',
      text,
      timestamp: event.timestamp,
    });
  }

  items.sort((a, b) => a.timestamp - b.timestamp);

  let filtered = items;
  if (options.grep) {
    const pattern = new RegExp(options.grep, 'i');
    filtered = filtered.filter(item => pattern.test(item.text));
  }

  if (options.json) {
    const list: TraceConsoleItem[] = filtered.map((item, index) => ({
      ordinal: index + 1,
      type: item.type,
      level: item.level,
      text: item.text,
      location: item.location,
      timestamp: item.timestamp,
    }));
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (!filtered.length) {
    console.log('  No console entries');
    return;
  }

  for (const item of filtered) {
    const ts = formatTimestamp(item.timestamp, model.startTime);
    const source = item.type === 'browser' ? '[browser]' : `[${item.type}]`;
    const level = item.level.padEnd(8);
    const location = item.location ? `  ${item.location}` : '';
    console.log(`  ${ts}  ${source.padEnd(10)} ${level} ${item.text}${location}`);
  }
}
