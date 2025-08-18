<script lang="ts">
import { update, remountCount } from '../store'
const { count, onsubmit } = $props();
update();
</script>

<button onclick={() => onsubmit('hello')}>
  <span data-testid="props">{count}</span>
  <span data-testid="remount-count">{remountCount}</span>
</button>
