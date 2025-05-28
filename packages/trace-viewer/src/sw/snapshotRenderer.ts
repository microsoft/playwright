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

import { escapeHTMLAttribute, escapeHTML } from '@isomorphic/stringUtils';

import type { FrameSnapshot, NodeNameAttributesChildNodesSnapshot, NodeSnapshot, RenderedFrameSnapshot, ResourceSnapshot, SubtreeReferenceSnapshot } from '@trace/snapshot';
import type { PageEntry } from '../types/entries';
import type { LRUCache } from './lruCache';

function findClosest<T>(items: T[], metric: (v: T) => number, target: number) {
  return items.find((item, index) => {
    if (index === items.length - 1)
      return true;
    const next = items[index + 1];
    return Math.abs(metric(item) - target) < Math.abs(metric(next) - target);
  });
}

function isNodeNameAttributesChildNodesSnapshot(n: NodeSnapshot): n is NodeNameAttributesChildNodesSnapshot {
  return Array.isArray(n) && typeof n[0] === 'string';
}

function isSubtreeReferenceSnapshot(n: NodeSnapshot): n is SubtreeReferenceSnapshot {
  return Array.isArray(n) && Array.isArray(n[0]);
}

export class SnapshotRenderer {
  private _htmlCache: LRUCache<SnapshotRenderer, string>;
  private _snapshots: FrameSnapshot[];
  private _index: number;
  readonly snapshotName: string | undefined;
  private _resources: ResourceSnapshot[];
  private _snapshot: FrameSnapshot;
  private _callId: string;
  private _screencastFrames: PageEntry['screencastFrames'];

  constructor(htmlCache: LRUCache<SnapshotRenderer, string>, resources: ResourceSnapshot[], snapshots: FrameSnapshot[], screencastFrames: PageEntry['screencastFrames'], index: number) {
    this._htmlCache = htmlCache;
    this._resources = resources;
    this._snapshots = snapshots;
    this._index = index;
    this._snapshot = snapshots[index];
    this._callId = snapshots[index].callId;
    this._screencastFrames = screencastFrames;
    this.snapshotName = snapshots[index].snapshotName;
  }

  snapshot(): FrameSnapshot {
    return this._snapshots[this._index];
  }

  viewport(): { width: number, height: number } {
    return this._snapshots[this._index].viewport;
  }

  closestScreenshot(): string | undefined {
    const { wallTime, timestamp } = this.snapshot();
    const closestFrame = (wallTime && this._screencastFrames[0]?.frameSwapWallTime)
      ? findClosest(this._screencastFrames, frame => frame.frameSwapWallTime!, wallTime)
      : findClosest(this._screencastFrames, frame => frame.timestamp, timestamp);
    return closestFrame?.sha1;
  }

  render(): RenderedFrameSnapshot {
    const result: string[] = [];
    const visit = (n: NodeSnapshot, snapshotIndex: number, parentTag: string | undefined, parentAttrs: [string, string][] | undefined) => {
      // Text node.
      if (typeof n === 'string') {
        // Best-effort Electron support: rewrite custom protocol in url() links in stylesheets.
        // Old snapshotter was sending lower-case.
        if (parentTag === 'STYLE' || parentTag === 'style')
          result.push(escapeURLsInStyleSheet(rewriteURLsInStyleSheetForCustomProtocol(n)));
        else
          result.push(escapeHTML(n));
        return;
      }

      if (isSubtreeReferenceSnapshot(n)) {
        // Node reference.
        const referenceIndex = snapshotIndex - n[0][0];
        if (referenceIndex >= 0 && referenceIndex <= snapshotIndex) {
          const nodes = snapshotNodes(this._snapshots[referenceIndex]);
          const nodeIndex = n[0][1];
          if (nodeIndex >= 0 && nodeIndex < nodes.length)
            return visit(nodes[nodeIndex], referenceIndex, parentTag, parentAttrs);
        }
      } else if (isNodeNameAttributesChildNodesSnapshot(n)) {
        const [name, nodeAttrs, ...children] = n;
        // Element node.
        // Note that <noscript> will not be rendered by default in the trace viewer, because
        // JS is enabled. So rename it to <x-noscript>.
        const nodeName = name === 'NOSCRIPT' ? 'X-NOSCRIPT' : name;
        const attrs = Object.entries(nodeAttrs || {});
        result.push('<', nodeName);
        const kCurrentSrcAttribute = '__playwright_current_src__';
        const isFrame = nodeName === 'IFRAME' || nodeName === 'FRAME';
        const isAnchor = nodeName === 'A';
        const isImg = nodeName === 'IMG';
        const isImgWithCurrentSrc = isImg && attrs.some(a => a[0] === kCurrentSrcAttribute);
        const isSourceInsidePictureWithCurrentSrc = nodeName === 'SOURCE' && parentTag === 'PICTURE' && parentAttrs?.some(a => a[0] === kCurrentSrcAttribute);
        for (const [attr, value] of attrs) {
          let attrName = attr;
          if (isFrame && attr.toLowerCase() === 'src') {
            // Never set relative URLs as <iframe src> - they start fetching frames immediately.
            attrName = '__playwright_src__';
          }
          if (isImg && attr === kCurrentSrcAttribute) {
            // Render currentSrc for images, so that trace viewer does not accidentally
            // resolve srcset to a different source.
            attrName = 'src';
          }
          if (['src', 'srcset'].includes(attr.toLowerCase()) && (isImgWithCurrentSrc || isSourceInsidePictureWithCurrentSrc)) {
            // Disable actual <img src>, <img srcset>, <source src> and <source srcset> if
            // we will be using the currentSrc instead.
            attrName = '_' + attrName;
          }
          let attrValue = value;
          if (isAnchor && attr.toLowerCase() === 'href')
            attrValue = 'link://' + value;
          else if (attr.toLowerCase() === 'href' || attr.toLowerCase() === 'src' || attr === kCurrentSrcAttribute)
            attrValue = rewriteURLForCustomProtocol(value);
          result.push(' ', attrName, '="', escapeHTMLAttribute(attrValue), '"');
        }
        result.push('>');
        for (const child of children)
          visit(child, snapshotIndex, nodeName, attrs);
        if (!autoClosing.has(nodeName))
          result.push('</', nodeName, '>');
        return;
      } else {
        // Why are we here? Let's not throw, just in case.
        return;
      }
    };

    const snapshot = this._snapshot;
    const html = this._htmlCache.getOrCompute(this, () => {
      visit(snapshot.html, this._index, undefined, undefined);
      const prefix = snapshot.doctype ? `<!DOCTYPE ${snapshot.doctype}>` : '';
      const html = prefix + [
        // Hide the document in order to prevent flickering. We will unhide once script has processed shadow.
        '<style>*,*::before,*::after { visibility: hidden }</style>',
        `<script>${snapshotScript(this.viewport(), this._callId, this.snapshotName)}</script>`
      ].join('') + result.join('');
      return { value: html, size: html.length };
    });

    return { html, pageId: snapshot.pageId, frameId: snapshot.frameId, index: this._index };
  }

  resourceByUrl(url: string, method: string): ResourceSnapshot | undefined {
    const snapshot = this._snapshot;
    let sameFrameResource: ResourceSnapshot | undefined;
    let otherFrameResource: ResourceSnapshot | undefined;

    for (const resource of this._resources) {
      // Only use resources that received response before the snapshot.
      // Note that both snapshot time and request time are taken in the same Node process.
      if (typeof resource._monotonicTime === 'number' && resource._monotonicTime >= snapshot.timestamp)
        break;
      if (resource.response.status === 304) {
        // "Not Modified" responses are issued when browser requests the same resource
        // multiple times, meanwhile indicating that it has the response cached.
        //
        // When rendering the snapshot, browser most likely will not have the resource cached,
        // so we should respond with the real content instead, picking the last response that
        // is not 304.
        continue;
      }
      if (resource.request.url === url && resource.request.method === method) {
        // Pick the last resource with matching url - most likely it was used
        // at the time of snapshot, not the earlier aborted resource with the same url.
        if (resource._frameref === snapshot.frameId)
          sameFrameResource = resource;
        else
          otherFrameResource = resource;
      }
    }

    // First try locating exact resource belonging to this frame,
    // then fall back to resource with this URL to account for memory cache.
    let result = sameFrameResource ?? otherFrameResource;
    if (result && method.toUpperCase() === 'GET') {
      // Patch override if necessary.
      for (const o of snapshot.resourceOverrides) {
        if (url === o.url && o.sha1) {
          result = {
            ...result,
            response: {
              ...result.response,
              content: {
                ...result.response.content,
                _sha1: o.sha1,
              }
            },
          };
          break;
        }
      }
    }

    return result;
  }
}

const autoClosing = new Set(['AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT', 'KEYGEN', 'LINK', 'MENUITEM', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR']);

function snapshotNodes(snapshot: FrameSnapshot): NodeSnapshot[] {
  if (!(snapshot as any)._nodes) {
    const nodes: NodeSnapshot[] = [];
    const visit = (n: NodeSnapshot) => {
      if (typeof n === 'string') {
        nodes.push(n);
      } else if (isNodeNameAttributesChildNodesSnapshot(n)) {
        const [,, ...children] = n;
        for (const child of children)
          visit(child);
        nodes.push(n);
      }
    };
    visit(snapshot.html);
    (snapshot as any)._nodes = nodes;
  }
  return (snapshot as any)._nodes;
}

type ViewportSize = { width: number, height: number };
type BoundingRect = { left: number, top: number, right: number, bottom: number };
type FrameBoundingRectsInfo = {
  viewport: ViewportSize;
  frames: WeakMap<Element, {
    boundingRect: BoundingRect;
    scrollLeft: number;
    scrollTop: number;
  }>;
};

declare global {
  interface Window {
    __playwright_frame_bounding_rects__: FrameBoundingRectsInfo;
  }
}

function snapshotScript(viewport: ViewportSize, ...targetIds: (string | undefined)[]) {
  function applyPlaywrightAttributes(unwrapPopoutUrl: (url: string) => string, viewport: ViewportSize, ...targetIds: (string | undefined)[]) {
    const searchParams = new URLSearchParams(location.search);
    const shouldPopulateCanvasFromScreenshot = searchParams.has('shouldPopulateCanvasFromScreenshot');
    const isUnderTest = searchParams.has('isUnderTest');

    // info to recursively compute canvas position relative to the top snapshot frame.
    // Before rendering each iframe, its parent extracts the '__playwright_canvas_render_info__' attribute
    // value and keeps in this variable. It can then remove the attribute and render the element,
    // which will eventually trigger the same process inside the iframe recursively.
    // When there's a canvas to render, we iterate over its ancestor frames to compute
    // its position relative to the top snapshot frame.
    const frameBoundingRectsInfo = {
      viewport,
      frames: new WeakMap(),
    };
    window['__playwright_frame_bounding_rects__'] = frameBoundingRectsInfo;

    const kPointerWarningTitle = 'Recorded click position in absolute coordinates did not' +
        ' match the center of the clicked element. This is likely due to a difference between' +
        ' the test runner and the trace viewer operating systems.';

    const scrollTops: Element[] = [];
    const scrollLefts: Element[] = [];
    const targetElements: Element[] = [];
    const canvasElements: HTMLCanvasElement[] = [];

    let topSnapshotWindow: Window = window;
    while (topSnapshotWindow !== topSnapshotWindow.parent && !topSnapshotWindow.location.pathname.match(/\/page@[a-z0-9]+$/))
      topSnapshotWindow = topSnapshotWindow.parent;

    const visit = (root: Document | ShadowRoot) => {
      // Collect all scrolled elements for later use.
      for (const e of root.querySelectorAll(`[__playwright_scroll_top_]`))
        scrollTops.push(e);
      for (const e of root.querySelectorAll(`[__playwright_scroll_left_]`))
        scrollLefts.push(e);

      for (const element of root.querySelectorAll(`[__playwright_value_]`)) {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
        if (inputElement.type !== 'file')
          inputElement.value = inputElement.getAttribute('__playwright_value_')!;
        element.removeAttribute('__playwright_value_');
      }
      for (const element of root.querySelectorAll(`[__playwright_checked_]`)) {
        (element as HTMLInputElement).checked = element.getAttribute('__playwright_checked_') === 'true';
        element.removeAttribute('__playwright_checked_');
      }
      for (const element of root.querySelectorAll(`[__playwright_selected_]`)) {
        (element as HTMLOptionElement).selected = element.getAttribute('__playwright_selected_') === 'true';
        element.removeAttribute('__playwright_selected_');
      }
      for (const element of root.querySelectorAll(`[__playwright_popover_open_]`)) {
        try {
          (element as HTMLElement).showPopover();
        } catch {
        }
        element.removeAttribute('__playwright_popover_open_');
      }
      for (const element of root.querySelectorAll(`[__playwright_dialog_open_]`)) {
        try {
          if (element.getAttribute('__playwright_dialog_open_') === 'modal')
            (element as HTMLDialogElement).showModal();
          else
            (element as HTMLDialogElement).show();
        } catch {
        }
        element.removeAttribute('__playwright_dialog_open_');
      }

      for (const targetId of targetIds) {
        for (const target of root.querySelectorAll(`[__playwright_target__="${targetId}"]`)) {
          const style = (target as HTMLElement).style;
          style.outline = '2px solid #006ab1';
          style.backgroundColor = '#6fa8dc7f';
          targetElements.push(target);
        }
      }

      for (const iframe of root.querySelectorAll('iframe, frame')) {
        const boundingRectJson = iframe.getAttribute('__playwright_bounding_rect__');
        iframe.removeAttribute('__playwright_bounding_rect__');
        const boundingRect = boundingRectJson ? JSON.parse(boundingRectJson) : undefined;
        if (boundingRect)
          frameBoundingRectsInfo.frames.set(iframe, { boundingRect, scrollLeft: 0, scrollTop: 0 });
        const src = iframe.getAttribute('__playwright_src__');
        if (!src) {
          iframe.setAttribute('src', 'data:text/html,<body style="background: #ddd"></body>');
        } else {
          // Retain query parameters to inherit name=, time=, pointX=, pointY= and other values from parent.
          const url = new URL(unwrapPopoutUrl(window.location.href));
          // We can be loading iframe from within iframe, reset base to be absolute.
          const index = url.pathname.lastIndexOf('/snapshot/');
          if (index !== -1)
            url.pathname = url.pathname.substring(0, index + 1);
          url.pathname += src.substring(1);
          iframe.setAttribute('src', url.toString());
        }
      }

      {
        const body = root.querySelector(`body[__playwright_custom_elements__]`);
        if (body && window.customElements) {
          const customElements = (body.getAttribute('__playwright_custom_elements__') || '').split(',');
          for (const elementName of customElements)
            window.customElements.define(elementName, class extends HTMLElement {});
        }
      }

      for (const element of root.querySelectorAll(`template[__playwright_shadow_root_]`)) {
        const template = element as HTMLTemplateElement;
        const shadowRoot = template.parentElement!.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(template.content);
        template.remove();
        visit(shadowRoot);
      }

      if ('adoptedStyleSheets' in (root as any)) {
        const adoptedSheets: CSSStyleSheet[] = [...(root as any).adoptedStyleSheets];
        for (const element of root.querySelectorAll(`template[__playwright_style_sheet_]`)) {
          const template = element as HTMLTemplateElement;
          const sheet = new CSSStyleSheet();
          (sheet as any).replaceSync(template.getAttribute('__playwright_style_sheet_'));
          adoptedSheets.push(sheet);
        }
        (root as any).adoptedStyleSheets = adoptedSheets;
      }

      canvasElements.push(...root.querySelectorAll('canvas'));
    };

    const onLoad = () => {
      window.removeEventListener('load', onLoad);
      for (const element of scrollTops) {
        element.scrollTop = +element.getAttribute('__playwright_scroll_top_')!;
        element.removeAttribute('__playwright_scroll_top_');
        if (frameBoundingRectsInfo.frames.has(element))
          frameBoundingRectsInfo.frames.get(element)!.scrollTop = element.scrollTop;
      }
      for (const element of scrollLefts) {
        element.scrollLeft = +element.getAttribute('__playwright_scroll_left_')!;
        element.removeAttribute('__playwright_scroll_left_');
        if (frameBoundingRectsInfo.frames.has(element))
          frameBoundingRectsInfo.frames.get(element)!.scrollLeft = element.scrollTop;
      }

      document.styleSheets[0].disabled = true;

      const search = new URL(window.location.href).searchParams;
      const isTopFrame = window === topSnapshotWindow;

      if (search.get('pointX') && search.get('pointY')) {
        const pointX = +search.get('pointX')!;
        const pointY = +search.get('pointY')!;
        const hasInputTarget = search.has('hasInputTarget');
        const hasTargetElements = targetElements.length > 0;
        const roots = document.documentElement ? [document.documentElement] : [];
        for (const target of (hasTargetElements ? targetElements : roots)) {
          const pointElement = document.createElement('x-pw-pointer');
          pointElement.style.position = 'fixed';
          pointElement.style.backgroundColor = '#f44336';
          pointElement.style.width = '20px';
          pointElement.style.height = '20px';
          pointElement.style.borderRadius = '10px';
          pointElement.style.margin = '-10px 0 0 -10px';
          pointElement.style.zIndex = '2147483646';
          pointElement.style.display = 'flex';
          pointElement.style.alignItems = 'center';
          pointElement.style.justifyContent = 'center';
          if (hasTargetElements) {
            // Sometimes there are layout discrepancies between recording and rendering, e.g. fonts,
            // that may place the point at the wrong place. To avoid confusion, we just show the
            // point in the middle of the target element.
            const box = target.getBoundingClientRect();
            const centerX = (box.left + box.width / 2);
            const centerY = (box.top + box.height / 2);
            pointElement.style.left = centerX + 'px';
            pointElement.style.top = centerY + 'px';
            // "Warning symbol" indicates that action point is not 100% correct.
            // Note that action point is relative to the top frame, so we can only compare in the top frame.
            if (isTopFrame && (Math.abs(centerX - pointX) >= 10 || Math.abs(centerY - pointY) >= 10)) {
              const warningElement = document.createElement('x-pw-pointer-warning');
              warningElement.textContent = '⚠';
              warningElement.style.fontSize = '19px';
              warningElement.style.color = 'white';
              warningElement.style.marginTop = '-3.5px';
              warningElement.style.userSelect = 'none';
              pointElement.appendChild(warningElement);
              pointElement.setAttribute('title', kPointerWarningTitle);
            }
            document.documentElement.appendChild(pointElement);
          } else if (isTopFrame && !hasInputTarget) {
            // For actions without a target element, e.g. page.mouse.move(),
            // show the point at the recorded location, which is relative to the top frame.
            pointElement.style.left = pointX + 'px';
            pointElement.style.top = pointY + 'px';
            document.documentElement.appendChild(pointElement);
          }
        }
      }

      if (canvasElements.length > 0) {
        function drawCheckerboard(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
          function createCheckerboardPattern() {
            const pattern = document.createElement('canvas');
            pattern.width = pattern.width / Math.floor(pattern.width / 24);
            pattern.height = pattern.height / Math.floor(pattern.height / 24);
            const context = pattern.getContext('2d')!;
            context.fillStyle = 'lightgray';
            context.fillRect(0, 0, pattern.width, pattern.height);
            context.fillStyle = 'white';
            context.fillRect(0, 0, pattern.width / 2, pattern.height / 2);
            context.fillRect(pattern.width / 2, pattern.height / 2, pattern.width, pattern.height);
            return context.createPattern(pattern, 'repeat')!;
          }

          context.fillStyle = createCheckerboardPattern();
          context.fillRect(0, 0, canvas.width, canvas.height);
        }

        const img = new Image();
        img.onload = () => {
          for (const canvas of canvasElements) {
            const context = canvas.getContext('2d')!;

            const boundingRectAttribute = canvas.getAttribute('__playwright_bounding_rect__');
            canvas.removeAttribute('__playwright_bounding_rect__');
            if (!boundingRectAttribute)
              continue;

            let boundingRect: { left: number, top: number, right: number, bottom: number };
            try {
              boundingRect = JSON.parse(boundingRectAttribute);
            } catch (e) {
              continue;
            }

            let currWindow: Window = window;
            while (currWindow !== topSnapshotWindow) {
              const iframe = currWindow.frameElement!;
              currWindow = currWindow.parent;

              const iframeInfo = currWindow['__playwright_frame_bounding_rects__']?.frames.get(iframe);
              if (!iframeInfo?.boundingRect)
                break;

              const leftOffset = iframeInfo.boundingRect.left - iframeInfo.scrollLeft;
              const topOffset = iframeInfo.boundingRect.top - iframeInfo.scrollTop;

              boundingRect.left += leftOffset;
              boundingRect.top += topOffset;
              boundingRect.right += leftOffset;
              boundingRect.bottom += topOffset;
            }

            const { width, height } = topSnapshotWindow['__playwright_frame_bounding_rects__'].viewport;

            boundingRect.left = boundingRect.left / width;
            boundingRect.top = boundingRect.top / height;
            boundingRect.right = boundingRect.right / width;
            boundingRect.bottom = boundingRect.bottom / height;

            const partiallyUncaptured = boundingRect.right > 1 || boundingRect.bottom > 1;
            const fullyUncaptured = boundingRect.left > 1 || boundingRect.top > 1;
            if (fullyUncaptured) {
              canvas.title = `Playwright couldn't capture canvas contents because it's located outside the viewport.`;
              continue;
            }

            drawCheckerboard(context, canvas);

            if (shouldPopulateCanvasFromScreenshot) {
              context.drawImage(img, boundingRect.left * img.width, boundingRect.top * img.height, (boundingRect.right - boundingRect.left) * img.width, (boundingRect.bottom - boundingRect.top) * img.height, 0, 0, canvas.width, canvas.height);

              if (partiallyUncaptured)
                canvas.title = `Playwright couldn't capture full canvas contents because it's located partially outside the viewport.`;
              else
                canvas.title = `Canvas contents are displayed on a best-effort basis based on viewport screenshots taken during test execution.`;
            } else {
              canvas.title = 'Canvas content display is disabled.';
            }

            if (isUnderTest)
              // eslint-disable-next-line no-console
              console.log(`canvas drawn:`, JSON.stringify([boundingRect.left, boundingRect.top, (boundingRect.right - boundingRect.left), (boundingRect.bottom - boundingRect.top)].map(v => Math.floor(v * 100))));
          }
        };
        img.onerror = () => {
          for (const canvas of canvasElements) {
            const context = canvas.getContext('2d')!;
            drawCheckerboard(context, canvas);
            canvas.title = `Playwright couldn't show canvas contents because the screenshot failed to load.`;
          }
        };
        img.src = location.href.replace('/snapshot', '/closest-screenshot');
      }
    };

    const onDOMContentLoaded = () => visit(document);

    window.addEventListener('load', onLoad);
    window.addEventListener('DOMContentLoaded', onDOMContentLoaded);
  }

  return `\n(${applyPlaywrightAttributes.toString()})(${unwrapPopoutUrl.toString()}, ${JSON.stringify(viewport)}${targetIds.map(id => `, "${id}"`).join('')})`;
}


/**
 * Best-effort Electron support: rewrite custom protocol in DOM.
 * vscode-file://vscode-app/ -> https://pw-vscode-file--vscode-app/
 */
const schemas = ['about:', 'blob:', 'data:', 'file:', 'ftp:', 'http:', 'https:', 'mailto:', 'sftp:', 'ws:', 'wss:'];
const kLegacyBlobPrefix = 'http://playwright.bloburl/#';

export function rewriteURLForCustomProtocol(href: string): string {
  // Legacy support, we used to prepend this to blobs, strip it away.
  if (href.startsWith(kLegacyBlobPrefix))
    href = href.substring(kLegacyBlobPrefix.length);

  try {
    const url = new URL(href);
    // Sanitize URL.
    if (url.protocol === 'javascript:' || url.protocol === 'vbscript:')
      return 'javascript:void(0)';

    // Pass through if possible.
    const isBlob = url.protocol === 'blob:';
    const isFile = url.protocol === 'file:';
    if (!isBlob && !isFile && schemas.includes(url.protocol))
      return href;

    // Rewrite blob, file and custom schemas.
    const prefix = 'pw-' + url.protocol.slice(0, url.protocol.length - 1);
    if (!isFile)
      url.protocol = 'https:';
    url.hostname = url.hostname ? `${prefix}--${url.hostname}` : prefix;
    if (isFile) {
      // File URIs can only have their protocol changed after the hostname
      // is set. (For all other URIs, we must set the protocol first.)
      url.protocol = 'https:';
    }
    return url.toString();
  } catch {
    return href;
  }
}

/**
 * Best-effort Electron support: rewrite custom protocol in inline stylesheets.
 * vscode-file://vscode-app/ -> https://pw-vscode-file--vscode-app/
 */
const urlInCSSRegex = /url\(['"]?([\w-]+:)\/\//ig;

function rewriteURLsInStyleSheetForCustomProtocol(text: string): string {
  return text.replace(urlInCSSRegex, (match: string, protocol: string) => {
    const isBlob = protocol === 'blob:';
    const isFile = protocol === 'file:';
    if (!isBlob && !isFile && schemas.includes(protocol))
      return match;
    return match.replace(protocol + '//', `https://pw-${protocol.slice(0, -1)}--`);
  });
}

// url() inside a <style> tag can mess up with html parsing, so we encode some of them.
// As an example, the following url will close the </style> tag:
// url('data:image/svg+xml,<svg><defs><style>.a{fill:none}</style></defs><g class="a"></g></svg>')
const urlToEscapeRegex1 = /url\(\s*'([^']*)'\s*\)/ig;
const urlToEscapeRegex2 = /url\(\s*"([^"]*)"\s*\)/ig;
function escapeURLsInStyleSheet(text: string): string {
  const replacer = (match: string, url: string) => {
    // Conservatively encode only urls with a closing tag.
    if (url.includes('</'))
      return match.replace(url, encodeURI(url));
    return match;
  };
  return text.replace(urlToEscapeRegex1, replacer).replace(urlToEscapeRegex2, replacer);
}

// <base>/snapshot.html?r=<snapshotUrl> is used for "pop out snapshot" feature.
export function unwrapPopoutUrl(url: string) {
  const u = new URL(url);
  if (u.pathname.endsWith('/snapshot.html'))
    return u.searchParams.get('r')!;
  return url;
}
