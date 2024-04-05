import { defineComponent, h } from 'vue';

export const Story = defineComponent(
  (props) => {
    return () => h('div', props.title);
  },
  {
    props: ['title'],
  }
);
