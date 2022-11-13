<script lang="ts">
export default {
  name: 'Fetch',
  props: ['url'],
  data() {
    return { data: { text: '' } }
  },
  async created() {
    const response = await fetch(this.url);
    this.data = await response.json();
  },
}
</script>

<template>
  <p>{{ data.text }}</p>
</template>
