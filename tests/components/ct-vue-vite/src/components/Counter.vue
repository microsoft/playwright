<template>
  <div @click="$emit('submit', 'hello')">
    <div data-testid="props">{{ count }}</div>
    <div data-testid="remount-count">{{ remountCount }}</div>
    <div data-testid="slots">
      <slot name="main" />
      <slot />
    </div>
  </div>
</template>

<script lang="ts">
let remountCount = 0
</script>

<script lang="ts" setup>
defineProps<{ count?: number }>()

remountCount++
</script>

