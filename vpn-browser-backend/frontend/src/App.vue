<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  // 移除加载动画
  const loading = document.querySelector('.loading')
  if (loading) {
    loading.style.display = 'none'
  }
})
</script>

<style>
#app {
  height: 100vh;
  overflow: hidden;
}
</style>
