import { test, expect } from '@playwright/experimental-ct-vue';
import MultiProps from '@/components/MultiProps.vue';

test('render a props', async ({ mount }) => {
  const component = await mount(
  <MultiProps tNumber={42} tString="one" tNullable={null} tObject={{foo: 12}} tArray={[ 5, 6, 7]} ></MultiProps>
  );
  await expect(component.getByTestId('propsTNumber')).toContainText('42');
  await expect(component.getByTestId('propsTString')).toContainText('one');
  await expect(component.getByTestId('propsTNullable')).toContainText('nullValue');
  await expect(component.getByTestId('propsTObject')).toContainText('12');
  await expect(component.getByTestId('propsTArray')).toContainText('3');
});
