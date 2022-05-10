import { test, expect } from '@playwright/experimental-ct-react';

test('should marshall events', async ({ mount }) => {
  let event: any;
  const component = await mount(<button onClick={e => event = e }>Submit</button>);
  await component.click();
  expect(event).toEqual(expect.objectContaining({
    type: 'click',
    pageX: expect.any(Number),
    pageY: expect.any(Number),
    ctrlKey: false,
    isTrusted: true,
  }));
});
