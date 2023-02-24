import { test, expect } from '@playwright/experimental-ct-angular';
import { ButtonComponent } from '@/components/button.component';
import { EmptyComponent } from '@/components/empty.component';

test('render props', async ({ mount }) => {
  const component = await mount(ButtonComponent, {
    props: {
      title: 'Submit',
    },
  });
  await expect(component).toContainText('Submit');
});

test('get textContent of the empty component', async ({ mount }) => {
  const component = await mount(EmptyComponent);
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});
