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

import type { Plugin } from 'vite';

export function bundle(): Plugin {
  return {
    name: 'playwright-bundle',
    transformIndexHtml: {
      handler(html, ctx) {
        if (!ctx || !ctx.bundle)
          return html;

        // Extract all link and script tags with href/src attributes
        const assets: Array<{ tag: string; attrs: Record<string, string | boolean> }> = [];

        const parseAttrs = (attrString: string) => {
          const attrMap: Record<string, string | boolean> = {};
          // Match both key="value" and boolean attributes
          attrString.replace(/(\w+)(?:\s*=\s*["']([^"']+)["'])?/g, (_: string, key: string, value: string | undefined) => {
            if (key)
              attrMap[key] = value !== undefined ? value : true;

            return '';
          });
          return attrMap;
        };

        // Match script tags with src
        html = html.replace(/<script\s+([^>]*?\bsrc\s*=\s*["'][^"']+["'][^>]*)><\/script>/gi, (match, attrs) => {
          assets.push({ tag: 'script', attrs: parseAttrs(attrs) });
          return ''; // Remove the tag
        });

        // Match link tags with href
        html = html.replace(/<link\s+([^>]*?\bhref\s*=\s*["'][^"']+["'][^>]*)>/gi, (match, attrs) => {
          assets.push({ tag: 'link', attrs: parseAttrs(attrs) });
          return ''; // Remove the tag
        });

        // Collect all module imports to create import map
        const imports: Record<string, string> = {};
        assets.forEach(asset => {
          if (asset.tag === 'link' && asset.attrs.rel === 'modulepreload' && typeof asset.attrs.href === 'string') {
            const href = asset.attrs.href;
            imports[href] = href; // Will append search params in the runtime script
          }
        });

        // Generate script to dynamically create these assets with query params
        const assetScript = `<script>
      (function() {
        const search = window.location.search;
        const assets = ${JSON.stringify(assets)};
        const imports = ${JSON.stringify(imports)};
        
        // Create import map with search params appended
        if (search && Object.keys(imports).length > 0) {
          const importMap = { imports: {} };
          for (const key in imports) {
            importMap.imports[key] = key + search;
          }
          const script = document.createElement('script');
          script.type = 'importmap';
          script.textContent = JSON.stringify(importMap);
          document.head.appendChild(script);
        }
        
        assets.forEach(function(asset) {
          const el = document.createElement(asset.tag);
          for (const key in asset.attrs) {
            let value = asset.attrs[key];
            // Add search params to src/href if present
            if ((key === 'src' || key === 'href') && search) {
              value += search;
            }
            // Set boolean attributes without value, others with value
            if (value === true) {
              el.setAttribute(key, '');
            } else {
              el.setAttribute(key, value);
            }
          }
          document.head.appendChild(el);
        });
      })();
    </script>`;

        // Insert the script at the end of <head>
        html = html.replace('</head>', `${assetScript}\n  </head>`);

        // Workaround vite issue that we cannot exclude some scripts from preprocessing.
        return html.replace(/(?=<!--)([\s\S]*?)-->/, '').replace('<!-- <script src="stall.js"></script> -->', '<script src="stall.js"></script>');
      },
    },
  };
}
