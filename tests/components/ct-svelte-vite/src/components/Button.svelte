<script>
/** @type {{title: string, onsubmit: (msg: string) => void}} */
const { title, onsubmit } = $props();
</script>

<button onclick={() => onsubmit('hello')}>{title}</button>
