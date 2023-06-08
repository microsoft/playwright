<script lang="ts" setup>
  import { useAttrs } from 'vue';
  defineProps<{ title: string }>();
  const attrs = useAttrs();
  console.log({ ...attrs });
</script>

<template>
  <button @click="$emit('submit', 'hello')">{{ title }}</button>
</template>

