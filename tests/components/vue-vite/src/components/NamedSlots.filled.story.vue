<script setup lang="ts">
import NamedSlots from './NamedSlots.vue';
</script>

<template>
  <NamedSlots>
    <template #header>Header</template>
    <template #main>Main Content</template>
    <template #footer>Footer</template>
  </NamedSlots>
</template>
