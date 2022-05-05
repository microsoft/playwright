import { test, expect } from '@playwright/test'

import HelloWorld from './HelloWorld.vue'

test.use({ viewport: { width: 500, height: 500 } })

test('should work', async ({ mount }) => {
  const component = await mount(HelloWorld, {
    props: {
      msg: 'Greetings'
    }
  });
  await expect(component).toContainText('Greetings')
})
