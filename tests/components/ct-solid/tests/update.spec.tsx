import { test, expect } from '@playwright/experimental-ct-solid';
import Counter from '@/components/Counter';
import DefaultChildren from '@/components/DefaultChildren';

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

test('update child props without remounting', async ({ mount }) => {
  const component = await mount(<DefaultChildren><Counter count={9001} /></DefaultChildren>);
  await expect(component.getByTestId('props')).toContainText('9001');

  await component.update(<DefaultChildren><Counter count={1337} /></DefaultChildren>);
  await expect(component).not.toContainText('9001');
  await expect(component.getByTestId('props')).toContainText('1337');

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

test('update child callbacks without remounting', async ({ mount }) => {
  const component = await mount(<DefaultChildren><Counter /></DefaultChildren>);

  const messages: string[] = [];
  await component.update(
    <DefaultChildren>
      <Counter
        onClick={(message) => {
          messages.push(message);
        }}
      />
    </DefaultChildren>
  );
  await component.getByRole('button').click();
  expect(messages).toEqual(['hello']);

  /**
   * Ideally toContainText('2') should be toContainText('1')
   * However it seems impossible to update the props, slots or events of a rendered component
   */
  await expect(component.getByTestId('remount-count')).toContainText('2');
});

test('update children without remounting', async ({ mount }) => {
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

test('update grandchild without remounting', async ({ mount }) => {
  const component = await mount(
    <DefaultChildren>
      <Counter>Default Slot</Counter>
    </DefaultChildren>
  );
  await expect(component.getByRole('button')).toContainText('Default Slot');

  await component.update(
    <DefaultChildren>
      <Counter>Test Slot</Counter>
    </DefaultChildren>
  );
  await expect(component.getByRole('button')).not.toContainText('Default Slot');
  await expect(component.getByRole('button')).toContainText('Test Slot');

  /**
   * Ideally toContainText('2') should be toContainText('1')
   * However it seems impossible to update the props, slots or events of a rendered component
   */
  await expect(component.getByTestId('remount-count')).toContainText('2');
});
