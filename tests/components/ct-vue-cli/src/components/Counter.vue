<template>
  <button @click="$emit('submit', 'hello')">
    <span data-testid="props">{{ count }}</span>
    <span data-testid="remount-count">{{ remountCount }}</span>
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

