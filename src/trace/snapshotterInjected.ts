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

export type NodeSnapshot =
  // Text node.
  string |
  // Subtree reference, "x snapshots ago, node #y". Could point to a text node.
  // Only nodes that are not references are counted, starting from zero.
  [ [number, number] ] |
  // Just node name.
  [ string ] |
  // Node name, attributes, child nodes.
  // Unfortunately, we cannot make this type definition recursive, therefore "any".
  [ string, { [attr: string]: string }, ...any ];

export type SnapshotData = {
  doctype?: string,
  html: NodeSnapshot,
  resourceOverrides: {
    url: string,
    // String is the content. Number is "x snapshots ago", same url.
    content: string | number,
  }[],
  viewport: { width: number, height: number },
  url: string,
  snapshotId?: string,
};

export const kSnapshotStreamer = '__playwright_snapshot_streamer_';
export const kSnapshotBinding = '__playwright_snapshot_binding_';

export function frameSnapshotStreamer() {
  // Communication with Playwright.
  const kSnapshotStreamer = '__playwright_snapshot_streamer_';
  const kSnapshotBinding = '__playwright_snapshot_binding_';

  // Attributes present in the snapshot.
  const kShadowAttribute = '__playwright_shadow_root_';
  const kScrollTopAttribute = '__playwright_scroll_top_';
  const kScrollLeftAttribute = '__playwright_scroll_left_';

  // Symbols for our own info on Nodes/StyleSheets.
  const kSnapshotFrameId = Symbol('__playwright_snapshot_frameid_');
  const kCachedData = Symbol('__playwright_snapshot_cache_');
  type CachedData = {
    ref?: [number, number], // Previous snapshotNumber and nodeIndex.
    value?: string, // Value for input/textarea elements.
    cssText?: string, // Text for stylesheets.
    cssRef?: number, // Previous snapshotNumber for overridden stylesheets.
  };
  function ensureCachedData(obj: any): CachedData {
    if (!obj[kCachedData])
      obj[kCachedData] = {};
    return obj[kCachedData];
  }

  const escaped = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };
  function escapeAttribute(s: string): string {
    return s.replace(/[&<>"']/ug, char => (escaped as any)[char]);
  }
  function escapeText(s: string): string {
    return s.replace(/[&<]/ug, char => (escaped as any)[char]);
  }

  function removeHash(url: string) {
    try {
      const u = new URL(url);
      u.hash = '';
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  class Streamer {
    private _removeNoScript = true;
    private _timer: NodeJS.Timeout | undefined;
    private _lastSnapshotNumber = 0;
    private _observer: MutationObserver;
    private _staleStyleSheets = new Set<CSSStyleSheet>();
    private _allStyleSheetsWithUrlOverride = new Set<CSSStyleSheet>();
    private _readingStyleSheet = false;  // To avoid invalidating due to our own reads.

    constructor() {
      this._interceptNativeMethod(window.CSSStyleSheet.prototype, 'insertRule', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));
      this._interceptNativeMethod(window.CSSStyleSheet.prototype, 'deleteRule', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));
      this._interceptNativeMethod(window.CSSStyleSheet.prototype, 'addRule', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));
      this._interceptNativeMethod(window.CSSStyleSheet.prototype, 'removeRule', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));
      this._interceptNativeGetter(window.CSSStyleSheet.prototype, 'rules', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));
      this._interceptNativeGetter(window.CSSStyleSheet.prototype, 'cssRules', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));

      this._observer = new MutationObserver(list => this._handleMutations(list));
      const observerConfig = { attributes: true, childList: true, subtree: true, characterData: true };
      this._observer.observe(document, observerConfig);
      this._interceptNativeMethod(window.Element.prototype, 'attachShadow', (node: Node, shadowRoot: ShadowRoot) => {
        this._invalidateNode(node);
        this._observer.observe(shadowRoot, observerConfig);
      });

      this._streamSnapshot();
    }

    private _interceptNativeMethod(obj: any, method: string, cb: (thisObj: any, result: any) => void) {
      const native = obj[method] as Function;
      if (!native)
        return;
      obj[method] = function(...args: any[]) {
        const result = native.call(this, ...args);
        cb(this, result);
        return result;
      };
    }

    private _interceptNativeGetter(obj: any, prop: string, cb: (thisObj: any, result: any) => void) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, prop)!;
      Object.defineProperty(obj, prop, {
        ...descriptor,
        get: function() {
          const result = descriptor.get!.call(this);
          cb(this, result);
          return result;
        },
      });
    }

    private _invalidateStyleSheet(sheet: CSSStyleSheet) {
      if (this._readingStyleSheet)
        return;
      this._staleStyleSheets.add(sheet);
      if (sheet.href !== null)
        this._allStyleSheetsWithUrlOverride.add(sheet);
      if (sheet.ownerNode && sheet.ownerNode.nodeName === 'STYLE')
        this._invalidateNode(sheet.ownerNode);
    }

    private _updateStyleElementStyleSheetTextIfNeeded(sheet: CSSStyleSheet): string | undefined {
      const data = ensureCachedData(sheet);
      if (this._staleStyleSheets.has(sheet)) {
        this._staleStyleSheets.delete(sheet);
        try {
          data.cssText = this._getSheetText(sheet);
        } catch (e) {
          // Sometimes we cannot access cross-origin stylesheets.
        }
      }
      return data.cssText;
    }

    // Returns either content, ref, or no override.
    private _updateLinkStyleSheetTextIfNeeded(sheet: CSSStyleSheet, snapshotNumber: number): string | number | undefined {
      const data = ensureCachedData(sheet);
      if (this._staleStyleSheets.has(sheet)) {
        this._staleStyleSheets.delete(sheet);
        try {
          data.cssText = this._getSheetText(sheet);
          data.cssRef = snapshotNumber;
          return data.cssText;
        } catch (e) {
          // Sometimes we cannot access cross-origin stylesheets.
        }
      }
      return data.cssRef === undefined ? undefined : snapshotNumber - data.cssRef;
    }

    private _invalidateNode(node: Node | null) {
      while (node) {
        ensureCachedData(node).ref = undefined;
        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && (node as ShadowRoot).host)
          node = (node as ShadowRoot).host;
        else
          node = node.parentNode;
      }
    }

    private _handleMutations(list: MutationRecord[]) {
      for (const mutation of list)
        this._invalidateNode(mutation.target);
    }

    markIframe(iframeElement: HTMLIFrameElement | HTMLFrameElement, frameId: string) {
      (iframeElement as any)[kSnapshotFrameId] = frameId;
    }

    forceSnapshot(snapshotId: string) {
      this._streamSnapshot(snapshotId);
    }

    private _streamSnapshot(snapshotId?: string) {
      if (this._timer) {
        clearTimeout(this._timer);
        this._timer = undefined;
      }
      try {
        const snapshot = this._captureSnapshot(snapshotId);
        (window as any)[kSnapshotBinding](snapshot).catch((e: any) => {});
      } catch (e) {
      }
      this._timer = setTimeout(() => this._streamSnapshot(), 100);
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
      this._readingStyleSheet = true;
      try {
        const rules: string[] = [];
        for (const rule of sheet.cssRules)
          rules.push(rule.cssText);
        return rules.join('\n');
      } finally {
        this._readingStyleSheet = false;
      }
    }

    private _captureSnapshot(snapshotId?: string): SnapshotData {
      const snapshotNumber = ++this._lastSnapshotNumber;
      const win = window;
      const doc = win.document;

      // Ensure we are up-to-date.
      this._handleMutations(this._observer.takeRecords());
      for (const input of doc.querySelectorAll('input, textarea')) {
        const value = (input as HTMLInputElement | HTMLTextAreaElement).value;
        const data = ensureCachedData(input);
        if (data.value !== value)
          this._invalidateNode(input);
      }

      let nodeCounter = 0;

      const visit = (node: Node | ShadowRoot): NodeSnapshot | undefined => {
        const nodeType = node.nodeType;
        const nodeName = nodeType === Node.DOCUMENT_FRAGMENT_NODE ? 'template' : node.nodeName;

        if (nodeType !== Node.ELEMENT_NODE &&
            nodeType !== Node.DOCUMENT_FRAGMENT_NODE &&
            nodeType !== Node.TEXT_NODE)
          return;
        if (nodeName === 'SCRIPT' || nodeName === 'BASE')
          return;
        if (this._removeNoScript && nodeName === 'NOSCRIPT')
          return;

        const data = ensureCachedData(node);
        if (data.ref)
          return [[ snapshotNumber - data.ref[0], data.ref[1] ]];
        nodeCounter++;
        data.ref = [snapshotNumber, nodeCounter - 1];
        // ---------- No returns without the data after this point -----------
        // ---------- Otherwise nodeCounter is wrong               -----------

        if (nodeType === Node.TEXT_NODE)
          return escapeText(node.nodeValue || '');

        if (nodeName === 'STYLE') {
          const sheet = (node as HTMLStyleElement).sheet;
          let cssText: string | undefined;
          if (sheet)
            cssText = this._updateStyleElementStyleSheetTextIfNeeded(sheet);
          nodeCounter++;  // Compensate for the extra text node in the list.
          return ['style', {}, escapeText(cssText || node.textContent || '')];
        }

        const attrs: { [attr: string]: string } = {};
        const result: NodeSnapshot = [nodeName, attrs];

        if (nodeType === Node.DOCUMENT_FRAGMENT_NODE)
          attrs[kShadowAttribute] = 'open';

        if (nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          // if (node === target)
          //   attrs[' __playwright_target__] = '';
          for (let i = 0; i < element.attributes.length; i++) {
            const name = element.attributes[i].name;
            let value = element.attributes[i].value;
            if (name === 'value' && (nodeName === 'INPUT' || nodeName === 'TEXTAREA'))
              continue;
            if (name === 'checked' || name === 'disabled' || name === 'checked')
              continue;
            if (nodeName === 'LINK' && name === 'integrity')
              continue;
            if (name === 'src' && (nodeName === 'IFRAME' || nodeName === 'FRAME')) {
              // TODO: handle srcdoc?
              const frameId = (element as any)[kSnapshotFrameId];
              value = frameId || 'data:text/html,<body>Snapshot is not available</body>';
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
            attrs[name] = escapeAttribute(value);
          }
          if (nodeName === 'INPUT') {
            const value = (element as HTMLInputElement).value;
            data.value = value;
            attrs['value'] = escapeAttribute(value);
          }
          if ((element as any).checked)
            attrs['checked'] = '';
          if ((element as any).disabled)
            attrs['disabled'] = '';
          if ((element as any).readOnly)
            attrs['readonly'] = '';
          if (element.scrollTop)
            attrs[kScrollTopAttribute] = '' + element.scrollTop;
          if (element.scrollLeft)
            attrs[kScrollLeftAttribute] = '' + element.scrollLeft;

          if (element.shadowRoot) {
            const child = visit(element.shadowRoot);
            if (child)
              result.push(child);
          }
        }

        if (nodeName === 'HEAD') {
          const base: NodeSnapshot = ['base', { 'href': document.baseURI }];
          for (let child = node.firstChild; child; child = child.nextSibling) {
            if (child.nodeName === 'BASE') {
              base[1]['href'] = escapeAttribute((child as HTMLBaseElement).href);
              base[1]['target'] = escapeAttribute((child as HTMLBaseElement).target);
            }
          }
          nodeCounter++;  // Compensate for the extra 'base' node in the list.
          result.push(base);
        }

        if (nodeName === 'TEXTAREA') {
          nodeCounter++;  // Compensate for the extra text node in the list.
          const value = (node as HTMLTextAreaElement).value;
          data.value = value;
          result.push(escapeText(value));
        } else {
          for (let child = node.firstChild; child; child = child.nextSibling) {
            const snapshotted = visit(child);
            if (snapshotted)
              result.push(snapshotted);
          }
        }

        if (result.length === 2 && !Object.keys(attrs).length)
          result.pop();  // Remove empty attrs when there are no children.
        return result;
      };

      const html = doc.documentElement ? visit(doc.documentElement)! : (['html', {}] as NodeSnapshot);
      const result: SnapshotData = {
        html,
        doctype: doc.doctype ? doc.doctype.name : undefined,
        resourceOverrides: [],
        viewport: {
          width: Math.max(doc.body ? doc.body.offsetWidth : 0, doc.documentElement ? doc.documentElement.offsetWidth : 0),
          height: Math.max(doc.body ? doc.body.offsetHeight : 0, doc.documentElement ? doc.documentElement.offsetHeight : 0),
        },
        url: location.href,
        snapshotId,
      };

      for (const sheet of this._allStyleSheetsWithUrlOverride) {
        const content = this._updateLinkStyleSheetTextIfNeeded(sheet, snapshotNumber);
        if (content === undefined) {
          // Unable to capture stylsheet contents.
          continue;
        }
        const base = this._getSheetBase(sheet);
        const url = removeHash(this._resolveUrl(base, sheet.href!));
        result.resourceOverrides.push({ url, content });
      }

      return result;
    }
  }

  (window as any)[kSnapshotStreamer] = new Streamer();
}

export function snapshotScript() {
  function applyPlaywrightAttributes(shadowAttribute: string, scrollTopAttribute: string, scrollLeftAttribute: string) {
    const scrollTops: Element[] = [];
    const scrollLefts: Element[] = [];

    const visit = (root: Document | ShadowRoot) => {
      // Collect all scrolled elements for later use.
      for (const e of root.querySelectorAll(`[${scrollTopAttribute}]`))
        scrollTops.push(e);
      for (const e of root.querySelectorAll(`[${scrollLeftAttribute}]`))
        scrollLefts.push(e);

      for (const iframe of root.querySelectorAll('iframe')) {
        const src = iframe.getAttribute('src') || '';
        if (src.startsWith('data:text/html'))
          continue;
        // Rewrite iframes to use snapshot url (relative to window.location)
        // instead of begin relative to the <base> tag.
        const index = location.pathname.lastIndexOf('/');
        if (index === -1)
          continue;
        const pathname = location.pathname.substring(0, index + 1) + src;
        const href = location.href.substring(0, location.href.indexOf(location.pathname)) + pathname;
        iframe.setAttribute('src', href);
      }

      for (const element of root.querySelectorAll(`template[${shadowAttribute}]`)) {
        const template = element as HTMLTemplateElement;
        const shadowRoot = template.parentElement!.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(template.content);
        template.remove();
        visit(shadowRoot);
      }
    };
    visit(document);

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

  const kShadowAttribute = '__playwright_shadow_root_';
  const kScrollTopAttribute = '__playwright_scroll_top_';
  const kScrollLeftAttribute = '__playwright_scroll_left_';
  return `\n(${applyPlaywrightAttributes.toString()})('${kShadowAttribute}', '${kScrollTopAttribute}', '${kScrollLeftAttribute}')`;
}
