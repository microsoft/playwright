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
import EmptyTemplate from './components/EmptyTemplate.vue';
import type { hooksConfig } from '../playwright';

test.use({ viewport: { width: 500, height: 500 }, colorScheme: 'dark' });

test.describe('render', () => {
  test('render props', async ({ mount }) => {
    const component = await mount(<Button title="Submit" />);
    await expect(component).toContainText('Submit');
  });
  
  test('render attributes', async ({ mount }) => {
    const component = await mount(<Button class="primary" title="Submit" />);
    await expect(component).toHaveClass('primary');
  });

  test('render empty component', async ({ mount }) => {
    const component = await mount(<EmptyTemplate />);
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
  
  test('update event listeners without remounting', async ({ mount }) => {
    const messages: string[] = [];
    const component = await mount(<Counter />);
  
    await component.update(<Counter 
      v-on:submit={(count: string) => { 
        messages.push(count) 
      }}
    />);
    await component.click();
    expect(messages).toEqual(['hello']);
    
    await expect(component.getByTestId('remount-count')).toContainText('1');
  });
  
  test('update slots without remounting', async ({ mount }) => {
    const component = await mount(<Counter>Default Slot</Counter>);
    await expect(component.getByTestId('slots')).toContainText('Default Slot');
  
    await component.update(<Counter>
      <template v-slot:main>Test Slot</template>
    </Counter>);
    await expect(component.getByTestId('slots')).not.toContainText('Default Slot');
    await expect(component.getByTestId('slots')).toContainText('Test Slot');
  
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
  })

  test('component as slot', async ({ mount }) => {
    const component = await mount(<DefaultSlot>
      <Button title="Submit" />
    </DefaultSlot>);
    await expect(component).toContainText('Submit');
  });

  test('component with multiple slots', async ({ mount }) => {
    const component = await mount(<DefaultSlot>
      <div data-testid="one">One</div>
      <div data-testid="two">Two</div>
    </DefaultSlot>);
    await expect(component.getByTestId('one')).toContainText('One');
    await expect(component.getByTestId('two')).toContainText('Two');
  });

  test('component with named slots', async ({ mount }) => {
    const component = await mount(<NamedSlots>
      <template v-slot:header>Header</template>
      <template v-slot:main>Main Content</template>
      <template v-slot:footer>Footer</template>
    </NamedSlots>);
    await expect(component).toContainText('Header');
    await expect(component).toContainText('Main Content');
    await expect(component).toContainText('Footer');
  });
});

test.describe('hooks', () => {
  test('run hooks', async ({ page, mount }) => {
    const messages: string[] = [];
    page.on('console', m => messages.push(m.text()));
    await mount<hooksConfig>(<Button title="Submit" />, {
      hooksConfig: { route: 'A' }
    });
    expect(messages).toEqual(['Before mount: {\"route\":\"A\"}', 'After mount el: HTMLButtonElement']);
  });
});

test.describe('unmount', () => {
  test('unmount', async ({ page, mount }) => {
    const component = await mount(<Button title="Submit" />);
    await expect(page.locator('#root')).toContainText('Submit');
    await component.unmount();
    await expect(page.locator('#root')).not.toContainText('Submit');
  });
});
