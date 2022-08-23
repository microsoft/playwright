<template>
   <div>
     <span id="remount-count">{{ remountCount }}</span>
     <span id="rerender-count">{{ count }}</span>
   </div>
 </template>

<script>
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
