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
import { test, expect } from './harness';

test('connect page is not in a tab group', async ({ user, connect }) => {
  await connect('worker', async connectPage => {
    await expect(connectPage.locator('.tab-item').first()).toBeVisible();
    expect(await user.tab(await connectPage.title())).toEqual({ group: null, badge: '' });
    await user.allow(connectPage);
  });
});

test('tabs of a client are in a green group that turns gray when the client leaves', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43038' },
}, async ({ user, connect }) => {
  await user.openTab('Alpha');
  const client = await connect('worker', { tabs: ['Alpha'] });

  // The connect page closes, because the user picked a different tab.
  await expect.poll(() => user.tabs()).toEqual(['about:blank', 'Alpha']);
  await client.openTab('Beta');
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · worker', color: 'green', tabs: ['Alpha', 'Beta'] }]);
  expect(await user.tab('Alpha')).toEqual({ group: 'Playwright · worker', badge: '✓' });
  expect(await user.tab('Beta')).toEqual({ group: 'Playwright · worker', badge: '✓' });

  await client.close();
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · worker', color: 'grey', tabs: ['Alpha', 'Beta'] }]);
  expect(await user.tab('Alpha')).toEqual({ group: 'Playwright · worker', badge: '' });
});

test('--no-tab-group leaves the tabs where the user has them', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/43038' },
}, async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.dragIntoNewGroup('Alpha', 'My tabs');

  const client = await connect('worker', { tabs: ['Alpha'] }, { args: ['--no-tab-group'] });
  await client.openTab('Beta');
  expect(await client.tabs()).toEqual(['Alpha', 'Beta']);
  await expect.poll(() => user.tab('Alpha')).toEqual({ group: 'My tabs', badge: '✓' });
  await expect.poll(() => user.tab('Beta')).toEqual({ group: null, badge: '✓' });

  await client.close();
  await expect.poll(() => user.tab('Alpha')).toEqual({ group: 'My tabs', badge: '' });
  expect(await user.groups()).toEqual([{ title: 'My tabs', color: 'red', tabs: ['Alpha'] }]);
});

test('client sets the title and the color of its tab group', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41838' },
}, async ({ user, connectWithToken }) => {
  const first = await connectWithToken('first');
  await first.navigate('Alpha');
  const second = await connectWithToken('second', { args: ['--session-name', 'Second client', '--session-color', 'pink'] });
  await second.navigate('Beta');

  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · first', color: 'green', tabs: ['Alpha'] },
    { title: 'Second client', color: 'pink', tabs: ['Beta'] },
  ]);
});

test('connect page that opens inside the group of another client leaves the group', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41838' },
}, async ({ user, connect }) => {
  await user.openTab('Alpha');
  const first = await connect('first', { tabs: ['Alpha'] });

  const second = await connect('second', async connectPage => {
    await expect(connectPage.locator('.tab-item').first()).toBeVisible();
    // Chrome can create the connect page inside the group, with no event for the change of the group.
    const title = await connectPage.title();
    await user.dragIntoGroupOf(title, 'Alpha');
    await connectPage.reload();
    await expect.poll(() => user.tab(title)).toEqual({ group: null, badge: '' });
    await user.allow(connectPage);
  });

  expect(await first.tabs()).toEqual(['Alpha']);
  expect(await second.tabs()).toHaveLength(1);
  await expect.poll(user.groupColors).toEqual(['blue', 'green']);
});

test('user changes the title and the color of the group of a client', async ({ user, connect }) => {
  await user.openTab('Alpha');
  const client = await connect('worker', { tabs: ['Alpha'] });

  await user.editGroupOf('Alpha', { title: 'Research', color: 'cyan' });
  await client.openTab('Beta');
  await client.expectControls('Alpha');
  await expect.poll(user.groups).toEqual([{ title: 'Research', color: 'cyan', tabs: ['Alpha', 'Beta'] }]);

  // The group keeps the title of the user when the client leaves, and when the next client takes it.
  await client.close();
  await expect.poll(user.groups).toEqual([{ title: 'Research', color: 'grey', tabs: ['Alpha', 'Beta'] }]);
  const next = await connect('next', { group: 'Research' });
  expect(await next.tabs()).toEqual(['Alpha', 'Beta']);
  await expect.poll(user.groups).toEqual([{ title: 'Research', color: 'green', tabs: ['Alpha', 'Beta'] }]);
});

test('tabs that the user picks from two windows go into one group', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  await user.dragIntoNewWindow('Beta');

  const client = await connect('worker', { tabs: ['Alpha', 'Beta'] });
  await client.expectControls('Alpha');
  await client.expectControls('Beta');
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · worker', color: 'green', tabs: ['Alpha', 'Beta'] }]);
});
