// Example story file. Stories live next to the component they exercise:
// this file is src/components/Button.story.ts for src/components/Button.vue.
// Each named export is one story: a scenario-specific wrapper around the
// component. Wire providers, mock data, state and callbacks here, not in tests.
// Alternatively, write a story as a Button.<scenario>.story.vue single-file
// component — its default export is the story.
import { defineComponent, h, ref } from 'vue';
import Button from './Button.vue';

export const Primary = defineComponent(() => () => h(Button, { title: 'Submit' }));

export const Disabled = defineComponent(() => () => h(Button, { title: 'Submit', disabled: true }));

// The story owns the state and provides the callbacks. Record the state into
// a hidden form for the test to assert on.
export const CountsClicks = defineComponent(() => {
  const clicks = ref(0);
  return () => h('div', [
    h(Button, { title: 'Submit', onClick: () => clicks.value++ }),
    h('form', { hidden: true }, [
      h('input', { 'data-testid': 'click-count', readonly: true, value: String(clicks.value) }),
    ]),
  ]);
});
