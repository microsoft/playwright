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

import { ContextResources, FrameSnapshot, NodeSnapshot, RenderedFrameSnapshot } from './snapshotTypes';

export class SnapshotRenderer {
  private _snapshots: FrameSnapshot[];
  private _index: number;
  private _contextResources: ContextResources;
  readonly snapshotName: string | undefined;

  constructor(contextResources: ContextResources, snapshots: FrameSnapshot[], index: number) {
    this._contextResources = contextResources;
    this._snapshots = snapshots;
    this._index = index;
    this.snapshotName = snapshots[index].snapshotName;
  }

  snapshot(): FrameSnapshot {
    return this._snapshots[this._index];
  }

  render(): RenderedFrameSnapshot {
    const visit = (n: NodeSnapshot, snapshotIndex: number): string => {
      // Text node.
      if (typeof n === 'string')
        return escapeText(n);

      if (!(n as any)._string) {
        if (Array.isArray(n[0])) {
          // Node reference.
          const referenceIndex = snapshotIndex - n[0][0];
          if (referenceIndex >= 0 && referenceIndex < snapshotIndex) {
            const nodes = snapshotNodes(this._snapshots[referenceIndex]);
            const nodeIndex = n[0][1];
            if (nodeIndex >= 0 && nodeIndex < nodes.length)
              (n as any)._string = visit(nodes[nodeIndex], referenceIndex);
          }
        } else if (typeof n[0] === 'string') {
          // Element node.
          const builder: string[] = [];
          builder.push('<', n[0]);
          for (const [attr, value] of Object.entries(n[1] || {}))
            builder.push(' ', attr, '="', escapeAttribute(value as string), '"');
          builder.push('>');
          for (let i = 2; i < n.length; i++)
            builder.push(visit(n[i], snapshotIndex));
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

    const snapshot = this._snapshots[this._index];
    let html = visit(snapshot.html, this._index);
    if (!html)
      return { html: '', resources: {} };

    if (snapshot.doctype)
      html = `<!DOCTYPE ${snapshot.doctype}>` + html;
    html += `
      <style>*[__playwright_target__="${this.snapshotName}"] { background-color: #6fa8dc7f; }</style>
      <script>${snapshotScript()}</script>
    `;

    const resources: { [key: string]: { resourceId: string, sha1?: string } } = {};
    for (const [url, contextResources] of this._contextResources) {
      const contextResource = contextResources.find(r => r.frameId === snapshot.frameId) || contextResources[0];
      if (contextResource)
        resources[url] = { resourceId: contextResource.resourceId };
    }
    for (const o of snapshot.resourceOverrides) {
      const resource = resources[o.url];
      resource.sha1 = o.sha1;
    }
    return { html, resources };
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
  function applyPlaywrightAttributes(shadowAttribute: string, scrollTopAttribute: string, scrollLeftAttribute: string, styleSheetAttribute: string) {
    const scrollTops: Element[] = [];
    const scrollLefts: Element[] = [];

    const visit = (root: Document | ShadowRoot) => {
      // Collect all scrolled elements for later use.
      for (const e of root.querySelectorAll(`[${scrollTopAttribute}]`))
        scrollTops.push(e);
      for (const e of root.querySelectorAll(`[${scrollLeftAttribute}]`))
        scrollLefts.push(e);

      for (const iframe of root.querySelectorAll('iframe')) {
        const src = iframe.getAttribute('src');
        if (!src) {
          iframe.setAttribute('src', 'data:text/html,<body style="background: #ddd"></body>');
        } else {
          // Append query parameters to inherit ?name= or ?time= values from parent.
          iframe.setAttribute('src', window.location.origin + src + window.location.search);
        }
      }

      for (const element of root.querySelectorAll(`template[${shadowAttribute}]`)) {
        const template = element as HTMLTemplateElement;
        const shadowRoot = template.parentElement!.attachShadow({ mode: 'open' });
        shadowRoot.appendChild(template.content);
        template.remove();
        visit(shadowRoot);
      }

      if ('adoptedStyleSheets' in (root as any)) {
        const adoptedSheets: CSSStyleSheet[] = [...(root as any).adoptedStyleSheets];
        for (const element of root.querySelectorAll(`template[${styleSheetAttribute}]`)) {
          const template = element as HTMLTemplateElement;
          const sheet = new CSSStyleSheet();
          (sheet as any).replaceSync(template.getAttribute(styleSheetAttribute));
          adoptedSheets.push(sheet);
        }
        (root as any).adoptedStyleSheets = adoptedSheets;
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
  const kStyleSheetAttribute = '__playwright_style_sheet_';
  return `\n(${applyPlaywrightAttributes.toString()})('${kShadowAttribute}', '${kScrollTopAttribute}', '${kScrollLeftAttribute}', '${kStyleSheetAttribute}')`;
}
