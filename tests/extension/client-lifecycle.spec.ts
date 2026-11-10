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
import { clickAllow } from './extension-fixtures';
import { test, expect } from './harness';

import type { Page } from 'playwright';

// Clients come and go. A client that leaves keeps its tabs open in a gray group.

test('client picks one tab of a group that another client left', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');

  const first = await connect('first', { tabs: ['Alpha', 'Beta'] });
  expect(await user.groups()).toEqual([{ title: 'Playwright · first', color: 'green', tabs: ['Alpha', 'Beta'] }]);

  await first.close();
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · first', color: 'grey', tabs: ['Alpha', 'Beta'] }]);

  // The group and its tabs are offered. The user takes one tab out of the group.
  const second = await connect('second', {
    offered: ['Playwright · first', 'about:blank', 'Alpha', 'Beta'],
    tabs: ['Alpha'],
  });
  expect(await second.tabs()).toEqual(['Alpha']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · second', color: 'green', tabs: ['Alpha'] },
    { title: 'Playwright · first', color: 'grey', tabs: ['Beta'] },
  ]);

  // The rest of the group goes to the next client as a whole.
  const third = await connect('third', {
    offered: ['Playwright · first', 'about:blank', 'Beta'],
    group: 'Playwright · first',
  });
  expect(await third.tabs()).toEqual(['Beta']);
  expect(await second.tabs()).toEqual(['Alpha']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · second', color: 'green', tabs: ['Alpha'] },
    { title: 'Playwright · first', color: 'blue', tabs: ['Beta'] },
  ]);
});

test('client resumes the same group several times without the token', async ({ user, connect }) => {
  await user.openTab('Alpha');

  let client = await connect('worker', { tabs: ['Alpha'] });
  for (const [from, to] of [['Alpha', 'Beta'], ['Beta', 'Gamma'], ['Gamma', 'Delta']]) {
    // The client finds the tab where the previous client left it.
    expect(await client.tabs()).toEqual([from]);
    await client.navigate(to);
    await expect.poll(user.groups).toEqual([{ title: 'Playwright · worker', color: 'green', tabs: [to] }]);

    await client.close();
    await expect.poll(user.groups).toEqual([{ title: 'Playwright · worker', color: 'grey', tabs: [to] }]);

    client = await connect('worker', { group: 'Playwright · worker' });
  }
  await client.expectControls('Delta');
  expect(await user.groups()).toEqual([{ title: 'Playwright · worker', color: 'green', tabs: ['Delta'] }]);
});

test('client with the token gets a blank tab, the group it left waits for the user', async ({ user, connect, connectWithToken }) => {
  const first = await connectWithToken('agent');
  await first.navigate('Alpha');
  expect(await user.groups()).toEqual([{ title: 'Playwright · agent', color: 'green', tabs: ['Alpha'] }]);

  await first.close();
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · agent', color: 'grey', tabs: ['Alpha'] }]);

  // Nobody picks tabs for a client with the token, so it starts again from a blank tab.
  const second = await connectWithToken('agent');
  await second.navigate('Beta');
  expect(await second.tabs()).toEqual(['Beta']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · agent', color: 'grey', tabs: ['Alpha'] },
    { title: 'Playwright · agent', color: 'green', tabs: ['Beta'] },
  ]);

  // The user gives the group that was left to a client without the token.
  const third = await connect('human', {
    offered: ['Playwright · agent', 'about:blank', 'Alpha'],
    group: 'Playwright · agent',
  });
  expect(await third.tabs()).toEqual(['Alpha']);
  expect(await second.tabs()).toEqual(['Beta']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · agent', color: 'blue', tabs: ['Alpha'] },
    { title: 'Playwright · agent', color: 'green', tabs: ['Beta'] },
  ]);
});

test('user gives one of two free groups to each new client', async ({ user, connect, connectWithToken }) => {
  const one = await connectWithToken('one');
  await one.navigate('Alpha');
  const two = await connectWithToken('two');
  await two.navigate('Beta');
  await one.close();
  await two.close();
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · one', color: 'grey', tabs: ['Alpha'] },
    { title: 'Playwright · two', color: 'grey', tabs: ['Beta'] },
  ]);

  const groupRow = (connectPage: Page, title: string) => connectPage.locator('.tab-item', { hasText: title });
  const three = await connect('three', async connectPage => {
    // A pick of the second group replaces the pick of the first one.
    await groupRow(connectPage, 'Playwright · one').click();
    await expect(groupRow(connectPage, 'Playwright · one').getByRole('checkbox')).toBeChecked();
    await groupRow(connectPage, 'Playwright · two').click();
    await expect(groupRow(connectPage, 'Playwright · one').getByRole('checkbox')).not.toBeChecked();
    await expect(groupRow(connectPage, 'Playwright · two').getByRole('checkbox')).toBeChecked();
    await clickAllow(connectPage);
  });
  expect(await three.tabs()).toEqual(['Beta']);

  const four = await connect('four', {
    offered: ['Playwright · one', 'about:blank', 'Alpha'],
    group: 'Playwright · one',
  });
  expect(await four.tabs()).toEqual(['Alpha']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · one', color: 'blue', tabs: ['Alpha'] },
    { title: 'Playwright · two', color: 'green', tabs: ['Beta'] },
  ]);
});

test('second client is not offered the tabs of the first one', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41838' },
}, async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');
  const first = await connect('first', { tabs: ['Alpha'] });

  const second = await connect('second', { offered: ['about:blank', 'Beta'], tabs: ['Beta'] });
  expect(await first.tabs()).toEqual(['Alpha']);
  expect(await second.tabs()).toEqual(['Beta']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · first', color: 'green', tabs: ['Alpha'] },
    { title: 'Playwright · second', color: 'blue', tabs: ['Beta'] },
  ]);
});

test('client that the user disconnected connects again from the same process', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41838' },
}, async ({ user, connectWithToken }) => {
  const agent = await connectWithToken('agent');
  await agent.navigate('Alpha');
  const other = await connectWithToken('other');
  await other.navigate('Beta');
  expect(await user.connectedClients()).toEqual(['agent', 'other']);

  await user.disconnect('agent');
  expect(await user.connectedClients()).toEqual(['other']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · agent', color: 'grey', tabs: ['Alpha'] },
    { title: 'Playwright · other', color: 'blue', tabs: ['Beta'] },
  ]);

  // The next tool call of the same client connects again with a blank tab.
  await agent.navigate('Gamma');
  expect(await agent.tabs()).toEqual(['Gamma']);
  expect(await other.tabs()).toEqual(['Beta']);
  expect(await user.connectedClients()).toEqual(['other', 'agent']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · agent', color: 'grey', tabs: ['Alpha'] },
    { title: 'Playwright · other', color: 'blue', tabs: ['Beta'] },
    { title: 'Playwright · agent', color: 'green', tabs: ['Gamma'] },
  ]);
});

test('client that lost all its tabs stays connected and opens a new tab', async ({ user, connect }) => {
  await user.openTab('Alpha');
  const client = await connect('worker', { tabs: ['Alpha'] });

  await user.closeTab('Alpha');
  await expect.poll(user.groups).toEqual([]);
  expect(await user.connectedClients()).toEqual(['worker']);

  await client.openTab('Beta');
  expect(await client.tabs()).toEqual(['Beta']);
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · worker', color: 'green', tabs: ['Beta'] }]);
});

test('clients that connect and leave at the same time each leave a free group', async ({ user, connect, connectWithToken }) => {
  const names = ['Alpha', 'Beta', 'Gamma'];
  const clients = await Promise.all(names.map(async name => {
    const client = await connectWithToken(name);
    await client.navigate(name);
    return client;
  }));
  await expect.poll(user.groupColors).toEqual(['blue', 'green', 'purple']);
  for (const [index, client] of clients.entries())
    expect(await client.tabs()).toEqual([names[index]]);

  await Promise.all(clients.map(client => client.close()));
  await expect.poll(user.groups).toEqual(names.map(name => ({ title: `Playwright · ${name}`, color: 'grey', tabs: [name] })));

  const next = await connect('next', { group: 'Playwright · Beta' });
  expect(await next.tabs()).toEqual(['Beta']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · Alpha', color: 'grey', tabs: ['Alpha'] },
    { title: 'Playwright · Beta', color: 'green', tabs: ['Beta'] },
    { title: 'Playwright · Gamma', color: 'grey', tabs: ['Gamma'] },
  ]);
});

test('group that another client took in the meantime is refused', async ({ user, connect, openConnectPage }) => {
  await user.openTab('Alpha');
  const gone = await connect('gone', { tabs: ['Alpha'] });
  await gone.close();
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · gone', color: 'grey', tabs: ['Alpha'] }]);

  // Two clients are offered the same free group. The user gives it to the first one.
  const late = await openConnectPage('late');
  await expect(late.connectPage.locator('.tab-item .tab-title')).toHaveText(['Playwright · gone', 'about:blank', 'Alpha']);
  const quick = await connect('quick', { group: 'Playwright · gone' });
  expect(await quick.tabs()).toEqual(['Alpha']);

  await user.allow(late.connectPage, { group: 'Playwright · gone' });
  await expect(late.connectPage.locator('.status-banner')).toHaveText('This tab group is already connected to another client');
  expect(await quick.tabs()).toEqual(['Alpha']);
  expect(await user.connectedClients()).toEqual(['quick']);
  expect(await user.groups()).toEqual([{ title: 'Playwright · gone', color: 'green', tabs: ['Alpha'] }]);
});

test('tab that another client took in the meantime is refused', async ({ user, connect, openConnectPage }) => {
  await user.openTab('Alpha');

  const late = await openConnectPage('late');
  await expect(late.connectPage.locator('.tab-item .tab-title')).toHaveText(['about:blank', 'Alpha']);
  const quick = await connect('quick', { tabs: ['Alpha'] });

  await user.allow(late.connectPage, { tabs: ['Alpha'] });
  await expect(late.connectPage.locator('.status-banner')).toHaveText('This tab is already connected to another client');
  expect(await quick.tabs()).toEqual(['Alpha']);
  expect(await user.connectedClients()).toEqual(['quick']);
  expect(await user.groups()).toEqual([{ title: 'Playwright · quick', color: 'green', tabs: ['Alpha'] }]);
});

test('extension service worker stops: the groups turn gray and the client connects again', async ({ user, connect, connectWithToken }) => {
  const agent = await connectWithToken('agent');
  await agent.navigate('Alpha');
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · agent', color: 'green', tabs: ['Alpha'] }]);

  // The new service worker knows no clients. It finds the group of the previous one.
  await user.stopExtensionWorker();
  await expect.poll(user.connectedClients).toEqual([]);
  await expect.poll(user.groups).toEqual([{ title: 'Playwright · agent', color: 'grey', tabs: ['Alpha'] }]);
  await expect.poll(() => user.tab('Alpha')).toEqual({ group: 'Playwright · agent', badge: '' });

  // The same client process connects again on its next tool call.
  await agent.navigate('Beta');
  expect(await agent.tabs()).toEqual(['Beta']);
  await expect.poll(user.groups).toEqual([
    { title: 'Playwright · agent', color: 'grey', tabs: ['Alpha'] },
    { title: 'Playwright · agent', color: 'green', tabs: ['Beta'] },
  ]);

  // The gray group is free for a client without the token.
  const human = await connect('human', { group: 'Playwright · agent' });
  await human.expectControls('Alpha');
});
