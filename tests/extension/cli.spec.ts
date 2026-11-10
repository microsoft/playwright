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

test('attach --extension', async ({ user, cli, browserWithExtension, server }) => {
  const connectPage = user.waitForConnectPage();
  const attached = cli(['attach', '--extension=chromium'], { env: { PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir } });
  await user.allow(await connectPage);

  {
    const { output } = await attached;
    expect(output).toContain(`### Page`);
    expect(output).toContain(`- Page URL: about:blank`);
  }

  {
    // The session has the name of the browser channel.
    const { output } = await cli(['-s=chromium', 'goto', server.HELLO_WORLD]);
    expect(output).toContain(`### Page`);
    expect(output).toContain(`- Page URL: ${server.HELLO_WORLD}`);
    expect(output).toContain(`- Page Title: Title`);
  }
});

test('attach --extension gives the name and the color of the session to the tab group', async ({ user, cli, browserWithExtension }) => {
  const connectPage = user.waitForConnectPage();
  const attached = cli(['attach', '--extension=chromium', '--session=my session', '--session-color=red'], {
    env: { PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir },
  });
  await user.allow(await connectPage);
  await attached;

  await cli(['--session=my session', 'goto', user.urlOf('Alpha')]);
  await expect.poll(user.groups).toEqual([{ title: 'my session', color: 'red', tabs: ['Alpha'] }]);
});

test('attach --extension --no-tab-group leaves the tab where the user has it', async ({ user, cli, browserWithExtension }) => {
  await user.openTab('Alpha');
  await user.dragIntoNewGroup('Alpha', 'My tabs');

  const connectPage = user.waitForConnectPage();
  const attached = cli(['attach', '--extension=chromium', '--no-tab-group'], {
    env: { PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir },
  });
  await user.allow(await connectPage, { tabs: ['Alpha'] });

  expect((await attached).output).toContain(`- Page Title: Alpha`);
  expect(await user.tab('Alpha')).toEqual({ group: 'My tabs', badge: '✓' });
});
