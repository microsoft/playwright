/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

const utils = require('../utils');
const { waitEvent } = utils;

module.exports.describe = function({testRunner, expect, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Workers', function() {
    it('Page.workers', async function({page, server}) {
      await Promise.all([
        new Promise(x => page.workers.once('workercreated', x)),
        page.goto(server.PREFIX + '/worker/worker.html')]);
      const worker = page.workers.list()[0];
      expect(worker.url()).toContain('worker.js');

      expect(await worker.evaluate(() => self['workerFunction']())).toBe('worker function result');

      await page.goto(server.EMPTY_PAGE);
      expect(page.workers.list().length).toBe(0);
    });
    it('should emit created and destroyed events', async function({page}) {
      const workerCreatedPromise = new Promise(x => page.workers.once('workercreated', x));
      const workerObj = await page.evaluateHandle(() => new Worker('data:text/javascript,1'));
      const worker = await workerCreatedPromise;
      const workerThisObj = await worker.evaluateHandle(() => this);
      const workerDestroyedPromise = new Promise(x => page.workers.once('workerdestroyed', x));
      await page.evaluate(workerObj => workerObj.terminate(), workerObj);
      expect(await workerDestroyedPromise).toBe(worker);
      const error = await workerThisObj.getProperty('self').catch(error => error);
      expect(error.message).toContain('Most likely the worker has been closed.');
    });
    it('should report console logs', async function({page}) {
      const [message] = await Promise.all([
        waitEvent(page, 'console'),
        page.evaluate(() => new Worker(`data:text/javascript,console.log(1)`)),
      ]);
      expect(message.text()).toBe('1');
      expect(message.location()).toEqual({
        url: 'data:text/javascript,console.log(1)',
        lineNumber: 0,
        columnNumber: 8,
      });
    });
    it('should have JSHandles for console logs', async function({page}) {
      const logPromise = new Promise(x => page.on('console', x));
      await page.evaluate(() => new Worker(`data:text/javascript,console.log(1,2,3,this)`));
      const log = await logPromise;
      expect(log.text()).toBe('1 2 3 JSHandle@object');
      expect(log.args().length).toBe(4);
      expect(await (await log.args()[3].getProperty('origin')).jsonValue()).toBe('null');
    });
    it('should evaluate', async function({page}) {
      const workerCreatedPromise = new Promise(x => page.workers.once('workercreated', x));
      await page.evaluate(() => new Worker(`data:text/javascript,console.log(1)`));
      const worker = await workerCreatedPromise;
      expect(await worker.evaluate('1+1')).toBe(2);
    });
    it('should report errors', async function({page}) {
      const errorPromise = new Promise(x => page.on('pageerror', x));
      await page.evaluate(() => new Worker(`data:text/javascript, throw new Error('this is my error');`));
      const errorLog = await errorPromise;
      expect(errorLog.message).toContain('this is my error');
    });
  });
};
