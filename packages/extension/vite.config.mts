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
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// Public key matching the Chrome Web Store listing — used to fix the extension ID across installs.
// Set SET_EXTENSION_PUBLIC_KEY_IN_MANIFEST=1 in release builds to inject it into the manifest.
const extensionPublicKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwRsUUO4mmbCi4JpmrIoIw31iVW9+xUJRZ6nSzya17PQkaUPDxe1IpgM+vpd/xB6mJWlJSyE1Lj95c0sbomGfVY1M0zUeKbaRVcAb+/a6m59gNR+ubFlmTX0nK9/8fE2FpRB9D+4N5jyeIPQuASW/0oswI2/ijK7hH5NTRX8gWc/ROMSgUj7rKhTAgBrICt/NsStgDPsxRTPPJnhJ/ViJtM1P5KsSYswE987DPoFnpmkFpq8g1ae0eYbQfXy55ieaacC4QWyJPj3daU2kMfBQw7MXnnk0H/WDxouMOIHnd8MlQxpEMqAihj7KpuONH+MUhuj9HEQo4df6bSaIuQ0b4QIDAQAB';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: '../../icons/*',
          dest: 'icons'
        },
        {
          src: '../../manifest.json',
          dest: '.',
          ...(!!process.env.SET_EXTENSION_PUBLIC_KEY_IN_MANIFEST ? {
            transform: (content: string) => {
              const manifest = JSON.parse(content);
              manifest.key = extensionPublicKey;
              return JSON.stringify(manifest, null, 2);
            }
          } : {})
        }
      ]
    })
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
