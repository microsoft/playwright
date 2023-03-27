<script lang="ts">
import { update, remountCount } from '../store'
import { createEventDispatcher } from "svelte";
export let count: number;
const dispatch = createEventDispatcher();
update();
</script>

<div on:click={() => dispatch('submit', 'hello')}>
  <div data-testid="props">{count}</div>
  <div data-testid="remount-count">{remountCount}</div>
  <slot name="main" />
  <slot />
</div>
