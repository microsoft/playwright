<script lang="ts" setup>
import { ref, onMounted } from 'vue';

type FetchProps = {
  url: string;
}

const props = defineProps<FetchProps>();
const data = ref({ text: '' });

onMounted(async () => {
  const response = await fetch(props.url);
  data.value = await response.json();
});
</script>

<template>
  <p>{{ data.text }}</p>
</template>
