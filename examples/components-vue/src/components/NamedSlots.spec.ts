import { test, expect } from '@playwright/experimental-ct-vue'

import NamedSlots from './NamedSlots.vue'

test.use({ viewport: { width: 500, height: 500 } })

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
