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

import { NodeSnapshot } from './snapshot';

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
  snapshotId: string,
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
    cached?: any[], // Cached values to determine whether the snapshot will be the same.
    ref?: [number, number], // Previous snapshotNumber and nodeIndex.
    attributesCached?: boolean, // Whether node attributes have not changed.
    cssText?: string, // Text for stylesheets.
    cssRef?: number, // Previous snapshotNumber for overridden stylesheets.
  };
  function ensureCachedData(obj: any): CachedData {
    if (!obj[kCachedData])
      obj[kCachedData] = {};
    return obj[kCachedData];
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
    private _staleStyleSheets = new Set<CSSStyleSheet>();
    private _allStyleSheetsWithUrlOverride = new Set<CSSStyleSheet>();
    private _readingStyleSheet = false;  // To avoid invalidating due to our own reads.
    private _fakeBase: HTMLBaseElement;
    private _observer: MutationObserver;

    constructor() {
      this._interceptNativeMethod(window.CSSStyleSheet.prototype, 'insertRule', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));
      this._interceptNativeMethod(window.CSSStyleSheet.prototype, 'deleteRule', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));
      this._interceptNativeMethod(window.CSSStyleSheet.prototype, 'addRule', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));
      this._interceptNativeMethod(window.CSSStyleSheet.prototype, 'removeRule', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));
      this._interceptNativeGetter(window.CSSStyleSheet.prototype, 'rules', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));
      this._interceptNativeGetter(window.CSSStyleSheet.prototype, 'cssRules', (sheet: CSSStyleSheet) => this._invalidateStyleSheet(sheet));

      this._fakeBase = document.createElement('base');

      this._observer = new MutationObserver(list => this._handleMutations(list));
      const observerConfig = { attributes: true, subtree: true };
      this._observer.observe(document, observerConfig);

      this._streamSnapshot('snapshot@initial');
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

    private _handleMutations(list: MutationRecord[]) {
      for (const mutation of list)
        ensureCachedData(mutation.target).attributesCached = undefined;
    }

    private _invalidateStyleSheet(sheet: CSSStyleSheet) {
      if (this._readingStyleSheet)
        return;
      this._staleStyleSheets.add(sheet);
      if (sheet.href !== null)
        this._allStyleSheetsWithUrlOverride.add(sheet);
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

    markIframe(iframeElement: HTMLIFrameElement | HTMLFrameElement, frameId: string) {
      (iframeElement as any)[kSnapshotFrameId] = frameId;
    }

    forceSnapshot(snapshotId: string) {
      this._streamSnapshot(snapshotId);
    }

    private _streamSnapshot(snapshotId: string) {
      if (this._timer) {
        clearTimeout(this._timer);
        this._timer = undefined;
      }
      try {
        const snapshot = this._captureSnapshot(snapshotId);
        (window as any)[kSnapshotBinding](snapshot).catch((e: any) => {});
      } catch (e) {
      }
      this._timer = setTimeout(() => this._streamSnapshot(`snapshot@${performance.now()}`), 100);
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

    private _captureSnapshot(snapshotId: string): SnapshotData {
      const snapshotNumber = ++this._lastSnapshotNumber;
      let nodeCounter = 0;
      let shadowDomNesting = 0;

      // Ensure we are up to date.
      this._handleMutations(this._observer.takeRecords());

      const visitNode = (node: Node | ShadowRoot): { equals: boolean, n: NodeSnapshot } | undefined => {
        const nodeType = node.nodeType;
        const nodeName = nodeType === Node.DOCUMENT_FRAGMENT_NODE ? 'template' : node.nodeName;

        if (nodeType !== Node.ELEMENT_NODE &&
            nodeType !== Node.DOCUMENT_FRAGMENT_NODE &&
            nodeType !== Node.TEXT_NODE)
          return;
        if (nodeName === 'SCRIPT')
          return;
        if (this._removeNoScript && nodeName === 'NOSCRIPT')
          return;

        const data = ensureCachedData(node);
        const values: any[] = [];
        let equals = !!data.cached;
        let extraNodes = 0;

        const expectValue = (value: any) => {
          equals = equals && data.cached![values.length] === value;
          values.push(value);
        };

        const checkAndReturn = (n: NodeSnapshot): { equals: boolean, n: NodeSnapshot } => {
          data.attributesCached = true;
          if (equals)
            return { equals: true, n: [[ snapshotNumber - data.ref![0], data.ref![1] ]] };
          nodeCounter += extraNodes;
          data.ref = [snapshotNumber, nodeCounter++];
          data.cached = values;
          return { equals: false, n };
        };

        if (nodeType === Node.TEXT_NODE) {
          const value = node.nodeValue || '';
          expectValue(value);
          return checkAndReturn(value);
        }

        if (nodeName === 'STYLE') {
          const sheet = (node as HTMLStyleElement).sheet;
          let cssText: string | undefined;
          if (sheet)
            cssText = this._updateStyleElementStyleSheetTextIfNeeded(sheet);
          cssText = cssText || node.textContent || '';
          expectValue(cssText);
          // Compensate for the extra 'cssText' text node.
          extraNodes++;
          return checkAndReturn(['style', {}, cssText]);
        }

        const attrs: { [attr: string]: string } = {};
        const result: NodeSnapshot = [nodeName, attrs];

        const visitChild = (child: Node) => {
          const snapshotted = visitNode(child);
          if (snapshotted) {
            result.push(snapshotted.n);
            expectValue(child);
            equals = equals && snapshotted.equals;
          }
        };

        if (nodeType === Node.DOCUMENT_FRAGMENT_NODE)
          attrs[kShadowAttribute] = 'open';

        if (nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          // if (node === target)
          //   attrs[' __playwright_target__] = '';
          if (nodeName === 'INPUT') {
            const value = (element as HTMLInputElement).value;
            expectValue('value');
            expectValue(value);
            attrs['value'] = value;
            if ((element as HTMLInputElement).checked) {
              expectValue('checked');
              attrs['checked'] = '';
            }
          }
          if (element === document.scrollingElement) {
            // TODO: restoring scroll positions of all elements
            // is somewhat expensive. Figure this out.
            if (element.scrollTop) {
              expectValue(kScrollTopAttribute);
              expectValue(element.scrollTop);
              attrs[kScrollTopAttribute] = '' + element.scrollTop;
            }
            if (element.scrollLeft) {
              expectValue(kScrollLeftAttribute);
              expectValue(element.scrollLeft);
              attrs[kScrollLeftAttribute] = '' + element.scrollLeft;
            }
          }
          if (element.shadowRoot) {
            ++shadowDomNesting;
            visitChild(element.shadowRoot);
            --shadowDomNesting;
          }
        }

        if (nodeName === 'TEXTAREA') {
          const value = (node as HTMLTextAreaElement).value;
          expectValue(value);
          extraNodes++; // Compensate for the extra text node.
          result.push(value);
        } else {
          if (nodeName === 'HEAD') {
            // Insert fake <base> first, to ensure all <link> elements use the proper base uri.
            this._fakeBase.setAttribute('href', document.baseURI);
            visitChild(this._fakeBase);
          }
          for (let child = node.firstChild; child; child = child.nextSibling)
            visitChild(child);
        }

        // We can skip attributes comparison because nothing else has changed,
        // and mutation observer didn't tell us about the attributes.
        if (equals && data.attributesCached && !shadowDomNesting)
          return checkAndReturn(result);

        if (nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          for (let i = 0; i < element.attributes.length; i++) {
            const name = element.attributes[i].name;
            if (name === 'value' && (nodeName === 'INPUT' || nodeName === 'TEXTAREA'))
              continue;
            if (nodeName === 'LINK' && name === 'integrity')
              continue;
            let value = element.attributes[i].value;
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
            expectValue(name);
            expectValue(value);
            attrs[name] = value;
          }
        }

        if (result.length === 2 && !Object.keys(attrs).length)
          result.pop();  // Remove empty attrs when there are no children.
        return checkAndReturn(result);
      };

      let html: NodeSnapshot;
      if (document.documentElement)
        html = visitNode(document.documentElement)!.n;
      else
        html = ['html'];

      const result: SnapshotData = {
        html,
        doctype: document.doctype ? document.doctype.name : undefined,
        resourceOverrides: [],
        viewport: {
          width: Math.max(document.body ? document.body.offsetWidth : 0, document.documentElement ? document.documentElement.offsetWidth : 0),
          height: Math.max(document.body ? document.body.offsetHeight : 0, document.documentElement ? document.documentElement.offsetHeight : 0),
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
