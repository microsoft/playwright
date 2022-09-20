import { test, expect } from '@playwright/experimental-ct-vue'
import Button from './components/Button.vue'
import Counter from './components/Counter.vue'
import DefaultSlot from './components/DefaultSlot.vue'
import NamedSlots from './components/NamedSlots.vue'
import MultiRoot from './components/MultiRoot.vue'
import EmptyTemplate from './components/EmptyTemplate.vue'

test.use({ viewport: { width: 500, height: 500 } })

test('render props', async ({ mount }) => {
  const component = await mount(<Button title="Submit" />)
  await expect(component).toContainText('Submit')
})

test('renderer and keep the component instance intact', async ({ mount }) => {
  const component = await mount(<Counter count={9001} />);
  await expect(component.locator('#rerender-count')).toContainText('9001')

  await component.rerender({ props: { count: 1337 } })
  await expect(component.locator('#rerender-count')).toContainText('1337')

  await component.rerender({ props: { count: 42 } })
  await expect(component.locator('#rerender-count')).toContainText('42')

  await expect(component.locator('#remount-count')).toContainText('1')
})

test('emit an submit event when the button is clicked', async ({ mount }) => {
  const messages = []
  const component = await mount(<Button title='Submit' v-on:submit={data => {
    messages.push(data)
  }}></Button>)
  await component.click()
  expect(messages).toEqual(['hello'])
})

test('render a default slot', async ({ mount }) => {
  const component = await mount(<DefaultSlot>
    Main Content
  </DefaultSlot>)
  await expect(component).toContainText('Main Content')
})

test('render a component with multiple slots', async ({ mount }) => {
  const component = await mount(<DefaultSlot>
    <div id="one">One</div>
    <div id="two">Two</div>
  </DefaultSlot>)
  await expect(component.locator('#one')).toContainText('One')
  await expect(component.locator('#two')).toContainText('Two')
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
  const messages = []
  page.on('console', m => messages.push(m.text()))
  await mount(<Button title="Submit" />, {
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
