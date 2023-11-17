<script lang="ts" setup>
  import { useSlots } from 'vue';
  const slots = useSlots();
  Object.assign(window, { slots });
</script>
<template>
</template>

