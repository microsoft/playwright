/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { resolve } from 'path';
import { copyFileSync, cpSync, mkdirSync } from 'fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function copyExtensionAssets(): Plugin {
  return {
    name: 'playwright-copy-extension-assets',
    closeBundle: {
      sequential: true,
      handler() {
        const dist = resolve(__dirname, 'dist');
        mkdirSync(resolve(dist, 'icons'), { recursive: true });
        cpSync(resolve(__dirname, 'icons'), resolve(dist, 'icons'), { recursive: true });
        copyFileSync(resolve(__dirname, 'manifest.json'), resolve(dist, 'manifest.json'));
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    copyExtensionAssets(),
  ],
  root: resolve(__dirname, 'src/ui'),
  build: {
    outDir: resolve(__dirname, 'dist/'),
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      input: ['src/ui/connect.html', 'src/ui/status.html'],
      output: {
        manualChunks: undefined,
        entryFileNames: 'lib/ui/[name].js',
        chunkFileNames: 'lib/ui/[name].js',
        assetFileNames: 'lib/ui/[name].[ext]'
      }
    }
  }
});
