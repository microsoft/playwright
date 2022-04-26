import { test, expect } from '@playwright/experimental-ct-vue/test'

import NamedSlots from './NamedSlots.vue'

test.use({ viewport: { width: 500, height: 500 } })

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
