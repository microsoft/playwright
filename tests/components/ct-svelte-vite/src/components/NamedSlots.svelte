<script>
const { header, main, footer } = $props()
</script>

<div>
  <header>
    {@render header()}
  </header>
  <main>
    {@render main()}
  </main>
  <footer>
    {@render footer()}
  </footer>
</div>
