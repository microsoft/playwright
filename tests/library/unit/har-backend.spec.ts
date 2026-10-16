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

import { test, expect } from '@playwright/test';
import { server as coreServer } from '../../../packages/playwright-core/lib/coreBundle';

const { HarBackend } = coreServer;

type Header = { name: string, value: string };

function getEntry(body: string, headers: Header[] = []) {
  return {
    request: { method: 'GET', url: 'http://a/', headers },
    response: { status: 200, headers: [], content: { text: body } },
  };
}

function postEntry(url: string, response: { status: number, headers?: Header[], text?: string }) {
  return {
    request: { method: 'POST', url, headers: [], postData: { text: 'x' } },
    response: { status: response.status, headers: response.headers ?? [], content: { text: response.text } },
  };
}

async function replayGets(entries: any[], headers: Header[], count: number): Promise<string[]> {
  const backend = new HarBackend({ log: { entries } } as any, null, null, 'recorded');
  const bodies: string[] = [];
  for (let i = 0; i < count; i++)
    bodies.push((await backend.lookup('http://a/', 'GET', headers, undefined, false)).body!.toString());
  return bodies;
}

test('recorded order should serve one copy per concurrent lookup', async () => {
  // Comparing POST bodies awaits before each hop of a redirect chain is picked. Without serialization the
  // second lookup picks the first redirect copy again while the first lookup is still walking its chain.
  const chain = (target: string, body: string) => [
    postEntry('http://a/', { status: 307, headers: [{ name: 'location', value: target }] }),
    postEntry(target, { status: 200, text: body }),
  ];
  const harFile = { log: { entries: [...chain('http://b/', '1'), ...chain('http://c/', '2')] } } as any;
  const backend = new HarBackend(harFile, null, null, 'recorded');
  const lookups = [1, 2].map(() => backend.lookup('http://a/', 'POST', [], Buffer.from('x'), false));
  const bodies = (await Promise.all(lookups)).map(result => result.body!.toString());
  expect(bodies).toEqual(['1', '2']);
});

test('recorded order should not skip a copy over a header the request does not send', async () => {
  // A cookie or referer present while recording and absent in replay is not evidence of a different request.
  const entries = [getEntry('1', [{ name: 'cookie', value: 'sid=1' }]), getEntry('2')];
  expect(await replayGets(entries, [], 2)).toEqual(['1', '2']);
});

test('recorded order should not prefer a copy for recording more headers', async () => {
  // Firefox records fewer request headers behind a redirect than for a direct navigation to the same url.
  const a = { name: 'a', value: '1' };
  const b = { name: 'b', value: '2' };
  const entries = [getEntry('1', [a]), getEntry('2', [a, b])];
  expect(await replayGets(entries, [a, b], 2)).toEqual(['1', '2']);
});

test('recorded order should reuse a served copy over an unserved copy recorded for another header value', async () => {
  // The json copy was recorded for a different request, so a third html request must not receive it.
  const html = { name: 'accept', value: 'text/html' };
  const json = { name: 'accept', value: 'application/json' };
  const entries = [getEntry('html1', [html]), getEntry('json1', [json]), getEntry('html2', [html])];
  expect(await replayGets(entries, [html], 3)).toEqual(['html1', 'html2', 'html2']);
  expect(await replayGets(entries, [json], 2)).toEqual(['json1', 'json1']);
});

test('recorded order should ignore a header that differs from every copy alike', async () => {
  // A browser version header drifts between recording and replay for every copy at once.
  const recorded = { name: 'sec-ch-ua', value: 'v1' };
  const entries = [getEntry('1', [recorded]), getEntry('2', [recorded])];
  expect(await replayGets(entries, [{ name: 'sec-ch-ua', value: 'v2' }], 2)).toEqual(['1', '2']);
});

test('recorded order should keep a sequence per POST body', async () => {
  const post = (body: string, text: string) => ({
    request: { method: 'POST', url: 'http://a/', headers: [], postData: { text: body } },
    response: { status: 200, headers: [], content: { text } },
  });
  const harFile = { log: { entries: [post('a', 'a1'), post('b', 'b1'), post('a', 'a2')] } } as any;
  const backend = new HarBackend(harFile, null, null, 'recorded');
  const bodies: string[] = [];
  for (const body of ['a', 'a', 'b', 'b'])
    bodies.push((await backend.lookup('http://a/', 'POST', [], Buffer.from(body), false)).body!.toString());
  expect(bodies).toEqual(['a1', 'a2', 'b1', 'b1']);
});

test('recorded order should keep the slot of a copy whose content fails to load', async ({}, testInfo) => {
  const dir = testInfo.outputPath('har');
  fs.mkdirSync(dir, { recursive: true });
  const broken = {
    request: { method: 'GET', url: 'http://a/', headers: [] },
    response: { status: 200, headers: [], content: { _file: 'missing' } },
  };
  const backend = new HarBackend({ log: { entries: [broken, getEntry('2')] } } as any, dir, null, 'recorded');
  expect((await backend.lookup('http://a/', 'GET', [], undefined, false)).action).toBe('error');
  expect((await backend.lookup('http://a/', 'GET', [], undefined, false)).body!.toString()).toBe('2');
});

test('should report a redirect cycle once every copy was followed', async () => {
  const redirect = (url: string, location: string) => ({
    request: { method: 'GET', url, headers: [] },
    response: { status: 302, headers: [{ name: 'location', value: location }], content: {} },
  });
  const harFile = { log: { entries: [redirect('http://a/', 'http://b/'), redirect('http://b/', 'http://a/')] } } as any;
  for (const replayOrder of ['any', 'recorded'] as const) {
    const result = await new HarBackend(harFile, null, null, replayOrder).lookup('http://a/', 'GET', [], undefined, false);
    expect(result.action).toBe('error');
    expect(result.message).toContain('redirect cycle');
  }
});
