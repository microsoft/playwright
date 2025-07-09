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

/* eslint-disable no-console */

import { chromium } from 'playwright-core';

import { runOneShot } from './loop';

import type { BrowserContext } from '../../playwright-core/src/client/browserContext';
import type * as actions from '@recorder/actions';
import type * as playwright from 'playwright-core';

export async function runRecorderLoop() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext() as BrowserContext;
  await context._enableRecorder({
    mode: 'recording',
    recorderMode: 'api',
  }, {
    actionAdded: (page: playwright.Page, actionInContext: actions.ActionInContext) => {
      const action = actionInContext.action;
      if (action.name !== 'click' && action.name !== 'press')
        return;
      runOneShot(prompt(action)).then(response => {
        console.log(response);
      }).catch(e => {
        console.error(e);
      });
    },
    actionUpdated: (page: playwright.Page, actionInContext: actions.ActionInContext) => {
      console.log('actionUpdated', actionInContext);
    },
    signalAdded: (page: playwright.Page, signal: actions.SignalInContext) => {
      console.log('signalAdded', signal);
    },
  });
  const page = await context.newPage();
  await page.goto('https://playwright.dev/');
}

const prompt = (action: actions.ClickAction | actions.PressAction) => [
  `- User performed an action on a page.`,
  `- Please describe the action in a single phrase.`,
  `- You'll be asked to perform the action again, so make sure to describe the action in a way that is easy to understand and perform.`,
  `- Action: "${action.name}"`,
  `- Element: [${action.selector}]`,
  `- Snapshot:`,
  action.ariaSnapshot,
].join('\n');
