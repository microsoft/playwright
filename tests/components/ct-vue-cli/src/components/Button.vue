<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  emits: {
    submit: null,
  }
})
</script>

<template>
  <button @click="$emit('submit', 'hello')">{{ title }}</button>
</template>
