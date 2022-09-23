import { test, expect } from '@playwright/experimental-ct-solid';
import Button from './components/Button';
import DefaultChildren from './components/DefaultChildren';
import MultipleChildren from './components/MultipleChildren';
import MultiRoot from './components/MultiRoot';
import EmptyFragment from './components/EmptyFragment';

test.use({ viewport: { width: 500, height: 500 } });

test('render props', async ({ mount }) => {
  const component = await mount(<Button title="Submit" />);
  await expect(component).toContainText('Submit');
});

test('execute callback when the button is clicked', async ({ mount }) => {
  const messages: string[] = [];
  const component = await mount(
    <Button
      title="Submit"
      onClick={(data) => {
        messages.push(data);
      }}
    />
  );
  await component.click();
  expect(messages).toEqual(['hello']);
});

test('render a default child', async ({ mount }) => {
  const component = await mount(
    <DefaultChildren>Main Content</DefaultChildren>
  );
  await expect(component).toContainText('Main Content');
});

test('render multiple children', async ({ mount }) => {
  const component = await mount(
    <DefaultChildren>
      <div id="one">One</div>
      <div id="two">Two</div>
    </DefaultChildren>
  );
  await expect(component.locator('#one')).toContainText('One');
  await expect(component.locator('#two')).toContainText('Two');
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

test('execute callback when a child node is clicked', async ({ mount }) => {
  let clickFired = false;
  const component = await mount(
    <DefaultChildren>
      <span onClick={() => (clickFired = true)}>Main Content</span>
    </DefaultChildren>
  );
  await component.locator('text=Main Content').click();
  expect(clickFired).toBeTruthy();
});

test('run hooks', async ({ page, mount }) => {
  const messages: string[] = [];
  page.on('console', (m) => messages.push(m.text()));
  await mount(<Button title="Submit" />, {
    hooksConfig: {
      route: 'A',
    },
  });
  expect(messages).toEqual(['Before mount: {"route":"A"}', 'After mount']);
});

test('unmount', async ({ page, mount }) => {
  const component = await mount(<Button title="Submit" />);
  await expect(page.locator('#root')).toContainText('Submit');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('Submit');
});

test('unmount a multi root component', async ({ mount, page }) => {
  const component = await mount(<MultiRoot />);
  await expect(page.locator('#root')).toContainText('root 1');
  await expect(page.locator('#root')).toContainText('root 2');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('root 1');
  await expect(page.locator('#root')).not.toContainText('root 2');
});

test('get textContent of the empty fragment', async ({ mount }) => {
  const component = await mount(<EmptyFragment />);
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});
