<script>
  const {header, main, footer} = $props()

  console.log({header, main, footer});
</script>

<div>
  <header>
    {@render header?.()}
  </header>
  <main>
    {@render main?.()}
  </main>
  <footer>
    {@render footer?.()}
  </footer>
</div>
