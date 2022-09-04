import { expectType, expectAssignable, expectError } from 'tsd';
import { test } from '@playwright/experimental-ct-vue';
import { defineComponent } from 'vue';
import { type Locator } from '@playwright/test';

const Component = defineComponent({
  props: {
    foo: {type: Number, default: 42},
    bar: {type: String, default: '1337'},
  },
});

test('options api', async ({ mount }) => {
  // @ts-expect-error
  expectError(mount<{ count: number }>(Component));
  // @ts-expect-error
  expectError(mount<{ count: number }>(Component, {} ));
  // @ts-expect-error
  expectError(mount<{ count: number }>(Component, { props: {} }));
  // @ts-expect-error
  expectError(mount<{ count: number }>(Component, { props: { count: '1337 '} }));

  // expectType(mount<{ count?: number }>(Component));
  // expectType(mount<{ count?: number }>(Component, {}));
  expectType(mount<{ count?: number }>(Component, { props: {} }));
  expectType(mount<{ count?: number }>(Component, { props: { count: 1337 } }));

  expectAssignable<Locator & { 
    unmount(): Promise<void>;
    rerender(options: { props: { count: number } }): Promise<void>;
  }>(await mount<{ count: number }>(Component, { props: { count: 1337 } }));
  expectAssignable<Locator & { 
    unmount(): Promise<void>;
    rerender(options: { props: Record<string, unknown> }): Promise<void>;
  }>(await mount(Component));
});
