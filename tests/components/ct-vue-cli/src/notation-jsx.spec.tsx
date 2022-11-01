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
import Button from './components/Button.vue';
import Counter from './components/Counter.vue';
import DefaultSlot from './components/DefaultSlot.vue';
import NamedSlots from './components/NamedSlots.vue';
import MultiRoot from './components/MultiRoot.vue';
import EmptyTemplate from './components/EmptyTemplate.vue';
import type { HooksConfig } from '../playwright';

test.use({ viewport: { width: 500, height: 500 }, colorScheme: 'dark' });

test.describe('render', () => {
  test('render props', async ({ mount }) => {
    const component = await mount(<Button title="Submit" />);
    await expect(component).toContainText('Submit');
  });

  test('render empty component', async ({ mount }) => {
    const component = await mount(<EmptyTemplate />);
    expect(await component.allTextContents()).toEqual(['']);
    expect(await component.textContent()).toBe('');
    await expect(component).toHaveText('');
  });
});

test.describe('update', () => {
  test('renderer and keep the component instance intact', async ({ mount }) => {
    const component = await mount(<Counter count={9001} />);
    await expect(component.getByTestId('rerender-count')).toContainText('9001');
    
    await component.update(<Counter count={1337} />);
    await expect(component.getByTestId('rerender-count')).toContainText('1337');
    
    await component.update(<Counter count={42} />);
    await expect(component.getByTestId('rerender-count')).toContainText('42');
  
    await expect(component.getByTestId('remount-count')).toContainText('1');
  });
});

test.describe('events', () => {
  test('emit submit event when the button is clicked', async ({ mount }) => {
    const messages: string[] = [];
    const component = await mount(<Button 
      title="Submit"
      v-on:submit={(data: string) => {
        messages.push(data)
      }}
    />);
    await component.click();
    expect(messages).toEqual(['hello']);
  });

  test('emit event when slot is clicked', async ({ mount }) => {
    let clickFired = false;
    const component = await mount(<DefaultSlot>
      <button v-on:click={() => clickFired = true}>Submit</button>
    </DefaultSlot>);
    await component.getByRole('button', { name: 'Submit' }).click();
    expect(clickFired).toBeTruthy();
  });
});

test.describe('slots', () => {
  test('default slot', async ({ mount }) => {
    const component = await mount(<DefaultSlot>
      <strong>Main Content</strong>
    </DefaultSlot>);
    await expect(component.getByRole('strong')).toContainText('Main Content');
  });

  test('component as slot', async ({ mount }) => {
    const component = await mount(<DefaultSlot>
      <Button title="Submit" />
    </DefaultSlot>);
    await expect(component.getByRole('button')).toContainText('Submit');
  });
  
  test('multiple slots', async ({ mount }) => {
    const component = await mount(<DefaultSlot>
      <div data-testid="one">One</div>
      <div data-testid="two">Two</div>
    </DefaultSlot>);
    await expect(component.getByTestId('one')).toContainText('One');
    await expect(component.getByTestId('two')).toContainText('Two');
  });

  test('named slots', async ({ mount }) => {
    const component = await mount(<NamedSlots>
      <template v-slot:header>Header</template>
      <template v-slot:main>Main Content</template>
      <template v-slot:footer>Footer</template>
    </NamedSlots>);
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
      hooksConfig: { route: 'A' }
    });
    expect(messages).toEqual(['Before mount: {\"route\":\"A\"}, app: true', 'After mount el: HTMLButtonElement']);
  });
});

test.describe('unmount', () => {
  test('unmount', async ({ page, mount }) => {
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
