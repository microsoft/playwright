<script lang="ts" setup>
defineProps({
  title: {
    type: String,
    required: true
  }
})
</script>

<template>
  <button @click="$emit('submit', 'hello')">{{ title }}</button>
</template>
