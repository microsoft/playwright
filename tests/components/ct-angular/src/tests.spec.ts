import { test, expect } from '@playwright/experimental-ct-angular';
import { ButtonComponent } from './components/button.component';

test('render props', async ({ mount }) => {
  const component = await mount(ButtonComponent, {
    props: {
      title: 'Submit'
    }
  });
  await expect(component).toContainText('Submit');
});

test('unmount', async ({ page, mount }) => {
  const component = await mount(ButtonComponent, {
    props: {
      title: 'Submit'
    }
  });
  await expect(page.locator('#root')).toContainText('Submit');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('Submit');
});
