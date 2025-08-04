<script>
const { children } = $props()
</script>

<div>
  <h1>Welcome!</h1>
  <main>
    {@render children()}
  </main>
  <footer>
    Thanks for visiting.
  </footer>
</div>
