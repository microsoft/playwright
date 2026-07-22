import { defineComponent, h } from 'vue';
import EmptyTemplate from './EmptyTemplate.vue';
import MultiRoot from './MultiRoot.vue';

export const Empty = defineComponent(() => () => h(EmptyTemplate));

export const TwoRoots = defineComponent(() => () => h(MultiRoot));
