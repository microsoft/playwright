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
import recorderConfig from '../recorder/vite.config';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import assert from 'assert';

const userRecorderConfig = recorderConfig as UserConfig;

// https://vitejs.dev/config/
export default defineConfig({
  ...userRecorderConfig,
  plugins: [
    ...userRecorderConfig.plugins!,
    {
      name: 'playwright-bundle',
      transformIndexHtml: {
        order: 'pre',
        handler: (html, ctx) => {
          // inject contentscript.ts in the recorder
          const result = html.replace(`<script type="module" src="/src/index.tsx"></script>`, `
          <script type="module" src="../recorder-crx/src/contentscript.ts"></script>
          <script type="module" src="/src/index.tsx"></script>
          `);
          assert(html !== result, 'html should have been changed');
          return result;
        }
      },
    }
  ],
  base: './',
  root: '../recorder',
  build: {
    ...userRecorderConfig.build,
    outDir: path.resolve(__dirname, '../playwright-core/lib/webpack/recorder-crx/recorder'),
  },
  optimizeDeps: {
    include: [
      path.resolve(__dirname, './src/contentscript.ts'),
    ],
  },
});
