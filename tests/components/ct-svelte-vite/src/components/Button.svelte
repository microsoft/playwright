<script lang="ts">
  import { createEventDispatcher } from "svelte";
  export let title: string;
  const dispatch = createEventDispatcher();
</script>
 
<button on:click={() => dispatch('submit', 'hello')}>{title}</button>
