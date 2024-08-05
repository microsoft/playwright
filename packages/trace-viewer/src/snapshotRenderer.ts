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

function isNodeNameAttributesChildNodesSnapshot(n: NodeSnapshot): n is NodeNameAttributesChildNodesSnapshot {
  return Array.isArray(n) && typeof n[0] === 'string';
}

function isSubtreeReferenceSnapshot(n: NodeSnapshot): n is SubtreeReferenceSnapshot {
  return Array.isArray(n) && Array.isArray(n[0]);
}

export class SnapshotRenderer {
  private _snapshots: FrameSnapshot[];
  private _index: number;
  readonly snapshotName: string | undefined;
  private _resources: ResourceSnapshot[];
  private _snapshot: FrameSnapshot;
  private _callId: string;

  constructor(resources: ResourceSnapshot[], snapshots: FrameSnapshot[], index: number) {
    this._resources = resources;
    this._snapshots = snapshots;
    this._index = index;
    this._snapshot = snapshots[index];
    this._callId = snapshots[index].callId;
    this.snapshotName = snapshots[index].snapshotName;
  }

  snapshot(): FrameSnapshot {
    return this._snapshots[this._index];
  }

  viewport(): { width: number, height: number } {
    return this._snapshots[this._index].viewport;
  }

  render(): RenderedFrameSnapshot {
    const visit = (n: NodeSnapshot, snapshotIndex: number, parentTag: string | undefined, parentAttrs: [string, string][] | undefined): string => {
      // Text node.
      if (typeof n === 'string') {
        // Best-effort Electron support: rewrite custom protocol in url() links in stylesheets.
        // Old snapshotter was sending lower-case.
        if (parentTag === 'STYLE' || parentTag === 'style')
          return rewriteURLsInStyleSheetForCustomProtocol(n);
        return escapeHTML(n);
      }

      if (!(n as any)._string) {
        if (isSubtreeReferenceSnapshot(n)) {
          // Node reference.
          const referenceIndex = snapshotIndex - n[0][0];
          if (referenceIndex >= 0 && referenceIndex <= snapshotIndex) {
            const nodes = snapshotNodes(this._snapshots[referenceIndex]);
            const nodeIndex = n[0][1];
            if (nodeIndex >= 0 && nodeIndex < nodes.length)
              (n as any)._string = visit(nodes[nodeIndex], referenceIndex, parentTag, parentAttrs);
          }
        } else if (isNodeNameAttributesChildNodesSnapshot(n)) {
          const [name, nodeAttrs, ...children] = n;
          // Element node.
          // Note that <noscript> will not be rendered by default in the trace viewer, because
          // JS is enabled. So rename it to <x-noscript>.
          const nodeName = name === 'NOSCRIPT' ? 'X-NOSCRIPT' : name;
          const attrs = Object.entries(nodeAttrs || {});
          const builder: string[] = [];
          builder.push('<', nodeName);
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
            builder.push(' ', attrName, '="', escapeHTMLAttribute(attrValue), '"');
          }
          builder.push('>');
          for (const child of children)
            builder.push(visit(child, snapshotIndex, nodeName, attrs));
          if (!autoClosing.has(nodeName))
            builder.push('</', nodeName, '>');
          (n as any)._string = builder.join('');
        } else {
          // Why are we here? Let's not throw, just in case.
          (n as any)._string = '';
        }
      }
      return (n as any)._string;
    };

    const snapshot = this._snapshot;
    let html = visit(snapshot.html, this._index, undefined, undefined);
    if (!html)
      return { html: '', pageId: snapshot.pageId, frameId: snapshot.frameId, index: this._index };

    // Hide the document in order to prevent flickering. We will unhide once script has processed shadow.
    const prefix = snapshot.doctype ? `<!DOCTYPE ${snapshot.doctype}>` : '';
    html = prefix + [
      '<style>*,*::before,*::after { visibility: hidden }</style>',
      `<script>${snapshotScript(this._callId, this.snapshotName)}</script>`
    ].join('') + html;

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

function snapshotScript(...targetIds: (string | undefined)[]) {
  function applyPlaywrightAttributes(unwrapPopoutUrl: (url: string) => string, ...targetIds: (string | undefined)[]) {
    const kPointerWarningTitle = 'Recorded click position in absolute coordinates did not' +
        ' match the center of the clicked element. This is likely due to a difference between' +
        ' the test runner and the trace viewer operating systems.';

    const scrollTops: Element[] = [];
    const scrollLefts: Element[] = [];
    const targetElements: Element[] = [];

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

      for (const targetId of targetIds) {
        for (const target of root.querySelectorAll(`[__playwright_target__="${targetId}"]`)) {
          const style = (target as HTMLElement).style;
          style.outline = '2px solid #006ab1';
          style.backgroundColor = '#6fa8dc7f';
          targetElements.push(target);
        }
      }

      for (const iframe of root.querySelectorAll('iframe, frame')) {
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
    };

    const onLoad = () => {
      window.removeEventListener('load', onLoad);
      for (const element of scrollTops) {
        element.scrollTop = +element.getAttribute('__playwright_scroll_top_')!;
        element.removeAttribute('__playwright_scroll_top_');
      }
      for (const element of scrollLefts) {
        element.scrollLeft = +element.getAttribute('__playwright_scroll_left_')!;
        element.removeAttribute('__playwright_scroll_left_');
      }

      document.styleSheets[0].disabled = true;

      const search = new URL(window.location.href).searchParams;

      if (search.get('pointX') && search.get('pointY')) {
        const pointX = +search.get('pointX')!;
        const pointY = +search.get('pointY')!;
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
            if (Math.abs(centerX - pointX) >= 10 || Math.abs(centerY - pointY) >= 10) {
              const warningElement = document.createElement('x-pw-pointer-warning');
              warningElement.textContent = '⚠';
              warningElement.style.fontSize = '19px';
              warningElement.style.color = 'white';
              warningElement.style.marginTop = '-3.5px';
              warningElement.style.userSelect = 'none';
              pointElement.appendChild(warningElement);
              pointElement.setAttribute('title', kPointerWarningTitle);
            }
          } else {
            // For actions without a target element, e.g. page.mouse.move(),
            // show the point at the recorder location.
            pointElement.style.left = pointX + 'px';
            pointElement.style.top = pointY + 'px';
          }
          document.documentElement.appendChild(pointElement);
        }
      }
    };

    const onDOMContentLoaded = () => visit(document);

    window.addEventListener('load', onLoad);
    window.addEventListener('DOMContentLoaded', onDOMContentLoaded);
  }

  return `\n(${applyPlaywrightAttributes.toString()})(${unwrapPopoutUrl.toString()}${targetIds.map(id => `, "${id}"`).join('')})`;
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

// <base>/snapshot.html?r=<snapshotUrl> is used for "pop out snapshot" feature.
export function unwrapPopoutUrl(url: string) {
  const u = new URL(url);
  if (u.pathname.endsWith('/snapshot.html'))
    return u.searchParams.get('r')!;
  return url;
}
