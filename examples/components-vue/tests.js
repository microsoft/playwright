import register from '@playwright/experimental-ct-vue/register'

import Counter from './src/components/Counter.vue'
import DocumentationIcon from './src/components/icons/IconDocumentation.vue'
import HelloWorld from './src/components/HelloWorld.vue'
import NamedSlots from './src/components/NamedSlots.vue'
import TheWelcome from './src/components/TheWelcome.vue'
import WelcomeItem from './src/components/WelcomeItem.vue'

register({
  Counter,
  DocumentationIcon,
  HelloWorld,
  NamedSlots,
  TheWelcome,
  WelcomeItem,
})
