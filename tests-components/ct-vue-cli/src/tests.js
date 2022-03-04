import { createApp, setDevtoolsHook, h } from 'vue'
import register from '@playwright/ct-vue/register'

import Button from './components/Button.vue'
import DefaultSlot from './components/DefaultSlot.vue'
import NamedSlots from './components/NamedSlots.vue'

register({
  Button,
  DefaultSlot,
  NamedSlots
}, {
  // This is only needed if you are using Vue CLI (webpack).
  // Vite does not need this line.
  createApp,
  setDevtoolsHook,
  h
})
