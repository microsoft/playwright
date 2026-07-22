<!-- Slot-heavy scenarios are written as single-file-component stories: one story per file,
     addressed by its path — 'components/DefaultSlot.main'. -->
<script setup lang="ts">
import DefaultSlot from './DefaultSlot.vue';
</script>

<template>
  <DefaultSlot><strong>Main Content</strong></DefaultSlot>
</template>
