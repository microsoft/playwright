<script>
import { update, remountCount } from '../store'
/** @type {{count: number; onsubmit: (msg: string) => void}} */
const { count, onsubmit } = $props()
update();
</script>

<button onclick={() => onsubmit('hello')}>
  <span data-testid="props">{count}</span>
  <span data-testid="remount-count">{remountCount}</span>
</button>
