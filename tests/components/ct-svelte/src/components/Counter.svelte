<script>
import { update, remountCount } from '../store'
import { createEventDispatcher } from "svelte";
export let count;
const dispatch = createEventDispatcher();
update();
</script>

<div on:click={() => dispatch('submit', 'hello')}>
  <div id="props">{count}</div>
  <div id="remount-count">{remountCount}</div>
  <slot name="main" />
  <slot />
</div>
