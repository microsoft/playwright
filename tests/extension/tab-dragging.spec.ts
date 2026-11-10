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

// The user drags tabs. For the extension, a drag is a change of the tab group of a tab.

test('free tab dragged into the group of a client, and out of it', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  const client = await connect('worker', { tabs: ['Alpha'] });
  expect(await user.tab('Beta')).toEqual({ group: null, badge: '' });

  await user.dragIntoGroupOf('Beta', 'Alpha');
  await client.expectControls('Beta');
  expect(await user.tab('Beta')).toEqual({ group: 'Playwright · worker', badge: '✓' });

  await user.dragOutOfGroup('Beta');
  await expect.poll(client.tabs).toEqual(['Alpha']);
  await expect.poll(() => user.tab('Beta')).toEqual({ group: null, badge: '' });
});

test('chrome:// tab dragged into the group of a client waits for a page that can be controlled', async ({ user, connect }) => {
  await user.openTab('Alpha');
  const client = await connect('worker', { tabs: ['Alpha'] });
  await user.openUrl('chrome://version/', 'About Version');

  await user.dragIntoGroupOf('About Version', 'Alpha');
  await expect.poll(() => user.tab('About Version')).toEqual({ group: 'Playwright · worker', badge: '' });
  expect(await client.tabs()).toEqual(['Alpha']);

  await user.navigateTab('About Version', 'Beta');
  await client.expectControls('Beta');
  expect(await user.tab('Beta')).toEqual({ group: 'Playwright · worker', badge: '✓' });
});

test('tab dragged from a group of the user into the group of a client', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  await user.openTab('Gamma');
  await user.dragIntoNewGroup(['Beta', 'Gamma'], 'Work');
  const client = await connect('worker', { tabs: ['Alpha'] });

  await user.dragIntoGroupOf('Beta', 'Alpha');
  await client.expectControls('Beta');
  expect(await client.tabs()).toEqual(['Alpha', 'Beta']);
  expect(await user.groups()).toEqual([
    { title: 'Playwright · worker', color: 'green', tabs: ['Alpha', 'Beta'] },
    { title: 'Work', color: 'red', tabs: ['Gamma'] },
  ]);
});

test('tab dragged from the group of a client into a group of the user', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  await user.openTab('Gamma');
  await user.dragIntoNewGroup('Gamma', 'Work');
  const first = await connect('first', { tabs: ['Alpha', 'Beta'] });

  await user.dragIntoGroupOf('Beta', 'Gamma');
  await expect.poll(first.tabs).toEqual(['Alpha']);
  expect(await user.groups()).toEqual([
    { title: 'Playwright · first', color: 'green', tabs: ['Alpha'] },
    { title: 'Work', color: 'red', tabs: ['Beta', 'Gamma'] },
  ]);

  // The group of the user is free, so the next client can take it with the tab in it.
  const second = await connect('second', {
    offered: ['Work', 'about:blank', 'Beta', 'Gamma'],
    group: 'Work',
  });
  await second.expectControls('Beta');
  await second.expectControls('Gamma');
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · first', color: 'green', tabs: ['Alpha'] },
    { title: 'Work', color: 'blue', tabs: ['Beta', 'Gamma'] },
  ]);
});

test('tab dragged from the group of a client into a new group', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  const client = await connect('worker', { tabs: ['Alpha', 'Beta'] });

  await user.dragIntoNewGroup('Beta', 'Mine');
  await expect.poll(client.tabs).toEqual(['Alpha']);
  expect(await user.tab('Beta')).toEqual({ group: 'Mine', badge: '' });
  expect(await user.groups()).toEqual([
    { title: 'Playwright · worker', color: 'green', tabs: ['Alpha'] },
    { title: 'Mine', color: 'red', tabs: ['Beta'] },
  ]);
});

test('tabs dragged into a group that a client left go to the client that takes the group', async ({ user, connect, connectWithToken }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  await user.openTab('Delta');
  const first = await connect('first', { tabs: ['Alpha', 'Beta'] });
  const gone = await connectWithToken('gone');
  await gone.navigate('Gamma');
  await gone.close();
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · first', color: 'green', tabs: ['Alpha', 'Beta'] },
    { title: 'Playwright · gone', color: 'grey', tabs: ['Gamma'] },
  ]);

  // One tab comes from a client, one tab is a free tab of the user.
  await user.dragIntoGroupOf('Beta', 'Gamma');
  await user.dragIntoGroupOf('Delta', 'Gamma');
  await expect.poll(first.tabs).toEqual(['Alpha']);
  expect(await user.tab('Beta')).toEqual({ group: 'Playwright · gone', badge: '' });
  expect(await user.groups()).toEqual([
    { title: 'Playwright · first', color: 'green', tabs: ['Alpha'] },
    { title: 'Playwright · gone', color: 'grey', tabs: ['Beta', 'Delta', 'Gamma'] },
  ]);

  const second = await connect('second', { group: 'Playwright · gone' });
  await second.expectControls('Beta');
  await second.expectControls('Delta');
  await second.expectControls('Gamma');
  expect(await first.tabs()).toEqual(['Alpha']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · first', color: 'green', tabs: ['Alpha'] },
    { title: 'Playwright · gone', color: 'blue', tabs: ['Beta', 'Delta', 'Gamma'] },
  ]);
});

test('tab dragged out of a group that a client left stays free', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  const gone = await connect('gone', { tabs: ['Alpha', 'Beta'] });
  await gone.close();
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · gone', color: 'grey', tabs: ['Alpha', 'Beta'] }]);

  await user.dragOutOfGroup('Beta');
  const next = await connect('next', {
    offered: ['Playwright · gone', 'about:blank', 'Alpha', 'Beta'],
    tabs: ['Beta'],
  });
  await next.expectControls('Beta');
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · gone', color: 'grey', tabs: ['Alpha'] },
    { title: 'Playwright · next', color: 'green', tabs: ['Beta'] },
  ]);
});

test('tab dragged from one client to another and back', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41838' },
}, async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  await user.openTab('Gamma');
  const first = await connect('first', { tabs: ['Alpha', 'Beta'] });
  const second = await connect('second', { tabs: ['Gamma'] });

  await user.dragIntoGroupOf('Beta', 'Gamma');
  await second.expectControls('Beta');
  await expect.poll(first.tabs).toEqual(['Alpha']);
  expect(await user.groups()).toEqual([
    { title: 'Playwright · first', color: 'green', tabs: ['Alpha'] },
    { title: 'Playwright · second', color: 'blue', tabs: ['Beta', 'Gamma'] },
  ]);

  // The second client changes the page, then the user drags the tab back.
  await second.navigate('Delta');
  await user.dragIntoGroupOf('Delta', 'Alpha');
  await first.expectControls('Delta');
  await expect.poll(second.tabs).toEqual(['Gamma']);
  await second.expectControls('Gamma');
  expect(await user.groups()).toEqual([
    { title: 'Playwright · first', color: 'green', tabs: ['Alpha', 'Delta'] },
    { title: 'Playwright · second', color: 'blue', tabs: ['Gamma'] },
  ]);
});

test('several tabs dragged at once from one client to another', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  await user.openTab('Gamma');
  await user.openTab('Delta');
  const first = await connect('first', { tabs: ['Alpha', 'Beta', 'Gamma'] });
  const second = await connect('second', { tabs: ['Delta'] });

  await user.dragIntoGroupOf(['Alpha', 'Beta'], 'Delta');
  await second.expectControls('Alpha');
  await second.expectControls('Beta');
  await second.expectControls('Delta');
  await first.expectControls('Gamma');
  expect(await first.tabs()).toEqual(['Gamma']);
  expect(await user.groups()).toEqual([
    { title: 'Playwright · second', color: 'blue', tabs: ['Alpha', 'Beta', 'Delta'] },
    { title: 'Playwright · first', color: 'green', tabs: ['Gamma'] },
  ]);
});

test('last tab dragged out of the group of a client, and dragged into its next group', async ({ user, connect }) => {
  await user.openTab('Alpha');
  const client = await connect('worker', { tabs: ['Alpha'] });

  await user.dragOutOfGroup('Alpha');
  await expect.poll(user.groups).toEqual([]);

  // The client stays connected. Its next tab starts a new group.
  await client.openTab('Beta');
  expect(await client.tabs()).toEqual(['Beta']);
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · worker', color: 'green', tabs: ['Beta'] }]);

  await user.dragIntoGroupOf('Alpha', 'Beta');
  await client.expectControls('Alpha');
  await client.expectControls('Beta');
  expect(await user.groups()).toEqual([{ title: 'Playwright · worker', color: 'green', tabs: ['Alpha', 'Beta'] }]);
});

test('tab dragged into a new window leaves its client', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  const first = await connect('first', { tabs: ['Alpha', 'Beta'] });

  await user.dragIntoNewWindow('Beta');
  await expect.poll(first.tabs).toEqual(['Alpha']);
  expect(await user.tab('Beta')).toEqual({ group: null, badge: '' });

  // The tab in the new window is free for the next client.
  const second = await connect('second', { tabs: ['Beta'] });
  await second.expectControls('Beta');
  expect(await user.groups()).toEqual([
    { title: 'Playwright · first', color: 'green', tabs: ['Alpha'] },
    { title: 'Playwright · second', color: 'blue', tabs: ['Beta'] },
  ]);
});
