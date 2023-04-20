import { test, expect } from '@playwright/experimental-ct-vue';
import Counter from '@/components/Counter.vue';

test('renderer and keep the component instance intact', async ({ mount }) => {
  const component = await mount(<Counter count={9001} />);
  await expect(component.getByTestId('rerender-count')).toContainText('9001');

  await component.update(<Counter count={1337} />);
  await expect(component.getByTestId('rerender-count')).toContainText('1337');

  await component.update(<Counter count={42} />);
  await expect(component.getByTestId('rerender-count')).toContainText('42');

  await expect(component.getByTestId('remount-count')).toContainText('1');
});

test('throw error when updating a native html element', async ({ mount }) => {
  const component = await mount(<div id="1337"></div>);
  
  await expect(async () => {
    await component.update(<div id="9001"></div>);
  }).rejects.toThrowError('Updating a native HTML element is not supported');
});
