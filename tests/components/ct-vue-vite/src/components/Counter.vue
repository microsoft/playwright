<template>
  <div>
    <span id="remount-count">{{ remountCount }}</span>
    <span id="rerender-count">{{ count }}</span>
  </div>
</template>

<script>
let remountCount = 0
</script>

<script setup lang="ts">
defineProps<{ count: number }>()
remountCount++
</script>

