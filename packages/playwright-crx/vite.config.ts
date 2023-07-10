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
import type { PluginOption } from 'vite';
import { defineConfig } from 'vite';

const bundlesMapping = {
  'playwright-core/src/utilsBundle': path.resolve(__dirname, '../playwright-crx/src/bundles/utilsBundleImpl'),
  'playwright-core/src/zipBundle': path.resolve(__dirname, '../playwright-crx/src/bundles/zipBundleImpl'),
  'playwright-test/src/common/expectBundle': path.resolve(__dirname, '../playwright-crx/src/bundles/expectBundleImpl'),
  'playwright-test/src/transform/babelBundle': path.resolve(__dirname, '../playwright-crx/src/bundles/babelBundleImpl'),
  'playwright-test/src/utilsBundle': path.resolve(__dirname, '../playwright-crx/src/bundles/utilsBundleImpl'),
};

const replaceRequireBundle: PluginOption = {
  name: 'replace-require-bundle',

  transform(src: string, id: string) {
    const mapping = Object.entries(bundlesMapping).find(([k]) => id.includes(k))?.[1];
    if (mapping) {
      const relative = path.relative(path.dirname(id), mapping).replace(/\\/g, '/');
      const bundleName = path.basename(id, '.ts');
      const body = src.replace(new RegExp(`require\\("\.\/${bundleName}Impl"\\)`, 'g'), `/* @__PURE__ */ _${bundleName}`);
      const code = [
        `import * as _${bundleName} from '${relative}';`,
        body,
      ].join('\n');
      return { code, map: this.getCombinedSourcemap() };
    }
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    replaceRequireBundle,
  ],
  resolve: {
    alias: {
      'playwright-core/lib': path.resolve(__dirname, '../playwright-core/src'),
      '@playwright/test/lib': path.resolve(__dirname, '../playwright-test/src'),
      'playwright-core': path.resolve(__dirname, '../playwright-core/src/inprocess'),

      'assert': path.resolve(__dirname, './bundles/crxdeps/node_modules/assert'),
      'buffer': path.resolve(__dirname, './bundles/crxdeps/node_modules/buffer'),
      'crypto': path.resolve(__dirname, './bundles/crxdeps/node_modules/crypto-browserify'),
      'events': path.resolve(__dirname, './bundles/crxdeps/node_modules/events'),
      'fs': path.resolve(__dirname, './src/shims/fs'),
      'module': path.resolve(__dirname, './src/shims/module'),
      'os': path.resolve(__dirname, './bundles/crxdeps/node_modules/os-browserify'),
      'path': path.resolve(__dirname, './bundles/crxdeps/node_modules/path'),
      'process': path.resolve(__dirname, './bundles/crxdeps/node_modules/process/browser'),
      'process/': path.resolve(__dirname, './bundles/crxdeps/node_modules/process/browser'),
      'punycode': path.resolve(__dirname, './bundles/crxdeps/node_modules/punycode'),
      'stream': path.resolve(__dirname, './bundles/crxdeps/node_modules/readable-stream'),
      'string_decoder': path.resolve(__dirname, './bundles/crxdeps/node_modules/string_decoder'),
      'url': path.resolve(__dirname, './bundles/crxdeps/node_modules/url'),
      'util': path.resolve(__dirname, './bundles/crxdeps/node_modules/util'),
      'setImmediate': path.resolve(__dirname, './bundles/crxdeps/node_modules/setimmediate'),
      './utilsBundleImpl': path.resolve(__dirname, './src/core/utilsBundleImpl'),
      './zipBundleImpl': path.resolve(__dirname, './src/core/zipBundleImpl'),
      './expectBundleImpl': path.resolve(__dirname, './src/test/expectBundleImpl'),
      './babelBundleImpl': path.resolve(__dirname, './src/test/babelBundleImpl'),

      'graceful-fs': path.resolve(__dirname, './src/shims/graceful-fs'),

      // generated with check_dep_crx
      'child_process': path.resolve(__dirname, './src/shims/generated/child_process'),
      'cluster': path.resolve(__dirname, './src/shims/generated/cluster'),
      'dgram': path.resolve(__dirname, './src/shims/generated/dgram'),
      'dns': path.resolve(__dirname, './src/shims/generated/dns'),
      'domain': path.resolve(__dirname, './src/shims/generated/domain'),
      'http': path.resolve(__dirname, './src/shims/generated/http'),
      'https': path.resolve(__dirname, './src/shims/generated/https'),
      'net': path.resolve(__dirname, './src/shims/generated/net'),
      'readline': path.resolve(__dirname, './src/shims/generated/readline'),
      'timers': path.resolve(__dirname, './src/shims/generated/timers'),
      'tls': path.resolve(__dirname, './src/shims/generated/tls'),
      'tty': path.resolve(__dirname, './src/shims/generated/tty'),
      'v8': path.resolve(__dirname, './src/shims/generated/v8'),
      'vm': path.resolve(__dirname, './src/shims/generated/vm'),
      'zlib': path.resolve(__dirname, './src/shims/generated/zlib'),
    },
  },
  define: {
    'process.env.PW_CRX': '"true"',

    // we need this one because of PLAYWRIGHT_CORE_PATH (it checks the actual version of playwright-core)
    'require.resolve': '((s) => s)',
    'process.platform': '"browser"',
    'process.versions.node': '"18.16"',
    'process.env.DEBUG': '"*"',
    'process.stdout.isTTY': 'false',
  },
  build: {
    outDir: path.resolve(__dirname, './lib/'),
    sourcemap: true,
    minify: false,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'playwright-crx',
      fileName: 'playwright-crx',
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
    },
    commonjsOptions: {
      include: [
        path.resolve(__dirname, '../playwright-core/src/server/deviceDescriptors.js'),
        path.resolve(__dirname, '../playwright-core/bundles/utils/src/third_party/**/*.js'),
        /node_modules/,
      ],
    }
  },
  esbuild: {
    treeShaking: true,
  },
});
