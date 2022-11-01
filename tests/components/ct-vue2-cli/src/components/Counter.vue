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
