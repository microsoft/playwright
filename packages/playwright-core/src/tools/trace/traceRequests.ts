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

import { loadTrace } from './traceUtils';
import { msToString } from '../../utils/isomorphic/formatUtils';

export async function traceRequests(options: { grep?: string, method?: string, status?: string, failed?: boolean }) {
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
    indexed = indexed.filter(({ resource: r }) => r.response.status >= 400 || r.response.status === -1);

  if (!indexed.length) {
    console.log('  No network requests');
    return;
  }
  console.log(`  ${'#'.padStart(4)} ${'Method'.padEnd(8)} ${'Status'.padEnd(8)} ${'Name'.padEnd(45)} ${'Duration'.padStart(10)} ${'Size'.padStart(8)} ${'Route'.padEnd(10)}`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(8)} ${'─'.repeat(8)} ${'─'.repeat(45)} ${'─'.repeat(10)} ${'─'.repeat(8)} ${'─'.repeat(10)}`);

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
    console.log(`  ${(ordinal + '.').padStart(4)} ${r.request.method.padEnd(8)} ${status.padEnd(8)} ${name.padEnd(45)} ${msToString(r.time).padStart(10)} ${bytesToString(size).padStart(8)} ${route.padEnd(10)}`);
  }
}

// ---- trace request ----

export async function traceRequest(requestId: string) {
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
  const status = r.response.status > 0 ? `${r.response.status} ${r.response.statusText}` : 'ERR';
  const size = r.response._transferSize! > 0 ? r.response._transferSize! : r.response.bodySize;

  console.log(`\n  ${r.request.method} ${r.request.url}\n`);

  // General
  console.log('  General');
  console.log(`    status:    ${status}`);
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
    console.log(`    type: ${r.request.postData.mimeType}`);
    if (r.request.postData.text) {
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

function formatRouteStatus(r: { _wasAborted?: boolean, _wasContinued?: boolean, _wasFulfilled?: boolean, _apiRequest?: boolean }): string {
  if (r._wasAborted)
    return 'aborted';
  if (r._wasContinued)
    return 'continued';
  if (r._wasFulfilled)
    return 'fulfilled';
  if (r._apiRequest)
    return 'api';
  return '';
}
