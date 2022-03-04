import register from '@playwright/ct-vue/register'

import Button from './components/Button.vue'
import DefaultSlot from './components/DefaultSlot.vue'
import NamedSlots from './components/NamedSlots.vue'

register({
  Button,
  DefaultSlot,
  NamedSlots
})
