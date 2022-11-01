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

import { test, expect } from '@playwright/experimental-ct-vue';
import App from './App.vue';
import Button from './components/Button.vue';
import Counter from './components/Counter.vue';
import DefaultSlot from './components/DefaultSlot.vue';
import NamedSlots from './components/NamedSlots.vue';
import MultiRoot from './components/MultiRoot.vue';
import Component from './components/Component.vue';
import EmptyTemplate from './components/EmptyTemplate.vue';
import type { HooksConfig } from '../playwright';

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
  test('render default slot', async ({ mount }) => {
    const component = await mount(DefaultSlot, {
      slots: {
        default: '<strong>Main Content</strong>'
      }
    });
    await expect(component.getByRole('strong')).toContainText('Main Content');
  });

  test('render component as slot', async ({ mount }) => {
    const component = await mount(DefaultSlot, {
      slots: {
        default: '<Button title="Submit" />',
      },
    });
    await expect(component).toContainText('Submit');
  });

  test('render component with multiple slots', async ({ mount }) => {
    const component = await mount(DefaultSlot, {
      slots: {
        default: [
          '<div data-testid="one">One</div>',
          '<div data-testid="two">Two</div>'
        ]
      }
    });
    await expect(component.getByTestId('one')).toContainText('One');
    await expect(component.getByTestId('two')).toContainText('Two');
  })
  
  test('render component with a named slots', async ({ mount }) => {
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
  })
});

test.describe('hooks', () => {
  test('run hooks', async ({ page, mount }) => {
    const messages: string[] = [];
    page.on('console', m => messages.push(m.text()));
    await mount<HooksConfig>(Button, {
      props: {
        title: 'Submit'
      },
      hooksConfig: { route: 'A' }
    });
    expect(messages).toEqual(['Before mount: {\"route\":\"A\"}, app: true', 'After mount el: HTMLButtonElement']);
  })
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
  
  test('unmount multi root component', async ({ mount, page }) => {
    const component = await mount(MultiRoot);
    await expect(page.locator('#root')).toContainText('root 1');
    await expect(page.locator('#root')).toContainText('root 2');
    await component.unmount();
    await expect(page.locator('#root')).not.toContainText('root 1');
    await expect(page.locator('#root')).not.toContainText('root 2');
  })
});

test.describe('router', () => {
  test('render app and navigate to a page', async ({ page, mount }) => {
    const component = await mount(App);
    await expect(component.getByRole('main')).toHaveText('Login');
    await expect(page).toHaveURL('/');
    await component.getByRole('link', { name: 'Dashboard' }).click();
    await expect(component.getByRole('main')).toHaveText('Dashboard');
    await expect(page).toHaveURL('/dashboard');
  });
});
