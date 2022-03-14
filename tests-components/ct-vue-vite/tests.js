import register from '@playwright/experimental-ct-vue/register'

import Button from './src/components/Button.vue'
import DefaultSlot from './src/components/DefaultSlot.vue'
import NamedSlots from './src/components/NamedSlots.vue'

register({
  Button,
  DefaultSlot,
  NamedSlots
})
