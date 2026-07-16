// Example component test. `mount` is a built-in fixture of @playwright/test.
import { test, expect } from '@playwright/test';

test('renders primary button', async ({ mount }) => {
  const component = await mount('components/Button/Primary');
  await expect(component).toHaveText('Submit');
});

test('disabled button is disabled', async ({ mount }) => {
  const component = await mount('components/Button/Disabled');
  await expect(component).toBeDisabled();
});

test('button click fires callback', async ({ mount, page }) => {
  const component = await mount('components/Button/CountsClicks');
  await component.getByRole('button').click();
  await expect(page.getByTestId('click-count')).toHaveText('1');
});
