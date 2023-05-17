<template>
  <button @click="$emit('submit', 'hello')">
    <span data-testid="props">{{ count }}</span>
    <span data-testid="remount-count">{{ remountCount }}</span>
    <slot name="main" />
    <slot />
  </button>
 </template>

<script lang="ts">
  let remountCount = 0;
  
  export default {
    name: 'Button',
    props: ['count'],
    data() {
      return { remountCount }
    },
    beforeCreate() {
      remountCount++;
    },
  }
</script>
