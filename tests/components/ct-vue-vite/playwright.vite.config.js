import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import playwrightPlugin from '@playwright/experimental-ct-vue/vitePlugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    playwrightPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
})
