import { test, expect } from '@playwright/experimental-ct-vue2';
import Button from '@/components/Button.vue';
import DefaultSlot from '@/components/DefaultSlot.vue';
import NamedSlots from '@/components/NamedSlots.vue';

test('render a default slot', async ({ mount }) => {
  const component = await mount(<DefaultSlot>Main Content</DefaultSlot>);
  await expect(component).toContainText('Main Content');
});

test('render a component as slot', async ({ mount }) => {
  const component = await mount(
    <DefaultSlot>
      <Button title="Submit" />
    </DefaultSlot>
  );
  await expect(component).toContainText('Submit');
});

test('render a component with multiple slots', async ({ mount }) => {
  const component = await mount(
    <DefaultSlot>
      <div data-testid="one">One</div>
      <div data-testid="two">Two</div>
    </DefaultSlot>
  );
  await expect(component.getByTestId('one')).toContainText('One');
  await expect(component.getByTestId('two')).toContainText('Two');
});

test('render a component with a named slot', async ({ mount }) => {
  const component = await mount(
    <NamedSlots>
      <template v-slot:header>Header</template>
      <template v-slot:main>Main Content</template>
      <template v-slot:footer>Footer</template>
    </NamedSlots>
  );
  await expect(component).toContainText('Header');
  await expect(component).toContainText('Main Content');
  await expect(component).toContainText('Footer');
});

test('render array as child', async ({ mount }) => {
  const component = await mount(<DefaultSlot>{[<h4>{[4]}</h4>,[[<p>[2,3]</p>]]]}</DefaultSlot>);
  await expect(component.getByRole('heading', { level: 4 })).toHaveText('4');
  await expect(component.getByRole('paragraph')).toHaveText('[2,3]');
});
