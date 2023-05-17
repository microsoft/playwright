<script lang="ts">
import { update, remountCount } from '../store'
import { createEventDispatcher } from "svelte";
export let count: number;
const dispatch = createEventDispatcher();
update();
</script>

<button on:click={() => dispatch('submit', 'hello')}>
  <span data-testid="props">{count}</span>
  <span data-testid="remount-count">{remountCount}</span>
  <slot name="main" />
  <slot />
</button>
