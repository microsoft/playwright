import { test, expect } from '@playwright/experimental-ct-vue'
import { DelayedData } from './DelayedData';

test('toHaveText works on delayed data', async ({ mount }) => {
  const component = await mount(<DelayedData data='complete' />);
  await expect(component).toHaveText('complete');
});
