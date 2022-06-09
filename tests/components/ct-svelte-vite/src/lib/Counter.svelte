<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let suffix: string;
  let count: number = 0;
  const dispatch = createEventDispatcher();
  const increment = () => {
    ++count;
    dispatch('changed', { count });
  };
</script>

<button on:click={increment}>
  Clicks: {count} {suffix}
</button>

<style>
  button {
    font-family: inherit;
    font-size: inherit;
    padding: 1em 2em;
    color: #ff3e00;
    background-color: rgba(255, 62, 0, 0.1);
    border-radius: 2em;
    border: 2px solid rgba(255, 62, 0, 0);
    outline: none;
    width: 200px;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  button:focus {
    border: 2px solid #ff3e00;
  }

  button:active {
    background-color: rgba(255, 62, 0, 0.2);
  }
</style>
