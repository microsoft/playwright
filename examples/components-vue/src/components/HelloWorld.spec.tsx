import { test, expect } from '@playwright/experimental-ct-vue'

import HelloWorld from './HelloWorld.vue'

test.use({ viewport: { width: 500, height: 500 } })

test('should work', async ({ mount }) => {
  const component = await mount(<HelloWorld msg='Greetings'></HelloWorld>)
  await expect(component).toContainText('Greetings')
})
