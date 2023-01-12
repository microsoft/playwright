import { test, expect } from '@playwright/experimental-ct-vue';
import Counter from '@/components/Counter.vue';

test('renderer and keep the component instance intact', async ({ mount }) => {
  const component = await mount<{ count: number }>(Counter, {
    props: {
      count: 9001,
    },
  });
  await expect(component.locator('#rerender-count')).toContainText('9001');

  await component.update({ props: { count: 1337 } });
  await expect(component.locator('#rerender-count')).toContainText('1337');

  await component.update({ props: { count: 42 } });
  await expect(component.locator('#rerender-count')).toContainText('42');

  await expect(component.locator('#remount-count')).toContainText('1');
});
