<script>
import { onMount } from 'svelte';
import Counter from '../../lib/Counter.svelte';
import register from '@playwright/experimental-ct-svelte/register';

onMount(async () => {
  register({
    Counter
  }, {
    window
  });
});
</script>

<div id="root"></div>
