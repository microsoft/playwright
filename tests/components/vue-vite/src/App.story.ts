import { defineComponent, h } from 'vue';
import App from './App.vue';

// The router plugin is installed by the gallery (playwright/gallery/main.ts) with memory
// history — the gallery is the equivalent of the app's own bootstrap.
export const Routing = defineComponent(() => () => h(App));
