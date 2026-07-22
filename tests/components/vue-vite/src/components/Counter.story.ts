import { defineComponent, h, ref } from 'vue';
import Counter from './Counter.vue';

export const Default = defineComponent(
    (props: { count?: number }) => () => h(Counter, { count: props.count }),
    { props: ['count'] },
);

export const WithSlot = defineComponent(
    (props: { slotText?: string }) => () => h(Counter, {}, { default: () => props.slotText ?? 'Default Slot' }),
    { props: ['slotText'] },
);

export const RecordsSubmit = defineComponent(() => {
  const submitted = ref('');
  return () => h('div', [
    h(Counter, { onSubmit: (message: string) => submitted.value = message }),
    h('form', { hidden: true }, [
      h('input', { 'data-testid': 'submitted', readonly: true, value: submitted.value }),
    ]),
  ]);
});
