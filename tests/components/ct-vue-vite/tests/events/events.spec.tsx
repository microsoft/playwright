import { test, expect } from '@playwright/experimental-ct-vue';
import Button from '@/components/Button.vue';
import DefaultSlot from '@/components/DefaultSlot.vue';

test('emit a submit event when the button is clicked', async ({ mount }) => {
  const messages: string[] = [];
  const component = await mount(
    <Button
      title="Submit"
      v-on:submit={(message: string) => {
        messages.push(message);
      }}
    />
  );
  await component.click();
  expect(messages).toEqual(['hello']);
});

test('emit a fallthrough event when the button is double clicked', async ({ mount }) => {
  const messages: string[] = [];
  const component = await mount(
    <Button
      title="Submit"
      v-on:dbclick={(message: string) => {
        messages.push(message)
      }}
    />
  );
  await component.dblclick();
  expect(messages).toEqual(['fallthroughEvent']);
});

test('emit a event when a slot is clicked', async ({ mount }) => {
  let clickFired = false;
  const component = await mount(
    <DefaultSlot>
      <span v-on:click={() => (clickFired = true)}>Main Content</span>
    </DefaultSlot>
  );
  await component.getByText('Main Content').click();
  expect(clickFired).toBeTruthy();
});
