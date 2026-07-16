// Example story file. Stories live next to the component they exercise:
// this file is src/components/Button.story.ts for src/components/Button.vue.
// Each named export is one story: a scenario-specific wrapper around the
// component. Wire providers, mock data and event recording here, not in tests.
// Alternatively, write a story as a Button.<scenario>.story.vue single-file
// component — its default export is the story.
import { defineComponent, h, ref } from 'vue';
import Button from './Button.vue';

export const Primary = defineComponent(() => () => h(Button, { title: 'Submit' }));

export const Disabled = defineComponent(() => () => h(Button, { title: 'Submit', disabled: true }));

// Callbacks are asserted through the DOM: record events into visible output.
export const CountsClicks = defineComponent(() => {
  const clicks = ref(0);
  return () => h('div', [
    h(Button, { title: 'Submit', onClick: () => clicks.value++ }),
    h('output', { 'data-testid': 'click-count' }, String(clicks.value)),
  ]);
});
