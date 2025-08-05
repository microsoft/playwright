<script lang="ts">
  const { title, onsubmit } = $props();
</script>
 
<button onclick={() => onsubmit('hello')}>{title}</button>