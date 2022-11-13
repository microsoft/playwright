import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';
import { createTestingPinia } from '@pinia/testing';
import type { StoreState } from 'pinia';
import type { useStore } from '../src/store';
import { router } from '../src/router';
import Button from '../src/components/Button.vue';
import '../src/assets/index.css';

export type HooksConfig = {
  route?: string;
  store?: {
    main: StoreState<ReturnType<typeof useStore>>;
  }
}

beforeMount<HooksConfig>(async ({ app, hooksConfig }) => {
  app.use(router as any); // TODO: remove any and fix the various installed conflicting Vue versions
  app.component('Button', Button);

  createTestingPinia({
    initialState: hooksConfig?.store,
    stubActions: false, // if you want to mock api calls, use http intercepting instead
    createSpy(args) {
      console.log('spy', args)
      return () => console.log('spy-returns')
    },
  });

  console.log(`Before mount: ${JSON.stringify(hooksConfig)}, app: ${!!app}`);
});

afterMount<HooksConfig>(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
