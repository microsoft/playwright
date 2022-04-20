import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import playwrightPlugin from '@playwright/experimental-ct-svelte/vitePlugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    playwrightPlugin(),
  ]
})
