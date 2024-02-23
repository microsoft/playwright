import { ButtonComponent } from "@/components/button.component";
import { expect, test } from "@playwright/experimental-ct-angular"

test('render a template', async ({ mount }) => {
  const component = await mount('<h1>{{ 1 + 1 }}</h1>');

  await expect(component.getByRole('heading')).toContainText('2');
})

test.skip('render a template with child components', async ({ mount }) => {
  const component = await mount('<app-button title="Click"/>', {
    imports: [ButtonComponent]
  });

  await expect(component.getByRole('button')).toContainText('Title');
})

test.skip('render a template with inputs', async ({ mount }) => {
  const component = await mount('<app-button [title]="title"/>', {
    imports: [ButtonComponent],
    props: {
      title: 'Click',
    }
  });

  await expect(component.getByRole('button')).toContainText('Title');
})

test.skip('render a template with outputs', async ({ mount }) => {
  let _message: string;
  const component = await mount('<app-button (submit)="onSubmit()"/>', {
    imports: [ButtonComponent],
    props: {
      title: 'Click',
      onSubmit(message: string) {
        _message = message;
      }
    }
  });

  await expect(async () => {expect(_message).toBe('hello')}).toPass();
})