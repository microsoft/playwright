import { test, expect } from '@playwright/experimental-ct-angular';
import { ButtonComponent } from '@/components/button.component';
import { EmptyComponent } from '@/components/empty.component';
import { ComponentComponent } from '@/components/component.component';
import { NotInlinedComponent } from '@/components/not-inlined.component';
import { ButtonSignalsComponent } from '@/components/button-signals.component';

test('render inputs', async ({ mount }) => {
  const component = await mount(ButtonComponent, {
    props: {
      title: 'Submit',
    },
  });
  await expect(component).toContainText('Submit');
});

test('render signal-based inputs', async ({ mount }) => {
  const component = await mount(ButtonSignalsComponent, {
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

test('render a component without options', async ({ mount }) => {
  const component = await mount(ComponentComponent);
  await expect(component).toContainText('test');
});

test('render component with not inlined template', async ({ mount }) => {
  const component = await mount(NotInlinedComponent);
  await expect(component).toContainText('Not Inlined');
});
