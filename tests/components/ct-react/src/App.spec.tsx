import { test, expect } from '@playwright/test';
import App from './App';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(<App></App>);
  await expect(component).toContainText('Learn React');
});

test('should work with function', async ({ mount }) => {
    let clicked = true;
    const component = await mount(<div onClick={() => clicked}>hi</div>);
    await component.click();
    expect(clicked).toBe(true);
})
