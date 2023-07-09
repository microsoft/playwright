<template>
  <div>
    <span data-testid="propsTNumber">{{ tNumber }}</span>
    <span data-testid="propsTString">{{ tString }}</span>
    <span data-testid="propsTNullable">{{ tNullable === null ? 'nullValue' : tNullable }}</span>
    <span data-testid="propsTObject">{{ tObject.foo }}</span>
    <span data-testid="propsTArray">{{ tArray.length }}</span>
  </div>
</template>

<script lang="ts">
let remountCount = 0
</script>

<script lang="ts" setup>
defineProps<{ tNumber: number, tString: number, tNullable: null | string, tObject: {foo: number}, tArray: number[] }>()

remountCount++
</script>

