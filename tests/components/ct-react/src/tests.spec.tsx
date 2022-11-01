/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { test, expect } from '@playwright/experimental-ct-react';
const { serverFixtures } = require('../../../../tests/config/serverFixtures');
import Fetch from './components/Fetch';
import DelayedData from './components/DelayedData';
import Button from './components/Button';
import DefaultChildren from './components/DefaultChildren';
import MultipleChildren from './components/MultipleChildren';
import MultiRoot from './components/MultiRoot';
import Counter from './components/Counter';
import EmptyFragment from './components/EmptyFragment';
import type { HooksConfig } from '../playwright';

test.use({ viewport: { width: 500, height: 500 }, colorScheme: 'dark' });

test.describe('render', () => {
  test('render props', async ({ mount }) => {
    const component = await mount(<Button title="Submit" />);
    await expect(component).toContainText('Submit');
  });

  test('render delayed props', async ({ mount }) => {
    const component = await mount(<DelayedData data="complete" />);
    await expect(component).toHaveText('loading');
    await expect(component).toHaveText('complete');
  });

  test('render attributes', async ({ mount }) => {
    const component = await mount(<Button className="primary" title="Submit" />);
    await expect(component).toHaveClass('primary');
  });

  test('render empty fragment', async ({ mount }) => {
    const component = await mount(<EmptyFragment />);
    expect(await component.allTextContents()).toEqual(['']);
    expect(await component.textContent()).toBe('');
    await expect(component).toHaveText('');
  });
});

test.describe('update', () => {
  test('update props without remounting', async ({ mount }) => {
    const component = await mount(<Counter count={9001} />);
    await expect(component.getByTestId('props')).toContainText('9001');

    await component.update(<Counter count={1337} />);
    await expect(component.getByTestId('props')).not.toContainText('9001');
    await expect(component.getByTestId('props')).toContainText('1337');

    await expect(component.getByTestId('remount-count')).toContainText('1');
  });

  test('update callbacks without remounting', async ({ mount }) => {
    const component = await mount(<Counter />);

    const messages: string[] = [];
    await component.update(<Counter onClick={message => {
      messages.push(message)
    }} />);
    await component.click();
    expect(messages).toEqual(['hello']);

    await expect(component.getByTestId('remount-count')).toContainText('1');
  });

  test('update children without remounting', async ({ mount }) => {
    const component = await mount(<Counter>Default Slot</Counter>);
    await expect(component.getByTestId('children')).toContainText('Default Slot');

    await component.update(<Counter>Test Slot</Counter>);
    await expect(component.getByTestId('children')).not.toContainText('Default Slot');
    await expect(component.getByTestId('children')).toContainText('Test Slot');

    await expect(component.getByTestId('remount-count')).toContainText('1');
  });
});

test.describe('callback', () => {
  test('execute callback when the button is clicked', async ({ mount }) => {
    const messages: string[] = [];
    const component = await mount(<Button title="Submit" onClick={data => {
      messages.push(data)
    }} />);
    await component.click();
    expect(messages).toEqual(['hello']);
  })

  test('execute callback when child node is clicked', async ({ mount }) => {
    let clickFired = false;
    const component = await mount(<DefaultChildren>
      <button onClick={() => clickFired = true}>Submit</button>
    </DefaultChildren>);
    await component.getByRole('button', { name: 'Submit' }).click();
    expect(clickFired).toBeTruthy();
  });
});

test.describe('children', () => {
  test('default child', async ({ mount }) => {
    const component = await mount(<DefaultChildren>
      <strong>Main Content</strong>
    </DefaultChildren>);
    await expect(component.getByRole('strong')).toContainText('Main Content');
  });

  test('component as child', async ({ mount }) => {
    const component = await mount(<DefaultChildren>
      <Button title="Submit" />
    </DefaultChildren>);
    await expect(component.getByRole('button')).toContainText('Submit');
  })

  test('multiple children', async ({ mount }) => {
    const component = await mount(<DefaultChildren>
      <div data-testid="one">One</div>
      <div data-testid="two">Two</div>
    </DefaultChildren>);
    await expect(component.getByTestId('one')).toContainText('One');
    await expect(component.getByTestId('two')).toContainText('Two');
  })

  test('named children', async ({ mount }) => {
    const component = await mount(<MultipleChildren>
      <div>Header</div>
      <div>Main Content</div>
      <div>Footer</div>
    </MultipleChildren>);
    await expect(component.getByRole('banner')).toContainText('Header');
    await expect(component.getByRole('main')).toContainText('Main Content');
    await expect(component.getByRole('contentinfo')).toContainText('Footer');
  });
});

test.describe('hooks', () => {
  test('run hooks', async ({ page, mount }) => {
    const messages: string[] = [];
    page.on('console', m => messages.push(m.text()));
    await mount<HooksConfig>(<Button title="Submit" />, {
      hooksConfig: {
        route: 'A'
      }
    });
    expect(messages).toEqual(['Before mount: {\"route\":\"A\"}', 'After mount']);
  });
});

test.describe('unmount', () => {
  test('unmount component', async ({ page, mount }) => {
    const component = await mount(<Button title="Submit" />);
    await expect(page.locator('#root')).toContainText('Submit');
    await component.unmount();
    await expect(page.locator('#root')).not.toContainText('Submit');
  });

  test('unmount multi root component', async ({ mount, page }) => {
    const component = await mount(<MultiRoot />);
    await expect(page.locator('#root')).toContainText('root 1');
    await expect(page.locator('#root')).toContainText('root 2');
    await component.unmount();
    await expect(page.locator('#root')).not.toContainText('root 1');
    await expect(page.locator('#root')).not.toContainText('root 2');
  });
});

const testWithServer = test.extend(serverFixtures);
testWithServer('components routing should go through context', async ({ mount, context, server }) => {
  server.setRoute('/hello', (req: any, res: any) => {
    res.write('served via server');
    res.end();
  });

  let markRouted: (url: string) => void;
  const routedViaContext = new Promise(res => markRouted = res);
  await context.route('**/hello', async (route, request) => {
    markRouted(`${request.method()} ${request.url()}`);
    await route.fulfill({
      body: 'intercepted',
    });
  });

  const whoServedTheRequest = Promise.race([
    server.waitForRequest('/hello').then((req: any) => `served via server: ${req.method} ${req.url}`),
    routedViaContext.then(req => `served via context: ${req}`),
  ]);

  const component = await mount(<Fetch url={server.PREFIX + '/hello'} />);
  await expect.soft(whoServedTheRequest).resolves.toMatch(/served via context: GET.*\/hello.*/i);
  await expect.soft(component).toHaveText('intercepted');
});
