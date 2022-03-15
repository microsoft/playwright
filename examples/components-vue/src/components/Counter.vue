<script>
import { reactive } from "vue";

export default {
  setup(_, { emit }) {
    const state = reactive({
      count: 0,
    })
    function increment() {
      state.count++
      emit('changed', state.count)
    }
    return {
      state,
      increment,
    }
  },
  emits: ['changed']
}
</script>

<template>
  <button @click="increment">
    Count is: {{ state.count }}
  </button>
</template>

<style scoped>
button {
  font-size: 24px;
  padding: 14px;
}
</style>
