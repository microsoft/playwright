import { test, expect } from '@playwright/experimental-ct-vue';
import Counter from '@/components/Counter.vue';

test('renderer and keep the component instance intact', async ({ mount }) => {
  const component = await mount(<Counter count={9001} />);
  await expect(component.locator('#rerender-count')).toContainText('9001');

  await component.update(<Counter count={1337} />);
  await expect(component.locator('#rerender-count')).toContainText('1337');

  await component.update(<Counter count={42} />);
  await expect(component.locator('#rerender-count')).toContainText('42');

  await expect(component.locator('#remount-count')).toContainText('1');
});
