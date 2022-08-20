import { test, expect } from '@playwright/experimental-ct-solid'
import Button from './components/Button';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(<Button />);
  await expect(component).toContainText('Submit');
});
