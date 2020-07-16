/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import {TestServer} from './testserver';
import {launchEnv} from 'playwright-runner';
import {serverEnv} from './server';
import type {Browser} from 'playwright';
import {Environment} from 'describers';
import path from 'path';

export const browserEnv = launchEnv.extend({
  async beforeEach({launcher}) {
    const browser = await launcher.launch();
    return {browser};
  },
  async afterEach({browser}: {browser: Browser}) {
    await browser.close();
  }
});

export const it = browserEnv.mixin(serverEnv).it;
