import { test, expect } from '@playwright/test'

import DocumentationIcon from './icons/IconDocumentation.vue'
import WelcomeItem from './WelcomeItem.vue'

test.use({ viewport: { width: 500, height: 500 } })

test('should work', async ({ mount }) => {
  const component = await mount(<WelcomeItem>
    <template v-slot:icon>
      <DocumentationIcon />
    </template>
    <template v-slot:heading>
      Documentation
    </template>

    Vue’s
    <a target="_blank" href="https://vuejs.org/">official documentation</a>
    provides you with all information you need to get started.
  </WelcomeItem>)

  await expect(component).toContainText('Documentation')
})
