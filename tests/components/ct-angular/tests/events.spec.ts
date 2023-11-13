import { test, expect } from '@playwright/experimental-ct-angular';
import { ButtonComponent } from '@/components/button.component';
import { OutputComponent } from '@/components/output.component';

test('emit an submit event when the button is clicked', async ({ mount }) => {
  const messages: string[] = [];
  const component = await mount(ButtonComponent, {
    props: {
      title: 'Submit',
    },
    on: {
      submit: (data: string) => messages.push(data),
    },
  });
  await component.click();
  expect(messages).toEqual(['hello']);
});

test('replace existing listener when new listener is set', async ({
  mount,
}) => {
  test.skip(true, '🚧 work in progress');

  let count = 0;

  const component = await mount(ButtonComponent, {
    props: {
      title: 'Submit',
    },
    on: {
      submit() {
        count++;
      },
    },
  });

  component.update({
    on: {
      submit() {
        count++;
      },
    },
  });

  await component.click();
  expect(count).toBe(1);
});

test('unsubscribe from events when the component is unmounted', async ({
  mount,
  page,
}) => {
  test.skip(true, '🚧 work in progress');
  const component = await mount(OutputComponent, {
    on: {
      answerChange() {},
    },
  });

  await component.unmount();

  /* Check that the output observable had been unsubscribed from
   * as it sets a global variable `hasUnusbscribed` to true
   * when it detects unsubscription. Cf. OutputComponent. */
  expect(await page.evaluate(() => (window as any).hasUnsubscribed)).toBe(true);
});
