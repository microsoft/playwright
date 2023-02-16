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

/**
 * @returns {import('vite').Plugin}
 */
export function bundle() {
  let config;
  return {
    name: 'playwright-bundle',
    config(c) {
      config = c;
    },
    transformIndexHtml: {
      transform(html, ctx) {
        if (!ctx || !ctx.bundle)
          return html;
        // Workaround vite issue that we cannot exclude some scripts from preprocessing.
        return html.replace(/(?=<!--)([\s\S]*?)-->/, '').replace('<!-- <script src="stall.js"></script> -->', '<script src="stall.js"></script>');
      },
    },
  }
}