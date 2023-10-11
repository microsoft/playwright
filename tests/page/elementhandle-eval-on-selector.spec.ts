/**
 * Copyright 2018 Google Inc. All rights reserved.
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

import { test as it, expect } from './pageTest';

it('should work', async ({ page, server }) => {
  await page.setContent('<html><body><div class="tweet"><div class="like">100</div><div class="retweets">10</div></div></body></html>');
  const tweet = await page.$('.tweet');
  const content = await tweet.$eval('.like', node => (node as HTMLElement).innerText);
  expect(content).toBe('100');
});

it('should retrieve content from subtree', async ({ page, server }) => {
  const htmlContent = '<div class="a">not-a-child-div</div><div id="myId"><div class="a">a-child-div</div></div>';
  await page.setContent(htmlContent);
  const elementHandle = await page.$('#myId');
  const content = await elementHandle.$eval('.a', node => (node as HTMLElement).innerText);
  expect(content).toBe('a-child-div');
});

it('should throw in case of missing selector', async ({ page, server }) => {
  const htmlContent = '<div class="a">not-a-child-div</div><div id="myId"></div>';
  await page.setContent(htmlContent);
  const elementHandle = await page.$('#myId');
  const errorMessage = await elementHandle.$eval('.a', node => (node as HTMLElement).innerText).catch(error => error.message);
  expect(errorMessage).toContain(`elementHandle.$eval: Failed to find element matching selector ".a"`);
});

it('should work for all', async ({ page, server }) => {
  await page.setContent('<html><body><div class="tweet"><div class="like">100</div><div class="like">10</div></div></body></html>');
  const tweet = await page.$('.tweet');
  const content = await tweet.$$eval('.like', nodes => nodes.map(n => (n as HTMLElement).innerText));
  expect(content).toEqual(['100', '10']);
});

it('should retrieve content from subtree for all', async ({ page, server }) => {
  const htmlContent = '<div class="a">not-a-child-div</div><div id="myId"><div class="a">a1-child-div</div><div class="a">a2-child-div</div></div>';
  await page.setContent(htmlContent);
  const elementHandle = await page.$('#myId');
  const content = await elementHandle.$$eval('.a', nodes => nodes.map(n => (n as HTMLElement).innerText));
  expect(content).toEqual(['a1-child-div', 'a2-child-div']);
});

it('should not throw in case of missing selector for all', async ({ page, server }) => {
  const htmlContent = '<div class="a">not-a-child-div</div><div id="myId"></div>';
  await page.setContent(htmlContent);
  const elementHandle = await page.$('#myId');
  const nodesLength = await elementHandle.$$eval('.a', nodes => nodes.length);
  expect(nodesLength).toBe(0);
});
