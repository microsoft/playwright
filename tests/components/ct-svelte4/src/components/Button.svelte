<script>
import { createEventDispatcher } from "svelte";
export let title;
const dispatch = createEventDispatcher();
</script>
    
<button on:click={() => dispatch('submit', 'hello')}>{title}</button>
