import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import playwright from '@playwright/experimental-ct-react/vitePlugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    playwright(),
  ]
});
