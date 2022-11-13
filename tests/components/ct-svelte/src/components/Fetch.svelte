<script>
import { onMount } from 'svelte';

export let url;
let data = { text: '' };

onMount(async () => {
  const response = await fetch(url);
  data = await response.json();
});
</script>
  
<p>{data.text}</p>
