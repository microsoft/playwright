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

import type { LoadedTrace } from './traceUtils';

export type TraceConsoleOptions = {
  grep?: string;
  errorsOnly?: boolean;
  warnings?: boolean;
  browser?: boolean;
  stdio?: boolean;
  json?: boolean;
};

export type TraceConsoleItem = {
  ordinal: number;
  type: string;
  text: string;
  location: string | null;
};

type ConsoleFormatMeta = {
  source: 'browser' | 'stdout' | 'stderr';
  level: string;
  timestamp: number;
  modelStartTime: number;
};

const consoleFormatMeta = new WeakMap<TraceConsoleItem, ConsoleFormatMeta>();

export function collectTraceConsole(trace: LoadedTrace, options: { grep?: string, errorsOnly?: boolean, warnings?: boolean, browser?: boolean, stdio?: boolean } = {}): TraceConsoleItem[] {
  const model = trace.model;

  type RawConsoleItem = {
    source: 'browser' | 'stdout' | 'stderr';
    itemType: string;
    level: string;
    text: string;
    location?: string;
    timestamp: number;
  };

  const rawItems: RawConsoleItem[] = [];

  for (const event of model.events) {
    if (event.type === 'console') {
      const level = event.messageType;
      const url = event.location.url;
      const filename = url ? url.substring(url.lastIndexOf('/') + 1) : '<anonymous>';
      rawItems.push({
        source: 'browser',
        itemType: level,
        level,
        text: event.text,
        location: `${filename}:${event.location.lineNumber}`,
        timestamp: event.time,
      });
    }
    if (event.type === 'event' && event.method === 'pageError') {
      const error = event.params.error;
      rawItems.push({
        source: 'browser',
        itemType: 'error',
        level: 'error',
        text: error?.error?.message || String(error?.value || ''),
        timestamp: event.time,
      });
    }
  }

  for (const event of model.stdio) {
    let text = '';
    if (event.text)
      text = event.text.trim();
    if (event.base64)
      text = Buffer.from(event.base64, 'base64').toString('utf-8').trim();
    if (!text)
      continue;
    rawItems.push({
      source: event.type,
      itemType: event.type,
      level: event.type === 'stderr' ? 'error' : 'info',
      text,
      timestamp: event.timestamp,
    });
  }

  rawItems.sort((a, b) => a.timestamp - b.timestamp);

  let indexed = rawItems.map((raw, index) => ({ raw, ordinal: index + 1 }));
  if (options.stdio)
    indexed = indexed.filter(({ raw }) => raw.source !== 'browser');
  if (options.browser)
    indexed = indexed.filter(({ raw }) => raw.source === 'browser');
  if (options.errorsOnly)
    indexed = indexed.filter(({ raw }) => raw.level === 'error');
  if (options.warnings)
    indexed = indexed.filter(({ raw }) => raw.level === 'error' || raw.level === 'warning');
  if (options.grep) {
    const pattern = new RegExp(options.grep, 'i');
    indexed = indexed.filter(({ raw }) => pattern.test(raw.text));
  }

  return indexed.map(({ raw, ordinal }) => {
    const item: TraceConsoleItem = {
      ordinal,
      type: raw.itemType,
      text: raw.text,
      location: raw.location ?? null,
    };
    consoleFormatMeta.set(item, {
      source: raw.source,
      level: raw.level,
      timestamp: raw.timestamp,
      modelStartTime: model.startTime,
    });
    return item;
  });
}

function formatTraceConsole(items: TraceConsoleItem[]) {
  if (!items.length) {
    console.log('  No console entries');
    return;
  }

  for (const item of items) {
    const meta = consoleFormatMeta.get(item);
    const ts = meta ? formatTimestamp(meta.timestamp, meta.modelStartTime) : '0:00.000';
    const source = meta ? (meta.source === 'browser' ? '[browser]' : `[${meta.source}]`) : '[browser]';
    const level = (meta ? meta.level : item.type).padEnd(8);
    const location = item.location ? `  ${item.location}` : '';
    console.log(`  ${ts}  ${source.padEnd(10)} ${level} ${item.text}${location}`);
  }
}

export async function traceConsole(options: TraceConsoleOptions = {}, traceFile?: string) {
  const trace = await loadTrace(traceFile);
  const items = collectTraceConsole(trace, options);
  if (options.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  formatTraceConsole(items);
}
