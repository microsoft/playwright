import { test, expect } from '@playwright/experimental-ct-vue/test'

import Counter from './Counter.vue'

test.use({ viewport: { width: 500, height: 500 } })

test('should work', async ({ mount }) => {
  const values = []
  const component = await mount(Counter, {
    on: {
      changed: counter => values.push(counter)
    }
  })
  await component.click()
  expect(values).toEqual([1])
  await component.click()
  expect(values).toEqual([1, 2])
  await component.click()
  expect(values).toEqual([1, 2, 3])
})
