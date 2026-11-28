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

import { loadTrace, actionFullTitle } from './traceUtils';

import type { LoadedTrace } from './traceUtils';

export type TraceErrorItem = {
  type: 'assertion' | 'stderr' | 'console' | 'pageError';
  message: string;
  location: string | null;
};

type ErrorFormatMeta = {
  actionTitle?: string;
};

const errorFormatMeta = new WeakMap<TraceErrorItem, ErrorFormatMeta>();

export function collectTraceErrors(trace: LoadedTrace): TraceErrorItem[] {
  const model = trace.model;
  const items: TraceErrorItem[] = [];

  for (const error of model.errorDescriptors) {
    let location: string | null = null;
    if (error.stack?.length) {
      const frame = error.stack[0];
      const file = frame.file.replace(/.*[/\\](.*)/, '$1');
      location = `${file}:${frame.line}:${frame.column}`;
    }
    const item: TraceErrorItem = {
      type: 'assertion',
      message: error.message,
      location,
    };
    errorFormatMeta.set(item, {
      actionTitle: error.action ? actionFullTitle(error.action) : undefined,
    });
    items.push(item);
  }

  for (const event of model.events) {
    if (event.type === 'event' && event.method === 'pageError') {
      const serialized = event.params.error;
      const message = serialized?.error?.message || String(serialized?.value || '');
      if (!message)
        continue;
      const location = extractStackLocation(serialized?.error?.stack) ?? null;
      items.push({
        type: 'pageError',
        message,
        location,
      });
    } else if (event.type === 'console' && event.messageType === 'error') {
      const url = event.location.url;
      const filename = url ? url.substring(url.lastIndexOf('/') + 1) : '<anonymous>';
      items.push({
        type: 'console',
        message: event.text,
        location: `${filename}:${event.location.lineNumber}`,
      });
    }
  }

  for (const event of model.stdio) {
    if (event.type !== 'stderr')
      continue;
    let text = '';
    if (event.text)
      text = event.text.trim();
    if (event.base64)
      text = Buffer.from(event.base64, 'base64').toString('utf-8').trim();
    if (!text)
      continue;
    items.push({
      type: 'stderr',
      message: text,
      location: null,
    });
  }

  return items;
}

function extractStackLocation(stack: string | undefined): string | undefined {
  if (!stack)
    return undefined;
  for (const line of stack.split('\n')) {
    const match = line.match(/(?:at\s+(?:.*?\()?|\b)([^()\s]+):(\d+):(\d+)\)?$/);
    if (match) {
      const rawFile = match[1];
      let file = rawFile;
      try {
        const parsed = new URL(rawFile);
        file = parsed.pathname.substring(parsed.pathname.lastIndexOf('/') + 1) || parsed.host;
      } catch {
        file = rawFile.replace(/.*[/\\](.*)/, '$1');
      }
      return `${file}:${match[2]}:${match[3]}`;
    }
  }
  return undefined;
}

function formatTraceErrors(items: TraceErrorItem[]) {
  if (!items.length) {
    console.log('  No errors');
    return;
  }

  for (const error of items) {
    const meta = errorFormatMeta.get(error);
    if (error.type === 'assertion') {
      if (meta?.actionTitle)
        console.log(`\n  ✗ ${meta.actionTitle}`);
      else
        console.log(`\n  ✗ Error`);
    } else if (error.type === 'pageError') {
      console.log(`\n  ✗ Page error`);
    } else if (error.type === 'console') {
      console.log(`\n  ✗ Console error`);
    } else {
      console.log(`\n  ✗ Stderr`);
    }

    if (error.location)
      console.log(`    at ${error.location}`);
    console.log('');
    const indented = error.message.split('\n').map(l => `    ${l}`).join('\n');
    console.log(indented);
  }
  console.log('');
}

export async function traceErrors(options: { json?: boolean } = {}, traceFile?: string) {
  const trace = await loadTrace(traceFile);
  const items = collectTraceErrors(trace);
  if (options.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  formatTraceErrors(items);
}
