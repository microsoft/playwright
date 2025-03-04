<script>
import { onMount, onDestroy } from 'svelte';
import LoginPage from './pages/LoginPage.svelte';
import DashboardPage from './pages/DashboardPage.svelte';

let path = '';
function updatePath() {
  path = window.location.pathname;
}
onMount(() => {
  updatePath();
  window.addEventListener('popstate', updatePath);
});
onDestroy(() => {
  window.removeEventListener('popstate', updatePath);
});
/**
 * @param newPath {string}
 */
function navigate(newPath) {
  history.pushState({}, '', newPath);
  updatePath();
}
</script>

<header>
  <a on:click={(e) => { e.preventDefault(); navigate('/'); }} href='/login'>Login</a>
  <a on:click={(e) => { e.preventDefault(); navigate('/dashboard'); }} href='/dashboard'>Dashboard</a>
</header>
{#if path === '/'}
  <LoginPage />
{:else if path === '/dashboard'}
  <DashboardPage />
{/if}
