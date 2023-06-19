<script lang="ts" setup>
  import { useAttrs } from 'vue';
  defineProps<{ title: string }>();
  const attrs = useAttrs();
</script>

<template>
  <button
    @click="$emit('submit', 'hello')"
    @dblclick="() => attrs.dbclick('fallthroughEvent')"
  >
    {{ title }}
  </button>
</template>
