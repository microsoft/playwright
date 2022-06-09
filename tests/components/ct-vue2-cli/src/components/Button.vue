<template>
<button @click='$emit("submit", "hello")'>
  {{ title }}
</button>
</template>

<script>
export default {
  name: 'ButtonButton',
  props: ['title']
}
</script>
