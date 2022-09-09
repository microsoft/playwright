import { test, expect } from '@playwright/experimental-ct-vue'
import Button from './components/Button.vue'
import Counter from './components/Counter.vue'
import DefaultSlot from './components/DefaultSlot.vue'
import NamedSlots from './components/NamedSlots.vue'
import MultiRoot from './components/MultiRoot.vue'

test.use({ viewport: { width: 500, height: 500 } })

test('props should work', async ({ mount }) => {
  const component = await mount(<Button title="Submit" />)
  await expect(component).toContainText('Submit')
})

test('renderer updates props without remounting', async ({ mount }) => {
  const component = await mount(<Counter count={9001} />)
  await expect(component.locator('#props')).toContainText('9001')

  await component.rerender(<Counter count={1337} />)
  await expect(component).not.toContainText('9001')
  await expect(component.locator('#props')).toContainText('1337')

  await expect(component.locator('#remount-count')).toContainText('1')
})

test('renderer updates event listeners without remounting', async ({ mount }) => {
  const component = await mount(<Counter />)

  const messages = []
  await component.rerender(<Counter v-on:submit={count => { 
    messages.push(count) 
  }} />)
  await component.click();
  expect(messages).toEqual(['hello'])
  
  await expect(component.locator('#remount-count')).toContainText('1')
})

test('renderer updates slots without remounting', async ({ mount }) => {
  const component = await mount(<Counter>Default Slot</Counter>)
  await expect(component).toContainText('Default Slot')

  await component.rerender(<Counter>
    <template v-slot:main>Test Slot</template>
  </Counter>)
  await expect(component).not.toContainText('Default Slot')
  await expect(component).toContainText('Test Slot')

  await expect(component.locator('#remount-count')).toContainText('1')
})

test('event should work', async ({ mount }) => {
  const messages = []
  const component = await mount(<Button title='Submit' v-on:submit={data => {
    messages.push(data)
  }}></Button>)
  await component.click()
  expect(messages).toEqual(['hello'])
})

test('default slot should work', async ({ mount }) => {
  const component = await mount(<DefaultSlot>
    Main Content
  </DefaultSlot>)
  await expect(component).toContainText('Main Content')
})

test('multiple slots should work', async ({ mount }) => {
  const component = await mount(<DefaultSlot>
    <div id="one">One</div>
    <div id="two">Two</div>
  </DefaultSlot>)
  await expect(component.locator('#one')).toContainText('One')
  await expect(component.locator('#two')).toContainText('Two')
})

test('named slots should work', async ({ mount }) => {
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

test('slot should emit events', async ({ mount }) => {
  let clickFired = false;
  const component = await mount(<DefaultSlot>
    <span v-on:click={() => clickFired = true}>Main Content</span>
  </DefaultSlot>);
  await component.locator('text=Main Content').click();
  expect(clickFired).toBeTruthy();
})

test('should run hooks', async ({ page, mount }) => {
  const messages = []
  page.on('console', m => messages.push(m.text()))
  await mount(<Button title="Submit" />, {
    hooksConfig: { route: 'A' }
  })
  expect(messages).toEqual(['Before mount: {\"route\":\"A\"}, app: true', 'After mount el: HTMLButtonElement'])
})

test('unmount a multi root component should work', async ({ mount, page }) => {
  const component = await mount(<MultiRoot />)

  await expect(page.locator('#root')).toContainText('root 1')
  await expect(page.locator('#root')).toContainText('root 2')

  await component.unmount()

  await expect(page.locator('#root')).not.toContainText('root 1')
  await expect(page.locator('#root')).not.toContainText('root 2')
})
