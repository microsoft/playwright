import { expectAssignable } from 'tsd';
import { test } from '@playwright/experimental-ct-vue';
import Component from './components/Component.vue';
import { type Locator } from '@playwright/test';
import React from 'react';

test('options api', async ({ mount }) => {
  const component = await mount(<Component />);

  expectAssignable<Locator & { 
      unmount(): Promise<void>,
      rerender(options: { props: { count: number } }): Promise<void>;
    }>(component);
});