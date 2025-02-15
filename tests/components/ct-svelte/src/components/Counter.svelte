<script>
import { update, remountCount } from '../store'
const { count, onsubmit, main, children } = $props()
update();
</script>

<button onclick={() => onsubmit?.('hello')}>
  <span data-testid="props">{count}</span>
  <span data-testid="remount-count">{remountCount}</span>
  {@render main?.()}
  {@render children?.()}
</button>
