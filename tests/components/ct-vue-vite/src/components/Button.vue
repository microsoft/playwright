<script lang="ts" setup>
  defineProps<{ title: string }>()
</script>

<template>
  <button @click="$emit('submit', 'hello')">{{ title }}</button>
</template>
