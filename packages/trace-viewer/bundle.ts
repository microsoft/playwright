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

import type { IndexHtmlTransformContext, Plugin } from 'vite';

function transformAssetLinks(html: string, ctx: IndexHtmlTransformContext): string {
  const assets: [tag: string, attrs: Record<string, string | boolean>][] = [];
  const parseAttrs = (attrString: string) => {
    const matches = attrString.matchAll(/(\w+)(?:\s*=\s*["']([^"']+)["'])?/g);
    return Object.fromEntries(Array.from(matches, ([, key, value]) => [key, value !== undefined ? value : true]));
  };

  html = html.replace(/<script\s+([^>]*?\bsrc\s*=\s*["'][^"']+["'][^>]*)><\/script>/gi, (match, attrs) => {
    assets.push(['script', parseAttrs(attrs)]);
    return '';
  });

  html = html.replace(/<link\s+([^>]*?\bhref\s*=\s*["'][^"']+["'][^>]*)>/gi, (match, attrs) => {
    assets.push(['link', parseAttrs(attrs)]);
    return '';
  });

  const dynamicAssets = [
    ...ctx.chunk?.dynamicImports ?? [],
    ...ctx.chunk?.imports ?? [],
    ...Object.keys(ctx.bundle)
  ].map(f => `./${f}`);

  function assetScript(assets: [tag: string, attrs: Record<string, string | boolean>][], dynamicAssets: string[]) {
    const search = new URLSearchParams(window.location.search);
    search.delete('trace');
    if (search.size === 0)
      return;

    const importMap: Record<string, string> = {};
    for (const asset of dynamicAssets)
      importMap[asset] = asset + '?' + search.toString();

    for (const [tag, attrs] of assets) {
      const el = document.createElement(tag);
      for (const key in attrs) {
        let value = attrs[key];
        if ((key === 'src' || key === 'href')) {
          value += '?' + search.toString();
          importMap[key] = '' + value;
        }
        if (value === true)
          el.setAttribute(key, '');
        else
          el.setAttribute(key, '' + value);

      }
      document.head.appendChild(el);
    }

    const script = document.createElement('script');
    script.type = 'importmap';
    script.textContent = JSON.stringify({ imports: importMap });
    document.head.appendChild(script);
  }
  html = html.replace('</head>', `<script>(${assetScript})(${JSON.stringify(assets)}, ${JSON.stringify(dynamicAssets)})</script>\n  </head>`);

  return html;
}

export function bundle(): Plugin {
  return {
    name: 'playwright-bundle',
    transformIndexHtml: {
      handler(html, ctx) {
        if (!ctx || !ctx.bundle)
          return html;

        if (ctx.filename.endsWith('index.html') || ctx.filename.endsWith('snapshot.html'))
          html = transformAssetLinks(html, ctx);

        // Workaround vite issue that we cannot exclude some scripts from preprocessing.
        return html.replace(/(?=<!--)([\s\S]*?)-->/, '').replace('<!-- <script src="stall.js"></script> -->', '<script src="stall.js"></script>');
      },
    },
  };
}
