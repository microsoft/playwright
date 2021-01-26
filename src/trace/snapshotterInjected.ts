/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type SnapshotData = {
  html: string,
  resourceOverrides: { url: string, content: string }[],
  viewport: { width: number, height: number },
  url: string,
  snapshotId?: string,
};

export const kSnapshotStreamer = '__playwright_snapshot_streamer_';
export const kSnapshotFrameIdAttribute = '__playwright_snapshot_frameid_';
export const kSnapshotBinding = '__playwright_snapshot_binding_';

export function frameSnapshotStreamer() {
  const kSnapshotStreamer = '__playwright_snapshot_streamer_';
  const kSnapshotFrameIdAttribute = '__playwright_snapshot_frameid_';
  const kSnapshotBinding = '__playwright_snapshot_binding_';
  const kShadowAttribute = '__playwright_shadow_root_';
  const kScrollTopAttribute = '__playwright_scroll_top_';
  const kScrollLeftAttribute = '__playwright_scroll_left_';

  const escaped = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };
  const autoClosing = new Set(['AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT', 'KEYGEN', 'LINK', 'MENUITEM', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR']);

  class Streamer {
    private _removeNoScript = true;
    private _needStyleOverrides = false;
    private _timer: NodeJS.Timeout | undefined;

    constructor() {
      this._interceptCSSOM(window.CSSStyleSheet.prototype, 'insertRule');
      this._interceptCSSOM(window.CSSStyleSheet.prototype, 'deleteRule');
      this._interceptCSSOM(window.CSSStyleSheet.prototype, 'addRule');
      this._interceptCSSOM(window.CSSStyleSheet.prototype, 'removeRule');
      // TODO: should we also intercept setters like CSSRule.cssText and CSSStyleRule.selectorText?
      this._streamSnapshot();
    }

    private _interceptCSSOM(obj: any, method: string) {
      const self = this;
      const native = obj[method] as Function;
      if (!native)
        return;
      obj[method] = function(...args: any[]) {
        self._needStyleOverrides = true;
        native.call(this, ...args);
      };
    }

    markIframe(iframeElement: HTMLIFrameElement | HTMLFrameElement, frameId: string) {
      iframeElement.setAttribute(kSnapshotFrameIdAttribute, frameId);
    }

    forceSnapshot(snapshotId: string) {
      this._streamSnapshot(snapshotId);
    }

    private _streamSnapshot(snapshotId?: string) {
      if (this._timer) {
        clearTimeout(this._timer);
        this._timer = undefined;
      }
      const snapshot = this._captureSnapshot(snapshotId);
      (window as any)[kSnapshotBinding](snapshot).catch((e: any) => {});
      this._timer = setTimeout(() => this._streamSnapshot(), 100);
    }

    private _escapeAttribute(s: string): string {
      return s.replace(/[&<>"']/ug, char => (escaped as any)[char]);
    }

    private _escapeText(s: string): string {
      return s.replace(/[&<]/ug, char => (escaped as any)[char]);
    }

    private _sanitizeUrl(url: string): string {
      if (url.startsWith('javascript:'))
        return '';
      return url;
    }

    private _sanitizeSrcSet(srcset: string): string {
      return srcset.split(',').map(src => {
        src = src.trim();
        const spaceIndex = src.lastIndexOf(' ');
        if (spaceIndex === -1)
          return this._sanitizeUrl(src);
        return this._sanitizeUrl(src.substring(0, spaceIndex).trim()) + src.substring(spaceIndex);
      }).join(',');
    }

    private _resolveUrl(base: string, url: string): string {
      if (url === '')
        return '';
      try {
        return new URL(url, base).href;
      } catch (e) {
        return url;
      }
    }

    private _getSheetBase(sheet: CSSStyleSheet): string {
      let rootSheet = sheet;
      while (rootSheet.parentStyleSheet)
        rootSheet = rootSheet.parentStyleSheet;
      if (rootSheet.ownerNode)
        return rootSheet.ownerNode.baseURI;
      return document.baseURI;
    }

    private _getSheetText(sheet: CSSStyleSheet): string {
      const rules: string[] = [];
      for (const rule of sheet.cssRules)
        rules.push(rule.cssText);
      return rules.join('\n');
    }

    private _captureSnapshot(snapshotId?: string): SnapshotData {
      const win = window;
      const doc = win.document;

      let needScript = false;
      const styleNodeToStyleSheetText = new Map<Node, string>();
      const styleSheetUrlToContentOverride = new Map<string, string>();

      const visitStyleSheet = (sheet: CSSStyleSheet) => {
        // TODO: recalculate these upon changes, and only send them once.
        if (!this._needStyleOverrides)
          return;

        try {
          for (const rule of sheet.cssRules) {
            if ((rule as CSSImportRule).styleSheet)
              visitStyleSheet((rule as CSSImportRule).styleSheet);
          }

          const cssText = this._getSheetText(sheet);
          if (sheet.ownerNode && sheet.ownerNode.nodeName === 'STYLE') {
            // Stylesheets with owner STYLE nodes will be rewritten.
            styleNodeToStyleSheetText.set(sheet.ownerNode, cssText);
          } else if (sheet.href !== null) {
            // Other stylesheets will have resource overrides.
            const base = this._getSheetBase(sheet);
            const url = this._resolveUrl(base, sheet.href);
            styleSheetUrlToContentOverride.set(url, cssText);
          }
        } catch (e) {
          // Sometimes we cannot access cross-origin stylesheets.
        }
      };

      const visit = (node: Node | ShadowRoot, builder: string[]) => {
        const nodeName = node.nodeName;
        const nodeType = node.nodeType;

        if (nodeType === Node.DOCUMENT_TYPE_NODE) {
          const docType = node as DocumentType;
          builder.push(`<!DOCTYPE ${docType.name}>`);
          return;
        }

        if (nodeType === Node.TEXT_NODE) {
          builder.push(this._escapeText(node.nodeValue || ''));
          return;
        }

        if (nodeType !== Node.ELEMENT_NODE &&
            nodeType !== Node.DOCUMENT_NODE &&
            nodeType !== Node.DOCUMENT_FRAGMENT_NODE)
          return;

        if (nodeType === Node.DOCUMENT_NODE || nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          const documentOrShadowRoot = node as DocumentOrShadowRoot;
          for (const sheet of documentOrShadowRoot.styleSheets)
            visitStyleSheet(sheet);
        }

        if (nodeName === 'SCRIPT' || nodeName === 'BASE')
          return;

        if (this._removeNoScript && nodeName === 'NOSCRIPT')
          return;

        if (nodeName === 'STYLE') {
          const cssText = styleNodeToStyleSheetText.get(node) || node.textContent || '';
          builder.push('<style>');
          builder.push(cssText);
          builder.push('</style>');
          return;
        }

        if (nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          builder.push('<');
          builder.push(nodeName);
          // if (node === target)
          //   builder.push(' __playwright_target__="true"');
          for (let i = 0; i < element.attributes.length; i++) {
            const name = element.attributes[i].name;
            if (name === kSnapshotFrameIdAttribute)
              continue;

            let value = element.attributes[i].value;
            if (name === 'value' && (nodeName === 'INPUT' || nodeName === 'TEXTAREA'))
              continue;
            if (name === 'checked' || name === 'disabled' || name === 'checked')
              continue;
            if (nodeName === 'LINK' && name === 'integrity')
              continue;
            if (name === 'src' && (nodeName === 'IFRAME' || nodeName === 'FRAME')) {
              // TODO: handle srcdoc?
              const frameId = element.getAttribute(kSnapshotFrameIdAttribute);
              if (frameId) {
                let protocol = win.location.protocol;
                if (!protocol.startsWith('http'))
                  protocol = 'http:';
                value = protocol + '//' + frameId + '/';
              } else {
                value = 'data:text/html,<body>Snapshot is not available</body>';
              }
            } else if (name === 'src' && (nodeName === 'IMG')) {
              value = this._sanitizeUrl(value);
            } else if (name === 'srcset' && (nodeName === 'IMG')) {
              value = this._sanitizeSrcSet(value);
            } else if (name === 'srcset' && (nodeName === 'SOURCE')) {
              value = this._sanitizeSrcSet(value);
            } else if (name === 'href' && (nodeName === 'LINK')) {
              value = this._sanitizeUrl(value);
            } else if (name.startsWith('on')) {
              value = '';
            }
            builder.push(' ');
            builder.push(name);
            builder.push('="');
            builder.push(this._escapeAttribute(value));
            builder.push('"');
          }
          if (nodeName === 'INPUT') {
            builder.push(' value="');
            builder.push(this._escapeAttribute((element as HTMLInputElement).value));
            builder.push('"');
          }
          if ((element as any).checked)
            builder.push(' checked');
          if ((element as any).disabled)
            builder.push(' disabled');
          if ((element as any).readOnly)
            builder.push(' readonly');
          if (element.scrollTop) {
            needScript = true;
            builder.push(` ${kScrollTopAttribute}="${element.scrollTop}"`);
          }
          if (element.scrollLeft) {
            needScript = true;
            builder.push(` ${kScrollLeftAttribute}="${element.scrollLeft}"`);
          }
          builder.push('>');

          if (element.shadowRoot) {
            needScript = true;
            const b: string[] = [];
            visit(element.shadowRoot, b);
            builder.push('<template ');
            builder.push(kShadowAttribute);
            builder.push('="open">');
            builder.push(b.join(''));
            builder.push('</template>');
          }
        }
        if (nodeName === 'HEAD') {
          let baseHref = document.baseURI;
          let baseTarget: string | undefined;
          for (let child = node.firstChild; child; child = child.nextSibling) {
            if (child.nodeName === 'BASE') {
              baseHref = (child as HTMLBaseElement).href;
              baseTarget = (child as HTMLBaseElement).target;
            }
          }
          builder.push('<base href="');
          builder.push(this._escapeAttribute(baseHref));
          builder.push('"');
          if (baseTarget) {
            builder.push(' target="');
            builder.push(this._escapeAttribute(baseTarget));
            builder.push('"');
          }
          builder.push('>');
        }
        if (nodeName === 'TEXTAREA') {
          builder.push(this._escapeText((node as HTMLTextAreaElement).value));
        } else {
          for (let child = node.firstChild; child; child = child.nextSibling)
            visit(child, builder);
        }
        if (node.nodeName === 'BODY' && needScript) {
          builder.push('<script>');
          const scriptContent = `\n(${applyPlaywrightAttributes.toString()})('${kShadowAttribute}', '${kScrollTopAttribute}', '${kScrollLeftAttribute}')`;
          builder.push(scriptContent);
          builder.push('</script>');
        }
        if (nodeType === Node.ELEMENT_NODE && !autoClosing.has(nodeName)) {
          builder.push('</');
          builder.push(nodeName);
          builder.push('>');
        }
      };

      function applyPlaywrightAttributes(shadowAttribute: string, scrollTopAttribute: string, scrollLeftAttribute: string) {
        const scrollTops = document.querySelectorAll(`[${scrollTopAttribute}]`);
        const scrollLefts = document.querySelectorAll(`[${scrollLeftAttribute}]`);
        for (const element of document.querySelectorAll(`template[${shadowAttribute}]`)) {
          const template = element as HTMLTemplateElement;
          const shadowRoot = template.parentElement!.attachShadow({ mode: 'open' });
          shadowRoot.appendChild(template.content);
          template.remove();
        }
        const onDOMContentLoaded = () => {
          window.removeEventListener('DOMContentLoaded', onDOMContentLoaded);
          for (const element of scrollTops)
            element.scrollTop = +element.getAttribute(scrollTopAttribute)!;
          for (const element of scrollLefts)
            element.scrollLeft = +element.getAttribute(scrollLeftAttribute)!;
        };
        window.addEventListener('DOMContentLoaded', onDOMContentLoaded);
        const onLoad = () => {
          window.removeEventListener('load', onLoad);
          for (const element of scrollTops) {
            element.scrollTop = +element.getAttribute(scrollTopAttribute)!;
            element.removeAttribute(scrollTopAttribute);
          }
          for (const element of scrollLefts) {
            element.scrollLeft = +element.getAttribute(scrollLeftAttribute)!;
            element.removeAttribute(scrollLeftAttribute);
          }
        };
        window.addEventListener('load', onLoad);
      }

      const root: string[] = [];
      visit(doc, root);
      return {
        html: root.join(''),
        resourceOverrides: Array.from(styleSheetUrlToContentOverride).map(([url, content]) => ({ url, content })),
        viewport: {
          width: Math.max(doc.body ? doc.body.offsetWidth : 0, doc.documentElement ? doc.documentElement.offsetWidth : 0),
          height: Math.max(doc.body ? doc.body.offsetHeight : 0, doc.documentElement ? doc.documentElement.offsetHeight : 0),
        },
        url: location.href,
        snapshotId,
      };
    }
  }

  (window as any)[kSnapshotStreamer] = new Streamer();
}
