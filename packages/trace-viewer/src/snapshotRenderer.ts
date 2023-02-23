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

import type { FrameSnapshot, NodeSnapshot, RenderedFrameSnapshot, ResourceSnapshot } from '@trace/snapshot';

export class SnapshotRenderer {
  private _snapshots: FrameSnapshot[];
  private _index: number;
  readonly snapshotName: string | undefined;
  _resources: ResourceSnapshot[];
  private _snapshot: FrameSnapshot;

  constructor(resources: ResourceSnapshot[], snapshots: FrameSnapshot[], index: number) {
    this._resources = resources;
    this._snapshots = snapshots;
    this._index = index;
    this._snapshot = snapshots[index];
    this.snapshotName = snapshots[index].snapshotName;
  }

  snapshot(): FrameSnapshot {
    return this._snapshots[this._index];
  }

  viewport(): { width: number, height: number } {
    return this._snapshots[this._index].viewport;
  }

  render(): RenderedFrameSnapshot {
    const visit = (n: NodeSnapshot, snapshotIndex: number, parentTag: string | undefined): string => {
      // Text node.
      if (typeof n === 'string') {
        const text = escapeText(n);
        // Best-effort Electron support: rewrite custom protocol in url() links in stylesheets.
        // Old snapshotter was sending lower-case.
        if (parentTag === 'STYLE' || parentTag === 'style')
          return rewriteURLsInStyleSheetForCustomProtocol(text);
        return text;
      }

      if (!(n as any)._string) {
        if (Array.isArray(n[0])) {
          // Node reference.
          const referenceIndex = snapshotIndex - n[0][0];
          if (referenceIndex >= 0 && referenceIndex <= snapshotIndex) {
            const nodes = snapshotNodes(this._snapshots[referenceIndex]);
            const nodeIndex = n[0][1];
            if (nodeIndex >= 0 && nodeIndex < nodes.length)
              (n as any)._string = visit(nodes[nodeIndex], referenceIndex, parentTag);
          }
        } else if (typeof n[0] === 'string') {
          // Element node.
          const builder: string[] = [];
          builder.push('<', n[0]);
          // Never set relative URLs as <iframe src> - they start fetching frames immediately.
          const isFrame = n[0] === 'IFRAME' || n[0] === 'FRAME';
          const isAnchor = n[0] === 'A';
          for (const [attr, value] of Object.entries(n[1] || {})) {
            const attrName = isFrame && attr.toLowerCase() === 'src' ? '__playwright_src__' : attr;
            let attrValue = value;
            if (attr.toLowerCase() === 'href' || attr.toLowerCase() === 'src') {
              if (isAnchor)
                attrValue = 'link://' + value;
              else
                attrValue = rewriteURLForCustomProtocol(value);
            }
            builder.push(' ', attrName, '="', escapeAttribute(attrValue as string), '"');
          }
          builder.push('>');
          for (let i = 2; i < n.length; i++)
            builder.push(visit(n[i], snapshotIndex, n[0]));
          if (!autoClosing.has(n[0]))
            builder.push('</', n[0], '>');
          (n as any)._string = builder.join('');
        } else {
          // Why are we here? Let's not throw, just in case.
          (n as any)._string = '';
        }
      }
      return (n as any)._string;
    };

    const snapshot = this._snapshot;
    let html = visit(snapshot.html, this._index, undefined);
    if (!html)
      return { html: '', pageId: snapshot.pageId, frameId: snapshot.frameId, index: this._index };

    // Hide the document in order to prevent flickering. We will unhide once script has processed shadow.
    const prefix = snapshot.doctype ? `<!DOCTYPE ${snapshot.doctype}>` : '';
    html = prefix + [
      '<style>*,*::before,*::after { visibility: hidden }</style>',
      `<style>*[__playwright_target__="${this.snapshotName}"] { background-color: #6fa8dc7f; }</style>`,
      `<script>${snapshotScript()}</script>`
    ].join('') + html;

    return { html, pageId: snapshot.pageId, frameId: snapshot.frameId, index: this._index };
  }

  resourceByUrl(url: string): ResourceSnapshot | undefined {
    const snapshot = this._snapshot;
    let result: ResourceSnapshot | undefined;

    // First try locating exact resource belonging to this frame.
    for (const resource of this._resources) {
      if (typeof resource._monotonicTime === 'number' && resource._monotonicTime >= snapshot.timestamp)
        break;
      if (resource._frameref !== snapshot.frameId)
        continue;
      if (resource.request.url === url) {
        result = resource;
        break;
      }
    }

    if (!result) {
      // Then fall back to resource with this URL to account for memory cache.
      for (const resource of this._resources) {
        if (typeof resource._monotonicTime === 'number' && resource._monotonicTime >= snapshot.timestamp)
          break;
        if (resource.request.url === url)
          return resource;
      }
    }

    if (result) {
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
const escaped = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };

function escapeAttribute(s: string): string {
  return s.replace(/[&<>"']/ug, char => (escaped as any)[char]);
}
function escapeText(s: string): string {
  return s.replace(/[&<]/ug, char => (escaped as any)[char]);
}

function snapshotNodes(snapshot: FrameSnapshot): NodeSnapshot[] {
  if (!(snapshot as any)._nodes) {
    const nodes: NodeSnapshot[] = [];
    const visit = (n: NodeSnapshot) => {
      if (typeof n === 'string') {
        nodes.push(n);
      } else if (typeof n[0] === 'string') {
        for (let i = 2; i < n.length; i++)
          visit(n[i]);
        nodes.push(n);
      }
    };
    visit(snapshot.html);
    (snapshot as any)._nodes = nodes;
  }
  return (snapshot as any)._nodes;
}

function snapshotScript() {
  function applyPlaywrightAttributes(unwrapPopoutUrl: (url: string) => string) {
    const scrollTops: Element[] = [];
    const scrollLefts: Element[] = [];

    const visit = (root: Document | ShadowRoot) => {
      // Collect all scrolled elements for later use.
      for (const e of root.querySelectorAll(`[__playwright_scroll_top_]`))
        scrollTops.push(e);
      for (const e of root.querySelectorAll(`[__playwright_scroll_left_]`))
        scrollLefts.push(e);

      for (const element of root.querySelectorAll(`[__playwright_value_]`)) {
        (element as HTMLInputElement | HTMLTextAreaElement).value = element.getAttribute('__playwright_value_')!;
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

      for (const iframe of root.querySelectorAll('iframe, frame')) {
        const src = iframe.getAttribute('__playwright_src__');
        if (!src) {
          iframe.setAttribute('src', 'data:text/html,<body style="background: #ddd"></body>');
        } else {
          // Append query parameters to inherit ?name= or ?time= values from parent.
          const url = new URL(unwrapPopoutUrl(window.location.href));
          url.searchParams.delete('pointX');
          url.searchParams.delete('pointY');
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

      const search = new URL(window.location.href).searchParams;
      const pointX = search.get('pointX');
      const pointY = search.get('pointY');
      if (pointX) {
        const pointElement = document.createElement('x-pw-pointer');
        pointElement.style.position = 'fixed';
        pointElement.style.backgroundColor = '#f44336';
        pointElement.style.width = '20px';
        pointElement.style.height = '20px';
        pointElement.style.borderRadius = '10px';
        pointElement.style.margin = '-10px 0 0 -10px';
        pointElement.style.zIndex = '2147483647';
        pointElement.style.left = pointX + 'px';
        pointElement.style.top = pointY + 'px';
        document.documentElement.appendChild(pointElement);
      }
      document.styleSheets[0].disabled = true;
    };

    const onDOMContentLoaded = () => visit(document);

    window.addEventListener('load', onLoad);
    window.addEventListener('DOMContentLoaded', onDOMContentLoaded);
  }

  return `\n(${applyPlaywrightAttributes.toString()})(${unwrapPopoutUrl.toString()})`;
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
    if (!isBlob && schemas.includes(url.protocol))
      return href;

    // Rewrite blob and custom schemas.
    const prefix = 'pw-' + url.protocol.slice(0, url.protocol.length - 1);
    url.protocol = 'https:';
    url.hostname = url.hostname ? `${prefix}--${url.hostname}` : prefix;
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
    if (!isBlob && schemas.includes(protocol))
      return match;
    return match.replace(protocol + '//', `https://pw-${protocol.slice(0, -1)}--`);
  });
}

// <base>/popout.html?r=<snapshotUrl> is used for "pop out snapshot" feature.
export function unwrapPopoutUrl(url: string) {
  const u = new URL(url);
  if (u.pathname.endsWith('/popout.html'))
    return u.searchParams.get('r')!;
  return url;
}
