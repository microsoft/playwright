import { test, expect } from '@playwright/experimental-ct-vue2';
import Counter from '@/components/Counter.vue';

test('update props without remounting', async ({ mount }) => {
  const component = await mount(<Counter count={9001} />);
  await expect(component.getByTestId('props')).toContainText('9001');

  await component.update(<Counter count={1337} />);
  await expect(component).not.toContainText('9001');
  await expect(component.getByTestId('props')).toContainText('1337');

  await expect(component.getByTestId('remount-count')).toContainText('1');
});

test('update event listeners without remounting', async ({ mount }) => {
  const messages: string[] = [];
  const component = await mount(<Counter />);

  await component.update(
    <Counter
      v-on:submit={(count: string) => {
        messages.push(count);
      }}
    />
  );
  await component.click();
  expect(messages).toEqual(['hello']);

  await expect(component.getByTestId('remount-count')).toContainText('1');
});

test('update slots without remounting', async ({ mount }) => {
  const component = await mount(<Counter>Default Slot</Counter>);
  await expect(component).toContainText('Default Slot');

  await component.update(
    <Counter>
      <template v-slot:main>Test Slot</template>
    </Counter>
  );
  await expect(component).not.toContainText('Default Slot');
  await expect(component).toContainText('Test Slot');

  await expect(component.getByTestId('remount-count')).toContainText('1');
});

test('throw error when updating a native html element', async ({ mount }) => {
  const component = await mount(<div id="1337"></div>);
  
  await expect(async () => {
    await component.update(<div id="9001"></div>);
  }).rejects.toThrowError('Updating a native HTML element is not supported');
});
