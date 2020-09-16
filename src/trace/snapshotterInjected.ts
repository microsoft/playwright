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
  frameUrls: string[],
};

type SnapshotResult = {
  data: SnapshotData,
  frameElements: Element[],
};

export function takeSnapshotInFrame(guid: string, removeNoScript: boolean, target: Node | undefined): SnapshotResult {
  const shadowAttribute = 'playwright-shadow-root';
  const win = window;
  const doc = win.document;

  const autoClosing = new Set(['AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT', 'KEYGEN', 'LINK', 'MENUITEM', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR']);
  const escaped = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' };

  const escapeAttribute = (s: string): string => {
    return s.replace(/[&<>"']/ug, char => (escaped as any)[char]);
  };
  const escapeText = (s: string): string => {
    return s.replace(/[&<]/ug, char => (escaped as any)[char]);
  };
  const escapeScriptString = (s: string): string => {
    return s.replace(/'/g, '\\\'');
  };

  const chunks = new Map<string, string>();
  const frameUrlToFrameElement = new Map<string, Element>();
  const styleNodeToStyleSheetText = new Map<Node, string>();
  const styleSheetUrlToContentOverride = new Map<string, string>();

  let counter = 0;
  const nextId = (): string => {
    return guid + (++counter);
  };

  const resolve = (base: string, url: string): string => {
    if (url === '')
      return '';
    try {
      return new URL(url, base).href;
    } catch (e) {
      return url;
    }
  };

  const sanitizeUrl = (url: string): string => {
    if (url.startsWith('javascript:'))
      return '';
    return url;
  };

  const sanitizeSrcSet = (srcset: string): string => {
    return srcset.split(',').map(src => {
      src = src.trim();
      const spaceIndex = src.lastIndexOf(' ');
      if (spaceIndex === -1)
        return sanitizeUrl(src);
      return sanitizeUrl(src.substring(0, spaceIndex).trim()) + src.substring(spaceIndex);
    }).join(',');
  };

  const getSheetBase = (sheet: CSSStyleSheet): string => {
    let rootSheet = sheet;
    while (rootSheet.parentStyleSheet)
      rootSheet = rootSheet.parentStyleSheet;
    if (rootSheet.ownerNode)
      return rootSheet.ownerNode.baseURI;
    return document.baseURI;
  };

  const getSheetText = (sheet: CSSStyleSheet): string => {
    const rules: string[] = [];
    for (const rule of sheet.cssRules)
      rules.push(rule.cssText);
    return rules.join('\n');
  };

  const visitStyleSheet = (sheet: CSSStyleSheet) => {
    try {
      for (const rule of sheet.cssRules) {
        if ((rule as CSSImportRule).styleSheet)
          visitStyleSheet((rule as CSSImportRule).styleSheet);
      }

      const cssText = getSheetText(sheet);
      if (sheet.ownerNode && sheet.ownerNode.nodeName === 'STYLE') {
        // Stylesheets with owner STYLE nodes will be rewritten.
        styleNodeToStyleSheetText.set(sheet.ownerNode, cssText);
      } else if (sheet.href !== null) {
        // Other stylesheets will have resource overrides.
        const base = getSheetBase(sheet);
        const url = resolve(base, sheet.href);
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
      builder.push(escapeText(node.nodeValue || ''));
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

    if (removeNoScript && nodeName === 'NOSCRIPT')
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
      if (node === target)
        builder.push(' __playwright_target__="true"');
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
          let protocol = win.location.protocol;
          if (!protocol.startsWith('http'))
            protocol = 'http:';
          value = protocol + '//' + nextId() + '/';
          frameUrlToFrameElement.set(value, element);
        } else if (name === 'src' && (nodeName === 'IMG')) {
          value = sanitizeUrl(value);
        } else if (name === 'srcset' && (nodeName === 'IMG')) {
          value = sanitizeSrcSet(value);
        } else if (name === 'srcset' && (nodeName === 'SOURCE')) {
          value = sanitizeSrcSet(value);
        } else if (name === 'href' && (nodeName === 'LINK')) {
          value = sanitizeUrl(value);
        } else if (name.startsWith('on')) {
          value = '';
        }
        builder.push(' ');
        builder.push(name);
        builder.push('="');
        builder.push(escapeAttribute(value));
        builder.push('"');
      }
      if (nodeName === 'INPUT') {
        builder.push(' value="');
        builder.push(escapeAttribute((element as HTMLInputElement).value));
        builder.push('"');
      }
      if ((element as any).checked)
        builder.push(' checked');
      if ((element as any).disabled)
        builder.push(' disabled');
      if ((element as any).readOnly)
        builder.push(' readonly');
      if (element.shadowRoot) {
        const b: string[] = [];
        visit(element.shadowRoot, b);
        const chunkId = nextId();
        chunks.set(chunkId, b.join(''));
        builder.push(' ');
        builder.push(shadowAttribute);
        builder.push('="');
        builder.push(chunkId);
        builder.push('"');
      }
      builder.push('>');
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
      builder.push(escapeAttribute(baseHref));
      builder.push('"');
      if (baseTarget) {
        builder.push(' target="');
        builder.push(escapeAttribute(baseTarget));
        builder.push('"');
      }
      builder.push('>');
    }
    if (nodeName === 'TEXTAREA') {
      builder.push(escapeText((node as HTMLTextAreaElement).value));
    } else {
      for (let child = node.firstChild; child; child = child.nextSibling)
        visit(child, builder);
    }
    if (node.nodeName === 'BODY' && chunks.size) {
      builder.push('<script>');
      const shadowChunks = Array.from(chunks).map(([chunkId, html]) => {
        return `  ['${chunkId}', '${escapeScriptString(html)}']`;
      }).join(',\n');
      const scriptContent = `\n(${applyShadowsInPage.toString()})('${shadowAttribute}', new Map([\n${shadowChunks}\n]))\n`;
      builder.push(scriptContent);
      builder.push('</script>');
    }
    if (nodeType === Node.ELEMENT_NODE && !autoClosing.has(nodeName)) {
      builder.push('</');
      builder.push(nodeName);
      builder.push('>');
    }
  };

  function applyShadowsInPage(shadowAttribute: string, shadowContent: Map<string, string>) {
    const visitShadows = (root: Document | ShadowRoot) => {
      const elements = root.querySelectorAll(`[${shadowAttribute}]`);
      for (let i = 0; i < elements.length; i++) {
        const host = elements[i];
        const chunkId = host.getAttribute(shadowAttribute)!;
        host.removeAttribute(shadowAttribute);
        const shadow = host.attachShadow({ mode: 'open' });
        const html = shadowContent.get(chunkId);
        if (html) {
          shadow.innerHTML = html;
          visitShadows(shadow);
        }
      }
    };
    visitShadows(document);
  }

  const root: string[] = [];
  visit(doc, root);
  return {
    data: {
      html: root.join(''),
      frameUrls: Array.from(frameUrlToFrameElement.keys()),
      resourceOverrides: Array.from(styleSheetUrlToContentOverride).map(([url, content]) => ({ url, content })),
    },
    frameElements: Array.from(frameUrlToFrameElement.values()),
  };
}
