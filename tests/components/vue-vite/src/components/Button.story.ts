// Each named export is one story: a scenario-specific wrapper around the component.
// The story owns the state and the callbacks, recording emitted payloads into a hidden
// form for the test to assert on.
import { defineComponent, h, ref } from 'vue';
import Button from './Button.vue';

export const Submit = defineComponent(() => () => h(Button, { title: 'Submit' }));

export const WithTitle = defineComponent(
    (props: { title?: string }) => () => h(Button, { title: props.title ?? 'Submit' }),
    { props: ['title'] },
);

export const RecordsEvents = defineComponent(() => {
  const submitted = ref('');
  const fallthrough = ref('');
  return () => h('div', [
    h(Button, {
      title: 'Submit',
      onSubmit: (message: string) => submitted.value = message,
      dbclick: (message: string) => fallthrough.value = message,
    }),
    h('form', { hidden: true }, [
      h('input', { 'data-testid': 'submitted', readonly: true, value: submitted.value }),
      h('input', { 'data-testid': 'fallthrough', readonly: true, value: fallthrough.value }),
    ]),
  ]);
});
