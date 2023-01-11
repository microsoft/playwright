import { test, expect } from '@playwright/experimental-ct-solid';
import Counter from '@/components/Counter';

test('update props without remounting', async ({ mount }) => {
  const component = await mount(<Counter count={9001} />);
  await expect(component.getByTestId('props')).toContainText('9001');

  await component.update(<Counter count={1337} />);
  await expect(component).not.toContainText('9001');
  await expect(component.getByTestId('props')).toContainText('1337');

  /**
   * Ideally toContainText('2') should be toContainText('1')
   * However it seems impossible to update the props, slots or events of a rendered component
   */
  await expect(component.getByTestId('remount-count')).toContainText('2');
});

test('update slots without remounting', async ({ mount }) => {
  const component = await mount(<Counter>Default Slot</Counter>);
  await expect(component).toContainText('Default Slot');

  await component.update(<Counter>Test Slot</Counter>);
  await expect(component).not.toContainText('Default Slot');
  await expect(component).toContainText('Test Slot');

  /**
   * Ideally toContainText('2') should be toContainText('1')
   * However it seems impossible to update the props, slots or events of a rendered component
   */
  await expect(component.getByTestId('remount-count')).toContainText('2');
});

test('update callbacks without remounting', async ({ mount }) => {
  const component = await mount(<Counter />);

  const messages: string[] = [];
  await component.update(
    <Counter
      onClick={(message) => {
        messages.push(message);
      }}
    />
  );
  await component.click();
  expect(messages).toEqual(['hello']);

  /**
   * Ideally toContainText('2') should be toContainText('1')
   * However it seems impossible to update the props, slots or events of a rendered component
   */
  await expect(component.getByTestId('remount-count')).toContainText('2');
});
