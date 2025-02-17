<script>
import { update, remountCount } from '../store'
/** @type {{count: number; onsubmit: (msg: string) => void; main?: import("svelte").Snippet; children?: import("svelte").Snippet}} */
const { count, onsubmit, main, children } = $props()
update();
</script>

<button onclick={() => onsubmit?.('hello')}>
  <span data-testid="props">{count}</span>
  <span data-testid="remount-count">{remountCount}</span>
  {@render main?.()}
  {@render children?.()}
</button>
