<template>
  <div @click="$emit('submit', 'hello')">
    <div id="props">{{ count }}</div>
    <div id="remount-count">{{ remountCount }}</div>
    <slot name="main" />
    <slot />
  </div>
</template>

<script>
let remountCount = 0
</script>

<script setup>
defineProps({
  count: {
    type: Number,
    required: false
  }
})
remountCount++
</script>

