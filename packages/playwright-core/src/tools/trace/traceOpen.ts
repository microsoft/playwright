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

import { openTrace, loadTrace } from './traceUtils';
import { msToString } from '../../utils/isomorphic/formatUtils';

export async function traceOpen(traceFile: string) {
  await openTrace(traceFile);
  await traceInfo();
}

async function traceInfo() {
  const trace = await loadTrace();
  const model = trace.model;

  const info = {
    browser: model.browserName || 'unknown',
    platform: model.platform || 'unknown',
    playwrightVersion: model.playwrightVersion || 'unknown',
    title: model.title || '',
    duration: msToString(model.endTime - model.startTime),
    durationMs: model.endTime - model.startTime,
    startTime: model.wallTime ? new Date(model.wallTime).toISOString() : 'unknown',
    viewport: model.options.viewport ? `${model.options.viewport.width}x${model.options.viewport.height}` : 'default',
    actions: model.actions.length,
    pages: model.pages.length,
    network: model.resources.length,
    errors: model.errorDescriptors.length,
    attachments: model.attachments.length,
    consoleMessages: model.events.filter(e => e.type === 'console').length,
  };

  console.log('');
  console.log(`  Browser:      ${info.browser}`);
  console.log(`  Platform:     ${info.platform}`);
  console.log(`  Playwright:   ${info.playwrightVersion}`);
  if (info.title)
    console.log(`  Title:        ${info.title}`);
  console.log(`  Duration:     ${info.duration}`);
  console.log(`  Start time:   ${info.startTime}`);
  console.log(`  Viewport:     ${info.viewport}`);
  console.log(`  Actions:      ${info.actions}`);
  console.log(`  Pages:        ${info.pages}`);
  console.log(`  Network:      ${info.network} requests`);
  console.log(`  Errors:       ${info.errors}`);
  console.log(`  Attachments:  ${info.attachments}`);
  console.log(`  Console:      ${info.consoleMessages} messages`);
  console.log('');
}
