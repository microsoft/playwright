import { test, expect } from '@playwright/experimental-ct-vue'
import App from './App.vue';
import Button from './components/Button.vue'
import Counter from './components/Counter.vue'
import DefaultSlot from './components/DefaultSlot.vue'
import NamedSlots from './components/NamedSlots.vue'
import MultiRoot from './components/MultiRoot.vue'
import EmptyTemplate from './components/EmptyTemplate.vue'
import type { HooksConfig } from '../playwright'

test.use({ viewport: { width: 500, height: 500 } })

test('render props', async ({ mount }) => {
  const component = await mount(<Button title="Submit" />)
  await expect(component).toContainText('Submit')
})

test('render attributes', async ({ mount }) => {
  const component = await mount(<Button class="primary" title="Submit" />)
  await expect(component).toHaveClass('primary');
});

test('update props without remounting', async ({ mount }) => {
  const component = await mount(<Counter count={9001} />)
  await expect(component.locator('#props')).toContainText('9001')

  await component.update(<Counter count={1337} />)
  await expect(component).not.toContainText('9001')
  await expect(component.locator('#props')).toContainText('1337')

  await expect(component.locator('#remount-count')).toContainText('1')
})

test('update event listeners without remounting', async ({ mount }) => {
  const component = await mount(<Counter />)

  const messages: string[] = []
  await component.update(<Counter v-on:submit={(count: string) => { 
    messages.push(count) 
  }} />)
  await component.click();
  expect(messages).toEqual(['hello'])
  
  await expect(component.locator('#remount-count')).toContainText('1')
})

test('update slots without remounting', async ({ mount }) => {
  const component = await mount(<Counter>Default Slot</Counter>)
  await expect(component).toContainText('Default Slot')

  await component.update(<Counter>
    <template v-slot:main>Test Slot</template>
  </Counter>)
  await expect(component).not.toContainText('Default Slot')
  await expect(component).toContainText('Test Slot')

  await expect(component.locator('#remount-count')).toContainText('1')
})

test('emit an submit event when the button is clicked', async ({ mount }) => {
  const messages: string[] = []
  const component = await mount(<Button 
    title="Submit"
    v-on:submit={(data: string) => {
      messages.push(data)
    }} 
  />)
  await component.click()
  expect(messages).toEqual(['hello'])
})

test('render a default slot', async ({ mount }) => {
  const component = await mount(<DefaultSlot>
    <strong>Main Content</strong>
  </DefaultSlot>)
  await expect(component.getByRole('strong')).toContainText('Main Content')
})

test('render a component as slot', async ({ mount }) => {
  const component = await mount(<DefaultSlot>
    <Button title="Submit" />
  </DefaultSlot>)
  await expect(component).toContainText('Submit')
});

test('render a component with multiple slots', async ({ mount }) => {
  const component = await mount(<DefaultSlot>
    <div data-testid="one">One</div>
    <div data-testid="two">Two</div>
  </DefaultSlot>)
  await expect(component.getByTestId('one')).toContainText('One')
  await expect(component.getByTestId('two')).toContainText('Two')
})

test('render a component with a named slot', async ({ mount }) => {
  const component = await mount(<NamedSlots>
    <template v-slot:header>
      Header
    </template>
    <template v-slot:main>
      Main Content
    </template>
    <template v-slot:footer>
      Footer
    </template>
  </NamedSlots>);
  await expect(component).toContainText('Header')
  await expect(component).toContainText('Main Content')
  await expect(component).toContainText('Footer')
})

test('emit a event when a slot is clicked', async ({ mount }) => {
  let clickFired = false;
  const component = await mount(<DefaultSlot>
    <span v-on:click={() => clickFired = true}>Main Content</span>
  </DefaultSlot>);
  await component.locator('text=Main Content').click();
  expect(clickFired).toBeTruthy();
})

test('run hooks', async ({ page, mount }) => {
  const messages: string[] = []
  page.on('console', m => messages.push(m.text()))
  await mount<HooksConfig>(<Button title="Submit" />, {
    hooksConfig: { route: 'A' }
  })
  expect(messages).toEqual(['Before mount: {\"route\":\"A\"}, app: true', 'After mount el: HTMLButtonElement'])
})

test('unmount a multi root component', async ({ mount, page }) => {
  const component = await mount(<MultiRoot />)
  await expect(page.locator('#root')).toContainText('root 1')
  await expect(page.locator('#root')).toContainText('root 2')
  await component.unmount()
  await expect(page.locator('#root')).not.toContainText('root 1')
  await expect(page.locator('#root')).not.toContainText('root 2')
})

test('get textContent of the empty template', async ({ mount }) => {
  const component = await mount(<EmptyTemplate />);
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});

test('render app and navigate to a page', async ({ page, mount }) => {
  const component = await mount(App);
  await expect(component.getByRole('main')).toHaveText('Login');
  await expect(page).toHaveURL('/');
  await component.getByRole('link', { name: 'Dashboard' }).click();
  await expect(component.getByRole('main')).toHaveText('Dashboard');
  await expect(page).toHaveURL('/dashboard');
});
