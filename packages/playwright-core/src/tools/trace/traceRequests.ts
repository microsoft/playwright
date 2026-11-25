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

import path from 'path';
import { msToString } from '@isomorphic/formatUtils';
import { loadTrace, formatTimestamp } from './traceUtils';

export function isFailedRequest(r: { response: { status: number; _failureText?: string } }): boolean {
  return r.response.status >= 400 || r.response.status <= 0 || !!r.response._failureText;
}

export type TraceRequestSummary = {
  ordinal: number;
  method: string;
  url: string;
  status: number;
  statusText: string;
  startTime: number | null;
  duration: number;
  durationFormatted: string;
  bodySize: number;
  contentType?: string;
  route?: string;
  failure?: string;
};

export type TraceRequestDetails = {
  ordinal: number;
  method: string;
  url: string;
  status: number;
  statusText: string;
  startTime: number | null;
  duration: number;
  durationFormatted: string;
  size: number;
  contentType?: string;
  route?: string;
  server?: string;
  failure?: string;
  requestHeaders: Array<{ name: string; value: string }>;
  requestBody?: string;
  requestBodyFile?: string;
  responseHeaders: Array<{ name: string; value: string }>;
  responseBody?: string;
  responseBodyFile?: string;
  security?: {
    protocol?: string;
    subjectName?: string;
  };
};

export async function traceRequests(options: { grep?: string, method?: string, status?: string, failed?: boolean, json?: boolean }) {
  const trace = await loadTrace();
  const model = trace.model;

  // Build indexed list with stable ordinals before filtering.
  let indexed = model.resources.map((r, i) => ({ resource: r, ordinal: i + 1 }));

  if (options.grep) {
    const pattern = new RegExp(options.grep, 'i');
    indexed = indexed.filter(({ resource: r }) => pattern.test(r.request.url));
  }
  if (options.method)
    indexed = indexed.filter(({ resource: r }) => r.request.method.toLowerCase() === options.method!.toLowerCase());
  if (options.status) {
    const code = parseInt(options.status, 10);
    indexed = indexed.filter(({ resource: r }) => r.response.status === code);
  }
  if (options.failed)
    indexed = indexed.filter(({ resource: r }) => isFailedRequest(r));

  if (options.json) {
    const list = indexed.map(({ resource: r, ordinal }) => {
      const size = r.response._transferSize! > 0 ? r.response._transferSize! : r.response.bodySize;
      return {
        ordinal,
        method: r.request.method,
        url: r.request.url,
        status: r.response.status,
        statusText: r.response.statusText,
        startTime: r._monotonicTime ?? null,
        duration: r.time,
        durationFormatted: msToString(r.time),
        bodySize: size,
        contentType: r.response.content.mimeType || undefined,
        route: formatRouteStatus(r) || undefined,
        failure: r.response._failureText || undefined,
      };
    });
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (!indexed.length) {
    console.log('  No network requests');
    return;
  }
  console.log(`  ${'#'.padStart(4)} ${'Start'.padEnd(9)} ${'Method'.padEnd(8)} ${'Status'.padEnd(8)} ${'Name'.padEnd(45)} ${'Duration'.padStart(10)} ${'Size'.padStart(8)} ${'Route'.padEnd(10)}`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(9)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(45)} ${'─'.repeat(10)} ${'─'.repeat(8)} ${'─'.repeat(10)}`);

  for (const { resource: r, ordinal } of indexed) {
    let name: string;
    try {
      const url = new URL(r.request.url);
      name = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
      if (!name)
        name = url.host;
      if (url.search)
        name += url.search;
    } catch {
      name = r.request.url;
    }
    if (name.length > 45)
      name = name.substring(0, 42) + '...';

    const status = r.response.status > 0 ? String(r.response.status) : 'ERR';
    const size = r.response._transferSize! > 0 ? r.response._transferSize! : r.response.bodySize;
    const route = formatRouteStatus(r);
    const start = r._monotonicTime ? formatTimestamp(r._monotonicTime, model.startTime) : '-';
    console.log(`  ${(ordinal + '.').padStart(4)} ${start.padEnd(9)} ${r.request.method.padEnd(8)} ${status.padEnd(8)} ${name.padEnd(45)} ${msToString(r.time).padStart(10)} ${bytesToString(size).padStart(8)} ${route.padEnd(10)}`);
  }
}

// ---- trace request ----

export async function traceRequest(requestId: string, options: { json?: boolean } = {}) {
  const trace = await loadTrace();
  const model = trace.model;
  const ordinal = parseInt(requestId, 10);
  const resource = !isNaN(ordinal) && ordinal >= 1 && ordinal <= model.resources.length
    ? model.resources[ordinal - 1]
    : undefined;

  if (!resource) {
    console.error(`Request '${requestId}' not found. Use 'trace requests' to see available request IDs.`);
    process.exitCode = 1;
    return;
  }

  const r = resource;

  if (options.json) {
    const size = r.response._transferSize! > 0 ? r.response._transferSize! : r.response.bodySize;
    let requestBody: string | undefined;
    let requestBodyFile: string | undefined;
    if (r.request.postData) {
      if (r.request.postData._file)
        requestBodyFile = path.relative(process.cwd(), path.join(trace.model.traceUri, r.request.postData._file));
      if (r.request.postData.text)
        requestBody = r.request.postData.text;
    }
    let responseBody: string | undefined;
    let responseBodyFile: string | undefined;
    if (r.response.content._file || r.response.content.text || r.response.bodySize > 0) {
      if (r.response.content._file)
        responseBodyFile = path.relative(process.cwd(), path.join(trace.model.traceUri, r.response.content._file));
      if (r.response.content.text)
        responseBody = r.response.content.text;
    }
    const resultJson: TraceRequestDetails = {
      ordinal,
      method: r.request.method,
      url: r.request.url,
      status: r.response.status,
      statusText: r.response.statusText,
      startTime: r._monotonicTime ?? null,
      duration: r.time,
      durationFormatted: msToString(r.time),
      size,
      contentType: r.response.content.mimeType || undefined,
      route: formatRouteStatus(r) || undefined,
      server: r.serverIPAddress ? `${r.serverIPAddress}${r._serverPort ? ':' + r._serverPort : ''}` : undefined,
      failure: r.response._failureText || undefined,
      requestHeaders: r.request.headers,
      requestBody,
      requestBodyFile,
      responseHeaders: r.response.headers,
      responseBody,
      responseBodyFile,
      security: r._securityDetails ? {
        protocol: r._securityDetails.protocol,
        subjectName: r._securityDetails.subjectName,
      } : undefined,
    };
    console.log(JSON.stringify(resultJson, null, 2));
    return;
  }

  const status = r.response.status > 0 ? `${r.response.status} ${r.response.statusText}` : 'ERR';
  const size = r.response._transferSize! > 0 ? r.response._transferSize! : r.response.bodySize;

  console.log(`\n  ${r.request.method} ${r.request.url}\n`);

  // General
  console.log('  General');
  console.log(`    status:    ${status}`);
  if (r._monotonicTime)
    console.log(`    start:     ${formatTimestamp(r._monotonicTime, model.startTime)}`);
  console.log(`    duration:  ${msToString(r.time)}`);
  console.log(`    size:      ${bytesToString(size)}`);
  if (r.response.content.mimeType)
    console.log(`    type:      ${r.response.content.mimeType}`);
  const route = formatRouteStatus(r);
  if (route)
    console.log(`    route:     ${route}`);
  if (r.serverIPAddress)
    console.log(`    server:    ${r.serverIPAddress}${r._serverPort ? ':' + r._serverPort : ''}`);
  if (r.response._failureText)
    console.log(`    error:     ${r.response._failureText}`);

  // Request headers
  if (r.request.headers.length) {
    console.log('\n  Request headers');
    for (const h of r.request.headers)
      console.log(`    ${h.name}: ${h.value}`);
  }

  // Request body
  if (r.request.postData) {
    console.log('\n  Request body');
    const resource = r.request.postData._file;
    if (resource) {
      console.log(`    ${path.relative(process.cwd(), path.join(trace.model.traceUri, resource))}`);
    } else {
      const text = r.request.postData.text.length > 2000
        ? r.request.postData.text.substring(0, 2000) + '...'
        : r.request.postData.text;
      console.log(`    ${text}`);
    }
  }

  // Response headers
  if (r.response.headers.length) {
    console.log('\n  Response headers');
    for (const h of r.response.headers)
      console.log(`    ${h.name}: ${h.value}`);
  }

  // Response body
  if (r.response.content._file || r.response.content.text || r.response.bodySize > 0) {
    const resource = r.response.content._file;
    if (resource) {
      console.log('\n  Response body');
      console.log(`    ${path.relative(process.cwd(), path.join(trace.model.traceUri, resource))}`);
    } else if (r.response.content.text) {
      const text = r.response.content.text.length > 2000
        ? r.response.content.text.substring(0, 2000) + '...'
        : r.response.content.text;
      console.log('\n  Response body');
      console.log(`    ${text}`);
    }
  }

  // Security
  if (r._securityDetails) {
    console.log('\n  Security');
    if (r._securityDetails.protocol)
      console.log(`    protocol:  ${r._securityDetails.protocol}`);
    if (r._securityDetails.subjectName)
      console.log(`    subject:   ${r._securityDetails.subjectName}`);
    if (r._securityDetails.issuer)
      console.log(`    issuer:    ${r._securityDetails.issuer}`);
  }

  console.log('');
}

function bytesToString(bytes: number): string {
  if (bytes < 0 || !isFinite(bytes))
    return '-';
  if (bytes === 0)
    return '0';
  if (bytes < 1000)
    return bytes.toFixed(0);
  const kb = bytes / 1024;
  if (kb < 1000)
    return kb.toFixed(1) + 'K';
  const mb = kb / 1024;
  if (mb < 1000)
    return mb.toFixed(1) + 'M';
  const gb = mb / 1024;
  return gb.toFixed(1) + 'G';
}

function formatRouteStatus(r: { _wasAborted?: boolean, _wasContinued?: boolean, _wasFulfilled?: boolean, _apiRequestRef?: string }): string {
  if (r._wasAborted)
    return 'aborted';
  if (r._wasContinued)
    return 'continued';
  if (r._wasFulfilled)
    return 'fulfilled';
  if (r._apiRequestRef)
    return 'api';
  return '';
}
