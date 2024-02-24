import { test, expect } from '@playwright/experimental-ct-react';
import Button from '@/components/Button';
import CheckChildrenProp from '@/components/CheckChildrenProp';
import DefaultChildren from '@/components/DefaultChildren';
import MultipleChildren from '@/components/MultipleChildren';

test('render a default child', async ({ mount }) => {
  const component = await mount(
    <DefaultChildren>Main Content</DefaultChildren>
  );
  await expect(component).toContainText('Main Content');
});

test('render a component as child', async ({ mount }) => {
  const component = await mount(
    <DefaultChildren>
      <Button title="Submit" />
    </DefaultChildren>
  );
  await expect(component).toContainText('Submit');
});

test('render multiple children', async ({ mount }) => {
  const component = await mount(
    <DefaultChildren>
      <div data-testid="one">One</div>
      <div data-testid="two">Two</div>
    </DefaultChildren>
  );
  await expect(component.getByTestId('one')).toContainText('One');
  await expect(component.getByTestId('two')).toContainText('Two');
});

test('render named children', async ({ mount }) => {
  const component = await mount(
    <MultipleChildren>
      <div>Header</div>
      <div>Main Content</div>
      <div>Footer</div>
    </MultipleChildren>
  );
  await expect(component).toContainText('Header');
  await expect(component).toContainText('Main Content');
  await expect(component).toContainText('Footer');
});

test('render string as child', async ({ mount }) => {
  const component = await mount(<DefaultChildren>{'string'}</DefaultChildren>);
  await expect(component).toContainText('string');
});

test('render array as child', async ({ mount }) => {
  const component = await mount(<DefaultChildren>{[<h4>{[4]}</h4>,[[<p>[2,3]</p>]]]}</DefaultChildren>);
  await expect(component.getByRole('heading', { level: 4 })).toHaveText('4');
  await expect(component.getByRole('paragraph')).toHaveText('[2,3]');
});

test('render number as child', async ({ mount }) => {
  const component = await mount(<DefaultChildren>{1337}</DefaultChildren>);
  await expect(component).toContainText('1337');
});

test('absence of children when children prop is not provided', async ({ mount }) => {
  const component = await mount(<CheckChildrenProp />);
  await expect(component).toContainText('No Children');
});
