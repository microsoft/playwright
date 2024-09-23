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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { bundle } from './bundle';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '',
  plugins: [
    react(),
    bundle()
  ],
  resolve: {
    alias: {
      '@isomorphic': path.resolve(__dirname, '../playwright-core/src/utils/isomorphic'),
      '@protocol': path.resolve(__dirname, '../protocol/src'),
      '@testIsomorphic': path.resolve(__dirname, '../playwright-core/src/utils/testIsomorphic'),
      '@trace': path.resolve(__dirname, '../trace/src'),
      '@web': path.resolve(__dirname, '../web/src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../playwright-core/lib/vite/traceViewer'),
    // Output dir is shared with vite.config.ts, clearing it here is racy.
    emptyOutDir: false,
    rollupOptions: {
      input: {
        sw: path.resolve(__dirname, 'src/sw.ts'),
      },
      output: {
        entryFileNames: info => '[name].bundle.js',
        assetFileNames: () => '[name].[hash][extname]',
        manualChunks: undefined,
      },
    },
  }
});
