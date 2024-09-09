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

import fs from 'fs';
import path from 'path';
import type { Plugin, UserConfig } from 'vite';

export function bundle(): Plugin {
  let config: UserConfig;
  return {
    name: 'playwright-bundle',
    config(c) {
      config = c;
    },
    transformIndexHtml: {
      handler(html, ctx) {
        if (!ctx || !ctx.bundle)
          return html;
        html = html.replace(/(?=<!--)([\s\S]*?)-->/, '');
        for (const [name, value] of Object.entries(ctx.bundle)) {
          if (name.endsWith('.map'))
            continue;
          if ('code' in value)
            html = html.replace(/<script type="module".*<\/script>/, () => `<script type="module">${value.code}</script>`);
          else
            html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style type='text/css'>${value.source}</style>`);
        }
        return html;
      },
    },
    closeBundle: () => {
      if (fs.existsSync(path.join(config.build!.outDir!, 'index.html'))) {
        const targetDir = path.join(__dirname, '..', 'playwright-core', 'lib', 'vite', 'htmlReport');
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(
            path.join(config.build!.outDir!, 'index.html'),
            path.join(targetDir, 'index.html'));
      }
    },
  };
}