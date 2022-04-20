import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import playwrightPlugin from '@playwright/experimental-ct-react/vitePlugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    playwrightPlugin({
      imports: ['./src/index.css']
    }),
  ]
});
