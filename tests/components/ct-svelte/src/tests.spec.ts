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

import { test, expect } from '@playwright/experimental-ct-svelte';
import Button from './components/Button.svelte';
import Counter from './components/Counter.svelte';
import Component from './components/Component.svelte';
import DefaultSlot from './components/DefaultSlot.svelte';
import NamedSlots from './components/NamedSlots.svelte'
import MultiRoot from './components/MultiRoot.svelte';
import Empty from './components/Empty.svelte';
import type { HooksConfig } from '../playwright';

test.use({ viewport: { width: 500, height: 500 } });

test('render props', async ({ mount }) => {
  const component = await mount(Button, {
    props: {
      title: 'Submit'
    }
  })
  await expect(component).toContainText('Submit')
})

test('update props without remounting', async ({ mount }) => {
  const component = await mount(Counter, {
    props: { count: 9001 }
  })
  await expect(component.locator('#props')).toContainText('9001')

  await component.update({
    props: { count: 1337 }
  })
  await expect(component).not.toContainText('9001')
  await expect(component.locator('#props')).toContainText('1337')

  await expect(component.locator('#remount-count')).toContainText('1')
})

test('update event listeners without remounting', async ({ mount }) => {
  const component = await mount(Counter)

  const messages: string[] = []
  await component.update({
    on: { 
      submit: (data: string) => messages.push(data)
    }
  })
  await component.click();
  expect(messages).toEqual(['hello'])
  
  await expect(component.locator('#remount-count')).toContainText('1')
})

test('emit an submit event when the button is clicked', async ({ mount }) => {
  const messages: string[] = []
  const component = await mount(Button, {
    props: {
      title: 'Submit'
    },
    on: {
      submit: (data: string) => messages.push(data)
    }
  })
  await component.click()
  expect(messages).toEqual(['hello'])
})

test('render a default slot', async ({ mount }) => {
  const component = await mount(DefaultSlot, {
    slots: {
      default: 'Main Content'
    }
  })
  await expect(component).toContainText('Main Content')
})

test('render a component with a named slot', async ({ mount }) => {
  const component = await mount(NamedSlots, {
    slots: {
      header: 'Header',
      main: 'Main Content',
      footer: 'Footer'
    }
  })
  await expect(component).toContainText('Header')
  await expect(component).toContainText('Main Content')
  await expect(component).toContainText('Footer')
})

test('render a component without options', async ({ mount }) => {
  const component = await mount(Component);
  await expect(component).toContainText('test');
})

test('run hooks', async ({ page, mount }) => {
  const messages: string[] = []
  page.on('console', m => messages.push(m.text()))
  await mount<HooksConfig>(Button, {
    props: {
      title: 'Submit'
    },
    hooksConfig: { route: 'A' }
  })
  expect(messages).toEqual(['Before mount: {\"route\":\"A\"}', 'After mount']);
})

test('unmount', async ({ page, mount }) => {
  const component = await mount(Button, {
    props: {
      title: 'Submit'
    }
  })
  await expect(page.locator('#root')).toContainText('Submit')
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('Submit');
});

test('unmount a multi root component', async ({ mount, page }) => {
  const component = await mount(MultiRoot)
  await expect(page.locator('#root')).toContainText('root 1')
  await expect(page.locator('#root')).toContainText('root 2')
  await component.unmount()
  await expect(page.locator('#root')).not.toContainText('root 1')
  await expect(page.locator('#root')).not.toContainText('root 2')
});

test('get textContent of the empty component', async ({ mount }) => {
  const component = await mount(Empty);
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});
