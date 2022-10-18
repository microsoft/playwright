<template>
  <button @click="$emit('submit', 'hello')">{{ title }}</button>
</template>

<script lang="ts">
export default {
  name: 'ButtonButton',
  props: ['title']
}
</script>
