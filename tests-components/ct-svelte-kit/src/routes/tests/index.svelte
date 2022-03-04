<script>
import { onMount } from 'svelte';
import Counter from '../../lib/Counter.svelte';
import register from '@playwright/ct-svelte/register';

onMount(async () => {
  register({
    Counter
  }, {
    window
  });
});
</script>

<div id="app"></div>
