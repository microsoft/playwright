import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import playwright from '@playwright/experimental-ct-vue/vitePlugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    playwright(),
  ]
})
