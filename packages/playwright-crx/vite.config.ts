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

const bundleFileRegex = /(\w+)Bundle\.ts$/;

function replaceRequireBundle() {
  return {
    name: 'replace-require-bundle',

    transform(src: string, id: string) {
      const [, bundleName] = bundleFileRegex.exec(id) ?? [];
      if (bundleName) {
        // we'll use a vite alias to replace them with the proper bundles folder
        const bundlesAlias = id.includes('packages/playwright-core') ? '@bundles-core' : '@bundles-test';
        const bundleImplPath = `${bundlesAlias}/${bundleName}/src/${bundleName}BundleImpl`;
        const body = src.replace(new RegExp(`require\\("\.\/${bundleName}BundleImpl"\\)`, 'g'), `_${bundleName}BundleImpl`);
        const code = `import * as _${bundleName}BundleImpl from '${bundleImplPath}';
        ${body};
        `;
        return { code };
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    replaceRequireBundle(),
  ],
  resolve: {
    alias: {
      '@bundles-core': path.resolve(__dirname, '../playwright-core/bundles'),
      '@bundles-test': path.resolve(__dirname, '../playwright-test/bundles'),
      'playwright-core/lib': path.resolve(__dirname, '../playwright-core/src'),
      '@playwright/test/lib': path.resolve(__dirname, '../playwright-test/src'),
      'playwright-core': path.resolve(__dirname, '../playwright-core/src/inprocess'),

      // shims
      '_util': path.resolve(__dirname, './bundles/crxdeps/node_modules/util'),
      '@isomorphic-git/lightning-fs': path.resolve(__dirname, './bundles/crxdeps/node_modules/@isomorphic-git/lightning-fs'),
      'assert': path.resolve(__dirname, './bundles/crxdeps/node_modules/assert'),
      'buffer': path.resolve(__dirname, './bundles/crxdeps/node_modules/buffer'),
      'child_process': path.resolve(__dirname, './src/shims/child_process'),
      'chokidar': path.resolve(__dirname, './src/shims/chokidar'),
      'constants': path.resolve(__dirname, './bundles/crxdeps/node_modules/constants-browserify'),
      'crypto': path.resolve(__dirname, './bundles/crxdeps/node_modules/crypto-browserify'),
      'dns': path.resolve(__dirname, './src/shims/dns'),
      'events': path.resolve(__dirname, './bundles/crxdeps/node_modules/events'),
      'fs': path.resolve(__dirname, './src/shims/fs'),
      'graceful-fs': path.resolve(__dirname, './src/shims/fs'),
      'http': path.resolve(__dirname, './bundles/crxdeps/node_modules/stream-http'),
      'https': path.resolve(__dirname, './bundles/crxdeps/node_modules/https-browserify'),
      'module': path.resolve(__dirname, './src/shims/module'),
      'net': path.resolve(__dirname, './src/shims/net'),
      'os': path.resolve(__dirname, './bundles/crxdeps/node_modules/os-browserify/browser'),
      'path': path.resolve(__dirname, './bundles/crxdeps/node_modules/path'),
      'process': path.resolve(__dirname, './bundles/crxdeps/node_modules/process'),
      'readline': path.resolve(__dirname, './src/shims/readline'),
      'setimmediate': path.resolve(__dirname, './bundles/crxdeps/node_modules/setimmediate'),
      'stream': path.resolve(__dirname, './bundles/crxdeps/node_modules/readable-stream'),
      'tls': path.resolve(__dirname, './src/shims/tls'),
      'url': path.resolve(__dirname, './bundles/crxdeps/node_modules/url'),
      'util': path.resolve(__dirname, './src/shims/util'),
      'zlib': path.resolve(__dirname, './bundles/crxdeps/node_modules/browserify-zlib'),
    },
  },
  define: {
    // we need this one because of PLAYWRIGHT_CORE_PATH (it checks the actual version of playwright-core)
    'require.resolve': '((s) => s)',
    'process.platform': '"browser"',
    'process.versions.node': '"18.16"',
    'process.env.DEBUG': '"*"',
    'process.stdout.isTTY': 'false',
  },
  build: {
    outDir: path.resolve(__dirname, './lib/'),
    // skip code obfuscation
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
        path.resolve(__dirname, '../playwright-core/src/third_party/**/*.js'),
        path.resolve(__dirname, '../playwright-core/bundles/utils/src/third_party/**/*.js'),
        /node_modules/,
      ],
    }
  },
});
