<script lang="ts">
import { getContext } from 'svelte';
const contextValue = getContext('context-key');
</script>

<div>{contextValue}</div>
