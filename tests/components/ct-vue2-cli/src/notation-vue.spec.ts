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

import { test, expect } from '@playwright/experimental-ct-vue2';
import Button from './components/Button.vue';
import Counter from './components/Counter.vue';
import DefaultSlot from './components/DefaultSlot.vue';
import NamedSlots from './components/NamedSlots.vue';
import Component from './components/Component.vue';
import EmptyTemplate from './components/EmptyTemplate.vue';
import type { hooksConfig } from '../playwright';

test.use({ viewport: { width: 500, height: 500 }, colorScheme: 'dark' });

test.describe('render', () => {
  test('render props', async ({ mount }) => {
    const component = await mount(Button, {
      props: {
        title: 'Submit'
      }
    });
    await expect(component).toContainText('Submit');
  });

  test('render component without options', async ({ mount }) => {
    const component = await mount(Component);
    await expect(component).toContainText('test');
  });

  test('render empty component', async ({ mount }) => {
    const component = await mount(EmptyTemplate);
    expect(await component.allTextContents()).toEqual(['']);
    expect(await component.textContent()).toBe('');
    await expect(component).toHaveText('');
  }); 
});

test.describe('update', () => {
  test('update props without remounting', async ({ mount }) => {
    const component = await mount(Counter, {
      props: { count: 9001 }
    });
    await expect(component.getByTestId('props')).toContainText('9001');
  
    await component.update({
      props: { count: 1337 }
    });
    await expect(component.getByTestId('props')).not.toContainText('9001');
    await expect(component.getByTestId('props')).toContainText('1337');
  
    await expect(component.getByTestId('remount-count')).toContainText('1');
  });
  
  test('update event listeners without remounting', async ({ mount }) => {
    const component = await mount(Counter);
  
    const messages: string[] = [];
    await component.update({
      on: { 
        submit: (data: string) => messages.push(data)
      }
    });
    await component.click();
    expect(messages).toEqual(['hello']);
    
    await expect(component.getByTestId('remount-count')).toContainText('1');
  });
  
  test('update slots without remounting', async ({ mount }) => {
    const component = await mount(Counter, {
      slots: { default: 'Default Slot' }
    });
    await expect(component.getByTestId('slots')).toContainText('Default Slot');
  
    await component.update({
      slots: { main: 'Test Slot' }
    });
    await expect(component.getByTestId('slots')).not.toContainText('Default Slot');
    await expect(component.getByTestId('slots')).toContainText('Test Slot');
    
    await expect(component.getByTestId('remount-count')).toContainText('1');
  });
});

test.describe('events', () => {
  test('emit submit event when the button is clicked', async ({ mount }) => {
    const messages: string[] = [];
    const component = await mount(Button, {
      props: {
        title: 'Submit'
      },
      on: {
        submit: (data: string) => messages.push(data)
      }
    });
    await component.click();
    expect(messages).toEqual(['hello']);
  });
});

test.describe('slots', () => {
  test('default slot', async ({ mount }) => {
    const component = await mount(DefaultSlot, {
      slots: {
        default: 'Main Content'
      }
    });
    await expect(component).toContainText('Main Content');
  });

  test('component with multiple slots', async ({ mount }) => {
    const component = await mount(DefaultSlot, {
      slots: {
        default: ['one', 'two']
      }
    });
    await expect(component).toContainText('one');
    await expect(component).toContainText('two');
  });

  test('component with named slots', async ({ mount }) => {
    const component = await mount(NamedSlots, {
      slots: {
        header: 'Header',
        main: 'Main Content',
        footer: 'Footer'
      }
    });
    await expect(component).toContainText('Header');
    await expect(component).toContainText('Main Content');
    await expect(component).toContainText('Footer');
  });
});

test.describe('hooks', () => {
  test('run hooks', async ({ page, mount }) => {
    const messages: string[] = [];
    page.on('console', m => messages.push(m.text()));
    await mount<hooksConfig>(Button, {
      props: {
        title: 'Submit'
      },
      hooksConfig: { route: 'A' }
    });
    expect(messages).toEqual(['Before mount: {\"route\":\"A\"}', 'After mount el: HTMLButtonElement']);
  });
});

test.describe('unmount', () => {
  test('unmount', async ({ page, mount }) => {
    const component = await mount(Button, {
      props: {
        title: 'Submit'
      }
    });
    await expect(page.locator('#root')).toContainText('Submit');
    await component.unmount();
    await expect(page.locator('#root')).not.toContainText('Submit');
  });
});
