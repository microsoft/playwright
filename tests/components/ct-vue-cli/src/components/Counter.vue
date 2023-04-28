<template>
  <button @click="$emit('submit', 'hello')">
    <div data-testid="props">{{ count }}</div>
    <div data-testid="remount-count">{{ remountCount }}</div>
    <slot name="main" />
    <slot />
  </button>
</template>

<script lang="ts">
let remountCount = 0
</script>

<script lang="ts" setup>
defineProps({
  count: {
    type: Number,
    required: true
  }
})
remountCount++
</script>

