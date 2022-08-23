import { test, expect } from '@playwright/experimental-ct-vue'

import Button from './components/Button.vue'
import Counter from './components/Counter.vue'
import DefaultSlot from './components/DefaultSlot.vue'
import NamedSlots from './components/NamedSlots.vue'
import MultiRoot from './components/MultiRoot.vue'
import Component from './components/Component.vue'

test.use({ viewport: { width: 500, height: 500 } })

test('props should work', async ({ mount }) => {
  const component = await mount(Button, {
    props: {
      title: 'Submit'
    }
  })
  await expect(component).toContainText('Submit')
})

test('renderer and keep the component instance intact', async ({ mount }) => {
  const component = await mount<{ count: number }>(Counter, {
    props: { 
      count: 9001
    }
  });
  await expect(component.locator('#rerender-count')).toContainText('9001')
  
  await component.rerender({ props: { count: 1337 } })
  await expect(component.locator('#rerender-count')).toContainText('1337')
  
  await component.rerender({ props: { count: 42 } })
  await expect(component.locator('#rerender-count')).toContainText('42')

  await expect(component.locator('#remount-count')).toContainText('1')
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
  await component.click()
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

test('optionless should work', async ({ mount }) => {
  const component = await mount(Component)
  await expect(component).toContainText('test')
})

test('should run hooks', async ({ page, mount }) => {
  const messages = []
  page.on('console', m => messages.push(m.text()))
  await mount(Button, {
    props: {
      title: 'Submit'
    },
    hooksConfig: { route: 'A' }
  })
  expect(messages).toEqual(['Before mount: {\"route\":\"A\"}, app: true', 'After mount el: HTMLButtonElement'])
})

test('should unmount', async ({ page, mount }) => {
  const component = await mount(Button, {
    props: {
      title: 'Submit'
    }
  })
  await expect(page.locator('#root')).toContainText('Submit')
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('Submit');
});

test('unmount a multi root component should work', async ({ mount, page }) => {
  const component = await mount(MultiRoot)
  await expect(page.locator('#root')).toContainText('root 1')
  await expect(page.locator('#root')).toContainText('root 2')
  await component.unmount()
  await expect(page.locator('#root')).not.toContainText('root 1')
  await expect(page.locator('#root')).not.toContainText('root 2')
})
