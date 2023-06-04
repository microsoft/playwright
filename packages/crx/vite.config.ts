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

import path from 'path';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    nodePolyfills({
      exclude: ['child_process', 'crypto', 'path'],
    }),
  ],
  resolve: {
    alias: {
      '@playwright-core': path.resolve(__dirname, '../playwright-core/src'),
      'child_process': path.resolve(__dirname, './src/polyfills/child_process'),
      'crypto': path.resolve(__dirname, './src/polyfills/crypto'),
      'path': path.resolve(__dirname, '../../node_modules/path-browserify'),
      'playwright-core/lib/utils': path.resolve(__dirname, './src/polyfills/utils'),
    },
  },
  define: {
    '__dirname': '"."',
    // 'process.env.DEBUG': '"*"',
    'process.env.PW_CODEGEN_NO_INSPECTOR': '1',
    'require("module")': '{builtinModules:[]}',
    'require("../deviceDescriptors")': require('../playwright-core/src/server/deviceDescriptorsSource.json'),
    'require("../../../browsers.json")': require('../playwright-core/browsers.json'),
    'require("./utilsBundleImpl")': 'self.utilsBundle',
    'require("./zipBundleImpl")': '{}',
    'require("../deviceDescriptorsSource.json")': '{}',
    'require("../third_party/pixelmatch")': '{}',
    'require("../third_party/diff_match_patch")': '{}',
    'require("./../../package.json")': '{}',
    'require("../../../package.json")': '{}',
    'require("../playwright")': '{}',
  },
  build: {
    outDir: path.resolve(__dirname, '../playwright-core/lib/webpack/crx'),
    // recorder assets are copied to devtools output dir, so this will prevent those assets from being deleted.
    emptyOutDir: false,
    // skip code obfuscation
    minify: false,
    // chunk limit is not an issue, this is a browser extension
    chunkSizeWarningLimit: 10240,
    rollupOptions: {
      input: {
        'background': path.resolve(__dirname, 'src/background.ts'),
        'devtools': path.resolve(__dirname, 'devtools.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      inject: [
        path.resolve(__dirname, './src/polyfills/inject.ts')
      ],
    }
  }
});
