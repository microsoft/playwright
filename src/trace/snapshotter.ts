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

import { BrowserContextBase } from '../browserContext';
import { Page } from '../page';
import * as network from '../network';
import * as frames from '../frames';
import * as dom from '../dom';
import * as js from '../javascript';
import * as types from '../types';
import { helper, assert } from '../helper';
import { Progress } from '../progress';

export type FrameSnapshot = {
  url: string,
  html: string,
  shadowAttribute: string,

  // <... shadowAttribute="chunkId">
  shadowContent: { chunkId: string, html: string }[],

  // <link href="URL">
  // <img src="URL">
  // <img srcset="URL">
  // <... style="...url(URL)..." >
  resources: {
    url: string,
    resourceId: string,
    overrideSha1?: string,
  }[],
};

export type PageSnapshot = {
  viewportSize?: types.Size,
  mainFrame: FrameSnapshot,
  // <iframe src="snapshot.url">
  frames: FrameSnapshot[],
};

export type SavedResource = {
  frameId: string,
  url: string,
  resourceId: string,
  references: Promise<string[]>,
};

export type SavedResourceSet = () => Set<SavedResource>;
export type ResourceSaver = (body: Buffer) => Promise<string>;  // Returns sha1.
export type ResourceGetter = (resourceId: string, overrideSha1: string | undefined) => Promise<{ contentType: string, headers: types.Headers, body: Buffer } | undefined>;

export async function renderSnapshot(page: Page, resourceGetter: ResourceGetter, snapshot: PageSnapshot): Promise<void> {
  const frameBySrc = new Map<string, FrameSnapshot>();
  for (const frameSnapshot of [snapshot.mainFrame, ...snapshot.frames])
    frameBySrc.set(frameSnapshot.url, frameSnapshot);

  const intercepted: Promise<any>[] = [];

  const unknownUrls = new Set<string>();
  const unknown = (route: network.Route): void => {
    const url = route.request().url();
    if (!unknownUrls.has(url)) {
      console.log(`Request to unknown url: ${url}`);  /* eslint-disable-line no-console */
      unknownUrls.add(url);
    }
    intercepted.push(route.abort());
  };

  await page.route('**', async route => {
    const url = route.request().url();
    if (frameBySrc.has(url)) {
      const frameSnapshot = frameBySrc.get(url)!;
      intercepted.push(route.fulfill({
        contentType: 'text/html',
        body: Buffer.from(frameSnapshot.html),
      }));
      return;
    }

    const frameSrc = route.request().frame().url();
    const frameSnapshot = frameBySrc.get(frameSrc);
    if (!frameSnapshot)
      return unknown(route);

    for (const resource of frameSnapshot.resources) {
      if (resource.url === url) {
        const resourceData = await resourceGetter(resource.resourceId, resource.overrideSha1);
        if (!resourceData)
          return unknown(route);

        intercepted.push(route.fulfill({
          contentType: resourceData.contentType,
          body: resourceData.body,
          headers: { ...resourceData.headers, 'Access-Control-Allow-Origin': '*' },
        }));
        return;
      }
    }

    unknown(route);
  });
  await page.goto(snapshot.mainFrame.url);

  const postprocess = async (frameSnapshot: FrameSnapshot, frame: frames.Frame) => {
    if (frameSnapshot.shadowContent.length)
      await frame.evaluate(applyShadows, { shadowAttribute: frameSnapshot.shadowAttribute, shadowContent: frameSnapshot.shadowContent });
    for (const childFrame of frame.childFrames()) {
      await childFrame.waitForLoadState();
      const url = childFrame.url();
      for (const childData of snapshot.frames) {
        if (url.endsWith(childData.url))
          await postprocess(childData, childFrame);
      }
    }
  };
  await postprocess(snapshot.mainFrame, page.mainFrame());
  await Promise.all(intercepted);
}

async function addResource(savedResourceSet: SavedResourceSet, resourceSaver: ResourceSaver, frameSnapshot: FrameSnapshot, frame: frames.Frame, url: string, override: string | undefined): Promise<void> {
  assert(!url.startsWith('data:'));
  if (frameSnapshot.resources.find(r => r.url === url))
    return;

  const urlNoHash = removeHash(url);
  let resource: SavedResource | null = null;
  for (const r of savedResourceSet()) {
    if (resource && r.frameId !== frame._id)
      continue;
    if (r.url !== urlNoHash)
      continue;
    resource = r;
    if (r.frameId === frame._id)
      break;
  }

  if (!resource)
    return;

  const overrideSha1 = override !== undefined ? await resourceSaver(Buffer.from(override)) : undefined;
  frameSnapshot.resources.push({ resourceId: resource.resourceId, url, overrideSha1 });

  const references = await resource.references;
  await Promise.all(references.map(reference => addResource(savedResourceSet, resourceSaver, frameSnapshot, frame, reference, undefined)));
}

type FrameSnapshotAndMapping = {
  snapshot: FrameSnapshot,
  mapping: Map<frames.Frame, string>,
};

async function snapshotFrame(progress: Progress, savedResourceSet: SavedResourceSet, resourceSaver: ResourceSaver, frame: frames.Frame): Promise<FrameSnapshotAndMapping | null> {
  try {
    if (!progress.isRunning())
      return null;

    const kShadowRoot = 'playwright-shadow-root';
    const context = await frame._utilityContext();
    const guid = helper.guid();
    const removeNoScript = !(frame._page.context() as BrowserContextBase)._options.javaScriptEnabled;
    const array = await js.evaluate(context, false /* returnByValue */, takeSnapshot, guid, kShadowRoot, removeNoScript) as js.JSHandle;
    if (!progress.isRunning())
      return null;

    const properties = await array.getProperties();
    array.dispose();

    let index = 0;
    const next = <T>(): Promise<T> => {
      return properties.get('' + (index++))!.jsonValue();
    };
    const nextElement = async (): Promise<dom.ElementHandle | null> => {
      return properties.get('' + (index++))!.asElement();
    };

    const snapshot: FrameSnapshot = {
      url: frame.url(),
      html: '',
      shadowAttribute: kShadowRoot,
      shadowContent: [],
      resources: [],
    };
    const mapping = new Map<frames.Frame, string>();

    const chunksLength = await next<number>();
    for (let i = 0; i < chunksLength; i++) {
      const chunkId = await next<string>();
      const html = await next<string>();
      if (!chunkId)
        snapshot.html = html;
      else
        snapshot.shadowContent.push({ chunkId, html });
    }

    const resourcesLength = await next<number>();
    for (let i = 0; i < resourcesLength; i++) {
      const url = await next<string>();
      const override = await next<string | undefined>();
      await addResource(savedResourceSet, resourceSaver, snapshot, frame, url, override);
    }

    const framesLength = await next<number>();
    for (let i = 0; i < framesLength; i++) {
      const frameSrc = await next<string>();
      const element = await nextElement();
      if (!element)
        continue;
      const frame = await element.contentFrame().catch(e => null);
      if (frame)
        mapping.set(frame, frameSrc);
    }

    return { snapshot, mapping };
  } catch (e) {
    return null;
  }
}

export async function captureSnapshot(progress: Progress, savedResourceSet: SavedResourceSet, resourceSaver: ResourceSaver, page: Page): Promise<PageSnapshot | null> {
  const frames = page.frames();
  const promises = frames.map(frame => snapshotFrame(progress, savedResourceSet, resourceSaver, frame));
  const results = await Promise.all(promises);

  const mainFrame = results[0];
  if (!mainFrame)
    return null;
  if (!mainFrame.snapshot.url.startsWith('http'))
    mainFrame.snapshot.url = 'http://playwright.snapshot/';

  const mapping = new Map<frames.Frame, string>();
  for (const result of results) {
    if (!result)
      continue;
    for (const [key, value] of result.mapping)
      mapping.set(key, value);
  }

  const childFrames: FrameSnapshot[] = [];
  for (let i = 1; i < results.length; i++) {
    const result = results[i];
    if (!result)
      continue;
    const frame = frames[i];
    if (!mapping.has(frame))
      continue;
    const frameSnapshot = result.snapshot;
    frameSnapshot.url = mapping.get(frame)!;
    childFrames.push(frameSnapshot);
  }

  let viewportSize = page.viewportSize();
  if (!viewportSize) {
    try {
      if (!progress.isRunning())
        return null;

      const context = await page.mainFrame()._utilityContext();
      viewportSize = await context.evaluateInternal(() => {
        return {
          width: Math.max(document.body.offsetWidth, document.documentElement.offsetWidth),
          height: Math.max(document.body.offsetHeight, document.documentElement.offsetHeight),
        };
      });
    } catch (e) {
      return null;
    }
  }

  return {
    viewportSize,
    mainFrame: mainFrame.snapshot,
    frames: childFrames,
  };
}

function takeSnapshot(guid: string, shadowAttribute: string, removeNoScript: boolean): any[] {
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

  const frames = new Map<string, Element>();
  const chunks = new Map<string, string>();
  const resources = new Set<string>();
  const nodeToStyleSheetText = new Map<Node, string>();
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

  const addResource = (base: string, url: string): string => {
    if (url.startsWith('javascript:'))
      return '';
    if (url.startsWith('data:') || !url)
      return url;
    resources.add(resolve(base, url));
    return url;
  };

  const processSrcSet = (base: string, srcset: string): string => {
    return srcset.split(',').map(src => {
      src = src.trim();
      const spaceIndex = src.lastIndexOf(' ');
      if (spaceIndex === -1)
        return addResource(base, src);
      return addResource(base, src.substring(0, spaceIndex).trim()) + src.substring(spaceIndex);
    }).join(',');
  };

  const processStyle = (base: string, style: string) => {
    // TODO: this is wrong.
    for (const match of style.matchAll(/(url\s*\(['"]?)([^)'"]*)(['"]?\))/g))
      addResource(base, match[2]);
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

  // TODO: handle fonts loaded with FontFaceSet.

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
      for (const sheet of documentOrShadowRoot.styleSheets) {
        if (!sheet.ownerNode)
          continue;
        try {
          const cssText = getSheetText(sheet);
          nodeToStyleSheetText.set(sheet.ownerNode, cssText);
        } catch (e) {
          // Sometimes we cannot access cross-origin stylesheets.
        }
      }
    }

    if (nodeName === 'SCRIPT' || nodeName === 'BASE')
      return;

    if (removeNoScript && nodeName === 'NOSCRIPT')
      return;

    if (nodeToStyleSheetText.has(node) || nodeName === 'STYLE') {
      const cssText = nodeToStyleSheetText.get(node) || node.textContent || '';
      processStyle(node.baseURI, cssText);
      builder.push('<style>');
      builder.push(cssText);
      builder.push('</style>');
      return;
    }

    if (nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      builder.push('<');
      builder.push(nodeName);
      for (let i = 0; i < element.attributes.length; i++) {
        const name = element.attributes[i].name;
        let value = element.attributes[i].value;
        if (name === 'value' && (nodeName === 'INPUT' || nodeName === 'TEXTAREA'))
          continue;
        if (name === 'checked' || name === 'disabled' || name === 'checked')
          continue;
        if (name === 'src' && (nodeName === 'IFRAME' || nodeName === 'FRAME')) {
          // TODO: handle srcdoc.
          let protocol = win.location.protocol;
          if (!protocol.startsWith('http'))
            protocol = 'http:';
          value = protocol + '//' + nextId() + '/';
          frames.set(value, element);
        } else if (name === 'src' && (nodeName === 'IMG')) {
          value = addResource(element.baseURI, value);
        } else if (name === 'srcset' && (nodeName === 'IMG')) {
          value = processSrcSet(element.baseURI, value);
        } else if (name === 'srcset' && (nodeName === 'SOURCE')) {
          value = processSrcSet(element.baseURI, value);
        } else if (name === 'href' && (nodeName === 'LINK')) {
          value = addResource(element.baseURI, value);
        } else if (name === 'style') {
          processStyle(element.baseURI, value);
        } else if (name.startsWith('on')) {
          value = '';
        }
        builder.push(' ');
        builder.push(name);
        builder.push('="');
        builder.push(escapeAttribute(value));
        builder.push('"');
      }
      if (nodeName === 'INPUT' || nodeName === 'TEXTAREA') {
        builder.push(' value="');
        builder.push(escapeAttribute((element as HTMLInputElement | HTMLTextAreaElement).value));
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
    for (let child = node.firstChild; child; child = child.nextSibling)
      visit(child, builder);
    if (nodeType === Node.ELEMENT_NODE && !autoClosing.has(nodeName)) {
      builder.push('</');
      builder.push(nodeName);
      builder.push('>');
    }
  };

  const root: string[] = [];
  visit(doc, root);
  chunks.set('', root.join(''));

  const styleSheetOverrides = new Map<string, string>();
  for (const sheet of doc.styleSheets) {
    if (sheet.href === null || sheet.ownerNode)
      continue;
    const base = getSheetBase(sheet);
    const url = resolve(base, sheet.href);
    try {
      const cssText = getSheetText(sheet);
      processStyle(base, cssText);
      styleSheetOverrides.set(url, cssText);
    } catch (e) {
      // Sometimes we cannot access cross-origin stylesheets.
    }
  }

  const result: any[] = [];
  result.push(chunks.size);
  for (const [chunkId, html] of chunks) {
    result.push(chunkId);
    result.push(html);
  }
  result.push(resources.size);
  for (const url of resources) {
    result.push(url);
    result.push(styleSheetOverrides.get(url));
  }
  result.push(frames.size);
  for (const [frameSrc, element] of frames) {
    result.push(frameSrc);
    result.push(element);
  }
  return result;
}

type ApplyShadowsParam = {
  shadowAttribute: string,
  shadowContent: { chunkId: string, html: string }[],
};
function applyShadows({ shadowAttribute, shadowContent }: ApplyShadowsParam) {
  const shadows = new Map<string, string>();
  for (const content of shadowContent)
    shadows.set(content.chunkId, content.html);
  const visit = (root: Document | ShadowRoot) => {
    const elements = root.querySelectorAll(`[${shadowAttribute}]`);
    for (let i = 0; i < elements.length; i++) {
      const host = elements[i];
      const chunkId = host.getAttribute(shadowAttribute)!;
      host.removeAttribute(shadowAttribute);
      const shadow = host.attachShadow({ mode: 'open' });
      const html = shadows.get(chunkId);
      if (html) {
        shadow.innerHTML = html;
        visit(shadow);
      }
    }
  };
  visit(document);
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

export function resourceReferences(url: string, buffer: Buffer, resourceType: string): string[] {
  const references: string[] = [];

  if (!buffer || resourceType !== 'stylesheet')
    return references;

  let style: string;
  try {
    style = buffer.toString('utf8');
  } catch (e) {
    return references;
  }

  // TODO: this is wrong.
  for (const match of style.matchAll(/(url\s*\(['"]?)([^)'"]*)(['"]?\))/g)) {
    let inner = match[2];
    if (inner.startsWith('data:') || !inner)
      continue;
    try {
      inner = new URL(inner, url).href;
    } catch (e) {
    }
    references.push(inner);
  }
  return references;
}
