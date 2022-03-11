import { test, expect } from '@playwright/ct-vue/test'

import Button from './components/Button.vue'
import DefaultSlot from './components/DefaultSlot.vue'
import NamedSlots from './components/NamedSlots.vue'

test.use({ viewport: { width: 500, height: 500 } })

test('props should work', async ({ mount }) => {
  const component = await mount(Button, {
    props: {
      title: 'Submit'
    }
  })
  await expect(component).toContainText('Submit')
})

test('event should work', async ({ mount }) => {
  const messages = []
  const component = await mount(Button, {
    props: {
      title: 'Submit'
    },
    on: {
      submit: data => messages.push(data)
    }
  })
  await component.locator('button').click()
  expect(messages).toEqual(['hello'])
})

test('default slot should work', async ({ mount }) => {
  const component = await mount(DefaultSlot, {
    slots: {
      default: 'Main Content'
    }
  })
  await expect(component).toContainText('Main Content')
})

test('multiple slots should work', async ({ mount }) => {
  const component = await mount(DefaultSlot, {
    slots: {
      default: ['one', 'two']
    }
  })
  await expect(component).toContainText('one')
  await expect(component).toContainText('two')
})

test('named slots should work', async ({ mount }) => {
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
