var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
function splitProgress(progress, weights) {
  const doneList = new Array(weights.length).fill(0);
  return new Array(weights.length).fill(0).map((_, i) => {
    return (done, total) => {
      doneList[i] = done / total * weights[i] * 1e3;
      progress(doneList.reduce((a, b) => a + b, 0), 1e3);
    };
  });
}
const escaped = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHTMLAttribute(s) {
  return s.replace(/[&<>"']/ug, (char) => escaped[char]);
}
function escapeHTML(s) {
  return s.replace(/[&<]/ug, (char) => escaped[char]);
}
function findClosest(items, metric, target) {
  return items.find((item, index) => {
    if (index === items.length - 1)
      return true;
    const next = items[index + 1];
    return Math.abs(metric(item) - target) < Math.abs(metric(next) - target);
  });
}
function isNodeNameAttributesChildNodesSnapshot(n) {
  return Array.isArray(n) && typeof n[0] === "string";
}
function isSubtreeReferenceSnapshot(n) {
  return Array.isArray(n) && Array.isArray(n[0]);
}
class SnapshotRenderer {
  constructor(htmlCache, resources, snapshots, screencastFrames, index) {
    __publicField(this, "_htmlCache");
    __publicField(this, "_snapshots");
    __publicField(this, "_index");
    __publicField(this, "snapshotName");
    __publicField(this, "_resources");
    __publicField(this, "_snapshot");
    __publicField(this, "_callId");
    __publicField(this, "_screencastFrames");
    this._htmlCache = htmlCache;
    this._resources = resources;
    this._snapshots = snapshots;
    this._index = index;
    this._snapshot = snapshots[index];
    this._callId = snapshots[index].callId;
    this._screencastFrames = screencastFrames;
    this.snapshotName = snapshots[index].snapshotName;
  }
  snapshot() {
    return this._snapshots[this._index];
  }
  viewport() {
    return this._snapshots[this._index].viewport;
  }
  closestScreenshot() {
    var _a;
    const { wallTime, timestamp } = this.snapshot();
    const closestFrame = wallTime && ((_a = this._screencastFrames[0]) == null ? void 0 : _a.frameSwapWallTime) ? findClosest(this._screencastFrames, (frame) => frame.frameSwapWallTime, wallTime) : findClosest(this._screencastFrames, (frame) => frame.timestamp, timestamp);
    return closestFrame == null ? void 0 : closestFrame.sha1;
  }
  render() {
    const result = [];
    const visit = (n, snapshotIndex, parentTag, parentAttrs) => {
      if (typeof n === "string") {
        if (parentTag === "STYLE" || parentTag === "style")
          result.push(rewriteURLsInStyleSheetForCustomProtocol(n));
        else
          result.push(escapeHTML(n));
        return;
      }
      if (isSubtreeReferenceSnapshot(n)) {
        const referenceIndex = snapshotIndex - n[0][0];
        if (referenceIndex >= 0 && referenceIndex <= snapshotIndex) {
          const nodes = snapshotNodes(this._snapshots[referenceIndex]);
          const nodeIndex = n[0][1];
          if (nodeIndex >= 0 && nodeIndex < nodes.length)
            return visit(nodes[nodeIndex], referenceIndex, parentTag, parentAttrs);
        }
      } else if (isNodeNameAttributesChildNodesSnapshot(n)) {
        const [name, nodeAttrs, ...children] = n;
        const nodeName = name === "NOSCRIPT" ? "X-NOSCRIPT" : name;
        const attrs = Object.entries(nodeAttrs || {});
        result.push("<", nodeName);
        const kCurrentSrcAttribute = "__playwright_current_src__";
        const isFrame = nodeName === "IFRAME" || nodeName === "FRAME";
        const isAnchor = nodeName === "A";
        const isImg = nodeName === "IMG";
        const isImgWithCurrentSrc = isImg && attrs.some((a) => a[0] === kCurrentSrcAttribute);
        const isSourceInsidePictureWithCurrentSrc = nodeName === "SOURCE" && parentTag === "PICTURE" && (parentAttrs == null ? void 0 : parentAttrs.some((a) => a[0] === kCurrentSrcAttribute));
        for (const [attr, value] of attrs) {
          let attrName = attr;
          if (isFrame && attr.toLowerCase() === "src") {
            attrName = "__playwright_src__";
          }
          if (isImg && attr === kCurrentSrcAttribute) {
            attrName = "src";
          }
          if (["src", "srcset"].includes(attr.toLowerCase()) && (isImgWithCurrentSrc || isSourceInsidePictureWithCurrentSrc)) {
            attrName = "_" + attrName;
          }
          let attrValue = value;
          if (isAnchor && attr.toLowerCase() === "href")
            attrValue = "link://" + value;
          else if (attr.toLowerCase() === "href" || attr.toLowerCase() === "src" || attr === kCurrentSrcAttribute)
            attrValue = rewriteURLForCustomProtocol(value);
          result.push(" ", attrName, '="', escapeHTMLAttribute(attrValue), '"');
        }
        result.push(">");
        for (const child of children)
          visit(child, snapshotIndex, nodeName, attrs);
        if (!autoClosing.has(nodeName))
          result.push("</", nodeName, ">");
        return;
      } else {
        return;
      }
    };
    const snapshot = this._snapshot;
    const html = this._htmlCache.getOrCompute(this, () => {
      visit(snapshot.html, this._index, void 0, void 0);
      const prefix = snapshot.doctype ? `<!DOCTYPE ${snapshot.doctype}>` : "";
      const html2 = prefix + [
        // Hide the document in order to prevent flickering. We will unhide once script has processed shadow.
        "<style>*,*::before,*::after { visibility: hidden }</style>",
        `<script>${snapshotScript(this._callId, this.snapshotName)}<\/script>`
      ].join("") + result.join("");
      return { value: html2, size: html2.length };
    });
    return { html, pageId: snapshot.pageId, frameId: snapshot.frameId, index: this._index };
  }
  resourceByUrl(url, method) {
    const snapshot = this._snapshot;
    let sameFrameResource;
    let otherFrameResource;
    for (const resource of this._resources) {
      if (typeof resource._monotonicTime === "number" && resource._monotonicTime >= snapshot.timestamp)
        break;
      if (resource.response.status === 304) {
        continue;
      }
      if (resource.request.url === url && resource.request.method === method) {
        if (resource._frameref === snapshot.frameId)
          sameFrameResource = resource;
        else
          otherFrameResource = resource;
      }
    }
    let result = sameFrameResource ?? otherFrameResource;
    if (result && method.toUpperCase() === "GET") {
      for (const o of snapshot.resourceOverrides) {
        if (url === o.url && o.sha1) {
          result = {
            ...result,
            response: {
              ...result.response,
              content: {
                ...result.response.content,
                _sha1: o.sha1
              }
            }
          };
          break;
        }
      }
    }
    return result;
  }
}
const autoClosing = /* @__PURE__ */ new Set(["AREA", "BASE", "BR", "COL", "COMMAND", "EMBED", "HR", "IMG", "INPUT", "KEYGEN", "LINK", "MENUITEM", "META", "PARAM", "SOURCE", "TRACK", "WBR"]);
function snapshotNodes(snapshot) {
  if (!snapshot._nodes) {
    const nodes = [];
    const visit = (n) => {
      if (typeof n === "string") {
        nodes.push(n);
      } else if (isNodeNameAttributesChildNodesSnapshot(n)) {
        const [, , ...children] = n;
        for (const child of children)
          visit(child);
        nodes.push(n);
      }
    };
    visit(snapshot.html);
    snapshot._nodes = nodes;
  }
  return snapshot._nodes;
}
function snapshotScript(...targetIds) {
  function applyPlaywrightAttributes(unwrapPopoutUrl2, ...targetIds2) {
    const isUnderTest = new URLSearchParams(location.search).has("isUnderTest");
    const kPointerWarningTitle = "Recorded click position in absolute coordinates did not match the center of the clicked element. This is likely due to a difference between the test runner and the trace viewer operating systems.";
    const scrollTops = [];
    const scrollLefts = [];
    const targetElements = [];
    const canvasElements = [];
    const visit = (root) => {
      for (const e of root.querySelectorAll(`[__playwright_scroll_top_]`))
        scrollTops.push(e);
      for (const e of root.querySelectorAll(`[__playwright_scroll_left_]`))
        scrollLefts.push(e);
      for (const element of root.querySelectorAll(`[__playwright_value_]`)) {
        const inputElement = element;
        if (inputElement.type !== "file")
          inputElement.value = inputElement.getAttribute("__playwright_value_");
        element.removeAttribute("__playwright_value_");
      }
      for (const element of root.querySelectorAll(`[__playwright_checked_]`)) {
        element.checked = element.getAttribute("__playwright_checked_") === "true";
        element.removeAttribute("__playwright_checked_");
      }
      for (const element of root.querySelectorAll(`[__playwright_selected_]`)) {
        element.selected = element.getAttribute("__playwright_selected_") === "true";
        element.removeAttribute("__playwright_selected_");
      }
      for (const targetId of targetIds2) {
        for (const target of root.querySelectorAll(`[__playwright_target__="${targetId}"]`)) {
          const style = target.style;
          style.outline = "2px solid #006ab1";
          style.backgroundColor = "#6fa8dc7f";
          targetElements.push(target);
        }
      }
      for (const iframe of root.querySelectorAll("iframe, frame")) {
        const src = iframe.getAttribute("__playwright_src__");
        if (!src) {
          iframe.setAttribute("src", 'data:text/html,<body style="background: #ddd"></body>');
        } else {
          const url = new URL(unwrapPopoutUrl2(window.location.href));
          const index = url.pathname.lastIndexOf("/snapshot/");
          if (index !== -1)
            url.pathname = url.pathname.substring(0, index + 1);
          url.pathname += src.substring(1);
          iframe.setAttribute("src", url.toString());
        }
      }
      {
        const body = root.querySelector(`body[__playwright_custom_elements__]`);
        if (body && window.customElements) {
          const customElements = (body.getAttribute("__playwright_custom_elements__") || "").split(",");
          for (const elementName of customElements)
            window.customElements.define(elementName, class extends HTMLElement {
            });
        }
      }
      for (const element of root.querySelectorAll(`template[__playwright_shadow_root_]`)) {
        const template = element;
        const shadowRoot = template.parentElement.attachShadow({ mode: "open" });
        shadowRoot.appendChild(template.content);
        template.remove();
        visit(shadowRoot);
      }
      if ("adoptedStyleSheets" in root) {
        const adoptedSheets = [...root.adoptedStyleSheets];
        for (const element of root.querySelectorAll(`template[__playwright_style_sheet_]`)) {
          const template = element;
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(template.getAttribute("__playwright_style_sheet_"));
          adoptedSheets.push(sheet);
        }
        root.adoptedStyleSheets = adoptedSheets;
      }
      canvasElements.push(...root.querySelectorAll("canvas"));
    };
    const onLoad = () => {
      window.removeEventListener("load", onLoad);
      for (const element of scrollTops) {
        element.scrollTop = +element.getAttribute("__playwright_scroll_top_");
        element.removeAttribute("__playwright_scroll_top_");
      }
      for (const element of scrollLefts) {
        element.scrollLeft = +element.getAttribute("__playwright_scroll_left_");
        element.removeAttribute("__playwright_scroll_left_");
      }
      document.styleSheets[0].disabled = true;
      const search = new URL(window.location.href).searchParams;
      const isTopFrame = window.location.pathname.match(/\/page@[a-z0-9]+$/);
      if (search.get("pointX") && search.get("pointY")) {
        const pointX = +search.get("pointX");
        const pointY = +search.get("pointY");
        const hasInputTarget = search.has("hasInputTarget");
        const hasTargetElements = targetElements.length > 0;
        const roots = document.documentElement ? [document.documentElement] : [];
        for (const target of hasTargetElements ? targetElements : roots) {
          const pointElement = document.createElement("x-pw-pointer");
          pointElement.style.position = "fixed";
          pointElement.style.backgroundColor = "#f44336";
          pointElement.style.width = "20px";
          pointElement.style.height = "20px";
          pointElement.style.borderRadius = "10px";
          pointElement.style.margin = "-10px 0 0 -10px";
          pointElement.style.zIndex = "2147483646";
          pointElement.style.display = "flex";
          pointElement.style.alignItems = "center";
          pointElement.style.justifyContent = "center";
          if (hasTargetElements) {
            const box = target.getBoundingClientRect();
            const centerX = box.left + box.width / 2;
            const centerY = box.top + box.height / 2;
            pointElement.style.left = centerX + "px";
            pointElement.style.top = centerY + "px";
            if (isTopFrame && (Math.abs(centerX - pointX) >= 10 || Math.abs(centerY - pointY) >= 10)) {
              const warningElement = document.createElement("x-pw-pointer-warning");
              warningElement.textContent = "⚠";
              warningElement.style.fontSize = "19px";
              warningElement.style.color = "white";
              warningElement.style.marginTop = "-3.5px";
              warningElement.style.userSelect = "none";
              pointElement.appendChild(warningElement);
              pointElement.setAttribute("title", kPointerWarningTitle);
            }
            document.documentElement.appendChild(pointElement);
          } else if (isTopFrame && !hasInputTarget) {
            pointElement.style.left = pointX + "px";
            pointElement.style.top = pointY + "px";
            document.documentElement.appendChild(pointElement);
          }
        }
      }
      if (canvasElements.length > 0) {
        let drawCheckerboard = function(context, canvas) {
          function createCheckerboardPattern() {
            const pattern = document.createElement("canvas");
            pattern.width = pattern.width / Math.floor(pattern.width / 24);
            pattern.height = pattern.height / Math.floor(pattern.height / 24);
            const context2 = pattern.getContext("2d");
            context2.fillStyle = "lightgray";
            context2.fillRect(0, 0, pattern.width, pattern.height);
            context2.fillStyle = "white";
            context2.fillRect(0, 0, pattern.width / 2, pattern.height / 2);
            context2.fillRect(pattern.width / 2, pattern.height / 2, pattern.width, pattern.height);
            return context2.createPattern(pattern, "repeat");
          }
          context.fillStyle = createCheckerboardPattern();
          context.fillRect(0, 0, canvas.width, canvas.height);
        };
        if (!isTopFrame) {
          for (const canvas of canvasElements) {
            const context = canvas.getContext("2d");
            drawCheckerboard(context, canvas);
            canvas.title = `Playwright displays canvas contents on a best-effort basis. It doesn't support canvas elements inside an iframe yet. If this impacts your workflow, please open an issue so we can prioritize.`;
          }
          return;
        }
        const img = new Image();
        img.onload = () => {
          for (const canvas of canvasElements) {
            const context = canvas.getContext("2d");
            const boundingRectAttribute = canvas.getAttribute("__playwright_bounding_rect__");
            canvas.removeAttribute("__playwright_bounding_rect__");
            if (!boundingRectAttribute)
              continue;
            let boundingRect;
            try {
              boundingRect = JSON.parse(boundingRectAttribute);
            } catch (e) {
              continue;
            }
            const partiallyUncaptured = boundingRect.right > 1 || boundingRect.bottom > 1;
            const fullyUncaptured = boundingRect.left > 1 || boundingRect.top > 1;
            if (fullyUncaptured) {
              canvas.title = `Playwright couldn't capture canvas contents because it's located outside the viewport.`;
              continue;
            }
            drawCheckerboard(context, canvas);
            context.drawImage(img, boundingRect.left * img.width, boundingRect.top * img.height, (boundingRect.right - boundingRect.left) * img.width, (boundingRect.bottom - boundingRect.top) * img.height, 0, 0, canvas.width, canvas.height);
            if (isUnderTest)
              console.log(`canvas drawn:`, JSON.stringify([boundingRect.left, boundingRect.top, boundingRect.right - boundingRect.left, boundingRect.bottom - boundingRect.top].map((v) => Math.floor(v * 100))));
            if (partiallyUncaptured)
              canvas.title = `Playwright couldn't capture full canvas contents because it's located partially outside the viewport.`;
            else
              canvas.title = `Canvas contents are displayed on a best-effort basis based on viewport screenshots taken during test execution.`;
          }
        };
        img.onerror = () => {
          for (const canvas of canvasElements) {
            const context = canvas.getContext("2d");
            drawCheckerboard(context, canvas);
            canvas.title = `Playwright couldn't show canvas contents because the screenshot failed to load.`;
          }
        };
        img.src = location.href.replace("/snapshot", "/closest-screenshot");
      }
    };
    const onDOMContentLoaded = () => visit(document);
    window.addEventListener("load", onLoad);
    window.addEventListener("DOMContentLoaded", onDOMContentLoaded);
  }
  return `
(${applyPlaywrightAttributes.toString()})(${unwrapPopoutUrl.toString()}${targetIds.map((id) => `, "${id}"`).join("")})`;
}
const schemas = ["about:", "blob:", "data:", "file:", "ftp:", "http:", "https:", "mailto:", "sftp:", "ws:", "wss:"];
const kLegacyBlobPrefix = "http://playwright.bloburl/#";
function rewriteURLForCustomProtocol(href) {
  if (href.startsWith(kLegacyBlobPrefix))
    href = href.substring(kLegacyBlobPrefix.length);
  try {
    const url = new URL(href);
    if (url.protocol === "javascript:" || url.protocol === "vbscript:")
      return "javascript:void(0)";
    const isBlob = url.protocol === "blob:";
    const isFile = url.protocol === "file:";
    if (!isBlob && !isFile && schemas.includes(url.protocol))
      return href;
    const prefix = "pw-" + url.protocol.slice(0, url.protocol.length - 1);
    if (!isFile)
      url.protocol = "https:";
    url.hostname = url.hostname ? `${prefix}--${url.hostname}` : prefix;
    if (isFile) {
      url.protocol = "https:";
    }
    return url.toString();
  } catch {
    return href;
  }
}
const urlInCSSRegex = /url\(['"]?([\w-]+:)\/\//ig;
function rewriteURLsInStyleSheetForCustomProtocol(text) {
  return text.replace(urlInCSSRegex, (match, protocol) => {
    const isBlob = protocol === "blob:";
    const isFile = protocol === "file:";
    if (!isBlob && !isFile && schemas.includes(protocol))
      return match;
    return match.replace(protocol + "//", `https://pw-${protocol.slice(0, -1)}--`);
  });
}
function unwrapPopoutUrl(url) {
  const u = new URL(url);
  if (u.pathname.endsWith("/snapshot.html"))
    return u.searchParams.get("r");
  return url;
}
class SnapshotServer {
  constructor(snapshotStorage, resourceLoader) {
    __publicField(this, "_snapshotStorage");
    __publicField(this, "_resourceLoader");
    __publicField(this, "_snapshotIds", /* @__PURE__ */ new Map());
    this._snapshotStorage = snapshotStorage;
    this._resourceLoader = resourceLoader;
  }
  serveSnapshot(pathname, searchParams, snapshotUrl) {
    const snapshot = this._snapshot(pathname.substring("/snapshot".length), searchParams);
    if (!snapshot)
      return new Response(null, { status: 404 });
    const renderedSnapshot = snapshot.render();
    this._snapshotIds.set(snapshotUrl, snapshot);
    return new Response(renderedSnapshot.html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  async serveClosestScreenshot(pathname, searchParams) {
    const snapshot = this._snapshot(pathname.substring("/closest-screenshot".length), searchParams);
    const sha1 = snapshot == null ? void 0 : snapshot.closestScreenshot();
    if (!sha1)
      return new Response(null, { status: 404 });
    return new Response(await this._resourceLoader(sha1));
  }
  serveSnapshotInfo(pathname, searchParams) {
    const snapshot = this._snapshot(pathname.substring("/snapshotInfo".length), searchParams);
    return this._respondWithJson(snapshot ? {
      viewport: snapshot.viewport(),
      url: snapshot.snapshot().frameUrl,
      timestamp: snapshot.snapshot().timestamp,
      wallTime: snapshot.snapshot().wallTime
    } : {
      error: "No snapshot found"
    });
  }
  _snapshot(pathname, params) {
    const name = params.get("name");
    return this._snapshotStorage.snapshotByName(pathname.slice(1), name);
  }
  _respondWithJson(object) {
    return new Response(JSON.stringify(object), {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=31536000",
        "Content-Type": "application/json"
      }
    });
  }
  async serveResource(requestUrlAlternatives, method, snapshotUrl) {
    let resource;
    const snapshot = this._snapshotIds.get(snapshotUrl);
    for (const requestUrl of requestUrlAlternatives) {
      resource = snapshot == null ? void 0 : snapshot.resourceByUrl(removeHash(requestUrl), method);
      if (resource)
        break;
    }
    if (!resource)
      return new Response(null, { status: 404 });
    const sha1 = resource.response.content._sha1;
    const content = sha1 ? await this._resourceLoader(sha1) || new Blob([]) : new Blob([]);
    let contentType = resource.response.content.mimeType;
    const isTextEncoding = /^text\/|^application\/(javascript|json)/.test(contentType);
    if (isTextEncoding && !contentType.includes("charset"))
      contentType = `${contentType}; charset=utf-8`;
    const headers = new Headers();
    if (contentType !== "x-unknown")
      headers.set("Content-Type", contentType);
    for (const { name, value } of resource.response.headers)
      headers.set(name, value);
    headers.delete("Content-Encoding");
    headers.delete("Access-Control-Allow-Origin");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.delete("Content-Length");
    headers.set("Content-Length", String(content.size));
    headers.set("Cache-Control", "public, max-age=31536000");
    const { status } = resource.response;
    const isNullBodyStatus = status === 101 || status === 204 || status === 205 || status === 304;
    return new Response(isNullBodyStatus ? null : content, {
      headers,
      status: resource.response.status,
      statusText: resource.response.statusText
    });
  }
}
function removeHash(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch (e) {
    return url;
  }
}
function parseClientSideCallMetadata(data) {
  const result = /* @__PURE__ */ new Map();
  const { files, stacks } = data;
  for (const s of stacks) {
    const [id, ff] = s;
    result.set(`call@${id}`, ff.map((f) => ({ file: files[f[0]], line: f[1], column: f[2], function: f[3] })));
  }
  return result;
}
class LRUCache {
  constructor(maxSize) {
    __publicField(this, "_maxSize");
    __publicField(this, "_map");
    __publicField(this, "_size");
    this._maxSize = maxSize;
    this._map = /* @__PURE__ */ new Map();
    this._size = 0;
  }
  getOrCompute(key, compute) {
    if (this._map.has(key)) {
      const result2 = this._map.get(key);
      this._map.delete(key);
      this._map.set(key, result2);
      return result2.value;
    }
    const result = compute();
    while (this._map.size && this._size + result.size > this._maxSize) {
      const [firstKey, firstValue] = this._map.entries().next().value;
      this._size -= firstValue.size;
      this._map.delete(firstKey);
    }
    this._map.set(key, result);
    this._size += result.size;
    return result.value;
  }
}
class SnapshotStorage {
  constructor() {
    __publicField(this, "_resources", []);
    __publicField(this, "_frameSnapshots", /* @__PURE__ */ new Map());
    __publicField(this, "_cache", new LRUCache(1e8));
  }
  // 100MB per each trace
  addResource(resource) {
    resource.request.url = rewriteURLForCustomProtocol(resource.request.url);
    this._resources.push(resource);
  }
  addFrameSnapshot(snapshot, screencastFrames) {
    for (const override of snapshot.resourceOverrides)
      override.url = rewriteURLForCustomProtocol(override.url);
    let frameSnapshots = this._frameSnapshots.get(snapshot.frameId);
    if (!frameSnapshots) {
      frameSnapshots = {
        raw: [],
        renderers: []
      };
      this._frameSnapshots.set(snapshot.frameId, frameSnapshots);
      if (snapshot.isMainFrame)
        this._frameSnapshots.set(snapshot.pageId, frameSnapshots);
    }
    frameSnapshots.raw.push(snapshot);
    const renderer = new SnapshotRenderer(this._cache, this._resources, frameSnapshots.raw, screencastFrames, frameSnapshots.raw.length - 1);
    frameSnapshots.renderers.push(renderer);
    return renderer;
  }
  snapshotByName(pageOrFrameId, snapshotName) {
    const snapshot = this._frameSnapshots.get(pageOrFrameId);
    return snapshot == null ? void 0 : snapshot.renderers.find((r) => r.snapshotName === snapshotName);
  }
  snapshotsForTest() {
    return [...this._frameSnapshots.keys()];
  }
  finalize() {
    this._resources.sort((a, b) => (a._monotonicTime || 0) - (b._monotonicTime || 0));
  }
}
class TraceVersionError extends Error {
  constructor(message) {
    super(message);
    this.name = "TraceVersionError";
  }
}
const latestVersion = 7;
class TraceModernizer {
  constructor(contextEntry, snapshotStorage) {
    __publicField(this, "_contextEntry");
    __publicField(this, "_snapshotStorage");
    __publicField(this, "_actionMap", /* @__PURE__ */ new Map());
    __publicField(this, "_version");
    __publicField(this, "_pageEntries", /* @__PURE__ */ new Map());
    __publicField(this, "_jsHandles", /* @__PURE__ */ new Map());
    __publicField(this, "_consoleObjects", /* @__PURE__ */ new Map());
    this._contextEntry = contextEntry;
    this._snapshotStorage = snapshotStorage;
  }
  appendTrace(trace) {
    for (const line of trace.split("\n"))
      this._appendEvent(line);
  }
  actions() {
    return [...this._actionMap.values()];
  }
  _pageEntry(pageId) {
    let pageEntry = this._pageEntries.get(pageId);
    if (!pageEntry) {
      pageEntry = {
        pageId,
        screencastFrames: []
      };
      this._pageEntries.set(pageId, pageEntry);
      this._contextEntry.pages.push(pageEntry);
    }
    return pageEntry;
  }
  _appendEvent(line) {
    if (!line)
      return;
    const events = this._modernize(JSON.parse(line));
    for (const event of events)
      this._innerAppendEvent(event);
  }
  _innerAppendEvent(event) {
    const contextEntry = this._contextEntry;
    switch (event.type) {
      case "context-options": {
        if (event.version > latestVersion)
          throw new TraceVersionError("The trace was created by a newer version of Playwright and is not supported by this version of the viewer. Please use latest Playwright to open the trace.");
        this._version = event.version;
        contextEntry.origin = event.origin;
        contextEntry.browserName = event.browserName;
        contextEntry.channel = event.channel;
        contextEntry.title = event.title;
        contextEntry.platform = event.platform;
        contextEntry.wallTime = event.wallTime;
        contextEntry.startTime = event.monotonicTime;
        contextEntry.sdkLanguage = event.sdkLanguage;
        contextEntry.options = event.options;
        contextEntry.testIdAttributeName = event.testIdAttributeName;
        break;
      }
      case "screencast-frame": {
        this._pageEntry(event.pageId).screencastFrames.push(event);
        break;
      }
      case "before": {
        this._actionMap.set(event.callId, { ...event, type: "action", endTime: 0, log: [] });
        break;
      }
      case "input": {
        const existing = this._actionMap.get(event.callId);
        existing.inputSnapshot = event.inputSnapshot;
        existing.point = event.point;
        break;
      }
      case "log": {
        const existing = this._actionMap.get(event.callId);
        if (!existing)
          return;
        existing.log.push({
          time: event.time,
          message: event.message
        });
        break;
      }
      case "after": {
        const existing = this._actionMap.get(event.callId);
        existing.afterSnapshot = event.afterSnapshot;
        existing.endTime = event.endTime;
        existing.result = event.result;
        existing.error = event.error;
        existing.attachments = event.attachments;
        if (event.point)
          existing.point = event.point;
        break;
      }
      case "action": {
        this._actionMap.set(event.callId, { ...event, log: [] });
        break;
      }
      case "event": {
        contextEntry.events.push(event);
        break;
      }
      case "stdout": {
        contextEntry.stdio.push(event);
        break;
      }
      case "stderr": {
        contextEntry.stdio.push(event);
        break;
      }
      case "error": {
        contextEntry.errors.push(event);
        break;
      }
      case "console": {
        contextEntry.events.push(event);
        break;
      }
      case "resource-snapshot":
        this._snapshotStorage.addResource(event.snapshot);
        contextEntry.resources.push(event.snapshot);
        break;
      case "frame-snapshot":
        this._snapshotStorage.addFrameSnapshot(event.snapshot, this._pageEntry(event.snapshot.pageId).screencastFrames);
        break;
    }
    if ("pageId" in event && event.pageId)
      this._pageEntry(event.pageId);
    if (event.type === "action" || event.type === "before")
      contextEntry.startTime = Math.min(contextEntry.startTime, event.startTime);
    if (event.type === "action" || event.type === "after")
      contextEntry.endTime = Math.max(contextEntry.endTime, event.endTime);
    if (event.type === "event") {
      contextEntry.startTime = Math.min(contextEntry.startTime, event.time);
      contextEntry.endTime = Math.max(contextEntry.endTime, event.time);
    }
    if (event.type === "screencast-frame") {
      contextEntry.startTime = Math.min(contextEntry.startTime, event.timestamp);
      contextEntry.endTime = Math.max(contextEntry.endTime, event.timestamp);
    }
  }
  _processedContextCreatedEvent() {
    return this._version !== void 0;
  }
  _modernize(event) {
    let version = this._version || event.version;
    if (version === void 0)
      return [event];
    let events = [event];
    for (; version < latestVersion; ++version)
      events = this[`_modernize_${version}_to_${version + 1}`].call(this, events);
    return events;
  }
  _modernize_0_to_1(events) {
    for (const event of events) {
      if (event.type !== "action")
        continue;
      if (typeof event.metadata.error === "string")
        event.metadata.error = { error: { name: "Error", message: event.metadata.error } };
    }
    return events;
  }
  _modernize_1_to_2(events) {
    var _a;
    for (const event of events) {
      if (event.type !== "frame-snapshot" || !event.snapshot.isMainFrame)
        continue;
      event.snapshot.viewport = ((_a = this._contextEntry.options) == null ? void 0 : _a.viewport) || { width: 1280, height: 720 };
    }
    return events;
  }
  _modernize_2_to_3(events) {
    for (const event of events) {
      if (event.type !== "resource-snapshot" || event.snapshot.request)
        continue;
      const resource = event.snapshot;
      event.snapshot = {
        _frameref: resource.frameId,
        request: {
          url: resource.url,
          method: resource.method,
          headers: resource.requestHeaders,
          postData: resource.requestSha1 ? { _sha1: resource.requestSha1 } : void 0
        },
        response: {
          status: resource.status,
          headers: resource.responseHeaders,
          content: {
            mimeType: resource.contentType,
            _sha1: resource.responseSha1
          }
        },
        _monotonicTime: resource.timestamp
      };
    }
    return events;
  }
  _modernize_3_to_4(events) {
    const result = [];
    for (const event of events) {
      const e = this._modernize_event_3_to_4(event);
      if (e)
        result.push(e);
    }
    return result;
  }
  _modernize_event_3_to_4(event) {
    var _a, _b, _c, _d;
    if (event.type !== "action" && event.type !== "event") {
      return event;
    }
    const metadata = event.metadata;
    if (metadata.internal || metadata.method.startsWith("tracing"))
      return null;
    if (event.type === "event") {
      if (metadata.method === "__create__" && metadata.type === "ConsoleMessage") {
        return {
          type: "object",
          class: metadata.type,
          guid: metadata.params.guid,
          initializer: metadata.params.initializer
        };
      }
      return {
        type: "event",
        time: metadata.startTime,
        class: metadata.type,
        method: metadata.method,
        params: metadata.params,
        pageId: metadata.pageId
      };
    }
    return {
      type: "action",
      callId: metadata.id,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      apiName: metadata.apiName || metadata.type + "." + metadata.method,
      class: metadata.type,
      method: metadata.method,
      params: metadata.params,
      wallTime: metadata.wallTime || Date.now(),
      log: metadata.log,
      beforeSnapshot: (_a = metadata.snapshots.find((s) => s.title === "before")) == null ? void 0 : _a.snapshotName,
      inputSnapshot: (_b = metadata.snapshots.find((s) => s.title === "input")) == null ? void 0 : _b.snapshotName,
      afterSnapshot: (_c = metadata.snapshots.find((s) => s.title === "after")) == null ? void 0 : _c.snapshotName,
      error: (_d = metadata.error) == null ? void 0 : _d.error,
      result: metadata.result,
      point: metadata.point,
      pageId: metadata.pageId
    };
  }
  _modernize_4_to_5(events) {
    const result = [];
    for (const event of events) {
      const e = this._modernize_event_4_to_5(event);
      if (e)
        result.push(e);
    }
    return result;
  }
  _modernize_event_4_to_5(event) {
    var _a, _b;
    if (event.type === "event" && event.method === "__create__" && event.class === "JSHandle")
      this._jsHandles.set(event.params.guid, event.params.initializer);
    if (event.type === "object") {
      if (event.class !== "ConsoleMessage")
        return null;
      const args = (_a = event.initializer.args) == null ? void 0 : _a.map((arg) => {
        if (arg.guid) {
          const handle = this._jsHandles.get(arg.guid);
          return { preview: (handle == null ? void 0 : handle.preview) || "", value: "" };
        }
        return { preview: arg.preview || "", value: arg.value || "" };
      });
      this._consoleObjects.set(event.guid, {
        type: event.initializer.type,
        text: event.initializer.text,
        location: event.initializer.location,
        args
      });
      return null;
    }
    if (event.type === "event" && event.method === "console") {
      const consoleMessage = this._consoleObjects.get(((_b = event.params.message) == null ? void 0 : _b.guid) || "");
      if (!consoleMessage)
        return null;
      return {
        type: "console",
        time: event.time,
        pageId: event.pageId,
        messageType: consoleMessage.type,
        text: consoleMessage.text,
        args: consoleMessage.args,
        location: consoleMessage.location
      };
    }
    return event;
  }
  _modernize_5_to_6(events) {
    const result = [];
    for (const event of events) {
      result.push(event);
      if (event.type !== "after" || !event.log.length)
        continue;
      for (const log of event.log) {
        result.push({
          type: "log",
          callId: event.callId,
          message: log,
          time: -1
        });
      }
    }
    return result;
  }
  _modernize_6_to_7(events) {
    const result = [];
    if (!this._processedContextCreatedEvent() && events[0].type !== "context-options") {
      const event = {
        type: "context-options",
        origin: "testRunner",
        version: 7,
        browserName: "",
        options: {},
        platform: process.platform,
        wallTime: 0,
        monotonicTime: 0,
        sdkLanguage: "javascript"
      };
      result.push(event);
    }
    for (const event of events) {
      if (event.type === "context-options") {
        result.push({ ...event, monotonicTime: 0, origin: "library" });
        continue;
      }
      if (!this._contextEntry.wallTime && event.type === "before")
        this._contextEntry.wallTime = event.wallTime;
      if (!this._contextEntry.startTime && event.type === "before")
        this._contextEntry.startTime = event.startTime;
      result.push(event);
    }
    return result;
  }
}
class TraceModel {
  constructor() {
    __publicField(this, "contextEntries", []);
    __publicField(this, "_snapshotStorage");
    __publicField(this, "_backend");
    __publicField(this, "_resourceToContentType", /* @__PURE__ */ new Map());
  }
  async load(backend, unzipProgress) {
    var _a, _b;
    this._backend = backend;
    const ordinals = [];
    let hasSource = false;
    for (const entryName of await this._backend.entryNames()) {
      const match = entryName.match(/(.+)\.trace/);
      if (match)
        ordinals.push(match[1] || "");
      if (entryName.includes("src@"))
        hasSource = true;
    }
    if (!ordinals.length)
      throw new Error("Cannot find .trace file");
    this._snapshotStorage = new SnapshotStorage();
    const total = ordinals.length * 3;
    let done = 0;
    for (const ordinal of ordinals) {
      const contextEntry = createEmptyContext();
      contextEntry.traceUrl = backend.traceURL();
      contextEntry.hasSource = hasSource;
      const modernizer = new TraceModernizer(contextEntry, this._snapshotStorage);
      const trace = await this._backend.readText(ordinal + ".trace") || "";
      modernizer.appendTrace(trace);
      unzipProgress(++done, total);
      const network = await this._backend.readText(ordinal + ".network") || "";
      modernizer.appendTrace(network);
      unzipProgress(++done, total);
      contextEntry.actions = modernizer.actions().sort((a1, a2) => a1.startTime - a2.startTime);
      if (!backend.isLive()) {
        for (const action of contextEntry.actions.slice().reverse()) {
          if (!action.endTime && !action.error) {
            for (const a of contextEntry.actions) {
              if (a.parentId === action.callId && action.endTime < a.endTime)
                action.endTime = a.endTime;
            }
          }
        }
      }
      const stacks = await this._backend.readText(ordinal + ".stacks");
      if (stacks) {
        const callMetadata = parseClientSideCallMetadata(JSON.parse(stacks));
        for (const action of contextEntry.actions)
          action.stack = action.stack || callMetadata.get(action.callId);
      }
      unzipProgress(++done, total);
      for (const resource of contextEntry.resources) {
        if ((_a = resource.request.postData) == null ? void 0 : _a._sha1)
          this._resourceToContentType.set(resource.request.postData._sha1, stripEncodingFromContentType(resource.request.postData.mimeType));
        if ((_b = resource.response.content) == null ? void 0 : _b._sha1)
          this._resourceToContentType.set(resource.response.content._sha1, stripEncodingFromContentType(resource.response.content.mimeType));
      }
      this.contextEntries.push(contextEntry);
    }
    this._snapshotStorage.finalize();
  }
  async hasEntry(filename) {
    return this._backend.hasEntry(filename);
  }
  async resourceForSha1(sha1) {
    const blob = await this._backend.readBlob("resources/" + sha1);
    const contentType = this._resourceToContentType.get(sha1);
    if (!blob || contentType === void 0 || contentType === "x-unknown")
      return blob;
    return new Blob([blob], { type: contentType });
  }
  storage() {
    return this._snapshotStorage;
  }
}
function stripEncodingFromContentType(contentType) {
  const charset = contentType.match(/^(.*);\s*charset=.*$/);
  if (charset)
    return charset[1];
  return contentType;
}
function createEmptyContext() {
  return {
    origin: "testRunner",
    traceUrl: "",
    startTime: Number.MAX_SAFE_INTEGER,
    wallTime: Number.MAX_SAFE_INTEGER,
    endTime: 0,
    browserName: "",
    options: {
      deviceScaleFactor: 1,
      isMobile: false,
      viewport: { width: 1280, height: 800 }
    },
    pages: [],
    resources: [],
    actions: [],
    events: [],
    errors: [],
    stdio: [],
    hasSource: false
  };
}
const MAX_BITS = 15;
const Z_OK = 0;
const Z_STREAM_END = 1;
const Z_NEED_DICT = 2;
const Z_STREAM_ERROR = -2;
const Z_DATA_ERROR = -3;
const Z_MEM_ERROR = -4;
const Z_BUF_ERROR = -5;
const inflate_mask = [
  0,
  1,
  3,
  7,
  15,
  31,
  63,
  127,
  255,
  511,
  1023,
  2047,
  4095,
  8191,
  16383,
  32767,
  65535
];
const MANY = 1440;
const Z_NO_FLUSH = 0;
const Z_FINISH = 4;
const fixed_bl = 9;
const fixed_bd = 5;
const fixed_tl = [
  96,
  7,
  256,
  0,
  8,
  80,
  0,
  8,
  16,
  84,
  8,
  115,
  82,
  7,
  31,
  0,
  8,
  112,
  0,
  8,
  48,
  0,
  9,
  192,
  80,
  7,
  10,
  0,
  8,
  96,
  0,
  8,
  32,
  0,
  9,
  160,
  0,
  8,
  0,
  0,
  8,
  128,
  0,
  8,
  64,
  0,
  9,
  224,
  80,
  7,
  6,
  0,
  8,
  88,
  0,
  8,
  24,
  0,
  9,
  144,
  83,
  7,
  59,
  0,
  8,
  120,
  0,
  8,
  56,
  0,
  9,
  208,
  81,
  7,
  17,
  0,
  8,
  104,
  0,
  8,
  40,
  0,
  9,
  176,
  0,
  8,
  8,
  0,
  8,
  136,
  0,
  8,
  72,
  0,
  9,
  240,
  80,
  7,
  4,
  0,
  8,
  84,
  0,
  8,
  20,
  85,
  8,
  227,
  83,
  7,
  43,
  0,
  8,
  116,
  0,
  8,
  52,
  0,
  9,
  200,
  81,
  7,
  13,
  0,
  8,
  100,
  0,
  8,
  36,
  0,
  9,
  168,
  0,
  8,
  4,
  0,
  8,
  132,
  0,
  8,
  68,
  0,
  9,
  232,
  80,
  7,
  8,
  0,
  8,
  92,
  0,
  8,
  28,
  0,
  9,
  152,
  84,
  7,
  83,
  0,
  8,
  124,
  0,
  8,
  60,
  0,
  9,
  216,
  82,
  7,
  23,
  0,
  8,
  108,
  0,
  8,
  44,
  0,
  9,
  184,
  0,
  8,
  12,
  0,
  8,
  140,
  0,
  8,
  76,
  0,
  9,
  248,
  80,
  7,
  3,
  0,
  8,
  82,
  0,
  8,
  18,
  85,
  8,
  163,
  83,
  7,
  35,
  0,
  8,
  114,
  0,
  8,
  50,
  0,
  9,
  196,
  81,
  7,
  11,
  0,
  8,
  98,
  0,
  8,
  34,
  0,
  9,
  164,
  0,
  8,
  2,
  0,
  8,
  130,
  0,
  8,
  66,
  0,
  9,
  228,
  80,
  7,
  7,
  0,
  8,
  90,
  0,
  8,
  26,
  0,
  9,
  148,
  84,
  7,
  67,
  0,
  8,
  122,
  0,
  8,
  58,
  0,
  9,
  212,
  82,
  7,
  19,
  0,
  8,
  106,
  0,
  8,
  42,
  0,
  9,
  180,
  0,
  8,
  10,
  0,
  8,
  138,
  0,
  8,
  74,
  0,
  9,
  244,
  80,
  7,
  5,
  0,
  8,
  86,
  0,
  8,
  22,
  192,
  8,
  0,
  83,
  7,
  51,
  0,
  8,
  118,
  0,
  8,
  54,
  0,
  9,
  204,
  81,
  7,
  15,
  0,
  8,
  102,
  0,
  8,
  38,
  0,
  9,
  172,
  0,
  8,
  6,
  0,
  8,
  134,
  0,
  8,
  70,
  0,
  9,
  236,
  80,
  7,
  9,
  0,
  8,
  94,
  0,
  8,
  30,
  0,
  9,
  156,
  84,
  7,
  99,
  0,
  8,
  126,
  0,
  8,
  62,
  0,
  9,
  220,
  82,
  7,
  27,
  0,
  8,
  110,
  0,
  8,
  46,
  0,
  9,
  188,
  0,
  8,
  14,
  0,
  8,
  142,
  0,
  8,
  78,
  0,
  9,
  252,
  96,
  7,
  256,
  0,
  8,
  81,
  0,
  8,
  17,
  85,
  8,
  131,
  82,
  7,
  31,
  0,
  8,
  113,
  0,
  8,
  49,
  0,
  9,
  194,
  80,
  7,
  10,
  0,
  8,
  97,
  0,
  8,
  33,
  0,
  9,
  162,
  0,
  8,
  1,
  0,
  8,
  129,
  0,
  8,
  65,
  0,
  9,
  226,
  80,
  7,
  6,
  0,
  8,
  89,
  0,
  8,
  25,
  0,
  9,
  146,
  83,
  7,
  59,
  0,
  8,
  121,
  0,
  8,
  57,
  0,
  9,
  210,
  81,
  7,
  17,
  0,
  8,
  105,
  0,
  8,
  41,
  0,
  9,
  178,
  0,
  8,
  9,
  0,
  8,
  137,
  0,
  8,
  73,
  0,
  9,
  242,
  80,
  7,
  4,
  0,
  8,
  85,
  0,
  8,
  21,
  80,
  8,
  258,
  83,
  7,
  43,
  0,
  8,
  117,
  0,
  8,
  53,
  0,
  9,
  202,
  81,
  7,
  13,
  0,
  8,
  101,
  0,
  8,
  37,
  0,
  9,
  170,
  0,
  8,
  5,
  0,
  8,
  133,
  0,
  8,
  69,
  0,
  9,
  234,
  80,
  7,
  8,
  0,
  8,
  93,
  0,
  8,
  29,
  0,
  9,
  154,
  84,
  7,
  83,
  0,
  8,
  125,
  0,
  8,
  61,
  0,
  9,
  218,
  82,
  7,
  23,
  0,
  8,
  109,
  0,
  8,
  45,
  0,
  9,
  186,
  0,
  8,
  13,
  0,
  8,
  141,
  0,
  8,
  77,
  0,
  9,
  250,
  80,
  7,
  3,
  0,
  8,
  83,
  0,
  8,
  19,
  85,
  8,
  195,
  83,
  7,
  35,
  0,
  8,
  115,
  0,
  8,
  51,
  0,
  9,
  198,
  81,
  7,
  11,
  0,
  8,
  99,
  0,
  8,
  35,
  0,
  9,
  166,
  0,
  8,
  3,
  0,
  8,
  131,
  0,
  8,
  67,
  0,
  9,
  230,
  80,
  7,
  7,
  0,
  8,
  91,
  0,
  8,
  27,
  0,
  9,
  150,
  84,
  7,
  67,
  0,
  8,
  123,
  0,
  8,
  59,
  0,
  9,
  214,
  82,
  7,
  19,
  0,
  8,
  107,
  0,
  8,
  43,
  0,
  9,
  182,
  0,
  8,
  11,
  0,
  8,
  139,
  0,
  8,
  75,
  0,
  9,
  246,
  80,
  7,
  5,
  0,
  8,
  87,
  0,
  8,
  23,
  192,
  8,
  0,
  83,
  7,
  51,
  0,
  8,
  119,
  0,
  8,
  55,
  0,
  9,
  206,
  81,
  7,
  15,
  0,
  8,
  103,
  0,
  8,
  39,
  0,
  9,
  174,
  0,
  8,
  7,
  0,
  8,
  135,
  0,
  8,
  71,
  0,
  9,
  238,
  80,
  7,
  9,
  0,
  8,
  95,
  0,
  8,
  31,
  0,
  9,
  158,
  84,
  7,
  99,
  0,
  8,
  127,
  0,
  8,
  63,
  0,
  9,
  222,
  82,
  7,
  27,
  0,
  8,
  111,
  0,
  8,
  47,
  0,
  9,
  190,
  0,
  8,
  15,
  0,
  8,
  143,
  0,
  8,
  79,
  0,
  9,
  254,
  96,
  7,
  256,
  0,
  8,
  80,
  0,
  8,
  16,
  84,
  8,
  115,
  82,
  7,
  31,
  0,
  8,
  112,
  0,
  8,
  48,
  0,
  9,
  193,
  80,
  7,
  10,
  0,
  8,
  96,
  0,
  8,
  32,
  0,
  9,
  161,
  0,
  8,
  0,
  0,
  8,
  128,
  0,
  8,
  64,
  0,
  9,
  225,
  80,
  7,
  6,
  0,
  8,
  88,
  0,
  8,
  24,
  0,
  9,
  145,
  83,
  7,
  59,
  0,
  8,
  120,
  0,
  8,
  56,
  0,
  9,
  209,
  81,
  7,
  17,
  0,
  8,
  104,
  0,
  8,
  40,
  0,
  9,
  177,
  0,
  8,
  8,
  0,
  8,
  136,
  0,
  8,
  72,
  0,
  9,
  241,
  80,
  7,
  4,
  0,
  8,
  84,
  0,
  8,
  20,
  85,
  8,
  227,
  83,
  7,
  43,
  0,
  8,
  116,
  0,
  8,
  52,
  0,
  9,
  201,
  81,
  7,
  13,
  0,
  8,
  100,
  0,
  8,
  36,
  0,
  9,
  169,
  0,
  8,
  4,
  0,
  8,
  132,
  0,
  8,
  68,
  0,
  9,
  233,
  80,
  7,
  8,
  0,
  8,
  92,
  0,
  8,
  28,
  0,
  9,
  153,
  84,
  7,
  83,
  0,
  8,
  124,
  0,
  8,
  60,
  0,
  9,
  217,
  82,
  7,
  23,
  0,
  8,
  108,
  0,
  8,
  44,
  0,
  9,
  185,
  0,
  8,
  12,
  0,
  8,
  140,
  0,
  8,
  76,
  0,
  9,
  249,
  80,
  7,
  3,
  0,
  8,
  82,
  0,
  8,
  18,
  85,
  8,
  163,
  83,
  7,
  35,
  0,
  8,
  114,
  0,
  8,
  50,
  0,
  9,
  197,
  81,
  7,
  11,
  0,
  8,
  98,
  0,
  8,
  34,
  0,
  9,
  165,
  0,
  8,
  2,
  0,
  8,
  130,
  0,
  8,
  66,
  0,
  9,
  229,
  80,
  7,
  7,
  0,
  8,
  90,
  0,
  8,
  26,
  0,
  9,
  149,
  84,
  7,
  67,
  0,
  8,
  122,
  0,
  8,
  58,
  0,
  9,
  213,
  82,
  7,
  19,
  0,
  8,
  106,
  0,
  8,
  42,
  0,
  9,
  181,
  0,
  8,
  10,
  0,
  8,
  138,
  0,
  8,
  74,
  0,
  9,
  245,
  80,
  7,
  5,
  0,
  8,
  86,
  0,
  8,
  22,
  192,
  8,
  0,
  83,
  7,
  51,
  0,
  8,
  118,
  0,
  8,
  54,
  0,
  9,
  205,
  81,
  7,
  15,
  0,
  8,
  102,
  0,
  8,
  38,
  0,
  9,
  173,
  0,
  8,
  6,
  0,
  8,
  134,
  0,
  8,
  70,
  0,
  9,
  237,
  80,
  7,
  9,
  0,
  8,
  94,
  0,
  8,
  30,
  0,
  9,
  157,
  84,
  7,
  99,
  0,
  8,
  126,
  0,
  8,
  62,
  0,
  9,
  221,
  82,
  7,
  27,
  0,
  8,
  110,
  0,
  8,
  46,
  0,
  9,
  189,
  0,
  8,
  14,
  0,
  8,
  142,
  0,
  8,
  78,
  0,
  9,
  253,
  96,
  7,
  256,
  0,
  8,
  81,
  0,
  8,
  17,
  85,
  8,
  131,
  82,
  7,
  31,
  0,
  8,
  113,
  0,
  8,
  49,
  0,
  9,
  195,
  80,
  7,
  10,
  0,
  8,
  97,
  0,
  8,
  33,
  0,
  9,
  163,
  0,
  8,
  1,
  0,
  8,
  129,
  0,
  8,
  65,
  0,
  9,
  227,
  80,
  7,
  6,
  0,
  8,
  89,
  0,
  8,
  25,
  0,
  9,
  147,
  83,
  7,
  59,
  0,
  8,
  121,
  0,
  8,
  57,
  0,
  9,
  211,
  81,
  7,
  17,
  0,
  8,
  105,
  0,
  8,
  41,
  0,
  9,
  179,
  0,
  8,
  9,
  0,
  8,
  137,
  0,
  8,
  73,
  0,
  9,
  243,
  80,
  7,
  4,
  0,
  8,
  85,
  0,
  8,
  21,
  80,
  8,
  258,
  83,
  7,
  43,
  0,
  8,
  117,
  0,
  8,
  53,
  0,
  9,
  203,
  81,
  7,
  13,
  0,
  8,
  101,
  0,
  8,
  37,
  0,
  9,
  171,
  0,
  8,
  5,
  0,
  8,
  133,
  0,
  8,
  69,
  0,
  9,
  235,
  80,
  7,
  8,
  0,
  8,
  93,
  0,
  8,
  29,
  0,
  9,
  155,
  84,
  7,
  83,
  0,
  8,
  125,
  0,
  8,
  61,
  0,
  9,
  219,
  82,
  7,
  23,
  0,
  8,
  109,
  0,
  8,
  45,
  0,
  9,
  187,
  0,
  8,
  13,
  0,
  8,
  141,
  0,
  8,
  77,
  0,
  9,
  251,
  80,
  7,
  3,
  0,
  8,
  83,
  0,
  8,
  19,
  85,
  8,
  195,
  83,
  7,
  35,
  0,
  8,
  115,
  0,
  8,
  51,
  0,
  9,
  199,
  81,
  7,
  11,
  0,
  8,
  99,
  0,
  8,
  35,
  0,
  9,
  167,
  0,
  8,
  3,
  0,
  8,
  131,
  0,
  8,
  67,
  0,
  9,
  231,
  80,
  7,
  7,
  0,
  8,
  91,
  0,
  8,
  27,
  0,
  9,
  151,
  84,
  7,
  67,
  0,
  8,
  123,
  0,
  8,
  59,
  0,
  9,
  215,
  82,
  7,
  19,
  0,
  8,
  107,
  0,
  8,
  43,
  0,
  9,
  183,
  0,
  8,
  11,
  0,
  8,
  139,
  0,
  8,
  75,
  0,
  9,
  247,
  80,
  7,
  5,
  0,
  8,
  87,
  0,
  8,
  23,
  192,
  8,
  0,
  83,
  7,
  51,
  0,
  8,
  119,
  0,
  8,
  55,
  0,
  9,
  207,
  81,
  7,
  15,
  0,
  8,
  103,
  0,
  8,
  39,
  0,
  9,
  175,
  0,
  8,
  7,
  0,
  8,
  135,
  0,
  8,
  71,
  0,
  9,
  239,
  80,
  7,
  9,
  0,
  8,
  95,
  0,
  8,
  31,
  0,
  9,
  159,
  84,
  7,
  99,
  0,
  8,
  127,
  0,
  8,
  63,
  0,
  9,
  223,
  82,
  7,
  27,
  0,
  8,
  111,
  0,
  8,
  47,
  0,
  9,
  191,
  0,
  8,
  15,
  0,
  8,
  143,
  0,
  8,
  79,
  0,
  9,
  255
];
const fixed_td = [
  80,
  5,
  1,
  87,
  5,
  257,
  83,
  5,
  17,
  91,
  5,
  4097,
  81,
  5,
  5,
  89,
  5,
  1025,
  85,
  5,
  65,
  93,
  5,
  16385,
  80,
  5,
  3,
  88,
  5,
  513,
  84,
  5,
  33,
  92,
  5,
  8193,
  82,
  5,
  9,
  90,
  5,
  2049,
  86,
  5,
  129,
  192,
  5,
  24577,
  80,
  5,
  2,
  87,
  5,
  385,
  83,
  5,
  25,
  91,
  5,
  6145,
  81,
  5,
  7,
  89,
  5,
  1537,
  85,
  5,
  97,
  93,
  5,
  24577,
  80,
  5,
  4,
  88,
  5,
  769,
  84,
  5,
  49,
  92,
  5,
  12289,
  82,
  5,
  13,
  90,
  5,
  3073,
  86,
  5,
  193,
  192,
  5,
  24577
];
const cplens = [
  // Copy lengths for literal codes 257..285
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  13,
  15,
  17,
  19,
  23,
  27,
  31,
  35,
  43,
  51,
  59,
  67,
  83,
  99,
  115,
  131,
  163,
  195,
  227,
  258,
  0,
  0
];
const cplext = [
  // Extra bits for literal codes 257..285
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  112,
  112
  // 112==invalid
];
const cpdist = [
  // Copy offsets for distance codes 0..29
  1,
  2,
  3,
  4,
  5,
  7,
  9,
  13,
  17,
  25,
  33,
  49,
  65,
  97,
  129,
  193,
  257,
  385,
  513,
  769,
  1025,
  1537,
  2049,
  3073,
  4097,
  6145,
  8193,
  12289,
  16385,
  24577
];
const cpdext = [
  // Extra bits for distance codes
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13
];
const BMAX = 15;
function InfTree() {
  const that = this;
  let hn;
  let v;
  let c;
  let r;
  let u;
  let x;
  function huft_build(b, bindex, n, s, d, e, t, m, hp, hn2, v2) {
    let a;
    let f;
    let g;
    let h;
    let i;
    let j;
    let k;
    let l;
    let mask;
    let p;
    let q;
    let w;
    let xp;
    let y;
    let z;
    p = 0;
    i = n;
    do {
      c[b[bindex + p]]++;
      p++;
      i--;
    } while (i !== 0);
    if (c[0] == n) {
      t[0] = -1;
      m[0] = 0;
      return Z_OK;
    }
    l = m[0];
    for (j = 1; j <= BMAX; j++)
      if (c[j] !== 0)
        break;
    k = j;
    if (l < j) {
      l = j;
    }
    for (i = BMAX; i !== 0; i--) {
      if (c[i] !== 0)
        break;
    }
    g = i;
    if (l > i) {
      l = i;
    }
    m[0] = l;
    for (y = 1 << j; j < i; j++, y <<= 1) {
      if ((y -= c[j]) < 0) {
        return Z_DATA_ERROR;
      }
    }
    if ((y -= c[i]) < 0) {
      return Z_DATA_ERROR;
    }
    c[i] += y;
    x[1] = j = 0;
    p = 1;
    xp = 2;
    while (--i !== 0) {
      x[xp] = j += c[p];
      xp++;
      p++;
    }
    i = 0;
    p = 0;
    do {
      if ((j = b[bindex + p]) !== 0) {
        v2[x[j]++] = i;
      }
      p++;
    } while (++i < n);
    n = x[g];
    x[0] = i = 0;
    p = 0;
    h = -1;
    w = -l;
    u[0] = 0;
    q = 0;
    z = 0;
    for (; k <= g; k++) {
      a = c[k];
      while (a-- !== 0) {
        while (k > w + l) {
          h++;
          w += l;
          z = g - w;
          z = z > l ? l : z;
          if ((f = 1 << (j = k - w)) > a + 1) {
            f -= a + 1;
            xp = k;
            if (j < z) {
              while (++j < z) {
                if ((f <<= 1) <= c[++xp])
                  break;
                f -= c[xp];
              }
            }
          }
          z = 1 << j;
          if (hn2[0] + z > MANY) {
            return Z_DATA_ERROR;
          }
          u[h] = q = /* hp+ */
          hn2[0];
          hn2[0] += z;
          if (h !== 0) {
            x[h] = i;
            r[0] = /* (byte) */
            j;
            r[1] = /* (byte) */
            l;
            j = i >>> w - l;
            r[2] = /* (int) */
            q - u[h - 1] - j;
            hp.set(r, (u[h - 1] + j) * 3);
          } else {
            t[0] = q;
          }
        }
        r[1] = /* (byte) */
        k - w;
        if (p >= n) {
          r[0] = 128 + 64;
        } else if (v2[p] < s) {
          r[0] = /* (byte) */
          v2[p] < 256 ? 0 : 32 + 64;
          r[2] = v2[p++];
        } else {
          r[0] = /* (byte) */
          e[v2[p] - s] + 16 + 64;
          r[2] = d[v2[p++] - s];
        }
        f = 1 << k - w;
        for (j = i >>> w; j < z; j += f) {
          hp.set(r, (q + j) * 3);
        }
        for (j = 1 << k - 1; (i & j) !== 0; j >>>= 1) {
          i ^= j;
        }
        i ^= j;
        mask = (1 << w) - 1;
        while ((i & mask) != x[h]) {
          h--;
          w -= l;
          mask = (1 << w) - 1;
        }
      }
    }
    return y !== 0 && g != 1 ? Z_BUF_ERROR : Z_OK;
  }
  function initWorkArea(vsize) {
    let i;
    if (!hn) {
      hn = [];
      v = [];
      c = new Int32Array(BMAX + 1);
      r = [];
      u = new Int32Array(BMAX);
      x = new Int32Array(BMAX + 1);
    }
    if (v.length < vsize) {
      v = [];
    }
    for (i = 0; i < vsize; i++) {
      v[i] = 0;
    }
    for (i = 0; i < BMAX + 1; i++) {
      c[i] = 0;
    }
    for (i = 0; i < 3; i++) {
      r[i] = 0;
    }
    u.set(c.subarray(0, BMAX), 0);
    x.set(c.subarray(0, BMAX + 1), 0);
  }
  that.inflate_trees_bits = function(c2, bb, tb, hp, z) {
    let result;
    initWorkArea(19);
    hn[0] = 0;
    result = huft_build(c2, 0, 19, 19, null, null, tb, bb, hp, hn, v);
    if (result == Z_DATA_ERROR) {
      z.msg = "oversubscribed dynamic bit lengths tree";
    } else if (result == Z_BUF_ERROR || bb[0] === 0) {
      z.msg = "incomplete dynamic bit lengths tree";
      result = Z_DATA_ERROR;
    }
    return result;
  };
  that.inflate_trees_dynamic = function(nl, nd, c2, bl, bd, tl, td, hp, z) {
    let result;
    initWorkArea(288);
    hn[0] = 0;
    result = huft_build(c2, 0, nl, 257, cplens, cplext, tl, bl, hp, hn, v);
    if (result != Z_OK || bl[0] === 0) {
      if (result == Z_DATA_ERROR) {
        z.msg = "oversubscribed literal/length tree";
      } else if (result != Z_MEM_ERROR) {
        z.msg = "incomplete literal/length tree";
        result = Z_DATA_ERROR;
      }
      return result;
    }
    initWorkArea(288);
    result = huft_build(c2, nl, nd, 0, cpdist, cpdext, td, bd, hp, hn, v);
    if (result != Z_OK || bd[0] === 0 && nl > 257) {
      if (result == Z_DATA_ERROR) {
        z.msg = "oversubscribed distance tree";
      } else if (result == Z_BUF_ERROR) {
        z.msg = "incomplete distance tree";
        result = Z_DATA_ERROR;
      } else if (result != Z_MEM_ERROR) {
        z.msg = "empty distance tree with lengths";
        result = Z_DATA_ERROR;
      }
      return result;
    }
    return Z_OK;
  };
}
InfTree.inflate_trees_fixed = function(bl, bd, tl, td) {
  bl[0] = fixed_bl;
  bd[0] = fixed_bd;
  tl[0] = fixed_tl;
  td[0] = fixed_td;
  return Z_OK;
};
const START = 0;
const LEN = 1;
const LENEXT = 2;
const DIST = 3;
const DISTEXT = 4;
const COPY = 5;
const LIT = 6;
const WASH = 7;
const END = 8;
const BADCODE = 9;
function InfCodes() {
  const that = this;
  let mode2;
  let len = 0;
  let tree;
  let tree_index = 0;
  let need = 0;
  let lit = 0;
  let get = 0;
  let dist = 0;
  let lbits = 0;
  let dbits = 0;
  let ltree;
  let ltree_index = 0;
  let dtree;
  let dtree_index = 0;
  function inflate_fast(bl, bd, tl, tl_index, td, td_index, s, z) {
    let t;
    let tp;
    let tp_index;
    let e;
    let b;
    let k;
    let p;
    let n;
    let q;
    let m;
    let ml;
    let md;
    let c;
    let d;
    let r;
    let tp_index_t_3;
    p = z.next_in_index;
    n = z.avail_in;
    b = s.bitb;
    k = s.bitk;
    q = s.write;
    m = q < s.read ? s.read - q - 1 : s.end - q;
    ml = inflate_mask[bl];
    md = inflate_mask[bd];
    do {
      while (k < 20) {
        n--;
        b |= (z.read_byte(p++) & 255) << k;
        k += 8;
      }
      t = b & ml;
      tp = tl;
      tp_index = tl_index;
      tp_index_t_3 = (tp_index + t) * 3;
      if ((e = tp[tp_index_t_3]) === 0) {
        b >>= tp[tp_index_t_3 + 1];
        k -= tp[tp_index_t_3 + 1];
        s.win[q++] = /* (byte) */
        tp[tp_index_t_3 + 2];
        m--;
        continue;
      }
      do {
        b >>= tp[tp_index_t_3 + 1];
        k -= tp[tp_index_t_3 + 1];
        if ((e & 16) !== 0) {
          e &= 15;
          c = tp[tp_index_t_3 + 2] + /* (int) */
          (b & inflate_mask[e]);
          b >>= e;
          k -= e;
          while (k < 15) {
            n--;
            b |= (z.read_byte(p++) & 255) << k;
            k += 8;
          }
          t = b & md;
          tp = td;
          tp_index = td_index;
          tp_index_t_3 = (tp_index + t) * 3;
          e = tp[tp_index_t_3];
          do {
            b >>= tp[tp_index_t_3 + 1];
            k -= tp[tp_index_t_3 + 1];
            if ((e & 16) !== 0) {
              e &= 15;
              while (k < e) {
                n--;
                b |= (z.read_byte(p++) & 255) << k;
                k += 8;
              }
              d = tp[tp_index_t_3 + 2] + (b & inflate_mask[e]);
              b >>= e;
              k -= e;
              m -= c;
              if (q >= d) {
                r = q - d;
                if (q - r > 0 && 2 > q - r) {
                  s.win[q++] = s.win[r++];
                  s.win[q++] = s.win[r++];
                  c -= 2;
                } else {
                  s.win.set(s.win.subarray(r, r + 2), q);
                  q += 2;
                  r += 2;
                  c -= 2;
                }
              } else {
                r = q - d;
                do {
                  r += s.end;
                } while (r < 0);
                e = s.end - r;
                if (c > e) {
                  c -= e;
                  if (q - r > 0 && e > q - r) {
                    do {
                      s.win[q++] = s.win[r++];
                    } while (--e !== 0);
                  } else {
                    s.win.set(s.win.subarray(r, r + e), q);
                    q += e;
                    r += e;
                    e = 0;
                  }
                  r = 0;
                }
              }
              if (q - r > 0 && c > q - r) {
                do {
                  s.win[q++] = s.win[r++];
                } while (--c !== 0);
              } else {
                s.win.set(s.win.subarray(r, r + c), q);
                q += c;
                r += c;
                c = 0;
              }
              break;
            } else if ((e & 64) === 0) {
              t += tp[tp_index_t_3 + 2];
              t += b & inflate_mask[e];
              tp_index_t_3 = (tp_index + t) * 3;
              e = tp[tp_index_t_3];
            } else {
              z.msg = "invalid distance code";
              c = z.avail_in - n;
              c = k >> 3 < c ? k >> 3 : c;
              n += c;
              p -= c;
              k -= c << 3;
              s.bitb = b;
              s.bitk = k;
              z.avail_in = n;
              z.total_in += p - z.next_in_index;
              z.next_in_index = p;
              s.write = q;
              return Z_DATA_ERROR;
            }
          } while (true);
          break;
        }
        if ((e & 64) === 0) {
          t += tp[tp_index_t_3 + 2];
          t += b & inflate_mask[e];
          tp_index_t_3 = (tp_index + t) * 3;
          if ((e = tp[tp_index_t_3]) === 0) {
            b >>= tp[tp_index_t_3 + 1];
            k -= tp[tp_index_t_3 + 1];
            s.win[q++] = /* (byte) */
            tp[tp_index_t_3 + 2];
            m--;
            break;
          }
        } else if ((e & 32) !== 0) {
          c = z.avail_in - n;
          c = k >> 3 < c ? k >> 3 : c;
          n += c;
          p -= c;
          k -= c << 3;
          s.bitb = b;
          s.bitk = k;
          z.avail_in = n;
          z.total_in += p - z.next_in_index;
          z.next_in_index = p;
          s.write = q;
          return Z_STREAM_END;
        } else {
          z.msg = "invalid literal/length code";
          c = z.avail_in - n;
          c = k >> 3 < c ? k >> 3 : c;
          n += c;
          p -= c;
          k -= c << 3;
          s.bitb = b;
          s.bitk = k;
          z.avail_in = n;
          z.total_in += p - z.next_in_index;
          z.next_in_index = p;
          s.write = q;
          return Z_DATA_ERROR;
        }
      } while (true);
    } while (m >= 258 && n >= 10);
    c = z.avail_in - n;
    c = k >> 3 < c ? k >> 3 : c;
    n += c;
    p -= c;
    k -= c << 3;
    s.bitb = b;
    s.bitk = k;
    z.avail_in = n;
    z.total_in += p - z.next_in_index;
    z.next_in_index = p;
    s.write = q;
    return Z_OK;
  }
  that.init = function(bl, bd, tl, tl_index, td, td_index) {
    mode2 = START;
    lbits = /* (byte) */
    bl;
    dbits = /* (byte) */
    bd;
    ltree = tl;
    ltree_index = tl_index;
    dtree = td;
    dtree_index = td_index;
    tree = null;
  };
  that.proc = function(s, z, r) {
    let j;
    let tindex;
    let e;
    let b = 0;
    let k = 0;
    let p = 0;
    let n;
    let q;
    let m;
    let f;
    p = z.next_in_index;
    n = z.avail_in;
    b = s.bitb;
    k = s.bitk;
    q = s.write;
    m = q < s.read ? s.read - q - 1 : s.end - q;
    while (true) {
      switch (mode2) {
        case START:
          if (m >= 258 && n >= 10) {
            s.bitb = b;
            s.bitk = k;
            z.avail_in = n;
            z.total_in += p - z.next_in_index;
            z.next_in_index = p;
            s.write = q;
            r = inflate_fast(lbits, dbits, ltree, ltree_index, dtree, dtree_index, s, z);
            p = z.next_in_index;
            n = z.avail_in;
            b = s.bitb;
            k = s.bitk;
            q = s.write;
            m = q < s.read ? s.read - q - 1 : s.end - q;
            if (r != Z_OK) {
              mode2 = r == Z_STREAM_END ? WASH : BADCODE;
              break;
            }
          }
          need = lbits;
          tree = ltree;
          tree_index = ltree_index;
          mode2 = LEN;
        case LEN:
          j = need;
          while (k < j) {
            if (n !== 0)
              r = Z_OK;
            else {
              s.bitb = b;
              s.bitk = k;
              z.avail_in = n;
              z.total_in += p - z.next_in_index;
              z.next_in_index = p;
              s.write = q;
              return s.inflate_flush(z, r);
            }
            n--;
            b |= (z.read_byte(p++) & 255) << k;
            k += 8;
          }
          tindex = (tree_index + (b & inflate_mask[j])) * 3;
          b >>>= tree[tindex + 1];
          k -= tree[tindex + 1];
          e = tree[tindex];
          if (e === 0) {
            lit = tree[tindex + 2];
            mode2 = LIT;
            break;
          }
          if ((e & 16) !== 0) {
            get = e & 15;
            len = tree[tindex + 2];
            mode2 = LENEXT;
            break;
          }
          if ((e & 64) === 0) {
            need = e;
            tree_index = tindex / 3 + tree[tindex + 2];
            break;
          }
          if ((e & 32) !== 0) {
            mode2 = WASH;
            break;
          }
          mode2 = BADCODE;
          z.msg = "invalid literal/length code";
          r = Z_DATA_ERROR;
          s.bitb = b;
          s.bitk = k;
          z.avail_in = n;
          z.total_in += p - z.next_in_index;
          z.next_in_index = p;
          s.write = q;
          return s.inflate_flush(z, r);
        case LENEXT:
          j = get;
          while (k < j) {
            if (n !== 0)
              r = Z_OK;
            else {
              s.bitb = b;
              s.bitk = k;
              z.avail_in = n;
              z.total_in += p - z.next_in_index;
              z.next_in_index = p;
              s.write = q;
              return s.inflate_flush(z, r);
            }
            n--;
            b |= (z.read_byte(p++) & 255) << k;
            k += 8;
          }
          len += b & inflate_mask[j];
          b >>= j;
          k -= j;
          need = dbits;
          tree = dtree;
          tree_index = dtree_index;
          mode2 = DIST;
        case DIST:
          j = need;
          while (k < j) {
            if (n !== 0)
              r = Z_OK;
            else {
              s.bitb = b;
              s.bitk = k;
              z.avail_in = n;
              z.total_in += p - z.next_in_index;
              z.next_in_index = p;
              s.write = q;
              return s.inflate_flush(z, r);
            }
            n--;
            b |= (z.read_byte(p++) & 255) << k;
            k += 8;
          }
          tindex = (tree_index + (b & inflate_mask[j])) * 3;
          b >>= tree[tindex + 1];
          k -= tree[tindex + 1];
          e = tree[tindex];
          if ((e & 16) !== 0) {
            get = e & 15;
            dist = tree[tindex + 2];
            mode2 = DISTEXT;
            break;
          }
          if ((e & 64) === 0) {
            need = e;
            tree_index = tindex / 3 + tree[tindex + 2];
            break;
          }
          mode2 = BADCODE;
          z.msg = "invalid distance code";
          r = Z_DATA_ERROR;
          s.bitb = b;
          s.bitk = k;
          z.avail_in = n;
          z.total_in += p - z.next_in_index;
          z.next_in_index = p;
          s.write = q;
          return s.inflate_flush(z, r);
        case DISTEXT:
          j = get;
          while (k < j) {
            if (n !== 0)
              r = Z_OK;
            else {
              s.bitb = b;
              s.bitk = k;
              z.avail_in = n;
              z.total_in += p - z.next_in_index;
              z.next_in_index = p;
              s.write = q;
              return s.inflate_flush(z, r);
            }
            n--;
            b |= (z.read_byte(p++) & 255) << k;
            k += 8;
          }
          dist += b & inflate_mask[j];
          b >>= j;
          k -= j;
          mode2 = COPY;
        case COPY:
          f = q - dist;
          while (f < 0) {
            f += s.end;
          }
          while (len !== 0) {
            if (m === 0) {
              if (q == s.end && s.read !== 0) {
                q = 0;
                m = q < s.read ? s.read - q - 1 : s.end - q;
              }
              if (m === 0) {
                s.write = q;
                r = s.inflate_flush(z, r);
                q = s.write;
                m = q < s.read ? s.read - q - 1 : s.end - q;
                if (q == s.end && s.read !== 0) {
                  q = 0;
                  m = q < s.read ? s.read - q - 1 : s.end - q;
                }
                if (m === 0) {
                  s.bitb = b;
                  s.bitk = k;
                  z.avail_in = n;
                  z.total_in += p - z.next_in_index;
                  z.next_in_index = p;
                  s.write = q;
                  return s.inflate_flush(z, r);
                }
              }
            }
            s.win[q++] = s.win[f++];
            m--;
            if (f == s.end)
              f = 0;
            len--;
          }
          mode2 = START;
          break;
        case LIT:
          if (m === 0) {
            if (q == s.end && s.read !== 0) {
              q = 0;
              m = q < s.read ? s.read - q - 1 : s.end - q;
            }
            if (m === 0) {
              s.write = q;
              r = s.inflate_flush(z, r);
              q = s.write;
              m = q < s.read ? s.read - q - 1 : s.end - q;
              if (q == s.end && s.read !== 0) {
                q = 0;
                m = q < s.read ? s.read - q - 1 : s.end - q;
              }
              if (m === 0) {
                s.bitb = b;
                s.bitk = k;
                z.avail_in = n;
                z.total_in += p - z.next_in_index;
                z.next_in_index = p;
                s.write = q;
                return s.inflate_flush(z, r);
              }
            }
          }
          r = Z_OK;
          s.win[q++] = /* (byte) */
          lit;
          m--;
          mode2 = START;
          break;
        case WASH:
          if (k > 7) {
            k -= 8;
            n++;
            p--;
          }
          s.write = q;
          r = s.inflate_flush(z, r);
          q = s.write;
          m = q < s.read ? s.read - q - 1 : s.end - q;
          if (s.read != s.write) {
            s.bitb = b;
            s.bitk = k;
            z.avail_in = n;
            z.total_in += p - z.next_in_index;
            z.next_in_index = p;
            s.write = q;
            return s.inflate_flush(z, r);
          }
          mode2 = END;
        case END:
          r = Z_STREAM_END;
          s.bitb = b;
          s.bitk = k;
          z.avail_in = n;
          z.total_in += p - z.next_in_index;
          z.next_in_index = p;
          s.write = q;
          return s.inflate_flush(z, r);
        case BADCODE:
          r = Z_DATA_ERROR;
          s.bitb = b;
          s.bitk = k;
          z.avail_in = n;
          z.total_in += p - z.next_in_index;
          z.next_in_index = p;
          s.write = q;
          return s.inflate_flush(z, r);
        default:
          r = Z_STREAM_ERROR;
          s.bitb = b;
          s.bitk = k;
          z.avail_in = n;
          z.total_in += p - z.next_in_index;
          z.next_in_index = p;
          s.write = q;
          return s.inflate_flush(z, r);
      }
    }
  };
  that.free = function() {
  };
}
const border = [
  // Order of the bit length code lengths
  16,
  17,
  18,
  0,
  8,
  7,
  9,
  6,
  10,
  5,
  11,
  4,
  12,
  3,
  13,
  2,
  14,
  1,
  15
];
const TYPE = 0;
const LENS = 1;
const STORED = 2;
const TABLE = 3;
const BTREE = 4;
const DTREE = 5;
const CODES = 6;
const DRY = 7;
const DONELOCKS = 8;
const BADBLOCKS = 9;
function InfBlocks(z, w) {
  const that = this;
  let mode2 = TYPE;
  let left = 0;
  let table2 = 0;
  let index = 0;
  let blens;
  const bb = [0];
  const tb = [0];
  const codes = new InfCodes();
  let last = 0;
  let hufts = new Int32Array(MANY * 3);
  const check = 0;
  const inftree = new InfTree();
  that.bitk = 0;
  that.bitb = 0;
  that.win = new Uint8Array(w);
  that.end = w;
  that.read = 0;
  that.write = 0;
  that.reset = function(z2, c) {
    if (c)
      c[0] = check;
    if (mode2 == CODES) {
      codes.free(z2);
    }
    mode2 = TYPE;
    that.bitk = 0;
    that.bitb = 0;
    that.read = that.write = 0;
  };
  that.reset(z, null);
  that.inflate_flush = function(z2, r) {
    let n;
    let p;
    let q;
    p = z2.next_out_index;
    q = that.read;
    n = /* (int) */
    (q <= that.write ? that.write : that.end) - q;
    if (n > z2.avail_out)
      n = z2.avail_out;
    if (n !== 0 && r == Z_BUF_ERROR)
      r = Z_OK;
    z2.avail_out -= n;
    z2.total_out += n;
    z2.next_out.set(that.win.subarray(q, q + n), p);
    p += n;
    q += n;
    if (q == that.end) {
      q = 0;
      if (that.write == that.end)
        that.write = 0;
      n = that.write - q;
      if (n > z2.avail_out)
        n = z2.avail_out;
      if (n !== 0 && r == Z_BUF_ERROR)
        r = Z_OK;
      z2.avail_out -= n;
      z2.total_out += n;
      z2.next_out.set(that.win.subarray(q, q + n), p);
      p += n;
      q += n;
    }
    z2.next_out_index = p;
    that.read = q;
    return r;
  };
  that.proc = function(z2, r) {
    let t;
    let b;
    let k;
    let p;
    let n;
    let q;
    let m;
    let i;
    p = z2.next_in_index;
    n = z2.avail_in;
    b = that.bitb;
    k = that.bitk;
    q = that.write;
    m = /* (int) */
    q < that.read ? that.read - q - 1 : that.end - q;
    while (true) {
      let bl, bd, tl, td, bl_, bd_, tl_, td_;
      switch (mode2) {
        case TYPE:
          while (k < 3) {
            if (n !== 0) {
              r = Z_OK;
            } else {
              that.bitb = b;
              that.bitk = k;
              z2.avail_in = n;
              z2.total_in += p - z2.next_in_index;
              z2.next_in_index = p;
              that.write = q;
              return that.inflate_flush(z2, r);
            }
            n--;
            b |= (z2.read_byte(p++) & 255) << k;
            k += 8;
          }
          t = /* (int) */
          b & 7;
          last = t & 1;
          switch (t >>> 1) {
            case 0:
              b >>>= 3;
              k -= 3;
              t = k & 7;
              b >>>= t;
              k -= t;
              mode2 = LENS;
              break;
            case 1:
              bl = [];
              bd = [];
              tl = [[]];
              td = [[]];
              InfTree.inflate_trees_fixed(bl, bd, tl, td);
              codes.init(bl[0], bd[0], tl[0], 0, td[0], 0);
              b >>>= 3;
              k -= 3;
              mode2 = CODES;
              break;
            case 2:
              b >>>= 3;
              k -= 3;
              mode2 = TABLE;
              break;
            case 3:
              b >>>= 3;
              k -= 3;
              mode2 = BADBLOCKS;
              z2.msg = "invalid block type";
              r = Z_DATA_ERROR;
              that.bitb = b;
              that.bitk = k;
              z2.avail_in = n;
              z2.total_in += p - z2.next_in_index;
              z2.next_in_index = p;
              that.write = q;
              return that.inflate_flush(z2, r);
          }
          break;
        case LENS:
          while (k < 32) {
            if (n !== 0) {
              r = Z_OK;
            } else {
              that.bitb = b;
              that.bitk = k;
              z2.avail_in = n;
              z2.total_in += p - z2.next_in_index;
              z2.next_in_index = p;
              that.write = q;
              return that.inflate_flush(z2, r);
            }
            n--;
            b |= (z2.read_byte(p++) & 255) << k;
            k += 8;
          }
          if ((~b >>> 16 & 65535) != (b & 65535)) {
            mode2 = BADBLOCKS;
            z2.msg = "invalid stored block lengths";
            r = Z_DATA_ERROR;
            that.bitb = b;
            that.bitk = k;
            z2.avail_in = n;
            z2.total_in += p - z2.next_in_index;
            z2.next_in_index = p;
            that.write = q;
            return that.inflate_flush(z2, r);
          }
          left = b & 65535;
          b = k = 0;
          mode2 = left !== 0 ? STORED : last !== 0 ? DRY : TYPE;
          break;
        case STORED:
          if (n === 0) {
            that.bitb = b;
            that.bitk = k;
            z2.avail_in = n;
            z2.total_in += p - z2.next_in_index;
            z2.next_in_index = p;
            that.write = q;
            return that.inflate_flush(z2, r);
          }
          if (m === 0) {
            if (q == that.end && that.read !== 0) {
              q = 0;
              m = /* (int) */
              q < that.read ? that.read - q - 1 : that.end - q;
            }
            if (m === 0) {
              that.write = q;
              r = that.inflate_flush(z2, r);
              q = that.write;
              m = /* (int) */
              q < that.read ? that.read - q - 1 : that.end - q;
              if (q == that.end && that.read !== 0) {
                q = 0;
                m = /* (int) */
                q < that.read ? that.read - q - 1 : that.end - q;
              }
              if (m === 0) {
                that.bitb = b;
                that.bitk = k;
                z2.avail_in = n;
                z2.total_in += p - z2.next_in_index;
                z2.next_in_index = p;
                that.write = q;
                return that.inflate_flush(z2, r);
              }
            }
          }
          r = Z_OK;
          t = left;
          if (t > n)
            t = n;
          if (t > m)
            t = m;
          that.win.set(z2.read_buf(p, t), q);
          p += t;
          n -= t;
          q += t;
          m -= t;
          if ((left -= t) !== 0)
            break;
          mode2 = last !== 0 ? DRY : TYPE;
          break;
        case TABLE:
          while (k < 14) {
            if (n !== 0) {
              r = Z_OK;
            } else {
              that.bitb = b;
              that.bitk = k;
              z2.avail_in = n;
              z2.total_in += p - z2.next_in_index;
              z2.next_in_index = p;
              that.write = q;
              return that.inflate_flush(z2, r);
            }
            n--;
            b |= (z2.read_byte(p++) & 255) << k;
            k += 8;
          }
          table2 = t = b & 16383;
          if ((t & 31) > 29 || (t >> 5 & 31) > 29) {
            mode2 = BADBLOCKS;
            z2.msg = "too many length or distance symbols";
            r = Z_DATA_ERROR;
            that.bitb = b;
            that.bitk = k;
            z2.avail_in = n;
            z2.total_in += p - z2.next_in_index;
            z2.next_in_index = p;
            that.write = q;
            return that.inflate_flush(z2, r);
          }
          t = 258 + (t & 31) + (t >> 5 & 31);
          if (!blens || blens.length < t) {
            blens = [];
          } else {
            for (i = 0; i < t; i++) {
              blens[i] = 0;
            }
          }
          b >>>= 14;
          k -= 14;
          index = 0;
          mode2 = BTREE;
        case BTREE:
          while (index < 4 + (table2 >>> 10)) {
            while (k < 3) {
              if (n !== 0) {
                r = Z_OK;
              } else {
                that.bitb = b;
                that.bitk = k;
                z2.avail_in = n;
                z2.total_in += p - z2.next_in_index;
                z2.next_in_index = p;
                that.write = q;
                return that.inflate_flush(z2, r);
              }
              n--;
              b |= (z2.read_byte(p++) & 255) << k;
              k += 8;
            }
            blens[border[index++]] = b & 7;
            b >>>= 3;
            k -= 3;
          }
          while (index < 19) {
            blens[border[index++]] = 0;
          }
          bb[0] = 7;
          t = inftree.inflate_trees_bits(blens, bb, tb, hufts, z2);
          if (t != Z_OK) {
            r = t;
            if (r == Z_DATA_ERROR) {
              blens = null;
              mode2 = BADBLOCKS;
            }
            that.bitb = b;
            that.bitk = k;
            z2.avail_in = n;
            z2.total_in += p - z2.next_in_index;
            z2.next_in_index = p;
            that.write = q;
            return that.inflate_flush(z2, r);
          }
          index = 0;
          mode2 = DTREE;
        case DTREE:
          while (true) {
            t = table2;
            if (index >= 258 + (t & 31) + (t >> 5 & 31)) {
              break;
            }
            let j, c;
            t = bb[0];
            while (k < t) {
              if (n !== 0) {
                r = Z_OK;
              } else {
                that.bitb = b;
                that.bitk = k;
                z2.avail_in = n;
                z2.total_in += p - z2.next_in_index;
                z2.next_in_index = p;
                that.write = q;
                return that.inflate_flush(z2, r);
              }
              n--;
              b |= (z2.read_byte(p++) & 255) << k;
              k += 8;
            }
            t = hufts[(tb[0] + (b & inflate_mask[t])) * 3 + 1];
            c = hufts[(tb[0] + (b & inflate_mask[t])) * 3 + 2];
            if (c < 16) {
              b >>>= t;
              k -= t;
              blens[index++] = c;
            } else {
              i = c == 18 ? 7 : c - 14;
              j = c == 18 ? 11 : 3;
              while (k < t + i) {
                if (n !== 0) {
                  r = Z_OK;
                } else {
                  that.bitb = b;
                  that.bitk = k;
                  z2.avail_in = n;
                  z2.total_in += p - z2.next_in_index;
                  z2.next_in_index = p;
                  that.write = q;
                  return that.inflate_flush(z2, r);
                }
                n--;
                b |= (z2.read_byte(p++) & 255) << k;
                k += 8;
              }
              b >>>= t;
              k -= t;
              j += b & inflate_mask[i];
              b >>>= i;
              k -= i;
              i = index;
              t = table2;
              if (i + j > 258 + (t & 31) + (t >> 5 & 31) || c == 16 && i < 1) {
                blens = null;
                mode2 = BADBLOCKS;
                z2.msg = "invalid bit length repeat";
                r = Z_DATA_ERROR;
                that.bitb = b;
                that.bitk = k;
                z2.avail_in = n;
                z2.total_in += p - z2.next_in_index;
                z2.next_in_index = p;
                that.write = q;
                return that.inflate_flush(z2, r);
              }
              c = c == 16 ? blens[i - 1] : 0;
              do {
                blens[i++] = c;
              } while (--j !== 0);
              index = i;
            }
          }
          tb[0] = -1;
          bl_ = [];
          bd_ = [];
          tl_ = [];
          td_ = [];
          bl_[0] = 9;
          bd_[0] = 6;
          t = table2;
          t = inftree.inflate_trees_dynamic(257 + (t & 31), 1 + (t >> 5 & 31), blens, bl_, bd_, tl_, td_, hufts, z2);
          if (t != Z_OK) {
            if (t == Z_DATA_ERROR) {
              blens = null;
              mode2 = BADBLOCKS;
            }
            r = t;
            that.bitb = b;
            that.bitk = k;
            z2.avail_in = n;
            z2.total_in += p - z2.next_in_index;
            z2.next_in_index = p;
            that.write = q;
            return that.inflate_flush(z2, r);
          }
          codes.init(bl_[0], bd_[0], hufts, tl_[0], hufts, td_[0]);
          mode2 = CODES;
        case CODES:
          that.bitb = b;
          that.bitk = k;
          z2.avail_in = n;
          z2.total_in += p - z2.next_in_index;
          z2.next_in_index = p;
          that.write = q;
          if ((r = codes.proc(that, z2, r)) != Z_STREAM_END) {
            return that.inflate_flush(z2, r);
          }
          r = Z_OK;
          codes.free(z2);
          p = z2.next_in_index;
          n = z2.avail_in;
          b = that.bitb;
          k = that.bitk;
          q = that.write;
          m = /* (int) */
          q < that.read ? that.read - q - 1 : that.end - q;
          if (last === 0) {
            mode2 = TYPE;
            break;
          }
          mode2 = DRY;
        case DRY:
          that.write = q;
          r = that.inflate_flush(z2, r);
          q = that.write;
          m = /* (int) */
          q < that.read ? that.read - q - 1 : that.end - q;
          if (that.read != that.write) {
            that.bitb = b;
            that.bitk = k;
            z2.avail_in = n;
            z2.total_in += p - z2.next_in_index;
            z2.next_in_index = p;
            that.write = q;
            return that.inflate_flush(z2, r);
          }
          mode2 = DONELOCKS;
        case DONELOCKS:
          r = Z_STREAM_END;
          that.bitb = b;
          that.bitk = k;
          z2.avail_in = n;
          z2.total_in += p - z2.next_in_index;
          z2.next_in_index = p;
          that.write = q;
          return that.inflate_flush(z2, r);
        case BADBLOCKS:
          r = Z_DATA_ERROR;
          that.bitb = b;
          that.bitk = k;
          z2.avail_in = n;
          z2.total_in += p - z2.next_in_index;
          z2.next_in_index = p;
          that.write = q;
          return that.inflate_flush(z2, r);
        default:
          r = Z_STREAM_ERROR;
          that.bitb = b;
          that.bitk = k;
          z2.avail_in = n;
          z2.total_in += p - z2.next_in_index;
          z2.next_in_index = p;
          that.write = q;
          return that.inflate_flush(z2, r);
      }
    }
  };
  that.free = function(z2) {
    that.reset(z2, null);
    that.win = null;
    hufts = null;
  };
  that.set_dictionary = function(d, start, n) {
    that.win.set(d.subarray(start, start + n), 0);
    that.read = that.write = n;
  };
  that.sync_point = function() {
    return mode2 == LENS ? 1 : 0;
  };
}
const PRESET_DICT = 32;
const Z_DEFLATED = 8;
const METHOD = 0;
const FLAG = 1;
const DICT4 = 2;
const DICT3 = 3;
const DICT2 = 4;
const DICT1 = 5;
const DICT0 = 6;
const BLOCKS = 7;
const DONE = 12;
const BAD = 13;
const mark = [0, 0, 255, 255];
function Inflate() {
  const that = this;
  that.mode = 0;
  that.method = 0;
  that.was = [0];
  that.need = 0;
  that.marker = 0;
  that.wbits = 0;
  function inflateReset(z) {
    if (!z || !z.istate)
      return Z_STREAM_ERROR;
    z.total_in = z.total_out = 0;
    z.msg = null;
    z.istate.mode = BLOCKS;
    z.istate.blocks.reset(z, null);
    return Z_OK;
  }
  that.inflateEnd = function(z) {
    if (that.blocks)
      that.blocks.free(z);
    that.blocks = null;
    return Z_OK;
  };
  that.inflateInit = function(z, w) {
    z.msg = null;
    that.blocks = null;
    if (w < 8 || w > 15) {
      that.inflateEnd(z);
      return Z_STREAM_ERROR;
    }
    that.wbits = w;
    z.istate.blocks = new InfBlocks(z, 1 << w);
    inflateReset(z);
    return Z_OK;
  };
  that.inflate = function(z, f) {
    let r;
    let b;
    if (!z || !z.istate || !z.next_in)
      return Z_STREAM_ERROR;
    const istate = z.istate;
    f = f == Z_FINISH ? Z_BUF_ERROR : Z_OK;
    r = Z_BUF_ERROR;
    while (true) {
      switch (istate.mode) {
        case METHOD:
          if (z.avail_in === 0)
            return r;
          r = f;
          z.avail_in--;
          z.total_in++;
          if (((istate.method = z.read_byte(z.next_in_index++)) & 15) != Z_DEFLATED) {
            istate.mode = BAD;
            z.msg = "unknown compression method";
            istate.marker = 5;
            break;
          }
          if ((istate.method >> 4) + 8 > istate.wbits) {
            istate.mode = BAD;
            z.msg = "invalid win size";
            istate.marker = 5;
            break;
          }
          istate.mode = FLAG;
        case FLAG:
          if (z.avail_in === 0)
            return r;
          r = f;
          z.avail_in--;
          z.total_in++;
          b = z.read_byte(z.next_in_index++) & 255;
          if (((istate.method << 8) + b) % 31 !== 0) {
            istate.mode = BAD;
            z.msg = "incorrect header check";
            istate.marker = 5;
            break;
          }
          if ((b & PRESET_DICT) === 0) {
            istate.mode = BLOCKS;
            break;
          }
          istate.mode = DICT4;
        case DICT4:
          if (z.avail_in === 0)
            return r;
          r = f;
          z.avail_in--;
          z.total_in++;
          istate.need = (z.read_byte(z.next_in_index++) & 255) << 24 & 4278190080;
          istate.mode = DICT3;
        case DICT3:
          if (z.avail_in === 0)
            return r;
          r = f;
          z.avail_in--;
          z.total_in++;
          istate.need += (z.read_byte(z.next_in_index++) & 255) << 16 & 16711680;
          istate.mode = DICT2;
        case DICT2:
          if (z.avail_in === 0)
            return r;
          r = f;
          z.avail_in--;
          z.total_in++;
          istate.need += (z.read_byte(z.next_in_index++) & 255) << 8 & 65280;
          istate.mode = DICT1;
        case DICT1:
          if (z.avail_in === 0)
            return r;
          r = f;
          z.avail_in--;
          z.total_in++;
          istate.need += z.read_byte(z.next_in_index++) & 255;
          istate.mode = DICT0;
          return Z_NEED_DICT;
        case DICT0:
          istate.mode = BAD;
          z.msg = "need dictionary";
          istate.marker = 0;
          return Z_STREAM_ERROR;
        case BLOCKS:
          r = istate.blocks.proc(z, r);
          if (r == Z_DATA_ERROR) {
            istate.mode = BAD;
            istate.marker = 0;
            break;
          }
          if (r == Z_OK) {
            r = f;
          }
          if (r != Z_STREAM_END) {
            return r;
          }
          r = f;
          istate.blocks.reset(z, istate.was);
          istate.mode = DONE;
        case DONE:
          z.avail_in = 0;
          return Z_STREAM_END;
        case BAD:
          return Z_DATA_ERROR;
        default:
          return Z_STREAM_ERROR;
      }
    }
  };
  that.inflateSetDictionary = function(z, dictionary, dictLength) {
    let index = 0, length = dictLength;
    if (!z || !z.istate || z.istate.mode != DICT0)
      return Z_STREAM_ERROR;
    const istate = z.istate;
    if (length >= 1 << istate.wbits) {
      length = (1 << istate.wbits) - 1;
      index = dictLength - length;
    }
    istate.blocks.set_dictionary(dictionary, index, length);
    istate.mode = BLOCKS;
    return Z_OK;
  };
  that.inflateSync = function(z) {
    let n;
    let p;
    let m;
    let r, w;
    if (!z || !z.istate)
      return Z_STREAM_ERROR;
    const istate = z.istate;
    if (istate.mode != BAD) {
      istate.mode = BAD;
      istate.marker = 0;
    }
    if ((n = z.avail_in) === 0)
      return Z_BUF_ERROR;
    p = z.next_in_index;
    m = istate.marker;
    while (n !== 0 && m < 4) {
      if (z.read_byte(p) == mark[m]) {
        m++;
      } else if (z.read_byte(p) !== 0) {
        m = 0;
      } else {
        m = 4 - m;
      }
      p++;
      n--;
    }
    z.total_in += p - z.next_in_index;
    z.next_in_index = p;
    z.avail_in = n;
    istate.marker = m;
    if (m != 4) {
      return Z_DATA_ERROR;
    }
    r = z.total_in;
    w = z.total_out;
    inflateReset(z);
    z.total_in = r;
    z.total_out = w;
    istate.mode = BLOCKS;
    return Z_OK;
  };
  that.inflateSyncPoint = function(z) {
    if (!z || !z.istate || !z.istate.blocks)
      return Z_STREAM_ERROR;
    return z.istate.blocks.sync_point();
  };
}
function ZStream() {
}
ZStream.prototype = {
  inflateInit(bits) {
    const that = this;
    that.istate = new Inflate();
    if (!bits)
      bits = MAX_BITS;
    return that.istate.inflateInit(that, bits);
  },
  inflate(f) {
    const that = this;
    if (!that.istate)
      return Z_STREAM_ERROR;
    return that.istate.inflate(that, f);
  },
  inflateEnd() {
    const that = this;
    if (!that.istate)
      return Z_STREAM_ERROR;
    const ret = that.istate.inflateEnd(that);
    that.istate = null;
    return ret;
  },
  inflateSync() {
    const that = this;
    if (!that.istate)
      return Z_STREAM_ERROR;
    return that.istate.inflateSync(that);
  },
  inflateSetDictionary(dictionary, dictLength) {
    const that = this;
    if (!that.istate)
      return Z_STREAM_ERROR;
    return that.istate.inflateSetDictionary(that, dictionary, dictLength);
  },
  read_byte(start) {
    const that = this;
    return that.next_in[start];
  },
  read_buf(start, size) {
    const that = this;
    return that.next_in.subarray(start, start + size);
  }
};
function ZipInflate(options) {
  const that = this;
  const z = new ZStream();
  const bufsize = options && options.chunkSize ? Math.floor(options.chunkSize * 2) : 128 * 1024;
  const flush = Z_NO_FLUSH;
  const buf = new Uint8Array(bufsize);
  let nomoreinput = false;
  z.inflateInit();
  z.next_out = buf;
  that.append = function(data, onprogress) {
    const buffers = [];
    let err, array, lastIndex = 0, bufferIndex = 0, bufferSize = 0;
    if (data.length === 0)
      return;
    z.next_in_index = 0;
    z.next_in = data;
    z.avail_in = data.length;
    do {
      z.next_out_index = 0;
      z.avail_out = bufsize;
      if (z.avail_in === 0 && !nomoreinput) {
        z.next_in_index = 0;
        nomoreinput = true;
      }
      err = z.inflate(flush);
      if (nomoreinput && err === Z_BUF_ERROR) {
        if (z.avail_in !== 0)
          throw new Error("inflating: bad input");
      } else if (err !== Z_OK && err !== Z_STREAM_END)
        throw new Error("inflating: " + z.msg);
      if ((nomoreinput || err === Z_STREAM_END) && z.avail_in === data.length)
        throw new Error("inflating: bad input");
      if (z.next_out_index)
        if (z.next_out_index === bufsize)
          buffers.push(new Uint8Array(buf));
        else
          buffers.push(buf.subarray(0, z.next_out_index));
      bufferSize += z.next_out_index;
      if (onprogress && z.next_in_index > 0 && z.next_in_index != lastIndex) {
        onprogress(z.next_in_index);
        lastIndex = z.next_in_index;
      }
    } while (z.avail_in > 0 || z.avail_out === 0);
    if (buffers.length > 1) {
      array = new Uint8Array(bufferSize);
      buffers.forEach(function(chunk) {
        array.set(chunk, bufferIndex);
        bufferIndex += chunk.length;
      });
    } else {
      array = buffers[0] ? new Uint8Array(buffers[0]) : new Uint8Array();
    }
    return array;
  };
  that.flush = function() {
    z.inflateEnd();
  };
}
const MAX_32_BITS = 4294967295;
const MAX_16_BITS = 65535;
const COMPRESSION_METHOD_DEFLATE = 8;
const COMPRESSION_METHOD_STORE = 0;
const COMPRESSION_METHOD_AES = 99;
const LOCAL_FILE_HEADER_SIGNATURE = 67324752;
const SPLIT_ZIP_FILE_SIGNATURE = 134695760;
const CENTRAL_FILE_HEADER_SIGNATURE = 33639248;
const END_OF_CENTRAL_DIR_SIGNATURE = 101010256;
const ZIP64_END_OF_CENTRAL_DIR_SIGNATURE = 101075792;
const ZIP64_END_OF_CENTRAL_DIR_LOCATOR_SIGNATURE = 117853008;
const END_OF_CENTRAL_DIR_LENGTH = 22;
const ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH = 20;
const ZIP64_END_OF_CENTRAL_DIR_LENGTH = 56;
const EXTRAFIELD_TYPE_ZIP64 = 1;
const EXTRAFIELD_TYPE_AES = 39169;
const EXTRAFIELD_TYPE_NTFS = 10;
const EXTRAFIELD_TYPE_NTFS_TAG1 = 1;
const EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP = 21589;
const EXTRAFIELD_TYPE_UNICODE_PATH = 28789;
const EXTRAFIELD_TYPE_UNICODE_COMMENT = 25461;
const EXTRAFIELD_TYPE_USDZ = 6534;
const BITFLAG_ENCRYPTED = 1;
const BITFLAG_LEVEL = 6;
const BITFLAG_DATA_DESCRIPTOR = 8;
const BITFLAG_LANG_ENCODING_FLAG = 2048;
const FILE_ATTR_MSDOS_DIR_MASK = 16;
const DIRECTORY_SIGNATURE = "/";
const UNDEFINED_VALUE = void 0;
const UNDEFINED_TYPE$1 = "undefined";
const FUNCTION_TYPE$1 = "function";
class StreamAdapter {
  constructor(Codec) {
    return class extends TransformStream {
      constructor(_format, options) {
        const codec2 = new Codec(options);
        super({
          transform(chunk, controller) {
            controller.enqueue(codec2.append(chunk));
          },
          flush(controller) {
            const chunk = codec2.flush();
            if (chunk) {
              controller.enqueue(chunk);
            }
          }
        });
      }
    };
  }
}
const MINIMUM_CHUNK_SIZE = 64;
let maxWorkers = 2;
try {
  if (typeof navigator != UNDEFINED_TYPE$1 && navigator.hardwareConcurrency) {
    maxWorkers = navigator.hardwareConcurrency;
  }
} catch (_error) {
}
const DEFAULT_CONFIGURATION = {
  chunkSize: 512 * 1024,
  maxWorkers,
  terminateWorkerTimeout: 5e3,
  useWebWorkers: true,
  useCompressionStream: true,
  workerScripts: UNDEFINED_VALUE,
  CompressionStreamNative: typeof CompressionStream != UNDEFINED_TYPE$1 && CompressionStream,
  DecompressionStreamNative: typeof DecompressionStream != UNDEFINED_TYPE$1 && DecompressionStream
};
const config = Object.assign({}, DEFAULT_CONFIGURATION);
function getConfiguration() {
  return config;
}
function getChunkSize(config2) {
  return Math.max(config2.chunkSize, MINIMUM_CHUNK_SIZE);
}
function configure(configuration) {
  const {
    baseURL,
    chunkSize,
    maxWorkers: maxWorkers2,
    terminateWorkerTimeout,
    useCompressionStream,
    useWebWorkers,
    Deflate,
    Inflate: Inflate2,
    CompressionStream: CompressionStream2,
    DecompressionStream: DecompressionStream2,
    workerScripts
  } = configuration;
  setIfDefined("baseURL", baseURL);
  setIfDefined("chunkSize", chunkSize);
  setIfDefined("maxWorkers", maxWorkers2);
  setIfDefined("terminateWorkerTimeout", terminateWorkerTimeout);
  setIfDefined("useCompressionStream", useCompressionStream);
  setIfDefined("useWebWorkers", useWebWorkers);
  if (Deflate) {
    config.CompressionStream = new StreamAdapter(Deflate);
  }
  if (Inflate2) {
    config.DecompressionStream = new StreamAdapter(Inflate2);
  }
  setIfDefined("CompressionStream", CompressionStream2);
  setIfDefined("DecompressionStream", DecompressionStream2);
  if (workerScripts !== UNDEFINED_VALUE) {
    const { deflate, inflate } = workerScripts;
    if (deflate || inflate) {
      if (!config.workerScripts) {
        config.workerScripts = {};
      }
    }
    if (deflate) {
      if (!Array.isArray(deflate)) {
        throw new Error("workerScripts.deflate must be an array");
      }
      config.workerScripts.deflate = deflate;
    }
    if (inflate) {
      if (!Array.isArray(inflate)) {
        throw new Error("workerScripts.inflate must be an array");
      }
      config.workerScripts.inflate = inflate;
    }
  }
}
function setIfDefined(propertyName, propertyValue) {
  if (propertyValue !== UNDEFINED_VALUE) {
    config[propertyName] = propertyValue;
  }
}
function getMimeType() {
  return "application/octet-stream";
}
const table = [];
for (let i = 0; i < 256; i++) {
  let t = i;
  for (let j = 0; j < 8; j++) {
    if (t & 1) {
      t = t >>> 1 ^ 3988292384;
    } else {
      t = t >>> 1;
    }
  }
  table[i] = t;
}
class Crc32 {
  constructor(crc) {
    this.crc = crc || -1;
  }
  append(data) {
    let crc = this.crc | 0;
    for (let offset = 0, length = data.length | 0; offset < length; offset++) {
      crc = crc >>> 8 ^ table[(crc ^ data[offset]) & 255];
    }
    this.crc = crc;
  }
  get() {
    return ~this.crc;
  }
}
class Crc32Stream extends TransformStream {
  constructor() {
    let stream;
    const crc32 = new Crc32();
    super({
      transform(chunk, controller) {
        crc32.append(chunk);
        controller.enqueue(chunk);
      },
      flush() {
        const value = new Uint8Array(4);
        const dataView = new DataView(value.buffer);
        dataView.setUint32(0, crc32.get());
        stream.value = value;
      }
    });
    stream = this;
  }
}
function encodeText(value) {
  if (typeof TextEncoder == "undefined") {
    value = unescape(encodeURIComponent(value));
    const result = new Uint8Array(value.length);
    for (let i = 0; i < result.length; i++) {
      result[i] = value.charCodeAt(i);
    }
    return result;
  } else {
    return new TextEncoder().encode(value);
  }
}
const bitArray = {
  /**
   * Concatenate two bit arrays.
   * @param {bitArray} a1 The first array.
   * @param {bitArray} a2 The second array.
   * @return {bitArray} The concatenation of a1 and a2.
   */
  concat(a1, a2) {
    if (a1.length === 0 || a2.length === 0) {
      return a1.concat(a2);
    }
    const last = a1[a1.length - 1], shift = bitArray.getPartial(last);
    if (shift === 32) {
      return a1.concat(a2);
    } else {
      return bitArray._shiftRight(a2, shift, last | 0, a1.slice(0, a1.length - 1));
    }
  },
  /**
   * Find the length of an array of bits.
   * @param {bitArray} a The array.
   * @return {Number} The length of a, in bits.
   */
  bitLength(a) {
    const l = a.length;
    if (l === 0) {
      return 0;
    }
    const x = a[l - 1];
    return (l - 1) * 32 + bitArray.getPartial(x);
  },
  /**
   * Truncate an array.
   * @param {bitArray} a The array.
   * @param {Number} len The length to truncate to, in bits.
   * @return {bitArray} A new array, truncated to len bits.
   */
  clamp(a, len) {
    if (a.length * 32 < len) {
      return a;
    }
    a = a.slice(0, Math.ceil(len / 32));
    const l = a.length;
    len = len & 31;
    if (l > 0 && len) {
      a[l - 1] = bitArray.partial(len, a[l - 1] & 2147483648 >> len - 1, 1);
    }
    return a;
  },
  /**
   * Make a partial word for a bit array.
   * @param {Number} len The number of bits in the word.
   * @param {Number} x The bits.
   * @param {Number} [_end=0] Pass 1 if x has already been shifted to the high side.
   * @return {Number} The partial word.
   */
  partial(len, x, _end) {
    if (len === 32) {
      return x;
    }
    return (_end ? x | 0 : x << 32 - len) + len * 1099511627776;
  },
  /**
   * Get the number of bits used by a partial word.
   * @param {Number} x The partial word.
   * @return {Number} The number of bits used by the partial word.
   */
  getPartial(x) {
    return Math.round(x / 1099511627776) || 32;
  },
  /** Shift an array right.
   * @param {bitArray} a The array to shift.
   * @param {Number} shift The number of bits to shift.
   * @param {Number} [carry=0] A byte to carry in
   * @param {bitArray} [out=[]] An array to prepend to the output.
   * @private
   */
  _shiftRight(a, shift, carry, out) {
    if (out === void 0) {
      out = [];
    }
    for (; shift >= 32; shift -= 32) {
      out.push(carry);
      carry = 0;
    }
    if (shift === 0) {
      return out.concat(a);
    }
    for (let i = 0; i < a.length; i++) {
      out.push(carry | a[i] >>> shift);
      carry = a[i] << 32 - shift;
    }
    const last2 = a.length ? a[a.length - 1] : 0;
    const shift2 = bitArray.getPartial(last2);
    out.push(bitArray.partial(shift + shift2 & 31, shift + shift2 > 32 ? carry : out.pop(), 1));
    return out;
  }
};
const codec = {
  bytes: {
    /** Convert from a bitArray to an array of bytes. */
    fromBits(arr) {
      const bl = bitArray.bitLength(arr);
      const byteLength = bl / 8;
      const out = new Uint8Array(byteLength);
      let tmp;
      for (let i = 0; i < byteLength; i++) {
        if ((i & 3) === 0) {
          tmp = arr[i / 4];
        }
        out[i] = tmp >>> 24;
        tmp <<= 8;
      }
      return out;
    },
    /** Convert from an array of bytes to a bitArray. */
    toBits(bytes) {
      const out = [];
      let i;
      let tmp = 0;
      for (i = 0; i < bytes.length; i++) {
        tmp = tmp << 8 | bytes[i];
        if ((i & 3) === 3) {
          out.push(tmp);
          tmp = 0;
        }
      }
      if (i & 3) {
        out.push(bitArray.partial(8 * (i & 3), tmp));
      }
      return out;
    }
  }
};
const hash = {};
hash.sha1 = class {
  constructor(hash2) {
    const sha1 = this;
    sha1.blockSize = 512;
    sha1._init = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
    sha1._key = [1518500249, 1859775393, 2400959708, 3395469782];
    if (hash2) {
      sha1._h = hash2._h.slice(0);
      sha1._buffer = hash2._buffer.slice(0);
      sha1._length = hash2._length;
    } else {
      sha1.reset();
    }
  }
  /**
   * Reset the hash state.
   * @return this
   */
  reset() {
    const sha1 = this;
    sha1._h = sha1._init.slice(0);
    sha1._buffer = [];
    sha1._length = 0;
    return sha1;
  }
  /**
   * Input several words to the hash.
   * @param {bitArray|String} data the data to hash.
   * @return this
   */
  update(data) {
    const sha1 = this;
    if (typeof data === "string") {
      data = codec.utf8String.toBits(data);
    }
    const b = sha1._buffer = bitArray.concat(sha1._buffer, data);
    const ol = sha1._length;
    const nl = sha1._length = ol + bitArray.bitLength(data);
    if (nl > 9007199254740991) {
      throw new Error("Cannot hash more than 2^53 - 1 bits");
    }
    const c = new Uint32Array(b);
    let j = 0;
    for (let i = sha1.blockSize + ol - (sha1.blockSize + ol & sha1.blockSize - 1); i <= nl; i += sha1.blockSize) {
      sha1._block(c.subarray(16 * j, 16 * (j + 1)));
      j += 1;
    }
    b.splice(0, 16 * j);
    return sha1;
  }
  /**
   * Complete hashing and output the hash value.
   * @return {bitArray} The hash value, an array of 5 big-endian words. TODO
   */
  finalize() {
    const sha1 = this;
    let b = sha1._buffer;
    const h = sha1._h;
    b = bitArray.concat(b, [bitArray.partial(1, 1)]);
    for (let i = b.length + 2; i & 15; i++) {
      b.push(0);
    }
    b.push(Math.floor(sha1._length / 4294967296));
    b.push(sha1._length | 0);
    while (b.length) {
      sha1._block(b.splice(0, 16));
    }
    sha1.reset();
    return h;
  }
  /**
   * The SHA-1 logical functions f(0), f(1), ..., f(79).
   * @private
   */
  _f(t, b, c, d) {
    if (t <= 19) {
      return b & c | ~b & d;
    } else if (t <= 39) {
      return b ^ c ^ d;
    } else if (t <= 59) {
      return b & c | b & d | c & d;
    } else if (t <= 79) {
      return b ^ c ^ d;
    }
  }
  /**
   * Circular left-shift operator.
   * @private
   */
  _S(n, x) {
    return x << n | x >>> 32 - n;
  }
  /**
   * Perform one cycle of SHA-1.
   * @param {Uint32Array|bitArray} words one block of words.
   * @private
   */
  _block(words) {
    const sha1 = this;
    const h = sha1._h;
    const w = Array(80);
    for (let j = 0; j < 16; j++) {
      w[j] = words[j];
    }
    let a = h[0];
    let b = h[1];
    let c = h[2];
    let d = h[3];
    let e = h[4];
    for (let t = 0; t <= 79; t++) {
      if (t >= 16) {
        w[t] = sha1._S(1, w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16]);
      }
      const tmp = sha1._S(5, a) + sha1._f(t, b, c, d) + e + w[t] + sha1._key[Math.floor(t / 20)] | 0;
      e = d;
      d = c;
      c = sha1._S(30, b);
      b = a;
      a = tmp;
    }
    h[0] = h[0] + a | 0;
    h[1] = h[1] + b | 0;
    h[2] = h[2] + c | 0;
    h[3] = h[3] + d | 0;
    h[4] = h[4] + e | 0;
  }
};
const cipher = {};
cipher.aes = class {
  constructor(key) {
    const aes = this;
    aes._tables = [[[], [], [], [], []], [[], [], [], [], []]];
    if (!aes._tables[0][0][0]) {
      aes._precompute();
    }
    const sbox = aes._tables[0][4];
    const decTable = aes._tables[1];
    const keyLen = key.length;
    let i, encKey, decKey, rcon = 1;
    if (keyLen !== 4 && keyLen !== 6 && keyLen !== 8) {
      throw new Error("invalid aes key size");
    }
    aes._key = [encKey = key.slice(0), decKey = []];
    for (i = keyLen; i < 4 * keyLen + 28; i++) {
      let tmp = encKey[i - 1];
      if (i % keyLen === 0 || keyLen === 8 && i % keyLen === 4) {
        tmp = sbox[tmp >>> 24] << 24 ^ sbox[tmp >> 16 & 255] << 16 ^ sbox[tmp >> 8 & 255] << 8 ^ sbox[tmp & 255];
        if (i % keyLen === 0) {
          tmp = tmp << 8 ^ tmp >>> 24 ^ rcon << 24;
          rcon = rcon << 1 ^ (rcon >> 7) * 283;
        }
      }
      encKey[i] = encKey[i - keyLen] ^ tmp;
    }
    for (let j = 0; i; j++, i--) {
      const tmp = encKey[j & 3 ? i : i - 4];
      if (i <= 4 || j < 4) {
        decKey[j] = tmp;
      } else {
        decKey[j] = decTable[0][sbox[tmp >>> 24]] ^ decTable[1][sbox[tmp >> 16 & 255]] ^ decTable[2][sbox[tmp >> 8 & 255]] ^ decTable[3][sbox[tmp & 255]];
      }
    }
  }
  // public
  /* Something like this might appear here eventually
  name: "AES",
  blockSize: 4,
  keySizes: [4,6,8],
  */
  /**
   * Encrypt an array of 4 big-endian words.
   * @param {Array} data The plaintext.
   * @return {Array} The ciphertext.
   */
  encrypt(data) {
    return this._crypt(data, 0);
  }
  /**
   * Decrypt an array of 4 big-endian words.
   * @param {Array} data The ciphertext.
   * @return {Array} The plaintext.
   */
  decrypt(data) {
    return this._crypt(data, 1);
  }
  /**
   * Expand the S-box tables.
   *
   * @private
   */
  _precompute() {
    const encTable = this._tables[0];
    const decTable = this._tables[1];
    const sbox = encTable[4];
    const sboxInv = decTable[4];
    const d = [];
    const th = [];
    let xInv, x2, x4, x8;
    for (let i = 0; i < 256; i++) {
      th[(d[i] = i << 1 ^ (i >> 7) * 283) ^ i] = i;
    }
    for (let x = xInv = 0; !sbox[x]; x ^= x2 || 1, xInv = th[xInv] || 1) {
      let s = xInv ^ xInv << 1 ^ xInv << 2 ^ xInv << 3 ^ xInv << 4;
      s = s >> 8 ^ s & 255 ^ 99;
      sbox[x] = s;
      sboxInv[s] = x;
      x8 = d[x4 = d[x2 = d[x]]];
      let tDec = x8 * 16843009 ^ x4 * 65537 ^ x2 * 257 ^ x * 16843008;
      let tEnc = d[s] * 257 ^ s * 16843008;
      for (let i = 0; i < 4; i++) {
        encTable[i][x] = tEnc = tEnc << 24 ^ tEnc >>> 8;
        decTable[i][s] = tDec = tDec << 24 ^ tDec >>> 8;
      }
    }
    for (let i = 0; i < 5; i++) {
      encTable[i] = encTable[i].slice(0);
      decTable[i] = decTable[i].slice(0);
    }
  }
  /**
   * Encryption and decryption core.
   * @param {Array} input Four words to be encrypted or decrypted.
   * @param dir The direction, 0 for encrypt and 1 for decrypt.
   * @return {Array} The four encrypted or decrypted words.
   * @private
   */
  _crypt(input, dir) {
    if (input.length !== 4) {
      throw new Error("invalid aes block size");
    }
    const key = this._key[dir];
    const nInnerRounds = key.length / 4 - 2;
    const out = [0, 0, 0, 0];
    const table2 = this._tables[dir];
    const t0 = table2[0];
    const t1 = table2[1];
    const t2 = table2[2];
    const t3 = table2[3];
    const sbox = table2[4];
    let a = input[0] ^ key[0];
    let b = input[dir ? 3 : 1] ^ key[1];
    let c = input[2] ^ key[2];
    let d = input[dir ? 1 : 3] ^ key[3];
    let kIndex = 4;
    let a2, b2, c2;
    for (let i = 0; i < nInnerRounds; i++) {
      a2 = t0[a >>> 24] ^ t1[b >> 16 & 255] ^ t2[c >> 8 & 255] ^ t3[d & 255] ^ key[kIndex];
      b2 = t0[b >>> 24] ^ t1[c >> 16 & 255] ^ t2[d >> 8 & 255] ^ t3[a & 255] ^ key[kIndex + 1];
      c2 = t0[c >>> 24] ^ t1[d >> 16 & 255] ^ t2[a >> 8 & 255] ^ t3[b & 255] ^ key[kIndex + 2];
      d = t0[d >>> 24] ^ t1[a >> 16 & 255] ^ t2[b >> 8 & 255] ^ t3[c & 255] ^ key[kIndex + 3];
      kIndex += 4;
      a = a2;
      b = b2;
      c = c2;
    }
    for (let i = 0; i < 4; i++) {
      out[dir ? 3 & -i : i] = sbox[a >>> 24] << 24 ^ sbox[b >> 16 & 255] << 16 ^ sbox[c >> 8 & 255] << 8 ^ sbox[d & 255] ^ key[kIndex++];
      a2 = a;
      a = b;
      b = c;
      c = d;
      d = a2;
    }
    return out;
  }
};
const random = {
  /** 
   * Generate random words with pure js, cryptographically not as strong & safe as native implementation.
   * @param {TypedArray} typedArray The array to fill.
   * @return {TypedArray} The random values.
   */
  getRandomValues(typedArray) {
    const words = new Uint32Array(typedArray.buffer);
    const r = (m_w) => {
      let m_z = 987654321;
      const mask = 4294967295;
      return function() {
        m_z = 36969 * (m_z & 65535) + (m_z >> 16) & mask;
        m_w = 18e3 * (m_w & 65535) + (m_w >> 16) & mask;
        const result = ((m_z << 16) + m_w & mask) / 4294967296 + 0.5;
        return result * (Math.random() > 0.5 ? 1 : -1);
      };
    };
    for (let i = 0, rcache; i < typedArray.length; i += 4) {
      const _r = r((rcache || Math.random()) * 4294967296);
      rcache = _r() * 987654071;
      words[i / 4] = _r() * 4294967296 | 0;
    }
    return typedArray;
  }
};
const mode = {};
mode.ctrGladman = class {
  constructor(prf, iv) {
    this._prf = prf;
    this._initIv = iv;
    this._iv = iv;
  }
  reset() {
    this._iv = this._initIv;
  }
  /** Input some data to calculate.
   * @param {bitArray} data the data to process, it must be intergral multiple of 128 bits unless it's the last.
   */
  update(data) {
    return this.calculate(this._prf, data, this._iv);
  }
  incWord(word) {
    if ((word >> 24 & 255) === 255) {
      let b1 = word >> 16 & 255;
      let b2 = word >> 8 & 255;
      let b3 = word & 255;
      if (b1 === 255) {
        b1 = 0;
        if (b2 === 255) {
          b2 = 0;
          if (b3 === 255) {
            b3 = 0;
          } else {
            ++b3;
          }
        } else {
          ++b2;
        }
      } else {
        ++b1;
      }
      word = 0;
      word += b1 << 16;
      word += b2 << 8;
      word += b3;
    } else {
      word += 1 << 24;
    }
    return word;
  }
  incCounter(counter) {
    if ((counter[0] = this.incWord(counter[0])) === 0) {
      counter[1] = this.incWord(counter[1]);
    }
  }
  calculate(prf, data, iv) {
    let l;
    if (!(l = data.length)) {
      return [];
    }
    const bl = bitArray.bitLength(data);
    for (let i = 0; i < l; i += 4) {
      this.incCounter(iv);
      const e = prf.encrypt(iv);
      data[i] ^= e[0];
      data[i + 1] ^= e[1];
      data[i + 2] ^= e[2];
      data[i + 3] ^= e[3];
    }
    return bitArray.clamp(data, bl);
  }
};
const misc = {
  importKey(password) {
    return new misc.hmacSha1(codec.bytes.toBits(password));
  },
  pbkdf2(prf, salt, count, length) {
    count = count || 1e4;
    if (length < 0 || count < 0) {
      throw new Error("invalid params to pbkdf2");
    }
    const byteLength = (length >> 5) + 1 << 2;
    let u, ui, i, j, k;
    const arrayBuffer = new ArrayBuffer(byteLength);
    const out = new DataView(arrayBuffer);
    let outLength = 0;
    const b = bitArray;
    salt = codec.bytes.toBits(salt);
    for (k = 1; outLength < (byteLength || 1); k++) {
      u = ui = prf.encrypt(b.concat(salt, [k]));
      for (i = 1; i < count; i++) {
        ui = prf.encrypt(ui);
        for (j = 0; j < ui.length; j++) {
          u[j] ^= ui[j];
        }
      }
      for (i = 0; outLength < (byteLength || 1) && i < u.length; i++) {
        out.setInt32(outLength, u[i]);
        outLength += 4;
      }
    }
    return arrayBuffer.slice(0, length / 8);
  }
};
misc.hmacSha1 = class {
  constructor(key) {
    const hmac = this;
    const Hash = hmac._hash = hash.sha1;
    const exKey = [[], []];
    hmac._baseHash = [new Hash(), new Hash()];
    const bs = hmac._baseHash[0].blockSize / 32;
    if (key.length > bs) {
      key = new Hash().update(key).finalize();
    }
    for (let i = 0; i < bs; i++) {
      exKey[0][i] = key[i] ^ 909522486;
      exKey[1][i] = key[i] ^ 1549556828;
    }
    hmac._baseHash[0].update(exKey[0]);
    hmac._baseHash[1].update(exKey[1]);
    hmac._resultHash = new Hash(hmac._baseHash[0]);
  }
  reset() {
    const hmac = this;
    hmac._resultHash = new hmac._hash(hmac._baseHash[0]);
    hmac._updated = false;
  }
  update(data) {
    const hmac = this;
    hmac._updated = true;
    hmac._resultHash.update(data);
  }
  digest() {
    const hmac = this;
    const w = hmac._resultHash.finalize();
    const result = new hmac._hash(hmac._baseHash[1]).update(w).finalize();
    hmac.reset();
    return result;
  }
  encrypt(data) {
    if (!this._updated) {
      this.update(data);
      return this.digest(data);
    } else {
      throw new Error("encrypt on already updated hmac called!");
    }
  }
};
const GET_RANDOM_VALUES_SUPPORTED = typeof crypto != "undefined" && typeof crypto.getRandomValues == "function";
const ERR_INVALID_PASSWORD = "Invalid password";
const ERR_INVALID_SIGNATURE = "Invalid signature";
const ERR_ABORT_CHECK_PASSWORD = "zipjs-abort-check-password";
function getRandomValues(array) {
  if (GET_RANDOM_VALUES_SUPPORTED) {
    return crypto.getRandomValues(array);
  } else {
    return random.getRandomValues(array);
  }
}
const BLOCK_LENGTH = 16;
const RAW_FORMAT = "raw";
const PBKDF2_ALGORITHM = { name: "PBKDF2" };
const HASH_ALGORITHM = { name: "HMAC" };
const HASH_FUNCTION = "SHA-1";
const BASE_KEY_ALGORITHM = Object.assign({ hash: HASH_ALGORITHM }, PBKDF2_ALGORITHM);
const DERIVED_BITS_ALGORITHM = Object.assign({ iterations: 1e3, hash: { name: HASH_FUNCTION } }, PBKDF2_ALGORITHM);
const DERIVED_BITS_USAGE = ["deriveBits"];
const SALT_LENGTH = [8, 12, 16];
const KEY_LENGTH = [16, 24, 32];
const SIGNATURE_LENGTH = 10;
const COUNTER_DEFAULT_VALUE = [0, 0, 0, 0];
const UNDEFINED_TYPE = "undefined";
const FUNCTION_TYPE = "function";
const CRYPTO_API_SUPPORTED = typeof crypto != UNDEFINED_TYPE;
const subtle = CRYPTO_API_SUPPORTED && crypto.subtle;
const SUBTLE_API_SUPPORTED = CRYPTO_API_SUPPORTED && typeof subtle != UNDEFINED_TYPE;
const codecBytes = codec.bytes;
const Aes = cipher.aes;
const CtrGladman = mode.ctrGladman;
const HmacSha1 = misc.hmacSha1;
let IMPORT_KEY_SUPPORTED = CRYPTO_API_SUPPORTED && SUBTLE_API_SUPPORTED && typeof subtle.importKey == FUNCTION_TYPE;
let DERIVE_BITS_SUPPORTED = CRYPTO_API_SUPPORTED && SUBTLE_API_SUPPORTED && typeof subtle.deriveBits == FUNCTION_TYPE;
class AESDecryptionStream extends TransformStream {
  constructor({ password, signed, encryptionStrength, checkPasswordOnly }) {
    super({
      start() {
        Object.assign(this, {
          ready: new Promise((resolve) => this.resolveReady = resolve),
          password,
          signed,
          strength: encryptionStrength - 1,
          pending: new Uint8Array()
        });
      },
      async transform(chunk, controller) {
        const aesCrypto = this;
        const {
          password: password2,
          strength,
          resolveReady,
          ready
        } = aesCrypto;
        if (password2) {
          await createDecryptionKeys(aesCrypto, strength, password2, subarray(chunk, 0, SALT_LENGTH[strength] + 2));
          chunk = subarray(chunk, SALT_LENGTH[strength] + 2);
          if (checkPasswordOnly) {
            controller.error(new Error(ERR_ABORT_CHECK_PASSWORD));
          } else {
            resolveReady();
          }
        } else {
          await ready;
        }
        const output = new Uint8Array(chunk.length - SIGNATURE_LENGTH - (chunk.length - SIGNATURE_LENGTH) % BLOCK_LENGTH);
        controller.enqueue(append(aesCrypto, chunk, output, 0, SIGNATURE_LENGTH, true));
      },
      async flush(controller) {
        const {
          signed: signed2,
          ctr,
          hmac,
          pending,
          ready
        } = this;
        if (hmac && ctr) {
          await ready;
          const chunkToDecrypt = subarray(pending, 0, pending.length - SIGNATURE_LENGTH);
          const originalSignature = subarray(pending, pending.length - SIGNATURE_LENGTH);
          let decryptedChunkArray = new Uint8Array();
          if (chunkToDecrypt.length) {
            const encryptedChunk = toBits(codecBytes, chunkToDecrypt);
            hmac.update(encryptedChunk);
            const decryptedChunk = ctr.update(encryptedChunk);
            decryptedChunkArray = fromBits(codecBytes, decryptedChunk);
          }
          if (signed2) {
            const signature = subarray(fromBits(codecBytes, hmac.digest()), 0, SIGNATURE_LENGTH);
            for (let indexSignature = 0; indexSignature < SIGNATURE_LENGTH; indexSignature++) {
              if (signature[indexSignature] != originalSignature[indexSignature]) {
                throw new Error(ERR_INVALID_SIGNATURE);
              }
            }
          }
          controller.enqueue(decryptedChunkArray);
        }
      }
    });
  }
}
class AESEncryptionStream extends TransformStream {
  constructor({ password, encryptionStrength }) {
    let stream;
    super({
      start() {
        Object.assign(this, {
          ready: new Promise((resolve) => this.resolveReady = resolve),
          password,
          strength: encryptionStrength - 1,
          pending: new Uint8Array()
        });
      },
      async transform(chunk, controller) {
        const aesCrypto = this;
        const {
          password: password2,
          strength,
          resolveReady,
          ready
        } = aesCrypto;
        let preamble = new Uint8Array();
        if (password2) {
          preamble = await createEncryptionKeys(aesCrypto, strength, password2);
          resolveReady();
        } else {
          await ready;
        }
        const output = new Uint8Array(preamble.length + chunk.length - chunk.length % BLOCK_LENGTH);
        output.set(preamble, 0);
        controller.enqueue(append(aesCrypto, chunk, output, preamble.length, 0));
      },
      async flush(controller) {
        const {
          ctr,
          hmac,
          pending,
          ready
        } = this;
        if (hmac && ctr) {
          await ready;
          let encryptedChunkArray = new Uint8Array();
          if (pending.length) {
            const encryptedChunk = ctr.update(toBits(codecBytes, pending));
            hmac.update(encryptedChunk);
            encryptedChunkArray = fromBits(codecBytes, encryptedChunk);
          }
          stream.signature = fromBits(codecBytes, hmac.digest()).slice(0, SIGNATURE_LENGTH);
          controller.enqueue(concat(encryptedChunkArray, stream.signature));
        }
      }
    });
    stream = this;
  }
}
function append(aesCrypto, input, output, paddingStart, paddingEnd, verifySignature) {
  const {
    ctr,
    hmac,
    pending
  } = aesCrypto;
  const inputLength = input.length - paddingEnd;
  if (pending.length) {
    input = concat(pending, input);
    output = expand(output, inputLength - inputLength % BLOCK_LENGTH);
  }
  let offset;
  for (offset = 0; offset <= inputLength - BLOCK_LENGTH; offset += BLOCK_LENGTH) {
    const inputChunk = toBits(codecBytes, subarray(input, offset, offset + BLOCK_LENGTH));
    if (verifySignature) {
      hmac.update(inputChunk);
    }
    const outputChunk = ctr.update(inputChunk);
    if (!verifySignature) {
      hmac.update(outputChunk);
    }
    output.set(fromBits(codecBytes, outputChunk), offset + paddingStart);
  }
  aesCrypto.pending = subarray(input, offset);
  return output;
}
async function createDecryptionKeys(decrypt2, strength, password, preamble) {
  const passwordVerificationKey = await createKeys$1(decrypt2, strength, password, subarray(preamble, 0, SALT_LENGTH[strength]));
  const passwordVerification = subarray(preamble, SALT_LENGTH[strength]);
  if (passwordVerificationKey[0] != passwordVerification[0] || passwordVerificationKey[1] != passwordVerification[1]) {
    throw new Error(ERR_INVALID_PASSWORD);
  }
}
async function createEncryptionKeys(encrypt2, strength, password) {
  const salt = getRandomValues(new Uint8Array(SALT_LENGTH[strength]));
  const passwordVerification = await createKeys$1(encrypt2, strength, password, salt);
  return concat(salt, passwordVerification);
}
async function createKeys$1(aesCrypto, strength, password, salt) {
  aesCrypto.password = null;
  const encodedPassword = encodeText(password);
  const baseKey = await importKey(RAW_FORMAT, encodedPassword, BASE_KEY_ALGORITHM, false, DERIVED_BITS_USAGE);
  const derivedBits = await deriveBits(Object.assign({ salt }, DERIVED_BITS_ALGORITHM), baseKey, 8 * (KEY_LENGTH[strength] * 2 + 2));
  const compositeKey = new Uint8Array(derivedBits);
  const key = toBits(codecBytes, subarray(compositeKey, 0, KEY_LENGTH[strength]));
  const authentication = toBits(codecBytes, subarray(compositeKey, KEY_LENGTH[strength], KEY_LENGTH[strength] * 2));
  const passwordVerification = subarray(compositeKey, KEY_LENGTH[strength] * 2);
  Object.assign(aesCrypto, {
    keys: {
      key,
      authentication,
      passwordVerification
    },
    ctr: new CtrGladman(new Aes(key), Array.from(COUNTER_DEFAULT_VALUE)),
    hmac: new HmacSha1(authentication)
  });
  return passwordVerification;
}
async function importKey(format, password, algorithm, extractable, keyUsages) {
  if (IMPORT_KEY_SUPPORTED) {
    try {
      return await subtle.importKey(format, password, algorithm, extractable, keyUsages);
    } catch (_error) {
      IMPORT_KEY_SUPPORTED = false;
      return misc.importKey(password);
    }
  } else {
    return misc.importKey(password);
  }
}
async function deriveBits(algorithm, baseKey, length) {
  if (DERIVE_BITS_SUPPORTED) {
    try {
      return await subtle.deriveBits(algorithm, baseKey, length);
    } catch (_error) {
      DERIVE_BITS_SUPPORTED = false;
      return misc.pbkdf2(baseKey, algorithm.salt, DERIVED_BITS_ALGORITHM.iterations, length);
    }
  } else {
    return misc.pbkdf2(baseKey, algorithm.salt, DERIVED_BITS_ALGORITHM.iterations, length);
  }
}
function concat(leftArray, rightArray) {
  let array = leftArray;
  if (leftArray.length + rightArray.length) {
    array = new Uint8Array(leftArray.length + rightArray.length);
    array.set(leftArray, 0);
    array.set(rightArray, leftArray.length);
  }
  return array;
}
function expand(inputArray, length) {
  if (length && length > inputArray.length) {
    const array = inputArray;
    inputArray = new Uint8Array(length);
    inputArray.set(array, 0);
  }
  return inputArray;
}
function subarray(array, begin, end) {
  return array.subarray(begin, end);
}
function fromBits(codecBytes2, chunk) {
  return codecBytes2.fromBits(chunk);
}
function toBits(codecBytes2, chunk) {
  return codecBytes2.toBits(chunk);
}
const HEADER_LENGTH = 12;
class ZipCryptoDecryptionStream extends TransformStream {
  constructor({ password, passwordVerification, checkPasswordOnly }) {
    super({
      start() {
        Object.assign(this, {
          password,
          passwordVerification
        });
        createKeys(this, password);
      },
      transform(chunk, controller) {
        const zipCrypto = this;
        if (zipCrypto.password) {
          const decryptedHeader = decrypt(zipCrypto, chunk.subarray(0, HEADER_LENGTH));
          zipCrypto.password = null;
          if (decryptedHeader[HEADER_LENGTH - 1] != zipCrypto.passwordVerification) {
            throw new Error(ERR_INVALID_PASSWORD);
          }
          chunk = chunk.subarray(HEADER_LENGTH);
        }
        if (checkPasswordOnly) {
          controller.error(new Error(ERR_ABORT_CHECK_PASSWORD));
        } else {
          controller.enqueue(decrypt(zipCrypto, chunk));
        }
      }
    });
  }
}
class ZipCryptoEncryptionStream extends TransformStream {
  constructor({ password, passwordVerification }) {
    super({
      start() {
        Object.assign(this, {
          password,
          passwordVerification
        });
        createKeys(this, password);
      },
      transform(chunk, controller) {
        const zipCrypto = this;
        let output;
        let offset;
        if (zipCrypto.password) {
          zipCrypto.password = null;
          const header = getRandomValues(new Uint8Array(HEADER_LENGTH));
          header[HEADER_LENGTH - 1] = zipCrypto.passwordVerification;
          output = new Uint8Array(chunk.length + header.length);
          output.set(encrypt(zipCrypto, header), 0);
          offset = HEADER_LENGTH;
        } else {
          output = new Uint8Array(chunk.length);
          offset = 0;
        }
        output.set(encrypt(zipCrypto, chunk), offset);
        controller.enqueue(output);
      }
    });
  }
}
function decrypt(target, input) {
  const output = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index++) {
    output[index] = getByte(target) ^ input[index];
    updateKeys(target, output[index]);
  }
  return output;
}
function encrypt(target, input) {
  const output = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index++) {
    output[index] = getByte(target) ^ input[index];
    updateKeys(target, input[index]);
  }
  return output;
}
function createKeys(target, password) {
  const keys = [305419896, 591751049, 878082192];
  Object.assign(target, {
    keys,
    crcKey0: new Crc32(keys[0]),
    crcKey2: new Crc32(keys[2])
  });
  for (let index = 0; index < password.length; index++) {
    updateKeys(target, password.charCodeAt(index));
  }
}
function updateKeys(target, byte) {
  let [key0, key1, key2] = target.keys;
  target.crcKey0.append([byte]);
  key0 = ~target.crcKey0.get();
  key1 = getInt32(Math.imul(getInt32(key1 + getInt8(key0)), 134775813) + 1);
  target.crcKey2.append([key1 >>> 24]);
  key2 = ~target.crcKey2.get();
  target.keys = [key0, key1, key2];
}
function getByte(target) {
  const temp = target.keys[2] | 2;
  return getInt8(Math.imul(temp, temp ^ 1) >>> 8);
}
function getInt8(number) {
  return number & 255;
}
function getInt32(number) {
  return number & 4294967295;
}
const COMPRESSION_FORMAT = "deflate-raw";
class DeflateStream extends TransformStream {
  constructor(options, { chunkSize, CompressionStream: CompressionStream2, CompressionStreamNative }) {
    super({});
    const { compressed, encrypted, useCompressionStream, zipCrypto, signed, level } = options;
    const stream = this;
    let crc32Stream, encryptionStream;
    let readable = filterEmptyChunks(super.readable);
    if ((!encrypted || zipCrypto) && signed) {
      crc32Stream = new Crc32Stream();
      readable = pipeThrough(readable, crc32Stream);
    }
    if (compressed) {
      readable = pipeThroughCommpressionStream(readable, useCompressionStream, { level, chunkSize }, CompressionStreamNative, CompressionStream2);
    }
    if (encrypted) {
      if (zipCrypto) {
        readable = pipeThrough(readable, new ZipCryptoEncryptionStream(options));
      } else {
        encryptionStream = new AESEncryptionStream(options);
        readable = pipeThrough(readable, encryptionStream);
      }
    }
    setReadable(stream, readable, () => {
      let signature;
      if (encrypted && !zipCrypto) {
        signature = encryptionStream.signature;
      }
      if ((!encrypted || zipCrypto) && signed) {
        signature = new DataView(crc32Stream.value.buffer).getUint32(0);
      }
      stream.signature = signature;
    });
  }
}
class InflateStream extends TransformStream {
  constructor(options, { chunkSize, DecompressionStream: DecompressionStream2, DecompressionStreamNative }) {
    super({});
    const { zipCrypto, encrypted, signed, signature, compressed, useCompressionStream } = options;
    let crc32Stream, decryptionStream;
    let readable = filterEmptyChunks(super.readable);
    if (encrypted) {
      if (zipCrypto) {
        readable = pipeThrough(readable, new ZipCryptoDecryptionStream(options));
      } else {
        decryptionStream = new AESDecryptionStream(options);
        readable = pipeThrough(readable, decryptionStream);
      }
    }
    if (compressed) {
      readable = pipeThroughCommpressionStream(readable, useCompressionStream, { chunkSize }, DecompressionStreamNative, DecompressionStream2);
    }
    if ((!encrypted || zipCrypto) && signed) {
      crc32Stream = new Crc32Stream();
      readable = pipeThrough(readable, crc32Stream);
    }
    setReadable(this, readable, () => {
      if ((!encrypted || zipCrypto) && signed) {
        const dataViewSignature = new DataView(crc32Stream.value.buffer);
        if (signature != dataViewSignature.getUint32(0, false)) {
          throw new Error(ERR_INVALID_SIGNATURE);
        }
      }
    });
  }
}
function filterEmptyChunks(readable) {
  return pipeThrough(readable, new TransformStream({
    transform(chunk, controller) {
      if (chunk && chunk.length) {
        controller.enqueue(chunk);
      }
    }
  }));
}
function setReadable(stream, readable, flush) {
  readable = pipeThrough(readable, new TransformStream({ flush }));
  Object.defineProperty(stream, "readable", {
    get() {
      return readable;
    }
  });
}
function pipeThroughCommpressionStream(readable, useCompressionStream, options, CodecStreamNative, CodecStream2) {
  try {
    const CompressionStream2 = useCompressionStream && CodecStreamNative ? CodecStreamNative : CodecStream2;
    readable = pipeThrough(readable, new CompressionStream2(COMPRESSION_FORMAT, options));
  } catch (error) {
    if (useCompressionStream) {
      readable = pipeThrough(readable, new CodecStream2(COMPRESSION_FORMAT, options));
    } else {
      throw error;
    }
  }
  return readable;
}
function pipeThrough(readable, transformStream) {
  return readable.pipeThrough(transformStream);
}
const MESSAGE_EVENT_TYPE = "message";
const MESSAGE_START = "start";
const MESSAGE_PULL = "pull";
const MESSAGE_DATA = "data";
const MESSAGE_ACK_DATA = "ack";
const MESSAGE_CLOSE = "close";
const CODEC_DEFLATE = "deflate";
const CODEC_INFLATE = "inflate";
class CodecStream extends TransformStream {
  constructor(options, config2) {
    super({});
    const codec2 = this;
    const { codecType } = options;
    let Stream2;
    if (codecType.startsWith(CODEC_DEFLATE)) {
      Stream2 = DeflateStream;
    } else if (codecType.startsWith(CODEC_INFLATE)) {
      Stream2 = InflateStream;
    }
    let size = 0;
    const stream = new Stream2(options, config2);
    const readable = super.readable;
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        if (chunk && chunk.length) {
          size += chunk.length;
          controller.enqueue(chunk);
        }
      },
      flush() {
        const { signature } = stream;
        Object.assign(codec2, {
          signature,
          size
        });
      }
    });
    Object.defineProperty(codec2, "readable", {
      get() {
        return readable.pipeThrough(stream).pipeThrough(transformStream);
      }
    });
  }
}
const WEB_WORKERS_SUPPORTED = typeof Worker != UNDEFINED_TYPE$1;
class CodecWorker {
  constructor(workerData, { readable, writable }, { options, config: config2, streamOptions, useWebWorkers, transferStreams, scripts }, onTaskFinished) {
    const { signal } = streamOptions;
    Object.assign(workerData, {
      busy: true,
      readable: readable.pipeThrough(new ProgressWatcherStream(readable, streamOptions, config2), { signal }),
      writable,
      options: Object.assign({}, options),
      scripts,
      transferStreams,
      terminate() {
        const { worker, busy } = workerData;
        if (worker && !busy) {
          worker.terminate();
          workerData.interface = null;
        }
      },
      onTaskFinished() {
        workerData.busy = false;
        onTaskFinished(workerData);
      }
    });
    return (useWebWorkers && WEB_WORKERS_SUPPORTED ? createWebWorkerInterface : createWorkerInterface)(workerData, config2);
  }
}
class ProgressWatcherStream extends TransformStream {
  constructor(readableSource, { onstart, onprogress, size, onend }, { chunkSize }) {
    let chunkOffset = 0;
    super({
      start() {
        if (onstart) {
          callHandler(onstart, size);
        }
      },
      async transform(chunk, controller) {
        chunkOffset += chunk.length;
        if (onprogress) {
          await callHandler(onprogress, chunkOffset, size);
        }
        controller.enqueue(chunk);
      },
      flush() {
        readableSource.size = chunkOffset;
        if (onend) {
          callHandler(onend, chunkOffset);
        }
      }
    }, { highWaterMark: 1, size: () => chunkSize });
  }
}
async function callHandler(handler, ...parameters) {
  try {
    await handler(...parameters);
  } catch (_error) {
  }
}
function createWorkerInterface(workerData, config2) {
  return {
    run: () => runWorker$1(workerData, config2)
  };
}
function createWebWorkerInterface(workerData, { baseURL, chunkSize }) {
  if (!workerData.interface) {
    Object.assign(workerData, {
      worker: getWebWorker(workerData.scripts[0], baseURL, workerData),
      interface: {
        run: () => runWebWorker(workerData, { chunkSize })
      }
    });
  }
  return workerData.interface;
}
async function runWorker$1({ options, readable, writable, onTaskFinished }, config2) {
  const codecStream = new CodecStream(options, config2);
  try {
    await readable.pipeThrough(codecStream).pipeTo(writable, { preventClose: true, preventAbort: true });
    const {
      signature,
      size
    } = codecStream;
    return {
      signature,
      size
    };
  } finally {
    onTaskFinished();
  }
}
async function runWebWorker(workerData, config2) {
  let resolveResult, rejectResult;
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  Object.assign(workerData, {
    reader: null,
    writer: null,
    resolveResult,
    rejectResult,
    result
  });
  const { readable, options, scripts } = workerData;
  const { writable, closed } = watchClosedStream(workerData.writable);
  const streamsTransferred = sendMessage({
    type: MESSAGE_START,
    scripts: scripts.slice(1),
    options,
    config: config2,
    readable,
    writable
  }, workerData);
  if (!streamsTransferred) {
    Object.assign(workerData, {
      reader: readable.getReader(),
      writer: writable.getWriter()
    });
  }
  const resultValue = await result;
  try {
    await writable.getWriter().close();
  } catch (_error) {
  }
  await closed;
  return resultValue;
}
function watchClosedStream(writableSource) {
  const writer = writableSource.getWriter();
  let resolveStreamClosed;
  const closed = new Promise((resolve) => resolveStreamClosed = resolve);
  const writable = new WritableStream({
    async write(chunk) {
      await writer.ready;
      await writer.write(chunk);
    },
    close() {
      writer.releaseLock();
      resolveStreamClosed();
    },
    abort(reason) {
      return writer.abort(reason);
    }
  });
  return { writable, closed };
}
let classicWorkersSupported = true;
let transferStreamsSupported = true;
function getWebWorker(url, baseURL, workerData) {
  const workerOptions = { type: "module" };
  let scriptUrl, worker;
  if (typeof url == FUNCTION_TYPE$1) {
    url = url();
  }
  try {
    scriptUrl = new URL(url, baseURL);
  } catch (_error) {
    scriptUrl = url;
  }
  if (classicWorkersSupported) {
    try {
      worker = new Worker(scriptUrl);
    } catch (_error) {
      classicWorkersSupported = false;
      worker = new Worker(scriptUrl, workerOptions);
    }
  } else {
    worker = new Worker(scriptUrl, workerOptions);
  }
  worker.addEventListener(MESSAGE_EVENT_TYPE, (event) => onMessage(event, workerData));
  return worker;
}
function sendMessage(message, { worker, writer, onTaskFinished, transferStreams }) {
  try {
    let { value, readable, writable } = message;
    const transferables = [];
    if (value) {
      if (value.byteLength < value.buffer.byteLength) {
        message.value = value.buffer.slice(0, value.byteLength);
      } else {
        message.value = value.buffer;
      }
      transferables.push(message.value);
    }
    if (transferStreams && transferStreamsSupported) {
      if (readable) {
        transferables.push(readable);
      }
      if (writable) {
        transferables.push(writable);
      }
    } else {
      message.readable = message.writable = null;
    }
    if (transferables.length) {
      try {
        worker.postMessage(message, transferables);
        return true;
      } catch (_error) {
        transferStreamsSupported = false;
        message.readable = message.writable = null;
        worker.postMessage(message);
      }
    } else {
      worker.postMessage(message);
    }
  } catch (error) {
    if (writer) {
      writer.releaseLock();
    }
    onTaskFinished();
    throw error;
  }
}
async function onMessage({ data }, workerData) {
  const { type, value, messageId, result, error } = data;
  const { reader, writer, resolveResult, rejectResult, onTaskFinished } = workerData;
  try {
    if (error) {
      const { message, stack, code, name } = error;
      const responseError = new Error(message);
      Object.assign(responseError, { stack, code, name });
      close(responseError);
    } else {
      if (type == MESSAGE_PULL) {
        const { value: value2, done } = await reader.read();
        sendMessage({ type: MESSAGE_DATA, value: value2, done, messageId }, workerData);
      }
      if (type == MESSAGE_DATA) {
        await writer.ready;
        await writer.write(new Uint8Array(value));
        sendMessage({ type: MESSAGE_ACK_DATA, messageId }, workerData);
      }
      if (type == MESSAGE_CLOSE) {
        close(null, result);
      }
    }
  } catch (error2) {
    close(error2);
  }
  function close(error2, result2) {
    if (error2) {
      rejectResult(error2);
    } else {
      resolveResult(result2);
    }
    if (writer) {
      writer.releaseLock();
    }
    onTaskFinished();
  }
}
let pool = [];
const pendingRequests = [];
let indexWorker = 0;
async function runWorker(stream, workerOptions) {
  const { options, config: config2 } = workerOptions;
  const { transferStreams, useWebWorkers, useCompressionStream, codecType, compressed, signed, encrypted } = options;
  const { workerScripts, maxWorkers: maxWorkers2, terminateWorkerTimeout } = config2;
  workerOptions.transferStreams = transferStreams || transferStreams === UNDEFINED_VALUE;
  const streamCopy = !compressed && !signed && !encrypted && !workerOptions.transferStreams;
  workerOptions.useWebWorkers = !streamCopy && (useWebWorkers || useWebWorkers === UNDEFINED_VALUE && config2.useWebWorkers);
  workerOptions.scripts = workerOptions.useWebWorkers && workerScripts ? workerScripts[codecType] : [];
  options.useCompressionStream = useCompressionStream || useCompressionStream === UNDEFINED_VALUE && config2.useCompressionStream;
  let worker;
  const workerData = pool.find((workerData2) => !workerData2.busy);
  if (workerData) {
    clearTerminateTimeout(workerData);
    worker = new CodecWorker(workerData, stream, workerOptions, onTaskFinished);
  } else if (pool.length < maxWorkers2) {
    const workerData2 = { indexWorker };
    indexWorker++;
    pool.push(workerData2);
    worker = new CodecWorker(workerData2, stream, workerOptions, onTaskFinished);
  } else {
    worker = await new Promise((resolve) => pendingRequests.push({ resolve, stream, workerOptions }));
  }
  return worker.run();
  function onTaskFinished(workerData2) {
    if (pendingRequests.length) {
      const [{ resolve, stream: stream2, workerOptions: workerOptions2 }] = pendingRequests.splice(0, 1);
      resolve(new CodecWorker(workerData2, stream2, workerOptions2, onTaskFinished));
    } else if (workerData2.worker) {
      clearTerminateTimeout(workerData2);
      if (Number.isFinite(terminateWorkerTimeout) && terminateWorkerTimeout >= 0) {
        workerData2.terminateTimeout = setTimeout(() => {
          pool = pool.filter((data) => data != workerData2);
          workerData2.terminate();
        }, terminateWorkerTimeout);
      }
    } else {
      pool = pool.filter((data) => data != workerData2);
    }
  }
}
function clearTerminateTimeout(workerData) {
  const { terminateTimeout } = workerData;
  if (terminateTimeout) {
    clearTimeout(terminateTimeout);
    workerData.terminateTimeout = null;
  }
}
function terminateWorkers() {
  pool.forEach((workerData) => {
    clearTerminateTimeout(workerData);
    workerData.terminate();
  });
}
const ERR_HTTP_STATUS = "HTTP error ";
const ERR_HTTP_RANGE = "HTTP Range not supported";
const ERR_ITERATOR_COMPLETED_TOO_SOON = "Writer iterator completed too soon";
const CONTENT_TYPE_TEXT_PLAIN = "text/plain";
const HTTP_HEADER_CONTENT_LENGTH = "Content-Length";
const HTTP_HEADER_CONTENT_RANGE = "Content-Range";
const HTTP_HEADER_ACCEPT_RANGES = "Accept-Ranges";
const HTTP_HEADER_RANGE = "Range";
const HTTP_HEADER_CONTENT_TYPE = "Content-Type";
const HTTP_METHOD_HEAD = "HEAD";
const HTTP_METHOD_GET = "GET";
const HTTP_RANGE_UNIT = "bytes";
const DEFAULT_CHUNK_SIZE = 64 * 1024;
const PROPERTY_NAME_WRITABLE = "writable";
class Stream {
  constructor() {
    this.size = 0;
  }
  init() {
    this.initialized = true;
  }
}
class Reader extends Stream {
  get readable() {
    const reader = this;
    const { chunkSize = DEFAULT_CHUNK_SIZE } = reader;
    const readable = new ReadableStream({
      start() {
        this.chunkOffset = 0;
      },
      async pull(controller) {
        const { offset = 0, size, diskNumberStart } = readable;
        const { chunkOffset } = this;
        controller.enqueue(await readUint8Array(reader, offset + chunkOffset, Math.min(chunkSize, size - chunkOffset), diskNumberStart));
        if (chunkOffset + chunkSize > size) {
          controller.close();
        } else {
          this.chunkOffset += chunkSize;
        }
      }
    });
    return readable;
  }
}
class Writer extends Stream {
  constructor() {
    super();
    const writer = this;
    const writable = new WritableStream({
      write(chunk) {
        return writer.writeUint8Array(chunk);
      }
    });
    Object.defineProperty(writer, PROPERTY_NAME_WRITABLE, {
      get() {
        return writable;
      }
    });
  }
  writeUint8Array() {
  }
}
class Data64URIReader extends Reader {
  constructor(dataURI) {
    super();
    let dataEnd = dataURI.length;
    while (dataURI.charAt(dataEnd - 1) == "=") {
      dataEnd--;
    }
    const dataStart = dataURI.indexOf(",") + 1;
    Object.assign(this, {
      dataURI,
      dataStart,
      size: Math.floor((dataEnd - dataStart) * 0.75)
    });
  }
  readUint8Array(offset, length) {
    const {
      dataStart,
      dataURI
    } = this;
    const dataArray = new Uint8Array(length);
    const start = Math.floor(offset / 3) * 4;
    const bytes = atob(dataURI.substring(start + dataStart, Math.ceil((offset + length) / 3) * 4 + dataStart));
    const delta = offset - Math.floor(start / 4) * 3;
    for (let indexByte = delta; indexByte < delta + length; indexByte++) {
      dataArray[indexByte - delta] = bytes.charCodeAt(indexByte);
    }
    return dataArray;
  }
}
class Data64URIWriter extends Writer {
  constructor(contentType) {
    super();
    Object.assign(this, {
      data: "data:" + (contentType || "") + ";base64,",
      pending: []
    });
  }
  writeUint8Array(array) {
    const writer = this;
    let indexArray = 0;
    let dataString = writer.pending;
    const delta = writer.pending.length;
    writer.pending = "";
    for (indexArray = 0; indexArray < Math.floor((delta + array.length) / 3) * 3 - delta; indexArray++) {
      dataString += String.fromCharCode(array[indexArray]);
    }
    for (; indexArray < array.length; indexArray++) {
      writer.pending += String.fromCharCode(array[indexArray]);
    }
    if (dataString.length > 2) {
      writer.data += btoa(dataString);
    } else {
      writer.pending = dataString;
    }
  }
  getData() {
    return this.data + btoa(this.pending);
  }
}
class BlobReader extends Reader {
  constructor(blob) {
    super();
    Object.assign(this, {
      blob,
      size: blob.size
    });
  }
  async readUint8Array(offset, length) {
    const reader = this;
    const offsetEnd = offset + length;
    const blob = offset || offsetEnd < reader.size ? reader.blob.slice(offset, offsetEnd) : reader.blob;
    let arrayBuffer = await blob.arrayBuffer();
    if (arrayBuffer.byteLength > length) {
      arrayBuffer = arrayBuffer.slice(offset, offsetEnd);
    }
    return new Uint8Array(arrayBuffer);
  }
}
class BlobWriter extends Stream {
  constructor(contentType) {
    super();
    const writer = this;
    const transformStream = new TransformStream();
    const headers = [];
    if (contentType) {
      headers.push([HTTP_HEADER_CONTENT_TYPE, contentType]);
    }
    Object.defineProperty(writer, PROPERTY_NAME_WRITABLE, {
      get() {
        return transformStream.writable;
      }
    });
    writer.blob = new Response(transformStream.readable, { headers }).blob();
  }
  getData() {
    return this.blob;
  }
}
class TextReader extends BlobReader {
  constructor(text) {
    super(new Blob([text], { type: CONTENT_TYPE_TEXT_PLAIN }));
  }
}
class TextWriter extends BlobWriter {
  constructor(encoding) {
    super(encoding);
    Object.assign(this, {
      encoding,
      utf8: !encoding || encoding.toLowerCase() == "utf-8"
    });
  }
  async getData() {
    const {
      encoding,
      utf8
    } = this;
    const blob = await super.getData();
    if (blob.text && utf8) {
      return blob.text();
    } else {
      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        Object.assign(reader, {
          onload: ({ target }) => resolve(target.result),
          onerror: () => reject(reader.error)
        });
        reader.readAsText(blob, encoding);
      });
    }
  }
}
class FetchReader extends Reader {
  constructor(url, options) {
    super();
    createHtpReader(this, url, options);
  }
  async init() {
    await initHttpReader(this, sendFetchRequest, getFetchRequestData);
    super.init();
  }
  readUint8Array(index, length) {
    return readUint8ArrayHttpReader(this, index, length, sendFetchRequest, getFetchRequestData);
  }
}
class XHRReader extends Reader {
  constructor(url, options) {
    super();
    createHtpReader(this, url, options);
  }
  async init() {
    await initHttpReader(this, sendXMLHttpRequest, getXMLHttpRequestData);
    super.init();
  }
  readUint8Array(index, length) {
    return readUint8ArrayHttpReader(this, index, length, sendXMLHttpRequest, getXMLHttpRequestData);
  }
}
function createHtpReader(httpReader, url, options) {
  const {
    preventHeadRequest,
    useRangeHeader,
    forceRangeRequests
  } = options;
  options = Object.assign({}, options);
  delete options.preventHeadRequest;
  delete options.useRangeHeader;
  delete options.forceRangeRequests;
  delete options.useXHR;
  Object.assign(httpReader, {
    url,
    options,
    preventHeadRequest,
    useRangeHeader,
    forceRangeRequests
  });
}
async function initHttpReader(httpReader, sendRequest, getRequestData2) {
  const {
    url,
    useRangeHeader,
    forceRangeRequests
  } = httpReader;
  if (isHttpFamily(url) && (useRangeHeader || forceRangeRequests)) {
    const { headers } = await sendRequest(HTTP_METHOD_GET, httpReader, getRangeHeaders(httpReader));
    if (!forceRangeRequests && headers.get(HTTP_HEADER_ACCEPT_RANGES) != HTTP_RANGE_UNIT) {
      throw new Error(ERR_HTTP_RANGE);
    } else {
      let contentSize;
      const contentRangeHeader = headers.get(HTTP_HEADER_CONTENT_RANGE);
      if (contentRangeHeader) {
        const splitHeader = contentRangeHeader.trim().split(/\s*\/\s*/);
        if (splitHeader.length) {
          const headerValue = splitHeader[1];
          if (headerValue && headerValue != "*") {
            contentSize = Number(headerValue);
          }
        }
      }
      if (contentSize === UNDEFINED_VALUE) {
        await getContentLength(httpReader, sendRequest, getRequestData2);
      } else {
        httpReader.size = contentSize;
      }
    }
  } else {
    await getContentLength(httpReader, sendRequest, getRequestData2);
  }
}
async function readUint8ArrayHttpReader(httpReader, index, length, sendRequest, getRequestData2) {
  const {
    useRangeHeader,
    forceRangeRequests,
    options
  } = httpReader;
  if (useRangeHeader || forceRangeRequests) {
    const response = await sendRequest(HTTP_METHOD_GET, httpReader, getRangeHeaders(httpReader, index, length));
    if (response.status != 206) {
      throw new Error(ERR_HTTP_RANGE);
    }
    return new Uint8Array(await response.arrayBuffer());
  } else {
    const { data } = httpReader;
    if (!data) {
      await getRequestData2(httpReader, options);
    }
    return new Uint8Array(httpReader.data.subarray(index, index + length));
  }
}
function getRangeHeaders(httpReader, index = 0, length = 1) {
  return Object.assign({}, getHeaders(httpReader), { [HTTP_HEADER_RANGE]: HTTP_RANGE_UNIT + "=" + index + "-" + (index + length - 1) });
}
function getHeaders({ options }) {
  const { headers } = options;
  if (headers) {
    if (Symbol.iterator in headers) {
      return Object.fromEntries(headers);
    } else {
      return headers;
    }
  }
}
async function getFetchRequestData(httpReader) {
  await getRequestData(httpReader, sendFetchRequest);
}
async function getXMLHttpRequestData(httpReader) {
  await getRequestData(httpReader, sendXMLHttpRequest);
}
async function getRequestData(httpReader, sendRequest) {
  const response = await sendRequest(HTTP_METHOD_GET, httpReader, getHeaders(httpReader));
  httpReader.data = new Uint8Array(await response.arrayBuffer());
  if (!httpReader.size) {
    httpReader.size = httpReader.data.length;
  }
}
async function getContentLength(httpReader, sendRequest, getRequestData2) {
  if (httpReader.preventHeadRequest) {
    await getRequestData2(httpReader, httpReader.options);
  } else {
    const response = await sendRequest(HTTP_METHOD_HEAD, httpReader, getHeaders(httpReader));
    const contentLength = response.headers.get(HTTP_HEADER_CONTENT_LENGTH);
    if (contentLength) {
      httpReader.size = Number(contentLength);
    } else {
      await getRequestData2(httpReader, httpReader.options);
    }
  }
}
async function sendFetchRequest(method, { options, url }, headers) {
  const response = await fetch(url, Object.assign({}, options, { method, headers }));
  if (response.status < 400) {
    return response;
  } else {
    throw response.status == 416 ? new Error(ERR_HTTP_RANGE) : new Error(ERR_HTTP_STATUS + (response.statusText || response.status));
  }
}
function sendXMLHttpRequest(method, { url }, headers) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.addEventListener("load", () => {
      if (request.status < 400) {
        const headers2 = [];
        request.getAllResponseHeaders().trim().split(/[\r\n]+/).forEach((header) => {
          const splitHeader = header.trim().split(/\s*:\s*/);
          splitHeader[0] = splitHeader[0].trim().replace(/^[a-z]|-[a-z]/g, (value) => value.toUpperCase());
          headers2.push(splitHeader);
        });
        resolve({
          status: request.status,
          arrayBuffer: () => request.response,
          headers: new Map(headers2)
        });
      } else {
        reject(request.status == 416 ? new Error(ERR_HTTP_RANGE) : new Error(ERR_HTTP_STATUS + (request.statusText || request.status)));
      }
    }, false);
    request.addEventListener("error", (event) => reject(event.detail ? event.detail.error : new Error("Network error")), false);
    request.open(method, url);
    if (headers) {
      for (const entry of Object.entries(headers)) {
        request.setRequestHeader(entry[0], entry[1]);
      }
    }
    request.responseType = "arraybuffer";
    request.send();
  });
}
class HttpReader extends Reader {
  constructor(url, options = {}) {
    super();
    Object.assign(this, {
      url,
      reader: options.useXHR ? new XHRReader(url, options) : new FetchReader(url, options)
    });
  }
  set size(value) {
  }
  get size() {
    return this.reader.size;
  }
  async init() {
    await this.reader.init();
    super.init();
  }
  readUint8Array(index, length) {
    return this.reader.readUint8Array(index, length);
  }
}
class HttpRangeReader extends HttpReader {
  constructor(url, options = {}) {
    options.useRangeHeader = true;
    super(url, options);
  }
}
class Uint8ArrayReader extends Reader {
  constructor(array) {
    super();
    Object.assign(this, {
      array,
      size: array.length
    });
  }
  readUint8Array(index, length) {
    return this.array.slice(index, index + length);
  }
}
class Uint8ArrayWriter extends Writer {
  init(initSize = 0) {
    Object.assign(this, {
      offset: 0,
      array: new Uint8Array(initSize)
    });
    super.init();
  }
  writeUint8Array(array) {
    const writer = this;
    if (writer.offset + array.length > writer.array.length) {
      const previousArray = writer.array;
      writer.array = new Uint8Array(previousArray.length + array.length);
      writer.array.set(previousArray);
    }
    writer.array.set(array, writer.offset);
    writer.offset += array.length;
  }
  getData() {
    return this.array;
  }
}
class SplitDataReader extends Reader {
  constructor(readers) {
    super();
    this.readers = readers;
  }
  async init() {
    const reader = this;
    const { readers } = reader;
    reader.lastDiskNumber = 0;
    reader.lastDiskOffset = 0;
    await Promise.all(readers.map(async (diskReader, indexDiskReader) => {
      await diskReader.init();
      if (indexDiskReader != readers.length - 1) {
        reader.lastDiskOffset += diskReader.size;
      }
      reader.size += diskReader.size;
    }));
    super.init();
  }
  async readUint8Array(offset, length, diskNumber = 0) {
    const reader = this;
    const { readers } = this;
    let result;
    let currentDiskNumber = diskNumber;
    if (currentDiskNumber == -1) {
      currentDiskNumber = readers.length - 1;
    }
    let currentReaderOffset = offset;
    while (currentReaderOffset >= readers[currentDiskNumber].size) {
      currentReaderOffset -= readers[currentDiskNumber].size;
      currentDiskNumber++;
    }
    const currentReader = readers[currentDiskNumber];
    const currentReaderSize = currentReader.size;
    if (currentReaderOffset + length <= currentReaderSize) {
      result = await readUint8Array(currentReader, currentReaderOffset, length);
    } else {
      const chunkLength = currentReaderSize - currentReaderOffset;
      result = new Uint8Array(length);
      result.set(await readUint8Array(currentReader, currentReaderOffset, chunkLength));
      result.set(await reader.readUint8Array(offset + chunkLength, length - chunkLength, diskNumber), chunkLength);
    }
    reader.lastDiskNumber = Math.max(currentDiskNumber, reader.lastDiskNumber);
    return result;
  }
}
class SplitDataWriter extends Stream {
  constructor(writerGenerator, maxSize = 4294967295) {
    super();
    const zipWriter = this;
    Object.assign(zipWriter, {
      diskNumber: 0,
      diskOffset: 0,
      size: 0,
      maxSize,
      availableSize: maxSize
    });
    let diskSourceWriter, diskWritable, diskWriter;
    const writable = new WritableStream({
      async write(chunk) {
        const { availableSize } = zipWriter;
        if (!diskWriter) {
          const { value, done } = await writerGenerator.next();
          if (done && !value) {
            throw new Error(ERR_ITERATOR_COMPLETED_TOO_SOON);
          } else {
            diskSourceWriter = value;
            diskSourceWriter.size = 0;
            if (diskSourceWriter.maxSize) {
              zipWriter.maxSize = diskSourceWriter.maxSize;
            }
            zipWriter.availableSize = zipWriter.maxSize;
            await initStream(diskSourceWriter);
            diskWritable = value.writable;
            diskWriter = diskWritable.getWriter();
          }
          await this.write(chunk);
        } else if (chunk.length >= availableSize) {
          await writeChunk(chunk.slice(0, availableSize));
          await closeDisk();
          zipWriter.diskOffset += diskSourceWriter.size;
          zipWriter.diskNumber++;
          diskWriter = null;
          await this.write(chunk.slice(availableSize));
        } else {
          await writeChunk(chunk);
        }
      },
      async close() {
        await diskWriter.ready;
        await closeDisk();
      }
    });
    Object.defineProperty(zipWriter, PROPERTY_NAME_WRITABLE, {
      get() {
        return writable;
      }
    });
    async function writeChunk(chunk) {
      const chunkLength = chunk.length;
      if (chunkLength) {
        await diskWriter.ready;
        await diskWriter.write(chunk);
        diskSourceWriter.size += chunkLength;
        zipWriter.size += chunkLength;
        zipWriter.availableSize -= chunkLength;
      }
    }
    async function closeDisk() {
      diskWritable.size = diskSourceWriter.size;
      await diskWriter.close();
    }
  }
}
function isHttpFamily(url) {
  const { baseURL } = getConfiguration();
  const { protocol } = new URL(url, baseURL);
  return protocol == "http:" || protocol == "https:";
}
async function initStream(stream, initSize) {
  if (stream.init && !stream.initialized) {
    await stream.init(initSize);
  }
}
function initReader(reader) {
  if (Array.isArray(reader)) {
    reader = new SplitDataReader(reader);
  }
  if (reader instanceof ReadableStream) {
    reader = {
      readable: reader
    };
  }
  return reader;
}
function initWriter(writer) {
  if (writer.writable === UNDEFINED_VALUE && typeof writer.next == FUNCTION_TYPE$1) {
    writer = new SplitDataWriter(writer);
  }
  if (writer instanceof WritableStream) {
    writer = {
      writable: writer
    };
  }
  const { writable } = writer;
  if (writable.size === UNDEFINED_VALUE) {
    writable.size = 0;
  }
  const splitZipFile = writer instanceof SplitDataWriter;
  if (!splitZipFile) {
    Object.assign(writer, {
      diskNumber: 0,
      diskOffset: 0,
      availableSize: Infinity,
      maxSize: Infinity
    });
  }
  return writer;
}
function readUint8Array(reader, offset, size, diskNumber) {
  return reader.readUint8Array(offset, size, diskNumber);
}
const SplitZipReader = SplitDataReader;
const SplitZipWriter = SplitDataWriter;
const CP437 = "\0☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ".split("");
const VALID_CP437 = CP437.length == 256;
function decodeCP437(stringValue) {
  if (VALID_CP437) {
    let result = "";
    for (let indexCharacter = 0; indexCharacter < stringValue.length; indexCharacter++) {
      result += CP437[stringValue[indexCharacter]];
    }
    return result;
  } else {
    return new TextDecoder().decode(stringValue);
  }
}
function decodeText(value, encoding) {
  if (encoding && encoding.trim().toLowerCase() == "cp437") {
    return decodeCP437(value);
  } else {
    return new TextDecoder(encoding).decode(value);
  }
}
const PROPERTY_NAME_FILENAME = "filename";
const PROPERTY_NAME_RAW_FILENAME = "rawFilename";
const PROPERTY_NAME_COMMENT = "comment";
const PROPERTY_NAME_RAW_COMMENT = "rawComment";
const PROPERTY_NAME_UNCOMPPRESSED_SIZE = "uncompressedSize";
const PROPERTY_NAME_COMPPRESSED_SIZE = "compressedSize";
const PROPERTY_NAME_OFFSET = "offset";
const PROPERTY_NAME_DISK_NUMBER_START = "diskNumberStart";
const PROPERTY_NAME_LAST_MODIFICATION_DATE = "lastModDate";
const PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE = "rawLastModDate";
const PROPERTY_NAME_LAST_ACCESS_DATE = "lastAccessDate";
const PROPERTY_NAME_RAW_LAST_ACCESS_DATE = "rawLastAccessDate";
const PROPERTY_NAME_CREATION_DATE = "creationDate";
const PROPERTY_NAME_RAW_CREATION_DATE = "rawCreationDate";
const PROPERTY_NAME_INTERNAL_FILE_ATTRIBUTE = "internalFileAttribute";
const PROPERTY_NAME_EXTERNAL_FILE_ATTRIBUTE = "externalFileAttribute";
const PROPERTY_NAME_MS_DOS_COMPATIBLE = "msDosCompatible";
const PROPERTY_NAME_ZIP64 = "zip64";
const PROPERTY_NAMES = [
  PROPERTY_NAME_FILENAME,
  PROPERTY_NAME_RAW_FILENAME,
  PROPERTY_NAME_COMPPRESSED_SIZE,
  PROPERTY_NAME_UNCOMPPRESSED_SIZE,
  PROPERTY_NAME_LAST_MODIFICATION_DATE,
  PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE,
  PROPERTY_NAME_COMMENT,
  PROPERTY_NAME_RAW_COMMENT,
  PROPERTY_NAME_LAST_ACCESS_DATE,
  PROPERTY_NAME_CREATION_DATE,
  PROPERTY_NAME_OFFSET,
  PROPERTY_NAME_DISK_NUMBER_START,
  PROPERTY_NAME_DISK_NUMBER_START,
  PROPERTY_NAME_INTERNAL_FILE_ATTRIBUTE,
  PROPERTY_NAME_EXTERNAL_FILE_ATTRIBUTE,
  PROPERTY_NAME_MS_DOS_COMPATIBLE,
  PROPERTY_NAME_ZIP64,
  "directory",
  "bitFlag",
  "encrypted",
  "signature",
  "filenameUTF8",
  "commentUTF8",
  "compressionMethod",
  "version",
  "versionMadeBy",
  "extraField",
  "rawExtraField",
  "extraFieldZip64",
  "extraFieldUnicodePath",
  "extraFieldUnicodeComment",
  "extraFieldAES",
  "extraFieldNTFS",
  "extraFieldExtendedTimestamp"
];
class Entry {
  constructor(data) {
    PROPERTY_NAMES.forEach((name) => this[name] = data[name]);
  }
}
const ERR_BAD_FORMAT = "File format is not recognized";
const ERR_EOCDR_NOT_FOUND = "End of central directory not found";
const ERR_EOCDR_ZIP64_NOT_FOUND = "End of Zip64 central directory not found";
const ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND = "End of Zip64 central directory locator not found";
const ERR_CENTRAL_DIRECTORY_NOT_FOUND = "Central directory header not found";
const ERR_LOCAL_FILE_HEADER_NOT_FOUND = "Local file header not found";
const ERR_EXTRAFIELD_ZIP64_NOT_FOUND = "Zip64 extra field not found";
const ERR_ENCRYPTED = "File contains encrypted entry";
const ERR_UNSUPPORTED_ENCRYPTION = "Encryption method not supported";
const ERR_UNSUPPORTED_COMPRESSION = "Compression method not supported";
const ERR_SPLIT_ZIP_FILE = "Split zip file";
const CHARSET_UTF8 = "utf-8";
const CHARSET_CP437 = "cp437";
const ZIP64_PROPERTIES = [
  [PROPERTY_NAME_UNCOMPPRESSED_SIZE, MAX_32_BITS],
  [PROPERTY_NAME_COMPPRESSED_SIZE, MAX_32_BITS],
  [PROPERTY_NAME_OFFSET, MAX_32_BITS],
  [PROPERTY_NAME_DISK_NUMBER_START, MAX_16_BITS]
];
const ZIP64_EXTRACTION = {
  [MAX_16_BITS]: {
    getValue: getUint32,
    bytes: 4
  },
  [MAX_32_BITS]: {
    getValue: getBigUint64,
    bytes: 8
  }
};
class ZipReader {
  constructor(reader, options = {}) {
    Object.assign(this, {
      reader: initReader(reader),
      options,
      config: getConfiguration()
    });
  }
  async *getEntriesGenerator(options = {}) {
    const zipReader = this;
    let { reader } = zipReader;
    const { config: config2 } = zipReader;
    await initStream(reader);
    if (reader.size === UNDEFINED_VALUE || !reader.readUint8Array) {
      reader = new BlobReader(await new Response(reader.readable).blob());
      await initStream(reader);
    }
    if (reader.size < END_OF_CENTRAL_DIR_LENGTH) {
      throw new Error(ERR_BAD_FORMAT);
    }
    reader.chunkSize = getChunkSize(config2);
    const endOfDirectoryInfo = await seekSignature(reader, END_OF_CENTRAL_DIR_SIGNATURE, reader.size, END_OF_CENTRAL_DIR_LENGTH, MAX_16_BITS * 16);
    if (!endOfDirectoryInfo) {
      const signatureArray = await readUint8Array(reader, 0, 4);
      const signatureView = getDataView(signatureArray);
      if (getUint32(signatureView) == SPLIT_ZIP_FILE_SIGNATURE) {
        throw new Error(ERR_SPLIT_ZIP_FILE);
      } else {
        throw new Error(ERR_EOCDR_NOT_FOUND);
      }
    }
    const endOfDirectoryView = getDataView(endOfDirectoryInfo);
    let directoryDataLength = getUint32(endOfDirectoryView, 12);
    let directoryDataOffset = getUint32(endOfDirectoryView, 16);
    const commentOffset = endOfDirectoryInfo.offset;
    const commentLength = getUint16(endOfDirectoryView, 20);
    const appendedDataOffset = commentOffset + END_OF_CENTRAL_DIR_LENGTH + commentLength;
    let lastDiskNumber = getUint16(endOfDirectoryView, 4);
    const expectedLastDiskNumber = reader.lastDiskNumber || 0;
    let diskNumber = getUint16(endOfDirectoryView, 6);
    let filesLength = getUint16(endOfDirectoryView, 8);
    let prependedDataLength = 0;
    let startOffset = 0;
    if (directoryDataOffset == MAX_32_BITS || directoryDataLength == MAX_32_BITS || filesLength == MAX_16_BITS || diskNumber == MAX_16_BITS) {
      const endOfDirectoryLocatorArray = await readUint8Array(reader, endOfDirectoryInfo.offset - ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH, ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH);
      const endOfDirectoryLocatorView = getDataView(endOfDirectoryLocatorArray);
      if (getUint32(endOfDirectoryLocatorView, 0) != ZIP64_END_OF_CENTRAL_DIR_LOCATOR_SIGNATURE) {
        throw new Error(ERR_EOCDR_ZIP64_NOT_FOUND);
      }
      directoryDataOffset = getBigUint64(endOfDirectoryLocatorView, 8);
      let endOfDirectoryArray = await readUint8Array(reader, directoryDataOffset, ZIP64_END_OF_CENTRAL_DIR_LENGTH, -1);
      let endOfDirectoryView2 = getDataView(endOfDirectoryArray);
      const expectedDirectoryDataOffset = endOfDirectoryInfo.offset - ZIP64_END_OF_CENTRAL_DIR_LOCATOR_LENGTH - ZIP64_END_OF_CENTRAL_DIR_LENGTH;
      if (getUint32(endOfDirectoryView2, 0) != ZIP64_END_OF_CENTRAL_DIR_SIGNATURE && directoryDataOffset != expectedDirectoryDataOffset) {
        const originalDirectoryDataOffset = directoryDataOffset;
        directoryDataOffset = expectedDirectoryDataOffset;
        prependedDataLength = directoryDataOffset - originalDirectoryDataOffset;
        endOfDirectoryArray = await readUint8Array(reader, directoryDataOffset, ZIP64_END_OF_CENTRAL_DIR_LENGTH, -1);
        endOfDirectoryView2 = getDataView(endOfDirectoryArray);
      }
      if (getUint32(endOfDirectoryView2, 0) != ZIP64_END_OF_CENTRAL_DIR_SIGNATURE) {
        throw new Error(ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND);
      }
      if (lastDiskNumber == MAX_16_BITS) {
        lastDiskNumber = getUint32(endOfDirectoryView2, 16);
      }
      if (diskNumber == MAX_16_BITS) {
        diskNumber = getUint32(endOfDirectoryView2, 20);
      }
      if (filesLength == MAX_16_BITS) {
        filesLength = getBigUint64(endOfDirectoryView2, 32);
      }
      if (directoryDataLength == MAX_32_BITS) {
        directoryDataLength = getBigUint64(endOfDirectoryView2, 40);
      }
      directoryDataOffset -= directoryDataLength;
    }
    if (directoryDataOffset >= reader.size) {
      prependedDataLength = reader.size - directoryDataOffset - directoryDataLength - END_OF_CENTRAL_DIR_LENGTH;
      directoryDataOffset = reader.size - directoryDataLength - END_OF_CENTRAL_DIR_LENGTH;
    }
    if (expectedLastDiskNumber != lastDiskNumber) {
      throw new Error(ERR_SPLIT_ZIP_FILE);
    }
    if (directoryDataOffset < 0) {
      throw new Error(ERR_BAD_FORMAT);
    }
    let offset = 0;
    let directoryArray = await readUint8Array(reader, directoryDataOffset, directoryDataLength, diskNumber);
    let directoryView = getDataView(directoryArray);
    if (directoryDataLength) {
      const expectedDirectoryDataOffset = endOfDirectoryInfo.offset - directoryDataLength;
      if (getUint32(directoryView, offset) != CENTRAL_FILE_HEADER_SIGNATURE && directoryDataOffset != expectedDirectoryDataOffset) {
        const originalDirectoryDataOffset = directoryDataOffset;
        directoryDataOffset = expectedDirectoryDataOffset;
        prependedDataLength += directoryDataOffset - originalDirectoryDataOffset;
        directoryArray = await readUint8Array(reader, directoryDataOffset, directoryDataLength, diskNumber);
        directoryView = getDataView(directoryArray);
      }
    }
    const expectedDirectoryDataLength = endOfDirectoryInfo.offset - directoryDataOffset - (reader.lastDiskOffset || 0);
    if (directoryDataLength != expectedDirectoryDataLength && expectedDirectoryDataLength >= 0) {
      directoryDataLength = expectedDirectoryDataLength;
      directoryArray = await readUint8Array(reader, directoryDataOffset, directoryDataLength, diskNumber);
      directoryView = getDataView(directoryArray);
    }
    if (directoryDataOffset < 0 || directoryDataOffset >= reader.size) {
      throw new Error(ERR_BAD_FORMAT);
    }
    const filenameEncoding = getOptionValue(zipReader, options, "filenameEncoding");
    const commentEncoding = getOptionValue(zipReader, options, "commentEncoding");
    for (let indexFile = 0; indexFile < filesLength; indexFile++) {
      const fileEntry = new ZipEntry(reader, config2, zipReader.options);
      if (getUint32(directoryView, offset) != CENTRAL_FILE_HEADER_SIGNATURE) {
        throw new Error(ERR_CENTRAL_DIRECTORY_NOT_FOUND);
      }
      readCommonHeader(fileEntry, directoryView, offset + 6);
      const languageEncodingFlag = Boolean(fileEntry.bitFlag.languageEncodingFlag);
      const filenameOffset = offset + 46;
      const extraFieldOffset = filenameOffset + fileEntry.filenameLength;
      const commentOffset2 = extraFieldOffset + fileEntry.extraFieldLength;
      const versionMadeBy = getUint16(directoryView, offset + 4);
      const msDosCompatible = (versionMadeBy & 0) == 0;
      const rawFilename = directoryArray.subarray(filenameOffset, extraFieldOffset);
      const commentLength2 = getUint16(directoryView, offset + 32);
      const endOffset = commentOffset2 + commentLength2;
      const rawComment = directoryArray.subarray(commentOffset2, endOffset);
      const filenameUTF8 = languageEncodingFlag;
      const commentUTF8 = languageEncodingFlag;
      const directory = msDosCompatible && (getUint8(directoryView, offset + 38) & FILE_ATTR_MSDOS_DIR_MASK) == FILE_ATTR_MSDOS_DIR_MASK;
      const offsetFileEntry = getUint32(directoryView, offset + 42) + prependedDataLength;
      Object.assign(fileEntry, {
        versionMadeBy,
        msDosCompatible,
        compressedSize: 0,
        uncompressedSize: 0,
        commentLength: commentLength2,
        directory,
        offset: offsetFileEntry,
        diskNumberStart: getUint16(directoryView, offset + 34),
        internalFileAttribute: getUint16(directoryView, offset + 36),
        externalFileAttribute: getUint32(directoryView, offset + 38),
        rawFilename,
        filenameUTF8,
        commentUTF8,
        rawExtraField: directoryArray.subarray(extraFieldOffset, commentOffset2)
      });
      const [filename, comment] = await Promise.all([
        decodeText(rawFilename, filenameUTF8 ? CHARSET_UTF8 : filenameEncoding || CHARSET_CP437),
        decodeText(rawComment, commentUTF8 ? CHARSET_UTF8 : commentEncoding || CHARSET_CP437)
      ]);
      Object.assign(fileEntry, {
        rawComment,
        filename,
        comment,
        directory: directory || filename.endsWith(DIRECTORY_SIGNATURE)
      });
      startOffset = Math.max(offsetFileEntry, startOffset);
      await readCommonFooter(fileEntry, fileEntry, directoryView, offset + 6);
      const entry = new Entry(fileEntry);
      entry.getData = (writer, options2) => fileEntry.getData(writer, entry, options2);
      offset = endOffset;
      const { onprogress } = options;
      if (onprogress) {
        try {
          await onprogress(indexFile + 1, filesLength, new Entry(fileEntry));
        } catch (_error) {
        }
      }
      yield entry;
    }
    const extractPrependedData = getOptionValue(zipReader, options, "extractPrependedData");
    const extractAppendedData = getOptionValue(zipReader, options, "extractAppendedData");
    if (extractPrependedData) {
      zipReader.prependedData = startOffset > 0 ? await readUint8Array(reader, 0, startOffset) : new Uint8Array();
    }
    zipReader.comment = commentLength ? await readUint8Array(reader, commentOffset + END_OF_CENTRAL_DIR_LENGTH, commentLength) : new Uint8Array();
    if (extractAppendedData) {
      zipReader.appendedData = appendedDataOffset < reader.size ? await readUint8Array(reader, appendedDataOffset, reader.size - appendedDataOffset) : new Uint8Array();
    }
    return true;
  }
  async getEntries(options = {}) {
    const entries = [];
    for await (const entry of this.getEntriesGenerator(options)) {
      entries.push(entry);
    }
    return entries;
  }
  async close() {
  }
}
class ZipEntry {
  constructor(reader, config2, options) {
    Object.assign(this, {
      reader,
      config: config2,
      options
    });
  }
  async getData(writer, fileEntry, options = {}) {
    const zipEntry = this;
    const {
      reader,
      offset,
      diskNumberStart,
      extraFieldAES,
      compressionMethod,
      config: config2,
      bitFlag,
      signature,
      rawLastModDate,
      uncompressedSize,
      compressedSize
    } = zipEntry;
    const localDirectory = fileEntry.localDirectory = {};
    const dataArray = await readUint8Array(reader, offset, 30, diskNumberStart);
    const dataView = getDataView(dataArray);
    let password = getOptionValue(zipEntry, options, "password");
    password = password && password.length && password;
    if (extraFieldAES) {
      if (extraFieldAES.originalCompressionMethod != COMPRESSION_METHOD_AES) {
        throw new Error(ERR_UNSUPPORTED_COMPRESSION);
      }
    }
    if (compressionMethod != COMPRESSION_METHOD_STORE && compressionMethod != COMPRESSION_METHOD_DEFLATE) {
      throw new Error(ERR_UNSUPPORTED_COMPRESSION);
    }
    if (getUint32(dataView, 0) != LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(ERR_LOCAL_FILE_HEADER_NOT_FOUND);
    }
    readCommonHeader(localDirectory, dataView, 4);
    localDirectory.rawExtraField = localDirectory.extraFieldLength ? await readUint8Array(reader, offset + 30 + localDirectory.filenameLength, localDirectory.extraFieldLength, diskNumberStart) : new Uint8Array();
    await readCommonFooter(zipEntry, localDirectory, dataView, 4, true);
    Object.assign(fileEntry, {
      lastAccessDate: localDirectory.lastAccessDate,
      creationDate: localDirectory.creationDate
    });
    const encrypted = zipEntry.encrypted && localDirectory.encrypted;
    const zipCrypto = encrypted && !extraFieldAES;
    if (encrypted) {
      if (!zipCrypto && extraFieldAES.strength === UNDEFINED_VALUE) {
        throw new Error(ERR_UNSUPPORTED_ENCRYPTION);
      } else if (!password) {
        throw new Error(ERR_ENCRYPTED);
      }
    }
    const dataOffset = offset + 30 + localDirectory.filenameLength + localDirectory.extraFieldLength;
    const size = compressedSize;
    const readable = reader.readable;
    Object.assign(readable, {
      diskNumberStart,
      offset: dataOffset,
      size
    });
    const signal = getOptionValue(zipEntry, options, "signal");
    const checkPasswordOnly = getOptionValue(zipEntry, options, "checkPasswordOnly");
    if (checkPasswordOnly) {
      writer = new WritableStream();
    }
    writer = initWriter(writer);
    await initStream(writer, uncompressedSize);
    const { writable } = writer;
    const { onstart, onprogress, onend } = options;
    const workerOptions = {
      options: {
        codecType: CODEC_INFLATE,
        password,
        zipCrypto,
        encryptionStrength: extraFieldAES && extraFieldAES.strength,
        signed: getOptionValue(zipEntry, options, "checkSignature"),
        passwordVerification: zipCrypto && (bitFlag.dataDescriptor ? rawLastModDate >>> 8 & 255 : signature >>> 24 & 255),
        signature,
        compressed: compressionMethod != 0,
        encrypted,
        useWebWorkers: getOptionValue(zipEntry, options, "useWebWorkers"),
        useCompressionStream: getOptionValue(zipEntry, options, "useCompressionStream"),
        transferStreams: getOptionValue(zipEntry, options, "transferStreams"),
        checkPasswordOnly
      },
      config: config2,
      streamOptions: { signal, size, onstart, onprogress, onend }
    };
    let outputSize = 0;
    try {
      ({ outputSize } = await runWorker({ readable, writable }, workerOptions));
    } catch (error) {
      if (!checkPasswordOnly || error.message != ERR_ABORT_CHECK_PASSWORD) {
        throw error;
      }
    } finally {
      const preventClose = getOptionValue(zipEntry, options, "preventClose");
      writable.size += outputSize;
      if (!preventClose && !writable.locked) {
        await writable.getWriter().close();
      }
    }
    return checkPasswordOnly ? void 0 : writer.getData ? writer.getData() : writable;
  }
}
function readCommonHeader(directory, dataView, offset) {
  const rawBitFlag = directory.rawBitFlag = getUint16(dataView, offset + 2);
  const encrypted = (rawBitFlag & BITFLAG_ENCRYPTED) == BITFLAG_ENCRYPTED;
  const rawLastModDate = getUint32(dataView, offset + 6);
  Object.assign(directory, {
    encrypted,
    version: getUint16(dataView, offset),
    bitFlag: {
      level: (rawBitFlag & BITFLAG_LEVEL) >> 1,
      dataDescriptor: (rawBitFlag & BITFLAG_DATA_DESCRIPTOR) == BITFLAG_DATA_DESCRIPTOR,
      languageEncodingFlag: (rawBitFlag & BITFLAG_LANG_ENCODING_FLAG) == BITFLAG_LANG_ENCODING_FLAG
    },
    rawLastModDate,
    lastModDate: getDate(rawLastModDate),
    filenameLength: getUint16(dataView, offset + 22),
    extraFieldLength: getUint16(dataView, offset + 24)
  });
}
async function readCommonFooter(fileEntry, directory, dataView, offset, localDirectory) {
  const { rawExtraField } = directory;
  const extraField = directory.extraField = /* @__PURE__ */ new Map();
  const rawExtraFieldView = getDataView(new Uint8Array(rawExtraField));
  let offsetExtraField = 0;
  try {
    while (offsetExtraField < rawExtraField.length) {
      const type = getUint16(rawExtraFieldView, offsetExtraField);
      const size = getUint16(rawExtraFieldView, offsetExtraField + 2);
      extraField.set(type, {
        type,
        data: rawExtraField.slice(offsetExtraField + 4, offsetExtraField + 4 + size)
      });
      offsetExtraField += 4 + size;
    }
  } catch (_error) {
  }
  const compressionMethod = getUint16(dataView, offset + 4);
  Object.assign(directory, {
    signature: getUint32(dataView, offset + 10),
    uncompressedSize: getUint32(dataView, offset + 18),
    compressedSize: getUint32(dataView, offset + 14)
  });
  const extraFieldZip64 = extraField.get(EXTRAFIELD_TYPE_ZIP64);
  if (extraFieldZip64) {
    readExtraFieldZip64(extraFieldZip64, directory);
    directory.extraFieldZip64 = extraFieldZip64;
  }
  const extraFieldUnicodePath = extraField.get(EXTRAFIELD_TYPE_UNICODE_PATH);
  if (extraFieldUnicodePath) {
    await readExtraFieldUnicode(extraFieldUnicodePath, PROPERTY_NAME_FILENAME, PROPERTY_NAME_RAW_FILENAME, directory, fileEntry);
    directory.extraFieldUnicodePath = extraFieldUnicodePath;
  }
  const extraFieldUnicodeComment = extraField.get(EXTRAFIELD_TYPE_UNICODE_COMMENT);
  if (extraFieldUnicodeComment) {
    await readExtraFieldUnicode(extraFieldUnicodeComment, PROPERTY_NAME_COMMENT, PROPERTY_NAME_RAW_COMMENT, directory, fileEntry);
    directory.extraFieldUnicodeComment = extraFieldUnicodeComment;
  }
  const extraFieldAES = extraField.get(EXTRAFIELD_TYPE_AES);
  if (extraFieldAES) {
    readExtraFieldAES(extraFieldAES, directory, compressionMethod);
    directory.extraFieldAES = extraFieldAES;
  } else {
    directory.compressionMethod = compressionMethod;
  }
  const extraFieldNTFS = extraField.get(EXTRAFIELD_TYPE_NTFS);
  if (extraFieldNTFS) {
    readExtraFieldNTFS(extraFieldNTFS, directory);
    directory.extraFieldNTFS = extraFieldNTFS;
  }
  const extraFieldExtendedTimestamp = extraField.get(EXTRAFIELD_TYPE_EXTENDED_TIMESTAMP);
  if (extraFieldExtendedTimestamp) {
    readExtraFieldExtendedTimestamp(extraFieldExtendedTimestamp, directory, localDirectory);
    directory.extraFieldExtendedTimestamp = extraFieldExtendedTimestamp;
  }
  const extraFieldUSDZ = extraField.get(EXTRAFIELD_TYPE_USDZ);
  if (extraFieldUSDZ) {
    directory.extraFieldUSDZ = extraFieldUSDZ;
  }
}
function readExtraFieldZip64(extraFieldZip64, directory) {
  directory.zip64 = true;
  const extraFieldView = getDataView(extraFieldZip64.data);
  const missingProperties = ZIP64_PROPERTIES.filter(([propertyName, max]) => directory[propertyName] == max);
  for (let indexMissingProperty = 0, offset = 0; indexMissingProperty < missingProperties.length; indexMissingProperty++) {
    const [propertyName, max] = missingProperties[indexMissingProperty];
    if (directory[propertyName] == max) {
      const extraction = ZIP64_EXTRACTION[max];
      directory[propertyName] = extraFieldZip64[propertyName] = extraction.getValue(extraFieldView, offset);
      offset += extraction.bytes;
    } else if (extraFieldZip64[propertyName]) {
      throw new Error(ERR_EXTRAFIELD_ZIP64_NOT_FOUND);
    }
  }
}
async function readExtraFieldUnicode(extraFieldUnicode, propertyName, rawPropertyName, directory, fileEntry) {
  const extraFieldView = getDataView(extraFieldUnicode.data);
  const crc32 = new Crc32();
  crc32.append(fileEntry[rawPropertyName]);
  const dataViewSignature = getDataView(new Uint8Array(4));
  dataViewSignature.setUint32(0, crc32.get(), true);
  const signature = getUint32(extraFieldView, 1);
  Object.assign(extraFieldUnicode, {
    version: getUint8(extraFieldView, 0),
    [propertyName]: decodeText(extraFieldUnicode.data.subarray(5)),
    valid: !fileEntry.bitFlag.languageEncodingFlag && signature == getUint32(dataViewSignature, 0)
  });
  if (extraFieldUnicode.valid) {
    directory[propertyName] = extraFieldUnicode[propertyName];
    directory[propertyName + "UTF8"] = true;
  }
}
function readExtraFieldAES(extraFieldAES, directory, compressionMethod) {
  const extraFieldView = getDataView(extraFieldAES.data);
  const strength = getUint8(extraFieldView, 4);
  Object.assign(extraFieldAES, {
    vendorVersion: getUint8(extraFieldView, 0),
    vendorId: getUint8(extraFieldView, 2),
    strength,
    originalCompressionMethod: compressionMethod,
    compressionMethod: getUint16(extraFieldView, 5)
  });
  directory.compressionMethod = extraFieldAES.compressionMethod;
}
function readExtraFieldNTFS(extraFieldNTFS, directory) {
  const extraFieldView = getDataView(extraFieldNTFS.data);
  let offsetExtraField = 4;
  let tag1Data;
  try {
    while (offsetExtraField < extraFieldNTFS.data.length && !tag1Data) {
      const tagValue = getUint16(extraFieldView, offsetExtraField);
      const attributeSize = getUint16(extraFieldView, offsetExtraField + 2);
      if (tagValue == EXTRAFIELD_TYPE_NTFS_TAG1) {
        tag1Data = extraFieldNTFS.data.slice(offsetExtraField + 4, offsetExtraField + 4 + attributeSize);
      }
      offsetExtraField += 4 + attributeSize;
    }
  } catch (_error) {
  }
  try {
    if (tag1Data && tag1Data.length == 24) {
      const tag1View = getDataView(tag1Data);
      const rawLastModDate = tag1View.getBigUint64(0, true);
      const rawLastAccessDate = tag1View.getBigUint64(8, true);
      const rawCreationDate = tag1View.getBigUint64(16, true);
      Object.assign(extraFieldNTFS, {
        rawLastModDate,
        rawLastAccessDate,
        rawCreationDate
      });
      const lastModDate = getDateNTFS(rawLastModDate);
      const lastAccessDate = getDateNTFS(rawLastAccessDate);
      const creationDate = getDateNTFS(rawCreationDate);
      const extraFieldData = { lastModDate, lastAccessDate, creationDate };
      Object.assign(extraFieldNTFS, extraFieldData);
      Object.assign(directory, extraFieldData);
    }
  } catch (_error) {
  }
}
function readExtraFieldExtendedTimestamp(extraFieldExtendedTimestamp, directory, localDirectory) {
  const extraFieldView = getDataView(extraFieldExtendedTimestamp.data);
  const flags = getUint8(extraFieldView, 0);
  const timeProperties = [];
  const timeRawProperties = [];
  if (localDirectory) {
    if ((flags & 1) == 1) {
      timeProperties.push(PROPERTY_NAME_LAST_MODIFICATION_DATE);
      timeRawProperties.push(PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE);
    }
    if ((flags & 2) == 2) {
      timeProperties.push(PROPERTY_NAME_LAST_ACCESS_DATE);
      timeRawProperties.push(PROPERTY_NAME_RAW_LAST_ACCESS_DATE);
    }
    if ((flags & 4) == 4) {
      timeProperties.push(PROPERTY_NAME_CREATION_DATE);
      timeRawProperties.push(PROPERTY_NAME_RAW_CREATION_DATE);
    }
  } else if (extraFieldExtendedTimestamp.data.length >= 5) {
    timeProperties.push(PROPERTY_NAME_LAST_MODIFICATION_DATE);
    timeRawProperties.push(PROPERTY_NAME_RAW_LAST_MODIFICATION_DATE);
  }
  let offset = 1;
  timeProperties.forEach((propertyName, indexProperty) => {
    if (extraFieldExtendedTimestamp.data.length >= offset + 4) {
      const time = getUint32(extraFieldView, offset);
      directory[propertyName] = extraFieldExtendedTimestamp[propertyName] = new Date(time * 1e3);
      const rawPropertyName = timeRawProperties[indexProperty];
      extraFieldExtendedTimestamp[rawPropertyName] = time;
    }
    offset += 4;
  });
}
async function seekSignature(reader, signature, startOffset, minimumBytes, maximumLength) {
  const signatureArray = new Uint8Array(4);
  const signatureView = getDataView(signatureArray);
  setUint32(signatureView, 0, signature);
  const maximumBytes = minimumBytes + maximumLength;
  return await seek(minimumBytes) || await seek(Math.min(maximumBytes, startOffset));
  async function seek(length) {
    const offset = startOffset - length;
    const bytes = await readUint8Array(reader, offset, length);
    for (let indexByte = bytes.length - minimumBytes; indexByte >= 0; indexByte--) {
      if (bytes[indexByte] == signatureArray[0] && bytes[indexByte + 1] == signatureArray[1] && bytes[indexByte + 2] == signatureArray[2] && bytes[indexByte + 3] == signatureArray[3]) {
        return {
          offset: offset + indexByte,
          buffer: bytes.slice(indexByte, indexByte + minimumBytes).buffer
        };
      }
    }
  }
}
function getOptionValue(zipReader, options, name) {
  return options[name] === UNDEFINED_VALUE ? zipReader.options[name] : options[name];
}
function getDate(timeRaw) {
  const date = (timeRaw & 4294901760) >> 16, time = timeRaw & 65535;
  try {
    return new Date(1980 + ((date & 65024) >> 9), ((date & 480) >> 5) - 1, date & 31, (time & 63488) >> 11, (time & 2016) >> 5, (time & 31) * 2, 0);
  } catch (_error) {
  }
}
function getDateNTFS(timeRaw) {
  return new Date(Number(timeRaw / BigInt(1e4) - BigInt(116444736e5)));
}
function getUint8(view, offset) {
  return view.getUint8(offset);
}
function getUint16(view, offset) {
  return view.getUint16(offset, true);
}
function getUint32(view, offset) {
  return view.getUint32(offset, true);
}
function getBigUint64(view, offset) {
  return Number(view.getBigUint64(offset, true));
}
function setUint32(view, offset, value) {
  view.setUint32(offset, value, true);
}
function getDataView(array) {
  return new DataView(array.buffer);
}
configure({ Inflate: ZipInflate });
const zipImport = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  BlobReader,
  BlobWriter,
  Data64URIReader,
  Data64URIWriter,
  ERR_BAD_FORMAT,
  ERR_CENTRAL_DIRECTORY_NOT_FOUND,
  ERR_ENCRYPTED,
  ERR_EOCDR_LOCATOR_ZIP64_NOT_FOUND,
  ERR_EOCDR_NOT_FOUND,
  ERR_EOCDR_ZIP64_NOT_FOUND,
  ERR_EXTRAFIELD_ZIP64_NOT_FOUND,
  ERR_HTTP_RANGE,
  ERR_INVALID_PASSWORD,
  ERR_INVALID_SIGNATURE,
  ERR_ITERATOR_COMPLETED_TOO_SOON,
  ERR_LOCAL_FILE_HEADER_NOT_FOUND,
  ERR_SPLIT_ZIP_FILE,
  ERR_UNSUPPORTED_COMPRESSION,
  ERR_UNSUPPORTED_ENCRYPTION,
  HttpRangeReader,
  HttpReader,
  Reader,
  SplitDataReader,
  SplitDataWriter,
  SplitZipReader,
  SplitZipWriter,
  TextReader,
  TextWriter,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  Writer,
  ZipReader,
  configure,
  getMimeType,
  initReader,
  initStream,
  initWriter,
  readUint8Array,
  terminateWorkers
}, Symbol.toStringTag, { value: "Module" }));
const zipjs = zipImport;
class ZipTraceModelBackend {
  constructor(traceURL, server, progress) {
    __publicField(this, "_zipReader");
    __publicField(this, "_entriesPromise");
    __publicField(this, "_traceURL");
    this._traceURL = traceURL;
    zipjs.configure({ baseURL: self.location.href });
    this._zipReader = new zipjs.ZipReader(
      new zipjs.HttpReader(formatUrl(traceURL, server), { mode: "cors", preventHeadRequest: true }),
      { useWebWorkers: false }
    );
    this._entriesPromise = this._zipReader.getEntries({ onprogress: progress }).then((entries) => {
      const map = /* @__PURE__ */ new Map();
      for (const entry of entries)
        map.set(entry.filename, entry);
      return map;
    });
  }
  isLive() {
    return false;
  }
  traceURL() {
    return this._traceURL;
  }
  async entryNames() {
    const entries = await this._entriesPromise;
    return [...entries.keys()];
  }
  async hasEntry(entryName) {
    const entries = await this._entriesPromise;
    return entries.has(entryName);
  }
  async readText(entryName) {
    var _a;
    const entries = await this._entriesPromise;
    const entry = entries.get(entryName);
    if (!entry)
      return;
    const writer = new zipjs.TextWriter();
    await ((_a = entry.getData) == null ? void 0 : _a.call(entry, writer));
    return writer.getData();
  }
  async readBlob(entryName) {
    const entries = await this._entriesPromise;
    const entry = entries.get(entryName);
    if (!entry)
      return;
    const writer = new zipjs.BlobWriter();
    await entry.getData(writer);
    return writer.getData();
  }
}
class FetchTraceModelBackend {
  constructor(path, server) {
    __publicField(this, "_entriesPromise");
    __publicField(this, "_path");
    __publicField(this, "_server");
    this._path = path;
    this._server = server;
    this._entriesPromise = server.readFile(path).then(async (response) => {
      if (!response)
        throw new Error("File not found");
      const json = await response.json();
      const entries = /* @__PURE__ */ new Map();
      for (const entry of json.entries)
        entries.set(entry.name, entry.path);
      return entries;
    });
  }
  isLive() {
    return true;
  }
  traceURL() {
    return this._path;
  }
  async entryNames() {
    const entries = await this._entriesPromise;
    return [...entries.keys()];
  }
  async hasEntry(entryName) {
    const entries = await this._entriesPromise;
    return entries.has(entryName);
  }
  async readText(entryName) {
    const response = await this._readEntry(entryName);
    return response == null ? void 0 : response.text();
  }
  async readBlob(entryName) {
    const response = await this._readEntry(entryName);
    return (response == null ? void 0 : response.status) === 200 ? await (response == null ? void 0 : response.blob()) : void 0;
  }
  async _readEntry(entryName) {
    const entries = await this._entriesPromise;
    const fileName = entries.get(entryName);
    if (!fileName)
      return;
    return this._server.readFile(fileName);
  }
}
function formatUrl(trace, server) {
  let url = trace.startsWith("http") || trace.startsWith("blob") ? trace : server.getFileURL(trace).toString();
  if (url.startsWith("https://www.dropbox.com/"))
    url = "https://dl.dropboxusercontent.com/" + url.substring("https://www.dropbox.com/".length);
  return url;
}
class TraceViewerServer {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  getFileURL(path) {
    const url = new URL("trace/file", this.baseUrl);
    url.searchParams.set("path", path);
    return url;
  }
  async readFile(path) {
    const response = await fetch(this.getFileURL(path));
    if (response.status === 404)
      return;
    return response;
  }
}
self.addEventListener("install", function(event) {
  self.skipWaiting();
});
self.addEventListener("activate", function(event) {
  event.waitUntil(self.clients.claim());
});
const scopePath = new URL(self.registration.scope).pathname;
const loadedTraces = /* @__PURE__ */ new Map();
const clientIdToTraceUrls = /* @__PURE__ */ new Map();
async function loadTrace(traceUrl, traceFileName, client, limit, progress) {
  var _a;
  await gc();
  const clientId = (client == null ? void 0 : client.id) ?? "";
  let data = clientIdToTraceUrls.get(clientId);
  if (!data) {
    let traceViewerServerBaseUrl = self.registration.scope;
    if (client == null ? void 0 : client.url) {
      const clientUrl = new URL(client.url);
      if (clientUrl.searchParams.has("server"))
        traceViewerServerBaseUrl = clientUrl.searchParams.get("server");
    }
    data = { limit, traceUrls: /* @__PURE__ */ new Set(), traceViewerServer: new TraceViewerServer(traceViewerServerBaseUrl) };
    clientIdToTraceUrls.set(clientId, data);
  }
  data.traceUrls.add(traceUrl);
  const traceModel = new TraceModel();
  try {
    const [fetchProgress, unzipProgress] = splitProgress(progress, [0.5, 0.4, 0.1]);
    const backend = traceUrl.endsWith("json") ? new FetchTraceModelBackend(traceUrl, data.traceViewerServer) : new ZipTraceModelBackend(traceUrl, data.traceViewerServer, fetchProgress);
    await traceModel.load(backend, unzipProgress);
  } catch (error) {
    console.error(error);
    if (((_a = error == null ? void 0 : error.message) == null ? void 0 : _a.includes("Cannot find .trace file")) && await traceModel.hasEntry("index.html"))
      throw new Error("Could not load trace. Did you upload a Playwright HTML report instead? Make sure to extract the archive first and then double-click the index.html file or put it on a web server.");
    if (error instanceof TraceVersionError)
      throw new Error(`Could not load trace from ${traceFileName || traceUrl}. ${error.message}`);
    if (traceFileName)
      throw new Error(`Could not load trace from ${traceFileName}. Make sure to upload a valid Playwright trace.`);
    throw new Error(`Could not load trace from ${traceUrl}. Make sure a valid Playwright Trace is accessible over this url.`);
  }
  const snapshotServer = new SnapshotServer(traceModel.storage(), (sha1) => traceModel.resourceForSha1(sha1));
  loadedTraces.set(traceUrl, { traceModel, snapshotServer });
  return traceModel;
}
async function doFetch(event) {
  var _a;
  if (event.request.url.startsWith("chrome-extension://"))
    return fetch(event.request);
  const request = event.request;
  const client = await self.clients.get(event.clientId);
  const isDeployedAsHttps = self.registration.scope.startsWith("https://");
  if (request.url.startsWith(self.registration.scope)) {
    const url = new URL(unwrapPopoutUrl(request.url));
    const relativePath = url.pathname.substring(scopePath.length - 1);
    if (relativePath === "/ping") {
      await gc();
      return new Response(null, { status: 200 });
    }
    const traceUrl2 = url.searchParams.get("trace");
    if (relativePath === "/contexts") {
      try {
        const limit = url.searchParams.has("limit") ? +url.searchParams.get("limit") : void 0;
        const traceModel = await loadTrace(traceUrl2, url.searchParams.get("traceFileName"), client, limit, (done, total) => {
          client.postMessage({ method: "progress", params: { done, total } });
        });
        return new Response(JSON.stringify(traceModel.contextEntries), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error == null ? void 0 : error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
    if (relativePath.startsWith("/snapshotInfo/")) {
      const { snapshotServer: snapshotServer2 } = loadedTraces.get(traceUrl2) || {};
      if (!snapshotServer2)
        return new Response(null, { status: 404 });
      return snapshotServer2.serveSnapshotInfo(relativePath, url.searchParams);
    }
    if (relativePath.startsWith("/snapshot/")) {
      const { snapshotServer: snapshotServer2 } = loadedTraces.get(traceUrl2) || {};
      if (!snapshotServer2)
        return new Response(null, { status: 404 });
      const response = snapshotServer2.serveSnapshot(relativePath, url.searchParams, url.href);
      if (isDeployedAsHttps)
        response.headers.set("Content-Security-Policy", "upgrade-insecure-requests");
      return response;
    }
    if (relativePath.startsWith("/closest-screenshot/")) {
      const { snapshotServer: snapshotServer2 } = loadedTraces.get(traceUrl2) || {};
      if (!snapshotServer2)
        return new Response(null, { status: 404 });
      return snapshotServer2.serveClosestScreenshot(relativePath, url.searchParams);
    }
    if (relativePath.startsWith("/sha1/")) {
      const sha1 = relativePath.slice("/sha1/".length);
      for (const trace of loadedTraces.values()) {
        const blob = await trace.traceModel.resourceForSha1(sha1);
        if (blob)
          return new Response(blob, { status: 200, headers: downloadHeaders(url.searchParams) });
      }
      return new Response(null, { status: 404 });
    }
    if (relativePath.startsWith("/file/")) {
      const path = url.searchParams.get("path");
      const traceViewerServer = (_a = clientIdToTraceUrls.get(event.clientId ?? "")) == null ? void 0 : _a.traceViewerServer;
      if (!traceViewerServer)
        throw new Error("client is not initialized");
      const response = await traceViewerServer.readFile(path);
      if (!response)
        return new Response(null, { status: 404 });
      return response;
    }
    return fetch(event.request);
  }
  const snapshotUrl = unwrapPopoutUrl(client.url);
  const traceUrl = new URL(snapshotUrl).searchParams.get("trace");
  const { snapshotServer } = loadedTraces.get(traceUrl) || {};
  if (!snapshotServer)
    return new Response(null, { status: 404 });
  const lookupUrls = [request.url];
  if (isDeployedAsHttps && request.url.startsWith("https://"))
    lookupUrls.push(request.url.replace(/^https/, "http"));
  return snapshotServer.serveResource(lookupUrls, request.method, snapshotUrl);
}
function downloadHeaders(searchParams) {
  const name = searchParams.get("dn");
  const contentType = searchParams.get("dct");
  if (!name)
    return;
  const headers = new Headers();
  headers.set("Content-Disposition", `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(name)}`);
  if (contentType)
    headers.set("Content-Type", contentType);
  return headers;
}
async function gc() {
  const clients = await self.clients.matchAll();
  const usedTraces = /* @__PURE__ */ new Set();
  for (const [clientId, data] of clientIdToTraceUrls) {
    if (!clients.find((c) => c.id === clientId)) {
      clientIdToTraceUrls.delete(clientId);
      continue;
    }
    if (data.limit !== void 0) {
      const ordered = [...data.traceUrls];
      data.traceUrls = new Set(ordered.slice(ordered.length - data.limit));
    }
    data.traceUrls.forEach((url) => usedTraces.add(url));
  }
  for (const traceUrl of loadedTraces.keys()) {
    if (!usedTraces.has(traceUrl))
      loadedTraces.delete(traceUrl);
  }
}
self.addEventListener("fetch", function(event) {
  event.respondWith(doFetch(event));
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3cuYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvc3cvcHJvZ3Jlc3MudHMiLCIuLi8uLi9wbGF5d3JpZ2h0LWNvcmUvc3JjL3V0aWxzL2lzb21vcnBoaWMvc3RyaW5nVXRpbHMudHMiLCIuLi9zcmMvc3cvc25hcHNob3RSZW5kZXJlci50cyIsIi4uL3NyYy9zdy9zbmFwc2hvdFNlcnZlci50cyIsIi4uLy4uL3BsYXl3cmlnaHQtY29yZS9zcmMvdXRpbHMvaXNvbW9ycGhpYy90cmFjZVV0aWxzLnRzIiwiLi4vc3JjL3N3L2xydUNhY2hlLnRzIiwiLi4vc3JjL3N3L3NuYXBzaG90U3RvcmFnZS50cyIsIi4uL3NyYy9zdy90cmFjZU1vZGVybml6ZXIudHMiLCIuLi9zcmMvc3cvdHJhY2VNb2RlbC50cyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9AemlwLmpzL3ppcC5qcy9saWIvY29yZS9zdHJlYW1zL2NvZGVjcy9pbmZsYXRlLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0B6aXAuanMvemlwLmpzL2xpYi9jb3JlL2NvbnN0YW50cy5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9AemlwLmpzL3ppcC5qcy9saWIvY29yZS9zdHJlYW1zL3N0cmVhbS1hZGFwdGVyLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0B6aXAuanMvemlwLmpzL2xpYi9jb3JlL2NvbmZpZ3VyYXRpb24uanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHppcC5qcy96aXAuanMvbGliL2NvcmUvdXRpbC9kZWZhdWx0LW1pbWUtdHlwZS5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9AemlwLmpzL3ppcC5qcy9saWIvY29yZS9zdHJlYW1zL2NvZGVjcy9jcmMzMi5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9AemlwLmpzL3ppcC5qcy9saWIvY29yZS9zdHJlYW1zL2NyYzMyLXN0cmVhbS5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9AemlwLmpzL3ppcC5qcy9saWIvY29yZS91dGlsL2VuY29kZS10ZXh0LmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0B6aXAuanMvemlwLmpzL2xpYi9jb3JlL3N0cmVhbXMvY29kZWNzL3NqY2wuanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHppcC5qcy96aXAuanMvbGliL2NvcmUvc3RyZWFtcy9jb21tb24tY3J5cHRvLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0B6aXAuanMvemlwLmpzL2xpYi9jb3JlL3N0cmVhbXMvYWVzLWNyeXB0by1zdHJlYW0uanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHppcC5qcy96aXAuanMvbGliL2NvcmUvc3RyZWFtcy96aXAtY3J5cHRvLXN0cmVhbS5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9AemlwLmpzL3ppcC5qcy9saWIvY29yZS9zdHJlYW1zL3ppcC1lbnRyeS1zdHJlYW0uanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHppcC5qcy96aXAuanMvbGliL2NvcmUvc3RyZWFtcy9jb2RlYy1zdHJlYW0uanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHppcC5qcy96aXAuanMvbGliL2NvcmUvY29kZWMtd29ya2VyLmpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0B6aXAuanMvemlwLmpzL2xpYi9jb3JlL2NvZGVjLXBvb2wuanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHppcC5qcy96aXAuanMvbGliL2NvcmUvaW8uanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHppcC5qcy96aXAuanMvbGliL2NvcmUvdXRpbC9jcDQzNy1kZWNvZGUuanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHppcC5qcy96aXAuanMvbGliL2NvcmUvdXRpbC9kZWNvZGUtdGV4dC5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9AemlwLmpzL3ppcC5qcy9saWIvY29yZS96aXAtZW50cnkuanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvQHppcC5qcy96aXAuanMvbGliL2NvcmUvemlwLXJlYWRlci5qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy9AemlwLmpzL3ppcC5qcy9saWIvemlwLW5vLXdvcmtlci1pbmZsYXRlLmpzIiwiLi4vc3JjL3N3L3RyYWNlTW9kZWxCYWNrZW5kcy50cyIsIi4uL3NyYy9zdy9tYWluLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbnR5cGUgUHJvZ3Jlc3MgPSAoZG9uZTogbnVtYmVyLCB0b3RhbDogbnVtYmVyKSA9PiB1bmRlZmluZWQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBzcGxpdFByb2dyZXNzKHByb2dyZXNzOiBQcm9ncmVzcywgd2VpZ2h0czogbnVtYmVyW10pOiBQcm9ncmVzc1tdIHtcbiAgY29uc3QgZG9uZUxpc3QgPSBuZXcgQXJyYXkod2VpZ2h0cy5sZW5ndGgpLmZpbGwoMCk7XG4gIHJldHVybiBuZXcgQXJyYXkod2VpZ2h0cy5sZW5ndGgpLmZpbGwoMCkubWFwKChfLCBpKSA9PiB7XG4gICAgcmV0dXJuIChkb25lOiBudW1iZXIsIHRvdGFsOiBudW1iZXIpID0+IHtcbiAgICAgIGRvbmVMaXN0W2ldID0gZG9uZSAvIHRvdGFsICogd2VpZ2h0c1tpXSAqIDEwMDA7XG4gICAgICBwcm9ncmVzcyhkb25lTGlzdC5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKSwgMTAwMCk7XG4gICAgfTtcbiAgfSk7XG59XG4iLCIvKipcbiAqIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbi8vIE5PVEU6IHRoaXMgZnVuY3Rpb24gc2hvdWxkIG5vdCBiZSB1c2VkIHRvIGVzY2FwZSBhbnkgc2VsZWN0b3JzLlxuZXhwb3J0IGZ1bmN0aW9uIGVzY2FwZVdpdGhRdW90ZXModGV4dDogc3RyaW5nLCBjaGFyOiBzdHJpbmcgPSAnXFwnJykge1xuICBjb25zdCBzdHJpbmdpZmllZCA9IEpTT04uc3RyaW5naWZ5KHRleHQpO1xuICBjb25zdCBlc2NhcGVkVGV4dCA9IHN0cmluZ2lmaWVkLnN1YnN0cmluZygxLCBzdHJpbmdpZmllZC5sZW5ndGggLSAxKS5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJyk7XG4gIGlmIChjaGFyID09PSAnXFwnJylcbiAgICByZXR1cm4gY2hhciArIGVzY2FwZWRUZXh0LnJlcGxhY2UoL1snXS9nLCAnXFxcXFxcJycpICsgY2hhcjtcbiAgaWYgKGNoYXIgPT09ICdcIicpXG4gICAgcmV0dXJuIGNoYXIgKyBlc2NhcGVkVGV4dC5yZXBsYWNlKC9bXCJdL2csICdcXFxcXCInKSArIGNoYXI7XG4gIGlmIChjaGFyID09PSAnYCcpXG4gICAgcmV0dXJuIGNoYXIgKyBlc2NhcGVkVGV4dC5yZXBsYWNlKC9bYF0vZywgJ2AnKSArIGNoYXI7XG4gIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBlc2NhcGUgY2hhcicpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlVGVtcGxhdGVTdHJpbmcodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRleHRcbiAgICAgIC5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpXG4gICAgICAucmVwbGFjZSgvYC9nLCAnXFxcXGAnKVxuICAgICAgLnJlcGxhY2UoL1xcJFxcey9nLCAnXFxcXCR7Jyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1N0cmluZyhvYmo6IGFueSk6IG9iaiBpcyBzdHJpbmcge1xuICByZXR1cm4gdHlwZW9mIG9iaiA9PT0gJ3N0cmluZycgfHwgb2JqIGluc3RhbmNlb2YgU3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9UaXRsZUNhc2UobmFtZTogc3RyaW5nKSB7XG4gIHJldHVybiBuYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgbmFtZS5zdWJzdHJpbmcoMSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b1NuYWtlQ2FzZShuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyBFLmcuIGlnbm9yZUhUVFBTRXJyb3JzID0+IGlnbm9yZV9odHRwc19lcnJvcnMuXG4gIHJldHVybiBuYW1lLnJlcGxhY2UoLyhbYS16MC05XSkoW0EtWl0pL2csICckMV8kMicpLnJlcGxhY2UoLyhbQS1aXSkoW0EtWl1bYS16XSkvZywgJyQxXyQyJykudG9Mb3dlckNhc2UoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNzc0VzY2FwZShzOiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgcmVzdWx0ID0gJyc7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcy5sZW5ndGg7IGkrKylcbiAgICByZXN1bHQgKz0gY3NzRXNjYXBlT25lKHMsIGkpO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcXVvdGVDU1NBdHRyaWJ1dGVWYWx1ZSh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYFwiJHtjc3NFc2NhcGUodGV4dCkucmVwbGFjZSgvXFxcXCAvZywgJyAnKX1cImA7XG59XG5cbmZ1bmN0aW9uIGNzc0VzY2FwZU9uZShzOiBzdHJpbmcsIGk6IG51bWJlcik6IHN0cmluZyB7XG4gIC8vIGh0dHBzOi8vZHJhZnRzLmNzc3dnLm9yZy9jc3NvbS8jc2VyaWFsaXplLWFuLWlkZW50aWZpZXJcbiAgY29uc3QgYyA9IHMuY2hhckNvZGVBdChpKTtcbiAgaWYgKGMgPT09IDB4MDAwMClcbiAgICByZXR1cm4gJ1xcdUZGRkQnO1xuICBpZiAoKGMgPj0gMHgwMDAxICYmIGMgPD0gMHgwMDFmKSB8fFxuICAgICAgKGMgPj0gMHgwMDMwICYmIGMgPD0gMHgwMDM5ICYmIChpID09PSAwIHx8IChpID09PSAxICYmIHMuY2hhckNvZGVBdCgwKSA9PT0gMHgwMDJkKSkpKVxuICAgIHJldHVybiAnXFxcXCcgKyBjLnRvU3RyaW5nKDE2KSArICcgJztcbiAgaWYgKGkgPT09IDAgJiYgYyA9PT0gMHgwMDJkICYmIHMubGVuZ3RoID09PSAxKVxuICAgIHJldHVybiAnXFxcXCcgKyBzLmNoYXJBdChpKTtcbiAgaWYgKGMgPj0gMHgwMDgwIHx8IGMgPT09IDB4MDAyZCB8fCBjID09PSAweDAwNWYgfHwgKGMgPj0gMHgwMDMwICYmIGMgPD0gMHgwMDM5KSB8fFxuICAgICAgKGMgPj0gMHgwMDQxICYmIGMgPD0gMHgwMDVhKSB8fCAoYyA+PSAweDAwNjEgJiYgYyA8PSAweDAwN2EpKVxuICAgIHJldHVybiBzLmNoYXJBdChpKTtcbiAgcmV0dXJuICdcXFxcJyArIHMuY2hhckF0KGkpO1xufVxuXG5sZXQgbm9ybWFsaXplZFdoaXRlc3BhY2VDYWNoZTogTWFwPHN0cmluZywgc3RyaW5nPiB8IHVuZGVmaW5lZDtcblxuZXhwb3J0IGZ1bmN0aW9uIGNhY2hlTm9ybWFsaXplZFdoaXRlc3BhY2VzKCkge1xuICBub3JtYWxpemVkV2hpdGVzcGFjZUNhY2hlID0gbmV3IE1hcCgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplV2hpdGVTcGFjZSh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgcmVzdWx0ID0gbm9ybWFsaXplZFdoaXRlc3BhY2VDYWNoZT8uZ2V0KHRleHQpO1xuICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICByZXN1bHQgPSB0ZXh0LnJlcGxhY2UoL1xcdTIwMGIvZywgJycpLnRyaW0oKS5yZXBsYWNlKC9cXHMrL2csICcgJyk7XG4gICAgbm9ybWFsaXplZFdoaXRlc3BhY2VDYWNoZT8uc2V0KHRleHQsIHJlc3VsdCk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUVzY2FwZWRSZWdleFF1b3Rlcyhzb3VyY2U6IHN0cmluZykge1xuICAvLyBUaGlzIGZ1bmN0aW9uIHJldmVyc2VzIHRoZSBlZmZlY3Qgb2YgZXNjYXBlUmVnZXhGb3JTZWxlY3RvciBiZWxvdy5cbiAgLy8gT2RkIG51bWJlciBvZiBiYWNrc2xhc2hlcyBmb2xsb3dlZCBieSB0aGUgcXVvdGUgLT4gcmVtb3ZlIHVubmVlZGVkIGJhY2tzbGFzaC5cbiAgcmV0dXJuIHNvdXJjZS5yZXBsYWNlKC8oXnxbXlxcXFxdKShcXFxcXFxcXCkqXFxcXChbJ1wiYF0pL2csICckMSQyJDMnKTtcbn1cblxuZnVuY3Rpb24gZXNjYXBlUmVnZXhGb3JTZWxlY3RvcihyZTogUmVnRXhwKTogc3RyaW5nIHtcbiAgLy8gVW5pY29kZSBtb2RlIGRvZXMgbm90IGFsbG93IFwiaWRlbnRpdHkgY2hhcmFjdGVyIGVzY2FwZXNcIiwgc28gd2UgZG8gbm90IGVzY2FwZSBhbmRcbiAgLy8gaG9wZSB0aGF0IGl0IGRvZXMgbm90IGNvbnRhaW4gcXVvdGVzIGFuZC9vciA+PiBzaWducy5cbiAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvUmVndWxhcl9leHByZXNzaW9ucy9DaGFyYWN0ZXJfZXNjYXBlXG4gIC8vIFRPRE86IHJld29yayBSRSB1c2FnZXMgaW4gaW50ZXJuYWwgc2VsZWN0b3JzIGF3YXkgZnJvbSBsaXRlcmFsIHJlcHJlc2VudGF0aW9uIHRvIGpzb24sIGUuZy4ge3NvdXJjZSxmbGFnc30uXG4gIGlmIChyZS51bmljb2RlIHx8IChyZSBhcyBhbnkpLnVuaWNvZGVTZXRzKVxuICAgIHJldHVybiBTdHJpbmcocmUpO1xuICAvLyBFdmVuIG51bWJlciBvZiBiYWNrc2xhc2hlcyBmb2xsb3dlZCBieSB0aGUgcXVvdGUgLT4gaW5zZXJ0IGEgYmFja3NsYXNoLlxuICByZXR1cm4gU3RyaW5nKHJlKS5yZXBsYWNlKC8oXnxbXlxcXFxdKShcXFxcXFxcXCkqKFtcIidgXSkvZywgJyQxJDJcXFxcJDMnKS5yZXBsYWNlKC8+Pi9nLCAnXFxcXD5cXFxcPicpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlRm9yVGV4dFNlbGVjdG9yKHRleHQ6IHN0cmluZyB8IFJlZ0V4cCwgZXhhY3Q6IGJvb2xlYW4pOiBzdHJpbmcge1xuICBpZiAodHlwZW9mIHRleHQgIT09ICdzdHJpbmcnKVxuICAgIHJldHVybiBlc2NhcGVSZWdleEZvclNlbGVjdG9yKHRleHQpO1xuICByZXR1cm4gYCR7SlNPTi5zdHJpbmdpZnkodGV4dCl9JHtleGFjdCA/ICdzJyA6ICdpJ31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlRm9yQXR0cmlidXRlU2VsZWN0b3IodmFsdWU6IHN0cmluZyB8IFJlZ0V4cCwgZXhhY3Q6IGJvb2xlYW4pOiBzdHJpbmcge1xuICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJylcbiAgICByZXR1cm4gZXNjYXBlUmVnZXhGb3JTZWxlY3Rvcih2YWx1ZSk7XG4gIC8vIFRPRE86IHRoaXMgc2hvdWxkIGFjdHVhbGx5IGJlXG4gIC8vICAgY3NzRXNjYXBlKHZhbHVlKS5yZXBsYWNlKC9cXFxcIC9nLCAnICcpXG4gIC8vIEhvd2V2ZXIsIG91ciBhdHRyaWJ1dGUgc2VsZWN0b3JzIGRvIG5vdCBjb25mb3JtIHRvIENTUyBwYXJzaW5nIHNwZWMsXG4gIC8vIHNvIHdlIGVzY2FwZSB0aGVtIGRpZmZlcmVudGx5LlxuICByZXR1cm4gYFwiJHt2YWx1ZS5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpLnJlcGxhY2UoL1tcIl0vZywgJ1xcXFxcIicpfVwiJHtleGFjdCA/ICdzJyA6ICdpJ31gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJpbVN0cmluZyhpbnB1dDogc3RyaW5nLCBjYXA6IG51bWJlciwgc3VmZml4OiBzdHJpbmcgPSAnJyk6IHN0cmluZyB7XG4gIGlmIChpbnB1dC5sZW5ndGggPD0gY2FwKVxuICAgIHJldHVybiBpbnB1dDtcbiAgY29uc3QgY2hhcnMgPSBbLi4uaW5wdXRdO1xuICBpZiAoY2hhcnMubGVuZ3RoID4gY2FwKVxuICAgIHJldHVybiBjaGFycy5zbGljZSgwLCBjYXAgLSBzdWZmaXgubGVuZ3RoKS5qb2luKCcnKSArIHN1ZmZpeDtcbiAgcmV0dXJuIGNoYXJzLmpvaW4oJycpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJpbVN0cmluZ1dpdGhFbGxpcHNpcyhpbnB1dDogc3RyaW5nLCBjYXA6IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiB0cmltU3RyaW5nKGlucHV0LCBjYXAsICdcXHUyMDI2Jyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVSZWdFeHAoczogc3RyaW5nKSB7XG4gIC8vIEZyb20gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9HdWlkZS9SZWd1bGFyX0V4cHJlc3Npb25zI2VzY2FwaW5nXG4gIHJldHVybiBzLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyk7IC8vICQmIG1lYW5zIHRoZSB3aG9sZSBtYXRjaGVkIHN0cmluZ1xufVxuXG5jb25zdCBlc2NhcGVkID0geyAnJic6ICcmYW1wOycsICc8JzogJyZsdDsnLCAnPic6ICcmZ3Q7JywgJ1wiJzogJyZxdW90OycsICdcXCcnOiAnJiMzOTsnIH07XG5leHBvcnQgZnVuY3Rpb24gZXNjYXBlSFRNTEF0dHJpYnV0ZShzOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gcy5yZXBsYWNlKC9bJjw+XCInXS91ZywgY2hhciA9PiAoZXNjYXBlZCBhcyBhbnkpW2NoYXJdKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBlc2NhcGVIVE1MKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzLnJlcGxhY2UoL1smPF0vdWcsIGNoYXIgPT4gKGVzY2FwZWQgYXMgYW55KVtjaGFyXSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb25nZXN0Q29tbW9uU3Vic3RyaW5nKHMxOiBzdHJpbmcsIHMyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBuID0gczEubGVuZ3RoO1xuICBjb25zdCBtID0gczIubGVuZ3RoO1xuICBsZXQgbWF4TGVuID0gMDtcbiAgbGV0IGVuZGluZ0luZGV4ID0gMDtcblxuICAvLyBJbml0aWFsaXplIGEgMkQgYXJyYXkgd2l0aCB6ZXJvc1xuICBjb25zdCBkcCA9IEFycmF5KG4gKyAxKVxuICAgICAgLmZpbGwobnVsbClcbiAgICAgIC5tYXAoKCkgPT4gQXJyYXkobSArIDEpLmZpbGwoMCkpO1xuXG4gIC8vIEJ1aWxkIHRoZSBkcCB0YWJsZVxuICBmb3IgKGxldCBpID0gMTsgaSA8PSBuOyBpKyspIHtcbiAgICBmb3IgKGxldCBqID0gMTsgaiA8PSBtOyBqKyspIHtcbiAgICAgIGlmIChzMVtpIC0gMV0gPT09IHMyW2ogLSAxXSkge1xuICAgICAgICBkcFtpXVtqXSA9IGRwW2kgLSAxXVtqIC0gMV0gKyAxO1xuXG4gICAgICAgIGlmIChkcFtpXVtqXSA+IG1heExlbikge1xuICAgICAgICAgIG1heExlbiA9IGRwW2ldW2pdO1xuICAgICAgICAgIGVuZGluZ0luZGV4ID0gaTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEV4dHJhY3QgdGhlIGxvbmdlc3QgY29tbW9uIHN1YnN0cmluZ1xuICByZXR1cm4gczEuc2xpY2UoZW5kaW5nSW5kZXggLSBtYXhMZW4sIGVuZGluZ0luZGV4KTtcbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbmltcG9ydCB7IGVzY2FwZUhUTUxBdHRyaWJ1dGUsIGVzY2FwZUhUTUwgfSBmcm9tICdAaXNvbW9ycGhpYy9zdHJpbmdVdGlscyc7XG5pbXBvcnQgdHlwZSB7IEZyYW1lU25hcHNob3QsIE5vZGVOYW1lQXR0cmlidXRlc0NoaWxkTm9kZXNTbmFwc2hvdCwgTm9kZVNuYXBzaG90LCBSZW5kZXJlZEZyYW1lU25hcHNob3QsIFJlc291cmNlU25hcHNob3QsIFN1YnRyZWVSZWZlcmVuY2VTbmFwc2hvdCB9IGZyb20gJ0B0cmFjZS9zbmFwc2hvdCc7XG5pbXBvcnQgdHlwZSB7IFBhZ2VFbnRyeSB9IGZyb20gJy4uL3R5cGVzL2VudHJpZXMnO1xuaW1wb3J0IHR5cGUgeyBMUlVDYWNoZSB9IGZyb20gJy4vbHJ1Q2FjaGUnO1xuXG5mdW5jdGlvbiBmaW5kQ2xvc2VzdDxUPihpdGVtczogVFtdLCBtZXRyaWM6ICh2OiBUKSA9PiBudW1iZXIsIHRhcmdldDogbnVtYmVyKSB7XG4gIHJldHVybiBpdGVtcy5maW5kKChpdGVtLCBpbmRleCkgPT4ge1xuICAgIGlmIChpbmRleCA9PT0gaXRlbXMubGVuZ3RoIC0gMSlcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IG5leHQgPSBpdGVtc1tpbmRleCArIDFdO1xuICAgIHJldHVybiBNYXRoLmFicyhtZXRyaWMoaXRlbSkgLSB0YXJnZXQpIDwgTWF0aC5hYnMobWV0cmljKG5leHQpIC0gdGFyZ2V0KTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGlzTm9kZU5hbWVBdHRyaWJ1dGVzQ2hpbGROb2Rlc1NuYXBzaG90KG46IE5vZGVTbmFwc2hvdCk6IG4gaXMgTm9kZU5hbWVBdHRyaWJ1dGVzQ2hpbGROb2Rlc1NuYXBzaG90IHtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkobikgJiYgdHlwZW9mIG5bMF0gPT09ICdzdHJpbmcnO1xufVxuXG5mdW5jdGlvbiBpc1N1YnRyZWVSZWZlcmVuY2VTbmFwc2hvdChuOiBOb2RlU25hcHNob3QpOiBuIGlzIFN1YnRyZWVSZWZlcmVuY2VTbmFwc2hvdCB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KG4pICYmIEFycmF5LmlzQXJyYXkoblswXSk7XG59XG5cbmV4cG9ydCBjbGFzcyBTbmFwc2hvdFJlbmRlcmVyIHtcbiAgcHJpdmF0ZSBfaHRtbENhY2hlOiBMUlVDYWNoZTxTbmFwc2hvdFJlbmRlcmVyLCBzdHJpbmc+O1xuICBwcml2YXRlIF9zbmFwc2hvdHM6IEZyYW1lU25hcHNob3RbXTtcbiAgcHJpdmF0ZSBfaW5kZXg6IG51bWJlcjtcbiAgcmVhZG9ubHkgc25hcHNob3ROYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX3Jlc291cmNlczogUmVzb3VyY2VTbmFwc2hvdFtdO1xuICBwcml2YXRlIF9zbmFwc2hvdDogRnJhbWVTbmFwc2hvdDtcbiAgcHJpdmF0ZSBfY2FsbElkOiBzdHJpbmc7XG4gIHByaXZhdGUgX3NjcmVlbmNhc3RGcmFtZXM6IFBhZ2VFbnRyeVsnc2NyZWVuY2FzdEZyYW1lcyddO1xuXG4gIGNvbnN0cnVjdG9yKGh0bWxDYWNoZTogTFJVQ2FjaGU8U25hcHNob3RSZW5kZXJlciwgc3RyaW5nPiwgcmVzb3VyY2VzOiBSZXNvdXJjZVNuYXBzaG90W10sIHNuYXBzaG90czogRnJhbWVTbmFwc2hvdFtdLCBzY3JlZW5jYXN0RnJhbWVzOiBQYWdlRW50cnlbJ3NjcmVlbmNhc3RGcmFtZXMnXSwgaW5kZXg6IG51bWJlcikge1xuICAgIHRoaXMuX2h0bWxDYWNoZSA9IGh0bWxDYWNoZTtcbiAgICB0aGlzLl9yZXNvdXJjZXMgPSByZXNvdXJjZXM7XG4gICAgdGhpcy5fc25hcHNob3RzID0gc25hcHNob3RzO1xuICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gICAgdGhpcy5fc25hcHNob3QgPSBzbmFwc2hvdHNbaW5kZXhdO1xuICAgIHRoaXMuX2NhbGxJZCA9IHNuYXBzaG90c1tpbmRleF0uY2FsbElkO1xuICAgIHRoaXMuX3NjcmVlbmNhc3RGcmFtZXMgPSBzY3JlZW5jYXN0RnJhbWVzO1xuICAgIHRoaXMuc25hcHNob3ROYW1lID0gc25hcHNob3RzW2luZGV4XS5zbmFwc2hvdE5hbWU7XG4gIH1cblxuICBzbmFwc2hvdCgpOiBGcmFtZVNuYXBzaG90IHtcbiAgICByZXR1cm4gdGhpcy5fc25hcHNob3RzW3RoaXMuX2luZGV4XTtcbiAgfVxuXG4gIHZpZXdwb3J0KCk6IHsgd2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIgfSB7XG4gICAgcmV0dXJuIHRoaXMuX3NuYXBzaG90c1t0aGlzLl9pbmRleF0udmlld3BvcnQ7XG4gIH1cblxuICBjbG9zZXN0U2NyZWVuc2hvdCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHsgd2FsbFRpbWUsIHRpbWVzdGFtcCB9ID0gdGhpcy5zbmFwc2hvdCgpO1xuICAgIGNvbnN0IGNsb3Nlc3RGcmFtZSA9ICh3YWxsVGltZSAmJiB0aGlzLl9zY3JlZW5jYXN0RnJhbWVzWzBdPy5mcmFtZVN3YXBXYWxsVGltZSlcbiAgICAgID8gZmluZENsb3Nlc3QodGhpcy5fc2NyZWVuY2FzdEZyYW1lcywgZnJhbWUgPT4gZnJhbWUuZnJhbWVTd2FwV2FsbFRpbWUhLCB3YWxsVGltZSlcbiAgICAgIDogZmluZENsb3Nlc3QodGhpcy5fc2NyZWVuY2FzdEZyYW1lcywgZnJhbWUgPT4gZnJhbWUudGltZXN0YW1wLCB0aW1lc3RhbXApO1xuICAgIHJldHVybiBjbG9zZXN0RnJhbWU/LnNoYTE7XG4gIH1cblxuICByZW5kZXIoKTogUmVuZGVyZWRGcmFtZVNuYXBzaG90IHtcbiAgICBjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgdmlzaXQgPSAobjogTm9kZVNuYXBzaG90LCBzbmFwc2hvdEluZGV4OiBudW1iZXIsIHBhcmVudFRhZzogc3RyaW5nIHwgdW5kZWZpbmVkLCBwYXJlbnRBdHRyczogW3N0cmluZywgc3RyaW5nXVtdIHwgdW5kZWZpbmVkKSA9PiB7XG4gICAgICAvLyBUZXh0IG5vZGUuXG4gICAgICBpZiAodHlwZW9mIG4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIC8vIEJlc3QtZWZmb3J0IEVsZWN0cm9uIHN1cHBvcnQ6IHJld3JpdGUgY3VzdG9tIHByb3RvY29sIGluIHVybCgpIGxpbmtzIGluIHN0eWxlc2hlZXRzLlxuICAgICAgICAvLyBPbGQgc25hcHNob3R0ZXIgd2FzIHNlbmRpbmcgbG93ZXItY2FzZS5cbiAgICAgICAgaWYgKHBhcmVudFRhZyA9PT0gJ1NUWUxFJyB8fCBwYXJlbnRUYWcgPT09ICdzdHlsZScpXG4gICAgICAgICAgcmVzdWx0LnB1c2gocmV3cml0ZVVSTHNJblN0eWxlU2hlZXRGb3JDdXN0b21Qcm90b2NvbChuKSk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICByZXN1bHQucHVzaChlc2NhcGVIVE1MKG4pKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNTdWJ0cmVlUmVmZXJlbmNlU25hcHNob3QobikpIHtcbiAgICAgICAgLy8gTm9kZSByZWZlcmVuY2UuXG4gICAgICAgIGNvbnN0IHJlZmVyZW5jZUluZGV4ID0gc25hcHNob3RJbmRleCAtIG5bMF1bMF07XG4gICAgICAgIGlmIChyZWZlcmVuY2VJbmRleCA+PSAwICYmIHJlZmVyZW5jZUluZGV4IDw9IHNuYXBzaG90SW5kZXgpIHtcbiAgICAgICAgICBjb25zdCBub2RlcyA9IHNuYXBzaG90Tm9kZXModGhpcy5fc25hcHNob3RzW3JlZmVyZW5jZUluZGV4XSk7XG4gICAgICAgICAgY29uc3Qgbm9kZUluZGV4ID0gblswXVsxXTtcbiAgICAgICAgICBpZiAobm9kZUluZGV4ID49IDAgJiYgbm9kZUluZGV4IDwgbm9kZXMubGVuZ3RoKVxuICAgICAgICAgICAgcmV0dXJuIHZpc2l0KG5vZGVzW25vZGVJbmRleF0sIHJlZmVyZW5jZUluZGV4LCBwYXJlbnRUYWcsIHBhcmVudEF0dHJzKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpc05vZGVOYW1lQXR0cmlidXRlc0NoaWxkTm9kZXNTbmFwc2hvdChuKSkge1xuICAgICAgICBjb25zdCBbbmFtZSwgbm9kZUF0dHJzLCAuLi5jaGlsZHJlbl0gPSBuO1xuICAgICAgICAvLyBFbGVtZW50IG5vZGUuXG4gICAgICAgIC8vIE5vdGUgdGhhdCA8bm9zY3JpcHQ+IHdpbGwgbm90IGJlIHJlbmRlcmVkIGJ5IGRlZmF1bHQgaW4gdGhlIHRyYWNlIHZpZXdlciwgYmVjYXVzZVxuICAgICAgICAvLyBKUyBpcyBlbmFibGVkLiBTbyByZW5hbWUgaXQgdG8gPHgtbm9zY3JpcHQ+LlxuICAgICAgICBjb25zdCBub2RlTmFtZSA9IG5hbWUgPT09ICdOT1NDUklQVCcgPyAnWC1OT1NDUklQVCcgOiBuYW1lO1xuICAgICAgICBjb25zdCBhdHRycyA9IE9iamVjdC5lbnRyaWVzKG5vZGVBdHRycyB8fCB7fSk7XG4gICAgICAgIHJlc3VsdC5wdXNoKCc8Jywgbm9kZU5hbWUpO1xuICAgICAgICBjb25zdCBrQ3VycmVudFNyY0F0dHJpYnV0ZSA9ICdfX3BsYXl3cmlnaHRfY3VycmVudF9zcmNfXyc7XG4gICAgICAgIGNvbnN0IGlzRnJhbWUgPSBub2RlTmFtZSA9PT0gJ0lGUkFNRScgfHwgbm9kZU5hbWUgPT09ICdGUkFNRSc7XG4gICAgICAgIGNvbnN0IGlzQW5jaG9yID0gbm9kZU5hbWUgPT09ICdBJztcbiAgICAgICAgY29uc3QgaXNJbWcgPSBub2RlTmFtZSA9PT0gJ0lNRyc7XG4gICAgICAgIGNvbnN0IGlzSW1nV2l0aEN1cnJlbnRTcmMgPSBpc0ltZyAmJiBhdHRycy5zb21lKGEgPT4gYVswXSA9PT0ga0N1cnJlbnRTcmNBdHRyaWJ1dGUpO1xuICAgICAgICBjb25zdCBpc1NvdXJjZUluc2lkZVBpY3R1cmVXaXRoQ3VycmVudFNyYyA9IG5vZGVOYW1lID09PSAnU09VUkNFJyAmJiBwYXJlbnRUYWcgPT09ICdQSUNUVVJFJyAmJiBwYXJlbnRBdHRycz8uc29tZShhID0+IGFbMF0gPT09IGtDdXJyZW50U3JjQXR0cmlidXRlKTtcbiAgICAgICAgZm9yIChjb25zdCBbYXR0ciwgdmFsdWVdIG9mIGF0dHJzKSB7XG4gICAgICAgICAgbGV0IGF0dHJOYW1lID0gYXR0cjtcbiAgICAgICAgICBpZiAoaXNGcmFtZSAmJiBhdHRyLnRvTG93ZXJDYXNlKCkgPT09ICdzcmMnKSB7XG4gICAgICAgICAgICAvLyBOZXZlciBzZXQgcmVsYXRpdmUgVVJMcyBhcyA8aWZyYW1lIHNyYz4gLSB0aGV5IHN0YXJ0IGZldGNoaW5nIGZyYW1lcyBpbW1lZGlhdGVseS5cbiAgICAgICAgICAgIGF0dHJOYW1lID0gJ19fcGxheXdyaWdodF9zcmNfXyc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChpc0ltZyAmJiBhdHRyID09PSBrQ3VycmVudFNyY0F0dHJpYnV0ZSkge1xuICAgICAgICAgICAgLy8gUmVuZGVyIGN1cnJlbnRTcmMgZm9yIGltYWdlcywgc28gdGhhdCB0cmFjZSB2aWV3ZXIgZG9lcyBub3QgYWNjaWRlbnRhbGx5XG4gICAgICAgICAgICAvLyByZXNvbHZlIHNyY3NldCB0byBhIGRpZmZlcmVudCBzb3VyY2UuXG4gICAgICAgICAgICBhdHRyTmFtZSA9ICdzcmMnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoWydzcmMnLCAnc3Jjc2V0J10uaW5jbHVkZXMoYXR0ci50b0xvd2VyQ2FzZSgpKSAmJiAoaXNJbWdXaXRoQ3VycmVudFNyYyB8fCBpc1NvdXJjZUluc2lkZVBpY3R1cmVXaXRoQ3VycmVudFNyYykpIHtcbiAgICAgICAgICAgIC8vIERpc2FibGUgYWN0dWFsIDxpbWcgc3JjPiwgPGltZyBzcmNzZXQ+LCA8c291cmNlIHNyYz4gYW5kIDxzb3VyY2Ugc3Jjc2V0PiBpZlxuICAgICAgICAgICAgLy8gd2Ugd2lsbCBiZSB1c2luZyB0aGUgY3VycmVudFNyYyBpbnN0ZWFkLlxuICAgICAgICAgICAgYXR0ck5hbWUgPSAnXycgKyBhdHRyTmFtZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgbGV0IGF0dHJWYWx1ZSA9IHZhbHVlO1xuICAgICAgICAgIGlmIChpc0FuY2hvciAmJiBhdHRyLnRvTG93ZXJDYXNlKCkgPT09ICdocmVmJylcbiAgICAgICAgICAgIGF0dHJWYWx1ZSA9ICdsaW5rOi8vJyArIHZhbHVlO1xuICAgICAgICAgIGVsc2UgaWYgKGF0dHIudG9Mb3dlckNhc2UoKSA9PT0gJ2hyZWYnIHx8IGF0dHIudG9Mb3dlckNhc2UoKSA9PT0gJ3NyYycgfHwgYXR0ciA9PT0ga0N1cnJlbnRTcmNBdHRyaWJ1dGUpXG4gICAgICAgICAgICBhdHRyVmFsdWUgPSByZXdyaXRlVVJMRm9yQ3VzdG9tUHJvdG9jb2wodmFsdWUpO1xuICAgICAgICAgIHJlc3VsdC5wdXNoKCcgJywgYXR0ck5hbWUsICc9XCInLCBlc2NhcGVIVE1MQXR0cmlidXRlKGF0dHJWYWx1ZSksICdcIicpO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC5wdXNoKCc+Jyk7XG4gICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgY2hpbGRyZW4pXG4gICAgICAgICAgdmlzaXQoY2hpbGQsIHNuYXBzaG90SW5kZXgsIG5vZGVOYW1lLCBhdHRycyk7XG4gICAgICAgIGlmICghYXV0b0Nsb3NpbmcuaGFzKG5vZGVOYW1lKSlcbiAgICAgICAgICByZXN1bHQucHVzaCgnPC8nLCBub2RlTmFtZSwgJz4nKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gV2h5IGFyZSB3ZSBoZXJlPyBMZXQncyBub3QgdGhyb3csIGp1c3QgaW4gY2FzZS5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBzbmFwc2hvdCA9IHRoaXMuX3NuYXBzaG90O1xuICAgIGNvbnN0IGh0bWwgPSB0aGlzLl9odG1sQ2FjaGUuZ2V0T3JDb21wdXRlKHRoaXMsICgpID0+IHtcbiAgICAgIHZpc2l0KHNuYXBzaG90Lmh0bWwsIHRoaXMuX2luZGV4LCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG4gICAgICBjb25zdCBwcmVmaXggPSBzbmFwc2hvdC5kb2N0eXBlID8gYDwhRE9DVFlQRSAke3NuYXBzaG90LmRvY3R5cGV9PmAgOiAnJztcbiAgICAgIGNvbnN0IGh0bWwgPSBwcmVmaXggKyBbXG4gICAgICAgIC8vIEhpZGUgdGhlIGRvY3VtZW50IGluIG9yZGVyIHRvIHByZXZlbnQgZmxpY2tlcmluZy4gV2Ugd2lsbCB1bmhpZGUgb25jZSBzY3JpcHQgaGFzIHByb2Nlc3NlZCBzaGFkb3cuXG4gICAgICAgICc8c3R5bGU+KiwqOjpiZWZvcmUsKjo6YWZ0ZXIgeyB2aXNpYmlsaXR5OiBoaWRkZW4gfTwvc3R5bGU+JyxcbiAgICAgICAgYDxzY3JpcHQ+JHtzbmFwc2hvdFNjcmlwdCh0aGlzLl9jYWxsSWQsIHRoaXMuc25hcHNob3ROYW1lKX08L3NjcmlwdD5gXG4gICAgICBdLmpvaW4oJycpICsgcmVzdWx0LmpvaW4oJycpO1xuICAgICAgcmV0dXJuIHsgdmFsdWU6IGh0bWwsIHNpemU6IGh0bWwubGVuZ3RoIH07XG4gICAgfSk7XG5cbiAgICByZXR1cm4geyBodG1sLCBwYWdlSWQ6IHNuYXBzaG90LnBhZ2VJZCwgZnJhbWVJZDogc25hcHNob3QuZnJhbWVJZCwgaW5kZXg6IHRoaXMuX2luZGV4IH07XG4gIH1cblxuICByZXNvdXJjZUJ5VXJsKHVybDogc3RyaW5nLCBtZXRob2Q6IHN0cmluZyk6IFJlc291cmNlU25hcHNob3QgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHNuYXBzaG90ID0gdGhpcy5fc25hcHNob3Q7XG4gICAgbGV0IHNhbWVGcmFtZVJlc291cmNlOiBSZXNvdXJjZVNuYXBzaG90IHwgdW5kZWZpbmVkO1xuICAgIGxldCBvdGhlckZyYW1lUmVzb3VyY2U6IFJlc291cmNlU25hcHNob3QgfCB1bmRlZmluZWQ7XG5cbiAgICBmb3IgKGNvbnN0IHJlc291cmNlIG9mIHRoaXMuX3Jlc291cmNlcykge1xuICAgICAgLy8gT25seSB1c2UgcmVzb3VyY2VzIHRoYXQgcmVjZWl2ZWQgcmVzcG9uc2UgYmVmb3JlIHRoZSBzbmFwc2hvdC5cbiAgICAgIC8vIE5vdGUgdGhhdCBib3RoIHNuYXBzaG90IHRpbWUgYW5kIHJlcXVlc3QgdGltZSBhcmUgdGFrZW4gaW4gdGhlIHNhbWUgTm9kZSBwcm9jZXNzLlxuICAgICAgaWYgKHR5cGVvZiByZXNvdXJjZS5fbW9ub3RvbmljVGltZSA9PT0gJ251bWJlcicgJiYgcmVzb3VyY2UuX21vbm90b25pY1RpbWUgPj0gc25hcHNob3QudGltZXN0YW1wKVxuICAgICAgICBicmVhaztcbiAgICAgIGlmIChyZXNvdXJjZS5yZXNwb25zZS5zdGF0dXMgPT09IDMwNCkge1xuICAgICAgICAvLyBcIk5vdCBNb2RpZmllZFwiIHJlc3BvbnNlcyBhcmUgaXNzdWVkIHdoZW4gYnJvd3NlciByZXF1ZXN0cyB0aGUgc2FtZSByZXNvdXJjZVxuICAgICAgICAvLyBtdWx0aXBsZSB0aW1lcywgbWVhbndoaWxlIGluZGljYXRpbmcgdGhhdCBpdCBoYXMgdGhlIHJlc3BvbnNlIGNhY2hlZC5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gV2hlbiByZW5kZXJpbmcgdGhlIHNuYXBzaG90LCBicm93c2VyIG1vc3QgbGlrZWx5IHdpbGwgbm90IGhhdmUgdGhlIHJlc291cmNlIGNhY2hlZCxcbiAgICAgICAgLy8gc28gd2Ugc2hvdWxkIHJlc3BvbmQgd2l0aCB0aGUgcmVhbCBjb250ZW50IGluc3RlYWQsIHBpY2tpbmcgdGhlIGxhc3QgcmVzcG9uc2UgdGhhdFxuICAgICAgICAvLyBpcyBub3QgMzA0LlxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXNvdXJjZS5yZXF1ZXN0LnVybCA9PT0gdXJsICYmIHJlc291cmNlLnJlcXVlc3QubWV0aG9kID09PSBtZXRob2QpIHtcbiAgICAgICAgLy8gUGljayB0aGUgbGFzdCByZXNvdXJjZSB3aXRoIG1hdGNoaW5nIHVybCAtIG1vc3QgbGlrZWx5IGl0IHdhcyB1c2VkXG4gICAgICAgIC8vIGF0IHRoZSB0aW1lIG9mIHNuYXBzaG90LCBub3QgdGhlIGVhcmxpZXIgYWJvcnRlZCByZXNvdXJjZSB3aXRoIHRoZSBzYW1lIHVybC5cbiAgICAgICAgaWYgKHJlc291cmNlLl9mcmFtZXJlZiA9PT0gc25hcHNob3QuZnJhbWVJZClcbiAgICAgICAgICBzYW1lRnJhbWVSZXNvdXJjZSA9IHJlc291cmNlO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgb3RoZXJGcmFtZVJlc291cmNlID0gcmVzb3VyY2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRmlyc3QgdHJ5IGxvY2F0aW5nIGV4YWN0IHJlc291cmNlIGJlbG9uZ2luZyB0byB0aGlzIGZyYW1lLFxuICAgIC8vIHRoZW4gZmFsbCBiYWNrIHRvIHJlc291cmNlIHdpdGggdGhpcyBVUkwgdG8gYWNjb3VudCBmb3IgbWVtb3J5IGNhY2hlLlxuICAgIGxldCByZXN1bHQgPSBzYW1lRnJhbWVSZXNvdXJjZSA/PyBvdGhlckZyYW1lUmVzb3VyY2U7XG4gICAgaWYgKHJlc3VsdCAmJiBtZXRob2QudG9VcHBlckNhc2UoKSA9PT0gJ0dFVCcpIHtcbiAgICAgIC8vIFBhdGNoIG92ZXJyaWRlIGlmIG5lY2Vzc2FyeS5cbiAgICAgIGZvciAoY29uc3QgbyBvZiBzbmFwc2hvdC5yZXNvdXJjZU92ZXJyaWRlcykge1xuICAgICAgICBpZiAodXJsID09PSBvLnVybCAmJiBvLnNoYTEpIHtcbiAgICAgICAgICByZXN1bHQgPSB7XG4gICAgICAgICAgICAuLi5yZXN1bHQsXG4gICAgICAgICAgICByZXNwb25zZToge1xuICAgICAgICAgICAgICAuLi5yZXN1bHQucmVzcG9uc2UsXG4gICAgICAgICAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgICAgICAgICAuLi5yZXN1bHQucmVzcG9uc2UuY29udGVudCxcbiAgICAgICAgICAgICAgICBfc2hhMTogby5zaGExLFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbmNvbnN0IGF1dG9DbG9zaW5nID0gbmV3IFNldChbJ0FSRUEnLCAnQkFTRScsICdCUicsICdDT0wnLCAnQ09NTUFORCcsICdFTUJFRCcsICdIUicsICdJTUcnLCAnSU5QVVQnLCAnS0VZR0VOJywgJ0xJTksnLCAnTUVOVUlURU0nLCAnTUVUQScsICdQQVJBTScsICdTT1VSQ0UnLCAnVFJBQ0snLCAnV0JSJ10pO1xuXG5mdW5jdGlvbiBzbmFwc2hvdE5vZGVzKHNuYXBzaG90OiBGcmFtZVNuYXBzaG90KTogTm9kZVNuYXBzaG90W10ge1xuICBpZiAoIShzbmFwc2hvdCBhcyBhbnkpLl9ub2Rlcykge1xuICAgIGNvbnN0IG5vZGVzOiBOb2RlU25hcHNob3RbXSA9IFtdO1xuICAgIGNvbnN0IHZpc2l0ID0gKG46IE5vZGVTbmFwc2hvdCkgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBuID09PSAnc3RyaW5nJykge1xuICAgICAgICBub2Rlcy5wdXNoKG4pO1xuICAgICAgfSBlbHNlIGlmIChpc05vZGVOYW1lQXR0cmlidXRlc0NoaWxkTm9kZXNTbmFwc2hvdChuKSkge1xuICAgICAgICBjb25zdCBbLCwgLi4uY2hpbGRyZW5dID0gbjtcbiAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBjaGlsZHJlbilcbiAgICAgICAgICB2aXNpdChjaGlsZCk7XG4gICAgICAgIG5vZGVzLnB1c2gobik7XG4gICAgICB9XG4gICAgfTtcbiAgICB2aXNpdChzbmFwc2hvdC5odG1sKTtcbiAgICAoc25hcHNob3QgYXMgYW55KS5fbm9kZXMgPSBub2RlcztcbiAgfVxuICByZXR1cm4gKHNuYXBzaG90IGFzIGFueSkuX25vZGVzO1xufVxuXG5mdW5jdGlvbiBzbmFwc2hvdFNjcmlwdCguLi50YXJnZXRJZHM6IChzdHJpbmcgfCB1bmRlZmluZWQpW10pIHtcbiAgZnVuY3Rpb24gYXBwbHlQbGF5d3JpZ2h0QXR0cmlidXRlcyh1bndyYXBQb3BvdXRVcmw6ICh1cmw6IHN0cmluZykgPT4gc3RyaW5nLCAuLi50YXJnZXRJZHM6IChzdHJpbmcgfCB1bmRlZmluZWQpW10pIHtcbiAgICBjb25zdCBpc1VuZGVyVGVzdCA9IG5ldyBVUkxTZWFyY2hQYXJhbXMobG9jYXRpb24uc2VhcmNoKS5oYXMoJ2lzVW5kZXJUZXN0Jyk7XG5cbiAgICBjb25zdCBrUG9pbnRlcldhcm5pbmdUaXRsZSA9ICdSZWNvcmRlZCBjbGljayBwb3NpdGlvbiBpbiBhYnNvbHV0ZSBjb29yZGluYXRlcyBkaWQgbm90JyArXG4gICAgICAgICcgbWF0Y2ggdGhlIGNlbnRlciBvZiB0aGUgY2xpY2tlZCBlbGVtZW50LiBUaGlzIGlzIGxpa2VseSBkdWUgdG8gYSBkaWZmZXJlbmNlIGJldHdlZW4nICtcbiAgICAgICAgJyB0aGUgdGVzdCBydW5uZXIgYW5kIHRoZSB0cmFjZSB2aWV3ZXIgb3BlcmF0aW5nIHN5c3RlbXMuJztcblxuICAgIGNvbnN0IHNjcm9sbFRvcHM6IEVsZW1lbnRbXSA9IFtdO1xuICAgIGNvbnN0IHNjcm9sbExlZnRzOiBFbGVtZW50W10gPSBbXTtcbiAgICBjb25zdCB0YXJnZXRFbGVtZW50czogRWxlbWVudFtdID0gW107XG4gICAgY29uc3QgY2FudmFzRWxlbWVudHM6IEhUTUxDYW52YXNFbGVtZW50W10gPSBbXTtcblxuICAgIGNvbnN0IHZpc2l0ID0gKHJvb3Q6IERvY3VtZW50IHwgU2hhZG93Um9vdCkgPT4ge1xuICAgICAgLy8gQ29sbGVjdCBhbGwgc2Nyb2xsZWQgZWxlbWVudHMgZm9yIGxhdGVyIHVzZS5cbiAgICAgIGZvciAoY29uc3QgZSBvZiByb290LnF1ZXJ5U2VsZWN0b3JBbGwoYFtfX3BsYXl3cmlnaHRfc2Nyb2xsX3RvcF9dYCkpXG4gICAgICAgIHNjcm9sbFRvcHMucHVzaChlKTtcbiAgICAgIGZvciAoY29uc3QgZSBvZiByb290LnF1ZXJ5U2VsZWN0b3JBbGwoYFtfX3BsYXl3cmlnaHRfc2Nyb2xsX2xlZnRfXWApKVxuICAgICAgICBzY3JvbGxMZWZ0cy5wdXNoKGUpO1xuXG4gICAgICBmb3IgKGNvbnN0IGVsZW1lbnQgb2Ygcm9vdC5xdWVyeVNlbGVjdG9yQWxsKGBbX19wbGF5d3JpZ2h0X3ZhbHVlX11gKSkge1xuICAgICAgICBjb25zdCBpbnB1dEVsZW1lbnQgPSBlbGVtZW50IGFzIEhUTUxJbnB1dEVsZW1lbnQgfCBIVE1MVGV4dEFyZWFFbGVtZW50O1xuICAgICAgICBpZiAoaW5wdXRFbGVtZW50LnR5cGUgIT09ICdmaWxlJylcbiAgICAgICAgICBpbnB1dEVsZW1lbnQudmFsdWUgPSBpbnB1dEVsZW1lbnQuZ2V0QXR0cmlidXRlKCdfX3BsYXl3cmlnaHRfdmFsdWVfJykhO1xuICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgnX19wbGF5d3JpZ2h0X3ZhbHVlXycpO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIHJvb3QucXVlcnlTZWxlY3RvckFsbChgW19fcGxheXdyaWdodF9jaGVja2VkX11gKSkge1xuICAgICAgICAoZWxlbWVudCBhcyBIVE1MSW5wdXRFbGVtZW50KS5jaGVja2VkID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ19fcGxheXdyaWdodF9jaGVja2VkXycpID09PSAndHJ1ZSc7XG4gICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdfX3BsYXl3cmlnaHRfY2hlY2tlZF8nKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiByb290LnF1ZXJ5U2VsZWN0b3JBbGwoYFtfX3BsYXl3cmlnaHRfc2VsZWN0ZWRfXWApKSB7XG4gICAgICAgIChlbGVtZW50IGFzIEhUTUxPcHRpb25FbGVtZW50KS5zZWxlY3RlZCA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCdfX3BsYXl3cmlnaHRfc2VsZWN0ZWRfJykgPT09ICd0cnVlJztcbiAgICAgICAgZWxlbWVudC5yZW1vdmVBdHRyaWJ1dGUoJ19fcGxheXdyaWdodF9zZWxlY3RlZF8nKTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCB0YXJnZXRJZCBvZiB0YXJnZXRJZHMpIHtcbiAgICAgICAgZm9yIChjb25zdCB0YXJnZXQgb2Ygcm9vdC5xdWVyeVNlbGVjdG9yQWxsKGBbX19wbGF5d3JpZ2h0X3RhcmdldF9fPVwiJHt0YXJnZXRJZH1cIl1gKSkge1xuICAgICAgICAgIGNvbnN0IHN0eWxlID0gKHRhcmdldCBhcyBIVE1MRWxlbWVudCkuc3R5bGU7XG4gICAgICAgICAgc3R5bGUub3V0bGluZSA9ICcycHggc29saWQgIzAwNmFiMSc7XG4gICAgICAgICAgc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyM2ZmE4ZGM3Zic7XG4gICAgICAgICAgdGFyZ2V0RWxlbWVudHMucHVzaCh0YXJnZXQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3QgaWZyYW1lIG9mIHJvb3QucXVlcnlTZWxlY3RvckFsbCgnaWZyYW1lLCBmcmFtZScpKSB7XG4gICAgICAgIGNvbnN0IHNyYyA9IGlmcmFtZS5nZXRBdHRyaWJ1dGUoJ19fcGxheXdyaWdodF9zcmNfXycpO1xuICAgICAgICBpZiAoIXNyYykge1xuICAgICAgICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ3NyYycsICdkYXRhOnRleHQvaHRtbCw8Ym9keSBzdHlsZT1cImJhY2tncm91bmQ6ICNkZGRcIj48L2JvZHk+Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gUmV0YWluIHF1ZXJ5IHBhcmFtZXRlcnMgdG8gaW5oZXJpdCBuYW1lPSwgdGltZT0sIHBvaW50WD0sIHBvaW50WT0gYW5kIG90aGVyIHZhbHVlcyBmcm9tIHBhcmVudC5cbiAgICAgICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHVud3JhcFBvcG91dFVybCh3aW5kb3cubG9jYXRpb24uaHJlZikpO1xuICAgICAgICAgIC8vIFdlIGNhbiBiZSBsb2FkaW5nIGlmcmFtZSBmcm9tIHdpdGhpbiBpZnJhbWUsIHJlc2V0IGJhc2UgdG8gYmUgYWJzb2x1dGUuXG4gICAgICAgICAgY29uc3QgaW5kZXggPSB1cmwucGF0aG5hbWUubGFzdEluZGV4T2YoJy9zbmFwc2hvdC8nKTtcbiAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKVxuICAgICAgICAgICAgdXJsLnBhdGhuYW1lID0gdXJsLnBhdGhuYW1lLnN1YnN0cmluZygwLCBpbmRleCArIDEpO1xuICAgICAgICAgIHVybC5wYXRobmFtZSArPSBzcmMuc3Vic3RyaW5nKDEpO1xuICAgICAgICAgIGlmcmFtZS5zZXRBdHRyaWJ1dGUoJ3NyYycsIHVybC50b1N0cmluZygpKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSByb290LnF1ZXJ5U2VsZWN0b3IoYGJvZHlbX19wbGF5d3JpZ2h0X2N1c3RvbV9lbGVtZW50c19fXWApO1xuICAgICAgICBpZiAoYm9keSAmJiB3aW5kb3cuY3VzdG9tRWxlbWVudHMpIHtcbiAgICAgICAgICBjb25zdCBjdXN0b21FbGVtZW50cyA9IChib2R5LmdldEF0dHJpYnV0ZSgnX19wbGF5d3JpZ2h0X2N1c3RvbV9lbGVtZW50c19fJykgfHwgJycpLnNwbGl0KCcsJyk7XG4gICAgICAgICAgZm9yIChjb25zdCBlbGVtZW50TmFtZSBvZiBjdXN0b21FbGVtZW50cylcbiAgICAgICAgICAgIHdpbmRvdy5jdXN0b21FbGVtZW50cy5kZWZpbmUoZWxlbWVudE5hbWUsIGNsYXNzIGV4dGVuZHMgSFRNTEVsZW1lbnQge30pO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiByb290LnF1ZXJ5U2VsZWN0b3JBbGwoYHRlbXBsYXRlW19fcGxheXdyaWdodF9zaGFkb3dfcm9vdF9dYCkpIHtcbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBlbGVtZW50IGFzIEhUTUxUZW1wbGF0ZUVsZW1lbnQ7XG4gICAgICAgIGNvbnN0IHNoYWRvd1Jvb3QgPSB0ZW1wbGF0ZS5wYXJlbnRFbGVtZW50IS5hdHRhY2hTaGFkb3coeyBtb2RlOiAnb3BlbicgfSk7XG4gICAgICAgIHNoYWRvd1Jvb3QuYXBwZW5kQ2hpbGQodGVtcGxhdGUuY29udGVudCk7XG4gICAgICAgIHRlbXBsYXRlLnJlbW92ZSgpO1xuICAgICAgICB2aXNpdChzaGFkb3dSb290KTtcbiAgICAgIH1cblxuICAgICAgaWYgKCdhZG9wdGVkU3R5bGVTaGVldHMnIGluIChyb290IGFzIGFueSkpIHtcbiAgICAgICAgY29uc3QgYWRvcHRlZFNoZWV0czogQ1NTU3R5bGVTaGVldFtdID0gWy4uLihyb290IGFzIGFueSkuYWRvcHRlZFN0eWxlU2hlZXRzXTtcbiAgICAgICAgZm9yIChjb25zdCBlbGVtZW50IG9mIHJvb3QucXVlcnlTZWxlY3RvckFsbChgdGVtcGxhdGVbX19wbGF5d3JpZ2h0X3N0eWxlX3NoZWV0X11gKSkge1xuICAgICAgICAgIGNvbnN0IHRlbXBsYXRlID0gZWxlbWVudCBhcyBIVE1MVGVtcGxhdGVFbGVtZW50O1xuICAgICAgICAgIGNvbnN0IHNoZWV0ID0gbmV3IENTU1N0eWxlU2hlZXQoKTtcbiAgICAgICAgICAoc2hlZXQgYXMgYW55KS5yZXBsYWNlU3luYyh0ZW1wbGF0ZS5nZXRBdHRyaWJ1dGUoJ19fcGxheXdyaWdodF9zdHlsZV9zaGVldF8nKSk7XG4gICAgICAgICAgYWRvcHRlZFNoZWV0cy5wdXNoKHNoZWV0KTtcbiAgICAgICAgfVxuICAgICAgICAocm9vdCBhcyBhbnkpLmFkb3B0ZWRTdHlsZVNoZWV0cyA9IGFkb3B0ZWRTaGVldHM7XG4gICAgICB9XG5cbiAgICAgIGNhbnZhc0VsZW1lbnRzLnB1c2goLi4ucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCdjYW52YXMnKSk7XG4gICAgfTtcblxuICAgIGNvbnN0IG9uTG9hZCA9ICgpID0+IHtcbiAgICAgIHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdsb2FkJywgb25Mb2FkKTtcbiAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBzY3JvbGxUb3BzKSB7XG4gICAgICAgIGVsZW1lbnQuc2Nyb2xsVG9wID0gK2VsZW1lbnQuZ2V0QXR0cmlidXRlKCdfX3BsYXl3cmlnaHRfc2Nyb2xsX3RvcF8nKSE7XG4gICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdfX3BsYXl3cmlnaHRfc2Nyb2xsX3RvcF8nKTtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBzY3JvbGxMZWZ0cykge1xuICAgICAgICBlbGVtZW50LnNjcm9sbExlZnQgPSArZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ19fcGxheXdyaWdodF9zY3JvbGxfbGVmdF8nKSE7XG4gICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdfX3BsYXl3cmlnaHRfc2Nyb2xsX2xlZnRfJyk7XG4gICAgICB9XG5cbiAgICAgIGRvY3VtZW50LnN0eWxlU2hlZXRzWzBdLmRpc2FibGVkID0gdHJ1ZTtcblxuICAgICAgY29uc3Qgc2VhcmNoID0gbmV3IFVSTCh3aW5kb3cubG9jYXRpb24uaHJlZikuc2VhcmNoUGFyYW1zO1xuICAgICAgY29uc3QgaXNUb3BGcmFtZSA9IHdpbmRvdy5sb2NhdGlvbi5wYXRobmFtZS5tYXRjaCgvXFwvcGFnZUBbYS16MC05XSskLyk7XG5cbiAgICAgIGlmIChzZWFyY2guZ2V0KCdwb2ludFgnKSAmJiBzZWFyY2guZ2V0KCdwb2ludFknKSkge1xuICAgICAgICBjb25zdCBwb2ludFggPSArc2VhcmNoLmdldCgncG9pbnRYJykhO1xuICAgICAgICBjb25zdCBwb2ludFkgPSArc2VhcmNoLmdldCgncG9pbnRZJykhO1xuICAgICAgICBjb25zdCBoYXNJbnB1dFRhcmdldCA9IHNlYXJjaC5oYXMoJ2hhc0lucHV0VGFyZ2V0Jyk7XG4gICAgICAgIGNvbnN0IGhhc1RhcmdldEVsZW1lbnRzID0gdGFyZ2V0RWxlbWVudHMubGVuZ3RoID4gMDtcbiAgICAgICAgY29uc3Qgcm9vdHMgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQgPyBbZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50XSA6IFtdO1xuICAgICAgICBmb3IgKGNvbnN0IHRhcmdldCBvZiAoaGFzVGFyZ2V0RWxlbWVudHMgPyB0YXJnZXRFbGVtZW50cyA6IHJvb3RzKSkge1xuICAgICAgICAgIGNvbnN0IHBvaW50RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3gtcHctcG9pbnRlcicpO1xuICAgICAgICAgIHBvaW50RWxlbWVudC5zdHlsZS5wb3NpdGlvbiA9ICdmaXhlZCc7XG4gICAgICAgICAgcG9pbnRFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjZjQ0MzM2JztcbiAgICAgICAgICBwb2ludEVsZW1lbnQuc3R5bGUud2lkdGggPSAnMjBweCc7XG4gICAgICAgICAgcG9pbnRFbGVtZW50LnN0eWxlLmhlaWdodCA9ICcyMHB4JztcbiAgICAgICAgICBwb2ludEVsZW1lbnQuc3R5bGUuYm9yZGVyUmFkaXVzID0gJzEwcHgnO1xuICAgICAgICAgIHBvaW50RWxlbWVudC5zdHlsZS5tYXJnaW4gPSAnLTEwcHggMCAwIC0xMHB4JztcbiAgICAgICAgICBwb2ludEVsZW1lbnQuc3R5bGUuekluZGV4ID0gJzIxNDc0ODM2NDYnO1xuICAgICAgICAgIHBvaW50RWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuICAgICAgICAgIHBvaW50RWxlbWVudC5zdHlsZS5hbGlnbkl0ZW1zID0gJ2NlbnRlcic7XG4gICAgICAgICAgcG9pbnRFbGVtZW50LnN0eWxlLmp1c3RpZnlDb250ZW50ID0gJ2NlbnRlcic7XG4gICAgICAgICAgaWYgKGhhc1RhcmdldEVsZW1lbnRzKSB7XG4gICAgICAgICAgICAvLyBTb21ldGltZXMgdGhlcmUgYXJlIGxheW91dCBkaXNjcmVwYW5jaWVzIGJldHdlZW4gcmVjb3JkaW5nIGFuZCByZW5kZXJpbmcsIGUuZy4gZm9udHMsXG4gICAgICAgICAgICAvLyB0aGF0IG1heSBwbGFjZSB0aGUgcG9pbnQgYXQgdGhlIHdyb25nIHBsYWNlLiBUbyBhdm9pZCBjb25mdXNpb24sIHdlIGp1c3Qgc2hvdyB0aGVcbiAgICAgICAgICAgIC8vIHBvaW50IGluIHRoZSBtaWRkbGUgb2YgdGhlIHRhcmdldCBlbGVtZW50LlxuICAgICAgICAgICAgY29uc3QgYm94ID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICAgICAgY29uc3QgY2VudGVyWCA9IChib3gubGVmdCArIGJveC53aWR0aCAvIDIpO1xuICAgICAgICAgICAgY29uc3QgY2VudGVyWSA9IChib3gudG9wICsgYm94LmhlaWdodCAvIDIpO1xuICAgICAgICAgICAgcG9pbnRFbGVtZW50LnN0eWxlLmxlZnQgPSBjZW50ZXJYICsgJ3B4JztcbiAgICAgICAgICAgIHBvaW50RWxlbWVudC5zdHlsZS50b3AgPSBjZW50ZXJZICsgJ3B4JztcbiAgICAgICAgICAgIC8vIFwiV2FybmluZyBzeW1ib2xcIiBpbmRpY2F0ZXMgdGhhdCBhY3Rpb24gcG9pbnQgaXMgbm90IDEwMCUgY29ycmVjdC5cbiAgICAgICAgICAgIC8vIE5vdGUgdGhhdCBhY3Rpb24gcG9pbnQgaXMgcmVsYXRpdmUgdG8gdGhlIHRvcCBmcmFtZSwgc28gd2UgY2FuIG9ubHkgY29tcGFyZSBpbiB0aGUgdG9wIGZyYW1lLlxuICAgICAgICAgICAgaWYgKGlzVG9wRnJhbWUgJiYgKE1hdGguYWJzKGNlbnRlclggLSBwb2ludFgpID49IDEwIHx8IE1hdGguYWJzKGNlbnRlclkgLSBwb2ludFkpID49IDEwKSkge1xuICAgICAgICAgICAgICBjb25zdCB3YXJuaW5nRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3gtcHctcG9pbnRlci13YXJuaW5nJyk7XG4gICAgICAgICAgICAgIHdhcm5pbmdFbGVtZW50LnRleHRDb250ZW50ID0gJ+KaoCc7XG4gICAgICAgICAgICAgIHdhcm5pbmdFbGVtZW50LnN0eWxlLmZvbnRTaXplID0gJzE5cHgnO1xuICAgICAgICAgICAgICB3YXJuaW5nRWxlbWVudC5zdHlsZS5jb2xvciA9ICd3aGl0ZSc7XG4gICAgICAgICAgICAgIHdhcm5pbmdFbGVtZW50LnN0eWxlLm1hcmdpblRvcCA9ICctMy41cHgnO1xuICAgICAgICAgICAgICB3YXJuaW5nRWxlbWVudC5zdHlsZS51c2VyU2VsZWN0ID0gJ25vbmUnO1xuICAgICAgICAgICAgICBwb2ludEVsZW1lbnQuYXBwZW5kQ2hpbGQod2FybmluZ0VsZW1lbnQpO1xuICAgICAgICAgICAgICBwb2ludEVsZW1lbnQuc2V0QXR0cmlidXRlKCd0aXRsZScsIGtQb2ludGVyV2FybmluZ1RpdGxlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hcHBlbmRDaGlsZChwb2ludEVsZW1lbnQpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaXNUb3BGcmFtZSAmJiAhaGFzSW5wdXRUYXJnZXQpIHtcbiAgICAgICAgICAgIC8vIEZvciBhY3Rpb25zIHdpdGhvdXQgYSB0YXJnZXQgZWxlbWVudCwgZS5nLiBwYWdlLm1vdXNlLm1vdmUoKSxcbiAgICAgICAgICAgIC8vIHNob3cgdGhlIHBvaW50IGF0IHRoZSByZWNvcmRlZCBsb2NhdGlvbiwgd2hpY2ggaXMgcmVsYXRpdmUgdG8gdGhlIHRvcCBmcmFtZS5cbiAgICAgICAgICAgIHBvaW50RWxlbWVudC5zdHlsZS5sZWZ0ID0gcG9pbnRYICsgJ3B4JztcbiAgICAgICAgICAgIHBvaW50RWxlbWVudC5zdHlsZS50b3AgPSBwb2ludFkgKyAncHgnO1xuICAgICAgICAgICAgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmFwcGVuZENoaWxkKHBvaW50RWxlbWVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjYW52YXNFbGVtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGZ1bmN0aW9uIGRyYXdDaGVja2VyYm9hcmQoY29udGV4dDogQ2FudmFzUmVuZGVyaW5nQ29udGV4dDJELCBjYW52YXM6IEhUTUxDYW52YXNFbGVtZW50KSB7XG4gICAgICAgICAgZnVuY3Rpb24gY3JlYXRlQ2hlY2tlcmJvYXJkUGF0dGVybigpIHtcbiAgICAgICAgICAgIGNvbnN0IHBhdHRlcm4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICAgICAgICAgIHBhdHRlcm4ud2lkdGggPSBwYXR0ZXJuLndpZHRoIC8gTWF0aC5mbG9vcihwYXR0ZXJuLndpZHRoIC8gMjQpO1xuICAgICAgICAgICAgcGF0dGVybi5oZWlnaHQgPSBwYXR0ZXJuLmhlaWdodCAvIE1hdGguZmxvb3IocGF0dGVybi5oZWlnaHQgLyAyNCk7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0ID0gcGF0dGVybi5nZXRDb250ZXh0KCcyZCcpITtcbiAgICAgICAgICAgIGNvbnRleHQuZmlsbFN0eWxlID0gJ2xpZ2h0Z3JheSc7XG4gICAgICAgICAgICBjb250ZXh0LmZpbGxSZWN0KDAsIDAsIHBhdHRlcm4ud2lkdGgsIHBhdHRlcm4uaGVpZ2h0KTtcbiAgICAgICAgICAgIGNvbnRleHQuZmlsbFN0eWxlID0gJ3doaXRlJztcbiAgICAgICAgICAgIGNvbnRleHQuZmlsbFJlY3QoMCwgMCwgcGF0dGVybi53aWR0aCAvIDIsIHBhdHRlcm4uaGVpZ2h0IC8gMik7XG4gICAgICAgICAgICBjb250ZXh0LmZpbGxSZWN0KHBhdHRlcm4ud2lkdGggLyAyLCBwYXR0ZXJuLmhlaWdodCAvIDIsIHBhdHRlcm4ud2lkdGgsIHBhdHRlcm4uaGVpZ2h0KTtcbiAgICAgICAgICAgIHJldHVybiBjb250ZXh0LmNyZWF0ZVBhdHRlcm4ocGF0dGVybiwgJ3JlcGVhdCcpITtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb250ZXh0LmZpbGxTdHlsZSA9IGNyZWF0ZUNoZWNrZXJib2FyZFBhdHRlcm4oKTtcbiAgICAgICAgICBjb250ZXh0LmZpbGxSZWN0KDAsIDAsIGNhbnZhcy53aWR0aCwgY2FudmFzLmhlaWdodCk7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmICghaXNUb3BGcmFtZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgY2FudmFzIG9mIGNhbnZhc0VsZW1lbnRzKSB7XG4gICAgICAgICAgICBjb25zdCBjb250ZXh0ID0gY2FudmFzLmdldENvbnRleHQoJzJkJykhO1xuICAgICAgICAgICAgZHJhd0NoZWNrZXJib2FyZChjb250ZXh0LCBjYW52YXMpO1xuICAgICAgICAgICAgY2FudmFzLnRpdGxlID0gYFBsYXl3cmlnaHQgZGlzcGxheXMgY2FudmFzIGNvbnRlbnRzIG9uIGEgYmVzdC1lZmZvcnQgYmFzaXMuIEl0IGRvZXNuJ3Qgc3VwcG9ydCBjYW52YXMgZWxlbWVudHMgaW5zaWRlIGFuIGlmcmFtZSB5ZXQuIElmIHRoaXMgaW1wYWN0cyB5b3VyIHdvcmtmbG93LCBwbGVhc2Ugb3BlbiBhbiBpc3N1ZSBzbyB3ZSBjYW4gcHJpb3JpdGl6ZS5gO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgaW1nLm9ubG9hZCA9ICgpID0+IHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGNhbnZhcyBvZiBjYW52YXNFbGVtZW50cykge1xuICAgICAgICAgICAgY29uc3QgY29udGV4dCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpITtcblxuICAgICAgICAgICAgY29uc3QgYm91bmRpbmdSZWN0QXR0cmlidXRlID0gY2FudmFzLmdldEF0dHJpYnV0ZSgnX19wbGF5d3JpZ2h0X2JvdW5kaW5nX3JlY3RfXycpO1xuICAgICAgICAgICAgY2FudmFzLnJlbW92ZUF0dHJpYnV0ZSgnX19wbGF5d3JpZ2h0X2JvdW5kaW5nX3JlY3RfXycpO1xuICAgICAgICAgICAgaWYgKCFib3VuZGluZ1JlY3RBdHRyaWJ1dGUpXG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgYm91bmRpbmdSZWN0OiB7IGxlZnQ6IG51bWJlciwgdG9wOiBudW1iZXIsIHJpZ2h0OiBudW1iZXIsIGJvdHRvbTogbnVtYmVyIH07XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICBib3VuZGluZ1JlY3QgPSBKU09OLnBhcnNlKGJvdW5kaW5nUmVjdEF0dHJpYnV0ZSk7XG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwYXJ0aWFsbHlVbmNhcHR1cmVkID0gYm91bmRpbmdSZWN0LnJpZ2h0ID4gMSB8fCBib3VuZGluZ1JlY3QuYm90dG9tID4gMTtcbiAgICAgICAgICAgIGNvbnN0IGZ1bGx5VW5jYXB0dXJlZCA9IGJvdW5kaW5nUmVjdC5sZWZ0ID4gMSB8fCBib3VuZGluZ1JlY3QudG9wID4gMTtcbiAgICAgICAgICAgIGlmIChmdWxseVVuY2FwdHVyZWQpIHtcbiAgICAgICAgICAgICAgY2FudmFzLnRpdGxlID0gYFBsYXl3cmlnaHQgY291bGRuJ3QgY2FwdHVyZSBjYW52YXMgY29udGVudHMgYmVjYXVzZSBpdCdzIGxvY2F0ZWQgb3V0c2lkZSB0aGUgdmlld3BvcnQuYDtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGRyYXdDaGVja2VyYm9hcmQoY29udGV4dCwgY2FudmFzKTtcblxuICAgICAgICAgICAgY29udGV4dC5kcmF3SW1hZ2UoaW1nLCBib3VuZGluZ1JlY3QubGVmdCAqIGltZy53aWR0aCwgYm91bmRpbmdSZWN0LnRvcCAqIGltZy5oZWlnaHQsIChib3VuZGluZ1JlY3QucmlnaHQgLSBib3VuZGluZ1JlY3QubGVmdCkgKiBpbWcud2lkdGgsIChib3VuZGluZ1JlY3QuYm90dG9tIC0gYm91bmRpbmdSZWN0LnRvcCkgKiBpbWcuaGVpZ2h0LCAwLCAwLCBjYW52YXMud2lkdGgsIGNhbnZhcy5oZWlnaHQpO1xuICAgICAgICAgICAgaWYgKGlzVW5kZXJUZXN0KVxuICAgICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc29sZVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgY2FudmFzIGRyYXduOmAsIEpTT04uc3RyaW5naWZ5KFtib3VuZGluZ1JlY3QubGVmdCwgYm91bmRpbmdSZWN0LnRvcCwgKGJvdW5kaW5nUmVjdC5yaWdodCAtIGJvdW5kaW5nUmVjdC5sZWZ0KSwgKGJvdW5kaW5nUmVjdC5ib3R0b20gLSBib3VuZGluZ1JlY3QudG9wKV0ubWFwKHYgPT4gTWF0aC5mbG9vcih2ICogMTAwKSkpKTtcblxuICAgICAgICAgICAgaWYgKHBhcnRpYWxseVVuY2FwdHVyZWQpXG4gICAgICAgICAgICAgIGNhbnZhcy50aXRsZSA9IGBQbGF5d3JpZ2h0IGNvdWxkbid0IGNhcHR1cmUgZnVsbCBjYW52YXMgY29udGVudHMgYmVjYXVzZSBpdCdzIGxvY2F0ZWQgcGFydGlhbGx5IG91dHNpZGUgdGhlIHZpZXdwb3J0LmA7XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgIGNhbnZhcy50aXRsZSA9IGBDYW52YXMgY29udGVudHMgYXJlIGRpc3BsYXllZCBvbiBhIGJlc3QtZWZmb3J0IGJhc2lzIGJhc2VkIG9uIHZpZXdwb3J0IHNjcmVlbnNob3RzIHRha2VuIGR1cmluZyB0ZXN0IGV4ZWN1dGlvbi5gO1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgaW1nLm9uZXJyb3IgPSAoKSA9PiB7XG4gICAgICAgICAgZm9yIChjb25zdCBjYW52YXMgb2YgY2FudmFzRWxlbWVudHMpIHtcbiAgICAgICAgICAgIGNvbnN0IGNvbnRleHQgPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKSE7XG4gICAgICAgICAgICBkcmF3Q2hlY2tlcmJvYXJkKGNvbnRleHQsIGNhbnZhcyk7XG4gICAgICAgICAgICBjYW52YXMudGl0bGUgPSBgUGxheXdyaWdodCBjb3VsZG4ndCBzaG93IGNhbnZhcyBjb250ZW50cyBiZWNhdXNlIHRoZSBzY3JlZW5zaG90IGZhaWxlZCB0byBsb2FkLmA7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBpbWcuc3JjID0gbG9jYXRpb24uaHJlZi5yZXBsYWNlKCcvc25hcHNob3QnLCAnL2Nsb3Nlc3Qtc2NyZWVuc2hvdCcpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBjb25zdCBvbkRPTUNvbnRlbnRMb2FkZWQgPSAoKSA9PiB2aXNpdChkb2N1bWVudCk7XG5cbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIG9uTG9hZCk7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBvbkRPTUNvbnRlbnRMb2FkZWQpO1xuICB9XG5cbiAgcmV0dXJuIGBcXG4oJHthcHBseVBsYXl3cmlnaHRBdHRyaWJ1dGVzLnRvU3RyaW5nKCl9KSgke3Vud3JhcFBvcG91dFVybC50b1N0cmluZygpfSR7dGFyZ2V0SWRzLm1hcChpZCA9PiBgLCBcIiR7aWR9XCJgKS5qb2luKCcnKX0pYDtcbn1cblxuXG4vKipcbiAqIEJlc3QtZWZmb3J0IEVsZWN0cm9uIHN1cHBvcnQ6IHJld3JpdGUgY3VzdG9tIHByb3RvY29sIGluIERPTS5cbiAqIHZzY29kZS1maWxlOi8vdnNjb2RlLWFwcC8gLT4gaHR0cHM6Ly9wdy12c2NvZGUtZmlsZS0tdnNjb2RlLWFwcC9cbiAqL1xuY29uc3Qgc2NoZW1hcyA9IFsnYWJvdXQ6JywgJ2Jsb2I6JywgJ2RhdGE6JywgJ2ZpbGU6JywgJ2Z0cDonLCAnaHR0cDonLCAnaHR0cHM6JywgJ21haWx0bzonLCAnc2Z0cDonLCAnd3M6JywgJ3dzczonXTtcbmNvbnN0IGtMZWdhY3lCbG9iUHJlZml4ID0gJ2h0dHA6Ly9wbGF5d3JpZ2h0LmJsb2J1cmwvIyc7XG5cbmV4cG9ydCBmdW5jdGlvbiByZXdyaXRlVVJMRm9yQ3VzdG9tUHJvdG9jb2woaHJlZjogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gTGVnYWN5IHN1cHBvcnQsIHdlIHVzZWQgdG8gcHJlcGVuZCB0aGlzIHRvIGJsb2JzLCBzdHJpcCBpdCBhd2F5LlxuICBpZiAoaHJlZi5zdGFydHNXaXRoKGtMZWdhY3lCbG9iUHJlZml4KSlcbiAgICBocmVmID0gaHJlZi5zdWJzdHJpbmcoa0xlZ2FjeUJsb2JQcmVmaXgubGVuZ3RoKTtcblxuICB0cnkge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwoaHJlZik7XG4gICAgLy8gU2FuaXRpemUgVVJMLlxuICAgIGlmICh1cmwucHJvdG9jb2wgPT09ICdqYXZhc2NyaXB0OicgfHwgdXJsLnByb3RvY29sID09PSAndmJzY3JpcHQ6JylcbiAgICAgIHJldHVybiAnamF2YXNjcmlwdDp2b2lkKDApJztcblxuICAgIC8vIFBhc3MgdGhyb3VnaCBpZiBwb3NzaWJsZS5cbiAgICBjb25zdCBpc0Jsb2IgPSB1cmwucHJvdG9jb2wgPT09ICdibG9iOic7XG4gICAgY29uc3QgaXNGaWxlID0gdXJsLnByb3RvY29sID09PSAnZmlsZTonO1xuICAgIGlmICghaXNCbG9iICYmICFpc0ZpbGUgJiYgc2NoZW1hcy5pbmNsdWRlcyh1cmwucHJvdG9jb2wpKVxuICAgICAgcmV0dXJuIGhyZWY7XG5cbiAgICAvLyBSZXdyaXRlIGJsb2IsIGZpbGUgYW5kIGN1c3RvbSBzY2hlbWFzLlxuICAgIGNvbnN0IHByZWZpeCA9ICdwdy0nICsgdXJsLnByb3RvY29sLnNsaWNlKDAsIHVybC5wcm90b2NvbC5sZW5ndGggLSAxKTtcbiAgICBpZiAoIWlzRmlsZSlcbiAgICAgIHVybC5wcm90b2NvbCA9ICdodHRwczonO1xuICAgIHVybC5ob3N0bmFtZSA9IHVybC5ob3N0bmFtZSA/IGAke3ByZWZpeH0tLSR7dXJsLmhvc3RuYW1lfWAgOiBwcmVmaXg7XG4gICAgaWYgKGlzRmlsZSkge1xuICAgICAgLy8gRmlsZSBVUklzIGNhbiBvbmx5IGhhdmUgdGhlaXIgcHJvdG9jb2wgY2hhbmdlZCBhZnRlciB0aGUgaG9zdG5hbWVcbiAgICAgIC8vIGlzIHNldC4gKEZvciBhbGwgb3RoZXIgVVJJcywgd2UgbXVzdCBzZXQgdGhlIHByb3RvY29sIGZpcnN0LilcbiAgICAgIHVybC5wcm90b2NvbCA9ICdodHRwczonO1xuICAgIH1cbiAgICByZXR1cm4gdXJsLnRvU3RyaW5nKCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBocmVmO1xuICB9XG59XG5cbi8qKlxuICogQmVzdC1lZmZvcnQgRWxlY3Ryb24gc3VwcG9ydDogcmV3cml0ZSBjdXN0b20gcHJvdG9jb2wgaW4gaW5saW5lIHN0eWxlc2hlZXRzLlxuICogdnNjb2RlLWZpbGU6Ly92c2NvZGUtYXBwLyAtPiBodHRwczovL3B3LXZzY29kZS1maWxlLS12c2NvZGUtYXBwL1xuICovXG5jb25zdCB1cmxJbkNTU1JlZ2V4ID0gL3VybFxcKFsnXCJdPyhbXFx3LV0rOilcXC9cXC8vaWc7XG5cbmZ1bmN0aW9uIHJld3JpdGVVUkxzSW5TdHlsZVNoZWV0Rm9yQ3VzdG9tUHJvdG9jb2wodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRleHQucmVwbGFjZSh1cmxJbkNTU1JlZ2V4LCAobWF0Y2g6IHN0cmluZywgcHJvdG9jb2w6IHN0cmluZykgPT4ge1xuICAgIGNvbnN0IGlzQmxvYiA9IHByb3RvY29sID09PSAnYmxvYjonO1xuICAgIGNvbnN0IGlzRmlsZSA9IHByb3RvY29sID09PSAnZmlsZTonO1xuICAgIGlmICghaXNCbG9iICYmICFpc0ZpbGUgJiYgc2NoZW1hcy5pbmNsdWRlcyhwcm90b2NvbCkpXG4gICAgICByZXR1cm4gbWF0Y2g7XG4gICAgcmV0dXJuIG1hdGNoLnJlcGxhY2UocHJvdG9jb2wgKyAnLy8nLCBgaHR0cHM6Ly9wdy0ke3Byb3RvY29sLnNsaWNlKDAsIC0xKX0tLWApO1xuICB9KTtcbn1cblxuLy8gPGJhc2U+L3NuYXBzaG90Lmh0bWw/cj08c25hcHNob3RVcmw+IGlzIHVzZWQgZm9yIFwicG9wIG91dCBzbmFwc2hvdFwiIGZlYXR1cmUuXG5leHBvcnQgZnVuY3Rpb24gdW53cmFwUG9wb3V0VXJsKHVybDogc3RyaW5nKSB7XG4gIGNvbnN0IHUgPSBuZXcgVVJMKHVybCk7XG4gIGlmICh1LnBhdGhuYW1lLmVuZHNXaXRoKCcvc25hcHNob3QuaHRtbCcpKVxuICAgIHJldHVybiB1LnNlYXJjaFBhcmFtcy5nZXQoJ3InKSE7XG4gIHJldHVybiB1cmw7XG59XG4iLCIvKipcbiAqIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7IFVSTFNlYXJjaFBhcmFtcyB9IGZyb20gJ3VybCc7XG5pbXBvcnQgdHlwZSB7IFNuYXBzaG90UmVuZGVyZXIgfSBmcm9tICcuL3NuYXBzaG90UmVuZGVyZXInO1xuaW1wb3J0IHR5cGUgeyBTbmFwc2hvdFN0b3JhZ2UgfSBmcm9tICcuL3NuYXBzaG90U3RvcmFnZSc7XG5pbXBvcnQgdHlwZSB7IFJlc291cmNlU25hcHNob3QgfSBmcm9tICdAdHJhY2Uvc25hcHNob3QnO1xuXG50eXBlIFBvaW50ID0geyB4OiBudW1iZXIsIHk6IG51bWJlciB9O1xuXG5leHBvcnQgY2xhc3MgU25hcHNob3RTZXJ2ZXIge1xuICBwcml2YXRlIF9zbmFwc2hvdFN0b3JhZ2U6IFNuYXBzaG90U3RvcmFnZTtcbiAgcHJpdmF0ZSBfcmVzb3VyY2VMb2FkZXI6IChzaGExOiBzdHJpbmcpID0+IFByb21pc2U8QmxvYiB8IHVuZGVmaW5lZD47XG4gIHByaXZhdGUgX3NuYXBzaG90SWRzID0gbmV3IE1hcDxzdHJpbmcsIFNuYXBzaG90UmVuZGVyZXI+KCk7XG5cbiAgY29uc3RydWN0b3Ioc25hcHNob3RTdG9yYWdlOiBTbmFwc2hvdFN0b3JhZ2UsIHJlc291cmNlTG9hZGVyOiAoc2hhMTogc3RyaW5nKSA9PiBQcm9taXNlPEJsb2IgfCB1bmRlZmluZWQ+KSB7XG4gICAgdGhpcy5fc25hcHNob3RTdG9yYWdlID0gc25hcHNob3RTdG9yYWdlO1xuICAgIHRoaXMuX3Jlc291cmNlTG9hZGVyID0gcmVzb3VyY2VMb2FkZXI7XG4gIH1cblxuICBzZXJ2ZVNuYXBzaG90KHBhdGhuYW1lOiBzdHJpbmcsIHNlYXJjaFBhcmFtczogVVJMU2VhcmNoUGFyYW1zLCBzbmFwc2hvdFVybDogc3RyaW5nKTogUmVzcG9uc2Uge1xuICAgIGNvbnN0IHNuYXBzaG90ID0gdGhpcy5fc25hcHNob3QocGF0aG5hbWUuc3Vic3RyaW5nKCcvc25hcHNob3QnLmxlbmd0aCksIHNlYXJjaFBhcmFtcyk7XG4gICAgaWYgKCFzbmFwc2hvdClcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UobnVsbCwgeyBzdGF0dXM6IDQwNCB9KTtcblxuICAgIGNvbnN0IHJlbmRlcmVkU25hcHNob3QgPSBzbmFwc2hvdC5yZW5kZXIoKTtcbiAgICB0aGlzLl9zbmFwc2hvdElkcy5zZXQoc25hcHNob3RVcmwsIHNuYXBzaG90KTtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKHJlbmRlcmVkU25hcHNob3QuaHRtbCwgeyBzdGF0dXM6IDIwMCwgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ3RleHQvaHRtbDsgY2hhcnNldD11dGYtOCcgfSB9KTtcbiAgfVxuXG4gIGFzeW5jIHNlcnZlQ2xvc2VzdFNjcmVlbnNob3QocGF0aG5hbWU6IHN0cmluZywgc2VhcmNoUGFyYW1zOiBVUkxTZWFyY2hQYXJhbXMpOiBQcm9taXNlPFJlc3BvbnNlPiB7XG4gICAgY29uc3Qgc25hcHNob3QgPSB0aGlzLl9zbmFwc2hvdChwYXRobmFtZS5zdWJzdHJpbmcoJy9jbG9zZXN0LXNjcmVlbnNob3QnLmxlbmd0aCksIHNlYXJjaFBhcmFtcyk7XG4gICAgY29uc3Qgc2hhMSA9IHNuYXBzaG90Py5jbG9zZXN0U2NyZWVuc2hvdCgpO1xuICAgIGlmICghc2hhMSlcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UobnVsbCwgeyBzdGF0dXM6IDQwNCB9KTtcbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKGF3YWl0IHRoaXMuX3Jlc291cmNlTG9hZGVyKHNoYTEpKTtcbiAgfVxuXG4gIHNlcnZlU25hcHNob3RJbmZvKHBhdGhuYW1lOiBzdHJpbmcsIHNlYXJjaFBhcmFtczogVVJMU2VhcmNoUGFyYW1zKTogUmVzcG9uc2Uge1xuICAgIGNvbnN0IHNuYXBzaG90ID0gdGhpcy5fc25hcHNob3QocGF0aG5hbWUuc3Vic3RyaW5nKCcvc25hcHNob3RJbmZvJy5sZW5ndGgpLCBzZWFyY2hQYXJhbXMpO1xuICAgIHJldHVybiB0aGlzLl9yZXNwb25kV2l0aEpzb24oc25hcHNob3QgPyB7XG4gICAgICB2aWV3cG9ydDogc25hcHNob3Qudmlld3BvcnQoKSxcbiAgICAgIHVybDogc25hcHNob3Quc25hcHNob3QoKS5mcmFtZVVybCxcbiAgICAgIHRpbWVzdGFtcDogc25hcHNob3Quc25hcHNob3QoKS50aW1lc3RhbXAsXG4gICAgICB3YWxsVGltZTogc25hcHNob3Quc25hcHNob3QoKS53YWxsVGltZSxcbiAgICB9IDoge1xuICAgICAgZXJyb3I6ICdObyBzbmFwc2hvdCBmb3VuZCdcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgX3NuYXBzaG90KHBhdGhuYW1lOiBzdHJpbmcsIHBhcmFtczogVVJMU2VhcmNoUGFyYW1zKSB7XG4gICAgY29uc3QgbmFtZSA9IHBhcmFtcy5nZXQoJ25hbWUnKSE7XG4gICAgcmV0dXJuIHRoaXMuX3NuYXBzaG90U3RvcmFnZS5zbmFwc2hvdEJ5TmFtZShwYXRobmFtZS5zbGljZSgxKSwgbmFtZSk7XG4gIH1cblxuICBwcml2YXRlIF9yZXNwb25kV2l0aEpzb24ob2JqZWN0OiBhbnkpOiBSZXNwb25zZSB7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeShvYmplY3QpLCB7XG4gICAgICBzdGF0dXM6IDIwMCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0NhY2hlLUNvbnRyb2wnOiAncHVibGljLCBtYXgtYWdlPTMxNTM2MDAwJyxcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgc2VydmVSZXNvdXJjZShyZXF1ZXN0VXJsQWx0ZXJuYXRpdmVzOiBzdHJpbmdbXSwgbWV0aG9kOiBzdHJpbmcsIHNuYXBzaG90VXJsOiBzdHJpbmcpOiBQcm9taXNlPFJlc3BvbnNlPiB7XG4gICAgbGV0IHJlc291cmNlOiBSZXNvdXJjZVNuYXBzaG90IHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IHNuYXBzaG90ID0gdGhpcy5fc25hcHNob3RJZHMuZ2V0KHNuYXBzaG90VXJsKSE7XG4gICAgZm9yIChjb25zdCByZXF1ZXN0VXJsIG9mIHJlcXVlc3RVcmxBbHRlcm5hdGl2ZXMpIHtcbiAgICAgIHJlc291cmNlID0gc25hcHNob3Q/LnJlc291cmNlQnlVcmwocmVtb3ZlSGFzaChyZXF1ZXN0VXJsKSwgbWV0aG9kKTtcbiAgICAgIGlmIChyZXNvdXJjZSlcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGlmICghcmVzb3VyY2UpXG4gICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHsgc3RhdHVzOiA0MDQgfSk7XG5cbiAgICBjb25zdCBzaGExID0gcmVzb3VyY2UucmVzcG9uc2UuY29udGVudC5fc2hhMTtcbiAgICBjb25zdCBjb250ZW50ID0gc2hhMSA/IGF3YWl0IHRoaXMuX3Jlc291cmNlTG9hZGVyKHNoYTEpIHx8IG5ldyBCbG9iKFtdKSA6IG5ldyBCbG9iKFtdKTtcblxuICAgIGxldCBjb250ZW50VHlwZSA9IHJlc291cmNlLnJlc3BvbnNlLmNvbnRlbnQubWltZVR5cGU7XG4gICAgY29uc3QgaXNUZXh0RW5jb2RpbmcgPSAvXnRleHRcXC98XmFwcGxpY2F0aW9uXFwvKGphdmFzY3JpcHR8anNvbikvLnRlc3QoY29udGVudFR5cGUpO1xuICAgIGlmIChpc1RleHRFbmNvZGluZyAmJiAhY29udGVudFR5cGUuaW5jbHVkZXMoJ2NoYXJzZXQnKSlcbiAgICAgIGNvbnRlbnRUeXBlID0gYCR7Y29udGVudFR5cGV9OyBjaGFyc2V0PXV0Zi04YDtcblxuICAgIGNvbnN0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICAgIC8vIFwieC11bmtub3duXCIgaW4gdGhlIGhhciBtZWFucyBcIm5vIGNvbnRlbnQgdHlwZVwiLlxuICAgIGlmIChjb250ZW50VHlwZSAhPT0gJ3gtdW5rbm93bicpXG4gICAgICBoZWFkZXJzLnNldCgnQ29udGVudC1UeXBlJywgY29udGVudFR5cGUpO1xuICAgIGZvciAoY29uc3QgeyBuYW1lLCB2YWx1ZSB9IG9mIHJlc291cmNlLnJlc3BvbnNlLmhlYWRlcnMpXG4gICAgICBoZWFkZXJzLnNldChuYW1lLCB2YWx1ZSk7XG4gICAgaGVhZGVycy5kZWxldGUoJ0NvbnRlbnQtRW5jb2RpbmcnKTtcbiAgICBoZWFkZXJzLmRlbGV0ZSgnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJyk7XG4gICAgaGVhZGVycy5zZXQoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7XG4gICAgaGVhZGVycy5kZWxldGUoJ0NvbnRlbnQtTGVuZ3RoJyk7XG4gICAgaGVhZGVycy5zZXQoJ0NvbnRlbnQtTGVuZ3RoJywgU3RyaW5nKGNvbnRlbnQuc2l6ZSkpO1xuICAgIGhlYWRlcnMuc2V0KCdDYWNoZS1Db250cm9sJywgJ3B1YmxpYywgbWF4LWFnZT0zMTUzNjAwMCcpO1xuICAgIGNvbnN0IHsgc3RhdHVzIH0gPSByZXNvdXJjZS5yZXNwb25zZTtcbiAgICBjb25zdCBpc051bGxCb2R5U3RhdHVzID0gc3RhdHVzID09PSAxMDEgfHwgc3RhdHVzID09PSAyMDQgfHwgc3RhdHVzID09PSAyMDUgfHwgc3RhdHVzID09PSAzMDQ7XG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShpc051bGxCb2R5U3RhdHVzID8gbnVsbCA6IGNvbnRlbnQsIHtcbiAgICAgIGhlYWRlcnMsXG4gICAgICBzdGF0dXM6IHJlc291cmNlLnJlc3BvbnNlLnN0YXR1cyxcbiAgICAgIHN0YXR1c1RleHQ6IHJlc291cmNlLnJlc3BvbnNlLnN0YXR1c1RleHQsXG4gICAgfSk7XG4gIH1cbn1cblxuZGVjbGFyZSBnbG9iYWwge1xuICBpbnRlcmZhY2UgV2luZG93IHtcbiAgICBzaG93U25hcHNob3Q6ICh1cmw6IHN0cmluZywgcG9pbnQ/OiBQb2ludCkgPT4gUHJvbWlzZTx2b2lkPjtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVIYXNoKHVybDogc3RyaW5nKSB7XG4gIHRyeSB7XG4gICAgY29uc3QgdSA9IG5ldyBVUkwodXJsKTtcbiAgICB1Lmhhc2ggPSAnJztcbiAgICByZXR1cm4gdS50b1N0cmluZygpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHVybDtcbiAgfVxufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBTdGFja0ZyYW1lIH0gZnJvbSAnQHByb3RvY29sL2NoYW5uZWxzJztcblxuZXhwb3J0IHR5cGUgU2VyaWFsaXplZFN0YWNrRnJhbWUgPSBbbnVtYmVyLCBudW1iZXIsIG51bWJlciwgc3RyaW5nXTtcbmV4cG9ydCB0eXBlIFNlcmlhbGl6ZWRTdGFjayA9IFtudW1iZXIsIFNlcmlhbGl6ZWRTdGFja0ZyYW1lW11dO1xuXG5leHBvcnQgdHlwZSBTZXJpYWxpemVkQ2xpZW50U2lkZUNhbGxNZXRhZGF0YSA9IHtcbiAgZmlsZXM6IHN0cmluZ1tdO1xuICBzdGFja3M6IFNlcmlhbGl6ZWRTdGFja1tdO1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ2xpZW50U2lkZUNhbGxNZXRhZGF0YShkYXRhOiBTZXJpYWxpemVkQ2xpZW50U2lkZUNhbGxNZXRhZGF0YSk6IE1hcDxzdHJpbmcsIFN0YWNrRnJhbWVbXT4ge1xuICBjb25zdCByZXN1bHQgPSBuZXcgTWFwPHN0cmluZywgU3RhY2tGcmFtZVtdPigpO1xuICBjb25zdCB7IGZpbGVzLCBzdGFja3MgfSA9IGRhdGE7XG4gIGZvciAoY29uc3QgcyBvZiBzdGFja3MpIHtcbiAgICBjb25zdCBbaWQsIGZmXSA9IHM7XG4gICAgcmVzdWx0LnNldChgY2FsbEAke2lkfWAsIGZmLm1hcChmID0+ICh7IGZpbGU6IGZpbGVzW2ZbMF1dLCBsaW5lOiBmWzFdLCBjb2x1bW46IGZbMl0sIGZ1bmN0aW9uOiBmWzNdIH0pKSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbmV4cG9ydCBjbGFzcyBMUlVDYWNoZTxLLCBWPiB7XG4gIHByaXZhdGUgX21heFNpemU6IG51bWJlcjtcbiAgcHJpdmF0ZSBfbWFwOiBNYXA8SywgeyB2YWx1ZTogViwgc2l6ZTogbnVtYmVyIH0+O1xuICBwcml2YXRlIF9zaXplOiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IobWF4U2l6ZTogbnVtYmVyKSB7XG4gICAgdGhpcy5fbWF4U2l6ZSA9IG1heFNpemU7XG4gICAgdGhpcy5fbWFwID0gbmV3IE1hcCgpO1xuICAgIHRoaXMuX3NpemUgPSAwO1xuICB9XG5cbiAgZ2V0T3JDb21wdXRlKGtleTogSywgY29tcHV0ZTogKCkgPT4geyB2YWx1ZTogViwgc2l6ZTogbnVtYmVyIH0pOiBWIHtcbiAgICBpZiAodGhpcy5fbWFwLmhhcyhrZXkpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9tYXAuZ2V0KGtleSkhO1xuICAgICAgLy8gcmVpbnNlcnRpbmcgbWFrZXMgdGhpcyB0aGUgbGVhc3QgcmVjZW50bHkgdXNlZCBlbnRyeVxuICAgICAgdGhpcy5fbWFwLmRlbGV0ZShrZXkpO1xuICAgICAgdGhpcy5fbWFwLnNldChrZXksIHJlc3VsdCk7XG4gICAgICByZXR1cm4gcmVzdWx0LnZhbHVlO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IGNvbXB1dGUoKTtcblxuICAgIHdoaWxlICh0aGlzLl9tYXAuc2l6ZSAmJiB0aGlzLl9zaXplICsgcmVzdWx0LnNpemUgPiB0aGlzLl9tYXhTaXplKSB7XG4gICAgICBjb25zdCBbZmlyc3RLZXksIGZpcnN0VmFsdWVdID0gdGhpcy5fbWFwLmVudHJpZXMoKS5uZXh0KCkudmFsdWU7XG4gICAgICB0aGlzLl9zaXplIC09IGZpcnN0VmFsdWUuc2l6ZTtcbiAgICAgIHRoaXMuX21hcC5kZWxldGUoZmlyc3RLZXkpO1xuICAgIH1cblxuICAgIHRoaXMuX21hcC5zZXQoa2V5LCByZXN1bHQpO1xuICAgIHRoaXMuX3NpemUgKz0gcmVzdWx0LnNpemU7XG4gICAgcmV0dXJuIHJlc3VsdC52YWx1ZTtcbiAgfVxufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0IHR5cGUgeyBGcmFtZVNuYXBzaG90LCBSZXNvdXJjZVNuYXBzaG90IH0gZnJvbSAnQHRyYWNlL3NuYXBzaG90JztcbmltcG9ydCB7IHJld3JpdGVVUkxGb3JDdXN0b21Qcm90b2NvbCwgU25hcHNob3RSZW5kZXJlciB9IGZyb20gJy4vc25hcHNob3RSZW5kZXJlcic7XG5pbXBvcnQgdHlwZSB7IFBhZ2VFbnRyeSB9IGZyb20gJy4uL3R5cGVzL2VudHJpZXMnO1xuaW1wb3J0IHsgTFJVQ2FjaGUgfSBmcm9tICcuL2xydUNhY2hlJztcblxuZXhwb3J0IGNsYXNzIFNuYXBzaG90U3RvcmFnZSB7XG4gIHByaXZhdGUgX3Jlc291cmNlczogUmVzb3VyY2VTbmFwc2hvdFtdID0gW107XG4gIHByaXZhdGUgX2ZyYW1lU25hcHNob3RzID0gbmV3IE1hcDxzdHJpbmcsIHtcbiAgICByYXc6IEZyYW1lU25hcHNob3RbXSxcbiAgICByZW5kZXJlcnM6IFNuYXBzaG90UmVuZGVyZXJbXVxuICB9PigpO1xuICBwcml2YXRlIF9jYWNoZSA9IG5ldyBMUlVDYWNoZTxTbmFwc2hvdFJlbmRlcmVyLCBzdHJpbmc+KDEwMF8wMDBfMDAwKTsgIC8vIDEwME1CIHBlciBlYWNoIHRyYWNlXG5cbiAgYWRkUmVzb3VyY2UocmVzb3VyY2U6IFJlc291cmNlU25hcHNob3QpOiB2b2lkIHtcbiAgICByZXNvdXJjZS5yZXF1ZXN0LnVybCA9IHJld3JpdGVVUkxGb3JDdXN0b21Qcm90b2NvbChyZXNvdXJjZS5yZXF1ZXN0LnVybCk7XG4gICAgdGhpcy5fcmVzb3VyY2VzLnB1c2gocmVzb3VyY2UpO1xuICB9XG5cbiAgYWRkRnJhbWVTbmFwc2hvdChzbmFwc2hvdDogRnJhbWVTbmFwc2hvdCwgc2NyZWVuY2FzdEZyYW1lczogUGFnZUVudHJ5WydzY3JlZW5jYXN0RnJhbWVzJ10pIHtcbiAgICBmb3IgKGNvbnN0IG92ZXJyaWRlIG9mIHNuYXBzaG90LnJlc291cmNlT3ZlcnJpZGVzKVxuICAgICAgb3ZlcnJpZGUudXJsID0gcmV3cml0ZVVSTEZvckN1c3RvbVByb3RvY29sKG92ZXJyaWRlLnVybCk7XG4gICAgbGV0IGZyYW1lU25hcHNob3RzID0gdGhpcy5fZnJhbWVTbmFwc2hvdHMuZ2V0KHNuYXBzaG90LmZyYW1lSWQpO1xuICAgIGlmICghZnJhbWVTbmFwc2hvdHMpIHtcbiAgICAgIGZyYW1lU25hcHNob3RzID0ge1xuICAgICAgICByYXc6IFtdLFxuICAgICAgICByZW5kZXJlcnM6IFtdLFxuICAgICAgfTtcbiAgICAgIHRoaXMuX2ZyYW1lU25hcHNob3RzLnNldChzbmFwc2hvdC5mcmFtZUlkLCBmcmFtZVNuYXBzaG90cyk7XG4gICAgICBpZiAoc25hcHNob3QuaXNNYWluRnJhbWUpXG4gICAgICAgIHRoaXMuX2ZyYW1lU25hcHNob3RzLnNldChzbmFwc2hvdC5wYWdlSWQsIGZyYW1lU25hcHNob3RzKTtcbiAgICB9XG4gICAgZnJhbWVTbmFwc2hvdHMucmF3LnB1c2goc25hcHNob3QpO1xuICAgIGNvbnN0IHJlbmRlcmVyID0gbmV3IFNuYXBzaG90UmVuZGVyZXIodGhpcy5fY2FjaGUsIHRoaXMuX3Jlc291cmNlcywgZnJhbWVTbmFwc2hvdHMucmF3LCBzY3JlZW5jYXN0RnJhbWVzLCBmcmFtZVNuYXBzaG90cy5yYXcubGVuZ3RoIC0gMSk7XG4gICAgZnJhbWVTbmFwc2hvdHMucmVuZGVyZXJzLnB1c2gocmVuZGVyZXIpO1xuICAgIHJldHVybiByZW5kZXJlcjtcbiAgfVxuXG4gIHNuYXBzaG90QnlOYW1lKHBhZ2VPckZyYW1lSWQ6IHN0cmluZywgc25hcHNob3ROYW1lOiBzdHJpbmcpOiBTbmFwc2hvdFJlbmRlcmVyIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBzbmFwc2hvdCA9IHRoaXMuX2ZyYW1lU25hcHNob3RzLmdldChwYWdlT3JGcmFtZUlkKTtcbiAgICByZXR1cm4gc25hcHNob3Q/LnJlbmRlcmVycy5maW5kKHIgPT4gci5zbmFwc2hvdE5hbWUgPT09IHNuYXBzaG90TmFtZSk7XG4gIH1cblxuICBzbmFwc2hvdHNGb3JUZXN0KCkge1xuICAgIHJldHVybiBbLi4udGhpcy5fZnJhbWVTbmFwc2hvdHMua2V5cygpXTtcbiAgfVxuXG4gIGZpbmFsaXplKCkge1xuICAgIC8vIFJlc291cmNlcyBhcmUgbm90IG5lY2Vzc2FyaWx5IHNvcnRlZCBpbiB0aGUgdHJhY2UgZmlsZSwgc28gc29ydCB0aGVtIG5vdy5cbiAgICB0aGlzLl9yZXNvdXJjZXMuc29ydCgoYSwgYikgPT4gKGEuX21vbm90b25pY1RpbWUgfHwgMCkgLSAoYi5fbW9ub3RvbmljVGltZSB8fCAwKSk7XG4gIH1cbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbmltcG9ydCB0eXBlICogYXMgdHJhY2UgZnJvbSAnQHRyYWNlL3RyYWNlJztcbmltcG9ydCB0eXBlICogYXMgdHJhY2VWMyBmcm9tICcuL3ZlcnNpb25zL3RyYWNlVjMnO1xuaW1wb3J0IHR5cGUgKiBhcyB0cmFjZVY0IGZyb20gJy4vdmVyc2lvbnMvdHJhY2VWNCc7XG5pbXBvcnQgdHlwZSAqIGFzIHRyYWNlVjUgZnJvbSAnLi92ZXJzaW9ucy90cmFjZVY1JztcbmltcG9ydCB0eXBlICogYXMgdHJhY2VWNiBmcm9tICcuL3ZlcnNpb25zL3RyYWNlVjYnO1xuaW1wb3J0IHR5cGUgeyBBY3Rpb25FbnRyeSwgQ29udGV4dEVudHJ5LCBQYWdlRW50cnkgfSBmcm9tICcuLi90eXBlcy9lbnRyaWVzJztcbmltcG9ydCB0eXBlIHsgU25hcHNob3RTdG9yYWdlIH0gZnJvbSAnLi9zbmFwc2hvdFN0b3JhZ2UnO1xuXG5leHBvcnQgY2xhc3MgVHJhY2VWZXJzaW9uRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9ICdUcmFjZVZlcnNpb25FcnJvcic7XG4gIH1cbn1cblxuY29uc3QgbGF0ZXN0VmVyc2lvbjogdHJhY2UuVkVSU0lPTiA9IDc7XG5cbmV4cG9ydCBjbGFzcyBUcmFjZU1vZGVybml6ZXIge1xuICBwcml2YXRlIF9jb250ZXh0RW50cnk6IENvbnRleHRFbnRyeTtcbiAgcHJpdmF0ZSBfc25hcHNob3RTdG9yYWdlOiBTbmFwc2hvdFN0b3JhZ2U7XG4gIHByaXZhdGUgX2FjdGlvbk1hcCA9IG5ldyBNYXA8c3RyaW5nLCBBY3Rpb25FbnRyeT4oKTtcbiAgcHJpdmF0ZSBfdmVyc2lvbjogbnVtYmVyIHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9wYWdlRW50cmllcyA9IG5ldyBNYXA8c3RyaW5nLCBQYWdlRW50cnk+KCk7XG4gIHByaXZhdGUgX2pzSGFuZGxlcyA9IG5ldyBNYXA8c3RyaW5nLCB7IHByZXZpZXc6IHN0cmluZyB9PigpO1xuICBwcml2YXRlIF9jb25zb2xlT2JqZWN0cyA9IG5ldyBNYXA8c3RyaW5nLCB7IHR5cGU6IHN0cmluZywgdGV4dDogc3RyaW5nLCBsb2NhdGlvbjogeyB1cmw6IHN0cmluZywgbGluZU51bWJlcjogbnVtYmVyLCBjb2x1bW5OdW1iZXI6IG51bWJlciB9LCBhcmdzPzogeyBwcmV2aWV3OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcgfVtdIH0+KCk7XG5cbiAgY29uc3RydWN0b3IoY29udGV4dEVudHJ5OiBDb250ZXh0RW50cnksIHNuYXBzaG90U3RvcmFnZTogU25hcHNob3RTdG9yYWdlKSB7XG4gICAgdGhpcy5fY29udGV4dEVudHJ5ID0gY29udGV4dEVudHJ5O1xuICAgIHRoaXMuX3NuYXBzaG90U3RvcmFnZSA9IHNuYXBzaG90U3RvcmFnZTtcbiAgfVxuXG4gIGFwcGVuZFRyYWNlKHRyYWNlOiBzdHJpbmcpIHtcbiAgICBmb3IgKGNvbnN0IGxpbmUgb2YgdHJhY2Uuc3BsaXQoJ1xcbicpKVxuICAgICAgdGhpcy5fYXBwZW5kRXZlbnQobGluZSk7XG4gIH1cblxuICBhY3Rpb25zKCk6IEFjdGlvbkVudHJ5W10ge1xuICAgIHJldHVybiBbLi4udGhpcy5fYWN0aW9uTWFwLnZhbHVlcygpXTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhZ2VFbnRyeShwYWdlSWQ6IHN0cmluZyk6IFBhZ2VFbnRyeSB7XG4gICAgbGV0IHBhZ2VFbnRyeSA9IHRoaXMuX3BhZ2VFbnRyaWVzLmdldChwYWdlSWQpO1xuICAgIGlmICghcGFnZUVudHJ5KSB7XG4gICAgICBwYWdlRW50cnkgPSB7XG4gICAgICAgIHBhZ2VJZCxcbiAgICAgICAgc2NyZWVuY2FzdEZyYW1lczogW10sXG4gICAgICB9O1xuICAgICAgdGhpcy5fcGFnZUVudHJpZXMuc2V0KHBhZ2VJZCwgcGFnZUVudHJ5KTtcbiAgICAgIHRoaXMuX2NvbnRleHRFbnRyeS5wYWdlcy5wdXNoKHBhZ2VFbnRyeSk7XG4gICAgfVxuICAgIHJldHVybiBwYWdlRW50cnk7XG4gIH1cblxuICBwcml2YXRlIF9hcHBlbmRFdmVudChsaW5lOiBzdHJpbmcpIHtcbiAgICBpZiAoIWxpbmUpXG4gICAgICByZXR1cm47XG4gICAgY29uc3QgZXZlbnRzID0gdGhpcy5fbW9kZXJuaXplKEpTT04ucGFyc2UobGluZSkpO1xuICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKVxuICAgICAgdGhpcy5faW5uZXJBcHBlbmRFdmVudChldmVudCk7XG4gIH1cblxuICBwcml2YXRlIF9pbm5lckFwcGVuZEV2ZW50KGV2ZW50OiB0cmFjZS5UcmFjZUV2ZW50KSB7XG4gICAgY29uc3QgY29udGV4dEVudHJ5ID0gdGhpcy5fY29udGV4dEVudHJ5O1xuICAgIHN3aXRjaCAoZXZlbnQudHlwZSkge1xuICAgICAgY2FzZSAnY29udGV4dC1vcHRpb25zJzoge1xuICAgICAgICBpZiAoZXZlbnQudmVyc2lvbiA+IGxhdGVzdFZlcnNpb24pXG4gICAgICAgICAgdGhyb3cgbmV3IFRyYWNlVmVyc2lvbkVycm9yKCdUaGUgdHJhY2Ugd2FzIGNyZWF0ZWQgYnkgYSBuZXdlciB2ZXJzaW9uIG9mIFBsYXl3cmlnaHQgYW5kIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyB2ZXJzaW9uIG9mIHRoZSB2aWV3ZXIuIFBsZWFzZSB1c2UgbGF0ZXN0IFBsYXl3cmlnaHQgdG8gb3BlbiB0aGUgdHJhY2UuJyk7XG4gICAgICAgIHRoaXMuX3ZlcnNpb24gPSBldmVudC52ZXJzaW9uO1xuICAgICAgICBjb250ZXh0RW50cnkub3JpZ2luID0gZXZlbnQub3JpZ2luO1xuICAgICAgICBjb250ZXh0RW50cnkuYnJvd3Nlck5hbWUgPSBldmVudC5icm93c2VyTmFtZTtcbiAgICAgICAgY29udGV4dEVudHJ5LmNoYW5uZWwgPSBldmVudC5jaGFubmVsO1xuICAgICAgICBjb250ZXh0RW50cnkudGl0bGUgPSBldmVudC50aXRsZTtcbiAgICAgICAgY29udGV4dEVudHJ5LnBsYXRmb3JtID0gZXZlbnQucGxhdGZvcm07XG4gICAgICAgIGNvbnRleHRFbnRyeS53YWxsVGltZSA9IGV2ZW50LndhbGxUaW1lO1xuICAgICAgICBjb250ZXh0RW50cnkuc3RhcnRUaW1lID0gZXZlbnQubW9ub3RvbmljVGltZTtcbiAgICAgICAgY29udGV4dEVudHJ5LnNka0xhbmd1YWdlID0gZXZlbnQuc2RrTGFuZ3VhZ2U7XG4gICAgICAgIGNvbnRleHRFbnRyeS5vcHRpb25zID0gZXZlbnQub3B0aW9ucztcbiAgICAgICAgY29udGV4dEVudHJ5LnRlc3RJZEF0dHJpYnV0ZU5hbWUgPSBldmVudC50ZXN0SWRBdHRyaWJ1dGVOYW1lO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJ3NjcmVlbmNhc3QtZnJhbWUnOiB7XG4gICAgICAgIHRoaXMuX3BhZ2VFbnRyeShldmVudC5wYWdlSWQpLnNjcmVlbmNhc3RGcmFtZXMucHVzaChldmVudCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnYmVmb3JlJzoge1xuICAgICAgICB0aGlzLl9hY3Rpb25NYXAuc2V0KGV2ZW50LmNhbGxJZCwgeyAuLi5ldmVudCwgdHlwZTogJ2FjdGlvbicsIGVuZFRpbWU6IDAsIGxvZzogW10gfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnaW5wdXQnOiB7XG4gICAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5fYWN0aW9uTWFwLmdldChldmVudC5jYWxsSWQpO1xuICAgICAgICBleGlzdGluZyEuaW5wdXRTbmFwc2hvdCA9IGV2ZW50LmlucHV0U25hcHNob3Q7XG4gICAgICAgIGV4aXN0aW5nIS5wb2ludCA9IGV2ZW50LnBvaW50O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJ2xvZyc6IHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLl9hY3Rpb25NYXAuZ2V0KGV2ZW50LmNhbGxJZCk7XG4gICAgICAgIC8vIFdlIGhhdmUgc29tZSBjb3JydXB0ZWQgdHJhY2VzIG91dCB0aGVyZSwgdG9sZXJhdGUgdGhlbS5cbiAgICAgICAgaWYgKCFleGlzdGluZylcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIGV4aXN0aW5nLmxvZy5wdXNoKHtcbiAgICAgICAgICB0aW1lOiBldmVudC50aW1lLFxuICAgICAgICAgIG1lc3NhZ2U6IGV2ZW50Lm1lc3NhZ2UsXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJ2FmdGVyJzoge1xuICAgICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuX2FjdGlvbk1hcC5nZXQoZXZlbnQuY2FsbElkKTtcbiAgICAgICAgZXhpc3RpbmchLmFmdGVyU25hcHNob3QgPSBldmVudC5hZnRlclNuYXBzaG90O1xuICAgICAgICBleGlzdGluZyEuZW5kVGltZSA9IGV2ZW50LmVuZFRpbWU7XG4gICAgICAgIGV4aXN0aW5nIS5yZXN1bHQgPSBldmVudC5yZXN1bHQ7XG4gICAgICAgIGV4aXN0aW5nIS5lcnJvciA9IGV2ZW50LmVycm9yO1xuICAgICAgICBleGlzdGluZyEuYXR0YWNobWVudHMgPSBldmVudC5hdHRhY2htZW50cztcbiAgICAgICAgaWYgKGV2ZW50LnBvaW50KVxuICAgICAgICAgIGV4aXN0aW5nIS5wb2ludCA9IGV2ZW50LnBvaW50O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJ2FjdGlvbic6IHtcbiAgICAgICAgdGhpcy5fYWN0aW9uTWFwLnNldChldmVudC5jYWxsSWQsIHsgLi4uZXZlbnQsIGxvZzogW10gfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnZXZlbnQnOiB7XG4gICAgICAgIGNvbnRleHRFbnRyeS5ldmVudHMucHVzaChldmVudCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnc3Rkb3V0Jzoge1xuICAgICAgICBjb250ZXh0RW50cnkuc3RkaW8ucHVzaChldmVudCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnc3RkZXJyJzoge1xuICAgICAgICBjb250ZXh0RW50cnkuc3RkaW8ucHVzaChldmVudCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnZXJyb3InOiB7XG4gICAgICAgIGNvbnRleHRFbnRyeS5lcnJvcnMucHVzaChldmVudCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnY29uc29sZSc6IHtcbiAgICAgICAgY29udGV4dEVudHJ5LmV2ZW50cy5wdXNoKGV2ZW50KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlICdyZXNvdXJjZS1zbmFwc2hvdCc6XG4gICAgICAgIHRoaXMuX3NuYXBzaG90U3RvcmFnZS5hZGRSZXNvdXJjZShldmVudC5zbmFwc2hvdCk7XG4gICAgICAgIGNvbnRleHRFbnRyeS5yZXNvdXJjZXMucHVzaChldmVudC5zbmFwc2hvdCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZnJhbWUtc25hcHNob3QnOlxuICAgICAgICB0aGlzLl9zbmFwc2hvdFN0b3JhZ2UuYWRkRnJhbWVTbmFwc2hvdChldmVudC5zbmFwc2hvdCwgdGhpcy5fcGFnZUVudHJ5KGV2ZW50LnNuYXBzaG90LnBhZ2VJZCkuc2NyZWVuY2FzdEZyYW1lcyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvLyBNYWtlIHN1cmUgdGhlcmUgaXMgYSBwYWdlIGVudHJ5IGZvciBlYWNoIHBhZ2UsIGV2ZW4gd2l0aG91dCBzY3JlZW5jYXN0IGZyYW1lcyxcbiAgICAvLyB0byBzaG93IGluIHRoZSBtZXRhZGF0YSB2aWV3LlxuICAgIGlmICgoJ3BhZ2VJZCcgaW4gZXZlbnQpICYmIGV2ZW50LnBhZ2VJZClcbiAgICAgIHRoaXMuX3BhZ2VFbnRyeShldmVudC5wYWdlSWQpO1xuICAgIGlmIChldmVudC50eXBlID09PSAnYWN0aW9uJyB8fCBldmVudC50eXBlID09PSAnYmVmb3JlJylcbiAgICAgIGNvbnRleHRFbnRyeS5zdGFydFRpbWUgPSBNYXRoLm1pbihjb250ZXh0RW50cnkuc3RhcnRUaW1lLCBldmVudC5zdGFydFRpbWUpO1xuICAgIGlmIChldmVudC50eXBlID09PSAnYWN0aW9uJyB8fCBldmVudC50eXBlID09PSAnYWZ0ZXInKVxuICAgICAgY29udGV4dEVudHJ5LmVuZFRpbWUgPSBNYXRoLm1heChjb250ZXh0RW50cnkuZW5kVGltZSwgZXZlbnQuZW5kVGltZSk7XG4gICAgaWYgKGV2ZW50LnR5cGUgPT09ICdldmVudCcpIHtcbiAgICAgIGNvbnRleHRFbnRyeS5zdGFydFRpbWUgPSBNYXRoLm1pbihjb250ZXh0RW50cnkuc3RhcnRUaW1lLCBldmVudC50aW1lKTtcbiAgICAgIGNvbnRleHRFbnRyeS5lbmRUaW1lID0gTWF0aC5tYXgoY29udGV4dEVudHJ5LmVuZFRpbWUsIGV2ZW50LnRpbWUpO1xuICAgIH1cbiAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ3NjcmVlbmNhc3QtZnJhbWUnKSB7XG4gICAgICBjb250ZXh0RW50cnkuc3RhcnRUaW1lID0gTWF0aC5taW4oY29udGV4dEVudHJ5LnN0YXJ0VGltZSwgZXZlbnQudGltZXN0YW1wKTtcbiAgICAgIGNvbnRleHRFbnRyeS5lbmRUaW1lID0gTWF0aC5tYXgoY29udGV4dEVudHJ5LmVuZFRpbWUsIGV2ZW50LnRpbWVzdGFtcCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfcHJvY2Vzc2VkQ29udGV4dENyZWF0ZWRFdmVudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fdmVyc2lvbiAhPT0gdW5kZWZpbmVkO1xuICB9XG5cbiAgcHJpdmF0ZSBfbW9kZXJuaXplKGV2ZW50OiBhbnkpOiB0cmFjZS5UcmFjZUV2ZW50W10ge1xuICAgIC8vIEluIHRyYWNlIDYtPjcgd2UgYWxzbyBuZWVkIHRvIG1vZGVybml6ZSBjb250ZXh0LW9wdGlvbnMgZXZlbnQuXG4gICAgbGV0IHZlcnNpb24gPSB0aGlzLl92ZXJzaW9uIHx8IGV2ZW50LnZlcnNpb247XG4gICAgaWYgKHZlcnNpb24gPT09IHVuZGVmaW5lZClcbiAgICAgIHJldHVybiBbZXZlbnRdO1xuICAgIGxldCBldmVudHMgPSBbZXZlbnRdO1xuICAgIGZvciAoOyB2ZXJzaW9uIDwgbGF0ZXN0VmVyc2lvbjsgKyt2ZXJzaW9uKVxuICAgICAgZXZlbnRzID0gKHRoaXMgYXMgYW55KVtgX21vZGVybml6ZV8ke3ZlcnNpb259X3RvXyR7dmVyc2lvbiArIDF9YF0uY2FsbCh0aGlzLCBldmVudHMpO1xuICAgIHJldHVybiBldmVudHM7XG4gIH1cblxuICBfbW9kZXJuaXplXzBfdG9fMShldmVudHM6IGFueVtdKTogYW55W10ge1xuICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XG4gICAgICBpZiAoZXZlbnQudHlwZSAhPT0gJ2FjdGlvbicpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgaWYgKHR5cGVvZiBldmVudC5tZXRhZGF0YS5lcnJvciA9PT0gJ3N0cmluZycpXG4gICAgICAgIGV2ZW50Lm1ldGFkYXRhLmVycm9yID0geyBlcnJvcjogeyBuYW1lOiAnRXJyb3InLCBtZXNzYWdlOiBldmVudC5tZXRhZGF0YS5lcnJvciB9IH07XG4gICAgfVxuICAgIHJldHVybiBldmVudHM7XG4gIH1cblxuICBfbW9kZXJuaXplXzFfdG9fMihldmVudHM6IGFueVtdKTogYW55W10ge1xuICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XG4gICAgICBpZiAoZXZlbnQudHlwZSAhPT0gJ2ZyYW1lLXNuYXBzaG90JyB8fCAhZXZlbnQuc25hcHNob3QuaXNNYWluRnJhbWUpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gT2xkIHZlcnNpb25zIGhhZCBjb21wbGV0ZWx5IHdyb25nIHZpZXdwb3J0LlxuICAgICAgZXZlbnQuc25hcHNob3Qudmlld3BvcnQgPSB0aGlzLl9jb250ZXh0RW50cnkub3B0aW9ucz8udmlld3BvcnQgfHwgeyB3aWR0aDogMTI4MCwgaGVpZ2h0OiA3MjAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGV2ZW50cztcbiAgfVxuXG4gIF9tb2Rlcm5pemVfMl90b18zKGV2ZW50czogYW55W10pOiBhbnlbXSB7XG4gICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcbiAgICAgIGlmIChldmVudC50eXBlICE9PSAncmVzb3VyY2Utc25hcHNob3QnIHx8IGV2ZW50LnNuYXBzaG90LnJlcXVlc3QpXG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgLy8gTWlncmF0ZSBmcm9tIG9sZCBSZXNvdXJjZVNuYXBzaG90IHRvIG5ldyBoYXIgZW50cnkgZm9ybWF0LlxuICAgICAgY29uc3QgcmVzb3VyY2UgPSBldmVudC5zbmFwc2hvdDtcbiAgICAgIGV2ZW50LnNuYXBzaG90ID0ge1xuICAgICAgICBfZnJhbWVyZWY6IHJlc291cmNlLmZyYW1lSWQsXG4gICAgICAgIHJlcXVlc3Q6IHtcbiAgICAgICAgICB1cmw6IHJlc291cmNlLnVybCxcbiAgICAgICAgICBtZXRob2Q6IHJlc291cmNlLm1ldGhvZCxcbiAgICAgICAgICBoZWFkZXJzOiByZXNvdXJjZS5yZXF1ZXN0SGVhZGVycyxcbiAgICAgICAgICBwb3N0RGF0YTogcmVzb3VyY2UucmVxdWVzdFNoYTEgPyB7IF9zaGExOiByZXNvdXJjZS5yZXF1ZXN0U2hhMSB9IDogdW5kZWZpbmVkLFxuICAgICAgICB9LFxuICAgICAgICByZXNwb25zZToge1xuICAgICAgICAgIHN0YXR1czogcmVzb3VyY2Uuc3RhdHVzLFxuICAgICAgICAgIGhlYWRlcnM6IHJlc291cmNlLnJlc3BvbnNlSGVhZGVycyxcbiAgICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgICBtaW1lVHlwZTogcmVzb3VyY2UuY29udGVudFR5cGUsXG4gICAgICAgICAgICBfc2hhMTogcmVzb3VyY2UucmVzcG9uc2VTaGExLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIF9tb25vdG9uaWNUaW1lOiByZXNvdXJjZS50aW1lc3RhbXAsXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gZXZlbnRzO1xuICB9XG5cbiAgX21vZGVybml6ZV8zX3RvXzQoZXZlbnRzOiB0cmFjZVYzLlRyYWNlRXZlbnRbXSk6IHRyYWNlVjQuVHJhY2VFdmVudFtdIHtcbiAgICBjb25zdCByZXN1bHQ6IHRyYWNlVjQuVHJhY2VFdmVudFtdID0gW107XG4gICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcbiAgICAgIGNvbnN0IGUgPSB0aGlzLl9tb2Rlcm5pemVfZXZlbnRfM190b180KGV2ZW50KTtcbiAgICAgIGlmIChlKVxuICAgICAgICByZXN1bHQucHVzaChlKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIF9tb2Rlcm5pemVfZXZlbnRfM190b180KGV2ZW50OiB0cmFjZVYzLlRyYWNlRXZlbnQpOiB0cmFjZVY0LlRyYWNlRXZlbnQgfCBudWxsIHtcbiAgICBpZiAoZXZlbnQudHlwZSAhPT0gJ2FjdGlvbicgJiYgZXZlbnQudHlwZSAhPT0gJ2V2ZW50Jykge1xuICAgICAgcmV0dXJuIGV2ZW50IGFzIHRyYWNlVjMuQ29udGV4dENyZWF0ZWRUcmFjZUV2ZW50IHxcbiAgICAgICAgdHJhY2VWMy5TY3JlZW5jYXN0RnJhbWVUcmFjZUV2ZW50IHxcbiAgICAgICAgdHJhY2VWMy5SZXNvdXJjZVNuYXBzaG90VHJhY2VFdmVudCB8XG4gICAgICAgIHRyYWNlVjMuRnJhbWVTbmFwc2hvdFRyYWNlRXZlbnQ7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YWRhdGEgPSBldmVudC5tZXRhZGF0YTtcbiAgICBpZiAobWV0YWRhdGEuaW50ZXJuYWwgfHwgbWV0YWRhdGEubWV0aG9kLnN0YXJ0c1dpdGgoJ3RyYWNpbmcnKSlcbiAgICAgIHJldHVybiBudWxsO1xuXG4gICAgaWYgKGV2ZW50LnR5cGUgPT09ICdldmVudCcpIHtcbiAgICAgIGlmIChtZXRhZGF0YS5tZXRob2QgPT09ICdfX2NyZWF0ZV9fJyAmJiBtZXRhZGF0YS50eXBlID09PSAnQ29uc29sZU1lc3NhZ2UnKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgY2xhc3M6IG1ldGFkYXRhLnR5cGUsXG4gICAgICAgICAgZ3VpZDogbWV0YWRhdGEucGFyYW1zLmd1aWQsXG4gICAgICAgICAgaW5pdGlhbGl6ZXI6IG1ldGFkYXRhLnBhcmFtcy5pbml0aWFsaXplcixcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHR5cGU6ICdldmVudCcsXG4gICAgICAgIHRpbWU6IG1ldGFkYXRhLnN0YXJ0VGltZSxcbiAgICAgICAgY2xhc3M6IG1ldGFkYXRhLnR5cGUsXG4gICAgICAgIG1ldGhvZDogbWV0YWRhdGEubWV0aG9kLFxuICAgICAgICBwYXJhbXM6IG1ldGFkYXRhLnBhcmFtcyxcbiAgICAgICAgcGFnZUlkOiBtZXRhZGF0YS5wYWdlSWQsXG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiAnYWN0aW9uJyxcbiAgICAgIGNhbGxJZDogbWV0YWRhdGEuaWQsXG4gICAgICBzdGFydFRpbWU6IG1ldGFkYXRhLnN0YXJ0VGltZSxcbiAgICAgIGVuZFRpbWU6IG1ldGFkYXRhLmVuZFRpbWUsXG4gICAgICBhcGlOYW1lOiBtZXRhZGF0YS5hcGlOYW1lIHx8IG1ldGFkYXRhLnR5cGUgKyAnLicgKyBtZXRhZGF0YS5tZXRob2QsXG4gICAgICBjbGFzczogbWV0YWRhdGEudHlwZSxcbiAgICAgIG1ldGhvZDogbWV0YWRhdGEubWV0aG9kLFxuICAgICAgcGFyYW1zOiBtZXRhZGF0YS5wYXJhbXMsXG4gICAgICB3YWxsVGltZTogbWV0YWRhdGEud2FsbFRpbWUgfHwgRGF0ZS5ub3coKSxcbiAgICAgIGxvZzogbWV0YWRhdGEubG9nLFxuICAgICAgYmVmb3JlU25hcHNob3Q6IG1ldGFkYXRhLnNuYXBzaG90cy5maW5kKHMgPT4gcy50aXRsZSA9PT0gJ2JlZm9yZScpPy5zbmFwc2hvdE5hbWUsXG4gICAgICBpbnB1dFNuYXBzaG90OiBtZXRhZGF0YS5zbmFwc2hvdHMuZmluZChzID0+IHMudGl0bGUgPT09ICdpbnB1dCcpPy5zbmFwc2hvdE5hbWUsXG4gICAgICBhZnRlclNuYXBzaG90OiBtZXRhZGF0YS5zbmFwc2hvdHMuZmluZChzID0+IHMudGl0bGUgPT09ICdhZnRlcicpPy5zbmFwc2hvdE5hbWUsXG4gICAgICBlcnJvcjogbWV0YWRhdGEuZXJyb3I/LmVycm9yLFxuICAgICAgcmVzdWx0OiBtZXRhZGF0YS5yZXN1bHQsXG4gICAgICBwb2ludDogbWV0YWRhdGEucG9pbnQsXG4gICAgICBwYWdlSWQ6IG1ldGFkYXRhLnBhZ2VJZCxcbiAgICB9O1xuICB9XG5cbiAgX21vZGVybml6ZV80X3RvXzUoZXZlbnRzOiB0cmFjZVY0LlRyYWNlRXZlbnRbXSk6IHRyYWNlVjUuVHJhY2VFdmVudFtdIHtcbiAgICBjb25zdCByZXN1bHQ6IHRyYWNlVjUuVHJhY2VFdmVudFtdID0gW107XG4gICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcbiAgICAgIGNvbnN0IGUgPSB0aGlzLl9tb2Rlcm5pemVfZXZlbnRfNF90b181KGV2ZW50KTtcbiAgICAgIGlmIChlKVxuICAgICAgICByZXN1bHQucHVzaChlKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIF9tb2Rlcm5pemVfZXZlbnRfNF90b181KGV2ZW50OiB0cmFjZVY0LlRyYWNlRXZlbnQpOiB0cmFjZVY1LlRyYWNlRXZlbnQgfCBudWxsIHtcbiAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ2V2ZW50JyAmJiBldmVudC5tZXRob2QgPT09ICdfX2NyZWF0ZV9fJyAmJiBldmVudC5jbGFzcyA9PT0gJ0pTSGFuZGxlJylcbiAgICAgIHRoaXMuX2pzSGFuZGxlcy5zZXQoZXZlbnQucGFyYW1zLmd1aWQsIGV2ZW50LnBhcmFtcy5pbml0aWFsaXplcik7XG4gICAgaWYgKGV2ZW50LnR5cGUgPT09ICdvYmplY3QnKSB7XG4gICAgICAvLyBXZSBkbyBub3QgZXhwZWN0IGFueSBvdGhlciAnb2JqZWN0JyBldmVudHMuXG4gICAgICBpZiAoZXZlbnQuY2xhc3MgIT09ICdDb25zb2xlTWVzc2FnZScpXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgLy8gT2xkZXIgdHJhY2VzIG1pZ2h0IGhhdmUgYGFyZ3NgIGluaGVyaXRlZCBmcm9tIHRoZSBwcm90b2NvbCBpbml0aWFsaXplciAtIGd1aWQgb2YgSlNIYW5kbGUsXG4gICAgICAvLyBidXQgbWlnaHQgYWxzbyBoYXZlIG1vZGVybiBgYXJnc2Agd2l0aCBwcmV2aWV3IGFuZCB2YWx1ZS5cbiAgICAgIGNvbnN0IGFyZ3M6IHsgcHJldmlldzogc3RyaW5nLCB2YWx1ZTogc3RyaW5nIH1bXSA9IChldmVudC5pbml0aWFsaXplciBhcyBhbnkpLmFyZ3M/Lm1hcCgoYXJnOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKGFyZy5ndWlkKSB7XG4gICAgICAgICAgY29uc3QgaGFuZGxlID0gdGhpcy5fanNIYW5kbGVzLmdldChhcmcuZ3VpZCk7XG4gICAgICAgICAgcmV0dXJuIHsgcHJldmlldzogaGFuZGxlPy5wcmV2aWV3IHx8ICcnLCB2YWx1ZTogJycgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geyBwcmV2aWV3OiBhcmcucHJldmlldyB8fCAnJywgdmFsdWU6IGFyZy52YWx1ZSB8fCAnJyB9O1xuICAgICAgfSk7XG4gICAgICB0aGlzLl9jb25zb2xlT2JqZWN0cy5zZXQoZXZlbnQuZ3VpZCwge1xuICAgICAgICB0eXBlOiBldmVudC5pbml0aWFsaXplci50eXBlLFxuICAgICAgICB0ZXh0OiBldmVudC5pbml0aWFsaXplci50ZXh0LFxuICAgICAgICBsb2NhdGlvbjogZXZlbnQuaW5pdGlhbGl6ZXIubG9jYXRpb24sXG4gICAgICAgIGFyZ3MsXG4gICAgICB9KTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ2V2ZW50JyAmJiBldmVudC5tZXRob2QgPT09ICdjb25zb2xlJykge1xuICAgICAgY29uc3QgY29uc29sZU1lc3NhZ2UgPSB0aGlzLl9jb25zb2xlT2JqZWN0cy5nZXQoZXZlbnQucGFyYW1zLm1lc3NhZ2U/Lmd1aWQgfHwgJycpO1xuICAgICAgaWYgKCFjb25zb2xlTWVzc2FnZSlcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnY29uc29sZScsXG4gICAgICAgIHRpbWU6IGV2ZW50LnRpbWUsXG4gICAgICAgIHBhZ2VJZDogZXZlbnQucGFnZUlkLFxuICAgICAgICBtZXNzYWdlVHlwZTogY29uc29sZU1lc3NhZ2UudHlwZSxcbiAgICAgICAgdGV4dDogY29uc29sZU1lc3NhZ2UudGV4dCxcbiAgICAgICAgYXJnczogY29uc29sZU1lc3NhZ2UuYXJncyxcbiAgICAgICAgbG9jYXRpb246IGNvbnNvbGVNZXNzYWdlLmxvY2F0aW9uLFxuICAgICAgfTtcbiAgICB9XG4gICAgcmV0dXJuIGV2ZW50O1xuICB9XG5cbiAgX21vZGVybml6ZV81X3RvXzYoZXZlbnRzOiB0cmFjZVY1LlRyYWNlRXZlbnRbXSk6IHRyYWNlVjYuVHJhY2VFdmVudFtdIHtcbiAgICBjb25zdCByZXN1bHQ6IHRyYWNlVjYuVHJhY2VFdmVudFtdID0gW107XG4gICAgZm9yIChjb25zdCBldmVudCBvZiBldmVudHMpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV2ZW50KTtcbiAgICAgIGlmIChldmVudC50eXBlICE9PSAnYWZ0ZXInIHx8ICFldmVudC5sb2cubGVuZ3RoKVxuICAgICAgICBjb250aW51ZTtcbiAgICAgIGZvciAoY29uc3QgbG9nIG9mIGV2ZW50LmxvZykge1xuICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ2xvZycsXG4gICAgICAgICAgY2FsbElkOiBldmVudC5jYWxsSWQsXG4gICAgICAgICAgbWVzc2FnZTogbG9nLFxuICAgICAgICAgIHRpbWU6IC0xLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIF9tb2Rlcm5pemVfNl90b183KGV2ZW50czogdHJhY2VWNi5UcmFjZUV2ZW50W10pOiB0cmFjZS5UcmFjZUV2ZW50W10ge1xuICAgIGNvbnN0IHJlc3VsdDogdHJhY2UuVHJhY2VFdmVudFtdID0gW107XG4gICAgaWYgKCF0aGlzLl9wcm9jZXNzZWRDb250ZXh0Q3JlYXRlZEV2ZW50KCkgJiYgZXZlbnRzWzBdLnR5cGUgIT09ICdjb250ZXh0LW9wdGlvbnMnKSB7XG4gICAgICBjb25zdCBldmVudDogdHJhY2UuQ29udGV4dENyZWF0ZWRUcmFjZUV2ZW50ID0ge1xuICAgICAgICB0eXBlOiAnY29udGV4dC1vcHRpb25zJyxcbiAgICAgICAgb3JpZ2luOiAndGVzdFJ1bm5lcicsXG4gICAgICAgIHZlcnNpb246IDcsXG4gICAgICAgIGJyb3dzZXJOYW1lOiAnJyxcbiAgICAgICAgb3B0aW9uczoge30sXG4gICAgICAgIHBsYXRmb3JtOiBwcm9jZXNzLnBsYXRmb3JtLFxuICAgICAgICB3YWxsVGltZTogMCxcbiAgICAgICAgbW9ub3RvbmljVGltZTogMCxcbiAgICAgICAgc2RrTGFuZ3VhZ2U6ICdqYXZhc2NyaXB0JyxcbiAgICAgIH07XG4gICAgICByZXN1bHQucHVzaChldmVudCk7XG4gICAgfVxuICAgIGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XG4gICAgICBpZiAoZXZlbnQudHlwZSA9PT0gJ2NvbnRleHQtb3B0aW9ucycpIHtcbiAgICAgICAgcmVzdWx0LnB1c2goeyAuLi5ldmVudCwgbW9ub3RvbmljVGltZTogMCwgb3JpZ2luOiAnbGlicmFyeScgfSk7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gVGFrZSB3YWxsIGFuZCBtb25vdG9uaWMgdGltZSBmcm9tIHRoZSBmaXJzdCBldmVudC5cbiAgICAgIGlmICghdGhpcy5fY29udGV4dEVudHJ5LndhbGxUaW1lICYmIGV2ZW50LnR5cGUgPT09ICdiZWZvcmUnKVxuICAgICAgICB0aGlzLl9jb250ZXh0RW50cnkud2FsbFRpbWUgPSBldmVudC53YWxsVGltZTtcbiAgICAgIGlmICghdGhpcy5fY29udGV4dEVudHJ5LnN0YXJ0VGltZSAmJiBldmVudC50eXBlID09PSAnYmVmb3JlJylcbiAgICAgICAgdGhpcy5fY29udGV4dEVudHJ5LnN0YXJ0VGltZSA9IGV2ZW50LnN0YXJ0VGltZTtcbiAgICAgIHJlc3VsdC5wdXNoKGV2ZW50KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufVxuIiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0IHsgcGFyc2VDbGllbnRTaWRlQ2FsbE1ldGFkYXRhIH0gZnJvbSAnQGlzb21vcnBoaWMvdHJhY2VVdGlscyc7XG5pbXBvcnQgdHlwZSB7IENvbnRleHRFbnRyeSB9IGZyb20gJy4uL3R5cGVzL2VudHJpZXMnO1xuaW1wb3J0IHsgU25hcHNob3RTdG9yYWdlIH0gZnJvbSAnLi9zbmFwc2hvdFN0b3JhZ2UnO1xuaW1wb3J0IHsgVHJhY2VNb2Rlcm5pemVyIH0gZnJvbSAnLi90cmFjZU1vZGVybml6ZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRyYWNlTW9kZWxCYWNrZW5kIHtcbiAgZW50cnlOYW1lcygpOiBQcm9taXNlPHN0cmluZ1tdPjtcbiAgaGFzRW50cnkoZW50cnlOYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+O1xuICByZWFkVGV4dChlbnRyeU5hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPjtcbiAgcmVhZEJsb2IoZW50cnlOYW1lOiBzdHJpbmcpOiBQcm9taXNlPEJsb2IgfCB1bmRlZmluZWQ+O1xuICBpc0xpdmUoKTogYm9vbGVhbjtcbiAgdHJhY2VVUkwoKTogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgVHJhY2VNb2RlbCB7XG4gIGNvbnRleHRFbnRyaWVzOiBDb250ZXh0RW50cnlbXSA9IFtdO1xuICBwcml2YXRlIF9zbmFwc2hvdFN0b3JhZ2U6IFNuYXBzaG90U3RvcmFnZSB8IHVuZGVmaW5lZDtcbiAgcHJpdmF0ZSBfYmFja2VuZCE6IFRyYWNlTW9kZWxCYWNrZW5kO1xuICBwcml2YXRlIF9yZXNvdXJjZVRvQ29udGVudFR5cGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG5cbiAgYXN5bmMgbG9hZChiYWNrZW5kOiBUcmFjZU1vZGVsQmFja2VuZCwgdW56aXBQcm9ncmVzczogKGRvbmU6IG51bWJlciwgdG90YWw6IG51bWJlcikgPT4gdm9pZCkge1xuICAgIHRoaXMuX2JhY2tlbmQgPSBiYWNrZW5kO1xuXG4gICAgY29uc3Qgb3JkaW5hbHM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGhhc1NvdXJjZSA9IGZhbHNlO1xuICAgIGZvciAoY29uc3QgZW50cnlOYW1lIG9mIGF3YWl0IHRoaXMuX2JhY2tlbmQuZW50cnlOYW1lcygpKSB7XG4gICAgICBjb25zdCBtYXRjaCA9IGVudHJ5TmFtZS5tYXRjaCgvKC4rKVxcLnRyYWNlLyk7XG4gICAgICBpZiAobWF0Y2gpXG4gICAgICAgIG9yZGluYWxzLnB1c2gobWF0Y2hbMV0gfHwgJycpO1xuICAgICAgaWYgKGVudHJ5TmFtZS5pbmNsdWRlcygnc3JjQCcpKVxuICAgICAgICBoYXNTb3VyY2UgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoIW9yZGluYWxzLmxlbmd0aClcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZpbmQgLnRyYWNlIGZpbGUnKTtcblxuICAgIHRoaXMuX3NuYXBzaG90U3RvcmFnZSA9IG5ldyBTbmFwc2hvdFN0b3JhZ2UoKTtcblxuICAgIC8vIDMgKiBvcmRpbmFscyBwcm9ncmVzcyBpbmNyZW1lbnRzIGJlbG93LlxuICAgIGNvbnN0IHRvdGFsID0gb3JkaW5hbHMubGVuZ3RoICogMztcbiAgICBsZXQgZG9uZSA9IDA7XG4gICAgZm9yIChjb25zdCBvcmRpbmFsIG9mIG9yZGluYWxzKSB7XG4gICAgICBjb25zdCBjb250ZXh0RW50cnkgPSBjcmVhdGVFbXB0eUNvbnRleHQoKTtcbiAgICAgIGNvbnRleHRFbnRyeS50cmFjZVVybCA9IGJhY2tlbmQudHJhY2VVUkwoKTtcbiAgICAgIGNvbnRleHRFbnRyeS5oYXNTb3VyY2UgPSBoYXNTb3VyY2U7XG4gICAgICBjb25zdCBtb2Rlcm5pemVyID0gbmV3IFRyYWNlTW9kZXJuaXplcihjb250ZXh0RW50cnksIHRoaXMuX3NuYXBzaG90U3RvcmFnZSk7XG5cbiAgICAgIGNvbnN0IHRyYWNlID0gYXdhaXQgdGhpcy5fYmFja2VuZC5yZWFkVGV4dChvcmRpbmFsICsgJy50cmFjZScpIHx8ICcnO1xuICAgICAgbW9kZXJuaXplci5hcHBlbmRUcmFjZSh0cmFjZSk7XG4gICAgICB1bnppcFByb2dyZXNzKCsrZG9uZSwgdG90YWwpO1xuXG4gICAgICBjb25zdCBuZXR3b3JrID0gYXdhaXQgdGhpcy5fYmFja2VuZC5yZWFkVGV4dChvcmRpbmFsICsgJy5uZXR3b3JrJykgfHwgJyc7XG4gICAgICBtb2Rlcm5pemVyLmFwcGVuZFRyYWNlKG5ldHdvcmspO1xuICAgICAgdW56aXBQcm9ncmVzcygrK2RvbmUsIHRvdGFsKTtcblxuICAgICAgY29udGV4dEVudHJ5LmFjdGlvbnMgPSBtb2Rlcm5pemVyLmFjdGlvbnMoKS5zb3J0KChhMSwgYTIpID0+IGExLnN0YXJ0VGltZSAtIGEyLnN0YXJ0VGltZSk7XG5cbiAgICAgIGlmICghYmFja2VuZC5pc0xpdmUoKSkge1xuICAgICAgICAvLyBUZXJtaW5hdGUgYWN0aW9ucyB3L28gYWZ0ZXIgZXZlbnQgZ3JhY2VmdWxseS5cbiAgICAgICAgLy8gVGhpcyB3b3VsZCBjbG9zZSBhZnRlciBob29rcyBldmVudCB0aGF0IGhhcyBub3QgYmVlbiBjbG9zZWQgYmVjYXVzZVxuICAgICAgICAvLyB0aGUgdHJhY2UgaXMgdXN1YWxseSBzYXZlZCBiZWZvcmUgYWZ0ZXIgaG9va3MgY29tcGxldGUuXG4gICAgICAgIGZvciAoY29uc3QgYWN0aW9uIG9mIGNvbnRleHRFbnRyeS5hY3Rpb25zLnNsaWNlKCkucmV2ZXJzZSgpKSB7XG4gICAgICAgICAgaWYgKCFhY3Rpb24uZW5kVGltZSAmJiAhYWN0aW9uLmVycm9yKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGEgb2YgY29udGV4dEVudHJ5LmFjdGlvbnMpIHtcbiAgICAgICAgICAgICAgaWYgKGEucGFyZW50SWQgPT09IGFjdGlvbi5jYWxsSWQgJiYgYWN0aW9uLmVuZFRpbWUgPCBhLmVuZFRpbWUpXG4gICAgICAgICAgICAgICAgYWN0aW9uLmVuZFRpbWUgPSBhLmVuZFRpbWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHN0YWNrcyA9IGF3YWl0IHRoaXMuX2JhY2tlbmQucmVhZFRleHQob3JkaW5hbCArICcuc3RhY2tzJyk7XG4gICAgICBpZiAoc3RhY2tzKSB7XG4gICAgICAgIGNvbnN0IGNhbGxNZXRhZGF0YSA9IHBhcnNlQ2xpZW50U2lkZUNhbGxNZXRhZGF0YShKU09OLnBhcnNlKHN0YWNrcykpO1xuICAgICAgICBmb3IgKGNvbnN0IGFjdGlvbiBvZiBjb250ZXh0RW50cnkuYWN0aW9ucylcbiAgICAgICAgICBhY3Rpb24uc3RhY2sgPSBhY3Rpb24uc3RhY2sgfHwgY2FsbE1ldGFkYXRhLmdldChhY3Rpb24uY2FsbElkKTtcbiAgICAgIH1cbiAgICAgIHVuemlwUHJvZ3Jlc3MoKytkb25lLCB0b3RhbCk7XG5cbiAgICAgIGZvciAoY29uc3QgcmVzb3VyY2Ugb2YgY29udGV4dEVudHJ5LnJlc291cmNlcykge1xuICAgICAgICBpZiAocmVzb3VyY2UucmVxdWVzdC5wb3N0RGF0YT8uX3NoYTEpXG4gICAgICAgICAgdGhpcy5fcmVzb3VyY2VUb0NvbnRlbnRUeXBlLnNldChyZXNvdXJjZS5yZXF1ZXN0LnBvc3REYXRhLl9zaGExLCBzdHJpcEVuY29kaW5nRnJvbUNvbnRlbnRUeXBlKHJlc291cmNlLnJlcXVlc3QucG9zdERhdGEubWltZVR5cGUpKTtcbiAgICAgICAgaWYgKHJlc291cmNlLnJlc3BvbnNlLmNvbnRlbnQ/Ll9zaGExKVxuICAgICAgICAgIHRoaXMuX3Jlc291cmNlVG9Db250ZW50VHlwZS5zZXQocmVzb3VyY2UucmVzcG9uc2UuY29udGVudC5fc2hhMSwgc3RyaXBFbmNvZGluZ0Zyb21Db250ZW50VHlwZShyZXNvdXJjZS5yZXNwb25zZS5jb250ZW50Lm1pbWVUeXBlKSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuY29udGV4dEVudHJpZXMucHVzaChjb250ZXh0RW50cnkpO1xuICAgIH1cblxuICAgIHRoaXMuX3NuYXBzaG90U3RvcmFnZSEuZmluYWxpemUoKTtcbiAgfVxuXG4gIGFzeW5jIGhhc0VudHJ5KGZpbGVuYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICByZXR1cm4gdGhpcy5fYmFja2VuZC5oYXNFbnRyeShmaWxlbmFtZSk7XG4gIH1cblxuICBhc3luYyByZXNvdXJjZUZvclNoYTEoc2hhMTogc3RyaW5nKTogUHJvbWlzZTxCbG9iIHwgdW5kZWZpbmVkPiB7XG4gICAgY29uc3QgYmxvYiA9IGF3YWl0IHRoaXMuX2JhY2tlbmQucmVhZEJsb2IoJ3Jlc291cmNlcy8nICsgc2hhMSk7XG4gICAgY29uc3QgY29udGVudFR5cGUgPSB0aGlzLl9yZXNvdXJjZVRvQ29udGVudFR5cGUuZ2V0KHNoYTEpO1xuICAgIC8vIFwieC11bmtub3duXCIgaW4gdGhlIGhhciBtZWFucyBcIm5vIGNvbnRlbnQgdHlwZVwiLlxuICAgIGlmICghYmxvYiB8fCBjb250ZW50VHlwZSA9PT0gdW5kZWZpbmVkIHx8IGNvbnRlbnRUeXBlID09PSAneC11bmtub3duJylcbiAgICAgIHJldHVybiBibG9iO1xuICAgIHJldHVybiBuZXcgQmxvYihbYmxvYl0sIHsgdHlwZTogY29udGVudFR5cGUgfSk7XG4gIH1cblxuICBzdG9yYWdlKCk6IFNuYXBzaG90U3RvcmFnZSB7XG4gICAgcmV0dXJuIHRoaXMuX3NuYXBzaG90U3RvcmFnZSE7XG4gIH1cbn1cblxuZnVuY3Rpb24gc3RyaXBFbmNvZGluZ0Zyb21Db250ZW50VHlwZShjb250ZW50VHlwZTogc3RyaW5nKSB7XG4gIGNvbnN0IGNoYXJzZXQgPSBjb250ZW50VHlwZS5tYXRjaCgvXiguKik7XFxzKmNoYXJzZXQ9LiokLyk7XG4gIGlmIChjaGFyc2V0KVxuICAgIHJldHVybiBjaGFyc2V0WzFdO1xuICByZXR1cm4gY29udGVudFR5cGU7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUVtcHR5Q29udGV4dCgpOiBDb250ZXh0RW50cnkge1xuICByZXR1cm4ge1xuICAgIG9yaWdpbjogJ3Rlc3RSdW5uZXInLFxuICAgIHRyYWNlVXJsOiAnJyxcbiAgICBzdGFydFRpbWU6IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLFxuICAgIHdhbGxUaW1lOiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUixcbiAgICBlbmRUaW1lOiAwLFxuICAgIGJyb3dzZXJOYW1lOiAnJyxcbiAgICBvcHRpb25zOiB7XG4gICAgICBkZXZpY2VTY2FsZUZhY3RvcjogMSxcbiAgICAgIGlzTW9iaWxlOiBmYWxzZSxcbiAgICAgIHZpZXdwb3J0OiB7IHdpZHRoOiAxMjgwLCBoZWlnaHQ6IDgwMCB9LFxuICAgIH0sXG4gICAgcGFnZXM6IFtdLFxuICAgIHJlc291cmNlczogW10sXG4gICAgYWN0aW9uczogW10sXG4gICAgZXZlbnRzOiBbXSxcbiAgICBlcnJvcnM6IFtdLFxuICAgIHN0ZGlvOiBbXSxcbiAgICBoYXNTb3VyY2U6IGZhbHNlLFxuICB9O1xufVxuIiwiLypcbiBDb3B5cmlnaHQgKGMpIDIwMjIgR2lsZGFzIExvcm1lYXUuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cbiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuXG4gMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgXG4gbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIFxuIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuXG4gMy4gVGhlIG5hbWVzIG9mIHRoZSBhdXRob3JzIG1heSBub3QgYmUgdXNlZCB0byBlbmRvcnNlIG9yIHByb21vdGUgcHJvZHVjdHNcbiBkZXJpdmVkIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cblxuIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgJydBUyBJUycnIEFORCBBTlkgRVhQUkVTU0VEIE9SIElNUExJRUQgV0FSUkFOVElFUyxcbiBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EXG4gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIEpDUkFGVCxcbiBJTkMuIE9SIEFOWSBDT05UUklCVVRPUlMgVE8gVEhJUyBTT0ZUV0FSRSBCRSBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULFxuIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1RcbiBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSxcbiBPUiBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GXG4gTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkdcbiBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsXG4gRVZFTiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqL1xuXG4vKlxuICogVGhpcyBwcm9ncmFtIGlzIGJhc2VkIG9uIEpabGliIDEuMC4yIHltbmssIEpDcmFmdCxJbmMuXG4gKiBKWmxpYiBpcyBiYXNlZCBvbiB6bGliLTEuMS4zLCBzbyBhbGwgY3JlZGl0IHNob3VsZCBnbyBhdXRob3JzXG4gKiBKZWFuLWxvdXAgR2FpbGx5KGpsb3VwQGd6aXAub3JnKSBhbmQgTWFyayBBZGxlcihtYWRsZXJAYWx1bW5pLmNhbHRlY2guZWR1KVxuICogYW5kIGNvbnRyaWJ1dG9ycyBvZiB6bGliLlxuICovXG5cbi8vIGRlbm8tbGludC1pZ25vcmUtZmlsZSBuby10aGlzLWFsaWFzIHByZWZlci1jb25zdFxuXG4vLyBHbG9iYWxcblxuY29uc3QgTUFYX0JJVFMgPSAxNTtcblxuY29uc3QgWl9PSyA9IDA7XG5jb25zdCBaX1NUUkVBTV9FTkQgPSAxO1xuY29uc3QgWl9ORUVEX0RJQ1QgPSAyO1xuY29uc3QgWl9TVFJFQU1fRVJST1IgPSAtMjtcbmNvbnN0IFpfREFUQV9FUlJPUiA9IC0zO1xuY29uc3QgWl9NRU1fRVJST1IgPSAtNDtcbmNvbnN0IFpfQlVGX0VSUk9SID0gLTU7XG5cbmNvbnN0IGluZmxhdGVfbWFzayA9IFsweDAwMDAwMDAwLCAweDAwMDAwMDAxLCAweDAwMDAwMDAzLCAweDAwMDAwMDA3LCAweDAwMDAwMDBmLCAweDAwMDAwMDFmLCAweDAwMDAwMDNmLCAweDAwMDAwMDdmLCAweDAwMDAwMGZmLCAweDAwMDAwMWZmLCAweDAwMDAwM2ZmLFxuXHQweDAwMDAwN2ZmLCAweDAwMDAwZmZmLCAweDAwMDAxZmZmLCAweDAwMDAzZmZmLCAweDAwMDA3ZmZmLCAweDAwMDBmZmZmXTtcblxuY29uc3QgTUFOWSA9IDE0NDA7XG5cbi8vIEpabGliIHZlcnNpb24gOiBcIjEuMC4yXCJcbmNvbnN0IFpfTk9fRkxVU0ggPSAwO1xuY29uc3QgWl9GSU5JU0ggPSA0O1xuXG4vLyBJbmZUcmVlXG5jb25zdCBmaXhlZF9ibCA9IDk7XG5jb25zdCBmaXhlZF9iZCA9IDU7XG5cbmNvbnN0IGZpeGVkX3RsID0gWzk2LCA3LCAyNTYsIDAsIDgsIDgwLCAwLCA4LCAxNiwgODQsIDgsIDExNSwgODIsIDcsIDMxLCAwLCA4LCAxMTIsIDAsIDgsIDQ4LCAwLCA5LCAxOTIsIDgwLCA3LCAxMCwgMCwgOCwgOTYsIDAsIDgsIDMyLCAwLCA5LCAxNjAsIDAsIDgsIDAsXG5cdDAsIDgsIDEyOCwgMCwgOCwgNjQsIDAsIDksIDIyNCwgODAsIDcsIDYsIDAsIDgsIDg4LCAwLCA4LCAyNCwgMCwgOSwgMTQ0LCA4MywgNywgNTksIDAsIDgsIDEyMCwgMCwgOCwgNTYsIDAsIDksIDIwOCwgODEsIDcsIDE3LCAwLCA4LCAxMDQsIDAsIDgsIDQwLFxuXHQwLCA5LCAxNzYsIDAsIDgsIDgsIDAsIDgsIDEzNiwgMCwgOCwgNzIsIDAsIDksIDI0MCwgODAsIDcsIDQsIDAsIDgsIDg0LCAwLCA4LCAyMCwgODUsIDgsIDIyNywgODMsIDcsIDQzLCAwLCA4LCAxMTYsIDAsIDgsIDUyLCAwLCA5LCAyMDAsIDgxLCA3LCAxMyxcblx0MCwgOCwgMTAwLCAwLCA4LCAzNiwgMCwgOSwgMTY4LCAwLCA4LCA0LCAwLCA4LCAxMzIsIDAsIDgsIDY4LCAwLCA5LCAyMzIsIDgwLCA3LCA4LCAwLCA4LCA5MiwgMCwgOCwgMjgsIDAsIDksIDE1MiwgODQsIDcsIDgzLCAwLCA4LCAxMjQsIDAsIDgsIDYwLFxuXHQwLCA5LCAyMTYsIDgyLCA3LCAyMywgMCwgOCwgMTA4LCAwLCA4LCA0NCwgMCwgOSwgMTg0LCAwLCA4LCAxMiwgMCwgOCwgMTQwLCAwLCA4LCA3NiwgMCwgOSwgMjQ4LCA4MCwgNywgMywgMCwgOCwgODIsIDAsIDgsIDE4LCA4NSwgOCwgMTYzLCA4MywgNyxcblx0MzUsIDAsIDgsIDExNCwgMCwgOCwgNTAsIDAsIDksIDE5NiwgODEsIDcsIDExLCAwLCA4LCA5OCwgMCwgOCwgMzQsIDAsIDksIDE2NCwgMCwgOCwgMiwgMCwgOCwgMTMwLCAwLCA4LCA2NiwgMCwgOSwgMjI4LCA4MCwgNywgNywgMCwgOCwgOTAsIDAsIDgsXG5cdDI2LCAwLCA5LCAxNDgsIDg0LCA3LCA2NywgMCwgOCwgMTIyLCAwLCA4LCA1OCwgMCwgOSwgMjEyLCA4MiwgNywgMTksIDAsIDgsIDEwNiwgMCwgOCwgNDIsIDAsIDksIDE4MCwgMCwgOCwgMTAsIDAsIDgsIDEzOCwgMCwgOCwgNzQsIDAsIDksIDI0NCwgODAsXG5cdDcsIDUsIDAsIDgsIDg2LCAwLCA4LCAyMiwgMTkyLCA4LCAwLCA4MywgNywgNTEsIDAsIDgsIDExOCwgMCwgOCwgNTQsIDAsIDksIDIwNCwgODEsIDcsIDE1LCAwLCA4LCAxMDIsIDAsIDgsIDM4LCAwLCA5LCAxNzIsIDAsIDgsIDYsIDAsIDgsIDEzNCwgMCxcblx0OCwgNzAsIDAsIDksIDIzNiwgODAsIDcsIDksIDAsIDgsIDk0LCAwLCA4LCAzMCwgMCwgOSwgMTU2LCA4NCwgNywgOTksIDAsIDgsIDEyNiwgMCwgOCwgNjIsIDAsIDksIDIyMCwgODIsIDcsIDI3LCAwLCA4LCAxMTAsIDAsIDgsIDQ2LCAwLCA5LCAxODgsIDAsXG5cdDgsIDE0LCAwLCA4LCAxNDIsIDAsIDgsIDc4LCAwLCA5LCAyNTIsIDk2LCA3LCAyNTYsIDAsIDgsIDgxLCAwLCA4LCAxNywgODUsIDgsIDEzMSwgODIsIDcsIDMxLCAwLCA4LCAxMTMsIDAsIDgsIDQ5LCAwLCA5LCAxOTQsIDgwLCA3LCAxMCwgMCwgOCwgOTcsXG5cdDAsIDgsIDMzLCAwLCA5LCAxNjIsIDAsIDgsIDEsIDAsIDgsIDEyOSwgMCwgOCwgNjUsIDAsIDksIDIyNiwgODAsIDcsIDYsIDAsIDgsIDg5LCAwLCA4LCAyNSwgMCwgOSwgMTQ2LCA4MywgNywgNTksIDAsIDgsIDEyMSwgMCwgOCwgNTcsIDAsIDksIDIxMCxcblx0ODEsIDcsIDE3LCAwLCA4LCAxMDUsIDAsIDgsIDQxLCAwLCA5LCAxNzgsIDAsIDgsIDksIDAsIDgsIDEzNywgMCwgOCwgNzMsIDAsIDksIDI0MiwgODAsIDcsIDQsIDAsIDgsIDg1LCAwLCA4LCAyMSwgODAsIDgsIDI1OCwgODMsIDcsIDQzLCAwLCA4LCAxMTcsXG5cdDAsIDgsIDUzLCAwLCA5LCAyMDIsIDgxLCA3LCAxMywgMCwgOCwgMTAxLCAwLCA4LCAzNywgMCwgOSwgMTcwLCAwLCA4LCA1LCAwLCA4LCAxMzMsIDAsIDgsIDY5LCAwLCA5LCAyMzQsIDgwLCA3LCA4LCAwLCA4LCA5MywgMCwgOCwgMjksIDAsIDksIDE1NCxcblx0ODQsIDcsIDgzLCAwLCA4LCAxMjUsIDAsIDgsIDYxLCAwLCA5LCAyMTgsIDgyLCA3LCAyMywgMCwgOCwgMTA5LCAwLCA4LCA0NSwgMCwgOSwgMTg2LCAwLCA4LCAxMywgMCwgOCwgMTQxLCAwLCA4LCA3NywgMCwgOSwgMjUwLCA4MCwgNywgMywgMCwgOCwgODMsXG5cdDAsIDgsIDE5LCA4NSwgOCwgMTk1LCA4MywgNywgMzUsIDAsIDgsIDExNSwgMCwgOCwgNTEsIDAsIDksIDE5OCwgODEsIDcsIDExLCAwLCA4LCA5OSwgMCwgOCwgMzUsIDAsIDksIDE2NiwgMCwgOCwgMywgMCwgOCwgMTMxLCAwLCA4LCA2NywgMCwgOSwgMjMwLFxuXHQ4MCwgNywgNywgMCwgOCwgOTEsIDAsIDgsIDI3LCAwLCA5LCAxNTAsIDg0LCA3LCA2NywgMCwgOCwgMTIzLCAwLCA4LCA1OSwgMCwgOSwgMjE0LCA4MiwgNywgMTksIDAsIDgsIDEwNywgMCwgOCwgNDMsIDAsIDksIDE4MiwgMCwgOCwgMTEsIDAsIDgsIDEzOSxcblx0MCwgOCwgNzUsIDAsIDksIDI0NiwgODAsIDcsIDUsIDAsIDgsIDg3LCAwLCA4LCAyMywgMTkyLCA4LCAwLCA4MywgNywgNTEsIDAsIDgsIDExOSwgMCwgOCwgNTUsIDAsIDksIDIwNiwgODEsIDcsIDE1LCAwLCA4LCAxMDMsIDAsIDgsIDM5LCAwLCA5LCAxNzQsXG5cdDAsIDgsIDcsIDAsIDgsIDEzNSwgMCwgOCwgNzEsIDAsIDksIDIzOCwgODAsIDcsIDksIDAsIDgsIDk1LCAwLCA4LCAzMSwgMCwgOSwgMTU4LCA4NCwgNywgOTksIDAsIDgsIDEyNywgMCwgOCwgNjMsIDAsIDksIDIyMiwgODIsIDcsIDI3LCAwLCA4LCAxMTEsXG5cdDAsIDgsIDQ3LCAwLCA5LCAxOTAsIDAsIDgsIDE1LCAwLCA4LCAxNDMsIDAsIDgsIDc5LCAwLCA5LCAyNTQsIDk2LCA3LCAyNTYsIDAsIDgsIDgwLCAwLCA4LCAxNiwgODQsIDgsIDExNSwgODIsIDcsIDMxLCAwLCA4LCAxMTIsIDAsIDgsIDQ4LCAwLCA5LFxuXHQxOTMsIDgwLCA3LCAxMCwgMCwgOCwgOTYsIDAsIDgsIDMyLCAwLCA5LCAxNjEsIDAsIDgsIDAsIDAsIDgsIDEyOCwgMCwgOCwgNjQsIDAsIDksIDIyNSwgODAsIDcsIDYsIDAsIDgsIDg4LCAwLCA4LCAyNCwgMCwgOSwgMTQ1LCA4MywgNywgNTksIDAsIDgsXG5cdDEyMCwgMCwgOCwgNTYsIDAsIDksIDIwOSwgODEsIDcsIDE3LCAwLCA4LCAxMDQsIDAsIDgsIDQwLCAwLCA5LCAxNzcsIDAsIDgsIDgsIDAsIDgsIDEzNiwgMCwgOCwgNzIsIDAsIDksIDI0MSwgODAsIDcsIDQsIDAsIDgsIDg0LCAwLCA4LCAyMCwgODUsIDgsXG5cdDIyNywgODMsIDcsIDQzLCAwLCA4LCAxMTYsIDAsIDgsIDUyLCAwLCA5LCAyMDEsIDgxLCA3LCAxMywgMCwgOCwgMTAwLCAwLCA4LCAzNiwgMCwgOSwgMTY5LCAwLCA4LCA0LCAwLCA4LCAxMzIsIDAsIDgsIDY4LCAwLCA5LCAyMzMsIDgwLCA3LCA4LCAwLCA4LFxuXHQ5MiwgMCwgOCwgMjgsIDAsIDksIDE1MywgODQsIDcsIDgzLCAwLCA4LCAxMjQsIDAsIDgsIDYwLCAwLCA5LCAyMTcsIDgyLCA3LCAyMywgMCwgOCwgMTA4LCAwLCA4LCA0NCwgMCwgOSwgMTg1LCAwLCA4LCAxMiwgMCwgOCwgMTQwLCAwLCA4LCA3NiwgMCwgOSxcblx0MjQ5LCA4MCwgNywgMywgMCwgOCwgODIsIDAsIDgsIDE4LCA4NSwgOCwgMTYzLCA4MywgNywgMzUsIDAsIDgsIDExNCwgMCwgOCwgNTAsIDAsIDksIDE5NywgODEsIDcsIDExLCAwLCA4LCA5OCwgMCwgOCwgMzQsIDAsIDksIDE2NSwgMCwgOCwgMiwgMCwgOCxcblx0MTMwLCAwLCA4LCA2NiwgMCwgOSwgMjI5LCA4MCwgNywgNywgMCwgOCwgOTAsIDAsIDgsIDI2LCAwLCA5LCAxNDksIDg0LCA3LCA2NywgMCwgOCwgMTIyLCAwLCA4LCA1OCwgMCwgOSwgMjEzLCA4MiwgNywgMTksIDAsIDgsIDEwNiwgMCwgOCwgNDIsIDAsIDksXG5cdDE4MSwgMCwgOCwgMTAsIDAsIDgsIDEzOCwgMCwgOCwgNzQsIDAsIDksIDI0NSwgODAsIDcsIDUsIDAsIDgsIDg2LCAwLCA4LCAyMiwgMTkyLCA4LCAwLCA4MywgNywgNTEsIDAsIDgsIDExOCwgMCwgOCwgNTQsIDAsIDksIDIwNSwgODEsIDcsIDE1LCAwLCA4LFxuXHQxMDIsIDAsIDgsIDM4LCAwLCA5LCAxNzMsIDAsIDgsIDYsIDAsIDgsIDEzNCwgMCwgOCwgNzAsIDAsIDksIDIzNywgODAsIDcsIDksIDAsIDgsIDk0LCAwLCA4LCAzMCwgMCwgOSwgMTU3LCA4NCwgNywgOTksIDAsIDgsIDEyNiwgMCwgOCwgNjIsIDAsIDksXG5cdDIyMSwgODIsIDcsIDI3LCAwLCA4LCAxMTAsIDAsIDgsIDQ2LCAwLCA5LCAxODksIDAsIDgsIDE0LCAwLCA4LCAxNDIsIDAsIDgsIDc4LCAwLCA5LCAyNTMsIDk2LCA3LCAyNTYsIDAsIDgsIDgxLCAwLCA4LCAxNywgODUsIDgsIDEzMSwgODIsIDcsIDMxLCAwLFxuXHQ4LCAxMTMsIDAsIDgsIDQ5LCAwLCA5LCAxOTUsIDgwLCA3LCAxMCwgMCwgOCwgOTcsIDAsIDgsIDMzLCAwLCA5LCAxNjMsIDAsIDgsIDEsIDAsIDgsIDEyOSwgMCwgOCwgNjUsIDAsIDksIDIyNywgODAsIDcsIDYsIDAsIDgsIDg5LCAwLCA4LCAyNSwgMCwgOSxcblx0MTQ3LCA4MywgNywgNTksIDAsIDgsIDEyMSwgMCwgOCwgNTcsIDAsIDksIDIxMSwgODEsIDcsIDE3LCAwLCA4LCAxMDUsIDAsIDgsIDQxLCAwLCA5LCAxNzksIDAsIDgsIDksIDAsIDgsIDEzNywgMCwgOCwgNzMsIDAsIDksIDI0MywgODAsIDcsIDQsIDAsIDgsXG5cdDg1LCAwLCA4LCAyMSwgODAsIDgsIDI1OCwgODMsIDcsIDQzLCAwLCA4LCAxMTcsIDAsIDgsIDUzLCAwLCA5LCAyMDMsIDgxLCA3LCAxMywgMCwgOCwgMTAxLCAwLCA4LCAzNywgMCwgOSwgMTcxLCAwLCA4LCA1LCAwLCA4LCAxMzMsIDAsIDgsIDY5LCAwLCA5LFxuXHQyMzUsIDgwLCA3LCA4LCAwLCA4LCA5MywgMCwgOCwgMjksIDAsIDksIDE1NSwgODQsIDcsIDgzLCAwLCA4LCAxMjUsIDAsIDgsIDYxLCAwLCA5LCAyMTksIDgyLCA3LCAyMywgMCwgOCwgMTA5LCAwLCA4LCA0NSwgMCwgOSwgMTg3LCAwLCA4LCAxMywgMCwgOCxcblx0MTQxLCAwLCA4LCA3NywgMCwgOSwgMjUxLCA4MCwgNywgMywgMCwgOCwgODMsIDAsIDgsIDE5LCA4NSwgOCwgMTk1LCA4MywgNywgMzUsIDAsIDgsIDExNSwgMCwgOCwgNTEsIDAsIDksIDE5OSwgODEsIDcsIDExLCAwLCA4LCA5OSwgMCwgOCwgMzUsIDAsIDksXG5cdDE2NywgMCwgOCwgMywgMCwgOCwgMTMxLCAwLCA4LCA2NywgMCwgOSwgMjMxLCA4MCwgNywgNywgMCwgOCwgOTEsIDAsIDgsIDI3LCAwLCA5LCAxNTEsIDg0LCA3LCA2NywgMCwgOCwgMTIzLCAwLCA4LCA1OSwgMCwgOSwgMjE1LCA4MiwgNywgMTksIDAsIDgsXG5cdDEwNywgMCwgOCwgNDMsIDAsIDksIDE4MywgMCwgOCwgMTEsIDAsIDgsIDEzOSwgMCwgOCwgNzUsIDAsIDksIDI0NywgODAsIDcsIDUsIDAsIDgsIDg3LCAwLCA4LCAyMywgMTkyLCA4LCAwLCA4MywgNywgNTEsIDAsIDgsIDExOSwgMCwgOCwgNTUsIDAsIDksXG5cdDIwNywgODEsIDcsIDE1LCAwLCA4LCAxMDMsIDAsIDgsIDM5LCAwLCA5LCAxNzUsIDAsIDgsIDcsIDAsIDgsIDEzNSwgMCwgOCwgNzEsIDAsIDksIDIzOSwgODAsIDcsIDksIDAsIDgsIDk1LCAwLCA4LCAzMSwgMCwgOSwgMTU5LCA4NCwgNywgOTksIDAsIDgsXG5cdDEyNywgMCwgOCwgNjMsIDAsIDksIDIyMywgODIsIDcsIDI3LCAwLCA4LCAxMTEsIDAsIDgsIDQ3LCAwLCA5LCAxOTEsIDAsIDgsIDE1LCAwLCA4LCAxNDMsIDAsIDgsIDc5LCAwLCA5LCAyNTVdO1xuY29uc3QgZml4ZWRfdGQgPSBbODAsIDUsIDEsIDg3LCA1LCAyNTcsIDgzLCA1LCAxNywgOTEsIDUsIDQwOTcsIDgxLCA1LCA1LCA4OSwgNSwgMTAyNSwgODUsIDUsIDY1LCA5MywgNSwgMTYzODUsIDgwLCA1LCAzLCA4OCwgNSwgNTEzLCA4NCwgNSwgMzMsIDkyLCA1LFxuXHQ4MTkzLCA4MiwgNSwgOSwgOTAsIDUsIDIwNDksIDg2LCA1LCAxMjksIDE5MiwgNSwgMjQ1NzcsIDgwLCA1LCAyLCA4NywgNSwgMzg1LCA4MywgNSwgMjUsIDkxLCA1LCA2MTQ1LCA4MSwgNSwgNywgODksIDUsIDE1MzcsIDg1LCA1LCA5NywgOTMsIDUsXG5cdDI0NTc3LCA4MCwgNSwgNCwgODgsIDUsIDc2OSwgODQsIDUsIDQ5LCA5MiwgNSwgMTIyODksIDgyLCA1LCAxMywgOTAsIDUsIDMwNzMsIDg2LCA1LCAxOTMsIDE5MiwgNSwgMjQ1NzddO1xuXG4vLyBUYWJsZXMgZm9yIGRlZmxhdGUgZnJvbSBQS1pJUCdzIGFwcG5vdGUudHh0LlxuY29uc3QgY3BsZW5zID0gWyAvLyBDb3B5IGxlbmd0aHMgZm9yIGxpdGVyYWwgY29kZXMgMjU3Li4yODVcblx0MywgNCwgNSwgNiwgNywgOCwgOSwgMTAsIDExLCAxMywgMTUsIDE3LCAxOSwgMjMsIDI3LCAzMSwgMzUsIDQzLCA1MSwgNTksIDY3LCA4MywgOTksIDExNSwgMTMxLCAxNjMsIDE5NSwgMjI3LCAyNTgsIDAsIDBdO1xuXG4vLyBzZWUgbm90ZSAjMTMgYWJvdmUgYWJvdXQgMjU4XG5jb25zdCBjcGxleHQgPSBbIC8vIEV4dHJhIGJpdHMgZm9yIGxpdGVyYWwgY29kZXMgMjU3Li4yODVcblx0MCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMSwgMSwgMSwgMSwgMiwgMiwgMiwgMiwgMywgMywgMywgMywgNCwgNCwgNCwgNCwgNSwgNSwgNSwgNSwgMCwgMTEyLCAxMTIgLy8gMTEyPT1pbnZhbGlkXG5dO1xuXG5jb25zdCBjcGRpc3QgPSBbIC8vIENvcHkgb2Zmc2V0cyBmb3IgZGlzdGFuY2UgY29kZXMgMC4uMjlcblx0MSwgMiwgMywgNCwgNSwgNywgOSwgMTMsIDE3LCAyNSwgMzMsIDQ5LCA2NSwgOTcsIDEyOSwgMTkzLCAyNTcsIDM4NSwgNTEzLCA3NjksIDEwMjUsIDE1MzcsIDIwNDksIDMwNzMsIDQwOTcsIDYxNDUsIDgxOTMsIDEyMjg5LCAxNjM4NSwgMjQ1NzddO1xuXG5jb25zdCBjcGRleHQgPSBbIC8vIEV4dHJhIGJpdHMgZm9yIGRpc3RhbmNlIGNvZGVzXG5cdDAsIDAsIDAsIDAsIDEsIDEsIDIsIDIsIDMsIDMsIDQsIDQsIDUsIDUsIDYsIDYsIDcsIDcsIDgsIDgsIDksIDksIDEwLCAxMCwgMTEsIDExLCAxMiwgMTIsIDEzLCAxM107XG5cbi8vIElmIEJNQVggbmVlZHMgdG8gYmUgbGFyZ2VyIHRoYW4gMTYsIHRoZW4gaCBhbmQgeFtdIHNob3VsZCBiZSB1TG9uZy5cbmNvbnN0IEJNQVggPSAxNTsgLy8gbWF4aW11bSBiaXQgbGVuZ3RoIG9mIGFueSBjb2RlXG5cbmZ1bmN0aW9uIEluZlRyZWUoKSB7XG5cdGNvbnN0IHRoYXQgPSB0aGlzO1xuXG5cdGxldCBobjsgLy8gaHVmdHMgdXNlZCBpbiBzcGFjZVxuXHRsZXQgdjsgLy8gd29yayBhcmVhIGZvciBodWZ0X2J1aWxkXG5cdGxldCBjOyAvLyBiaXQgbGVuZ3RoIGNvdW50IHRhYmxlXG5cdGxldCByOyAvLyB0YWJsZSBlbnRyeSBmb3Igc3RydWN0dXJlIGFzc2lnbm1lbnRcblx0bGV0IHU7IC8vIHRhYmxlIHN0YWNrXG5cdGxldCB4OyAvLyBiaXQgb2Zmc2V0cywgdGhlbiBjb2RlIHN0YWNrXG5cblx0ZnVuY3Rpb24gaHVmdF9idWlsZChiLCAvLyBjb2RlIGxlbmd0aHMgaW4gYml0cyAoYWxsIGFzc3VtZWQgPD1cblx0XHQvLyBCTUFYKVxuXHRcdGJpbmRleCwgbiwgLy8gbnVtYmVyIG9mIGNvZGVzIChhc3N1bWVkIDw9IDI4OClcblx0XHRzLCAvLyBudW1iZXIgb2Ygc2ltcGxlLXZhbHVlZCBjb2RlcyAoMC4ucy0xKVxuXHRcdGQsIC8vIGxpc3Qgb2YgYmFzZSB2YWx1ZXMgZm9yIG5vbi1zaW1wbGUgY29kZXNcblx0XHRlLCAvLyBsaXN0IG9mIGV4dHJhIGJpdHMgZm9yIG5vbi1zaW1wbGUgY29kZXNcblx0XHR0LCAvLyByZXN1bHQ6IHN0YXJ0aW5nIHRhYmxlXG5cdFx0bSwgLy8gbWF4aW11bSBsb29rdXAgYml0cywgcmV0dXJucyBhY3R1YWxcblx0XHRocCwvLyBzcGFjZSBmb3IgdHJlZXNcblx0XHRobiwvLyBodWZ0cyB1c2VkIGluIHNwYWNlXG5cdFx0diAvLyB3b3JraW5nIGFyZWE6IHZhbHVlcyBpbiBvcmRlciBvZiBiaXQgbGVuZ3RoXG5cdCkge1xuXHRcdC8vIEdpdmVuIGEgbGlzdCBvZiBjb2RlIGxlbmd0aHMgYW5kIGEgbWF4aW11bSB0YWJsZSBzaXplLCBtYWtlIGEgc2V0IG9mXG5cdFx0Ly8gdGFibGVzIHRvIGRlY29kZSB0aGF0IHNldCBvZiBjb2Rlcy4gUmV0dXJuIFpfT0sgb24gc3VjY2Vzcyxcblx0XHQvLyBaX0JVRl9FUlJPUlxuXHRcdC8vIGlmIHRoZSBnaXZlbiBjb2RlIHNldCBpcyBpbmNvbXBsZXRlICh0aGUgdGFibGVzIGFyZSBzdGlsbCBidWlsdCBpblxuXHRcdC8vIHRoaXNcblx0XHQvLyBjYXNlKSwgWl9EQVRBX0VSUk9SIGlmIHRoZSBpbnB1dCBpcyBpbnZhbGlkIChhbiBvdmVyLXN1YnNjcmliZWQgc2V0XG5cdFx0Ly8gb2Zcblx0XHQvLyBsZW5ndGhzKSwgb3IgWl9NRU1fRVJST1IgaWYgbm90IGVub3VnaCBtZW1vcnkuXG5cblx0XHRsZXQgYTsgLy8gY291bnRlciBmb3IgY29kZXMgb2YgbGVuZ3RoIGtcblx0XHRsZXQgZjsgLy8gaSByZXBlYXRzIGluIHRhYmxlIGV2ZXJ5IGYgZW50cmllc1xuXHRcdGxldCBnOyAvLyBtYXhpbXVtIGNvZGUgbGVuZ3RoXG5cdFx0bGV0IGg7IC8vIHRhYmxlIGxldmVsXG5cdFx0bGV0IGk7IC8vIGNvdW50ZXIsIGN1cnJlbnQgY29kZVxuXHRcdGxldCBqOyAvLyBjb3VudGVyXG5cdFx0bGV0IGs7IC8vIG51bWJlciBvZiBiaXRzIGluIGN1cnJlbnQgY29kZVxuXHRcdGxldCBsOyAvLyBiaXRzIHBlciB0YWJsZSAocmV0dXJuZWQgaW4gbSlcblx0XHRsZXQgbWFzazsgLy8gKDEgPDwgdykgLSAxLCB0byBhdm9pZCBjYyAtTyBidWcgb24gSFBcblx0XHRsZXQgcDsgLy8gcG9pbnRlciBpbnRvIGNbXSwgYltdLCBvciB2W11cblx0XHRsZXQgcTsgLy8gcG9pbnRzIHRvIGN1cnJlbnQgdGFibGVcblx0XHRsZXQgdzsgLy8gYml0cyBiZWZvcmUgdGhpcyB0YWJsZSA9PSAobCAqIGgpXG5cdFx0bGV0IHhwOyAvLyBwb2ludGVyIGludG8geFxuXHRcdGxldCB5OyAvLyBudW1iZXIgb2YgZHVtbXkgY29kZXMgYWRkZWRcblx0XHRsZXQgejsgLy8gbnVtYmVyIG9mIGVudHJpZXMgaW4gY3VycmVudCB0YWJsZVxuXG5cdFx0Ly8gR2VuZXJhdGUgY291bnRzIGZvciBlYWNoIGJpdCBsZW5ndGhcblxuXHRcdHAgPSAwO1xuXHRcdGkgPSBuO1xuXHRcdGRvIHtcblx0XHRcdGNbYltiaW5kZXggKyBwXV0rKztcblx0XHRcdHArKztcblx0XHRcdGktLTsgLy8gYXNzdW1lIGFsbCBlbnRyaWVzIDw9IEJNQVhcblx0XHR9IHdoaWxlIChpICE9PSAwKTtcblxuXHRcdGlmIChjWzBdID09IG4pIHsgLy8gbnVsbCBpbnB1dC0tYWxsIHplcm8gbGVuZ3RoIGNvZGVzXG5cdFx0XHR0WzBdID0gLTE7XG5cdFx0XHRtWzBdID0gMDtcblx0XHRcdHJldHVybiBaX09LO1xuXHRcdH1cblxuXHRcdC8vIEZpbmQgbWluaW11bSBhbmQgbWF4aW11bSBsZW5ndGgsIGJvdW5kICptIGJ5IHRob3NlXG5cdFx0bCA9IG1bMF07XG5cdFx0Zm9yIChqID0gMTsgaiA8PSBCTUFYOyBqKyspXG5cdFx0XHRpZiAoY1tqXSAhPT0gMClcblx0XHRcdFx0YnJlYWs7XG5cdFx0ayA9IGo7IC8vIG1pbmltdW0gY29kZSBsZW5ndGhcblx0XHRpZiAobCA8IGopIHtcblx0XHRcdGwgPSBqO1xuXHRcdH1cblx0XHRmb3IgKGkgPSBCTUFYOyBpICE9PSAwOyBpLS0pIHtcblx0XHRcdGlmIChjW2ldICE9PSAwKVxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdFx0ZyA9IGk7IC8vIG1heGltdW0gY29kZSBsZW5ndGhcblx0XHRpZiAobCA+IGkpIHtcblx0XHRcdGwgPSBpO1xuXHRcdH1cblx0XHRtWzBdID0gbDtcblxuXHRcdC8vIEFkanVzdCBsYXN0IGxlbmd0aCBjb3VudCB0byBmaWxsIG91dCBjb2RlcywgaWYgbmVlZGVkXG5cdFx0Zm9yICh5ID0gMSA8PCBqOyBqIDwgaTsgaisrLCB5IDw8PSAxKSB7XG5cdFx0XHRpZiAoKHkgLT0gY1tqXSkgPCAwKSB7XG5cdFx0XHRcdHJldHVybiBaX0RBVEFfRVJST1I7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICgoeSAtPSBjW2ldKSA8IDApIHtcblx0XHRcdHJldHVybiBaX0RBVEFfRVJST1I7XG5cdFx0fVxuXHRcdGNbaV0gKz0geTtcblxuXHRcdC8vIEdlbmVyYXRlIHN0YXJ0aW5nIG9mZnNldHMgaW50byB0aGUgdmFsdWUgdGFibGUgZm9yIGVhY2ggbGVuZ3RoXG5cdFx0eFsxXSA9IGogPSAwO1xuXHRcdHAgPSAxO1xuXHRcdHhwID0gMjtcblx0XHR3aGlsZSAoLS1pICE9PSAwKSB7IC8vIG5vdGUgdGhhdCBpID09IGcgZnJvbSBhYm92ZVxuXHRcdFx0eFt4cF0gPSAoaiArPSBjW3BdKTtcblx0XHRcdHhwKys7XG5cdFx0XHRwKys7XG5cdFx0fVxuXG5cdFx0Ly8gTWFrZSBhIHRhYmxlIG9mIHZhbHVlcyBpbiBvcmRlciBvZiBiaXQgbGVuZ3Roc1xuXHRcdGkgPSAwO1xuXHRcdHAgPSAwO1xuXHRcdGRvIHtcblx0XHRcdGlmICgoaiA9IGJbYmluZGV4ICsgcF0pICE9PSAwKSB7XG5cdFx0XHRcdHZbeFtqXSsrXSA9IGk7XG5cdFx0XHR9XG5cdFx0XHRwKys7XG5cdFx0fSB3aGlsZSAoKytpIDwgbik7XG5cdFx0biA9IHhbZ107IC8vIHNldCBuIHRvIGxlbmd0aCBvZiB2XG5cblx0XHQvLyBHZW5lcmF0ZSB0aGUgSHVmZm1hbiBjb2RlcyBhbmQgZm9yIGVhY2gsIG1ha2UgdGhlIHRhYmxlIGVudHJpZXNcblx0XHR4WzBdID0gaSA9IDA7IC8vIGZpcnN0IEh1ZmZtYW4gY29kZSBpcyB6ZXJvXG5cdFx0cCA9IDA7IC8vIGdyYWIgdmFsdWVzIGluIGJpdCBvcmRlclxuXHRcdGggPSAtMTsgLy8gbm8gdGFibGVzIHlldC0tbGV2ZWwgLTFcblx0XHR3ID0gLWw7IC8vIGJpdHMgZGVjb2RlZCA9PSAobCAqIGgpXG5cdFx0dVswXSA9IDA7IC8vIGp1c3QgdG8ga2VlcCBjb21waWxlcnMgaGFwcHlcblx0XHRxID0gMDsgLy8gZGl0dG9cblx0XHR6ID0gMDsgLy8gZGl0dG9cblxuXHRcdC8vIGdvIHRocm91Z2ggdGhlIGJpdCBsZW5ndGhzIChrIGFscmVhZHkgaXMgYml0cyBpbiBzaG9ydGVzdCBjb2RlKVxuXHRcdGZvciAoOyBrIDw9IGc7IGsrKykge1xuXHRcdFx0YSA9IGNba107XG5cdFx0XHR3aGlsZSAoYS0tICE9PSAwKSB7XG5cdFx0XHRcdC8vIGhlcmUgaSBpcyB0aGUgSHVmZm1hbiBjb2RlIG9mIGxlbmd0aCBrIGJpdHMgZm9yIHZhbHVlICpwXG5cdFx0XHRcdC8vIG1ha2UgdGFibGVzIHVwIHRvIHJlcXVpcmVkIGxldmVsXG5cdFx0XHRcdHdoaWxlIChrID4gdyArIGwpIHtcblx0XHRcdFx0XHRoKys7XG5cdFx0XHRcdFx0dyArPSBsOyAvLyBwcmV2aW91cyB0YWJsZSBhbHdheXMgbCBiaXRzXG5cdFx0XHRcdFx0Ly8gY29tcHV0ZSBtaW5pbXVtIHNpemUgdGFibGUgbGVzcyB0aGFuIG9yIGVxdWFsIHRvIGwgYml0c1xuXHRcdFx0XHRcdHogPSBnIC0gdztcblx0XHRcdFx0XHR6ID0gKHogPiBsKSA/IGwgOiB6OyAvLyB0YWJsZSBzaXplIHVwcGVyIGxpbWl0XG5cdFx0XHRcdFx0aWYgKChmID0gMSA8PCAoaiA9IGsgLSB3KSkgPiBhICsgMSkgeyAvLyB0cnkgYSBrLXcgYml0IHRhYmxlXG5cdFx0XHRcdFx0XHQvLyB0b28gZmV3IGNvZGVzIGZvclxuXHRcdFx0XHRcdFx0Ly8gay13IGJpdCB0YWJsZVxuXHRcdFx0XHRcdFx0ZiAtPSBhICsgMTsgLy8gZGVkdWN0IGNvZGVzIGZyb20gcGF0dGVybnMgbGVmdFxuXHRcdFx0XHRcdFx0eHAgPSBrO1xuXHRcdFx0XHRcdFx0aWYgKGogPCB6KSB7XG5cdFx0XHRcdFx0XHRcdHdoaWxlICgrK2ogPCB6KSB7IC8vIHRyeSBzbWFsbGVyIHRhYmxlcyB1cCB0byB6IGJpdHNcblx0XHRcdFx0XHRcdFx0XHRpZiAoKGYgPDw9IDEpIDw9IGNbKyt4cF0pXG5cdFx0XHRcdFx0XHRcdFx0XHRicmVhazsgLy8gZW5vdWdoIGNvZGVzIHRvIHVzZSB1cCBqIGJpdHNcblx0XHRcdFx0XHRcdFx0XHRmIC09IGNbeHBdOyAvLyBlbHNlIGRlZHVjdCBjb2RlcyBmcm9tIHBhdHRlcm5zXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0eiA9IDEgPDwgajsgLy8gdGFibGUgZW50cmllcyBmb3Igai1iaXQgdGFibGVcblxuXHRcdFx0XHRcdC8vIGFsbG9jYXRlIG5ldyB0YWJsZVxuXHRcdFx0XHRcdGlmIChoblswXSArIHogPiBNQU5ZKSB7IC8vIChub3RlOiBkb2Vzbid0IG1hdHRlciBmb3IgZml4ZWQpXG5cdFx0XHRcdFx0XHRyZXR1cm4gWl9EQVRBX0VSUk9SOyAvLyBvdmVyZmxvdyBvZiBNQU5ZXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHVbaF0gPSBxID0gLyogaHArICovaG5bMF07IC8vIERFQlVHXG5cdFx0XHRcdFx0aG5bMF0gKz0gejtcblxuXHRcdFx0XHRcdC8vIGNvbm5lY3QgdG8gbGFzdCB0YWJsZSwgaWYgdGhlcmUgaXMgb25lXG5cdFx0XHRcdFx0aWYgKGggIT09IDApIHtcblx0XHRcdFx0XHRcdHhbaF0gPSBpOyAvLyBzYXZlIHBhdHRlcm4gZm9yIGJhY2tpbmcgdXBcblx0XHRcdFx0XHRcdHJbMF0gPSAvKiAoYnl0ZSkgKi9qOyAvLyBiaXRzIGluIHRoaXMgdGFibGVcblx0XHRcdFx0XHRcdHJbMV0gPSAvKiAoYnl0ZSkgKi9sOyAvLyBiaXRzIHRvIGR1bXAgYmVmb3JlIHRoaXMgdGFibGVcblx0XHRcdFx0XHRcdGogPSBpID4+PiAodyAtIGwpO1xuXHRcdFx0XHRcdFx0clsyXSA9IC8qIChpbnQpICovKHEgLSB1W2ggLSAxXSAtIGopOyAvLyBvZmZzZXQgdG8gdGhpcyB0YWJsZVxuXHRcdFx0XHRcdFx0aHAuc2V0KHIsICh1W2ggLSAxXSArIGopICogMyk7XG5cdFx0XHRcdFx0XHQvLyB0b1xuXHRcdFx0XHRcdFx0Ly8gbGFzdFxuXHRcdFx0XHRcdFx0Ly8gdGFibGVcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dFswXSA9IHE7IC8vIGZpcnN0IHRhYmxlIGlzIHJldHVybmVkIHJlc3VsdFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIHNldCB1cCB0YWJsZSBlbnRyeSBpbiByXG5cdFx0XHRcdHJbMV0gPSAvKiAoYnl0ZSkgKi8oayAtIHcpO1xuXHRcdFx0XHRpZiAocCA+PSBuKSB7XG5cdFx0XHRcdFx0clswXSA9IDEyOCArIDY0OyAvLyBvdXQgb2YgdmFsdWVzLS1pbnZhbGlkIGNvZGVcblx0XHRcdFx0fSBlbHNlIGlmICh2W3BdIDwgcykge1xuXHRcdFx0XHRcdHJbMF0gPSAvKiAoYnl0ZSkgKi8odltwXSA8IDI1NiA/IDAgOiAzMiArIDY0KTsgLy8gMjU2IGlzXG5cdFx0XHRcdFx0Ly8gZW5kLW9mLWJsb2NrXG5cdFx0XHRcdFx0clsyXSA9IHZbcCsrXTsgLy8gc2ltcGxlIGNvZGUgaXMganVzdCB0aGUgdmFsdWVcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyWzBdID0gLyogKGJ5dGUpICovKGVbdltwXSAtIHNdICsgMTYgKyA2NCk7IC8vIG5vbi1zaW1wbGUtLWxvb2tcblx0XHRcdFx0XHQvLyB1cCBpbiBsaXN0c1xuXHRcdFx0XHRcdHJbMl0gPSBkW3ZbcCsrXSAtIHNdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gZmlsbCBjb2RlLWxpa2UgZW50cmllcyB3aXRoIHJcblx0XHRcdFx0ZiA9IDEgPDwgKGsgLSB3KTtcblx0XHRcdFx0Zm9yIChqID0gaSA+Pj4gdzsgaiA8IHo7IGogKz0gZikge1xuXHRcdFx0XHRcdGhwLnNldChyLCAocSArIGopICogMyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBiYWNrd2FyZHMgaW5jcmVtZW50IHRoZSBrLWJpdCBjb2RlIGlcblx0XHRcdFx0Zm9yIChqID0gMSA8PCAoayAtIDEpOyAoaSAmIGopICE9PSAwOyBqID4+Pj0gMSkge1xuXHRcdFx0XHRcdGkgXj0gajtcblx0XHRcdFx0fVxuXHRcdFx0XHRpIF49IGo7XG5cblx0XHRcdFx0Ly8gYmFja3VwIG92ZXIgZmluaXNoZWQgdGFibGVzXG5cdFx0XHRcdG1hc2sgPSAoMSA8PCB3KSAtIDE7IC8vIG5lZWRlZCBvbiBIUCwgY2MgLU8gYnVnXG5cdFx0XHRcdHdoaWxlICgoaSAmIG1hc2spICE9IHhbaF0pIHtcblx0XHRcdFx0XHRoLS07IC8vIGRvbid0IG5lZWQgdG8gdXBkYXRlIHFcblx0XHRcdFx0XHR3IC09IGw7XG5cdFx0XHRcdFx0bWFzayA9ICgxIDw8IHcpIC0gMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBSZXR1cm4gWl9CVUZfRVJST1IgaWYgd2Ugd2VyZSBnaXZlbiBhbiBpbmNvbXBsZXRlIHRhYmxlXG5cdFx0cmV0dXJuIHkgIT09IDAgJiYgZyAhPSAxID8gWl9CVUZfRVJST1IgOiBaX09LO1xuXHR9XG5cblx0ZnVuY3Rpb24gaW5pdFdvcmtBcmVhKHZzaXplKSB7XG5cdFx0bGV0IGk7XG5cdFx0aWYgKCFobikge1xuXHRcdFx0aG4gPSBbXTsgLy8gW107IC8vbmV3IEFycmF5KDEpO1xuXHRcdFx0diA9IFtdOyAvLyBuZXcgQXJyYXkodnNpemUpO1xuXHRcdFx0YyA9IG5ldyBJbnQzMkFycmF5KEJNQVggKyAxKTsgLy8gbmV3IEFycmF5KEJNQVggKyAxKTtcblx0XHRcdHIgPSBbXTsgLy8gbmV3IEFycmF5KDMpO1xuXHRcdFx0dSA9IG5ldyBJbnQzMkFycmF5KEJNQVgpOyAvLyBuZXcgQXJyYXkoQk1BWCk7XG5cdFx0XHR4ID0gbmV3IEludDMyQXJyYXkoQk1BWCArIDEpOyAvLyBuZXcgQXJyYXkoQk1BWCArIDEpO1xuXHRcdH1cblx0XHRpZiAodi5sZW5ndGggPCB2c2l6ZSkge1xuXHRcdFx0diA9IFtdOyAvLyBuZXcgQXJyYXkodnNpemUpO1xuXHRcdH1cblx0XHRmb3IgKGkgPSAwOyBpIDwgdnNpemU7IGkrKykge1xuXHRcdFx0dltpXSA9IDA7XG5cdFx0fVxuXHRcdGZvciAoaSA9IDA7IGkgPCBCTUFYICsgMTsgaSsrKSB7XG5cdFx0XHRjW2ldID0gMDtcblx0XHR9XG5cdFx0Zm9yIChpID0gMDsgaSA8IDM7IGkrKykge1xuXHRcdFx0cltpXSA9IDA7XG5cdFx0fVxuXHRcdC8vIGZvcihpbnQgaT0wOyBpPEJNQVg7IGkrKyl7dVtpXT0wO31cblx0XHR1LnNldChjLnN1YmFycmF5KDAsIEJNQVgpLCAwKTtcblx0XHQvLyBmb3IoaW50IGk9MDsgaTxCTUFYKzE7IGkrKyl7eFtpXT0wO31cblx0XHR4LnNldChjLnN1YmFycmF5KDAsIEJNQVggKyAxKSwgMCk7XG5cdH1cblxuXHR0aGF0LmluZmxhdGVfdHJlZXNfYml0cyA9IGZ1bmN0aW9uIChjLCAvLyAxOSBjb2RlIGxlbmd0aHNcblx0XHRiYiwgLy8gYml0cyB0cmVlIGRlc2lyZWQvYWN0dWFsIGRlcHRoXG5cdFx0dGIsIC8vIGJpdHMgdHJlZSByZXN1bHRcblx0XHRocCwgLy8gc3BhY2UgZm9yIHRyZWVzXG5cdFx0eiAvLyBmb3IgbWVzc2FnZXNcblx0KSB7XG5cdFx0bGV0IHJlc3VsdDtcblx0XHRpbml0V29ya0FyZWEoMTkpO1xuXHRcdGhuWzBdID0gMDtcblx0XHRyZXN1bHQgPSBodWZ0X2J1aWxkKGMsIDAsIDE5LCAxOSwgbnVsbCwgbnVsbCwgdGIsIGJiLCBocCwgaG4sIHYpO1xuXG5cdFx0aWYgKHJlc3VsdCA9PSBaX0RBVEFfRVJST1IpIHtcblx0XHRcdHoubXNnID0gXCJvdmVyc3Vic2NyaWJlZCBkeW5hbWljIGJpdCBsZW5ndGhzIHRyZWVcIjtcblx0XHR9IGVsc2UgaWYgKHJlc3VsdCA9PSBaX0JVRl9FUlJPUiB8fCBiYlswXSA9PT0gMCkge1xuXHRcdFx0ei5tc2cgPSBcImluY29tcGxldGUgZHluYW1pYyBiaXQgbGVuZ3RocyB0cmVlXCI7XG5cdFx0XHRyZXN1bHQgPSBaX0RBVEFfRVJST1I7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH07XG5cblx0dGhhdC5pbmZsYXRlX3RyZWVzX2R5bmFtaWMgPSBmdW5jdGlvbiAobmwsIC8vIG51bWJlciBvZiBsaXRlcmFsL2xlbmd0aCBjb2Rlc1xuXHRcdG5kLCAvLyBudW1iZXIgb2YgZGlzdGFuY2UgY29kZXNcblx0XHRjLCAvLyB0aGF0IG1hbnkgKHRvdGFsKSBjb2RlIGxlbmd0aHNcblx0XHRibCwgLy8gbGl0ZXJhbCBkZXNpcmVkL2FjdHVhbCBiaXQgZGVwdGhcblx0XHRiZCwgLy8gZGlzdGFuY2UgZGVzaXJlZC9hY3R1YWwgYml0IGRlcHRoXG5cdFx0dGwsIC8vIGxpdGVyYWwvbGVuZ3RoIHRyZWUgcmVzdWx0XG5cdFx0dGQsIC8vIGRpc3RhbmNlIHRyZWUgcmVzdWx0XG5cdFx0aHAsIC8vIHNwYWNlIGZvciB0cmVlc1xuXHRcdHogLy8gZm9yIG1lc3NhZ2VzXG5cdCkge1xuXHRcdGxldCByZXN1bHQ7XG5cblx0XHQvLyBidWlsZCBsaXRlcmFsL2xlbmd0aCB0cmVlXG5cdFx0aW5pdFdvcmtBcmVhKDI4OCk7XG5cdFx0aG5bMF0gPSAwO1xuXHRcdHJlc3VsdCA9IGh1ZnRfYnVpbGQoYywgMCwgbmwsIDI1NywgY3BsZW5zLCBjcGxleHQsIHRsLCBibCwgaHAsIGhuLCB2KTtcblx0XHRpZiAocmVzdWx0ICE9IFpfT0sgfHwgYmxbMF0gPT09IDApIHtcblx0XHRcdGlmIChyZXN1bHQgPT0gWl9EQVRBX0VSUk9SKSB7XG5cdFx0XHRcdHoubXNnID0gXCJvdmVyc3Vic2NyaWJlZCBsaXRlcmFsL2xlbmd0aCB0cmVlXCI7XG5cdFx0XHR9IGVsc2UgaWYgKHJlc3VsdCAhPSBaX01FTV9FUlJPUikge1xuXHRcdFx0XHR6Lm1zZyA9IFwiaW5jb21wbGV0ZSBsaXRlcmFsL2xlbmd0aCB0cmVlXCI7XG5cdFx0XHRcdHJlc3VsdCA9IFpfREFUQV9FUlJPUjtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0Ly8gYnVpbGQgZGlzdGFuY2UgdHJlZVxuXHRcdGluaXRXb3JrQXJlYSgyODgpO1xuXHRcdHJlc3VsdCA9IGh1ZnRfYnVpbGQoYywgbmwsIG5kLCAwLCBjcGRpc3QsIGNwZGV4dCwgdGQsIGJkLCBocCwgaG4sIHYpO1xuXG5cdFx0aWYgKHJlc3VsdCAhPSBaX09LIHx8IChiZFswXSA9PT0gMCAmJiBubCA+IDI1NykpIHtcblx0XHRcdGlmIChyZXN1bHQgPT0gWl9EQVRBX0VSUk9SKSB7XG5cdFx0XHRcdHoubXNnID0gXCJvdmVyc3Vic2NyaWJlZCBkaXN0YW5jZSB0cmVlXCI7XG5cdFx0XHR9IGVsc2UgaWYgKHJlc3VsdCA9PSBaX0JVRl9FUlJPUikge1xuXHRcdFx0XHR6Lm1zZyA9IFwiaW5jb21wbGV0ZSBkaXN0YW5jZSB0cmVlXCI7XG5cdFx0XHRcdHJlc3VsdCA9IFpfREFUQV9FUlJPUjtcblx0XHRcdH0gZWxzZSBpZiAocmVzdWx0ICE9IFpfTUVNX0VSUk9SKSB7XG5cdFx0XHRcdHoubXNnID0gXCJlbXB0eSBkaXN0YW5jZSB0cmVlIHdpdGggbGVuZ3Roc1wiO1xuXHRcdFx0XHRyZXN1bHQgPSBaX0RBVEFfRVJST1I7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdHJldHVybiBaX09LO1xuXHR9O1xuXG59XG5cbkluZlRyZWUuaW5mbGF0ZV90cmVlc19maXhlZCA9IGZ1bmN0aW9uIChibCwgLy8gbGl0ZXJhbCBkZXNpcmVkL2FjdHVhbCBiaXQgZGVwdGhcblx0YmQsIC8vIGRpc3RhbmNlIGRlc2lyZWQvYWN0dWFsIGJpdCBkZXB0aFxuXHR0bCwvLyBsaXRlcmFsL2xlbmd0aCB0cmVlIHJlc3VsdFxuXHR0ZC8vIGRpc3RhbmNlIHRyZWUgcmVzdWx0XG4pIHtcblx0YmxbMF0gPSBmaXhlZF9ibDtcblx0YmRbMF0gPSBmaXhlZF9iZDtcblx0dGxbMF0gPSBmaXhlZF90bDtcblx0dGRbMF0gPSBmaXhlZF90ZDtcblx0cmV0dXJuIFpfT0s7XG59O1xuXG4vLyBJbmZDb2Rlc1xuXG4vLyB3YWl0aW5nIGZvciBcImk6XCI9aW5wdXQsXG4vLyBcIm86XCI9b3V0cHV0LFxuLy8gXCJ4OlwiPW5vdGhpbmdcbmNvbnN0IFNUQVJUID0gMDsgLy8geDogc2V0IHVwIGZvciBMRU5cbmNvbnN0IExFTiA9IDE7IC8vIGk6IGdldCBsZW5ndGgvbGl0ZXJhbC9lb2IgbmV4dFxuY29uc3QgTEVORVhUID0gMjsgLy8gaTogZ2V0dGluZyBsZW5ndGggZXh0cmEgKGhhdmUgYmFzZSlcbmNvbnN0IERJU1QgPSAzOyAvLyBpOiBnZXQgZGlzdGFuY2UgbmV4dFxuY29uc3QgRElTVEVYVCA9IDQ7Ly8gaTogZ2V0dGluZyBkaXN0YW5jZSBleHRyYVxuY29uc3QgQ09QWSA9IDU7IC8vIG86IGNvcHlpbmcgYnl0ZXMgaW4gd2luLCB3YWl0aW5nXG4vLyBmb3Igc3BhY2VcbmNvbnN0IExJVCA9IDY7IC8vIG86IGdvdCBsaXRlcmFsLCB3YWl0aW5nIGZvciBvdXRwdXRcbi8vIHNwYWNlXG5jb25zdCBXQVNIID0gNzsgLy8gbzogZ290IGVvYiwgcG9zc2libHkgc3RpbGwgb3V0cHV0XG4vLyB3YWl0aW5nXG5jb25zdCBFTkQgPSA4OyAvLyB4OiBnb3QgZW9iIGFuZCBhbGwgZGF0YSBmbHVzaGVkXG5jb25zdCBCQURDT0RFID0gOTsvLyB4OiBnb3QgZXJyb3JcblxuZnVuY3Rpb24gSW5mQ29kZXMoKSB7XG5cdGNvbnN0IHRoYXQgPSB0aGlzO1xuXG5cdGxldCBtb2RlOyAvLyBjdXJyZW50IGluZmxhdGVfY29kZXMgbW9kZVxuXG5cdC8vIG1vZGUgZGVwZW5kZW50IGluZm9ybWF0aW9uXG5cdGxldCBsZW4gPSAwO1xuXG5cdGxldCB0cmVlOyAvLyBwb2ludGVyIGludG8gdHJlZVxuXHRsZXQgdHJlZV9pbmRleCA9IDA7XG5cdGxldCBuZWVkID0gMDsgLy8gYml0cyBuZWVkZWRcblxuXHRsZXQgbGl0ID0gMDtcblxuXHQvLyBpZiBFWFQgb3IgQ09QWSwgd2hlcmUgYW5kIGhvdyBtdWNoXG5cdGxldCBnZXQgPSAwOyAvLyBiaXRzIHRvIGdldCBmb3IgZXh0cmFcblx0bGV0IGRpc3QgPSAwOyAvLyBkaXN0YW5jZSBiYWNrIHRvIGNvcHkgZnJvbVxuXG5cdGxldCBsYml0cyA9IDA7IC8vIGx0cmVlIGJpdHMgZGVjb2RlZCBwZXIgYnJhbmNoXG5cdGxldCBkYml0cyA9IDA7IC8vIGR0cmVlIGJpdHMgZGVjb2RlciBwZXIgYnJhbmNoXG5cdGxldCBsdHJlZTsgLy8gbGl0ZXJhbC9sZW5ndGgvZW9iIHRyZWVcblx0bGV0IGx0cmVlX2luZGV4ID0gMDsgLy8gbGl0ZXJhbC9sZW5ndGgvZW9iIHRyZWVcblx0bGV0IGR0cmVlOyAvLyBkaXN0YW5jZSB0cmVlXG5cdGxldCBkdHJlZV9pbmRleCA9IDA7IC8vIGRpc3RhbmNlIHRyZWVcblxuXHQvLyBDYWxsZWQgd2l0aCBudW1iZXIgb2YgYnl0ZXMgbGVmdCB0byB3cml0ZSBpbiB3aW4gYXQgbGVhc3QgMjU4XG5cdC8vICh0aGUgbWF4aW11bSBzdHJpbmcgbGVuZ3RoKSBhbmQgbnVtYmVyIG9mIGlucHV0IGJ5dGVzIGF2YWlsYWJsZVxuXHQvLyBhdCBsZWFzdCB0ZW4uIFRoZSB0ZW4gYnl0ZXMgYXJlIHNpeCBieXRlcyBmb3IgdGhlIGxvbmdlc3QgbGVuZ3RoL1xuXHQvLyBkaXN0YW5jZSBwYWlyIHBsdXMgZm91ciBieXRlcyBmb3Igb3ZlcmxvYWRpbmcgdGhlIGJpdCBidWZmZXIuXG5cblx0ZnVuY3Rpb24gaW5mbGF0ZV9mYXN0KGJsLCBiZCwgdGwsIHRsX2luZGV4LCB0ZCwgdGRfaW5kZXgsIHMsIHopIHtcblx0XHRsZXQgdDsgLy8gdGVtcG9yYXJ5IHBvaW50ZXJcblx0XHRsZXQgdHA7IC8vIHRlbXBvcmFyeSBwb2ludGVyXG5cdFx0bGV0IHRwX2luZGV4OyAvLyB0ZW1wb3JhcnkgcG9pbnRlclxuXHRcdGxldCBlOyAvLyBleHRyYSBiaXRzIG9yIG9wZXJhdGlvblxuXHRcdGxldCBiOyAvLyBiaXQgYnVmZmVyXG5cdFx0bGV0IGs7IC8vIGJpdHMgaW4gYml0IGJ1ZmZlclxuXHRcdGxldCBwOyAvLyBpbnB1dCBkYXRhIHBvaW50ZXJcblx0XHRsZXQgbjsgLy8gYnl0ZXMgYXZhaWxhYmxlIHRoZXJlXG5cdFx0bGV0IHE7IC8vIG91dHB1dCB3aW4gd3JpdGUgcG9pbnRlclxuXHRcdGxldCBtOyAvLyBieXRlcyB0byBlbmQgb2Ygd2luIG9yIHJlYWQgcG9pbnRlclxuXHRcdGxldCBtbDsgLy8gbWFzayBmb3IgbGl0ZXJhbC9sZW5ndGggdHJlZVxuXHRcdGxldCBtZDsgLy8gbWFzayBmb3IgZGlzdGFuY2UgdHJlZVxuXHRcdGxldCBjOyAvLyBieXRlcyB0byBjb3B5XG5cdFx0bGV0IGQ7IC8vIGRpc3RhbmNlIGJhY2sgdG8gY29weSBmcm9tXG5cdFx0bGV0IHI7IC8vIGNvcHkgc291cmNlIHBvaW50ZXJcblxuXHRcdGxldCB0cF9pbmRleF90XzM7IC8vICh0cF9pbmRleCt0KSozXG5cblx0XHQvLyBsb2FkIGlucHV0LCBvdXRwdXQsIGJpdCB2YWx1ZXNcblx0XHRwID0gei5uZXh0X2luX2luZGV4O1xuXHRcdG4gPSB6LmF2YWlsX2luO1xuXHRcdGIgPSBzLmJpdGI7XG5cdFx0ayA9IHMuYml0aztcblx0XHRxID0gcy53cml0ZTtcblx0XHRtID0gcSA8IHMucmVhZCA/IHMucmVhZCAtIHEgLSAxIDogcy5lbmQgLSBxO1xuXG5cdFx0Ly8gaW5pdGlhbGl6ZSBtYXNrc1xuXHRcdG1sID0gaW5mbGF0ZV9tYXNrW2JsXTtcblx0XHRtZCA9IGluZmxhdGVfbWFza1tiZF07XG5cblx0XHQvLyBkbyB1bnRpbCBub3QgZW5vdWdoIGlucHV0IG9yIG91dHB1dCBzcGFjZSBmb3IgZmFzdCBsb29wXG5cdFx0ZG8geyAvLyBhc3N1bWUgY2FsbGVkIHdpdGggbSA+PSAyNTggJiYgbiA+PSAxMFxuXHRcdFx0Ly8gZ2V0IGxpdGVyYWwvbGVuZ3RoIGNvZGVcblx0XHRcdHdoaWxlIChrIDwgKDIwKSkgeyAvLyBtYXggYml0cyBmb3IgbGl0ZXJhbC9sZW5ndGggY29kZVxuXHRcdFx0XHRuLS07XG5cdFx0XHRcdGIgfD0gKHoucmVhZF9ieXRlKHArKykgJiAweGZmKSA8PCBrO1xuXHRcdFx0XHRrICs9IDg7XG5cdFx0XHR9XG5cblx0XHRcdHQgPSBiICYgbWw7XG5cdFx0XHR0cCA9IHRsO1xuXHRcdFx0dHBfaW5kZXggPSB0bF9pbmRleDtcblx0XHRcdHRwX2luZGV4X3RfMyA9ICh0cF9pbmRleCArIHQpICogMztcblx0XHRcdGlmICgoZSA9IHRwW3RwX2luZGV4X3RfM10pID09PSAwKSB7XG5cdFx0XHRcdGIgPj49ICh0cFt0cF9pbmRleF90XzMgKyAxXSk7XG5cdFx0XHRcdGsgLT0gKHRwW3RwX2luZGV4X3RfMyArIDFdKTtcblxuXHRcdFx0XHRzLndpbltxKytdID0gLyogKGJ5dGUpICovdHBbdHBfaW5kZXhfdF8zICsgMl07XG5cdFx0XHRcdG0tLTtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRkbyB7XG5cblx0XHRcdFx0YiA+Pj0gKHRwW3RwX2luZGV4X3RfMyArIDFdKTtcblx0XHRcdFx0ayAtPSAodHBbdHBfaW5kZXhfdF8zICsgMV0pO1xuXG5cdFx0XHRcdGlmICgoZSAmIDE2KSAhPT0gMCkge1xuXHRcdFx0XHRcdGUgJj0gMTU7XG5cdFx0XHRcdFx0YyA9IHRwW3RwX2luZGV4X3RfMyArIDJdICsgKC8qIChpbnQpICovYiAmIGluZmxhdGVfbWFza1tlXSk7XG5cblx0XHRcdFx0XHRiID4+PSBlO1xuXHRcdFx0XHRcdGsgLT0gZTtcblxuXHRcdFx0XHRcdC8vIGRlY29kZSBkaXN0YW5jZSBiYXNlIG9mIGJsb2NrIHRvIGNvcHlcblx0XHRcdFx0XHR3aGlsZSAoayA8ICgxNSkpIHsgLy8gbWF4IGJpdHMgZm9yIGRpc3RhbmNlIGNvZGVcblx0XHRcdFx0XHRcdG4tLTtcblx0XHRcdFx0XHRcdGIgfD0gKHoucmVhZF9ieXRlKHArKykgJiAweGZmKSA8PCBrO1xuXHRcdFx0XHRcdFx0ayArPSA4O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHQgPSBiICYgbWQ7XG5cdFx0XHRcdFx0dHAgPSB0ZDtcblx0XHRcdFx0XHR0cF9pbmRleCA9IHRkX2luZGV4O1xuXHRcdFx0XHRcdHRwX2luZGV4X3RfMyA9ICh0cF9pbmRleCArIHQpICogMztcblx0XHRcdFx0XHRlID0gdHBbdHBfaW5kZXhfdF8zXTtcblxuXHRcdFx0XHRcdGRvIHtcblxuXHRcdFx0XHRcdFx0YiA+Pj0gKHRwW3RwX2luZGV4X3RfMyArIDFdKTtcblx0XHRcdFx0XHRcdGsgLT0gKHRwW3RwX2luZGV4X3RfMyArIDFdKTtcblxuXHRcdFx0XHRcdFx0aWYgKChlICYgMTYpICE9PSAwKSB7XG5cdFx0XHRcdFx0XHRcdC8vIGdldCBleHRyYSBiaXRzIHRvIGFkZCB0byBkaXN0YW5jZSBiYXNlXG5cdFx0XHRcdFx0XHRcdGUgJj0gMTU7XG5cdFx0XHRcdFx0XHRcdHdoaWxlIChrIDwgKGUpKSB7IC8vIGdldCBleHRyYSBiaXRzICh1cCB0byAxMylcblx0XHRcdFx0XHRcdFx0XHRuLS07XG5cdFx0XHRcdFx0XHRcdFx0YiB8PSAoei5yZWFkX2J5dGUocCsrKSAmIDB4ZmYpIDw8IGs7XG5cdFx0XHRcdFx0XHRcdFx0ayArPSA4O1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0ZCA9IHRwW3RwX2luZGV4X3RfMyArIDJdICsgKGIgJiBpbmZsYXRlX21hc2tbZV0pO1xuXG5cdFx0XHRcdFx0XHRcdGIgPj49IChlKTtcblx0XHRcdFx0XHRcdFx0ayAtPSAoZSk7XG5cblx0XHRcdFx0XHRcdFx0Ly8gZG8gdGhlIGNvcHlcblx0XHRcdFx0XHRcdFx0bSAtPSBjO1xuXHRcdFx0XHRcdFx0XHRpZiAocSA+PSBkKSB7IC8vIG9mZnNldCBiZWZvcmUgZGVzdFxuXHRcdFx0XHRcdFx0XHRcdC8vIGp1c3QgY29weVxuXHRcdFx0XHRcdFx0XHRcdHIgPSBxIC0gZDtcblx0XHRcdFx0XHRcdFx0XHRpZiAocSAtIHIgPiAwICYmIDIgPiAocSAtIHIpKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRzLndpbltxKytdID0gcy53aW5bcisrXTsgLy8gbWluaW11bVxuXHRcdFx0XHRcdFx0XHRcdFx0Ly8gY291bnQgaXNcblx0XHRcdFx0XHRcdFx0XHRcdC8vIHRocmVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0cy53aW5bcSsrXSA9IHMud2luW3IrK107IC8vIHNvIHVucm9sbFxuXHRcdFx0XHRcdFx0XHRcdFx0Ly8gbG9vcCBhXG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBsaXR0bGVcblx0XHRcdFx0XHRcdFx0XHRcdGMgLT0gMjtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0cy53aW4uc2V0KHMud2luLnN1YmFycmF5KHIsIHIgKyAyKSwgcSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRxICs9IDI7XG5cdFx0XHRcdFx0XHRcdFx0XHRyICs9IDI7XG5cdFx0XHRcdFx0XHRcdFx0XHRjIC09IDI7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9IGVsc2UgeyAvLyBlbHNlIG9mZnNldCBhZnRlciBkZXN0aW5hdGlvblxuXHRcdFx0XHRcdFx0XHRcdHIgPSBxIC0gZDtcblx0XHRcdFx0XHRcdFx0XHRkbyB7XG5cdFx0XHRcdFx0XHRcdFx0XHRyICs9IHMuZW5kOyAvLyBmb3JjZSBwb2ludGVyIGluIHdpblxuXHRcdFx0XHRcdFx0XHRcdH0gd2hpbGUgKHIgPCAwKTsgLy8gY292ZXJzIGludmFsaWQgZGlzdGFuY2VzXG5cdFx0XHRcdFx0XHRcdFx0ZSA9IHMuZW5kIC0gcjtcblx0XHRcdFx0XHRcdFx0XHRpZiAoYyA+IGUpIHsgLy8gaWYgc291cmNlIGNyb3NzZXMsXG5cdFx0XHRcdFx0XHRcdFx0XHRjIC09IGU7IC8vIHdyYXBwZWQgY29weVxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKHEgLSByID4gMCAmJiBlID4gKHEgLSByKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRkbyB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0cy53aW5bcSsrXSA9IHMud2luW3IrK107XG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gd2hpbGUgKC0tZSAhPT0gMCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRzLndpbi5zZXQocy53aW4uc3ViYXJyYXkociwgciArIGUpLCBxKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cSArPSBlO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRyICs9IGU7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGUgPSAwO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0ciA9IDA7IC8vIGNvcHkgcmVzdCBmcm9tIHN0YXJ0IG9mIHdpblxuXHRcdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0Ly8gY29weSBhbGwgb3Igd2hhdCdzIGxlZnRcblx0XHRcdFx0XHRcdFx0aWYgKHEgLSByID4gMCAmJiBjID4gKHEgLSByKSkge1xuXHRcdFx0XHRcdFx0XHRcdGRvIHtcblx0XHRcdFx0XHRcdFx0XHRcdHMud2luW3ErK10gPSBzLndpbltyKytdO1xuXHRcdFx0XHRcdFx0XHRcdH0gd2hpbGUgKC0tYyAhPT0gMCk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cy53aW4uc2V0KHMud2luLnN1YmFycmF5KHIsIHIgKyBjKSwgcSk7XG5cdFx0XHRcdFx0XHRcdFx0cSArPSBjO1xuXHRcdFx0XHRcdFx0XHRcdHIgKz0gYztcblx0XHRcdFx0XHRcdFx0XHRjID0gMDtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoKGUgJiA2NCkgPT09IDApIHtcblx0XHRcdFx0XHRcdFx0dCArPSB0cFt0cF9pbmRleF90XzMgKyAyXTtcblx0XHRcdFx0XHRcdFx0dCArPSAoYiAmIGluZmxhdGVfbWFza1tlXSk7XG5cdFx0XHRcdFx0XHRcdHRwX2luZGV4X3RfMyA9ICh0cF9pbmRleCArIHQpICogMztcblx0XHRcdFx0XHRcdFx0ZSA9IHRwW3RwX2luZGV4X3RfM107XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHR6Lm1zZyA9IFwiaW52YWxpZCBkaXN0YW5jZSBjb2RlXCI7XG5cblx0XHRcdFx0XHRcdFx0YyA9IHouYXZhaWxfaW4gLSBuO1xuXHRcdFx0XHRcdFx0XHRjID0gKGsgPj4gMykgPCBjID8gayA+PiAzIDogYztcblx0XHRcdFx0XHRcdFx0biArPSBjO1xuXHRcdFx0XHRcdFx0XHRwIC09IGM7XG5cdFx0XHRcdFx0XHRcdGsgLT0gYyA8PCAzO1xuXG5cdFx0XHRcdFx0XHRcdHMuYml0YiA9IGI7XG5cdFx0XHRcdFx0XHRcdHMuYml0ayA9IGs7XG5cdFx0XHRcdFx0XHRcdHouYXZhaWxfaW4gPSBuO1xuXHRcdFx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0XHRcdHMud3JpdGUgPSBxO1xuXG5cdFx0XHRcdFx0XHRcdHJldHVybiBaX0RBVEFfRVJST1I7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG5cdFx0XHRcdFx0fSB3aGlsZSAodHJ1ZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoKGUgJiA2NCkgPT09IDApIHtcblx0XHRcdFx0XHR0ICs9IHRwW3RwX2luZGV4X3RfMyArIDJdO1xuXHRcdFx0XHRcdHQgKz0gKGIgJiBpbmZsYXRlX21hc2tbZV0pO1xuXHRcdFx0XHRcdHRwX2luZGV4X3RfMyA9ICh0cF9pbmRleCArIHQpICogMztcblx0XHRcdFx0XHRpZiAoKGUgPSB0cFt0cF9pbmRleF90XzNdKSA9PT0gMCkge1xuXG5cdFx0XHRcdFx0XHRiID4+PSAodHBbdHBfaW5kZXhfdF8zICsgMV0pO1xuXHRcdFx0XHRcdFx0ayAtPSAodHBbdHBfaW5kZXhfdF8zICsgMV0pO1xuXG5cdFx0XHRcdFx0XHRzLndpbltxKytdID0gLyogKGJ5dGUpICovdHBbdHBfaW5kZXhfdF8zICsgMl07XG5cdFx0XHRcdFx0XHRtLS07XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoKGUgJiAzMikgIT09IDApIHtcblxuXHRcdFx0XHRcdGMgPSB6LmF2YWlsX2luIC0gbjtcblx0XHRcdFx0XHRjID0gKGsgPj4gMykgPCBjID8gayA+PiAzIDogYztcblx0XHRcdFx0XHRuICs9IGM7XG5cdFx0XHRcdFx0cCAtPSBjO1xuXHRcdFx0XHRcdGsgLT0gYyA8PCAzO1xuXG5cdFx0XHRcdFx0cy5iaXRiID0gYjtcblx0XHRcdFx0XHRzLmJpdGsgPSBrO1xuXHRcdFx0XHRcdHouYXZhaWxfaW4gPSBuO1xuXHRcdFx0XHRcdHoudG90YWxfaW4gKz0gcCAtIHoubmV4dF9pbl9pbmRleDtcblx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdHMud3JpdGUgPSBxO1xuXG5cdFx0XHRcdFx0cmV0dXJuIFpfU1RSRUFNX0VORDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR6Lm1zZyA9IFwiaW52YWxpZCBsaXRlcmFsL2xlbmd0aCBjb2RlXCI7XG5cblx0XHRcdFx0XHRjID0gei5hdmFpbF9pbiAtIG47XG5cdFx0XHRcdFx0YyA9IChrID4+IDMpIDwgYyA/IGsgPj4gMyA6IGM7XG5cdFx0XHRcdFx0biArPSBjO1xuXHRcdFx0XHRcdHAgLT0gYztcblx0XHRcdFx0XHRrIC09IGMgPDwgMztcblxuXHRcdFx0XHRcdHMuYml0YiA9IGI7XG5cdFx0XHRcdFx0cy5iaXRrID0gaztcblx0XHRcdFx0XHR6LmF2YWlsX2luID0gbjtcblx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRzLndyaXRlID0gcTtcblxuXHRcdFx0XHRcdHJldHVybiBaX0RBVEFfRVJST1I7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnN0YW50LWNvbmRpdGlvblxuXHRcdFx0fSB3aGlsZSAodHJ1ZSk7XG5cdFx0fSB3aGlsZSAobSA+PSAyNTggJiYgbiA+PSAxMCk7XG5cblx0XHQvLyBub3QgZW5vdWdoIGlucHV0IG9yIG91dHB1dC0tcmVzdG9yZSBwb2ludGVycyBhbmQgcmV0dXJuXG5cdFx0YyA9IHouYXZhaWxfaW4gLSBuO1xuXHRcdGMgPSAoayA+PiAzKSA8IGMgPyBrID4+IDMgOiBjO1xuXHRcdG4gKz0gYztcblx0XHRwIC09IGM7XG5cdFx0ayAtPSBjIDw8IDM7XG5cblx0XHRzLmJpdGIgPSBiO1xuXHRcdHMuYml0ayA9IGs7XG5cdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0cy53cml0ZSA9IHE7XG5cblx0XHRyZXR1cm4gWl9PSztcblx0fVxuXG5cdHRoYXQuaW5pdCA9IGZ1bmN0aW9uIChibCwgYmQsIHRsLCB0bF9pbmRleCwgdGQsIHRkX2luZGV4KSB7XG5cdFx0bW9kZSA9IFNUQVJUO1xuXHRcdGxiaXRzID0gLyogKGJ5dGUpICovYmw7XG5cdFx0ZGJpdHMgPSAvKiAoYnl0ZSkgKi9iZDtcblx0XHRsdHJlZSA9IHRsO1xuXHRcdGx0cmVlX2luZGV4ID0gdGxfaW5kZXg7XG5cdFx0ZHRyZWUgPSB0ZDtcblx0XHRkdHJlZV9pbmRleCA9IHRkX2luZGV4O1xuXHRcdHRyZWUgPSBudWxsO1xuXHR9O1xuXG5cdHRoYXQucHJvYyA9IGZ1bmN0aW9uIChzLCB6LCByKSB7XG5cdFx0bGV0IGo7IC8vIHRlbXBvcmFyeSBzdG9yYWdlXG5cdFx0bGV0IHRpbmRleDsgLy8gdGVtcG9yYXJ5IHBvaW50ZXJcblx0XHRsZXQgZTsgLy8gZXh0cmEgYml0cyBvciBvcGVyYXRpb25cblx0XHRsZXQgYiA9IDA7IC8vIGJpdCBidWZmZXJcblx0XHRsZXQgayA9IDA7IC8vIGJpdHMgaW4gYml0IGJ1ZmZlclxuXHRcdGxldCBwID0gMDsgLy8gaW5wdXQgZGF0YSBwb2ludGVyXG5cdFx0bGV0IG47IC8vIGJ5dGVzIGF2YWlsYWJsZSB0aGVyZVxuXHRcdGxldCBxOyAvLyBvdXRwdXQgd2luIHdyaXRlIHBvaW50ZXJcblx0XHRsZXQgbTsgLy8gYnl0ZXMgdG8gZW5kIG9mIHdpbiBvciByZWFkIHBvaW50ZXJcblx0XHRsZXQgZjsgLy8gcG9pbnRlciB0byBjb3B5IHN0cmluZ3MgZnJvbVxuXG5cdFx0Ly8gY29weSBpbnB1dC9vdXRwdXQgaW5mb3JtYXRpb24gdG8gbG9jYWxzIChVUERBVEUgbWFjcm8gcmVzdG9yZXMpXG5cdFx0cCA9IHoubmV4dF9pbl9pbmRleDtcblx0XHRuID0gei5hdmFpbF9pbjtcblx0XHRiID0gcy5iaXRiO1xuXHRcdGsgPSBzLmJpdGs7XG5cdFx0cSA9IHMud3JpdGU7XG5cdFx0bSA9IHEgPCBzLnJlYWQgPyBzLnJlYWQgLSBxIC0gMSA6IHMuZW5kIC0gcTtcblxuXHRcdC8vIHByb2Nlc3MgaW5wdXQgYW5kIG91dHB1dCBiYXNlZCBvbiBjdXJyZW50IHN0YXRlXG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnN0YW50LWNvbmRpdGlvblxuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRzd2l0Y2ggKG1vZGUpIHtcblx0XHRcdFx0Ly8gd2FpdGluZyBmb3IgXCJpOlwiPWlucHV0LCBcIm86XCI9b3V0cHV0LCBcIng6XCI9bm90aGluZ1xuXHRcdFx0XHRjYXNlIFNUQVJUOiAvLyB4OiBzZXQgdXAgZm9yIExFTlxuXHRcdFx0XHRcdGlmIChtID49IDI1OCAmJiBuID49IDEwKSB7XG5cblx0XHRcdFx0XHRcdHMuYml0YiA9IGI7XG5cdFx0XHRcdFx0XHRzLmJpdGsgPSBrO1xuXHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdFx0cy53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRyID0gaW5mbGF0ZV9mYXN0KGxiaXRzLCBkYml0cywgbHRyZWUsIGx0cmVlX2luZGV4LCBkdHJlZSwgZHRyZWVfaW5kZXgsIHMsIHopO1xuXG5cdFx0XHRcdFx0XHRwID0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdFx0biA9IHouYXZhaWxfaW47XG5cdFx0XHRcdFx0XHRiID0gcy5iaXRiO1xuXHRcdFx0XHRcdFx0ayA9IHMuYml0aztcblx0XHRcdFx0XHRcdHEgPSBzLndyaXRlO1xuXHRcdFx0XHRcdFx0bSA9IHEgPCBzLnJlYWQgPyBzLnJlYWQgLSBxIC0gMSA6IHMuZW5kIC0gcTtcblxuXHRcdFx0XHRcdFx0aWYgKHIgIT0gWl9PSykge1xuXHRcdFx0XHRcdFx0XHRtb2RlID0gciA9PSBaX1NUUkVBTV9FTkQgPyBXQVNIIDogQkFEQ09ERTtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG5lZWQgPSBsYml0cztcblx0XHRcdFx0XHR0cmVlID0gbHRyZWU7XG5cdFx0XHRcdFx0dHJlZV9pbmRleCA9IGx0cmVlX2luZGV4O1xuXG5cdFx0XHRcdFx0bW9kZSA9IExFTjtcblx0XHRcdFx0LyogZmFsbHMgdGhyb3VnaCAqL1xuXHRcdFx0XHRjYXNlIExFTjogLy8gaTogZ2V0IGxlbmd0aC9saXRlcmFsL2VvYiBuZXh0XG5cdFx0XHRcdFx0aiA9IG5lZWQ7XG5cblx0XHRcdFx0XHR3aGlsZSAoayA8IChqKSkge1xuXHRcdFx0XHRcdFx0aWYgKG4gIT09IDApXG5cdFx0XHRcdFx0XHRcdHIgPSBaX09LO1xuXHRcdFx0XHRcdFx0ZWxzZSB7XG5cblx0XHRcdFx0XHRcdFx0cy5iaXRiID0gYjtcblx0XHRcdFx0XHRcdFx0cy5iaXRrID0gaztcblx0XHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHRcdHoudG90YWxfaW4gKz0gcCAtIHoubmV4dF9pbl9pbmRleDtcblx0XHRcdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRcdFx0cy53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBzLmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRuLS07XG5cdFx0XHRcdFx0XHRiIHw9ICh6LnJlYWRfYnl0ZShwKyspICYgMHhmZikgPDwgaztcblx0XHRcdFx0XHRcdGsgKz0gODtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0aW5kZXggPSAodHJlZV9pbmRleCArIChiICYgaW5mbGF0ZV9tYXNrW2pdKSkgKiAzO1xuXG5cdFx0XHRcdFx0YiA+Pj49ICh0cmVlW3RpbmRleCArIDFdKTtcblx0XHRcdFx0XHRrIC09ICh0cmVlW3RpbmRleCArIDFdKTtcblxuXHRcdFx0XHRcdGUgPSB0cmVlW3RpbmRleF07XG5cblx0XHRcdFx0XHRpZiAoZSA9PT0gMCkgeyAvLyBsaXRlcmFsXG5cdFx0XHRcdFx0XHRsaXQgPSB0cmVlW3RpbmRleCArIDJdO1xuXHRcdFx0XHRcdFx0bW9kZSA9IExJVDtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoKGUgJiAxNikgIT09IDApIHsgLy8gbGVuZ3RoXG5cdFx0XHRcdFx0XHRnZXQgPSBlICYgMTU7XG5cdFx0XHRcdFx0XHRsZW4gPSB0cmVlW3RpbmRleCArIDJdO1xuXHRcdFx0XHRcdFx0bW9kZSA9IExFTkVYVDtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoKGUgJiA2NCkgPT09IDApIHsgLy8gbmV4dCB0YWJsZVxuXHRcdFx0XHRcdFx0bmVlZCA9IGU7XG5cdFx0XHRcdFx0XHR0cmVlX2luZGV4ID0gdGluZGV4IC8gMyArIHRyZWVbdGluZGV4ICsgMl07XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKChlICYgMzIpICE9PSAwKSB7IC8vIGVuZCBvZiBibG9ja1xuXHRcdFx0XHRcdFx0bW9kZSA9IFdBU0g7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bW9kZSA9IEJBRENPREU7IC8vIGludmFsaWQgY29kZVxuXHRcdFx0XHRcdHoubXNnID0gXCJpbnZhbGlkIGxpdGVyYWwvbGVuZ3RoIGNvZGVcIjtcblx0XHRcdFx0XHRyID0gWl9EQVRBX0VSUk9SO1xuXG5cdFx0XHRcdFx0cy5iaXRiID0gYjtcblx0XHRcdFx0XHRzLmJpdGsgPSBrO1xuXHRcdFx0XHRcdHouYXZhaWxfaW4gPSBuO1xuXHRcdFx0XHRcdHoudG90YWxfaW4gKz0gcCAtIHoubmV4dF9pbl9pbmRleDtcblx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdHMud3JpdGUgPSBxO1xuXHRcdFx0XHRcdHJldHVybiBzLmluZmxhdGVfZmx1c2goeiwgcik7XG5cblx0XHRcdFx0Y2FzZSBMRU5FWFQ6IC8vIGk6IGdldHRpbmcgbGVuZ3RoIGV4dHJhIChoYXZlIGJhc2UpXG5cdFx0XHRcdFx0aiA9IGdldDtcblxuXHRcdFx0XHRcdHdoaWxlIChrIDwgKGopKSB7XG5cdFx0XHRcdFx0XHRpZiAobiAhPT0gMClcblx0XHRcdFx0XHRcdFx0ciA9IFpfT0s7XG5cdFx0XHRcdFx0XHRlbHNlIHtcblxuXHRcdFx0XHRcdFx0XHRzLmJpdGIgPSBiO1xuXHRcdFx0XHRcdFx0XHRzLmJpdGsgPSBrO1xuXHRcdFx0XHRcdFx0XHR6LmF2YWlsX2luID0gbjtcblx0XHRcdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdFx0XHRzLndyaXRlID0gcTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHMuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdG4tLTtcblx0XHRcdFx0XHRcdGIgfD0gKHoucmVhZF9ieXRlKHArKykgJiAweGZmKSA8PCBrO1xuXHRcdFx0XHRcdFx0ayArPSA4O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGxlbiArPSAoYiAmIGluZmxhdGVfbWFza1tqXSk7XG5cblx0XHRcdFx0XHRiID4+PSBqO1xuXHRcdFx0XHRcdGsgLT0gajtcblxuXHRcdFx0XHRcdG5lZWQgPSBkYml0cztcblx0XHRcdFx0XHR0cmVlID0gZHRyZWU7XG5cdFx0XHRcdFx0dHJlZV9pbmRleCA9IGR0cmVlX2luZGV4O1xuXHRcdFx0XHRcdG1vZGUgPSBESVNUO1xuXHRcdFx0XHQvKiBmYWxscyB0aHJvdWdoICovXG5cdFx0XHRcdGNhc2UgRElTVDogLy8gaTogZ2V0IGRpc3RhbmNlIG5leHRcblx0XHRcdFx0XHRqID0gbmVlZDtcblxuXHRcdFx0XHRcdHdoaWxlIChrIDwgKGopKSB7XG5cdFx0XHRcdFx0XHRpZiAobiAhPT0gMClcblx0XHRcdFx0XHRcdFx0ciA9IFpfT0s7XG5cdFx0XHRcdFx0XHRlbHNlIHtcblxuXHRcdFx0XHRcdFx0XHRzLmJpdGIgPSBiO1xuXHRcdFx0XHRcdFx0XHRzLmJpdGsgPSBrO1xuXHRcdFx0XHRcdFx0XHR6LmF2YWlsX2luID0gbjtcblx0XHRcdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdFx0XHRzLndyaXRlID0gcTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHMuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdG4tLTtcblx0XHRcdFx0XHRcdGIgfD0gKHoucmVhZF9ieXRlKHArKykgJiAweGZmKSA8PCBrO1xuXHRcdFx0XHRcdFx0ayArPSA4O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRpbmRleCA9ICh0cmVlX2luZGV4ICsgKGIgJiBpbmZsYXRlX21hc2tbal0pKSAqIDM7XG5cblx0XHRcdFx0XHRiID4+PSB0cmVlW3RpbmRleCArIDFdO1xuXHRcdFx0XHRcdGsgLT0gdHJlZVt0aW5kZXggKyAxXTtcblxuXHRcdFx0XHRcdGUgPSAodHJlZVt0aW5kZXhdKTtcblx0XHRcdFx0XHRpZiAoKGUgJiAxNikgIT09IDApIHsgLy8gZGlzdGFuY2Vcblx0XHRcdFx0XHRcdGdldCA9IGUgJiAxNTtcblx0XHRcdFx0XHRcdGRpc3QgPSB0cmVlW3RpbmRleCArIDJdO1xuXHRcdFx0XHRcdFx0bW9kZSA9IERJU1RFWFQ7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKChlICYgNjQpID09PSAwKSB7IC8vIG5leHQgdGFibGVcblx0XHRcdFx0XHRcdG5lZWQgPSBlO1xuXHRcdFx0XHRcdFx0dHJlZV9pbmRleCA9IHRpbmRleCAvIDMgKyB0cmVlW3RpbmRleCArIDJdO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG1vZGUgPSBCQURDT0RFOyAvLyBpbnZhbGlkIGNvZGVcblx0XHRcdFx0XHR6Lm1zZyA9IFwiaW52YWxpZCBkaXN0YW5jZSBjb2RlXCI7XG5cdFx0XHRcdFx0ciA9IFpfREFUQV9FUlJPUjtcblxuXHRcdFx0XHRcdHMuYml0YiA9IGI7XG5cdFx0XHRcdFx0cy5iaXRrID0gaztcblx0XHRcdFx0XHR6LmF2YWlsX2luID0gbjtcblx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRzLndyaXRlID0gcTtcblx0XHRcdFx0XHRyZXR1cm4gcy5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXG5cdFx0XHRcdGNhc2UgRElTVEVYVDogLy8gaTogZ2V0dGluZyBkaXN0YW5jZSBleHRyYVxuXHRcdFx0XHRcdGogPSBnZXQ7XG5cblx0XHRcdFx0XHR3aGlsZSAoayA8IChqKSkge1xuXHRcdFx0XHRcdFx0aWYgKG4gIT09IDApXG5cdFx0XHRcdFx0XHRcdHIgPSBaX09LO1xuXHRcdFx0XHRcdFx0ZWxzZSB7XG5cblx0XHRcdFx0XHRcdFx0cy5iaXRiID0gYjtcblx0XHRcdFx0XHRcdFx0cy5iaXRrID0gaztcblx0XHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHRcdHoudG90YWxfaW4gKz0gcCAtIHoubmV4dF9pbl9pbmRleDtcblx0XHRcdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRcdFx0cy53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBzLmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRuLS07XG5cdFx0XHRcdFx0XHRiIHw9ICh6LnJlYWRfYnl0ZShwKyspICYgMHhmZikgPDwgaztcblx0XHRcdFx0XHRcdGsgKz0gODtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRkaXN0ICs9IChiICYgaW5mbGF0ZV9tYXNrW2pdKTtcblxuXHRcdFx0XHRcdGIgPj49IGo7XG5cdFx0XHRcdFx0ayAtPSBqO1xuXG5cdFx0XHRcdFx0bW9kZSA9IENPUFk7XG5cdFx0XHRcdC8qIGZhbGxzIHRocm91Z2ggKi9cblx0XHRcdFx0Y2FzZSBDT1BZOiAvLyBvOiBjb3B5aW5nIGJ5dGVzIGluIHdpbiwgd2FpdGluZyBmb3Igc3BhY2Vcblx0XHRcdFx0XHRmID0gcSAtIGRpc3Q7XG5cdFx0XHRcdFx0d2hpbGUgKGYgPCAwKSB7IC8vIG1vZHVsbyB3aW4gc2l6ZS1cIndoaWxlXCIgaW5zdGVhZFxuXHRcdFx0XHRcdFx0ZiArPSBzLmVuZDsgLy8gb2YgXCJpZlwiIGhhbmRsZXMgaW52YWxpZCBkaXN0YW5jZXNcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0d2hpbGUgKGxlbiAhPT0gMCkge1xuXG5cdFx0XHRcdFx0XHRpZiAobSA9PT0gMCkge1xuXHRcdFx0XHRcdFx0XHRpZiAocSA9PSBzLmVuZCAmJiBzLnJlYWQgIT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHRxID0gMDtcblx0XHRcdFx0XHRcdFx0XHRtID0gcSA8IHMucmVhZCA/IHMucmVhZCAtIHEgLSAxIDogcy5lbmQgLSBxO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChtID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0cy53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdFx0ciA9IHMuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHRcdFx0XHRxID0gcy53cml0ZTtcblx0XHRcdFx0XHRcdFx0XHRtID0gcSA8IHMucmVhZCA/IHMucmVhZCAtIHEgLSAxIDogcy5lbmQgLSBxO1xuXG5cdFx0XHRcdFx0XHRcdFx0aWYgKHEgPT0gcy5lbmQgJiYgcy5yZWFkICE9PSAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRxID0gMDtcblx0XHRcdFx0XHRcdFx0XHRcdG0gPSBxIDwgcy5yZWFkID8gcy5yZWFkIC0gcSAtIDEgOiBzLmVuZCAtIHE7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdFx0aWYgKG0gPT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHRcdHMuYml0YiA9IGI7XG5cdFx0XHRcdFx0XHRcdFx0XHRzLmJpdGsgPSBrO1xuXHRcdFx0XHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdFx0XHRcdFx0cy53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gcy5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRzLndpbltxKytdID0gcy53aW5bZisrXTtcblx0XHRcdFx0XHRcdG0tLTtcblxuXHRcdFx0XHRcdFx0aWYgKGYgPT0gcy5lbmQpXG5cdFx0XHRcdFx0XHRcdGYgPSAwO1xuXHRcdFx0XHRcdFx0bGVuLS07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG1vZGUgPSBTVEFSVDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBMSVQ6IC8vIG86IGdvdCBsaXRlcmFsLCB3YWl0aW5nIGZvciBvdXRwdXQgc3BhY2Vcblx0XHRcdFx0XHRpZiAobSA9PT0gMCkge1xuXHRcdFx0XHRcdFx0aWYgKHEgPT0gcy5lbmQgJiYgcy5yZWFkICE9PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHEgPSAwO1xuXHRcdFx0XHRcdFx0XHRtID0gcSA8IHMucmVhZCA/IHMucmVhZCAtIHEgLSAxIDogcy5lbmQgLSBxO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKG0gPT09IDApIHtcblx0XHRcdFx0XHRcdFx0cy53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdHIgPSBzLmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHRcdFx0XHRcdHEgPSBzLndyaXRlO1xuXHRcdFx0XHRcdFx0XHRtID0gcSA8IHMucmVhZCA/IHMucmVhZCAtIHEgLSAxIDogcy5lbmQgLSBxO1xuXG5cdFx0XHRcdFx0XHRcdGlmIChxID09IHMuZW5kICYmIHMucmVhZCAhPT0gMCkge1xuXHRcdFx0XHRcdFx0XHRcdHEgPSAwO1xuXHRcdFx0XHRcdFx0XHRcdG0gPSBxIDwgcy5yZWFkID8gcy5yZWFkIC0gcSAtIDEgOiBzLmVuZCAtIHE7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKG0gPT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHRzLmJpdGIgPSBiO1xuXHRcdFx0XHRcdFx0XHRcdHMuYml0ayA9IGs7XG5cdFx0XHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0XHRcdFx0cy53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHMuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyID0gWl9PSztcblxuXHRcdFx0XHRcdHMud2luW3ErK10gPSAvKiAoYnl0ZSkgKi9saXQ7XG5cdFx0XHRcdFx0bS0tO1xuXG5cdFx0XHRcdFx0bW9kZSA9IFNUQVJUO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFdBU0g6IC8vIG86IGdvdCBlb2IsIHBvc3NpYmx5IG1vcmUgb3V0cHV0XG5cdFx0XHRcdFx0aWYgKGsgPiA3KSB7IC8vIHJldHVybiB1bnVzZWQgYnl0ZSwgaWYgYW55XG5cdFx0XHRcdFx0XHRrIC09IDg7XG5cdFx0XHRcdFx0XHRuKys7XG5cdFx0XHRcdFx0XHRwLS07IC8vIGNhbiBhbHdheXMgcmV0dXJuIG9uZVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHMud3JpdGUgPSBxO1xuXHRcdFx0XHRcdHIgPSBzLmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHRcdFx0cSA9IHMud3JpdGU7XG5cdFx0XHRcdFx0bSA9IHEgPCBzLnJlYWQgPyBzLnJlYWQgLSBxIC0gMSA6IHMuZW5kIC0gcTtcblxuXHRcdFx0XHRcdGlmIChzLnJlYWQgIT0gcy53cml0ZSkge1xuXHRcdFx0XHRcdFx0cy5iaXRiID0gYjtcblx0XHRcdFx0XHRcdHMuYml0ayA9IGs7XG5cdFx0XHRcdFx0XHR6LmF2YWlsX2luID0gbjtcblx0XHRcdFx0XHRcdHoudG90YWxfaW4gKz0gcCAtIHoubmV4dF9pbl9pbmRleDtcblx0XHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0XHRzLndyaXRlID0gcTtcblx0XHRcdFx0XHRcdHJldHVybiBzLmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG1vZGUgPSBFTkQ7XG5cdFx0XHRcdC8qIGZhbGxzIHRocm91Z2ggKi9cblx0XHRcdFx0Y2FzZSBFTkQ6XG5cdFx0XHRcdFx0ciA9IFpfU1RSRUFNX0VORDtcblx0XHRcdFx0XHRzLmJpdGIgPSBiO1xuXHRcdFx0XHRcdHMuYml0ayA9IGs7XG5cdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0cy53cml0ZSA9IHE7XG5cdFx0XHRcdFx0cmV0dXJuIHMuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblxuXHRcdFx0XHRjYXNlIEJBRENPREU6IC8vIHg6IGdvdCBlcnJvclxuXG5cdFx0XHRcdFx0ciA9IFpfREFUQV9FUlJPUjtcblxuXHRcdFx0XHRcdHMuYml0YiA9IGI7XG5cdFx0XHRcdFx0cy5iaXRrID0gaztcblx0XHRcdFx0XHR6LmF2YWlsX2luID0gbjtcblx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRzLndyaXRlID0gcTtcblx0XHRcdFx0XHRyZXR1cm4gcy5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0ciA9IFpfU1RSRUFNX0VSUk9SO1xuXG5cdFx0XHRcdFx0cy5iaXRiID0gYjtcblx0XHRcdFx0XHRzLmJpdGsgPSBrO1xuXHRcdFx0XHRcdHouYXZhaWxfaW4gPSBuO1xuXHRcdFx0XHRcdHoudG90YWxfaW4gKz0gcCAtIHoubmV4dF9pbl9pbmRleDtcblx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdHMud3JpdGUgPSBxO1xuXHRcdFx0XHRcdHJldHVybiBzLmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdHRoYXQuZnJlZSA9IGZ1bmN0aW9uICgpIHtcblx0XHQvLyBaRlJFRSh6LCBjKTtcblx0fTtcblxufVxuXG4vLyBJbmZCbG9ja3NcblxuLy8gVGFibGUgZm9yIGRlZmxhdGUgZnJvbSBQS1pJUCdzIGFwcG5vdGUudHh0LlxuY29uc3QgYm9yZGVyID0gWyAvLyBPcmRlciBvZiB0aGUgYml0IGxlbmd0aCBjb2RlIGxlbmd0aHNcblx0MTYsIDE3LCAxOCwgMCwgOCwgNywgOSwgNiwgMTAsIDUsIDExLCA0LCAxMiwgMywgMTMsIDIsIDE0LCAxLCAxNV07XG5cbmNvbnN0IFRZUEUgPSAwOyAvLyBnZXQgdHlwZSBiaXRzICgzLCBpbmNsdWRpbmcgZW5kIGJpdClcbmNvbnN0IExFTlMgPSAxOyAvLyBnZXQgbGVuZ3RocyBmb3Igc3RvcmVkXG5jb25zdCBTVE9SRUQgPSAyOy8vIHByb2Nlc3Npbmcgc3RvcmVkIGJsb2NrXG5jb25zdCBUQUJMRSA9IDM7IC8vIGdldCB0YWJsZSBsZW5ndGhzXG5jb25zdCBCVFJFRSA9IDQ7IC8vIGdldCBiaXQgbGVuZ3RocyB0cmVlIGZvciBhIGR5bmFtaWNcbi8vIGJsb2NrXG5jb25zdCBEVFJFRSA9IDU7IC8vIGdldCBsZW5ndGgsIGRpc3RhbmNlIHRyZWVzIGZvciBhXG4vLyBkeW5hbWljIGJsb2NrXG5jb25zdCBDT0RFUyA9IDY7IC8vIHByb2Nlc3NpbmcgZml4ZWQgb3IgZHluYW1pYyBibG9ja1xuY29uc3QgRFJZID0gNzsgLy8gb3V0cHV0IHJlbWFpbmluZyB3aW4gYnl0ZXNcbmNvbnN0IERPTkVMT0NLUyA9IDg7IC8vIGZpbmlzaGVkIGxhc3QgYmxvY2ssIGRvbmVcbmNvbnN0IEJBREJMT0NLUyA9IDk7IC8vIG90IGEgZGF0YSBlcnJvci0tc3R1Y2sgaGVyZVxuXG5mdW5jdGlvbiBJbmZCbG9ja3Moeiwgdykge1xuXHRjb25zdCB0aGF0ID0gdGhpcztcblxuXHRsZXQgbW9kZSA9IFRZUEU7IC8vIGN1cnJlbnQgaW5mbGF0ZV9ibG9jayBtb2RlXG5cblx0bGV0IGxlZnQgPSAwOyAvLyBpZiBTVE9SRUQsIGJ5dGVzIGxlZnQgdG8gY29weVxuXG5cdGxldCB0YWJsZSA9IDA7IC8vIHRhYmxlIGxlbmd0aHMgKDE0IGJpdHMpXG5cdGxldCBpbmRleCA9IDA7IC8vIGluZGV4IGludG8gYmxlbnMgKG9yIGJvcmRlcilcblx0bGV0IGJsZW5zOyAvLyBiaXQgbGVuZ3RocyBvZiBjb2Rlc1xuXHRjb25zdCBiYiA9IFswXTsgLy8gYml0IGxlbmd0aCB0cmVlIGRlcHRoXG5cdGNvbnN0IHRiID0gWzBdOyAvLyBiaXQgbGVuZ3RoIGRlY29kaW5nIHRyZWVcblxuXHRjb25zdCBjb2RlcyA9IG5ldyBJbmZDb2RlcygpOyAvLyBpZiBDT0RFUywgY3VycmVudCBzdGF0ZVxuXG5cdGxldCBsYXN0ID0gMDsgLy8gdHJ1ZSBpZiB0aGlzIGJsb2NrIGlzIHRoZSBsYXN0IGJsb2NrXG5cblx0bGV0IGh1ZnRzID0gbmV3IEludDMyQXJyYXkoTUFOWSAqIDMpOyAvLyBzaW5nbGUgbWFsbG9jIGZvciB0cmVlIHNwYWNlXG5cdGNvbnN0IGNoZWNrID0gMDsgLy8gY2hlY2sgb24gb3V0cHV0XG5cdGNvbnN0IGluZnRyZWUgPSBuZXcgSW5mVHJlZSgpO1xuXG5cdHRoYXQuYml0ayA9IDA7IC8vIGJpdHMgaW4gYml0IGJ1ZmZlclxuXHR0aGF0LmJpdGIgPSAwOyAvLyBiaXQgYnVmZmVyXG5cdHRoYXQud2luID0gbmV3IFVpbnQ4QXJyYXkodyk7IC8vIHNsaWRpbmcgd2luXG5cdHRoYXQuZW5kID0gdzsgLy8gb25lIGJ5dGUgYWZ0ZXIgc2xpZGluZyB3aW5cblx0dGhhdC5yZWFkID0gMDsgLy8gd2luIHJlYWQgcG9pbnRlclxuXHR0aGF0LndyaXRlID0gMDsgLy8gd2luIHdyaXRlIHBvaW50ZXJcblxuXHR0aGF0LnJlc2V0ID0gZnVuY3Rpb24gKHosIGMpIHtcblx0XHRpZiAoYylcblx0XHRcdGNbMF0gPSBjaGVjaztcblx0XHQvLyBpZiAobW9kZSA9PSBCVFJFRSB8fCBtb2RlID09IERUUkVFKSB7XG5cdFx0Ly8gfVxuXHRcdGlmIChtb2RlID09IENPREVTKSB7XG5cdFx0XHRjb2Rlcy5mcmVlKHopO1xuXHRcdH1cblx0XHRtb2RlID0gVFlQRTtcblx0XHR0aGF0LmJpdGsgPSAwO1xuXHRcdHRoYXQuYml0YiA9IDA7XG5cdFx0dGhhdC5yZWFkID0gdGhhdC53cml0ZSA9IDA7XG5cdH07XG5cblx0dGhhdC5yZXNldCh6LCBudWxsKTtcblxuXHQvLyBjb3B5IGFzIG11Y2ggYXMgcG9zc2libGUgZnJvbSB0aGUgc2xpZGluZyB3aW4gdG8gdGhlIG91dHB1dCBhcmVhXG5cdHRoYXQuaW5mbGF0ZV9mbHVzaCA9IGZ1bmN0aW9uICh6LCByKSB7XG5cdFx0bGV0IG47XG5cdFx0bGV0IHA7XG5cdFx0bGV0IHE7XG5cblx0XHQvLyBsb2NhbCBjb3BpZXMgb2Ygc291cmNlIGFuZCBkZXN0aW5hdGlvbiBwb2ludGVyc1xuXHRcdHAgPSB6Lm5leHRfb3V0X2luZGV4O1xuXHRcdHEgPSB0aGF0LnJlYWQ7XG5cblx0XHQvLyBjb21wdXRlIG51bWJlciBvZiBieXRlcyB0byBjb3B5IGFzIGZhciBhcyBlbmQgb2Ygd2luXG5cdFx0biA9IC8qIChpbnQpICovKChxIDw9IHRoYXQud3JpdGUgPyB0aGF0LndyaXRlIDogdGhhdC5lbmQpIC0gcSk7XG5cdFx0aWYgKG4gPiB6LmF2YWlsX291dClcblx0XHRcdG4gPSB6LmF2YWlsX291dDtcblx0XHRpZiAobiAhPT0gMCAmJiByID09IFpfQlVGX0VSUk9SKVxuXHRcdFx0ciA9IFpfT0s7XG5cblx0XHQvLyB1cGRhdGUgY291bnRlcnNcblx0XHR6LmF2YWlsX291dCAtPSBuO1xuXHRcdHoudG90YWxfb3V0ICs9IG47XG5cblx0XHQvLyBjb3B5IGFzIGZhciBhcyBlbmQgb2Ygd2luXG5cdFx0ei5uZXh0X291dC5zZXQodGhhdC53aW4uc3ViYXJyYXkocSwgcSArIG4pLCBwKTtcblx0XHRwICs9IG47XG5cdFx0cSArPSBuO1xuXG5cdFx0Ly8gc2VlIGlmIG1vcmUgdG8gY29weSBhdCBiZWdpbm5pbmcgb2Ygd2luXG5cdFx0aWYgKHEgPT0gdGhhdC5lbmQpIHtcblx0XHRcdC8vIHdyYXAgcG9pbnRlcnNcblx0XHRcdHEgPSAwO1xuXHRcdFx0aWYgKHRoYXQud3JpdGUgPT0gdGhhdC5lbmQpXG5cdFx0XHRcdHRoYXQud3JpdGUgPSAwO1xuXG5cdFx0XHQvLyBjb21wdXRlIGJ5dGVzIHRvIGNvcHlcblx0XHRcdG4gPSB0aGF0LndyaXRlIC0gcTtcblx0XHRcdGlmIChuID4gei5hdmFpbF9vdXQpXG5cdFx0XHRcdG4gPSB6LmF2YWlsX291dDtcblx0XHRcdGlmIChuICE9PSAwICYmIHIgPT0gWl9CVUZfRVJST1IpXG5cdFx0XHRcdHIgPSBaX09LO1xuXG5cdFx0XHQvLyB1cGRhdGUgY291bnRlcnNcblx0XHRcdHouYXZhaWxfb3V0IC09IG47XG5cdFx0XHR6LnRvdGFsX291dCArPSBuO1xuXG5cdFx0XHQvLyBjb3B5XG5cdFx0XHR6Lm5leHRfb3V0LnNldCh0aGF0Lndpbi5zdWJhcnJheShxLCBxICsgbiksIHApO1xuXHRcdFx0cCArPSBuO1xuXHRcdFx0cSArPSBuO1xuXHRcdH1cblxuXHRcdC8vIHVwZGF0ZSBwb2ludGVyc1xuXHRcdHoubmV4dF9vdXRfaW5kZXggPSBwO1xuXHRcdHRoYXQucmVhZCA9IHE7XG5cblx0XHQvLyBkb25lXG5cdFx0cmV0dXJuIHI7XG5cdH07XG5cblx0dGhhdC5wcm9jID0gZnVuY3Rpb24gKHosIHIpIHtcblx0XHRsZXQgdDsgLy8gdGVtcG9yYXJ5IHN0b3JhZ2Vcblx0XHRsZXQgYjsgLy8gYml0IGJ1ZmZlclxuXHRcdGxldCBrOyAvLyBiaXRzIGluIGJpdCBidWZmZXJcblx0XHRsZXQgcDsgLy8gaW5wdXQgZGF0YSBwb2ludGVyXG5cdFx0bGV0IG47IC8vIGJ5dGVzIGF2YWlsYWJsZSB0aGVyZVxuXHRcdGxldCBxOyAvLyBvdXRwdXQgd2luIHdyaXRlIHBvaW50ZXJcblx0XHRsZXQgbTsgLy8gYnl0ZXMgdG8gZW5kIG9mIHdpbiBvciByZWFkIHBvaW50ZXJcblxuXHRcdGxldCBpO1xuXG5cdFx0Ly8gY29weSBpbnB1dC9vdXRwdXQgaW5mb3JtYXRpb24gdG8gbG9jYWxzIChVUERBVEUgbWFjcm8gcmVzdG9yZXMpXG5cdFx0Ly8ge1xuXHRcdHAgPSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0biA9IHouYXZhaWxfaW47XG5cdFx0YiA9IHRoYXQuYml0Yjtcblx0XHRrID0gdGhhdC5iaXRrO1xuXHRcdC8vIH1cblx0XHQvLyB7XG5cdFx0cSA9IHRoYXQud3JpdGU7XG5cdFx0bSA9IC8qIChpbnQpICovKHEgPCB0aGF0LnJlYWQgPyB0aGF0LnJlYWQgLSBxIC0gMSA6IHRoYXQuZW5kIC0gcSk7XG5cdFx0Ly8gfVxuXG5cdFx0Ly8gcHJvY2VzcyBpbnB1dCBiYXNlZCBvbiBjdXJyZW50IHN0YXRlXG5cdFx0Ly8gREVCVUcgZHRyZWVcblx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGxldCBibCwgYmQsIHRsLCB0ZCwgYmxfLCBiZF8sIHRsXywgdGRfO1xuXHRcdFx0c3dpdGNoIChtb2RlKSB7XG5cdFx0XHRcdGNhc2UgVFlQRTpcblxuXHRcdFx0XHRcdHdoaWxlIChrIDwgKDMpKSB7XG5cdFx0XHRcdFx0XHRpZiAobiAhPT0gMCkge1xuXHRcdFx0XHRcdFx0XHRyID0gWl9PSztcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRoYXQuYml0YiA9IGI7XG5cdFx0XHRcdFx0XHRcdHRoYXQuYml0ayA9IGs7XG5cdFx0XHRcdFx0XHRcdHouYXZhaWxfaW4gPSBuO1xuXHRcdFx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0XHRcdHRoYXQud3JpdGUgPSBxO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhhdC5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0bi0tO1xuXHRcdFx0XHRcdFx0YiB8PSAoei5yZWFkX2J5dGUocCsrKSAmIDB4ZmYpIDw8IGs7XG5cdFx0XHRcdFx0XHRrICs9IDg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHQgPSAvKiAoaW50KSAqLyhiICYgNyk7XG5cdFx0XHRcdFx0bGFzdCA9IHQgJiAxO1xuXG5cdFx0XHRcdFx0c3dpdGNoICh0ID4+PiAxKSB7XG5cdFx0XHRcdFx0XHRjYXNlIDA6IC8vIHN0b3JlZFxuXHRcdFx0XHRcdFx0XHQvLyB7XG5cdFx0XHRcdFx0XHRcdGIgPj4+PSAoMyk7XG5cdFx0XHRcdFx0XHRcdGsgLT0gKDMpO1xuXHRcdFx0XHRcdFx0XHQvLyB9XG5cdFx0XHRcdFx0XHRcdHQgPSBrICYgNzsgLy8gZ28gdG8gYnl0ZSBib3VuZGFyeVxuXG5cdFx0XHRcdFx0XHRcdC8vIHtcblx0XHRcdFx0XHRcdFx0YiA+Pj49ICh0KTtcblx0XHRcdFx0XHRcdFx0ayAtPSAodCk7XG5cdFx0XHRcdFx0XHRcdC8vIH1cblx0XHRcdFx0XHRcdFx0bW9kZSA9IExFTlM7IC8vIGdldCBsZW5ndGggb2Ygc3RvcmVkIGJsb2NrXG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSAxOiAvLyBmaXhlZFxuXHRcdFx0XHRcdFx0XHQvLyB7XG5cdFx0XHRcdFx0XHRcdGJsID0gW107IC8vIG5ldyBBcnJheSgxKTtcblx0XHRcdFx0XHRcdFx0YmQgPSBbXTsgLy8gbmV3IEFycmF5KDEpO1xuXHRcdFx0XHRcdFx0XHR0bCA9IFtbXV07IC8vIG5ldyBBcnJheSgxKTtcblx0XHRcdFx0XHRcdFx0dGQgPSBbW11dOyAvLyBuZXcgQXJyYXkoMSk7XG5cblx0XHRcdFx0XHRcdFx0SW5mVHJlZS5pbmZsYXRlX3RyZWVzX2ZpeGVkKGJsLCBiZCwgdGwsIHRkKTtcblx0XHRcdFx0XHRcdFx0Y29kZXMuaW5pdChibFswXSwgYmRbMF0sIHRsWzBdLCAwLCB0ZFswXSwgMCk7XG5cdFx0XHRcdFx0XHRcdC8vIH1cblxuXHRcdFx0XHRcdFx0XHQvLyB7XG5cdFx0XHRcdFx0XHRcdGIgPj4+PSAoMyk7XG5cdFx0XHRcdFx0XHRcdGsgLT0gKDMpO1xuXHRcdFx0XHRcdFx0XHQvLyB9XG5cblx0XHRcdFx0XHRcdFx0bW9kZSA9IENPREVTO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdGNhc2UgMjogLy8gZHluYW1pY1xuXG5cdFx0XHRcdFx0XHRcdC8vIHtcblx0XHRcdFx0XHRcdFx0YiA+Pj49ICgzKTtcblx0XHRcdFx0XHRcdFx0ayAtPSAoMyk7XG5cdFx0XHRcdFx0XHRcdC8vIH1cblxuXHRcdFx0XHRcdFx0XHRtb2RlID0gVEFCTEU7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSAzOiAvLyBpbGxlZ2FsXG5cblx0XHRcdFx0XHRcdFx0Ly8ge1xuXHRcdFx0XHRcdFx0XHRiID4+Pj0gKDMpO1xuXHRcdFx0XHRcdFx0XHRrIC09ICgzKTtcblx0XHRcdFx0XHRcdFx0Ly8gfVxuXHRcdFx0XHRcdFx0XHRtb2RlID0gQkFEQkxPQ0tTO1xuXHRcdFx0XHRcdFx0XHR6Lm1zZyA9IFwiaW52YWxpZCBibG9jayB0eXBlXCI7XG5cdFx0XHRcdFx0XHRcdHIgPSBaX0RBVEFfRVJST1I7XG5cblx0XHRcdFx0XHRcdFx0dGhhdC5iaXRiID0gYjtcblx0XHRcdFx0XHRcdFx0dGhhdC5iaXRrID0gaztcblx0XHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHRcdHoudG90YWxfaW4gKz0gcCAtIHoubmV4dF9pbl9pbmRleDtcblx0XHRcdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0aGF0LmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIExFTlM6XG5cblx0XHRcdFx0XHR3aGlsZSAoayA8ICgzMikpIHtcblx0XHRcdFx0XHRcdGlmIChuICE9PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHIgPSBaX09LO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhhdC5iaXRiID0gYjtcblx0XHRcdFx0XHRcdFx0dGhhdC5iaXRrID0gaztcblx0XHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHRcdHoudG90YWxfaW4gKz0gcCAtIHoubmV4dF9pbl9pbmRleDtcblx0XHRcdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0aGF0LmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRuLS07XG5cdFx0XHRcdFx0XHRiIHw9ICh6LnJlYWRfYnl0ZShwKyspICYgMHhmZikgPDwgaztcblx0XHRcdFx0XHRcdGsgKz0gODtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoKCgofmIpID4+PiAxNikgJiAweGZmZmYpICE9IChiICYgMHhmZmZmKSkge1xuXHRcdFx0XHRcdFx0bW9kZSA9IEJBREJMT0NLUztcblx0XHRcdFx0XHRcdHoubXNnID0gXCJpbnZhbGlkIHN0b3JlZCBibG9jayBsZW5ndGhzXCI7XG5cdFx0XHRcdFx0XHRyID0gWl9EQVRBX0VSUk9SO1xuXG5cdFx0XHRcdFx0XHR0aGF0LmJpdGIgPSBiO1xuXHRcdFx0XHRcdFx0dGhhdC5iaXRrID0gaztcblx0XHRcdFx0XHRcdHouYXZhaWxfaW4gPSBuO1xuXHRcdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRcdHRoYXQud3JpdGUgPSBxO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bGVmdCA9IChiICYgMHhmZmZmKTtcblx0XHRcdFx0XHRiID0gayA9IDA7IC8vIGR1bXAgYml0c1xuXHRcdFx0XHRcdG1vZGUgPSBsZWZ0ICE9PSAwID8gU1RPUkVEIDogKGxhc3QgIT09IDAgPyBEUlkgOiBUWVBFKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTVE9SRUQ6XG5cdFx0XHRcdFx0aWYgKG4gPT09IDApIHtcblx0XHRcdFx0XHRcdHRoYXQuYml0YiA9IGI7XG5cdFx0XHRcdFx0XHR0aGF0LmJpdGsgPSBrO1xuXHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhhdC5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmIChtID09PSAwKSB7XG5cdFx0XHRcdFx0XHRpZiAocSA9PSB0aGF0LmVuZCAmJiB0aGF0LnJlYWQgIT09IDApIHtcblx0XHRcdFx0XHRcdFx0cSA9IDA7XG5cdFx0XHRcdFx0XHRcdG0gPSAvKiAoaW50KSAqLyhxIDwgdGhhdC5yZWFkID8gdGhhdC5yZWFkIC0gcSAtIDEgOiB0aGF0LmVuZCAtIHEpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKG0gPT09IDApIHtcblx0XHRcdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdHIgPSB0aGF0LmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHRcdFx0XHRcdHEgPSB0aGF0LndyaXRlO1xuXHRcdFx0XHRcdFx0XHRtID0gLyogKGludCkgKi8ocSA8IHRoYXQucmVhZCA/IHRoYXQucmVhZCAtIHEgLSAxIDogdGhhdC5lbmQgLSBxKTtcblx0XHRcdFx0XHRcdFx0aWYgKHEgPT0gdGhhdC5lbmQgJiYgdGhhdC5yZWFkICE9PSAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0cSA9IDA7XG5cdFx0XHRcdFx0XHRcdFx0bSA9IC8qIChpbnQpICovKHEgPCB0aGF0LnJlYWQgPyB0aGF0LnJlYWQgLSBxIC0gMSA6IHRoYXQuZW5kIC0gcSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKG0gPT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHR0aGF0LmJpdGIgPSBiO1xuXHRcdFx0XHRcdFx0XHRcdHRoYXQuYml0ayA9IGs7XG5cdFx0XHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyID0gWl9PSztcblxuXHRcdFx0XHRcdHQgPSBsZWZ0O1xuXHRcdFx0XHRcdGlmICh0ID4gbilcblx0XHRcdFx0XHRcdHQgPSBuO1xuXHRcdFx0XHRcdGlmICh0ID4gbSlcblx0XHRcdFx0XHRcdHQgPSBtO1xuXHRcdFx0XHRcdHRoYXQud2luLnNldCh6LnJlYWRfYnVmKHAsIHQpLCBxKTtcblx0XHRcdFx0XHRwICs9IHQ7XG5cdFx0XHRcdFx0biAtPSB0O1xuXHRcdFx0XHRcdHEgKz0gdDtcblx0XHRcdFx0XHRtIC09IHQ7XG5cdFx0XHRcdFx0aWYgKChsZWZ0IC09IHQpICE9PSAwKVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0bW9kZSA9IGxhc3QgIT09IDAgPyBEUlkgOiBUWVBFO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFRBQkxFOlxuXG5cdFx0XHRcdFx0d2hpbGUgKGsgPCAoMTQpKSB7XG5cdFx0XHRcdFx0XHRpZiAobiAhPT0gMCkge1xuXHRcdFx0XHRcdFx0XHRyID0gWl9PSztcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRoYXQuYml0YiA9IGI7XG5cdFx0XHRcdFx0XHRcdHRoYXQuYml0ayA9IGs7XG5cdFx0XHRcdFx0XHRcdHouYXZhaWxfaW4gPSBuO1xuXHRcdFx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0XHRcdHRoYXQud3JpdGUgPSBxO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhhdC5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRuLS07XG5cdFx0XHRcdFx0XHRiIHw9ICh6LnJlYWRfYnl0ZShwKyspICYgMHhmZikgPDwgaztcblx0XHRcdFx0XHRcdGsgKz0gODtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR0YWJsZSA9IHQgPSAoYiAmIDB4M2ZmZik7XG5cdFx0XHRcdFx0aWYgKCh0ICYgMHgxZikgPiAyOSB8fCAoKHQgPj4gNSkgJiAweDFmKSA+IDI5KSB7XG5cdFx0XHRcdFx0XHRtb2RlID0gQkFEQkxPQ0tTO1xuXHRcdFx0XHRcdFx0ei5tc2cgPSBcInRvbyBtYW55IGxlbmd0aCBvciBkaXN0YW5jZSBzeW1ib2xzXCI7XG5cdFx0XHRcdFx0XHRyID0gWl9EQVRBX0VSUk9SO1xuXG5cdFx0XHRcdFx0XHR0aGF0LmJpdGIgPSBiO1xuXHRcdFx0XHRcdFx0dGhhdC5iaXRrID0gaztcblx0XHRcdFx0XHRcdHouYXZhaWxfaW4gPSBuO1xuXHRcdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRcdHRoYXQud3JpdGUgPSBxO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dCA9IDI1OCArICh0ICYgMHgxZikgKyAoKHQgPj4gNSkgJiAweDFmKTtcblx0XHRcdFx0XHRpZiAoIWJsZW5zIHx8IGJsZW5zLmxlbmd0aCA8IHQpIHtcblx0XHRcdFx0XHRcdGJsZW5zID0gW107IC8vIG5ldyBBcnJheSh0KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Zm9yIChpID0gMDsgaSA8IHQ7IGkrKykge1xuXHRcdFx0XHRcdFx0XHRibGVuc1tpXSA9IDA7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8ge1xuXHRcdFx0XHRcdGIgPj4+PSAoMTQpO1xuXHRcdFx0XHRcdGsgLT0gKDE0KTtcblx0XHRcdFx0XHQvLyB9XG5cblx0XHRcdFx0XHRpbmRleCA9IDA7XG5cdFx0XHRcdFx0bW9kZSA9IEJUUkVFO1xuXHRcdFx0XHQvKiBmYWxscyB0aHJvdWdoICovXG5cdFx0XHRcdGNhc2UgQlRSRUU6XG5cdFx0XHRcdFx0d2hpbGUgKGluZGV4IDwgNCArICh0YWJsZSA+Pj4gMTApKSB7XG5cdFx0XHRcdFx0XHR3aGlsZSAoayA8ICgzKSkge1xuXHRcdFx0XHRcdFx0XHRpZiAobiAhPT0gMCkge1xuXHRcdFx0XHRcdFx0XHRcdHIgPSBaX09LO1xuXHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHRoYXQuYml0YiA9IGI7XG5cdFx0XHRcdFx0XHRcdFx0dGhhdC5iaXRrID0gaztcblx0XHRcdFx0XHRcdFx0XHR6LmF2YWlsX2luID0gbjtcblx0XHRcdFx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRcdFx0XHR0aGF0LndyaXRlID0gcTtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhhdC5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdG4tLTtcblx0XHRcdFx0XHRcdFx0YiB8PSAoei5yZWFkX2J5dGUocCsrKSAmIDB4ZmYpIDw8IGs7XG5cdFx0XHRcdFx0XHRcdGsgKz0gODtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0YmxlbnNbYm9yZGVyW2luZGV4KytdXSA9IGIgJiA3O1xuXG5cdFx0XHRcdFx0XHQvLyB7XG5cdFx0XHRcdFx0XHRiID4+Pj0gKDMpO1xuXHRcdFx0XHRcdFx0ayAtPSAoMyk7XG5cdFx0XHRcdFx0XHQvLyB9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0d2hpbGUgKGluZGV4IDwgMTkpIHtcblx0XHRcdFx0XHRcdGJsZW5zW2JvcmRlcltpbmRleCsrXV0gPSAwO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGJiWzBdID0gNztcblx0XHRcdFx0XHR0ID0gaW5mdHJlZS5pbmZsYXRlX3RyZWVzX2JpdHMoYmxlbnMsIGJiLCB0YiwgaHVmdHMsIHopO1xuXHRcdFx0XHRcdGlmICh0ICE9IFpfT0spIHtcblx0XHRcdFx0XHRcdHIgPSB0O1xuXHRcdFx0XHRcdFx0aWYgKHIgPT0gWl9EQVRBX0VSUk9SKSB7XG5cdFx0XHRcdFx0XHRcdGJsZW5zID0gbnVsbDtcblx0XHRcdFx0XHRcdFx0bW9kZSA9IEJBREJMT0NLUztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0dGhhdC5iaXRiID0gYjtcblx0XHRcdFx0XHRcdHRoYXQuYml0ayA9IGs7XG5cdFx0XHRcdFx0XHR6LmF2YWlsX2luID0gbjtcblx0XHRcdFx0XHRcdHoudG90YWxfaW4gKz0gcCAtIHoubmV4dF9pbl9pbmRleDtcblx0XHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0XHR0aGF0LndyaXRlID0gcTtcblx0XHRcdFx0XHRcdHJldHVybiB0aGF0LmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aW5kZXggPSAwO1xuXHRcdFx0XHRcdG1vZGUgPSBEVFJFRTtcblx0XHRcdFx0LyogZmFsbHMgdGhyb3VnaCAqL1xuXHRcdFx0XHRjYXNlIERUUkVFOlxuXHRcdFx0XHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zdGFudC1jb25kaXRpb25cblx0XHRcdFx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0XHRcdFx0dCA9IHRhYmxlO1xuXHRcdFx0XHRcdFx0aWYgKGluZGV4ID49IDI1OCArICh0ICYgMHgxZikgKyAoKHQgPj4gNSkgJiAweDFmKSkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0bGV0IGosIGM7XG5cblx0XHRcdFx0XHRcdHQgPSBiYlswXTtcblxuXHRcdFx0XHRcdFx0d2hpbGUgKGsgPCAodCkpIHtcblx0XHRcdFx0XHRcdFx0aWYgKG4gIT09IDApIHtcblx0XHRcdFx0XHRcdFx0XHRyID0gWl9PSztcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHR0aGF0LmJpdGIgPSBiO1xuXHRcdFx0XHRcdFx0XHRcdHRoYXQuYml0ayA9IGs7XG5cdFx0XHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRuLS07XG5cdFx0XHRcdFx0XHRcdGIgfD0gKHoucmVhZF9ieXRlKHArKykgJiAweGZmKSA8PCBrO1xuXHRcdFx0XHRcdFx0XHRrICs9IDg7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIGlmICh0YlswXSA9PSAtMSkge1xuXHRcdFx0XHRcdFx0Ly8gU3lzdGVtLmVyci5wcmludGxuKFwibnVsbC4uLlwiKTtcblx0XHRcdFx0XHRcdC8vIH1cblxuXHRcdFx0XHRcdFx0dCA9IGh1ZnRzWyh0YlswXSArIChiICYgaW5mbGF0ZV9tYXNrW3RdKSkgKiAzICsgMV07XG5cdFx0XHRcdFx0XHRjID0gaHVmdHNbKHRiWzBdICsgKGIgJiBpbmZsYXRlX21hc2tbdF0pKSAqIDMgKyAyXTtcblxuXHRcdFx0XHRcdFx0aWYgKGMgPCAxNikge1xuXHRcdFx0XHRcdFx0XHRiID4+Pj0gKHQpO1xuXHRcdFx0XHRcdFx0XHRrIC09ICh0KTtcblx0XHRcdFx0XHRcdFx0YmxlbnNbaW5kZXgrK10gPSBjO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHsgLy8gYyA9PSAxNi4uMThcblx0XHRcdFx0XHRcdFx0aSA9IGMgPT0gMTggPyA3IDogYyAtIDE0O1xuXHRcdFx0XHRcdFx0XHRqID0gYyA9PSAxOCA/IDExIDogMztcblxuXHRcdFx0XHRcdFx0XHR3aGlsZSAoayA8ICh0ICsgaSkpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAobiAhPT0gMCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0ciA9IFpfT0s7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRoYXQuYml0YiA9IGI7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGF0LmJpdGsgPSBrO1xuXHRcdFx0XHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdGhhdC5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRuLS07XG5cdFx0XHRcdFx0XHRcdFx0YiB8PSAoei5yZWFkX2J5dGUocCsrKSAmIDB4ZmYpIDw8IGs7XG5cdFx0XHRcdFx0XHRcdFx0ayArPSA4O1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0YiA+Pj49ICh0KTtcblx0XHRcdFx0XHRcdFx0ayAtPSAodCk7XG5cblx0XHRcdFx0XHRcdFx0aiArPSAoYiAmIGluZmxhdGVfbWFza1tpXSk7XG5cblx0XHRcdFx0XHRcdFx0YiA+Pj49IChpKTtcblx0XHRcdFx0XHRcdFx0ayAtPSAoaSk7XG5cblx0XHRcdFx0XHRcdFx0aSA9IGluZGV4O1xuXHRcdFx0XHRcdFx0XHR0ID0gdGFibGU7XG5cdFx0XHRcdFx0XHRcdGlmIChpICsgaiA+IDI1OCArICh0ICYgMHgxZikgKyAoKHQgPj4gNSkgJiAweDFmKSB8fCAoYyA9PSAxNiAmJiBpIDwgMSkpIHtcblx0XHRcdFx0XHRcdFx0XHRibGVucyA9IG51bGw7XG5cdFx0XHRcdFx0XHRcdFx0bW9kZSA9IEJBREJMT0NLUztcblx0XHRcdFx0XHRcdFx0XHR6Lm1zZyA9IFwiaW52YWxpZCBiaXQgbGVuZ3RoIHJlcGVhdFwiO1xuXHRcdFx0XHRcdFx0XHRcdHIgPSBaX0RBVEFfRVJST1I7XG5cblx0XHRcdFx0XHRcdFx0XHR0aGF0LmJpdGIgPSBiO1xuXHRcdFx0XHRcdFx0XHRcdHRoYXQuYml0ayA9IGs7XG5cdFx0XHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdGMgPSBjID09IDE2ID8gYmxlbnNbaSAtIDFdIDogMDtcblx0XHRcdFx0XHRcdFx0ZG8ge1xuXHRcdFx0XHRcdFx0XHRcdGJsZW5zW2krK10gPSBjO1xuXHRcdFx0XHRcdFx0XHR9IHdoaWxlICgtLWogIT09IDApO1xuXHRcdFx0XHRcdFx0XHRpbmRleCA9IGk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGJbMF0gPSAtMTtcblx0XHRcdFx0XHQvLyB7XG5cdFx0XHRcdFx0YmxfID0gW107IC8vIG5ldyBBcnJheSgxKTtcblx0XHRcdFx0XHRiZF8gPSBbXTsgLy8gbmV3IEFycmF5KDEpO1xuXHRcdFx0XHRcdHRsXyA9IFtdOyAvLyBuZXcgQXJyYXkoMSk7XG5cdFx0XHRcdFx0dGRfID0gW107IC8vIG5ldyBBcnJheSgxKTtcblx0XHRcdFx0XHRibF9bMF0gPSA5OyAvLyBtdXN0IGJlIDw9IDkgZm9yIGxvb2thaGVhZCBhc3N1bXB0aW9uc1xuXHRcdFx0XHRcdGJkX1swXSA9IDY7IC8vIG11c3QgYmUgPD0gOSBmb3IgbG9va2FoZWFkIGFzc3VtcHRpb25zXG5cblx0XHRcdFx0XHR0ID0gdGFibGU7XG5cdFx0XHRcdFx0dCA9IGluZnRyZWUuaW5mbGF0ZV90cmVlc19keW5hbWljKDI1NyArICh0ICYgMHgxZiksIDEgKyAoKHQgPj4gNSkgJiAweDFmKSwgYmxlbnMsIGJsXywgYmRfLCB0bF8sIHRkXywgaHVmdHMsIHopO1xuXG5cdFx0XHRcdFx0aWYgKHQgIT0gWl9PSykge1xuXHRcdFx0XHRcdFx0aWYgKHQgPT0gWl9EQVRBX0VSUk9SKSB7XG5cdFx0XHRcdFx0XHRcdGJsZW5zID0gbnVsbDtcblx0XHRcdFx0XHRcdFx0bW9kZSA9IEJBREJMT0NLUztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHIgPSB0O1xuXG5cdFx0XHRcdFx0XHR0aGF0LmJpdGIgPSBiO1xuXHRcdFx0XHRcdFx0dGhhdC5iaXRrID0gaztcblx0XHRcdFx0XHRcdHouYXZhaWxfaW4gPSBuO1xuXHRcdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHRcdHRoYXQud3JpdGUgPSBxO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29kZXMuaW5pdChibF9bMF0sIGJkX1swXSwgaHVmdHMsIHRsX1swXSwgaHVmdHMsIHRkX1swXSk7XG5cdFx0XHRcdFx0Ly8gfVxuXHRcdFx0XHRcdG1vZGUgPSBDT0RFUztcblx0XHRcdFx0LyogZmFsbHMgdGhyb3VnaCAqL1xuXHRcdFx0XHRjYXNlIENPREVTOlxuXHRcdFx0XHRcdHRoYXQuYml0YiA9IGI7XG5cdFx0XHRcdFx0dGhhdC5iaXRrID0gaztcblx0XHRcdFx0XHR6LmF2YWlsX2luID0gbjtcblx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHR0aGF0LndyaXRlID0gcTtcblxuXHRcdFx0XHRcdGlmICgociA9IGNvZGVzLnByb2ModGhhdCwgeiwgcikpICE9IFpfU1RSRUFNX0VORCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoYXQuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ciA9IFpfT0s7XG5cdFx0XHRcdFx0Y29kZXMuZnJlZSh6KTtcblxuXHRcdFx0XHRcdHAgPSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0biA9IHouYXZhaWxfaW47XG5cdFx0XHRcdFx0YiA9IHRoYXQuYml0Yjtcblx0XHRcdFx0XHRrID0gdGhhdC5iaXRrO1xuXHRcdFx0XHRcdHEgPSB0aGF0LndyaXRlO1xuXHRcdFx0XHRcdG0gPSAvKiAoaW50KSAqLyhxIDwgdGhhdC5yZWFkID8gdGhhdC5yZWFkIC0gcSAtIDEgOiB0aGF0LmVuZCAtIHEpO1xuXG5cdFx0XHRcdFx0aWYgKGxhc3QgPT09IDApIHtcblx0XHRcdFx0XHRcdG1vZGUgPSBUWVBFO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG1vZGUgPSBEUlk7XG5cdFx0XHRcdC8qIGZhbGxzIHRocm91Z2ggKi9cblx0XHRcdFx0Y2FzZSBEUlk6XG5cdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0ciA9IHRoYXQuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0XHRxID0gdGhhdC53cml0ZTtcblx0XHRcdFx0XHRtID0gLyogKGludCkgKi8ocSA8IHRoYXQucmVhZCA/IHRoYXQucmVhZCAtIHEgLSAxIDogdGhhdC5lbmQgLSBxKTtcblx0XHRcdFx0XHRpZiAodGhhdC5yZWFkICE9IHRoYXQud3JpdGUpIHtcblx0XHRcdFx0XHRcdHRoYXQuYml0YiA9IGI7XG5cdFx0XHRcdFx0XHR0aGF0LmJpdGsgPSBrO1xuXHRcdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhhdC5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRtb2RlID0gRE9ORUxPQ0tTO1xuXHRcdFx0XHQvKiBmYWxscyB0aHJvdWdoICovXG5cdFx0XHRcdGNhc2UgRE9ORUxPQ0tTOlxuXHRcdFx0XHRcdHIgPSBaX1NUUkVBTV9FTkQ7XG5cblx0XHRcdFx0XHR0aGF0LmJpdGIgPSBiO1xuXHRcdFx0XHRcdHRoYXQuYml0ayA9IGs7XG5cdFx0XHRcdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0XHRcdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdFx0XHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0XHRcdFx0dGhhdC53cml0ZSA9IHE7XG5cdFx0XHRcdFx0cmV0dXJuIHRoYXQuaW5mbGF0ZV9mbHVzaCh6LCByKTtcblx0XHRcdFx0Y2FzZSBCQURCTE9DS1M6XG5cdFx0XHRcdFx0ciA9IFpfREFUQV9FUlJPUjtcblxuXHRcdFx0XHRcdHRoYXQuYml0YiA9IGI7XG5cdFx0XHRcdFx0dGhhdC5iaXRrID0gaztcblx0XHRcdFx0XHR6LmF2YWlsX2luID0gbjtcblx0XHRcdFx0XHR6LnRvdGFsX2luICs9IHAgLSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHRcdFx0ei5uZXh0X2luX2luZGV4ID0gcDtcblx0XHRcdFx0XHR0aGF0LndyaXRlID0gcTtcblx0XHRcdFx0XHRyZXR1cm4gdGhhdC5pbmZsYXRlX2ZsdXNoKHosIHIpO1xuXG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0ciA9IFpfU1RSRUFNX0VSUk9SO1xuXG5cdFx0XHRcdFx0dGhhdC5iaXRiID0gYjtcblx0XHRcdFx0XHR0aGF0LmJpdGsgPSBrO1xuXHRcdFx0XHRcdHouYXZhaWxfaW4gPSBuO1xuXHRcdFx0XHRcdHoudG90YWxfaW4gKz0gcCAtIHoubmV4dF9pbl9pbmRleDtcblx0XHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSBwO1xuXHRcdFx0XHRcdHRoYXQud3JpdGUgPSBxO1xuXHRcdFx0XHRcdHJldHVybiB0aGF0LmluZmxhdGVfZmx1c2goeiwgcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdHRoYXQuZnJlZSA9IGZ1bmN0aW9uICh6KSB7XG5cdFx0dGhhdC5yZXNldCh6LCBudWxsKTtcblx0XHR0aGF0LndpbiA9IG51bGw7XG5cdFx0aHVmdHMgPSBudWxsO1xuXHRcdC8vIFpGUkVFKHosIHMpO1xuXHR9O1xuXG5cdHRoYXQuc2V0X2RpY3Rpb25hcnkgPSBmdW5jdGlvbiAoZCwgc3RhcnQsIG4pIHtcblx0XHR0aGF0Lndpbi5zZXQoZC5zdWJhcnJheShzdGFydCwgc3RhcnQgKyBuKSwgMCk7XG5cdFx0dGhhdC5yZWFkID0gdGhhdC53cml0ZSA9IG47XG5cdH07XG5cblx0Ly8gUmV0dXJucyB0cnVlIGlmIGluZmxhdGUgaXMgY3VycmVudGx5IGF0IHRoZSBlbmQgb2YgYSBibG9jayBnZW5lcmF0ZWRcblx0Ly8gYnkgWl9TWU5DX0ZMVVNIIG9yIFpfRlVMTF9GTFVTSC5cblx0dGhhdC5zeW5jX3BvaW50ID0gZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiBtb2RlID09IExFTlMgPyAxIDogMDtcblx0fTtcblxufVxuXG4vLyBJbmZsYXRlXG5cbi8vIHByZXNldCBkaWN0aW9uYXJ5IGZsYWcgaW4gemxpYiBoZWFkZXJcbmNvbnN0IFBSRVNFVF9ESUNUID0gMHgyMDtcblxuY29uc3QgWl9ERUZMQVRFRCA9IDg7XG5cbmNvbnN0IE1FVEhPRCA9IDA7IC8vIHdhaXRpbmcgZm9yIG1ldGhvZCBieXRlXG5jb25zdCBGTEFHID0gMTsgLy8gd2FpdGluZyBmb3IgZmxhZyBieXRlXG5jb25zdCBESUNUNCA9IDI7IC8vIGZvdXIgZGljdGlvbmFyeSBjaGVjayBieXRlcyB0byBnb1xuY29uc3QgRElDVDMgPSAzOyAvLyB0aHJlZSBkaWN0aW9uYXJ5IGNoZWNrIGJ5dGVzIHRvIGdvXG5jb25zdCBESUNUMiA9IDQ7IC8vIHR3byBkaWN0aW9uYXJ5IGNoZWNrIGJ5dGVzIHRvIGdvXG5jb25zdCBESUNUMSA9IDU7IC8vIG9uZSBkaWN0aW9uYXJ5IGNoZWNrIGJ5dGUgdG8gZ29cbmNvbnN0IERJQ1QwID0gNjsgLy8gd2FpdGluZyBmb3IgaW5mbGF0ZVNldERpY3Rpb25hcnlcbmNvbnN0IEJMT0NLUyA9IDc7IC8vIGRlY29tcHJlc3NpbmcgYmxvY2tzXG5jb25zdCBET05FID0gMTI7IC8vIGZpbmlzaGVkIGNoZWNrLCBkb25lXG5jb25zdCBCQUQgPSAxMzsgLy8gZ290IGFuIGVycm9yLS1zdGF5IGhlcmVcblxuY29uc3QgbWFyayA9IFswLCAwLCAweGZmLCAweGZmXTtcblxuZnVuY3Rpb24gSW5mbGF0ZSgpIHtcblx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cblx0dGhhdC5tb2RlID0gMDsgLy8gY3VycmVudCBpbmZsYXRlIG1vZGVcblxuXHQvLyBtb2RlIGRlcGVuZGVudCBpbmZvcm1hdGlvblxuXHR0aGF0Lm1ldGhvZCA9IDA7IC8vIGlmIEZMQUdTLCBtZXRob2QgYnl0ZVxuXG5cdC8vIGlmIENIRUNLLCBjaGVjayB2YWx1ZXMgdG8gY29tcGFyZVxuXHR0aGF0LndhcyA9IFswXTsgLy8gbmV3IEFycmF5KDEpOyAvLyBjb21wdXRlZCBjaGVjayB2YWx1ZVxuXHR0aGF0Lm5lZWQgPSAwOyAvLyBzdHJlYW0gY2hlY2sgdmFsdWVcblxuXHQvLyBpZiBCQUQsIGluZmxhdGVTeW5jJ3MgbWFya2VyIGJ5dGVzIGNvdW50XG5cdHRoYXQubWFya2VyID0gMDtcblxuXHQvLyBtb2RlIGluZGVwZW5kZW50IGluZm9ybWF0aW9uXG5cdHRoYXQud2JpdHMgPSAwOyAvLyBsb2cyKHdpbiBzaXplKSAoOC4uMTUsIGRlZmF1bHRzIHRvIDE1KVxuXG5cdC8vIHRoaXMuYmxvY2tzOyAvLyBjdXJyZW50IGluZmxhdGVfYmxvY2tzIHN0YXRlXG5cblx0ZnVuY3Rpb24gaW5mbGF0ZVJlc2V0KHopIHtcblx0XHRpZiAoIXogfHwgIXouaXN0YXRlKVxuXHRcdFx0cmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuXG5cdFx0ei50b3RhbF9pbiA9IHoudG90YWxfb3V0ID0gMDtcblx0XHR6Lm1zZyA9IG51bGw7XG5cdFx0ei5pc3RhdGUubW9kZSA9IEJMT0NLUztcblx0XHR6LmlzdGF0ZS5ibG9ja3MucmVzZXQoeiwgbnVsbCk7XG5cdFx0cmV0dXJuIFpfT0s7XG5cdH1cblxuXHR0aGF0LmluZmxhdGVFbmQgPSBmdW5jdGlvbiAoeikge1xuXHRcdGlmICh0aGF0LmJsb2Nrcylcblx0XHRcdHRoYXQuYmxvY2tzLmZyZWUoeik7XG5cdFx0dGhhdC5ibG9ja3MgPSBudWxsO1xuXHRcdC8vIFpGUkVFKHosIHotPnN0YXRlKTtcblx0XHRyZXR1cm4gWl9PSztcblx0fTtcblxuXHR0aGF0LmluZmxhdGVJbml0ID0gZnVuY3Rpb24gKHosIHcpIHtcblx0XHR6Lm1zZyA9IG51bGw7XG5cdFx0dGhhdC5ibG9ja3MgPSBudWxsO1xuXG5cdFx0Ly8gc2V0IHdpbiBzaXplXG5cdFx0aWYgKHcgPCA4IHx8IHcgPiAxNSkge1xuXHRcdFx0dGhhdC5pbmZsYXRlRW5kKHopO1xuXHRcdFx0cmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuXHRcdH1cblx0XHR0aGF0LndiaXRzID0gdztcblxuXHRcdHouaXN0YXRlLmJsb2NrcyA9IG5ldyBJbmZCbG9ja3MoeiwgMSA8PCB3KTtcblxuXHRcdC8vIHJlc2V0IHN0YXRlXG5cdFx0aW5mbGF0ZVJlc2V0KHopO1xuXHRcdHJldHVybiBaX09LO1xuXHR9O1xuXG5cdHRoYXQuaW5mbGF0ZSA9IGZ1bmN0aW9uICh6LCBmKSB7XG5cdFx0bGV0IHI7XG5cdFx0bGV0IGI7XG5cblx0XHRpZiAoIXogfHwgIXouaXN0YXRlIHx8ICF6Lm5leHRfaW4pXG5cdFx0XHRyZXR1cm4gWl9TVFJFQU1fRVJST1I7XG5cdFx0Y29uc3QgaXN0YXRlID0gei5pc3RhdGU7XG5cdFx0ZiA9IGYgPT0gWl9GSU5JU0ggPyBaX0JVRl9FUlJPUiA6IFpfT0s7XG5cdFx0ciA9IFpfQlVGX0VSUk9SO1xuXHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zdGFudC1jb25kaXRpb25cblx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0c3dpdGNoIChpc3RhdGUubW9kZSkge1xuXHRcdFx0XHRjYXNlIE1FVEhPRDpcblxuXHRcdFx0XHRcdGlmICh6LmF2YWlsX2luID09PSAwKVxuXHRcdFx0XHRcdFx0cmV0dXJuIHI7XG5cdFx0XHRcdFx0ciA9IGY7XG5cblx0XHRcdFx0XHR6LmF2YWlsX2luLS07XG5cdFx0XHRcdFx0ei50b3RhbF9pbisrO1xuXHRcdFx0XHRcdGlmICgoKGlzdGF0ZS5tZXRob2QgPSB6LnJlYWRfYnl0ZSh6Lm5leHRfaW5faW5kZXgrKykpICYgMHhmKSAhPSBaX0RFRkxBVEVEKSB7XG5cdFx0XHRcdFx0XHRpc3RhdGUubW9kZSA9IEJBRDtcblx0XHRcdFx0XHRcdHoubXNnID0gXCJ1bmtub3duIGNvbXByZXNzaW9uIG1ldGhvZFwiO1xuXHRcdFx0XHRcdFx0aXN0YXRlLm1hcmtlciA9IDU7IC8vIGNhbid0IHRyeSBpbmZsYXRlU3luY1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICgoaXN0YXRlLm1ldGhvZCA+PiA0KSArIDggPiBpc3RhdGUud2JpdHMpIHtcblx0XHRcdFx0XHRcdGlzdGF0ZS5tb2RlID0gQkFEO1xuXHRcdFx0XHRcdFx0ei5tc2cgPSBcImludmFsaWQgd2luIHNpemVcIjtcblx0XHRcdFx0XHRcdGlzdGF0ZS5tYXJrZXIgPSA1OyAvLyBjYW4ndCB0cnkgaW5mbGF0ZVN5bmNcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpc3RhdGUubW9kZSA9IEZMQUc7XG5cdFx0XHRcdC8qIGZhbGxzIHRocm91Z2ggKi9cblx0XHRcdFx0Y2FzZSBGTEFHOlxuXG5cdFx0XHRcdFx0aWYgKHouYXZhaWxfaW4gPT09IDApXG5cdFx0XHRcdFx0XHRyZXR1cm4gcjtcblx0XHRcdFx0XHRyID0gZjtcblxuXHRcdFx0XHRcdHouYXZhaWxfaW4tLTtcblx0XHRcdFx0XHR6LnRvdGFsX2luKys7XG5cdFx0XHRcdFx0YiA9ICh6LnJlYWRfYnl0ZSh6Lm5leHRfaW5faW5kZXgrKykpICYgMHhmZjtcblxuXHRcdFx0XHRcdGlmICgoKChpc3RhdGUubWV0aG9kIDw8IDgpICsgYikgJSAzMSkgIT09IDApIHtcblx0XHRcdFx0XHRcdGlzdGF0ZS5tb2RlID0gQkFEO1xuXHRcdFx0XHRcdFx0ei5tc2cgPSBcImluY29ycmVjdCBoZWFkZXIgY2hlY2tcIjtcblx0XHRcdFx0XHRcdGlzdGF0ZS5tYXJrZXIgPSA1OyAvLyBjYW4ndCB0cnkgaW5mbGF0ZVN5bmNcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlmICgoYiAmIFBSRVNFVF9ESUNUKSA9PT0gMCkge1xuXHRcdFx0XHRcdFx0aXN0YXRlLm1vZGUgPSBCTE9DS1M7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aXN0YXRlLm1vZGUgPSBESUNUNDtcblx0XHRcdFx0LyogZmFsbHMgdGhyb3VnaCAqL1xuXHRcdFx0XHRjYXNlIERJQ1Q0OlxuXG5cdFx0XHRcdFx0aWYgKHouYXZhaWxfaW4gPT09IDApXG5cdFx0XHRcdFx0XHRyZXR1cm4gcjtcblx0XHRcdFx0XHRyID0gZjtcblxuXHRcdFx0XHRcdHouYXZhaWxfaW4tLTtcblx0XHRcdFx0XHR6LnRvdGFsX2luKys7XG5cdFx0XHRcdFx0aXN0YXRlLm5lZWQgPSAoKHoucmVhZF9ieXRlKHoubmV4dF9pbl9pbmRleCsrKSAmIDB4ZmYpIDw8IDI0KSAmIDB4ZmYwMDAwMDA7XG5cdFx0XHRcdFx0aXN0YXRlLm1vZGUgPSBESUNUMztcblx0XHRcdFx0LyogZmFsbHMgdGhyb3VnaCAqL1xuXHRcdFx0XHRjYXNlIERJQ1QzOlxuXG5cdFx0XHRcdFx0aWYgKHouYXZhaWxfaW4gPT09IDApXG5cdFx0XHRcdFx0XHRyZXR1cm4gcjtcblx0XHRcdFx0XHRyID0gZjtcblxuXHRcdFx0XHRcdHouYXZhaWxfaW4tLTtcblx0XHRcdFx0XHR6LnRvdGFsX2luKys7XG5cdFx0XHRcdFx0aXN0YXRlLm5lZWQgKz0gKCh6LnJlYWRfYnl0ZSh6Lm5leHRfaW5faW5kZXgrKykgJiAweGZmKSA8PCAxNikgJiAweGZmMDAwMDtcblx0XHRcdFx0XHRpc3RhdGUubW9kZSA9IERJQ1QyO1xuXHRcdFx0XHQvKiBmYWxscyB0aHJvdWdoICovXG5cdFx0XHRcdGNhc2UgRElDVDI6XG5cblx0XHRcdFx0XHRpZiAoei5hdmFpbF9pbiA9PT0gMClcblx0XHRcdFx0XHRcdHJldHVybiByO1xuXHRcdFx0XHRcdHIgPSBmO1xuXG5cdFx0XHRcdFx0ei5hdmFpbF9pbi0tO1xuXHRcdFx0XHRcdHoudG90YWxfaW4rKztcblx0XHRcdFx0XHRpc3RhdGUubmVlZCArPSAoKHoucmVhZF9ieXRlKHoubmV4dF9pbl9pbmRleCsrKSAmIDB4ZmYpIDw8IDgpICYgMHhmZjAwO1xuXHRcdFx0XHRcdGlzdGF0ZS5tb2RlID0gRElDVDE7XG5cdFx0XHRcdC8qIGZhbGxzIHRocm91Z2ggKi9cblx0XHRcdFx0Y2FzZSBESUNUMTpcblxuXHRcdFx0XHRcdGlmICh6LmF2YWlsX2luID09PSAwKVxuXHRcdFx0XHRcdFx0cmV0dXJuIHI7XG5cdFx0XHRcdFx0ciA9IGY7XG5cblx0XHRcdFx0XHR6LmF2YWlsX2luLS07XG5cdFx0XHRcdFx0ei50b3RhbF9pbisrO1xuXHRcdFx0XHRcdGlzdGF0ZS5uZWVkICs9ICh6LnJlYWRfYnl0ZSh6Lm5leHRfaW5faW5kZXgrKykgJiAweGZmKTtcblx0XHRcdFx0XHRpc3RhdGUubW9kZSA9IERJQ1QwO1xuXHRcdFx0XHRcdHJldHVybiBaX05FRURfRElDVDtcblx0XHRcdFx0Y2FzZSBESUNUMDpcblx0XHRcdFx0XHRpc3RhdGUubW9kZSA9IEJBRDtcblx0XHRcdFx0XHR6Lm1zZyA9IFwibmVlZCBkaWN0aW9uYXJ5XCI7XG5cdFx0XHRcdFx0aXN0YXRlLm1hcmtlciA9IDA7IC8vIGNhbiB0cnkgaW5mbGF0ZVN5bmNcblx0XHRcdFx0XHRyZXR1cm4gWl9TVFJFQU1fRVJST1I7XG5cdFx0XHRcdGNhc2UgQkxPQ0tTOlxuXG5cdFx0XHRcdFx0ciA9IGlzdGF0ZS5ibG9ja3MucHJvYyh6LCByKTtcblx0XHRcdFx0XHRpZiAociA9PSBaX0RBVEFfRVJST1IpIHtcblx0XHRcdFx0XHRcdGlzdGF0ZS5tb2RlID0gQkFEO1xuXHRcdFx0XHRcdFx0aXN0YXRlLm1hcmtlciA9IDA7IC8vIGNhbiB0cnkgaW5mbGF0ZVN5bmNcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAociA9PSBaX09LKSB7XG5cdFx0XHRcdFx0XHRyID0gZjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHIgIT0gWl9TVFJFQU1fRU5EKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ciA9IGY7XG5cdFx0XHRcdFx0aXN0YXRlLmJsb2Nrcy5yZXNldCh6LCBpc3RhdGUud2FzKTtcblx0XHRcdFx0XHRpc3RhdGUubW9kZSA9IERPTkU7XG5cdFx0XHRcdC8qIGZhbGxzIHRocm91Z2ggKi9cblx0XHRcdFx0Y2FzZSBET05FOlxuXHRcdFx0XHRcdHouYXZhaWxfaW4gPSAwO1xuXHRcdFx0XHRcdHJldHVybiBaX1NUUkVBTV9FTkQ7XG5cdFx0XHRcdGNhc2UgQkFEOlxuXHRcdFx0XHRcdHJldHVybiBaX0RBVEFfRVJST1I7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0cmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcblxuXHR0aGF0LmluZmxhdGVTZXREaWN0aW9uYXJ5ID0gZnVuY3Rpb24gKHosIGRpY3Rpb25hcnksIGRpY3RMZW5ndGgpIHtcblx0XHRsZXQgaW5kZXggPSAwLCBsZW5ndGggPSBkaWN0TGVuZ3RoO1xuXHRcdGlmICgheiB8fCAhei5pc3RhdGUgfHwgei5pc3RhdGUubW9kZSAhPSBESUNUMClcblx0XHRcdHJldHVybiBaX1NUUkVBTV9FUlJPUjtcblx0XHRjb25zdCBpc3RhdGUgPSB6LmlzdGF0ZTtcblx0XHRpZiAobGVuZ3RoID49ICgxIDw8IGlzdGF0ZS53Yml0cykpIHtcblx0XHRcdGxlbmd0aCA9ICgxIDw8IGlzdGF0ZS53Yml0cykgLSAxO1xuXHRcdFx0aW5kZXggPSBkaWN0TGVuZ3RoIC0gbGVuZ3RoO1xuXHRcdH1cblx0XHRpc3RhdGUuYmxvY2tzLnNldF9kaWN0aW9uYXJ5KGRpY3Rpb25hcnksIGluZGV4LCBsZW5ndGgpO1xuXHRcdGlzdGF0ZS5tb2RlID0gQkxPQ0tTO1xuXHRcdHJldHVybiBaX09LO1xuXHR9O1xuXG5cdHRoYXQuaW5mbGF0ZVN5bmMgPSBmdW5jdGlvbiAoeikge1xuXHRcdGxldCBuOyAvLyBudW1iZXIgb2YgYnl0ZXMgdG8gbG9vayBhdFxuXHRcdGxldCBwOyAvLyBwb2ludGVyIHRvIGJ5dGVzXG5cdFx0bGV0IG07IC8vIG51bWJlciBvZiBtYXJrZXIgYnl0ZXMgZm91bmQgaW4gYSByb3dcblx0XHRsZXQgciwgdzsgLy8gdGVtcG9yYXJpZXMgdG8gc2F2ZSB0b3RhbF9pbiBhbmQgdG90YWxfb3V0XG5cblx0XHQvLyBzZXQgdXBcblx0XHRpZiAoIXogfHwgIXouaXN0YXRlKVxuXHRcdFx0cmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuXHRcdGNvbnN0IGlzdGF0ZSA9IHouaXN0YXRlO1xuXHRcdGlmIChpc3RhdGUubW9kZSAhPSBCQUQpIHtcblx0XHRcdGlzdGF0ZS5tb2RlID0gQkFEO1xuXHRcdFx0aXN0YXRlLm1hcmtlciA9IDA7XG5cdFx0fVxuXHRcdGlmICgobiA9IHouYXZhaWxfaW4pID09PSAwKVxuXHRcdFx0cmV0dXJuIFpfQlVGX0VSUk9SO1xuXHRcdHAgPSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0bSA9IGlzdGF0ZS5tYXJrZXI7XG5cblx0XHQvLyBzZWFyY2hcblx0XHR3aGlsZSAobiAhPT0gMCAmJiBtIDwgNCkge1xuXHRcdFx0aWYgKHoucmVhZF9ieXRlKHApID09IG1hcmtbbV0pIHtcblx0XHRcdFx0bSsrO1xuXHRcdFx0fSBlbHNlIGlmICh6LnJlYWRfYnl0ZShwKSAhPT0gMCkge1xuXHRcdFx0XHRtID0gMDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG0gPSA0IC0gbTtcblx0XHRcdH1cblx0XHRcdHArKztcblx0XHRcdG4tLTtcblx0XHR9XG5cblx0XHQvLyByZXN0b3JlXG5cdFx0ei50b3RhbF9pbiArPSBwIC0gei5uZXh0X2luX2luZGV4O1xuXHRcdHoubmV4dF9pbl9pbmRleCA9IHA7XG5cdFx0ei5hdmFpbF9pbiA9IG47XG5cdFx0aXN0YXRlLm1hcmtlciA9IG07XG5cblx0XHQvLyByZXR1cm4gbm8gam95IG9yIHNldCB1cCB0byByZXN0YXJ0IG9uIGEgbmV3IGJsb2NrXG5cdFx0aWYgKG0gIT0gNCkge1xuXHRcdFx0cmV0dXJuIFpfREFUQV9FUlJPUjtcblx0XHR9XG5cdFx0ciA9IHoudG90YWxfaW47XG5cdFx0dyA9IHoudG90YWxfb3V0O1xuXHRcdGluZmxhdGVSZXNldCh6KTtcblx0XHR6LnRvdGFsX2luID0gcjtcblx0XHR6LnRvdGFsX291dCA9IHc7XG5cdFx0aXN0YXRlLm1vZGUgPSBCTE9DS1M7XG5cdFx0cmV0dXJuIFpfT0s7XG5cdH07XG5cblx0Ly8gUmV0dXJucyB0cnVlIGlmIGluZmxhdGUgaXMgY3VycmVudGx5IGF0IHRoZSBlbmQgb2YgYSBibG9jayBnZW5lcmF0ZWRcblx0Ly8gYnkgWl9TWU5DX0ZMVVNIIG9yIFpfRlVMTF9GTFVTSC4gVGhpcyBmdW5jdGlvbiBpcyB1c2VkIGJ5IG9uZSBQUFBcblx0Ly8gaW1wbGVtZW50YXRpb24gdG8gcHJvdmlkZSBhbiBhZGRpdGlvbmFsIHNhZmV0eSBjaGVjay4gUFBQIHVzZXNcblx0Ly8gWl9TWU5DX0ZMVVNIXG5cdC8vIGJ1dCByZW1vdmVzIHRoZSBsZW5ndGggYnl0ZXMgb2YgdGhlIHJlc3VsdGluZyBlbXB0eSBzdG9yZWQgYmxvY2suIFdoZW5cblx0Ly8gZGVjb21wcmVzc2luZywgUFBQIGNoZWNrcyB0aGF0IGF0IHRoZSBlbmQgb2YgaW5wdXQgcGFja2V0LCBpbmZsYXRlIGlzXG5cdC8vIHdhaXRpbmcgZm9yIHRoZXNlIGxlbmd0aCBieXRlcy5cblx0dGhhdC5pbmZsYXRlU3luY1BvaW50ID0gZnVuY3Rpb24gKHopIHtcblx0XHRpZiAoIXogfHwgIXouaXN0YXRlIHx8ICF6LmlzdGF0ZS5ibG9ja3MpXG5cdFx0XHRyZXR1cm4gWl9TVFJFQU1fRVJST1I7XG5cdFx0cmV0dXJuIHouaXN0YXRlLmJsb2Nrcy5zeW5jX3BvaW50KCk7XG5cdH07XG59XG5cbi8vIFpTdHJlYW1cblxuZnVuY3Rpb24gWlN0cmVhbSgpIHtcbn1cblxuWlN0cmVhbS5wcm90b3R5cGUgPSB7XG5cdGluZmxhdGVJbml0KGJpdHMpIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGF0LmlzdGF0ZSA9IG5ldyBJbmZsYXRlKCk7XG5cdFx0aWYgKCFiaXRzKVxuXHRcdFx0Yml0cyA9IE1BWF9CSVRTO1xuXHRcdHJldHVybiB0aGF0LmlzdGF0ZS5pbmZsYXRlSW5pdCh0aGF0LCBiaXRzKTtcblx0fSxcblxuXHRpbmZsYXRlKGYpIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRpZiAoIXRoYXQuaXN0YXRlKVxuXHRcdFx0cmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuXHRcdHJldHVybiB0aGF0LmlzdGF0ZS5pbmZsYXRlKHRoYXQsIGYpO1xuXHR9LFxuXG5cdGluZmxhdGVFbmQoKSB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0aWYgKCF0aGF0LmlzdGF0ZSlcblx0XHRcdHJldHVybiBaX1NUUkVBTV9FUlJPUjtcblx0XHRjb25zdCByZXQgPSB0aGF0LmlzdGF0ZS5pbmZsYXRlRW5kKHRoYXQpO1xuXHRcdHRoYXQuaXN0YXRlID0gbnVsbDtcblx0XHRyZXR1cm4gcmV0O1xuXHR9LFxuXG5cdGluZmxhdGVTeW5jKCkge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdGlmICghdGhhdC5pc3RhdGUpXG5cdFx0XHRyZXR1cm4gWl9TVFJFQU1fRVJST1I7XG5cdFx0cmV0dXJuIHRoYXQuaXN0YXRlLmluZmxhdGVTeW5jKHRoYXQpO1xuXHR9LFxuXHRpbmZsYXRlU2V0RGljdGlvbmFyeShkaWN0aW9uYXJ5LCBkaWN0TGVuZ3RoKSB7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0aWYgKCF0aGF0LmlzdGF0ZSlcblx0XHRcdHJldHVybiBaX1NUUkVBTV9FUlJPUjtcblx0XHRyZXR1cm4gdGhhdC5pc3RhdGUuaW5mbGF0ZVNldERpY3Rpb25hcnkodGhhdCwgZGljdGlvbmFyeSwgZGljdExlbmd0aCk7XG5cdH0sXG5cdHJlYWRfYnl0ZShzdGFydCkge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHJldHVybiB0aGF0Lm5leHRfaW5bc3RhcnRdO1xuXHR9LFxuXHRyZWFkX2J1ZihzdGFydCwgc2l6ZSkge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHJldHVybiB0aGF0Lm5leHRfaW4uc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgc2l6ZSk7XG5cdH1cbn07XG5cbi8vIEluZmxhdGVyXG5cbmZ1bmN0aW9uIFppcEluZmxhdGUob3B0aW9ucykge1xuXHRjb25zdCB0aGF0ID0gdGhpcztcblx0Y29uc3QgeiA9IG5ldyBaU3RyZWFtKCk7XG5cdGNvbnN0IGJ1ZnNpemUgPSBvcHRpb25zICYmIG9wdGlvbnMuY2h1bmtTaXplID8gTWF0aC5mbG9vcihvcHRpb25zLmNodW5rU2l6ZSAqIDIpIDogMTI4ICogMTAyNDtcblx0Y29uc3QgZmx1c2ggPSBaX05PX0ZMVVNIO1xuXHRjb25zdCBidWYgPSBuZXcgVWludDhBcnJheShidWZzaXplKTtcblx0bGV0IG5vbW9yZWlucHV0ID0gZmFsc2U7XG5cblx0ei5pbmZsYXRlSW5pdCgpO1xuXHR6Lm5leHRfb3V0ID0gYnVmO1xuXG5cdHRoYXQuYXBwZW5kID0gZnVuY3Rpb24gKGRhdGEsIG9ucHJvZ3Jlc3MpIHtcblx0XHRjb25zdCBidWZmZXJzID0gW107XG5cdFx0bGV0IGVyciwgYXJyYXksIGxhc3RJbmRleCA9IDAsIGJ1ZmZlckluZGV4ID0gMCwgYnVmZmVyU2l6ZSA9IDA7XG5cdFx0aWYgKGRhdGEubGVuZ3RoID09PSAwKVxuXHRcdFx0cmV0dXJuO1xuXHRcdHoubmV4dF9pbl9pbmRleCA9IDA7XG5cdFx0ei5uZXh0X2luID0gZGF0YTtcblx0XHR6LmF2YWlsX2luID0gZGF0YS5sZW5ndGg7XG5cdFx0ZG8ge1xuXHRcdFx0ei5uZXh0X291dF9pbmRleCA9IDA7XG5cdFx0XHR6LmF2YWlsX291dCA9IGJ1ZnNpemU7XG5cdFx0XHRpZiAoKHouYXZhaWxfaW4gPT09IDApICYmICghbm9tb3JlaW5wdXQpKSB7IC8vIGlmIGJ1ZmZlciBpcyBlbXB0eSBhbmQgbW9yZSBpbnB1dCBpcyBhdmFpbGFibGUsIHJlZmlsbCBpdFxuXHRcdFx0XHR6Lm5leHRfaW5faW5kZXggPSAwO1xuXHRcdFx0XHRub21vcmVpbnB1dCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRlcnIgPSB6LmluZmxhdGUoZmx1c2gpO1xuXHRcdFx0aWYgKG5vbW9yZWlucHV0ICYmIChlcnIgPT09IFpfQlVGX0VSUk9SKSkge1xuXHRcdFx0XHRpZiAoei5hdmFpbF9pbiAhPT0gMClcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJpbmZsYXRpbmc6IGJhZCBpbnB1dFwiKTtcblx0XHRcdH0gZWxzZSBpZiAoZXJyICE9PSBaX09LICYmIGVyciAhPT0gWl9TVFJFQU1fRU5EKVxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJpbmZsYXRpbmc6IFwiICsgei5tc2cpO1xuXHRcdFx0aWYgKChub21vcmVpbnB1dCB8fCBlcnIgPT09IFpfU1RSRUFNX0VORCkgJiYgKHouYXZhaWxfaW4gPT09IGRhdGEubGVuZ3RoKSlcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiaW5mbGF0aW5nOiBiYWQgaW5wdXRcIik7XG5cdFx0XHRpZiAoei5uZXh0X291dF9pbmRleClcblx0XHRcdFx0aWYgKHoubmV4dF9vdXRfaW5kZXggPT09IGJ1ZnNpemUpXG5cdFx0XHRcdFx0YnVmZmVycy5wdXNoKG5ldyBVaW50OEFycmF5KGJ1ZikpO1xuXHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0YnVmZmVycy5wdXNoKGJ1Zi5zdWJhcnJheSgwLCB6Lm5leHRfb3V0X2luZGV4KSk7XG5cdFx0XHRidWZmZXJTaXplICs9IHoubmV4dF9vdXRfaW5kZXg7XG5cdFx0XHRpZiAob25wcm9ncmVzcyAmJiB6Lm5leHRfaW5faW5kZXggPiAwICYmIHoubmV4dF9pbl9pbmRleCAhPSBsYXN0SW5kZXgpIHtcblx0XHRcdFx0b25wcm9ncmVzcyh6Lm5leHRfaW5faW5kZXgpO1xuXHRcdFx0XHRsYXN0SW5kZXggPSB6Lm5leHRfaW5faW5kZXg7XG5cdFx0XHR9XG5cdFx0fSB3aGlsZSAoei5hdmFpbF9pbiA+IDAgfHwgei5hdmFpbF9vdXQgPT09IDApO1xuXHRcdGlmIChidWZmZXJzLmxlbmd0aCA+IDEpIHtcblx0XHRcdGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyU2l6ZSk7XG5cdFx0XHRidWZmZXJzLmZvckVhY2goZnVuY3Rpb24gKGNodW5rKSB7XG5cdFx0XHRcdGFycmF5LnNldChjaHVuaywgYnVmZmVySW5kZXgpO1xuXHRcdFx0XHRidWZmZXJJbmRleCArPSBjaHVuay5sZW5ndGg7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXJyYXkgPSBidWZmZXJzWzBdID8gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyc1swXSkgOiBuZXcgVWludDhBcnJheSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gYXJyYXk7XG5cdH07XG5cdHRoYXQuZmx1c2ggPSBmdW5jdGlvbiAoKSB7XG5cdFx0ei5pbmZsYXRlRW5kKCk7XG5cdH07XG59XG5cbmV4cG9ydCB7XG5cdFppcEluZmxhdGUgYXMgSW5mbGF0ZVxufTsiLCIvKlxuIENvcHlyaWdodCAoYykgMjAyMiBHaWxkYXMgTG9ybWVhdS4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG5cbiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBcbiBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gXG4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cbiAzLiBUaGUgbmFtZXMgb2YgdGhlIGF1dGhvcnMgbWF5IG5vdCBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0c1xuIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWMgcHJpb3Igd3JpdHRlbiBwZXJtaXNzaW9uLlxuXG4gVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnJ0FTIElTJycgQU5EIEFOWSBFWFBSRVNTRUQgT1IgSU1QTElFRCBXQVJSQU5USUVTLFxuIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkRcbiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgSkNSQUZULFxuIElOQy4gT1IgQU5ZIENPTlRSSUJVVE9SUyBUTyBUSElTIFNPRlRXQVJFIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsXG4gSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVFxuIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLFxuIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcbiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSxcbiBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5cbmNvbnN0IE1BWF8zMl9CSVRTID0gMHhmZmZmZmZmZjtcbmNvbnN0IE1BWF8xNl9CSVRTID0gMHhmZmZmO1xuY29uc3QgQ09NUFJFU1NJT05fTUVUSE9EX0RFRkxBVEUgPSAweDA4O1xuY29uc3QgQ09NUFJFU1NJT05fTUVUSE9EX1NUT1JFID0gMHgwMDtcbmNvbnN0IENPTVBSRVNTSU9OX01FVEhPRF9BRVMgPSAweDYzO1xuXG5jb25zdCBMT0NBTF9GSUxFX0hFQURFUl9TSUdOQVRVUkUgPSAweDA0MDM0YjUwO1xuY29uc3QgU1BMSVRfWklQX0ZJTEVfU0lHTkFUVVJFID0gMHgwODA3NGI1MDtcbmNvbnN0IERBVEFfREVTQ1JJUFRPUl9SRUNPUkRfU0lHTkFUVVJFID0gU1BMSVRfWklQX0ZJTEVfU0lHTkFUVVJFO1xuY29uc3QgQ0VOVFJBTF9GSUxFX0hFQURFUl9TSUdOQVRVUkUgPSAweDAyMDE0YjUwO1xuY29uc3QgRU5EX09GX0NFTlRSQUxfRElSX1NJR05BVFVSRSA9IDB4MDYwNTRiNTA7XG5jb25zdCBaSVA2NF9FTkRfT0ZfQ0VOVFJBTF9ESVJfU0lHTkFUVVJFID0gMHgwNjA2NGI1MDtcbmNvbnN0IFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9MT0NBVE9SX1NJR05BVFVSRSA9IDB4MDcwNjRiNTA7XG5jb25zdCBFTkRfT0ZfQ0VOVFJBTF9ESVJfTEVOR1RIID0gMjI7XG5jb25zdCBaSVA2NF9FTkRfT0ZfQ0VOVFJBTF9ESVJfTE9DQVRPUl9MRU5HVEggPSAyMDtcbmNvbnN0IFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9MRU5HVEggPSA1NjtcbmNvbnN0IFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9UT1RBTF9MRU5HVEggPSBFTkRfT0ZfQ0VOVFJBTF9ESVJfTEVOR1RIICsgWklQNjRfRU5EX09GX0NFTlRSQUxfRElSX0xPQ0FUT1JfTEVOR1RIICsgWklQNjRfRU5EX09GX0NFTlRSQUxfRElSX0xFTkdUSDtcblxuY29uc3QgRVhUUkFGSUVMRF9UWVBFX1pJUDY0ID0gMHgwMDAxO1xuY29uc3QgRVhUUkFGSUVMRF9UWVBFX0FFUyA9IDB4OTkwMTtcbmNvbnN0IEVYVFJBRklFTERfVFlQRV9OVEZTID0gMHgwMDBhO1xuY29uc3QgRVhUUkFGSUVMRF9UWVBFX05URlNfVEFHMSA9IDB4MDAwMTtcbmNvbnN0IEVYVFJBRklFTERfVFlQRV9FWFRFTkRFRF9USU1FU1RBTVAgPSAweDU0NTU7XG5jb25zdCBFWFRSQUZJRUxEX1RZUEVfVU5JQ09ERV9QQVRIID0gMHg3MDc1O1xuY29uc3QgRVhUUkFGSUVMRF9UWVBFX1VOSUNPREVfQ09NTUVOVCA9IDB4NjM3NTtcbmNvbnN0IEVYVFJBRklFTERfVFlQRV9VU0RaID0gMHgxOTg2O1xuXG5jb25zdCBCSVRGTEFHX0VOQ1JZUFRFRCA9IDB4MDE7XG5jb25zdCBCSVRGTEFHX0xFVkVMID0gMHgwNjtcbmNvbnN0IEJJVEZMQUdfREFUQV9ERVNDUklQVE9SID0gMHgwMDA4O1xuY29uc3QgQklURkxBR19MQU5HX0VOQ09ESU5HX0ZMQUcgPSAweDA4MDA7XG5jb25zdCBGSUxFX0FUVFJfTVNET1NfRElSX01BU0sgPSAweDEwO1xuXG5jb25zdCBWRVJTSU9OX0RFRkxBVEUgPSAweDE0O1xuY29uc3QgVkVSU0lPTl9aSVA2NCA9IDB4MkQ7XG5jb25zdCBWRVJTSU9OX0FFUyA9IDB4MzM7XG5cbmNvbnN0IERJUkVDVE9SWV9TSUdOQVRVUkUgPSBcIi9cIjtcblxuY29uc3QgTUFYX0RBVEUgPSBuZXcgRGF0ZSgyMTA3LCAxMSwgMzEpO1xuY29uc3QgTUlOX0RBVEUgPSBuZXcgRGF0ZSgxOTgwLCAwLCAxKTtcblxuY29uc3QgVU5ERUZJTkVEX1ZBTFVFID0gdW5kZWZpbmVkO1xuY29uc3QgVU5ERUZJTkVEX1RZUEUgPSBcInVuZGVmaW5lZFwiO1xuY29uc3QgRlVOQ1RJT05fVFlQRSA9IFwiZnVuY3Rpb25cIjtcblxuZXhwb3J0IHtcblx0TUFYXzMyX0JJVFMsXG5cdE1BWF8xNl9CSVRTLFxuXHRDT01QUkVTU0lPTl9NRVRIT0RfREVGTEFURSxcblx0Q09NUFJFU1NJT05fTUVUSE9EX1NUT1JFLFxuXHRDT01QUkVTU0lPTl9NRVRIT0RfQUVTLFxuXHRTUExJVF9aSVBfRklMRV9TSUdOQVRVUkUsXG5cdExPQ0FMX0ZJTEVfSEVBREVSX1NJR05BVFVSRSxcblx0REFUQV9ERVNDUklQVE9SX1JFQ09SRF9TSUdOQVRVUkUsXG5cdENFTlRSQUxfRklMRV9IRUFERVJfU0lHTkFUVVJFLFxuXHRFTkRfT0ZfQ0VOVFJBTF9ESVJfU0lHTkFUVVJFLFxuXHRaSVA2NF9FTkRfT0ZfQ0VOVFJBTF9ESVJfTE9DQVRPUl9TSUdOQVRVUkUsXG5cdFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9TSUdOQVRVUkUsXG5cdEVYVFJBRklFTERfVFlQRV9aSVA2NCxcblx0RVhUUkFGSUVMRF9UWVBFX0FFUyxcblx0RVhUUkFGSUVMRF9UWVBFX05URlMsXG5cdEVYVFJBRklFTERfVFlQRV9OVEZTX1RBRzEsXG5cdEVYVFJBRklFTERfVFlQRV9FWFRFTkRFRF9USU1FU1RBTVAsXG5cdEVYVFJBRklFTERfVFlQRV9VTklDT0RFX1BBVEgsXG5cdEVYVFJBRklFTERfVFlQRV9VTklDT0RFX0NPTU1FTlQsXG5cdEVYVFJBRklFTERfVFlQRV9VU0RaLFxuXHRFTkRfT0ZfQ0VOVFJBTF9ESVJfTEVOR1RILFxuXHRaSVA2NF9FTkRfT0ZfQ0VOVFJBTF9ESVJfTE9DQVRPUl9MRU5HVEgsXG5cdFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9MRU5HVEgsXG5cdFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9UT1RBTF9MRU5HVEgsXG5cdEJJVEZMQUdfRU5DUllQVEVELFxuXHRCSVRGTEFHX0xFVkVMLFxuXHRCSVRGTEFHX0RBVEFfREVTQ1JJUFRPUixcblx0QklURkxBR19MQU5HX0VOQ09ESU5HX0ZMQUcsXG5cdEZJTEVfQVRUUl9NU0RPU19ESVJfTUFTSyxcblx0VkVSU0lPTl9ERUZMQVRFLFxuXHRWRVJTSU9OX1pJUDY0LFxuXHRWRVJTSU9OX0FFUyxcblx0RElSRUNUT1JZX1NJR05BVFVSRSxcblx0TUlOX0RBVEUsXG5cdE1BWF9EQVRFLFxuXHRVTkRFRklORURfVkFMVUUsXG5cdFVOREVGSU5FRF9UWVBFLFxuXHRGVU5DVElPTl9UWVBFXG59OyIsIi8qXG4gQ29weXJpZ2h0IChjKSAyMDIyIEdpbGRhcyBMb3JtZWF1LiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXG4gUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cbiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cblxuIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IFxuIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiBcbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cblxuIDMuIFRoZSBuYW1lcyBvZiB0aGUgYXV0aG9ycyBtYXkgbm90IGJlIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzXG4gZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG5cbiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEICcnQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1NFRCBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsXG4gSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORFxuIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBKQ1JBRlQsXG4gSU5DLiBPUiBBTlkgQ09OVFJJQlVUT1JTIFRPIFRISVMgU09GVFdBUkUgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCxcbiBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UXG4gTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsXG4gT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRlxuIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HXG4gTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLFxuIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cblxuLyogZ2xvYmFsIFRyYW5zZm9ybVN0cmVhbSAqL1xuXG5leHBvcnQge1xuXHRTdHJlYW1BZGFwdGVyXG59O1xuXG5jbGFzcyBTdHJlYW1BZGFwdGVyIHtcblxuXHRjb25zdHJ1Y3RvcihDb2RlYykge1xuXHRcdHJldHVybiBjbGFzcyBleHRlbmRzIFRyYW5zZm9ybVN0cmVhbSB7XG5cdFx0XHRjb25zdHJ1Y3RvcihfZm9ybWF0LCBvcHRpb25zKSB7XG5cdFx0XHRcdGNvbnN0IGNvZGVjID0gbmV3IENvZGVjKG9wdGlvbnMpO1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0dHJhbnNmb3JtKGNodW5rLCBjb250cm9sbGVyKSB7XG5cdFx0XHRcdFx0XHRjb250cm9sbGVyLmVucXVldWUoY29kZWMuYXBwZW5kKGNodW5rKSk7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRmbHVzaChjb250cm9sbGVyKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjaHVuayA9IGNvZGVjLmZsdXNoKCk7XG5cdFx0XHRcdFx0XHRpZiAoY2h1bmspIHtcblx0XHRcdFx0XHRcdFx0Y29udHJvbGxlci5lbnF1ZXVlKGNodW5rKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cbn0iLCIvKlxuIENvcHlyaWdodCAoYykgMjAyMiBHaWxkYXMgTG9ybWVhdS4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG5cbiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBcbiBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gXG4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cbiAzLiBUaGUgbmFtZXMgb2YgdGhlIGF1dGhvcnMgbWF5IG5vdCBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0c1xuIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWMgcHJpb3Igd3JpdHRlbiBwZXJtaXNzaW9uLlxuXG4gVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnJ0FTIElTJycgQU5EIEFOWSBFWFBSRVNTRUQgT1IgSU1QTElFRCBXQVJSQU5USUVTLFxuIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkRcbiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgSkNSQUZULFxuIElOQy4gT1IgQU5ZIENPTlRSSUJVVE9SUyBUTyBUSElTIFNPRlRXQVJFIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsXG4gSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVFxuIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLFxuIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcbiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSxcbiBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5cbi8qIGdsb2JhbCBuYXZpZ2F0b3IsIENvbXByZXNzaW9uU3RyZWFtLCBEZWNvbXByZXNzaW9uU3RyZWFtICovXG5cbmltcG9ydCB7XG5cdFVOREVGSU5FRF9WQUxVRSxcblx0VU5ERUZJTkVEX1RZUEVcbn0gZnJvbSBcIi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBTdHJlYW1BZGFwdGVyIH0gZnJvbSBcIi4vc3RyZWFtcy9zdHJlYW0tYWRhcHRlci5qc1wiO1xuXG5jb25zdCBNSU5JTVVNX0NIVU5LX1NJWkUgPSA2NDtcbmxldCBtYXhXb3JrZXJzID0gMjtcbnRyeSB7XG5cdGlmICh0eXBlb2YgbmF2aWdhdG9yICE9IFVOREVGSU5FRF9UWVBFICYmIG5hdmlnYXRvci5oYXJkd2FyZUNvbmN1cnJlbmN5KSB7XG5cdFx0bWF4V29ya2VycyA9IG5hdmlnYXRvci5oYXJkd2FyZUNvbmN1cnJlbmN5O1xuXHR9XG59IGNhdGNoIChfZXJyb3IpIHtcblx0Ly8gaWdub3JlZFxufVxuY29uc3QgREVGQVVMVF9DT05GSUdVUkFUSU9OID0ge1xuXHRjaHVua1NpemU6IDUxMiAqIDEwMjQsXG5cdG1heFdvcmtlcnMsXG5cdHRlcm1pbmF0ZVdvcmtlclRpbWVvdXQ6IDUwMDAsXG5cdHVzZVdlYldvcmtlcnM6IHRydWUsXG5cdHVzZUNvbXByZXNzaW9uU3RyZWFtOiB0cnVlLFxuXHR3b3JrZXJTY3JpcHRzOiBVTkRFRklORURfVkFMVUUsXG5cdENvbXByZXNzaW9uU3RyZWFtTmF0aXZlOiB0eXBlb2YgQ29tcHJlc3Npb25TdHJlYW0gIT0gVU5ERUZJTkVEX1RZUEUgJiYgQ29tcHJlc3Npb25TdHJlYW0sXG5cdERlY29tcHJlc3Npb25TdHJlYW1OYXRpdmU6IHR5cGVvZiBEZWNvbXByZXNzaW9uU3RyZWFtICE9IFVOREVGSU5FRF9UWVBFICYmIERlY29tcHJlc3Npb25TdHJlYW1cbn07XG5cbmNvbnN0IGNvbmZpZyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfQ09ORklHVVJBVElPTik7XG5cbmV4cG9ydCB7XG5cdGNvbmZpZ3VyZSxcblx0Z2V0Q29uZmlndXJhdGlvbixcblx0Z2V0Q2h1bmtTaXplXG59O1xuXG5mdW5jdGlvbiBnZXRDb25maWd1cmF0aW9uKCkge1xuXHRyZXR1cm4gY29uZmlnO1xufVxuXG5mdW5jdGlvbiBnZXRDaHVua1NpemUoY29uZmlnKSB7XG5cdHJldHVybiBNYXRoLm1heChjb25maWcuY2h1bmtTaXplLCBNSU5JTVVNX0NIVU5LX1NJWkUpO1xufVxuXG5mdW5jdGlvbiBjb25maWd1cmUoY29uZmlndXJhdGlvbikge1xuXHRjb25zdCB7XG5cdFx0YmFzZVVSTCxcblx0XHRjaHVua1NpemUsXG5cdFx0bWF4V29ya2Vycyxcblx0XHR0ZXJtaW5hdGVXb3JrZXJUaW1lb3V0LFxuXHRcdHVzZUNvbXByZXNzaW9uU3RyZWFtLFxuXHRcdHVzZVdlYldvcmtlcnMsXG5cdFx0RGVmbGF0ZSxcblx0XHRJbmZsYXRlLFxuXHRcdENvbXByZXNzaW9uU3RyZWFtLFxuXHRcdERlY29tcHJlc3Npb25TdHJlYW0sXG5cdFx0d29ya2VyU2NyaXB0c1xuXHR9ID0gY29uZmlndXJhdGlvbjtcblx0c2V0SWZEZWZpbmVkKFwiYmFzZVVSTFwiLCBiYXNlVVJMKTtcblx0c2V0SWZEZWZpbmVkKFwiY2h1bmtTaXplXCIsIGNodW5rU2l6ZSk7XG5cdHNldElmRGVmaW5lZChcIm1heFdvcmtlcnNcIiwgbWF4V29ya2Vycyk7XG5cdHNldElmRGVmaW5lZChcInRlcm1pbmF0ZVdvcmtlclRpbWVvdXRcIiwgdGVybWluYXRlV29ya2VyVGltZW91dCk7XG5cdHNldElmRGVmaW5lZChcInVzZUNvbXByZXNzaW9uU3RyZWFtXCIsIHVzZUNvbXByZXNzaW9uU3RyZWFtKTtcblx0c2V0SWZEZWZpbmVkKFwidXNlV2ViV29ya2Vyc1wiLCB1c2VXZWJXb3JrZXJzKTtcblx0aWYgKERlZmxhdGUpIHtcblx0XHRjb25maWcuQ29tcHJlc3Npb25TdHJlYW0gPSBuZXcgU3RyZWFtQWRhcHRlcihEZWZsYXRlKTtcblx0fVxuXHRpZiAoSW5mbGF0ZSkge1xuXHRcdGNvbmZpZy5EZWNvbXByZXNzaW9uU3RyZWFtID0gbmV3IFN0cmVhbUFkYXB0ZXIoSW5mbGF0ZSk7XG5cdH1cblx0c2V0SWZEZWZpbmVkKFwiQ29tcHJlc3Npb25TdHJlYW1cIiwgQ29tcHJlc3Npb25TdHJlYW0pO1xuXHRzZXRJZkRlZmluZWQoXCJEZWNvbXByZXNzaW9uU3RyZWFtXCIsIERlY29tcHJlc3Npb25TdHJlYW0pO1xuXHRpZiAod29ya2VyU2NyaXB0cyAhPT0gVU5ERUZJTkVEX1ZBTFVFKSB7XG5cdFx0Y29uc3QgeyBkZWZsYXRlLCBpbmZsYXRlIH0gPSB3b3JrZXJTY3JpcHRzO1xuXHRcdGlmIChkZWZsYXRlIHx8IGluZmxhdGUpIHtcblx0XHRcdGlmICghY29uZmlnLndvcmtlclNjcmlwdHMpIHtcblx0XHRcdFx0Y29uZmlnLndvcmtlclNjcmlwdHMgPSB7fTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGRlZmxhdGUpIHtcblx0XHRcdGlmICghQXJyYXkuaXNBcnJheShkZWZsYXRlKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJ3b3JrZXJTY3JpcHRzLmRlZmxhdGUgbXVzdCBiZSBhbiBhcnJheVwiKTtcblx0XHRcdH1cblx0XHRcdGNvbmZpZy53b3JrZXJTY3JpcHRzLmRlZmxhdGUgPSBkZWZsYXRlO1xuXHRcdH1cblx0XHRpZiAoaW5mbGF0ZSkge1xuXHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KGluZmxhdGUpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihcIndvcmtlclNjcmlwdHMuaW5mbGF0ZSBtdXN0IGJlIGFuIGFycmF5XCIpO1xuXHRcdFx0fVxuXHRcdFx0Y29uZmlnLndvcmtlclNjcmlwdHMuaW5mbGF0ZSA9IGluZmxhdGU7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIHNldElmRGVmaW5lZChwcm9wZXJ0eU5hbWUsIHByb3BlcnR5VmFsdWUpIHtcblx0aWYgKHByb3BlcnR5VmFsdWUgIT09IFVOREVGSU5FRF9WQUxVRSkge1xuXHRcdGNvbmZpZ1twcm9wZXJ0eU5hbWVdID0gcHJvcGVydHlWYWx1ZTtcblx0fVxufVxuIiwiLypcbiBDb3B5cmlnaHQgKGMpIDIwMjIgR2lsZGFzIExvcm1lYXUuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cbiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuXG4gMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgXG4gbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIFxuIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuXG4gMy4gVGhlIG5hbWVzIG9mIHRoZSBhdXRob3JzIG1heSBub3QgYmUgdXNlZCB0byBlbmRvcnNlIG9yIHByb21vdGUgcHJvZHVjdHNcbiBkZXJpdmVkIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cblxuIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgJydBUyBJUycnIEFORCBBTlkgRVhQUkVTU0VEIE9SIElNUExJRUQgV0FSUkFOVElFUyxcbiBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EXG4gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIEpDUkFGVCxcbiBJTkMuIE9SIEFOWSBDT05UUklCVVRPUlMgVE8gVEhJUyBTT0ZUV0FSRSBCRSBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULFxuIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1RcbiBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSxcbiBPUiBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GXG4gTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkdcbiBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsXG4gRVZFTiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqL1xuXG5jb25zdCBtaW1lVHlwZXMgPSB7fTtcblxuZXhwb3J0IHtcblx0bWltZVR5cGVzLFxuXHRnZXRNaW1lVHlwZVxufTtcblxuZnVuY3Rpb24gZ2V0TWltZVR5cGUoKSB7XG5cdHJldHVybiBcImFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbVwiO1xufSIsIi8qXG4gQ29weXJpZ2h0IChjKSAyMDIyIEdpbGRhcyBMb3JtZWF1LiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXG4gUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cbiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cblxuIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IFxuIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiBcbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cblxuIDMuIFRoZSBuYW1lcyBvZiB0aGUgYXV0aG9ycyBtYXkgbm90IGJlIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzXG4gZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG5cbiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEICcnQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1NFRCBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsXG4gSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORFxuIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBKQ1JBRlQsXG4gSU5DLiBPUiBBTlkgQ09OVFJJQlVUT1JTIFRPIFRISVMgU09GVFdBUkUgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCxcbiBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UXG4gTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsXG4gT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRlxuIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HXG4gTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLFxuIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cblxuY29uc3QgdGFibGUgPSBbXTtcbmZvciAobGV0IGkgPSAwOyBpIDwgMjU2OyBpKyspIHtcblx0bGV0IHQgPSBpO1xuXHRmb3IgKGxldCBqID0gMDsgaiA8IDg7IGorKykge1xuXHRcdGlmICh0ICYgMSkge1xuXHRcdFx0dCA9ICh0ID4+PiAxKSBeIDB4RURCODgzMjA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHQgPSB0ID4+PiAxO1xuXHRcdH1cblx0fVxuXHR0YWJsZVtpXSA9IHQ7XG59XG5cbmNsYXNzIENyYzMyIHtcblxuXHRjb25zdHJ1Y3RvcihjcmMpIHtcblx0XHR0aGlzLmNyYyA9IGNyYyB8fCAtMTtcblx0fVxuXG5cdGFwcGVuZChkYXRhKSB7XG5cdFx0bGV0IGNyYyA9IHRoaXMuY3JjIHwgMDtcblx0XHRmb3IgKGxldCBvZmZzZXQgPSAwLCBsZW5ndGggPSBkYXRhLmxlbmd0aCB8IDA7IG9mZnNldCA8IGxlbmd0aDsgb2Zmc2V0KyspIHtcblx0XHRcdGNyYyA9IChjcmMgPj4+IDgpIF4gdGFibGVbKGNyYyBeIGRhdGFbb2Zmc2V0XSkgJiAweEZGXTtcblx0XHR9XG5cdFx0dGhpcy5jcmMgPSBjcmM7XG5cdH1cblxuXHRnZXQoKSB7XG5cdFx0cmV0dXJuIH50aGlzLmNyYztcblx0fVxufVxuXG5leHBvcnQge1xuXHRDcmMzMlxufTsiLCIvKlxuIENvcHlyaWdodCAoYykgMjAyMiBHaWxkYXMgTG9ybWVhdS4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG5cbiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBcbiBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gXG4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cbiAzLiBUaGUgbmFtZXMgb2YgdGhlIGF1dGhvcnMgbWF5IG5vdCBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0c1xuIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWMgcHJpb3Igd3JpdHRlbiBwZXJtaXNzaW9uLlxuXG4gVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnJ0FTIElTJycgQU5EIEFOWSBFWFBSRVNTRUQgT1IgSU1QTElFRCBXQVJSQU5USUVTLFxuIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkRcbiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgSkNSQUZULFxuIElOQy4gT1IgQU5ZIENPTlRSSUJVVE9SUyBUTyBUSElTIFNPRlRXQVJFIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsXG4gSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVFxuIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLFxuIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcbiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSxcbiBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5cbi8qIGdsb2JhbCBUcmFuc2Zvcm1TdHJlYW0gKi9cblxuaW1wb3J0IHsgQ3JjMzIgfSBmcm9tIFwiLi9jb2RlY3MvY3JjMzIuanNcIjtcblxuY2xhc3MgQ3JjMzJTdHJlYW0gZXh0ZW5kcyBUcmFuc2Zvcm1TdHJlYW0ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGxldCBzdHJlYW07XG5cdFx0Y29uc3QgY3JjMzIgPSBuZXcgQ3JjMzIoKTtcblx0XHRzdXBlcih7XG5cdFx0XHR0cmFuc2Zvcm0oY2h1bmssIGNvbnRyb2xsZXIpIHtcblx0XHRcdFx0Y3JjMzIuYXBwZW5kKGNodW5rKTtcblx0XHRcdFx0Y29udHJvbGxlci5lbnF1ZXVlKGNodW5rKTtcblx0XHRcdH0sXG5cdFx0XHRmbHVzaCgpIHtcblx0XHRcdFx0Y29uc3QgdmFsdWUgPSBuZXcgVWludDhBcnJheSg0KTtcblx0XHRcdFx0Y29uc3QgZGF0YVZpZXcgPSBuZXcgRGF0YVZpZXcodmFsdWUuYnVmZmVyKTtcblx0XHRcdFx0ZGF0YVZpZXcuc2V0VWludDMyKDAsIGNyYzMyLmdldCgpKTtcblx0XHRcdFx0c3RyZWFtLnZhbHVlID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0c3RyZWFtID0gdGhpcztcblx0fVxufVxuXG5leHBvcnQge1xuXHRDcmMzMlN0cmVhbVxufTsiLCIvKlxuIENvcHlyaWdodCAoYykgMjAyMiBHaWxkYXMgTG9ybWVhdS4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG5cbiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBcbiBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gXG4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cbiAzLiBUaGUgbmFtZXMgb2YgdGhlIGF1dGhvcnMgbWF5IG5vdCBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0c1xuIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWMgcHJpb3Igd3JpdHRlbiBwZXJtaXNzaW9uLlxuXG4gVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnJ0FTIElTJycgQU5EIEFOWSBFWFBSRVNTRUQgT1IgSU1QTElFRCBXQVJSQU5USUVTLFxuIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkRcbiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgSkNSQUZULFxuIElOQy4gT1IgQU5ZIENPTlRSSUJVVE9SUyBUTyBUSElTIFNPRlRXQVJFIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsXG4gSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVFxuIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLFxuIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcbiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSxcbiBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5cbi8qIGdsb2JhbCBUZXh0RW5jb2RlciAqL1xuXG5leHBvcnQge1xuXHRlbmNvZGVUZXh0XG59O1xuXG5mdW5jdGlvbiBlbmNvZGVUZXh0KHZhbHVlKSB7XG5cdGlmICh0eXBlb2YgVGV4dEVuY29kZXIgPT0gXCJ1bmRlZmluZWRcIikge1xuXHRcdHZhbHVlID0gdW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHZhbHVlKSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkodmFsdWUubGVuZ3RoKTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdC5sZW5ndGg7IGkrKykge1xuXHRcdFx0cmVzdWx0W2ldID0gdmFsdWUuY2hhckNvZGVBdChpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKHZhbHVlKTtcblx0fVxufSIsIi8vIERlcml2ZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20veHFkb28wMG8vanN6aXAvYmxvYi9tYXN0ZXIvbGliL3NqY2wuanMgYW5kIGh0dHBzOi8vZ2l0aHViLmNvbS9iaXR3aXNlc2hpZnRsZWZ0L3NqY2xcblxuLy8gZGVuby1saW50LWlnbm9yZS1maWxlIG5vLXRoaXMtYWxpYXNcblxuLypcbiAqIFNKQ0wgaXMgb3Blbi4gWW91IGNhbiB1c2UsIG1vZGlmeSBhbmQgcmVkaXN0cmlidXRlIGl0IHVuZGVyIGEgQlNEXG4gKiBsaWNlbnNlIG9yIHVuZGVyIHRoZSBHTlUgR1BMLCB2ZXJzaW9uIDIuMC5cbiAqL1xuXG4vKiogQGZpbGVPdmVydmlldyBKYXZhc2NyaXB0IGNyeXB0b2dyYXBoeSBpbXBsZW1lbnRhdGlvbi5cbiAqXG4gKiBDcnVzaCB0byByZW1vdmUgY29tbWVudHMsIHNob3J0ZW4gdmFyaWFibGUgbmFtZXMgYW5kXG4gKiBnZW5lcmFsbHkgcmVkdWNlIHRyYW5zbWlzc2lvbiBzaXplLlxuICpcbiAqIEBhdXRob3IgRW1pbHkgU3RhcmtcbiAqIEBhdXRob3IgTWlrZSBIYW1idXJnXG4gKiBAYXV0aG9yIERhbiBCb25laFxuICovXG5cbi8qanNsaW50IGluZGVudDogMiwgYml0d2lzZTogZmFsc2UsIG5vbWVuOiBmYWxzZSwgcGx1c3BsdXM6IGZhbHNlLCB3aGl0ZTogZmFsc2UsIHJlZ2V4cDogZmFsc2UgKi9cblxuLyoqIEBmaWxlT3ZlcnZpZXcgQXJyYXlzIG9mIGJpdHMsIGVuY29kZWQgYXMgYXJyYXlzIG9mIE51bWJlcnMuXG4gKlxuICogQGF1dGhvciBFbWlseSBTdGFya1xuICogQGF1dGhvciBNaWtlIEhhbWJ1cmdcbiAqIEBhdXRob3IgRGFuIEJvbmVoXG4gKi9cblxuLyoqXG4gKiBBcnJheXMgb2YgYml0cywgZW5jb2RlZCBhcyBhcnJheXMgb2YgTnVtYmVycy5cbiAqIEBuYW1lc3BhY2VcbiAqIEBkZXNjcmlwdGlvblxuICogPHA+XG4gKiBUaGVzZSBvYmplY3RzIGFyZSB0aGUgY3VycmVuY3kgYWNjZXB0ZWQgYnkgU0pDTCdzIGNyeXB0byBmdW5jdGlvbnMuXG4gKiA8L3A+XG4gKlxuICogPHA+XG4gKiBNb3N0IG9mIG91ciBjcnlwdG8gcHJpbWl0aXZlcyBvcGVyYXRlIG9uIGFycmF5cyBvZiA0LWJ5dGUgd29yZHMgaW50ZXJuYWxseSxcbiAqIGJ1dCBtYW55IG9mIHRoZW0gY2FuIHRha2UgYXJndW1lbnRzIHRoYXQgYXJlIG5vdCBhIG11bHRpcGxlIG9mIDQgYnl0ZXMuXG4gKiBUaGlzIGxpYnJhcnkgZW5jb2RlcyBhcnJheXMgb2YgYml0cyAod2hvc2Ugc2l6ZSBuZWVkIG5vdCBiZSBhIG11bHRpcGxlIG9mIDhcbiAqIGJpdHMpIGFzIGFycmF5cyBvZiAzMi1iaXQgd29yZHMuICBUaGUgYml0cyBhcmUgcGFja2VkLCBiaWctZW5kaWFuLCBpbnRvIGFuXG4gKiBhcnJheSBvZiB3b3JkcywgMzIgYml0cyBhdCBhIHRpbWUuICBTaW5jZSB0aGUgd29yZHMgYXJlIGRvdWJsZS1wcmVjaXNpb25cbiAqIGZsb2F0aW5nIHBvaW50IG51bWJlcnMsIHRoZXkgZml0IHNvbWUgZXh0cmEgZGF0YS4gIFdlIHVzZSB0aGlzIChpbiBhIHByaXZhdGUsXG4gKiBwb3NzaWJseS1jaGFuZ2luZyBtYW5uZXIpIHRvIGVuY29kZSB0aGUgbnVtYmVyIG9mIGJpdHMgYWN0dWFsbHkgIHByZXNlbnRcbiAqIGluIHRoZSBsYXN0IHdvcmQgb2YgdGhlIGFycmF5LlxuICogPC9wPlxuICpcbiAqIDxwPlxuICogQmVjYXVzZSBiaXR3aXNlIG9wcyBjbGVhciB0aGlzIG91dC1vZi1iYW5kIGRhdGEsIHRoZXNlIGFycmF5cyBjYW4gYmUgcGFzc2VkXG4gKiB0byBjaXBoZXJzIGxpa2UgQUVTIHdoaWNoIHdhbnQgYXJyYXlzIG9mIHdvcmRzLlxuICogPC9wPlxuICovXG5jb25zdCBiaXRBcnJheSA9IHtcblx0LyoqXG5cdCAqIENvbmNhdGVuYXRlIHR3byBiaXQgYXJyYXlzLlxuXHQgKiBAcGFyYW0ge2JpdEFycmF5fSBhMSBUaGUgZmlyc3QgYXJyYXkuXG5cdCAqIEBwYXJhbSB7Yml0QXJyYXl9IGEyIFRoZSBzZWNvbmQgYXJyYXkuXG5cdCAqIEByZXR1cm4ge2JpdEFycmF5fSBUaGUgY29uY2F0ZW5hdGlvbiBvZiBhMSBhbmQgYTIuXG5cdCAqL1xuXHRjb25jYXQoYTEsIGEyKSB7XG5cdFx0aWYgKGExLmxlbmd0aCA9PT0gMCB8fCBhMi5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBhMS5jb25jYXQoYTIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxhc3QgPSBhMVthMS5sZW5ndGggLSAxXSwgc2hpZnQgPSBiaXRBcnJheS5nZXRQYXJ0aWFsKGxhc3QpO1xuXHRcdGlmIChzaGlmdCA9PT0gMzIpIHtcblx0XHRcdHJldHVybiBhMS5jb25jYXQoYTIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gYml0QXJyYXkuX3NoaWZ0UmlnaHQoYTIsIHNoaWZ0LCBsYXN0IHwgMCwgYTEuc2xpY2UoMCwgYTEubGVuZ3RoIC0gMSkpO1xuXHRcdH1cblx0fSxcblxuXHQvKipcblx0ICogRmluZCB0aGUgbGVuZ3RoIG9mIGFuIGFycmF5IG9mIGJpdHMuXG5cdCAqIEBwYXJhbSB7Yml0QXJyYXl9IGEgVGhlIGFycmF5LlxuXHQgKiBAcmV0dXJuIHtOdW1iZXJ9IFRoZSBsZW5ndGggb2YgYSwgaW4gYml0cy5cblx0ICovXG5cdGJpdExlbmd0aChhKSB7XG5cdFx0Y29uc3QgbCA9IGEubGVuZ3RoO1xuXHRcdGlmIChsID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0Y29uc3QgeCA9IGFbbCAtIDFdO1xuXHRcdHJldHVybiAobCAtIDEpICogMzIgKyBiaXRBcnJheS5nZXRQYXJ0aWFsKHgpO1xuXHR9LFxuXG5cdC8qKlxuXHQgKiBUcnVuY2F0ZSBhbiBhcnJheS5cblx0ICogQHBhcmFtIHtiaXRBcnJheX0gYSBUaGUgYXJyYXkuXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBsZW4gVGhlIGxlbmd0aCB0byB0cnVuY2F0ZSB0bywgaW4gYml0cy5cblx0ICogQHJldHVybiB7Yml0QXJyYXl9IEEgbmV3IGFycmF5LCB0cnVuY2F0ZWQgdG8gbGVuIGJpdHMuXG5cdCAqL1xuXHRjbGFtcChhLCBsZW4pIHtcblx0XHRpZiAoYS5sZW5ndGggKiAzMiA8IGxlbikge1xuXHRcdFx0cmV0dXJuIGE7XG5cdFx0fVxuXHRcdGEgPSBhLnNsaWNlKDAsIE1hdGguY2VpbChsZW4gLyAzMikpO1xuXHRcdGNvbnN0IGwgPSBhLmxlbmd0aDtcblx0XHRsZW4gPSBsZW4gJiAzMTtcblx0XHRpZiAobCA+IDAgJiYgbGVuKSB7XG5cdFx0XHRhW2wgLSAxXSA9IGJpdEFycmF5LnBhcnRpYWwobGVuLCBhW2wgLSAxXSAmIDB4ODAwMDAwMDAgPj4gKGxlbiAtIDEpLCAxKTtcblx0XHR9XG5cdFx0cmV0dXJuIGE7XG5cdH0sXG5cblx0LyoqXG5cdCAqIE1ha2UgYSBwYXJ0aWFsIHdvcmQgZm9yIGEgYml0IGFycmF5LlxuXHQgKiBAcGFyYW0ge051bWJlcn0gbGVuIFRoZSBudW1iZXIgb2YgYml0cyBpbiB0aGUgd29yZC5cblx0ICogQHBhcmFtIHtOdW1iZXJ9IHggVGhlIGJpdHMuXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbX2VuZD0wXSBQYXNzIDEgaWYgeCBoYXMgYWxyZWFkeSBiZWVuIHNoaWZ0ZWQgdG8gdGhlIGhpZ2ggc2lkZS5cblx0ICogQHJldHVybiB7TnVtYmVyfSBUaGUgcGFydGlhbCB3b3JkLlxuXHQgKi9cblx0cGFydGlhbChsZW4sIHgsIF9lbmQpIHtcblx0XHRpZiAobGVuID09PSAzMikge1xuXHRcdFx0cmV0dXJuIHg7XG5cdFx0fVxuXHRcdHJldHVybiAoX2VuZCA/IHggfCAwIDogeCA8PCAoMzIgLSBsZW4pKSArIGxlbiAqIDB4MTAwMDAwMDAwMDA7XG5cdH0sXG5cblx0LyoqXG5cdCAqIEdldCB0aGUgbnVtYmVyIG9mIGJpdHMgdXNlZCBieSBhIHBhcnRpYWwgd29yZC5cblx0ICogQHBhcmFtIHtOdW1iZXJ9IHggVGhlIHBhcnRpYWwgd29yZC5cblx0ICogQHJldHVybiB7TnVtYmVyfSBUaGUgbnVtYmVyIG9mIGJpdHMgdXNlZCBieSB0aGUgcGFydGlhbCB3b3JkLlxuXHQgKi9cblx0Z2V0UGFydGlhbCh4KSB7XG5cdFx0cmV0dXJuIE1hdGgucm91bmQoeCAvIDB4MTAwMDAwMDAwMDApIHx8IDMyO1xuXHR9LFxuXG5cdC8qKiBTaGlmdCBhbiBhcnJheSByaWdodC5cblx0ICogQHBhcmFtIHtiaXRBcnJheX0gYSBUaGUgYXJyYXkgdG8gc2hpZnQuXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBzaGlmdCBUaGUgbnVtYmVyIG9mIGJpdHMgdG8gc2hpZnQuXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBbY2Fycnk9MF0gQSBieXRlIHRvIGNhcnJ5IGluXG5cdCAqIEBwYXJhbSB7Yml0QXJyYXl9IFtvdXQ9W11dIEFuIGFycmF5IHRvIHByZXBlbmQgdG8gdGhlIG91dHB1dC5cblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9zaGlmdFJpZ2h0KGEsIHNoaWZ0LCBjYXJyeSwgb3V0KSB7XG5cdFx0aWYgKG91dCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRvdXQgPSBbXTtcblx0XHR9XG5cblx0XHRmb3IgKDsgc2hpZnQgPj0gMzI7IHNoaWZ0IC09IDMyKSB7XG5cdFx0XHRvdXQucHVzaChjYXJyeSk7XG5cdFx0XHRjYXJyeSA9IDA7XG5cdFx0fVxuXHRcdGlmIChzaGlmdCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIG91dC5jb25jYXQoYSk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRvdXQucHVzaChjYXJyeSB8IGFbaV0gPj4+IHNoaWZ0KTtcblx0XHRcdGNhcnJ5ID0gYVtpXSA8PCAoMzIgLSBzaGlmdCk7XG5cdFx0fVxuXHRcdGNvbnN0IGxhc3QyID0gYS5sZW5ndGggPyBhW2EubGVuZ3RoIC0gMV0gOiAwO1xuXHRcdGNvbnN0IHNoaWZ0MiA9IGJpdEFycmF5LmdldFBhcnRpYWwobGFzdDIpO1xuXHRcdG91dC5wdXNoKGJpdEFycmF5LnBhcnRpYWwoc2hpZnQgKyBzaGlmdDIgJiAzMSwgKHNoaWZ0ICsgc2hpZnQyID4gMzIpID8gY2FycnkgOiBvdXQucG9wKCksIDEpKTtcblx0XHRyZXR1cm4gb3V0O1xuXHR9XG59O1xuXG4vKiogQGZpbGVPdmVydmlldyBCaXQgYXJyYXkgY29kZWMgaW1wbGVtZW50YXRpb25zLlxuICpcbiAqIEBhdXRob3IgRW1pbHkgU3RhcmtcbiAqIEBhdXRob3IgTWlrZSBIYW1idXJnXG4gKiBAYXV0aG9yIERhbiBCb25laFxuICovXG5cbi8qKlxuICogQXJyYXlzIG9mIGJ5dGVzXG4gKiBAbmFtZXNwYWNlXG4gKi9cbmNvbnN0IGNvZGVjID0ge1xuXHRieXRlczoge1xuXHRcdC8qKiBDb252ZXJ0IGZyb20gYSBiaXRBcnJheSB0byBhbiBhcnJheSBvZiBieXRlcy4gKi9cblx0XHRmcm9tQml0cyhhcnIpIHtcblx0XHRcdGNvbnN0IGJsID0gYml0QXJyYXkuYml0TGVuZ3RoKGFycik7XG5cdFx0XHRjb25zdCBieXRlTGVuZ3RoID0gYmwgLyA4O1xuXHRcdFx0Y29uc3Qgb3V0ID0gbmV3IFVpbnQ4QXJyYXkoYnl0ZUxlbmd0aCk7XG5cdFx0XHRsZXQgdG1wO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBieXRlTGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKChpICYgMykgPT09IDApIHtcblx0XHRcdFx0XHR0bXAgPSBhcnJbaSAvIDRdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG91dFtpXSA9IHRtcCA+Pj4gMjQ7XG5cdFx0XHRcdHRtcCA8PD0gODtcblx0XHRcdH1cblx0XHRcdHJldHVybiBvdXQ7XG5cdFx0fSxcblx0XHQvKiogQ29udmVydCBmcm9tIGFuIGFycmF5IG9mIGJ5dGVzIHRvIGEgYml0QXJyYXkuICovXG5cdFx0dG9CaXRzKGJ5dGVzKSB7XG5cdFx0XHRjb25zdCBvdXQgPSBbXTtcblx0XHRcdGxldCBpO1xuXHRcdFx0bGV0IHRtcCA9IDA7XG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0dG1wID0gdG1wIDw8IDggfCBieXRlc1tpXTtcblx0XHRcdFx0aWYgKChpICYgMykgPT09IDMpIHtcblx0XHRcdFx0XHRvdXQucHVzaCh0bXApO1xuXHRcdFx0XHRcdHRtcCA9IDA7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChpICYgMykge1xuXHRcdFx0XHRvdXQucHVzaChiaXRBcnJheS5wYXJ0aWFsKDggKiAoaSAmIDMpLCB0bXApKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBvdXQ7XG5cdFx0fVxuXHR9XG59O1xuXG5jb25zdCBoYXNoID0ge307XG5cbi8qKlxuICogQ29udGV4dCBmb3IgYSBTSEEtMSBvcGVyYXRpb24gaW4gcHJvZ3Jlc3MuXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuaGFzaC5zaGExID0gY2xhc3Mge1xuXHRjb25zdHJ1Y3RvcihoYXNoKSB7XG5cdFx0Y29uc3Qgc2hhMSA9IHRoaXM7XG5cdFx0LyoqXG5cdFx0ICogVGhlIGhhc2gncyBibG9jayBzaXplLCBpbiBiaXRzLlxuXHRcdCAqIEBjb25zdGFudFxuXHRcdCAqL1xuXHRcdHNoYTEuYmxvY2tTaXplID0gNTEyO1xuXHRcdC8qKlxuXHRcdCAqIFRoZSBTSEEtMSBpbml0aWFsaXphdGlvbiB2ZWN0b3IuXG5cdFx0ICogQHByaXZhdGVcblx0XHQgKi9cblx0XHRzaGExLl9pbml0ID0gWzB4Njc0NTIzMDEsIDB4RUZDREFCODksIDB4OThCQURDRkUsIDB4MTAzMjU0NzYsIDB4QzNEMkUxRjBdO1xuXHRcdC8qKlxuXHRcdCAqIFRoZSBTSEEtMSBoYXNoIGtleS5cblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqL1xuXHRcdHNoYTEuX2tleSA9IFsweDVBODI3OTk5LCAweDZFRDlFQkExLCAweDhGMUJCQ0RDLCAweENBNjJDMUQ2XTtcblx0XHRpZiAoaGFzaCkge1xuXHRcdFx0c2hhMS5faCA9IGhhc2guX2guc2xpY2UoMCk7XG5cdFx0XHRzaGExLl9idWZmZXIgPSBoYXNoLl9idWZmZXIuc2xpY2UoMCk7XG5cdFx0XHRzaGExLl9sZW5ndGggPSBoYXNoLl9sZW5ndGg7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNoYTEucmVzZXQoKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogUmVzZXQgdGhlIGhhc2ggc3RhdGUuXG5cdCAqIEByZXR1cm4gdGhpc1xuXHQgKi9cblx0cmVzZXQoKSB7XG5cdFx0Y29uc3Qgc2hhMSA9IHRoaXM7XG5cdFx0c2hhMS5faCA9IHNoYTEuX2luaXQuc2xpY2UoMCk7XG5cdFx0c2hhMS5fYnVmZmVyID0gW107XG5cdFx0c2hhMS5fbGVuZ3RoID0gMDtcblx0XHRyZXR1cm4gc2hhMTtcblx0fVxuXG5cdC8qKlxuXHQgKiBJbnB1dCBzZXZlcmFsIHdvcmRzIHRvIHRoZSBoYXNoLlxuXHQgKiBAcGFyYW0ge2JpdEFycmF5fFN0cmluZ30gZGF0YSB0aGUgZGF0YSB0byBoYXNoLlxuXHQgKiBAcmV0dXJuIHRoaXNcblx0ICovXG5cdHVwZGF0ZShkYXRhKSB7XG5cdFx0Y29uc3Qgc2hhMSA9IHRoaXM7XG5cdFx0aWYgKHR5cGVvZiBkYXRhID09PSBcInN0cmluZ1wiKSB7XG5cdFx0XHRkYXRhID0gY29kZWMudXRmOFN0cmluZy50b0JpdHMoZGF0YSk7XG5cdFx0fVxuXHRcdGNvbnN0IGIgPSBzaGExLl9idWZmZXIgPSBiaXRBcnJheS5jb25jYXQoc2hhMS5fYnVmZmVyLCBkYXRhKTtcblx0XHRjb25zdCBvbCA9IHNoYTEuX2xlbmd0aDtcblx0XHRjb25zdCBubCA9IHNoYTEuX2xlbmd0aCA9IG9sICsgYml0QXJyYXkuYml0TGVuZ3RoKGRhdGEpO1xuXHRcdGlmIChubCA+IDkwMDcxOTkyNTQ3NDA5OTEpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBoYXNoIG1vcmUgdGhhbiAyXjUzIC0gMSBiaXRzXCIpO1xuXHRcdH1cblx0XHRjb25zdCBjID0gbmV3IFVpbnQzMkFycmF5KGIpO1xuXHRcdGxldCBqID0gMDtcblx0XHRmb3IgKGxldCBpID0gc2hhMS5ibG9ja1NpemUgKyBvbCAtICgoc2hhMS5ibG9ja1NpemUgKyBvbCkgJiAoc2hhMS5ibG9ja1NpemUgLSAxKSk7IGkgPD0gbmw7XG5cdFx0XHRpICs9IHNoYTEuYmxvY2tTaXplKSB7XG5cdFx0XHRzaGExLl9ibG9jayhjLnN1YmFycmF5KDE2ICogaiwgMTYgKiAoaiArIDEpKSk7XG5cdFx0XHRqICs9IDE7XG5cdFx0fVxuXHRcdGIuc3BsaWNlKDAsIDE2ICogaik7XG5cdFx0cmV0dXJuIHNoYTE7XG5cdH1cblxuXHQvKipcblx0ICogQ29tcGxldGUgaGFzaGluZyBhbmQgb3V0cHV0IHRoZSBoYXNoIHZhbHVlLlxuXHQgKiBAcmV0dXJuIHtiaXRBcnJheX0gVGhlIGhhc2ggdmFsdWUsIGFuIGFycmF5IG9mIDUgYmlnLWVuZGlhbiB3b3Jkcy4gVE9ET1xuXHQgKi9cblx0ZmluYWxpemUoKSB7XG5cdFx0Y29uc3Qgc2hhMSA9IHRoaXM7XG5cdFx0bGV0IGIgPSBzaGExLl9idWZmZXI7XG5cdFx0Y29uc3QgaCA9IHNoYTEuX2g7XG5cblx0XHQvLyBSb3VuZCBvdXQgYW5kIHB1c2ggdGhlIGJ1ZmZlclxuXHRcdGIgPSBiaXRBcnJheS5jb25jYXQoYiwgW2JpdEFycmF5LnBhcnRpYWwoMSwgMSldKTtcblx0XHQvLyBSb3VuZCBvdXQgdGhlIGJ1ZmZlciB0byBhIG11bHRpcGxlIG9mIDE2IHdvcmRzLCBsZXNzIHRoZSAyIGxlbmd0aCB3b3Jkcy5cblx0XHRmb3IgKGxldCBpID0gYi5sZW5ndGggKyAyOyBpICYgMTU7IGkrKykge1xuXHRcdFx0Yi5wdXNoKDApO1xuXHRcdH1cblxuXHRcdC8vIGFwcGVuZCB0aGUgbGVuZ3RoXG5cdFx0Yi5wdXNoKE1hdGguZmxvb3Ioc2hhMS5fbGVuZ3RoIC8gMHgxMDAwMDAwMDApKTtcblx0XHRiLnB1c2goc2hhMS5fbGVuZ3RoIHwgMCk7XG5cblx0XHR3aGlsZSAoYi5sZW5ndGgpIHtcblx0XHRcdHNoYTEuX2Jsb2NrKGIuc3BsaWNlKDAsIDE2KSk7XG5cdFx0fVxuXG5cdFx0c2hhMS5yZXNldCgpO1xuXHRcdHJldHVybiBoO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZSBTSEEtMSBsb2dpY2FsIGZ1bmN0aW9ucyBmKDApLCBmKDEpLCAuLi4sIGYoNzkpLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X2YodCwgYiwgYywgZCkge1xuXHRcdGlmICh0IDw9IDE5KSB7XG5cdFx0XHRyZXR1cm4gKGIgJiBjKSB8ICh+YiAmIGQpO1xuXHRcdH0gZWxzZSBpZiAodCA8PSAzOSkge1xuXHRcdFx0cmV0dXJuIGIgXiBjIF4gZDtcblx0XHR9IGVsc2UgaWYgKHQgPD0gNTkpIHtcblx0XHRcdHJldHVybiAoYiAmIGMpIHwgKGIgJiBkKSB8IChjICYgZCk7XG5cdFx0fSBlbHNlIGlmICh0IDw9IDc5KSB7XG5cdFx0XHRyZXR1cm4gYiBeIGMgXiBkO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDaXJjdWxhciBsZWZ0LXNoaWZ0IG9wZXJhdG9yLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0X1MobiwgeCkge1xuXHRcdHJldHVybiAoeCA8PCBuKSB8ICh4ID4+PiAzMiAtIG4pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBlcmZvcm0gb25lIGN5Y2xlIG9mIFNIQS0xLlxuXHQgKiBAcGFyYW0ge1VpbnQzMkFycmF5fGJpdEFycmF5fSB3b3JkcyBvbmUgYmxvY2sgb2Ygd29yZHMuXG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRfYmxvY2sod29yZHMpIHtcblx0XHRjb25zdCBzaGExID0gdGhpcztcblx0XHRjb25zdCBoID0gc2hhMS5faDtcblx0XHQvLyBXaGVuIHdvcmRzIGlzIHBhc3NlZCB0byBfYmxvY2ssIGl0IGhhcyAxNiBlbGVtZW50cy4gU0hBMSBfYmxvY2tcblx0XHQvLyBmdW5jdGlvbiBleHRlbmRzIHdvcmRzIHdpdGggbmV3IGVsZW1lbnRzIChhdCB0aGUgZW5kIHRoZXJlIGFyZSA4MCBlbGVtZW50cykuIFxuXHRcdC8vIFRoZSBwcm9ibGVtIGlzIHRoYXQgaWYgd2UgdXNlIFVpbnQzMkFycmF5IGluc3RlYWQgb2YgQXJyYXksIFxuXHRcdC8vIHRoZSBsZW5ndGggb2YgVWludDMyQXJyYXkgY2Fubm90IGJlIGNoYW5nZWQuIFRodXMsIHdlIHJlcGxhY2Ugd29yZHMgd2l0aCBhIFxuXHRcdC8vIG5vcm1hbCBBcnJheSBoZXJlLlxuXHRcdGNvbnN0IHcgPSBBcnJheSg4MCk7IC8vIGRvIG5vdCB1c2UgVWludDMyQXJyYXkgaGVyZSBhcyB0aGUgaW5zdGFudGlhdGlvbiBpcyBzbG93ZXJcblx0XHRmb3IgKGxldCBqID0gMDsgaiA8IDE2OyBqKyspIHtcblx0XHRcdHdbal0gPSB3b3Jkc1tqXTtcblx0XHR9XG5cblx0XHRsZXQgYSA9IGhbMF07XG5cdFx0bGV0IGIgPSBoWzFdO1xuXHRcdGxldCBjID0gaFsyXTtcblx0XHRsZXQgZCA9IGhbM107XG5cdFx0bGV0IGUgPSBoWzRdO1xuXG5cdFx0Zm9yIChsZXQgdCA9IDA7IHQgPD0gNzk7IHQrKykge1xuXHRcdFx0aWYgKHQgPj0gMTYpIHtcblx0XHRcdFx0d1t0XSA9IHNoYTEuX1MoMSwgd1t0IC0gM10gXiB3W3QgLSA4XSBeIHdbdCAtIDE0XSBeIHdbdCAtIDE2XSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB0bXAgPSAoc2hhMS5fUyg1LCBhKSArIHNoYTEuX2YodCwgYiwgYywgZCkgKyBlICsgd1t0XSArXG5cdFx0XHRcdHNoYTEuX2tleVtNYXRoLmZsb29yKHQgLyAyMCldKSB8IDA7XG5cdFx0XHRlID0gZDtcblx0XHRcdGQgPSBjO1xuXHRcdFx0YyA9IHNoYTEuX1MoMzAsIGIpO1xuXHRcdFx0YiA9IGE7XG5cdFx0XHRhID0gdG1wO1xuXHRcdH1cblxuXHRcdGhbMF0gPSAoaFswXSArIGEpIHwgMDtcblx0XHRoWzFdID0gKGhbMV0gKyBiKSB8IDA7XG5cdFx0aFsyXSA9IChoWzJdICsgYykgfCAwO1xuXHRcdGhbM10gPSAoaFszXSArIGQpIHwgMDtcblx0XHRoWzRdID0gKGhbNF0gKyBlKSB8IDA7XG5cdH1cbn07XG5cbi8qKiBAZmlsZU92ZXJ2aWV3IExvdy1sZXZlbCBBRVMgaW1wbGVtZW50YXRpb24uXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGEgbG93LWxldmVsIGltcGxlbWVudGF0aW9uIG9mIEFFUywgb3B0aW1pemVkIGZvclxuICogc2l6ZSBhbmQgZm9yIGVmZmljaWVuY3kgb24gc2V2ZXJhbCBicm93c2Vycy4gIEl0IGlzIGJhc2VkIG9uXG4gKiBPcGVuU1NMJ3MgYWVzX2NvcmUuYywgYSBwdWJsaWMtZG9tYWluIGltcGxlbWVudGF0aW9uIGJ5IFZpbmNlbnRcbiAqIFJpam1lbiwgQW50b29uIEJvc3NlbGFlcnMgYW5kIFBhdWxvIEJhcnJldG8uXG4gKlxuICogQW4gb2xkZXIgdmVyc2lvbiBvZiB0aGlzIGltcGxlbWVudGF0aW9uIGlzIGF2YWlsYWJsZSBpbiB0aGUgcHVibGljXG4gKiBkb21haW4sIGJ1dCB0aGlzIG9uZSBpcyAoYykgRW1pbHkgU3RhcmssIE1pa2UgSGFtYnVyZywgRGFuIEJvbmVoLFxuICogU3RhbmZvcmQgVW5pdmVyc2l0eSAyMDA4LTIwMTAgYW5kIEJTRC1saWNlbnNlZCBmb3IgbGlhYmlsaXR5XG4gKiByZWFzb25zLlxuICpcbiAqIEBhdXRob3IgRW1pbHkgU3RhcmtcbiAqIEBhdXRob3IgTWlrZSBIYW1idXJnXG4gKiBAYXV0aG9yIERhbiBCb25laFxuICovXG5cbmNvbnN0IGNpcGhlciA9IHt9O1xuXG4vKipcbiAqIFNjaGVkdWxlIG91dCBhbiBBRVMga2V5IGZvciBib3RoIGVuY3J5cHRpb24gYW5kIGRlY3J5cHRpb24uICBUaGlzXG4gKiBpcyBhIGxvdy1sZXZlbCBjbGFzcy4gIFVzZSBhIGNpcGhlciBtb2RlIHRvIGRvIGJ1bGsgZW5jcnlwdGlvbi5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7QXJyYXl9IGtleSBUaGUga2V5IGFzIGFuIGFycmF5IG9mIDQsIDYgb3IgOCB3b3Jkcy5cbiAqL1xuY2lwaGVyLmFlcyA9IGNsYXNzIHtcblx0Y29uc3RydWN0b3Ioa2V5KSB7XG5cdFx0LyoqXG5cdFx0ICogVGhlIGV4cGFuZGVkIFMtYm94IGFuZCBpbnZlcnNlIFMtYm94IHRhYmxlcy4gIFRoZXNlIHdpbGwgYmUgY29tcHV0ZWRcblx0XHQgKiBvbiB0aGUgY2xpZW50IHNvIHRoYXQgd2UgZG9uJ3QgaGF2ZSB0byBzZW5kIHRoZW0gZG93biB0aGUgd2lyZS5cblx0XHQgKlxuXHRcdCAqIFRoZXJlIGFyZSB0d28gdGFibGVzLCBfdGFibGVzWzBdIGlzIGZvciBlbmNyeXB0aW9uIGFuZFxuXHRcdCAqIF90YWJsZXNbMV0gaXMgZm9yIGRlY3J5cHRpb24uXG5cdFx0ICpcblx0XHQgKiBUaGUgZmlyc3QgNCBzdWItdGFibGVzIGFyZSB0aGUgZXhwYW5kZWQgUy1ib3ggd2l0aCBNaXhDb2x1bW5zLiAgVGhlXG5cdFx0ICogbGFzdCAoX3RhYmxlc1swMV1bNF0pIGlzIHRoZSBTLWJveCBpdHNlbGYuXG5cdFx0ICpcblx0XHQgKiBAcHJpdmF0ZVxuXHRcdCAqL1xuXHRcdGNvbnN0IGFlcyA9IHRoaXM7XG5cdFx0YWVzLl90YWJsZXMgPSBbW1tdLCBbXSwgW10sIFtdLCBbXV0sIFtbXSwgW10sIFtdLCBbXSwgW11dXTtcblxuXHRcdGlmICghYWVzLl90YWJsZXNbMF1bMF1bMF0pIHtcblx0XHRcdGFlcy5fcHJlY29tcHV0ZSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNib3ggPSBhZXMuX3RhYmxlc1swXVs0XTtcblx0XHRjb25zdCBkZWNUYWJsZSA9IGFlcy5fdGFibGVzWzFdO1xuXHRcdGNvbnN0IGtleUxlbiA9IGtleS5sZW5ndGg7XG5cblx0XHRsZXQgaSwgZW5jS2V5LCBkZWNLZXksIHJjb24gPSAxO1xuXG5cdFx0aWYgKGtleUxlbiAhPT0gNCAmJiBrZXlMZW4gIT09IDYgJiYga2V5TGVuICE9PSA4KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoXCJpbnZhbGlkIGFlcyBrZXkgc2l6ZVwiKTtcblx0XHR9XG5cblx0XHRhZXMuX2tleSA9IFtlbmNLZXkgPSBrZXkuc2xpY2UoMCksIGRlY0tleSA9IFtdXTtcblxuXHRcdC8vIHNjaGVkdWxlIGVuY3J5cHRpb24ga2V5c1xuXHRcdGZvciAoaSA9IGtleUxlbjsgaSA8IDQgKiBrZXlMZW4gKyAyODsgaSsrKSB7XG5cdFx0XHRsZXQgdG1wID0gZW5jS2V5W2kgLSAxXTtcblxuXHRcdFx0Ly8gYXBwbHkgc2JveFxuXHRcdFx0aWYgKGkgJSBrZXlMZW4gPT09IDAgfHwgKGtleUxlbiA9PT0gOCAmJiBpICUga2V5TGVuID09PSA0KSkge1xuXHRcdFx0XHR0bXAgPSBzYm94W3RtcCA+Pj4gMjRdIDw8IDI0IF4gc2JveFt0bXAgPj4gMTYgJiAyNTVdIDw8IDE2IF4gc2JveFt0bXAgPj4gOCAmIDI1NV0gPDwgOCBeIHNib3hbdG1wICYgMjU1XTtcblxuXHRcdFx0XHQvLyBzaGlmdCByb3dzIGFuZCBhZGQgcmNvblxuXHRcdFx0XHRpZiAoaSAlIGtleUxlbiA9PT0gMCkge1xuXHRcdFx0XHRcdHRtcCA9IHRtcCA8PCA4IF4gdG1wID4+PiAyNCBeIHJjb24gPDwgMjQ7XG5cdFx0XHRcdFx0cmNvbiA9IHJjb24gPDwgMSBeIChyY29uID4+IDcpICogMjgzO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGVuY0tleVtpXSA9IGVuY0tleVtpIC0ga2V5TGVuXSBeIHRtcDtcblx0XHR9XG5cblx0XHQvLyBzY2hlZHVsZSBkZWNyeXB0aW9uIGtleXNcblx0XHRmb3IgKGxldCBqID0gMDsgaTsgaisrLCBpLS0pIHtcblx0XHRcdGNvbnN0IHRtcCA9IGVuY0tleVtqICYgMyA/IGkgOiBpIC0gNF07XG5cdFx0XHRpZiAoaSA8PSA0IHx8IGogPCA0KSB7XG5cdFx0XHRcdGRlY0tleVtqXSA9IHRtcDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRlY0tleVtqXSA9IGRlY1RhYmxlWzBdW3Nib3hbdG1wID4+PiAyNF1dIF5cblx0XHRcdFx0XHRkZWNUYWJsZVsxXVtzYm94W3RtcCA+PiAxNiAmIDI1NV1dIF5cblx0XHRcdFx0XHRkZWNUYWJsZVsyXVtzYm94W3RtcCA+PiA4ICYgMjU1XV0gXlxuXHRcdFx0XHRcdGRlY1RhYmxlWzNdW3Nib3hbdG1wICYgMjU1XV07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdC8vIHB1YmxpY1xuXHQvKiBTb21ldGhpbmcgbGlrZSB0aGlzIG1pZ2h0IGFwcGVhciBoZXJlIGV2ZW50dWFsbHlcblx0bmFtZTogXCJBRVNcIixcblx0YmxvY2tTaXplOiA0LFxuXHRrZXlTaXplczogWzQsNiw4XSxcblx0Ki9cblxuXHQvKipcblx0ICogRW5jcnlwdCBhbiBhcnJheSBvZiA0IGJpZy1lbmRpYW4gd29yZHMuXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGRhdGEgVGhlIHBsYWludGV4dC5cblx0ICogQHJldHVybiB7QXJyYXl9IFRoZSBjaXBoZXJ0ZXh0LlxuXHQgKi9cblx0ZW5jcnlwdChkYXRhKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NyeXB0KGRhdGEsIDApO1xuXHR9XG5cblx0LyoqXG5cdCAqIERlY3J5cHQgYW4gYXJyYXkgb2YgNCBiaWctZW5kaWFuIHdvcmRzLlxuXHQgKiBAcGFyYW0ge0FycmF5fSBkYXRhIFRoZSBjaXBoZXJ0ZXh0LlxuXHQgKiBAcmV0dXJuIHtBcnJheX0gVGhlIHBsYWludGV4dC5cblx0ICovXG5cdGRlY3J5cHQoZGF0YSkge1xuXHRcdHJldHVybiB0aGlzLl9jcnlwdChkYXRhLCAxKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBFeHBhbmQgdGhlIFMtYm94IHRhYmxlcy5cblx0ICpcblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9wcmVjb21wdXRlKCkge1xuXHRcdGNvbnN0IGVuY1RhYmxlID0gdGhpcy5fdGFibGVzWzBdO1xuXHRcdGNvbnN0IGRlY1RhYmxlID0gdGhpcy5fdGFibGVzWzFdO1xuXHRcdGNvbnN0IHNib3ggPSBlbmNUYWJsZVs0XTtcblx0XHRjb25zdCBzYm94SW52ID0gZGVjVGFibGVbNF07XG5cdFx0Y29uc3QgZCA9IFtdO1xuXHRcdGNvbnN0IHRoID0gW107XG5cdFx0bGV0IHhJbnYsIHgyLCB4NCwgeDg7XG5cblx0XHQvLyBDb21wdXRlIGRvdWJsZSBhbmQgdGhpcmQgdGFibGVzXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAyNTY7IGkrKykge1xuXHRcdFx0dGhbKGRbaV0gPSBpIDw8IDEgXiAoaSA+PiA3KSAqIDI4MykgXiBpXSA9IGk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgeCA9IHhJbnYgPSAwOyAhc2JveFt4XTsgeCBePSB4MiB8fCAxLCB4SW52ID0gdGhbeEludl0gfHwgMSkge1xuXHRcdFx0Ly8gQ29tcHV0ZSBzYm94XG5cdFx0XHRsZXQgcyA9IHhJbnYgXiB4SW52IDw8IDEgXiB4SW52IDw8IDIgXiB4SW52IDw8IDMgXiB4SW52IDw8IDQ7XG5cdFx0XHRzID0gcyA+PiA4IF4gcyAmIDI1NSBeIDk5O1xuXHRcdFx0c2JveFt4XSA9IHM7XG5cdFx0XHRzYm94SW52W3NdID0geDtcblxuXHRcdFx0Ly8gQ29tcHV0ZSBNaXhDb2x1bW5zXG5cdFx0XHR4OCA9IGRbeDQgPSBkW3gyID0gZFt4XV1dO1xuXHRcdFx0bGV0IHREZWMgPSB4OCAqIDB4MTAxMDEwMSBeIHg0ICogMHgxMDAwMSBeIHgyICogMHgxMDEgXiB4ICogMHgxMDEwMTAwO1xuXHRcdFx0bGV0IHRFbmMgPSBkW3NdICogMHgxMDEgXiBzICogMHgxMDEwMTAwO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuXHRcdFx0XHRlbmNUYWJsZVtpXVt4XSA9IHRFbmMgPSB0RW5jIDw8IDI0IF4gdEVuYyA+Pj4gODtcblx0XHRcdFx0ZGVjVGFibGVbaV1bc10gPSB0RGVjID0gdERlYyA8PCAyNCBeIHREZWMgPj4+IDg7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ29tcGFjdGlmeS4gIENvbnNpZGVyYWJsZSBzcGVlZHVwIG9uIEZpcmVmb3guXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA1OyBpKyspIHtcblx0XHRcdGVuY1RhYmxlW2ldID0gZW5jVGFibGVbaV0uc2xpY2UoMCk7XG5cdFx0XHRkZWNUYWJsZVtpXSA9IGRlY1RhYmxlW2ldLnNsaWNlKDApO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBFbmNyeXB0aW9uIGFuZCBkZWNyeXB0aW9uIGNvcmUuXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGlucHV0IEZvdXIgd29yZHMgdG8gYmUgZW5jcnlwdGVkIG9yIGRlY3J5cHRlZC5cblx0ICogQHBhcmFtIGRpciBUaGUgZGlyZWN0aW9uLCAwIGZvciBlbmNyeXB0IGFuZCAxIGZvciBkZWNyeXB0LlxuXHQgKiBAcmV0dXJuIHtBcnJheX0gVGhlIGZvdXIgZW5jcnlwdGVkIG9yIGRlY3J5cHRlZCB3b3Jkcy5cblx0ICogQHByaXZhdGVcblx0ICovXG5cdF9jcnlwdChpbnB1dCwgZGlyKSB7XG5cdFx0aWYgKGlucHV0Lmxlbmd0aCAhPT0gNCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiaW52YWxpZCBhZXMgYmxvY2sgc2l6ZVwiKTtcblx0XHR9XG5cblx0XHRjb25zdCBrZXkgPSB0aGlzLl9rZXlbZGlyXTtcblxuXHRcdGNvbnN0IG5Jbm5lclJvdW5kcyA9IGtleS5sZW5ndGggLyA0IC0gMjtcblx0XHRjb25zdCBvdXQgPSBbMCwgMCwgMCwgMF07XG5cdFx0Y29uc3QgdGFibGUgPSB0aGlzLl90YWJsZXNbZGlyXTtcblxuXHRcdC8vIGxvYWQgdXAgdGhlIHRhYmxlc1xuXHRcdGNvbnN0IHQwID0gdGFibGVbMF07XG5cdFx0Y29uc3QgdDEgPSB0YWJsZVsxXTtcblx0XHRjb25zdCB0MiA9IHRhYmxlWzJdO1xuXHRcdGNvbnN0IHQzID0gdGFibGVbM107XG5cdFx0Y29uc3Qgc2JveCA9IHRhYmxlWzRdO1xuXG5cdFx0Ly8gc3RhdGUgdmFyaWFibGVzIGEsYixjLGQgYXJlIGxvYWRlZCB3aXRoIHByZS13aGl0ZW5lZCBkYXRhXG5cdFx0bGV0IGEgPSBpbnB1dFswXSBeIGtleVswXTtcblx0XHRsZXQgYiA9IGlucHV0W2RpciA/IDMgOiAxXSBeIGtleVsxXTtcblx0XHRsZXQgYyA9IGlucHV0WzJdIF4ga2V5WzJdO1xuXHRcdGxldCBkID0gaW5wdXRbZGlyID8gMSA6IDNdIF4ga2V5WzNdO1xuXHRcdGxldCBrSW5kZXggPSA0O1xuXHRcdGxldCBhMiwgYjIsIGMyO1xuXG5cdFx0Ly8gSW5uZXIgcm91bmRzLiAgQ3JpYmJlZCBmcm9tIE9wZW5TU0wuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBuSW5uZXJSb3VuZHM7IGkrKykge1xuXHRcdFx0YTIgPSB0MFthID4+PiAyNF0gXiB0MVtiID4+IDE2ICYgMjU1XSBeIHQyW2MgPj4gOCAmIDI1NV0gXiB0M1tkICYgMjU1XSBeIGtleVtrSW5kZXhdO1xuXHRcdFx0YjIgPSB0MFtiID4+PiAyNF0gXiB0MVtjID4+IDE2ICYgMjU1XSBeIHQyW2QgPj4gOCAmIDI1NV0gXiB0M1thICYgMjU1XSBeIGtleVtrSW5kZXggKyAxXTtcblx0XHRcdGMyID0gdDBbYyA+Pj4gMjRdIF4gdDFbZCA+PiAxNiAmIDI1NV0gXiB0MlthID4+IDggJiAyNTVdIF4gdDNbYiAmIDI1NV0gXiBrZXlba0luZGV4ICsgMl07XG5cdFx0XHRkID0gdDBbZCA+Pj4gMjRdIF4gdDFbYSA+PiAxNiAmIDI1NV0gXiB0MltiID4+IDggJiAyNTVdIF4gdDNbYyAmIDI1NV0gXiBrZXlba0luZGV4ICsgM107XG5cdFx0XHRrSW5kZXggKz0gNDtcblx0XHRcdGEgPSBhMjsgYiA9IGIyOyBjID0gYzI7XG5cdFx0fVxuXG5cdFx0Ly8gTGFzdCByb3VuZC5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDQ7IGkrKykge1xuXHRcdFx0b3V0W2RpciA/IDMgJiAtaSA6IGldID1cblx0XHRcdFx0c2JveFthID4+PiAyNF0gPDwgMjQgXlxuXHRcdFx0XHRzYm94W2IgPj4gMTYgJiAyNTVdIDw8IDE2IF5cblx0XHRcdFx0c2JveFtjID4+IDggJiAyNTVdIDw8IDggXlxuXHRcdFx0XHRzYm94W2QgJiAyNTVdIF5cblx0XHRcdFx0a2V5W2tJbmRleCsrXTtcblx0XHRcdGEyID0gYTsgYSA9IGI7IGIgPSBjOyBjID0gZDsgZCA9IGEyO1xuXHRcdH1cblxuXHRcdHJldHVybiBvdXQ7XG5cdH1cbn07XG5cbi8qKlxuICogUmFuZG9tIHZhbHVlc1xuICogQG5hbWVzcGFjZVxuICovXG5jb25zdCByYW5kb20gPSB7XG5cdC8qKiBcblx0ICogR2VuZXJhdGUgcmFuZG9tIHdvcmRzIHdpdGggcHVyZSBqcywgY3J5cHRvZ3JhcGhpY2FsbHkgbm90IGFzIHN0cm9uZyAmIHNhZmUgYXMgbmF0aXZlIGltcGxlbWVudGF0aW9uLlxuXHQgKiBAcGFyYW0ge1R5cGVkQXJyYXl9IHR5cGVkQXJyYXkgVGhlIGFycmF5IHRvIGZpbGwuXG5cdCAqIEByZXR1cm4ge1R5cGVkQXJyYXl9IFRoZSByYW5kb20gdmFsdWVzLlxuXHQgKi9cblx0Z2V0UmFuZG9tVmFsdWVzKHR5cGVkQXJyYXkpIHtcblx0XHRjb25zdCB3b3JkcyA9IG5ldyBVaW50MzJBcnJheSh0eXBlZEFycmF5LmJ1ZmZlcik7XG5cdFx0Y29uc3QgciA9IChtX3cpID0+IHtcblx0XHRcdGxldCBtX3ogPSAweDNhZGU2OGIxO1xuXHRcdFx0Y29uc3QgbWFzayA9IDB4ZmZmZmZmZmY7XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRtX3ogPSAoMHg5MDY5ICogKG1feiAmIDB4RkZGRikgKyAobV96ID4+IDB4MTApKSAmIG1hc2s7XG5cdFx0XHRcdG1fdyA9ICgweDQ2NTAgKiAobV93ICYgMHhGRkZGKSArIChtX3cgPj4gMHgxMCkpICYgbWFzaztcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gKCgoKG1feiA8PCAweDEwKSArIG1fdykgJiBtYXNrKSAvIDB4MTAwMDAwMDAwKSArIC41O1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0ICogKE1hdGgucmFuZG9tKCkgPiAuNSA/IDEgOiAtMSk7XG5cdFx0XHR9O1xuXHRcdH07XG5cdFx0Zm9yIChsZXQgaSA9IDAsIHJjYWNoZTsgaSA8IHR5cGVkQXJyYXkubGVuZ3RoOyBpICs9IDQpIHtcblx0XHRcdGNvbnN0IF9yID0gcigocmNhY2hlIHx8IE1hdGgucmFuZG9tKCkpICogMHgxMDAwMDAwMDApO1xuXHRcdFx0cmNhY2hlID0gX3IoKSAqIDB4M2FkZTY3Yjc7XG5cdFx0XHR3b3Jkc1tpIC8gNF0gPSAoX3IoKSAqIDB4MTAwMDAwMDAwKSB8IDA7XG5cdFx0fVxuXHRcdHJldHVybiB0eXBlZEFycmF5O1xuXHR9XG59O1xuXG4vKiogQGZpbGVPdmVydmlldyBDVFIgbW9kZSBpbXBsZW1lbnRhdGlvbi5cbiAqXG4gKiBTcGVjaWFsIHRoYW5rcyB0byBSb3kgTmljaG9sc29uIGZvciBwb2ludGluZyBvdXQgYSBidWcgaW4gb3VyXG4gKiBpbXBsZW1lbnRhdGlvbi5cbiAqXG4gKiBAYXV0aG9yIEVtaWx5IFN0YXJrXG4gKiBAYXV0aG9yIE1pa2UgSGFtYnVyZ1xuICogQGF1dGhvciBEYW4gQm9uZWhcbiAqL1xuXG4vKiogQnJpYW4gR2xhZG1hbidzIENUUiBNb2RlLlxuKiBAY29uc3RydWN0b3JcbiogQHBhcmFtIHtPYmplY3R9IF9wcmYgVGhlIGFlcyBpbnN0YW5jZSB0byBnZW5lcmF0ZSBrZXkuXG4qIEBwYXJhbSB7Yml0QXJyYXl9IF9pdiBUaGUgaXYgZm9yIGN0ciBtb2RlLCBpdCBtdXN0IGJlIDEyOCBiaXRzLlxuKi9cblxuY29uc3QgbW9kZSA9IHt9O1xuXG4vKipcbiAqIEJyaWFuIEdsYWRtYW4ncyBDVFIgTW9kZS5cbiAqIEBuYW1lc3BhY2VcbiAqL1xubW9kZS5jdHJHbGFkbWFuID0gY2xhc3Mge1xuXHRjb25zdHJ1Y3RvcihwcmYsIGl2KSB7XG5cdFx0dGhpcy5fcHJmID0gcHJmO1xuXHRcdHRoaXMuX2luaXRJdiA9IGl2O1xuXHRcdHRoaXMuX2l2ID0gaXY7XG5cdH1cblxuXHRyZXNldCgpIHtcblx0XHR0aGlzLl9pdiA9IHRoaXMuX2luaXRJdjtcblx0fVxuXG5cdC8qKiBJbnB1dCBzb21lIGRhdGEgdG8gY2FsY3VsYXRlLlxuXHQgKiBAcGFyYW0ge2JpdEFycmF5fSBkYXRhIHRoZSBkYXRhIHRvIHByb2Nlc3MsIGl0IG11c3QgYmUgaW50ZXJncmFsIG11bHRpcGxlIG9mIDEyOCBiaXRzIHVubGVzcyBpdCdzIHRoZSBsYXN0LlxuXHQgKi9cblx0dXBkYXRlKGRhdGEpIHtcblx0XHRyZXR1cm4gdGhpcy5jYWxjdWxhdGUodGhpcy5fcHJmLCBkYXRhLCB0aGlzLl9pdik7XG5cdH1cblxuXHRpbmNXb3JkKHdvcmQpIHtcblx0XHRpZiAoKCh3b3JkID4+IDI0KSAmIDB4ZmYpID09PSAweGZmKSB7IC8vb3ZlcmZsb3dcblx0XHRcdGxldCBiMSA9ICh3b3JkID4+IDE2KSAmIDB4ZmY7XG5cdFx0XHRsZXQgYjIgPSAod29yZCA+PiA4KSAmIDB4ZmY7XG5cdFx0XHRsZXQgYjMgPSB3b3JkICYgMHhmZjtcblxuXHRcdFx0aWYgKGIxID09PSAweGZmKSB7IC8vIG92ZXJmbG93IGIxICAgXG5cdFx0XHRcdGIxID0gMDtcblx0XHRcdFx0aWYgKGIyID09PSAweGZmKSB7XG5cdFx0XHRcdFx0YjIgPSAwO1xuXHRcdFx0XHRcdGlmIChiMyA9PT0gMHhmZikge1xuXHRcdFx0XHRcdFx0YjMgPSAwO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHQrK2IzO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQrK2IyO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQrK2IxO1xuXHRcdFx0fVxuXG5cdFx0XHR3b3JkID0gMDtcblx0XHRcdHdvcmQgKz0gKGIxIDw8IDE2KTtcblx0XHRcdHdvcmQgKz0gKGIyIDw8IDgpO1xuXHRcdFx0d29yZCArPSBiMztcblx0XHR9IGVsc2Uge1xuXHRcdFx0d29yZCArPSAoMHgwMSA8PCAyNCk7XG5cdFx0fVxuXHRcdHJldHVybiB3b3JkO1xuXHR9XG5cblx0aW5jQ291bnRlcihjb3VudGVyKSB7XG5cdFx0aWYgKChjb3VudGVyWzBdID0gdGhpcy5pbmNXb3JkKGNvdW50ZXJbMF0pKSA9PT0gMCkge1xuXHRcdFx0Ly8gZW5jcl9kYXRhIGluIGZpbGVlbmMuYyBmcm9tICBEciBCcmlhbiBHbGFkbWFuJ3MgY291bnRzIG9ubHkgd2l0aCBEV09SRCBqIDwgOFxuXHRcdFx0Y291bnRlclsxXSA9IHRoaXMuaW5jV29yZChjb3VudGVyWzFdKTtcblx0XHR9XG5cdH1cblxuXHRjYWxjdWxhdGUocHJmLCBkYXRhLCBpdikge1xuXHRcdGxldCBsO1xuXHRcdGlmICghKGwgPSBkYXRhLmxlbmd0aCkpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Y29uc3QgYmwgPSBiaXRBcnJheS5iaXRMZW5ndGgoZGF0YSk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsOyBpICs9IDQpIHtcblx0XHRcdHRoaXMuaW5jQ291bnRlcihpdik7XG5cdFx0XHRjb25zdCBlID0gcHJmLmVuY3J5cHQoaXYpO1xuXHRcdFx0ZGF0YVtpXSBePSBlWzBdO1xuXHRcdFx0ZGF0YVtpICsgMV0gXj0gZVsxXTtcblx0XHRcdGRhdGFbaSArIDJdIF49IGVbMl07XG5cdFx0XHRkYXRhW2kgKyAzXSBePSBlWzNdO1xuXHRcdH1cblx0XHRyZXR1cm4gYml0QXJyYXkuY2xhbXAoZGF0YSwgYmwpO1xuXHR9XG59O1xuXG5jb25zdCBtaXNjID0ge1xuXHRpbXBvcnRLZXkocGFzc3dvcmQpIHtcblx0XHRyZXR1cm4gbmV3IG1pc2MuaG1hY1NoYTEoY29kZWMuYnl0ZXMudG9CaXRzKHBhc3N3b3JkKSk7XG5cdH0sXG5cdHBia2RmMihwcmYsIHNhbHQsIGNvdW50LCBsZW5ndGgpIHtcblx0XHRjb3VudCA9IGNvdW50IHx8IDEwMDAwO1xuXHRcdGlmIChsZW5ndGggPCAwIHx8IGNvdW50IDwgMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiaW52YWxpZCBwYXJhbXMgdG8gcGJrZGYyXCIpO1xuXHRcdH1cblx0XHRjb25zdCBieXRlTGVuZ3RoID0gKChsZW5ndGggPj4gNSkgKyAxKSA8PCAyO1xuXHRcdGxldCB1LCB1aSwgaSwgaiwgaztcblx0XHRjb25zdCBhcnJheUJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcihieXRlTGVuZ3RoKTtcblx0XHRjb25zdCBvdXQgPSBuZXcgRGF0YVZpZXcoYXJyYXlCdWZmZXIpO1xuXHRcdGxldCBvdXRMZW5ndGggPSAwO1xuXHRcdGNvbnN0IGIgPSBiaXRBcnJheTtcblx0XHRzYWx0ID0gY29kZWMuYnl0ZXMudG9CaXRzKHNhbHQpO1xuXHRcdGZvciAoayA9IDE7IG91dExlbmd0aCA8IChieXRlTGVuZ3RoIHx8IDEpOyBrKyspIHtcblx0XHRcdHUgPSB1aSA9IHByZi5lbmNyeXB0KGIuY29uY2F0KHNhbHQsIFtrXSkpO1xuXHRcdFx0Zm9yIChpID0gMTsgaSA8IGNvdW50OyBpKyspIHtcblx0XHRcdFx0dWkgPSBwcmYuZW5jcnlwdCh1aSk7XG5cdFx0XHRcdGZvciAoaiA9IDA7IGogPCB1aS5sZW5ndGg7IGorKykge1xuXHRcdFx0XHRcdHVbal0gXj0gdWlbal07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGZvciAoaSA9IDA7IG91dExlbmd0aCA8IChieXRlTGVuZ3RoIHx8IDEpICYmIGkgPCB1Lmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdG91dC5zZXRJbnQzMihvdXRMZW5ndGgsIHVbaV0pO1xuXHRcdFx0XHRvdXRMZW5ndGggKz0gNDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGFycmF5QnVmZmVyLnNsaWNlKDAsIGxlbmd0aCAvIDgpO1xuXHR9XG59O1xuXG4vKiogQGZpbGVPdmVydmlldyBITUFDIGltcGxlbWVudGF0aW9uLlxuICpcbiAqIEBhdXRob3IgRW1pbHkgU3RhcmtcbiAqIEBhdXRob3IgTWlrZSBIYW1idXJnXG4gKiBAYXV0aG9yIERhbiBCb25laFxuICovXG5cbi8qKiBITUFDIHdpdGggdGhlIHNwZWNpZmllZCBoYXNoIGZ1bmN0aW9uLlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge2JpdEFycmF5fSBrZXkgdGhlIGtleSBmb3IgSE1BQy5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbSGFzaD1oYXNoLnNoYTFdIFRoZSBoYXNoIGZ1bmN0aW9uIHRvIHVzZS5cbiAqL1xubWlzYy5obWFjU2hhMSA9IGNsYXNzIHtcblxuXHRjb25zdHJ1Y3RvcihrZXkpIHtcblx0XHRjb25zdCBobWFjID0gdGhpcztcblx0XHRjb25zdCBIYXNoID0gaG1hYy5faGFzaCA9IGhhc2guc2hhMTtcblx0XHRjb25zdCBleEtleSA9IFtbXSwgW11dO1xuXHRcdGhtYWMuX2Jhc2VIYXNoID0gW25ldyBIYXNoKCksIG5ldyBIYXNoKCldO1xuXHRcdGNvbnN0IGJzID0gaG1hYy5fYmFzZUhhc2hbMF0uYmxvY2tTaXplIC8gMzI7XG5cblx0XHRpZiAoa2V5Lmxlbmd0aCA+IGJzKSB7XG5cdFx0XHRrZXkgPSBuZXcgSGFzaCgpLnVwZGF0ZShrZXkpLmZpbmFsaXplKCk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBiczsgaSsrKSB7XG5cdFx0XHRleEtleVswXVtpXSA9IGtleVtpXSBeIDB4MzYzNjM2MzY7XG5cdFx0XHRleEtleVsxXVtpXSA9IGtleVtpXSBeIDB4NUM1QzVDNUM7XG5cdFx0fVxuXG5cdFx0aG1hYy5fYmFzZUhhc2hbMF0udXBkYXRlKGV4S2V5WzBdKTtcblx0XHRobWFjLl9iYXNlSGFzaFsxXS51cGRhdGUoZXhLZXlbMV0pO1xuXHRcdGhtYWMuX3Jlc3VsdEhhc2ggPSBuZXcgSGFzaChobWFjLl9iYXNlSGFzaFswXSk7XG5cdH1cblx0cmVzZXQoKSB7XG5cdFx0Y29uc3QgaG1hYyA9IHRoaXM7XG5cdFx0aG1hYy5fcmVzdWx0SGFzaCA9IG5ldyBobWFjLl9oYXNoKGhtYWMuX2Jhc2VIYXNoWzBdKTtcblx0XHRobWFjLl91cGRhdGVkID0gZmFsc2U7XG5cdH1cblxuXHR1cGRhdGUoZGF0YSkge1xuXHRcdGNvbnN0IGhtYWMgPSB0aGlzO1xuXHRcdGhtYWMuX3VwZGF0ZWQgPSB0cnVlO1xuXHRcdGhtYWMuX3Jlc3VsdEhhc2gudXBkYXRlKGRhdGEpO1xuXHR9XG5cblx0ZGlnZXN0KCkge1xuXHRcdGNvbnN0IGhtYWMgPSB0aGlzO1xuXHRcdGNvbnN0IHcgPSBobWFjLl9yZXN1bHRIYXNoLmZpbmFsaXplKCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IChobWFjLl9oYXNoKShobWFjLl9iYXNlSGFzaFsxXSkudXBkYXRlKHcpLmZpbmFsaXplKCk7XG5cblx0XHRobWFjLnJlc2V0KCk7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZW5jcnlwdChkYXRhKSB7XG5cdFx0aWYgKCF0aGlzLl91cGRhdGVkKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZShkYXRhKTtcblx0XHRcdHJldHVybiB0aGlzLmRpZ2VzdChkYXRhKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKFwiZW5jcnlwdCBvbiBhbHJlYWR5IHVwZGF0ZWQgaG1hYyBjYWxsZWQhXCIpO1xuXHRcdH1cblx0fVxufTtcblxuZXhwb3J0IHtcblx0Y2lwaGVyLFxuXHRjb2RlYyxcblx0bWlzYyxcblx0bW9kZSxcblx0cmFuZG9tXG59OyIsIi8qXG4gQ29weXJpZ2h0IChjKSAyMDIyIEdpbGRhcyBMb3JtZWF1LiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXG4gUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cbiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cblxuIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IFxuIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiBcbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cblxuIDMuIFRoZSBuYW1lcyBvZiB0aGUgYXV0aG9ycyBtYXkgbm90IGJlIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzXG4gZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG5cbiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEICcnQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1NFRCBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsXG4gSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORFxuIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBKQ1JBRlQsXG4gSU5DLiBPUiBBTlkgQ09OVFJJQlVUT1JTIFRPIFRISVMgU09GVFdBUkUgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCxcbiBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UXG4gTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsXG4gT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRlxuIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HXG4gTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLFxuIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cblxuLyogZ2xvYmFsIGNyeXB0byAqL1xuXG5pbXBvcnQge1xuXHRyYW5kb21cbn0gZnJvbSBcIi4vY29kZWNzL3NqY2wuanNcIjtcblxuY29uc3QgR0VUX1JBTkRPTV9WQUxVRVNfU1VQUE9SVEVEID0gdHlwZW9mIGNyeXB0byAhPSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBjcnlwdG8uZ2V0UmFuZG9tVmFsdWVzID09IFwiZnVuY3Rpb25cIjtcblxuY29uc3QgRVJSX0lOVkFMSURfUEFTU1dPUkQgPSBcIkludmFsaWQgcGFzc3dvcmRcIjtcbmNvbnN0IEVSUl9JTlZBTElEX1NJR05BVFVSRSA9IFwiSW52YWxpZCBzaWduYXR1cmVcIjtcbmNvbnN0IEVSUl9BQk9SVF9DSEVDS19QQVNTV09SRCA9IFwiemlwanMtYWJvcnQtY2hlY2stcGFzc3dvcmRcIjtcblxuZXhwb3J0IHtcblx0Z2V0UmFuZG9tVmFsdWVzLFxuXHRFUlJfSU5WQUxJRF9QQVNTV09SRCxcblx0RVJSX0lOVkFMSURfU0lHTkFUVVJFLFxuXHRFUlJfQUJPUlRfQ0hFQ0tfUEFTU1dPUkRcbn07XG5cbmZ1bmN0aW9uIGdldFJhbmRvbVZhbHVlcyhhcnJheSkge1xuXHRpZiAoR0VUX1JBTkRPTV9WQUxVRVNfU1VQUE9SVEVEKSB7XG5cdFx0cmV0dXJuIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMoYXJyYXkpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiByYW5kb20uZ2V0UmFuZG9tVmFsdWVzKGFycmF5KTtcblx0fVxufSIsIi8qXG4gQ29weXJpZ2h0IChjKSAyMDIyIEdpbGRhcyBMb3JtZWF1LiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXG4gUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cbiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cblxuIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IFxuIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiBcbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cblxuIDMuIFRoZSBuYW1lcyBvZiB0aGUgYXV0aG9ycyBtYXkgbm90IGJlIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzXG4gZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG5cbiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEICcnQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1NFRCBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsXG4gSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORFxuIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBKQ1JBRlQsXG4gSU5DLiBPUiBBTlkgQ09OVFJJQlVUT1JTIFRPIFRISVMgU09GVFdBUkUgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCxcbiBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UXG4gTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsXG4gT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRlxuIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HXG4gTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLFxuIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cblxuLyogZ2xvYmFsIGNyeXB0bywgVHJhbnNmb3JtU3RyZWFtICovXG4vLyBkZW5vLWxpbnQtaWdub3JlLWZpbGUgbm8tdGhpcy1hbGlhc1xuXG5pbXBvcnQgeyBlbmNvZGVUZXh0IH0gZnJvbSBcIi4vLi4vdXRpbC9lbmNvZGUtdGV4dC5qc1wiO1xuaW1wb3J0IHtcblx0Y2lwaGVyLFxuXHRjb2RlYyxcblx0bWlzYyxcblx0bW9kZVxufSBmcm9tIFwiLi9jb2RlY3Mvc2pjbC5qc1wiO1xuaW1wb3J0IHtcblx0RVJSX0lOVkFMSURfUEFTU1dPUkQsXG5cdEVSUl9JTlZBTElEX1NJR05BVFVSRSxcblx0RVJSX0FCT1JUX0NIRUNLX1BBU1NXT1JELFxuXHRnZXRSYW5kb21WYWx1ZXNcbn0gZnJvbSBcIi4vY29tbW9uLWNyeXB0by5qc1wiO1xuXG5jb25zdCBCTE9DS19MRU5HVEggPSAxNjtcbmNvbnN0IFJBV19GT1JNQVQgPSBcInJhd1wiO1xuY29uc3QgUEJLREYyX0FMR09SSVRITSA9IHsgbmFtZTogXCJQQktERjJcIiB9O1xuY29uc3QgSEFTSF9BTEdPUklUSE0gPSB7IG5hbWU6IFwiSE1BQ1wiIH07XG5jb25zdCBIQVNIX0ZVTkNUSU9OID0gXCJTSEEtMVwiO1xuY29uc3QgQkFTRV9LRVlfQUxHT1JJVEhNID0gT2JqZWN0LmFzc2lnbih7IGhhc2g6IEhBU0hfQUxHT1JJVEhNIH0sIFBCS0RGMl9BTEdPUklUSE0pO1xuY29uc3QgREVSSVZFRF9CSVRTX0FMR09SSVRITSA9IE9iamVjdC5hc3NpZ24oeyBpdGVyYXRpb25zOiAxMDAwLCBoYXNoOiB7IG5hbWU6IEhBU0hfRlVOQ1RJT04gfSB9LCBQQktERjJfQUxHT1JJVEhNKTtcbmNvbnN0IERFUklWRURfQklUU19VU0FHRSA9IFtcImRlcml2ZUJpdHNcIl07XG5jb25zdCBTQUxUX0xFTkdUSCA9IFs4LCAxMiwgMTZdO1xuY29uc3QgS0VZX0xFTkdUSCA9IFsxNiwgMjQsIDMyXTtcbmNvbnN0IFNJR05BVFVSRV9MRU5HVEggPSAxMDtcbmNvbnN0IENPVU5URVJfREVGQVVMVF9WQUxVRSA9IFswLCAwLCAwLCAwXTtcbmNvbnN0IFVOREVGSU5FRF9UWVBFID0gXCJ1bmRlZmluZWRcIjtcbmNvbnN0IEZVTkNUSU9OX1RZUEUgPSBcImZ1bmN0aW9uXCI7XG4vLyBkZW5vLWxpbnQtaWdub3JlIHZhbGlkLXR5cGVvZlxuY29uc3QgQ1JZUFRPX0FQSV9TVVBQT1JURUQgPSB0eXBlb2YgY3J5cHRvICE9IFVOREVGSU5FRF9UWVBFO1xuY29uc3Qgc3VidGxlID0gQ1JZUFRPX0FQSV9TVVBQT1JURUQgJiYgY3J5cHRvLnN1YnRsZTtcbmNvbnN0IFNVQlRMRV9BUElfU1VQUE9SVEVEID0gQ1JZUFRPX0FQSV9TVVBQT1JURUQgJiYgdHlwZW9mIHN1YnRsZSAhPSBVTkRFRklORURfVFlQRTtcbmNvbnN0IGNvZGVjQnl0ZXMgPSBjb2RlYy5ieXRlcztcbmNvbnN0IEFlcyA9IGNpcGhlci5hZXM7XG5jb25zdCBDdHJHbGFkbWFuID0gbW9kZS5jdHJHbGFkbWFuO1xuY29uc3QgSG1hY1NoYTEgPSBtaXNjLmhtYWNTaGExO1xuXG5sZXQgSU1QT1JUX0tFWV9TVVBQT1JURUQgPSBDUllQVE9fQVBJX1NVUFBPUlRFRCAmJiBTVUJUTEVfQVBJX1NVUFBPUlRFRCAmJiB0eXBlb2Ygc3VidGxlLmltcG9ydEtleSA9PSBGVU5DVElPTl9UWVBFO1xubGV0IERFUklWRV9CSVRTX1NVUFBPUlRFRCA9IENSWVBUT19BUElfU1VQUE9SVEVEICYmIFNVQlRMRV9BUElfU1VQUE9SVEVEICYmIHR5cGVvZiBzdWJ0bGUuZGVyaXZlQml0cyA9PSBGVU5DVElPTl9UWVBFO1xuXG5jbGFzcyBBRVNEZWNyeXB0aW9uU3RyZWFtIGV4dGVuZHMgVHJhbnNmb3JtU3RyZWFtIHtcblxuXHRjb25zdHJ1Y3Rvcih7IHBhc3N3b3JkLCBzaWduZWQsIGVuY3J5cHRpb25TdHJlbmd0aCwgY2hlY2tQYXNzd29yZE9ubHkgfSkge1xuXHRcdHN1cGVyKHtcblx0XHRcdHN0YXJ0KCkge1xuXHRcdFx0XHRPYmplY3QuYXNzaWduKHRoaXMsIHtcblx0XHRcdFx0XHRyZWFkeTogbmV3IFByb21pc2UocmVzb2x2ZSA9PiB0aGlzLnJlc29sdmVSZWFkeSA9IHJlc29sdmUpLFxuXHRcdFx0XHRcdHBhc3N3b3JkLFxuXHRcdFx0XHRcdHNpZ25lZCxcblx0XHRcdFx0XHRzdHJlbmd0aDogZW5jcnlwdGlvblN0cmVuZ3RoIC0gMSxcblx0XHRcdFx0XHRwZW5kaW5nOiBuZXcgVWludDhBcnJheSgpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIHRyYW5zZm9ybShjaHVuaywgY29udHJvbGxlcikge1xuXHRcdFx0XHRjb25zdCBhZXNDcnlwdG8gPSB0aGlzO1xuXHRcdFx0XHRjb25zdCB7XG5cdFx0XHRcdFx0cGFzc3dvcmQsXG5cdFx0XHRcdFx0c3RyZW5ndGgsXG5cdFx0XHRcdFx0cmVzb2x2ZVJlYWR5LFxuXHRcdFx0XHRcdHJlYWR5XG5cdFx0XHRcdH0gPSBhZXNDcnlwdG87XG5cdFx0XHRcdGlmIChwYXNzd29yZCkge1xuXHRcdFx0XHRcdGF3YWl0IGNyZWF0ZURlY3J5cHRpb25LZXlzKGFlc0NyeXB0bywgc3RyZW5ndGgsIHBhc3N3b3JkLCBzdWJhcnJheShjaHVuaywgMCwgU0FMVF9MRU5HVEhbc3RyZW5ndGhdICsgMikpO1xuXHRcdFx0XHRcdGNodW5rID0gc3ViYXJyYXkoY2h1bmssIFNBTFRfTEVOR1RIW3N0cmVuZ3RoXSArIDIpO1xuXHRcdFx0XHRcdGlmIChjaGVja1Bhc3N3b3JkT25seSkge1xuXHRcdFx0XHRcdFx0Y29udHJvbGxlci5lcnJvcihuZXcgRXJyb3IoRVJSX0FCT1JUX0NIRUNLX1BBU1NXT1JEKSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJlc29sdmVSZWFkeSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhd2FpdCByZWFkeTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBvdXRwdXQgPSBuZXcgVWludDhBcnJheShjaHVuay5sZW5ndGggLSBTSUdOQVRVUkVfTEVOR1RIIC0gKChjaHVuay5sZW5ndGggLSBTSUdOQVRVUkVfTEVOR1RIKSAlIEJMT0NLX0xFTkdUSCkpO1xuXHRcdFx0XHRjb250cm9sbGVyLmVucXVldWUoYXBwZW5kKGFlc0NyeXB0bywgY2h1bmssIG91dHB1dCwgMCwgU0lHTkFUVVJFX0xFTkdUSCwgdHJ1ZSkpO1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIGZsdXNoKGNvbnRyb2xsZXIpIHtcblx0XHRcdFx0Y29uc3Qge1xuXHRcdFx0XHRcdHNpZ25lZCxcblx0XHRcdFx0XHRjdHIsXG5cdFx0XHRcdFx0aG1hYyxcblx0XHRcdFx0XHRwZW5kaW5nLFxuXHRcdFx0XHRcdHJlYWR5XG5cdFx0XHRcdH0gPSB0aGlzO1xuXHRcdFx0XHRpZiAoaG1hYyAmJiBjdHIpIHtcblx0XHRcdFx0XHRhd2FpdCByZWFkeTtcblx0XHRcdFx0XHRjb25zdCBjaHVua1RvRGVjcnlwdCA9IHN1YmFycmF5KHBlbmRpbmcsIDAsIHBlbmRpbmcubGVuZ3RoIC0gU0lHTkFUVVJFX0xFTkdUSCk7XG5cdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxTaWduYXR1cmUgPSBzdWJhcnJheShwZW5kaW5nLCBwZW5kaW5nLmxlbmd0aCAtIFNJR05BVFVSRV9MRU5HVEgpO1xuXHRcdFx0XHRcdGxldCBkZWNyeXB0ZWRDaHVua0FycmF5ID0gbmV3IFVpbnQ4QXJyYXkoKTtcblx0XHRcdFx0XHRpZiAoY2h1bmtUb0RlY3J5cHQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBlbmNyeXB0ZWRDaHVuayA9IHRvQml0cyhjb2RlY0J5dGVzLCBjaHVua1RvRGVjcnlwdCk7XG5cdFx0XHRcdFx0XHRobWFjLnVwZGF0ZShlbmNyeXB0ZWRDaHVuayk7XG5cdFx0XHRcdFx0XHRjb25zdCBkZWNyeXB0ZWRDaHVuayA9IGN0ci51cGRhdGUoZW5jcnlwdGVkQ2h1bmspO1xuXHRcdFx0XHRcdFx0ZGVjcnlwdGVkQ2h1bmtBcnJheSA9IGZyb21CaXRzKGNvZGVjQnl0ZXMsIGRlY3J5cHRlZENodW5rKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHNpZ25lZCkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2lnbmF0dXJlID0gc3ViYXJyYXkoZnJvbUJpdHMoY29kZWNCeXRlcywgaG1hYy5kaWdlc3QoKSksIDAsIFNJR05BVFVSRV9MRU5HVEgpO1xuXHRcdFx0XHRcdFx0Zm9yIChsZXQgaW5kZXhTaWduYXR1cmUgPSAwOyBpbmRleFNpZ25hdHVyZSA8IFNJR05BVFVSRV9MRU5HVEg7IGluZGV4U2lnbmF0dXJlKyspIHtcblx0XHRcdFx0XHRcdFx0aWYgKHNpZ25hdHVyZVtpbmRleFNpZ25hdHVyZV0gIT0gb3JpZ2luYWxTaWduYXR1cmVbaW5kZXhTaWduYXR1cmVdKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKEVSUl9JTlZBTElEX1NJR05BVFVSRSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29udHJvbGxlci5lbnF1ZXVlKGRlY3J5cHRlZENodW5rQXJyYXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgQUVTRW5jcnlwdGlvblN0cmVhbSBleHRlbmRzIFRyYW5zZm9ybVN0cmVhbSB7XG5cblx0Y29uc3RydWN0b3IoeyBwYXNzd29yZCwgZW5jcnlwdGlvblN0cmVuZ3RoIH0pIHtcblx0XHQvLyBkZW5vLWxpbnQtaWdub3JlIHByZWZlci1jb25zdFxuXHRcdGxldCBzdHJlYW07XG5cdFx0c3VwZXIoe1xuXHRcdFx0c3RhcnQoKSB7XG5cdFx0XHRcdE9iamVjdC5hc3NpZ24odGhpcywge1xuXHRcdFx0XHRcdHJlYWR5OiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHRoaXMucmVzb2x2ZVJlYWR5ID0gcmVzb2x2ZSksXG5cdFx0XHRcdFx0cGFzc3dvcmQsXG5cdFx0XHRcdFx0c3RyZW5ndGg6IGVuY3J5cHRpb25TdHJlbmd0aCAtIDEsXG5cdFx0XHRcdFx0cGVuZGluZzogbmV3IFVpbnQ4QXJyYXkoKVxuXHRcdFx0XHR9KTtcblx0XHRcdH0sXG5cdFx0XHRhc3luYyB0cmFuc2Zvcm0oY2h1bmssIGNvbnRyb2xsZXIpIHtcblx0XHRcdFx0Y29uc3QgYWVzQ3J5cHRvID0gdGhpcztcblx0XHRcdFx0Y29uc3Qge1xuXHRcdFx0XHRcdHBhc3N3b3JkLFxuXHRcdFx0XHRcdHN0cmVuZ3RoLFxuXHRcdFx0XHRcdHJlc29sdmVSZWFkeSxcblx0XHRcdFx0XHRyZWFkeVxuXHRcdFx0XHR9ID0gYWVzQ3J5cHRvO1xuXHRcdFx0XHRsZXQgcHJlYW1ibGUgPSBuZXcgVWludDhBcnJheSgpO1xuXHRcdFx0XHRpZiAocGFzc3dvcmQpIHtcblx0XHRcdFx0XHRwcmVhbWJsZSA9IGF3YWl0IGNyZWF0ZUVuY3J5cHRpb25LZXlzKGFlc0NyeXB0bywgc3RyZW5ndGgsIHBhc3N3b3JkKTtcblx0XHRcdFx0XHRyZXNvbHZlUmVhZHkoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhd2FpdCByZWFkeTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBvdXRwdXQgPSBuZXcgVWludDhBcnJheShwcmVhbWJsZS5sZW5ndGggKyBjaHVuay5sZW5ndGggLSAoY2h1bmsubGVuZ3RoICUgQkxPQ0tfTEVOR1RIKSk7XG5cdFx0XHRcdG91dHB1dC5zZXQocHJlYW1ibGUsIDApO1xuXHRcdFx0XHRjb250cm9sbGVyLmVucXVldWUoYXBwZW5kKGFlc0NyeXB0bywgY2h1bmssIG91dHB1dCwgcHJlYW1ibGUubGVuZ3RoLCAwKSk7XG5cdFx0XHR9LFxuXHRcdFx0YXN5bmMgZmx1c2goY29udHJvbGxlcikge1xuXHRcdFx0XHRjb25zdCB7XG5cdFx0XHRcdFx0Y3RyLFxuXHRcdFx0XHRcdGhtYWMsXG5cdFx0XHRcdFx0cGVuZGluZyxcblx0XHRcdFx0XHRyZWFkeVxuXHRcdFx0XHR9ID0gdGhpcztcblx0XHRcdFx0aWYgKGhtYWMgJiYgY3RyKSB7XG5cdFx0XHRcdFx0YXdhaXQgcmVhZHk7XG5cdFx0XHRcdFx0bGV0IGVuY3J5cHRlZENodW5rQXJyYXkgPSBuZXcgVWludDhBcnJheSgpO1xuXHRcdFx0XHRcdGlmIChwZW5kaW5nLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZW5jcnlwdGVkQ2h1bmsgPSBjdHIudXBkYXRlKHRvQml0cyhjb2RlY0J5dGVzLCBwZW5kaW5nKSk7XG5cdFx0XHRcdFx0XHRobWFjLnVwZGF0ZShlbmNyeXB0ZWRDaHVuayk7XG5cdFx0XHRcdFx0XHRlbmNyeXB0ZWRDaHVua0FycmF5ID0gZnJvbUJpdHMoY29kZWNCeXRlcywgZW5jcnlwdGVkQ2h1bmspO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzdHJlYW0uc2lnbmF0dXJlID0gZnJvbUJpdHMoY29kZWNCeXRlcywgaG1hYy5kaWdlc3QoKSkuc2xpY2UoMCwgU0lHTkFUVVJFX0xFTkdUSCk7XG5cdFx0XHRcdFx0Y29udHJvbGxlci5lbnF1ZXVlKGNvbmNhdChlbmNyeXB0ZWRDaHVua0FycmF5LCBzdHJlYW0uc2lnbmF0dXJlKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRzdHJlYW0gPSB0aGlzO1xuXHR9XG59XG5cbmV4cG9ydCB7XG5cdEFFU0RlY3J5cHRpb25TdHJlYW0sXG5cdEFFU0VuY3J5cHRpb25TdHJlYW0sXG5cdEVSUl9JTlZBTElEX1BBU1NXT1JEXG59O1xuXG5mdW5jdGlvbiBhcHBlbmQoYWVzQ3J5cHRvLCBpbnB1dCwgb3V0cHV0LCBwYWRkaW5nU3RhcnQsIHBhZGRpbmdFbmQsIHZlcmlmeVNpZ25hdHVyZSkge1xuXHRjb25zdCB7XG5cdFx0Y3RyLFxuXHRcdGhtYWMsXG5cdFx0cGVuZGluZ1xuXHR9ID0gYWVzQ3J5cHRvO1xuXHRjb25zdCBpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aCAtIHBhZGRpbmdFbmQ7XG5cdGlmIChwZW5kaW5nLmxlbmd0aCkge1xuXHRcdGlucHV0ID0gY29uY2F0KHBlbmRpbmcsIGlucHV0KTtcblx0XHRvdXRwdXQgPSBleHBhbmQob3V0cHV0LCBpbnB1dExlbmd0aCAtIChpbnB1dExlbmd0aCAlIEJMT0NLX0xFTkdUSCkpO1xuXHR9XG5cdGxldCBvZmZzZXQ7XG5cdGZvciAob2Zmc2V0ID0gMDsgb2Zmc2V0IDw9IGlucHV0TGVuZ3RoIC0gQkxPQ0tfTEVOR1RIOyBvZmZzZXQgKz0gQkxPQ0tfTEVOR1RIKSB7XG5cdFx0Y29uc3QgaW5wdXRDaHVuayA9IHRvQml0cyhjb2RlY0J5dGVzLCBzdWJhcnJheShpbnB1dCwgb2Zmc2V0LCBvZmZzZXQgKyBCTE9DS19MRU5HVEgpKTtcblx0XHRpZiAodmVyaWZ5U2lnbmF0dXJlKSB7XG5cdFx0XHRobWFjLnVwZGF0ZShpbnB1dENodW5rKTtcblx0XHR9XG5cdFx0Y29uc3Qgb3V0cHV0Q2h1bmsgPSBjdHIudXBkYXRlKGlucHV0Q2h1bmspO1xuXHRcdGlmICghdmVyaWZ5U2lnbmF0dXJlKSB7XG5cdFx0XHRobWFjLnVwZGF0ZShvdXRwdXRDaHVuayk7XG5cdFx0fVxuXHRcdG91dHB1dC5zZXQoZnJvbUJpdHMoY29kZWNCeXRlcywgb3V0cHV0Q2h1bmspLCBvZmZzZXQgKyBwYWRkaW5nU3RhcnQpO1xuXHR9XG5cdGFlc0NyeXB0by5wZW5kaW5nID0gc3ViYXJyYXkoaW5wdXQsIG9mZnNldCk7XG5cdHJldHVybiBvdXRwdXQ7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZURlY3J5cHRpb25LZXlzKGRlY3J5cHQsIHN0cmVuZ3RoLCBwYXNzd29yZCwgcHJlYW1ibGUpIHtcblx0Y29uc3QgcGFzc3dvcmRWZXJpZmljYXRpb25LZXkgPSBhd2FpdCBjcmVhdGVLZXlzKGRlY3J5cHQsIHN0cmVuZ3RoLCBwYXNzd29yZCwgc3ViYXJyYXkocHJlYW1ibGUsIDAsIFNBTFRfTEVOR1RIW3N0cmVuZ3RoXSkpO1xuXHRjb25zdCBwYXNzd29yZFZlcmlmaWNhdGlvbiA9IHN1YmFycmF5KHByZWFtYmxlLCBTQUxUX0xFTkdUSFtzdHJlbmd0aF0pO1xuXHRpZiAocGFzc3dvcmRWZXJpZmljYXRpb25LZXlbMF0gIT0gcGFzc3dvcmRWZXJpZmljYXRpb25bMF0gfHwgcGFzc3dvcmRWZXJpZmljYXRpb25LZXlbMV0gIT0gcGFzc3dvcmRWZXJpZmljYXRpb25bMV0pIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoRVJSX0lOVkFMSURfUEFTU1dPUkQpO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUVuY3J5cHRpb25LZXlzKGVuY3J5cHQsIHN0cmVuZ3RoLCBwYXNzd29yZCkge1xuXHRjb25zdCBzYWx0ID0gZ2V0UmFuZG9tVmFsdWVzKG5ldyBVaW50OEFycmF5KFNBTFRfTEVOR1RIW3N0cmVuZ3RoXSkpO1xuXHRjb25zdCBwYXNzd29yZFZlcmlmaWNhdGlvbiA9IGF3YWl0IGNyZWF0ZUtleXMoZW5jcnlwdCwgc3RyZW5ndGgsIHBhc3N3b3JkLCBzYWx0KTtcblx0cmV0dXJuIGNvbmNhdChzYWx0LCBwYXNzd29yZFZlcmlmaWNhdGlvbik7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUtleXMoYWVzQ3J5cHRvLCBzdHJlbmd0aCwgcGFzc3dvcmQsIHNhbHQpIHtcblx0YWVzQ3J5cHRvLnBhc3N3b3JkID0gbnVsbDtcblx0Y29uc3QgZW5jb2RlZFBhc3N3b3JkID0gZW5jb2RlVGV4dChwYXNzd29yZCk7XG5cdGNvbnN0IGJhc2VLZXkgPSBhd2FpdCBpbXBvcnRLZXkoUkFXX0ZPUk1BVCwgZW5jb2RlZFBhc3N3b3JkLCBCQVNFX0tFWV9BTEdPUklUSE0sIGZhbHNlLCBERVJJVkVEX0JJVFNfVVNBR0UpO1xuXHRjb25zdCBkZXJpdmVkQml0cyA9IGF3YWl0IGRlcml2ZUJpdHMoT2JqZWN0LmFzc2lnbih7IHNhbHQgfSwgREVSSVZFRF9CSVRTX0FMR09SSVRITSksIGJhc2VLZXksIDggKiAoKEtFWV9MRU5HVEhbc3RyZW5ndGhdICogMikgKyAyKSk7XG5cdGNvbnN0IGNvbXBvc2l0ZUtleSA9IG5ldyBVaW50OEFycmF5KGRlcml2ZWRCaXRzKTtcblx0Y29uc3Qga2V5ID0gdG9CaXRzKGNvZGVjQnl0ZXMsIHN1YmFycmF5KGNvbXBvc2l0ZUtleSwgMCwgS0VZX0xFTkdUSFtzdHJlbmd0aF0pKTtcblx0Y29uc3QgYXV0aGVudGljYXRpb24gPSB0b0JpdHMoY29kZWNCeXRlcywgc3ViYXJyYXkoY29tcG9zaXRlS2V5LCBLRVlfTEVOR1RIW3N0cmVuZ3RoXSwgS0VZX0xFTkdUSFtzdHJlbmd0aF0gKiAyKSk7XG5cdGNvbnN0IHBhc3N3b3JkVmVyaWZpY2F0aW9uID0gc3ViYXJyYXkoY29tcG9zaXRlS2V5LCBLRVlfTEVOR1RIW3N0cmVuZ3RoXSAqIDIpO1xuXHRPYmplY3QuYXNzaWduKGFlc0NyeXB0bywge1xuXHRcdGtleXM6IHtcblx0XHRcdGtleSxcblx0XHRcdGF1dGhlbnRpY2F0aW9uLFxuXHRcdFx0cGFzc3dvcmRWZXJpZmljYXRpb25cblx0XHR9LFxuXHRcdGN0cjogbmV3IEN0ckdsYWRtYW4obmV3IEFlcyhrZXkpLCBBcnJheS5mcm9tKENPVU5URVJfREVGQVVMVF9WQUxVRSkpLFxuXHRcdGhtYWM6IG5ldyBIbWFjU2hhMShhdXRoZW50aWNhdGlvbilcblx0fSk7XG5cdHJldHVybiBwYXNzd29yZFZlcmlmaWNhdGlvbjtcbn1cblxuYXN5bmMgZnVuY3Rpb24gaW1wb3J0S2V5KGZvcm1hdCwgcGFzc3dvcmQsIGFsZ29yaXRobSwgZXh0cmFjdGFibGUsIGtleVVzYWdlcykge1xuXHRpZiAoSU1QT1JUX0tFWV9TVVBQT1JURUQpIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHN1YnRsZS5pbXBvcnRLZXkoZm9ybWF0LCBwYXNzd29yZCwgYWxnb3JpdGhtLCBleHRyYWN0YWJsZSwga2V5VXNhZ2VzKTtcblx0XHR9IGNhdGNoIChfZXJyb3IpIHtcblx0XHRcdElNUE9SVF9LRVlfU1VQUE9SVEVEID0gZmFsc2U7XG5cdFx0XHRyZXR1cm4gbWlzYy5pbXBvcnRLZXkocGFzc3dvcmQpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gbWlzYy5pbXBvcnRLZXkocGFzc3dvcmQpO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGRlcml2ZUJpdHMoYWxnb3JpdGhtLCBiYXNlS2V5LCBsZW5ndGgpIHtcblx0aWYgKERFUklWRV9CSVRTX1NVUFBPUlRFRCkge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgc3VidGxlLmRlcml2ZUJpdHMoYWxnb3JpdGhtLCBiYXNlS2V5LCBsZW5ndGgpO1xuXHRcdH0gY2F0Y2ggKF9lcnJvcikge1xuXHRcdFx0REVSSVZFX0JJVFNfU1VQUE9SVEVEID0gZmFsc2U7XG5cdFx0XHRyZXR1cm4gbWlzYy5wYmtkZjIoYmFzZUtleSwgYWxnb3JpdGhtLnNhbHQsIERFUklWRURfQklUU19BTEdPUklUSE0uaXRlcmF0aW9ucywgbGVuZ3RoKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIG1pc2MucGJrZGYyKGJhc2VLZXksIGFsZ29yaXRobS5zYWx0LCBERVJJVkVEX0JJVFNfQUxHT1JJVEhNLml0ZXJhdGlvbnMsIGxlbmd0aCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gY29uY2F0KGxlZnRBcnJheSwgcmlnaHRBcnJheSkge1xuXHRsZXQgYXJyYXkgPSBsZWZ0QXJyYXk7XG5cdGlmIChsZWZ0QXJyYXkubGVuZ3RoICsgcmlnaHRBcnJheS5sZW5ndGgpIHtcblx0XHRhcnJheSA9IG5ldyBVaW50OEFycmF5KGxlZnRBcnJheS5sZW5ndGggKyByaWdodEFycmF5Lmxlbmd0aCk7XG5cdFx0YXJyYXkuc2V0KGxlZnRBcnJheSwgMCk7XG5cdFx0YXJyYXkuc2V0KHJpZ2h0QXJyYXksIGxlZnRBcnJheS5sZW5ndGgpO1xuXHR9XG5cdHJldHVybiBhcnJheTtcbn1cblxuZnVuY3Rpb24gZXhwYW5kKGlucHV0QXJyYXksIGxlbmd0aCkge1xuXHRpZiAobGVuZ3RoICYmIGxlbmd0aCA+IGlucHV0QXJyYXkubGVuZ3RoKSB7XG5cdFx0Y29uc3QgYXJyYXkgPSBpbnB1dEFycmF5O1xuXHRcdGlucHV0QXJyYXkgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuXHRcdGlucHV0QXJyYXkuc2V0KGFycmF5LCAwKTtcblx0fVxuXHRyZXR1cm4gaW5wdXRBcnJheTtcbn1cblxuZnVuY3Rpb24gc3ViYXJyYXkoYXJyYXksIGJlZ2luLCBlbmQpIHtcblx0cmV0dXJuIGFycmF5LnN1YmFycmF5KGJlZ2luLCBlbmQpO1xufVxuXG5mdW5jdGlvbiBmcm9tQml0cyhjb2RlY0J5dGVzLCBjaHVuaykge1xuXHRyZXR1cm4gY29kZWNCeXRlcy5mcm9tQml0cyhjaHVuayk7XG59XG5mdW5jdGlvbiB0b0JpdHMoY29kZWNCeXRlcywgY2h1bmspIHtcblx0cmV0dXJuIGNvZGVjQnl0ZXMudG9CaXRzKGNodW5rKTtcbn0iLCIvKlxuIENvcHlyaWdodCAoYykgMjAyMiBHaWxkYXMgTG9ybWVhdS4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG5cbiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBcbiBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gXG4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cbiAzLiBUaGUgbmFtZXMgb2YgdGhlIGF1dGhvcnMgbWF5IG5vdCBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0c1xuIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWMgcHJpb3Igd3JpdHRlbiBwZXJtaXNzaW9uLlxuXG4gVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnJ0FTIElTJycgQU5EIEFOWSBFWFBSRVNTRUQgT1IgSU1QTElFRCBXQVJSQU5USUVTLFxuIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkRcbiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgSkNSQUZULFxuIElOQy4gT1IgQU5ZIENPTlRSSUJVVE9SUyBUTyBUSElTIFNPRlRXQVJFIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsXG4gSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVFxuIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLFxuIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcbiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSxcbiBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5cbi8qIGdsb2JhbCBUcmFuc2Zvcm1TdHJlYW0gKi9cbi8vIGRlbm8tbGludC1pZ25vcmUtZmlsZSBuby10aGlzLWFsaWFzXG5cbmltcG9ydCB7IENyYzMyIH0gZnJvbSBcIi4vY29kZWNzL2NyYzMyLmpzXCI7XG5pbXBvcnQge1xuXHRFUlJfSU5WQUxJRF9QQVNTV09SRCxcblx0RVJSX0FCT1JUX0NIRUNLX1BBU1NXT1JELFxuXHRnZXRSYW5kb21WYWx1ZXNcbn0gZnJvbSBcIi4vY29tbW9uLWNyeXB0by5qc1wiO1xuXG5jb25zdCBIRUFERVJfTEVOR1RIID0gMTI7XG5cbmNsYXNzIFppcENyeXB0b0RlY3J5cHRpb25TdHJlYW0gZXh0ZW5kcyBUcmFuc2Zvcm1TdHJlYW0ge1xuXG5cdGNvbnN0cnVjdG9yKHsgcGFzc3dvcmQsIHBhc3N3b3JkVmVyaWZpY2F0aW9uLCBjaGVja1Bhc3N3b3JkT25seSB9KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0c3RhcnQoKSB7XG5cdFx0XHRcdE9iamVjdC5hc3NpZ24odGhpcywge1xuXHRcdFx0XHRcdHBhc3N3b3JkLFxuXHRcdFx0XHRcdHBhc3N3b3JkVmVyaWZpY2F0aW9uXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRjcmVhdGVLZXlzKHRoaXMsIHBhc3N3b3JkKTtcblx0XHRcdH0sXG5cdFx0XHR0cmFuc2Zvcm0oY2h1bmssIGNvbnRyb2xsZXIpIHtcblx0XHRcdFx0Y29uc3QgemlwQ3J5cHRvID0gdGhpcztcblx0XHRcdFx0aWYgKHppcENyeXB0by5wYXNzd29yZCkge1xuXHRcdFx0XHRcdGNvbnN0IGRlY3J5cHRlZEhlYWRlciA9IGRlY3J5cHQoemlwQ3J5cHRvLCBjaHVuay5zdWJhcnJheSgwLCBIRUFERVJfTEVOR1RIKSk7XG5cdFx0XHRcdFx0emlwQ3J5cHRvLnBhc3N3b3JkID0gbnVsbDtcblx0XHRcdFx0XHRpZiAoZGVjcnlwdGVkSGVhZGVyW0hFQURFUl9MRU5HVEggLSAxXSAhPSB6aXBDcnlwdG8ucGFzc3dvcmRWZXJpZmljYXRpb24pIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihFUlJfSU5WQUxJRF9QQVNTV09SRCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNodW5rID0gY2h1bmsuc3ViYXJyYXkoSEVBREVSX0xFTkdUSCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGNoZWNrUGFzc3dvcmRPbmx5KSB7XG5cdFx0XHRcdFx0Y29udHJvbGxlci5lcnJvcihuZXcgRXJyb3IoRVJSX0FCT1JUX0NIRUNLX1BBU1NXT1JEKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29udHJvbGxlci5lbnF1ZXVlKGRlY3J5cHQoemlwQ3J5cHRvLCBjaHVuaykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgWmlwQ3J5cHRvRW5jcnlwdGlvblN0cmVhbSBleHRlbmRzIFRyYW5zZm9ybVN0cmVhbSB7XG5cblx0Y29uc3RydWN0b3IoeyBwYXNzd29yZCwgcGFzc3dvcmRWZXJpZmljYXRpb24gfSkge1xuXHRcdHN1cGVyKHtcblx0XHRcdHN0YXJ0KCkge1xuXHRcdFx0XHRPYmplY3QuYXNzaWduKHRoaXMsIHtcblx0XHRcdFx0XHRwYXNzd29yZCxcblx0XHRcdFx0XHRwYXNzd29yZFZlcmlmaWNhdGlvblxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y3JlYXRlS2V5cyh0aGlzLCBwYXNzd29yZCk7XG5cdFx0XHR9LFxuXHRcdFx0dHJhbnNmb3JtKGNodW5rLCBjb250cm9sbGVyKSB7XG5cdFx0XHRcdGNvbnN0IHppcENyeXB0byA9IHRoaXM7XG5cdFx0XHRcdGxldCBvdXRwdXQ7XG5cdFx0XHRcdGxldCBvZmZzZXQ7XG5cdFx0XHRcdGlmICh6aXBDcnlwdG8ucGFzc3dvcmQpIHtcblx0XHRcdFx0XHR6aXBDcnlwdG8ucGFzc3dvcmQgPSBudWxsO1xuXHRcdFx0XHRcdGNvbnN0IGhlYWRlciA9IGdldFJhbmRvbVZhbHVlcyhuZXcgVWludDhBcnJheShIRUFERVJfTEVOR1RIKSk7XG5cdFx0XHRcdFx0aGVhZGVyW0hFQURFUl9MRU5HVEggLSAxXSA9IHppcENyeXB0by5wYXNzd29yZFZlcmlmaWNhdGlvbjtcblx0XHRcdFx0XHRvdXRwdXQgPSBuZXcgVWludDhBcnJheShjaHVuay5sZW5ndGggKyBoZWFkZXIubGVuZ3RoKTtcblx0XHRcdFx0XHRvdXRwdXQuc2V0KGVuY3J5cHQoemlwQ3J5cHRvLCBoZWFkZXIpLCAwKTtcblx0XHRcdFx0XHRvZmZzZXQgPSBIRUFERVJfTEVOR1RIO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG91dHB1dCA9IG5ldyBVaW50OEFycmF5KGNodW5rLmxlbmd0aCk7XG5cdFx0XHRcdFx0b2Zmc2V0ID0gMDtcblx0XHRcdFx0fVxuXHRcdFx0XHRvdXRwdXQuc2V0KGVuY3J5cHQoemlwQ3J5cHRvLCBjaHVuayksIG9mZnNldCk7XG5cdFx0XHRcdGNvbnRyb2xsZXIuZW5xdWV1ZShvdXRwdXQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCB7XG5cdFppcENyeXB0b0RlY3J5cHRpb25TdHJlYW0sXG5cdFppcENyeXB0b0VuY3J5cHRpb25TdHJlYW0sXG5cdEVSUl9JTlZBTElEX1BBU1NXT1JEXG59O1xuXG5mdW5jdGlvbiBkZWNyeXB0KHRhcmdldCwgaW5wdXQpIHtcblx0Y29uc3Qgb3V0cHV0ID0gbmV3IFVpbnQ4QXJyYXkoaW5wdXQubGVuZ3RoKTtcblx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGlucHV0Lmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdG91dHB1dFtpbmRleF0gPSBnZXRCeXRlKHRhcmdldCkgXiBpbnB1dFtpbmRleF07XG5cdFx0dXBkYXRlS2V5cyh0YXJnZXQsIG91dHB1dFtpbmRleF0pO1xuXHR9XG5cdHJldHVybiBvdXRwdXQ7XG59XG5cbmZ1bmN0aW9uIGVuY3J5cHQodGFyZ2V0LCBpbnB1dCkge1xuXHRjb25zdCBvdXRwdXQgPSBuZXcgVWludDhBcnJheShpbnB1dC5sZW5ndGgpO1xuXHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgaW5wdXQubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0b3V0cHV0W2luZGV4XSA9IGdldEJ5dGUodGFyZ2V0KSBeIGlucHV0W2luZGV4XTtcblx0XHR1cGRhdGVLZXlzKHRhcmdldCwgaW5wdXRbaW5kZXhdKTtcblx0fVxuXHRyZXR1cm4gb3V0cHV0O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVLZXlzKHRhcmdldCwgcGFzc3dvcmQpIHtcblx0Y29uc3Qga2V5cyA9IFsweDEyMzQ1Njc4LCAweDIzNDU2Nzg5LCAweDM0NTY3ODkwXTtcblx0T2JqZWN0LmFzc2lnbih0YXJnZXQsIHtcblx0XHRrZXlzLFxuXHRcdGNyY0tleTA6IG5ldyBDcmMzMihrZXlzWzBdKSxcblx0XHRjcmNLZXkyOiBuZXcgQ3JjMzIoa2V5c1syXSksXG5cdH0pO1xuXHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcGFzc3dvcmQubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0dXBkYXRlS2V5cyh0YXJnZXQsIHBhc3N3b3JkLmNoYXJDb2RlQXQoaW5kZXgpKTtcblx0fVxufVxuXG5mdW5jdGlvbiB1cGRhdGVLZXlzKHRhcmdldCwgYnl0ZSkge1xuXHRsZXQgW2tleTAsIGtleTEsIGtleTJdID0gdGFyZ2V0LmtleXM7XG5cdHRhcmdldC5jcmNLZXkwLmFwcGVuZChbYnl0ZV0pO1xuXHRrZXkwID0gfnRhcmdldC5jcmNLZXkwLmdldCgpO1xuXHRrZXkxID0gZ2V0SW50MzIoTWF0aC5pbXVsKGdldEludDMyKGtleTEgKyBnZXRJbnQ4KGtleTApKSwgMTM0Nzc1ODEzKSArIDEpO1xuXHR0YXJnZXQuY3JjS2V5Mi5hcHBlbmQoW2tleTEgPj4+IDI0XSk7XG5cdGtleTIgPSB+dGFyZ2V0LmNyY0tleTIuZ2V0KCk7XG5cdHRhcmdldC5rZXlzID0gW2tleTAsIGtleTEsIGtleTJdO1xufVxuXG5mdW5jdGlvbiBnZXRCeXRlKHRhcmdldCkge1xuXHRjb25zdCB0ZW1wID0gdGFyZ2V0LmtleXNbMl0gfCAyO1xuXHRyZXR1cm4gZ2V0SW50OChNYXRoLmltdWwodGVtcCwgKHRlbXAgXiAxKSkgPj4+IDgpO1xufVxuXG5mdW5jdGlvbiBnZXRJbnQ4KG51bWJlcikge1xuXHRyZXR1cm4gbnVtYmVyICYgMHhGRjtcbn1cblxuZnVuY3Rpb24gZ2V0SW50MzIobnVtYmVyKSB7XG5cdHJldHVybiBudW1iZXIgJiAweEZGRkZGRkZGO1xufSIsIi8qXG4gQ29weXJpZ2h0IChjKSAyMDIyIEdpbGRhcyBMb3JtZWF1LiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXG4gUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cbiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cblxuIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IFxuIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiBcbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cblxuIDMuIFRoZSBuYW1lcyBvZiB0aGUgYXV0aG9ycyBtYXkgbm90IGJlIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzXG4gZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG5cbiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEICcnQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1NFRCBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsXG4gSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORFxuIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBKQ1JBRlQsXG4gSU5DLiBPUiBBTlkgQ09OVFJJQlVUT1JTIFRPIFRISVMgU09GVFdBUkUgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCxcbiBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UXG4gTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsXG4gT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRlxuIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HXG4gTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLFxuIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cblxuLyogZ2xvYmFsIFRyYW5zZm9ybVN0cmVhbSAqL1xuLy8gZGVuby1saW50LWlnbm9yZS1maWxlIG5vLXRoaXMtYWxpYXNcblxuaW1wb3J0IHsgQ3JjMzJTdHJlYW0gfSBmcm9tIFwiLi9jcmMzMi1zdHJlYW0uanNcIjtcbmltcG9ydCB7XG5cdEFFU0VuY3J5cHRpb25TdHJlYW0sXG5cdEFFU0RlY3J5cHRpb25TdHJlYW1cbn0gZnJvbSBcIi4vYWVzLWNyeXB0by1zdHJlYW0uanNcIjtcbmltcG9ydCB7XG5cdFppcENyeXB0b0VuY3J5cHRpb25TdHJlYW0sXG5cdFppcENyeXB0b0RlY3J5cHRpb25TdHJlYW1cbn0gZnJvbSBcIi4vemlwLWNyeXB0by1zdHJlYW0uanNcIjtcbmltcG9ydCB7XG5cdEVSUl9JTlZBTElEX1BBU1NXT1JELFxuXHRFUlJfSU5WQUxJRF9TSUdOQVRVUkUsXG5cdEVSUl9BQk9SVF9DSEVDS19QQVNTV09SRFxufSBmcm9tIFwiLi9jb21tb24tY3J5cHRvLmpzXCI7XG5cbmNvbnN0IENPTVBSRVNTSU9OX0ZPUk1BVCA9IFwiZGVmbGF0ZS1yYXdcIjtcblxuY2xhc3MgRGVmbGF0ZVN0cmVhbSBleHRlbmRzIFRyYW5zZm9ybVN0cmVhbSB7XG5cblx0Y29uc3RydWN0b3Iob3B0aW9ucywgeyBjaHVua1NpemUsIENvbXByZXNzaW9uU3RyZWFtLCBDb21wcmVzc2lvblN0cmVhbU5hdGl2ZSB9KSB7XG5cdFx0c3VwZXIoe30pO1xuXHRcdGNvbnN0IHsgY29tcHJlc3NlZCwgZW5jcnlwdGVkLCB1c2VDb21wcmVzc2lvblN0cmVhbSwgemlwQ3J5cHRvLCBzaWduZWQsIGxldmVsIH0gPSBvcHRpb25zO1xuXHRcdGNvbnN0IHN0cmVhbSA9IHRoaXM7XG5cdFx0bGV0IGNyYzMyU3RyZWFtLCBlbmNyeXB0aW9uU3RyZWFtO1xuXHRcdGxldCByZWFkYWJsZSA9IGZpbHRlckVtcHR5Q2h1bmtzKHN1cGVyLnJlYWRhYmxlKTtcblx0XHRpZiAoKCFlbmNyeXB0ZWQgfHwgemlwQ3J5cHRvKSAmJiBzaWduZWQpIHtcblx0XHRcdGNyYzMyU3RyZWFtID0gbmV3IENyYzMyU3RyZWFtKCk7XG5cdFx0XHRyZWFkYWJsZSA9IHBpcGVUaHJvdWdoKHJlYWRhYmxlLCBjcmMzMlN0cmVhbSk7XG5cdFx0fVxuXHRcdGlmIChjb21wcmVzc2VkKSB7XG5cdFx0XHRyZWFkYWJsZSA9IHBpcGVUaHJvdWdoQ29tbXByZXNzaW9uU3RyZWFtKHJlYWRhYmxlLCB1c2VDb21wcmVzc2lvblN0cmVhbSwgeyBsZXZlbCwgY2h1bmtTaXplIH0sIENvbXByZXNzaW9uU3RyZWFtTmF0aXZlLCBDb21wcmVzc2lvblN0cmVhbSk7XG5cdFx0fVxuXHRcdGlmIChlbmNyeXB0ZWQpIHtcblx0XHRcdGlmICh6aXBDcnlwdG8pIHtcblx0XHRcdFx0cmVhZGFibGUgPSBwaXBlVGhyb3VnaChyZWFkYWJsZSwgbmV3IFppcENyeXB0b0VuY3J5cHRpb25TdHJlYW0ob3B0aW9ucykpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZW5jcnlwdGlvblN0cmVhbSA9IG5ldyBBRVNFbmNyeXB0aW9uU3RyZWFtKG9wdGlvbnMpO1xuXHRcdFx0XHRyZWFkYWJsZSA9IHBpcGVUaHJvdWdoKHJlYWRhYmxlLCBlbmNyeXB0aW9uU3RyZWFtKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0c2V0UmVhZGFibGUoc3RyZWFtLCByZWFkYWJsZSwgKCkgPT4ge1xuXHRcdFx0bGV0IHNpZ25hdHVyZTtcblx0XHRcdGlmIChlbmNyeXB0ZWQgJiYgIXppcENyeXB0bykge1xuXHRcdFx0XHRzaWduYXR1cmUgPSBlbmNyeXB0aW9uU3RyZWFtLnNpZ25hdHVyZTtcblx0XHRcdH1cblx0XHRcdGlmICgoIWVuY3J5cHRlZCB8fCB6aXBDcnlwdG8pICYmIHNpZ25lZCkge1xuXHRcdFx0XHRzaWduYXR1cmUgPSBuZXcgRGF0YVZpZXcoY3JjMzJTdHJlYW0udmFsdWUuYnVmZmVyKS5nZXRVaW50MzIoMCk7XG5cdFx0XHR9XG5cdFx0XHRzdHJlYW0uc2lnbmF0dXJlID0gc2lnbmF0dXJlO1xuXHRcdH0pO1xuXHR9XG59XG5cbmNsYXNzIEluZmxhdGVTdHJlYW0gZXh0ZW5kcyBUcmFuc2Zvcm1TdHJlYW0ge1xuXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMsIHsgY2h1bmtTaXplLCBEZWNvbXByZXNzaW9uU3RyZWFtLCBEZWNvbXByZXNzaW9uU3RyZWFtTmF0aXZlIH0pIHtcblx0XHRzdXBlcih7fSk7XG5cdFx0Y29uc3QgeyB6aXBDcnlwdG8sIGVuY3J5cHRlZCwgc2lnbmVkLCBzaWduYXR1cmUsIGNvbXByZXNzZWQsIHVzZUNvbXByZXNzaW9uU3RyZWFtIH0gPSBvcHRpb25zO1xuXHRcdGxldCBjcmMzMlN0cmVhbSwgZGVjcnlwdGlvblN0cmVhbTtcblx0XHRsZXQgcmVhZGFibGUgPSBmaWx0ZXJFbXB0eUNodW5rcyhzdXBlci5yZWFkYWJsZSk7XG5cdFx0aWYgKGVuY3J5cHRlZCkge1xuXHRcdFx0aWYgKHppcENyeXB0bykge1xuXHRcdFx0XHRyZWFkYWJsZSA9IHBpcGVUaHJvdWdoKHJlYWRhYmxlLCBuZXcgWmlwQ3J5cHRvRGVjcnlwdGlvblN0cmVhbShvcHRpb25zKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkZWNyeXB0aW9uU3RyZWFtID0gbmV3IEFFU0RlY3J5cHRpb25TdHJlYW0ob3B0aW9ucyk7XG5cdFx0XHRcdHJlYWRhYmxlID0gcGlwZVRocm91Z2gocmVhZGFibGUsIGRlY3J5cHRpb25TdHJlYW0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoY29tcHJlc3NlZCkge1xuXHRcdFx0cmVhZGFibGUgPSBwaXBlVGhyb3VnaENvbW1wcmVzc2lvblN0cmVhbShyZWFkYWJsZSwgdXNlQ29tcHJlc3Npb25TdHJlYW0sIHsgY2h1bmtTaXplIH0sIERlY29tcHJlc3Npb25TdHJlYW1OYXRpdmUsIERlY29tcHJlc3Npb25TdHJlYW0pO1xuXHRcdH1cblx0XHRpZiAoKCFlbmNyeXB0ZWQgfHwgemlwQ3J5cHRvKSAmJiBzaWduZWQpIHtcblx0XHRcdGNyYzMyU3RyZWFtID0gbmV3IENyYzMyU3RyZWFtKCk7XG5cdFx0XHRyZWFkYWJsZSA9IHBpcGVUaHJvdWdoKHJlYWRhYmxlLCBjcmMzMlN0cmVhbSk7XG5cdFx0fVxuXHRcdHNldFJlYWRhYmxlKHRoaXMsIHJlYWRhYmxlLCAoKSA9PiB7XG5cdFx0XHRpZiAoKCFlbmNyeXB0ZWQgfHwgemlwQ3J5cHRvKSAmJiBzaWduZWQpIHtcblx0XHRcdFx0Y29uc3QgZGF0YVZpZXdTaWduYXR1cmUgPSBuZXcgRGF0YVZpZXcoY3JjMzJTdHJlYW0udmFsdWUuYnVmZmVyKTtcblx0XHRcdFx0aWYgKHNpZ25hdHVyZSAhPSBkYXRhVmlld1NpZ25hdHVyZS5nZXRVaW50MzIoMCwgZmFsc2UpKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKEVSUl9JTlZBTElEX1NJR05BVFVSRSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5leHBvcnQge1xuXHREZWZsYXRlU3RyZWFtLFxuXHRJbmZsYXRlU3RyZWFtLFxuXHRFUlJfSU5WQUxJRF9QQVNTV09SRCxcblx0RVJSX0lOVkFMSURfU0lHTkFUVVJFLFxuXHRFUlJfQUJPUlRfQ0hFQ0tfUEFTU1dPUkRcbn07XG5cbmZ1bmN0aW9uIGZpbHRlckVtcHR5Q2h1bmtzKHJlYWRhYmxlKSB7XG5cdHJldHVybiBwaXBlVGhyb3VnaChyZWFkYWJsZSwgbmV3IFRyYW5zZm9ybVN0cmVhbSh7XG5cdFx0dHJhbnNmb3JtKGNodW5rLCBjb250cm9sbGVyKSB7XG5cdFx0XHRpZiAoY2h1bmsgJiYgY2h1bmsubGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnRyb2xsZXIuZW5xdWV1ZShjaHVuayk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9KSk7XG59XG5cbmZ1bmN0aW9uIHNldFJlYWRhYmxlKHN0cmVhbSwgcmVhZGFibGUsIGZsdXNoKSB7XG5cdHJlYWRhYmxlID0gcGlwZVRocm91Z2gocmVhZGFibGUsIG5ldyBUcmFuc2Zvcm1TdHJlYW0oeyBmbHVzaCB9KSk7XG5cdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShzdHJlYW0sIFwicmVhZGFibGVcIiwge1xuXHRcdGdldCgpIHtcblx0XHRcdHJldHVybiByZWFkYWJsZTtcblx0XHR9XG5cdH0pO1xufVxuXG5mdW5jdGlvbiBwaXBlVGhyb3VnaENvbW1wcmVzc2lvblN0cmVhbShyZWFkYWJsZSwgdXNlQ29tcHJlc3Npb25TdHJlYW0sIG9wdGlvbnMsIENvZGVjU3RyZWFtTmF0aXZlLCBDb2RlY1N0cmVhbSkge1xuXHR0cnkge1xuXHRcdGNvbnN0IENvbXByZXNzaW9uU3RyZWFtID0gdXNlQ29tcHJlc3Npb25TdHJlYW0gJiYgQ29kZWNTdHJlYW1OYXRpdmUgPyBDb2RlY1N0cmVhbU5hdGl2ZSA6IENvZGVjU3RyZWFtO1xuXHRcdHJlYWRhYmxlID0gcGlwZVRocm91Z2gocmVhZGFibGUsIG5ldyBDb21wcmVzc2lvblN0cmVhbShDT01QUkVTU0lPTl9GT1JNQVQsIG9wdGlvbnMpKTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRpZiAodXNlQ29tcHJlc3Npb25TdHJlYW0pIHtcblx0XHRcdHJlYWRhYmxlID0gcGlwZVRocm91Z2gocmVhZGFibGUsIG5ldyBDb2RlY1N0cmVhbShDT01QUkVTU0lPTl9GT1JNQVQsIG9wdGlvbnMpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZWFkYWJsZTtcbn1cblxuZnVuY3Rpb24gcGlwZVRocm91Z2gocmVhZGFibGUsIHRyYW5zZm9ybVN0cmVhbSkge1xuXHRyZXR1cm4gcmVhZGFibGUucGlwZVRocm91Z2godHJhbnNmb3JtU3RyZWFtKTtcbn0iLCIvKlxuIENvcHlyaWdodCAoYykgMjAyMiBHaWxkYXMgTG9ybWVhdS4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG5cbiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBcbiBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gXG4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cbiAzLiBUaGUgbmFtZXMgb2YgdGhlIGF1dGhvcnMgbWF5IG5vdCBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0c1xuIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWMgcHJpb3Igd3JpdHRlbiBwZXJtaXNzaW9uLlxuXG4gVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnJ0FTIElTJycgQU5EIEFOWSBFWFBSRVNTRUQgT1IgSU1QTElFRCBXQVJSQU5USUVTLFxuIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkRcbiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgSkNSQUZULFxuIElOQy4gT1IgQU5ZIENPTlRSSUJVVE9SUyBUTyBUSElTIFNPRlRXQVJFIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsXG4gSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVFxuIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLFxuIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcbiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSxcbiBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5cbi8qXG4gKiBUaGlzIHByb2dyYW0gaXMgYmFzZWQgb24gSlpsaWIgMS4wLjIgeW1uaywgSkNyYWZ0LEluYy5cbiAqIEpabGliIGlzIGJhc2VkIG9uIHpsaWItMS4xLjMsIHNvIGFsbCBjcmVkaXQgc2hvdWxkIGdvIGF1dGhvcnNcbiAqIEplYW4tbG91cCBHYWlsbHkoamxvdXBAZ3ppcC5vcmcpIGFuZCBNYXJrIEFkbGVyKG1hZGxlckBhbHVtbmkuY2FsdGVjaC5lZHUpXG4gKiBhbmQgY29udHJpYnV0b3JzIG9mIHpsaWIuXG4gKi9cblxuLyogZ2xvYmFsIFRyYW5zZm9ybVN0cmVhbSAqL1xuLy8gZGVuby1saW50LWlnbm9yZS1maWxlIG5vLXRoaXMtYWxpYXNcblxuaW1wb3J0IHtcblx0RVJSX0lOVkFMSURfUEFTU1dPUkQsXG5cdEVSUl9JTlZBTElEX1NJR05BVFVSRSxcblx0RVJSX0FCT1JUX0NIRUNLX1BBU1NXT1JELFxuXHRJbmZsYXRlU3RyZWFtLFxuXHREZWZsYXRlU3RyZWFtXG59IGZyb20gXCIuL3ppcC1lbnRyeS1zdHJlYW0uanNcIjtcblxuY29uc3QgTUVTU0FHRV9FVkVOVF9UWVBFID0gXCJtZXNzYWdlXCI7XG5jb25zdCBNRVNTQUdFX1NUQVJUID0gXCJzdGFydFwiO1xuY29uc3QgTUVTU0FHRV9QVUxMID0gXCJwdWxsXCI7XG5jb25zdCBNRVNTQUdFX0RBVEEgPSBcImRhdGFcIjtcbmNvbnN0IE1FU1NBR0VfQUNLX0RBVEEgPSBcImFja1wiO1xuY29uc3QgTUVTU0FHRV9DTE9TRSA9IFwiY2xvc2VcIjtcbmNvbnN0IENPREVDX0RFRkxBVEUgPSBcImRlZmxhdGVcIjtcbmNvbnN0IENPREVDX0lORkxBVEUgPSBcImluZmxhdGVcIjtcblxuZXhwb3J0IHtcblx0Q09ERUNfREVGTEFURSxcblx0Q09ERUNfSU5GTEFURSxcblx0TUVTU0FHRV9FVkVOVF9UWVBFLFxuXHRNRVNTQUdFX1NUQVJULFxuXHRNRVNTQUdFX1BVTEwsXG5cdE1FU1NBR0VfREFUQSxcblx0TUVTU0FHRV9BQ0tfREFUQSxcblx0TUVTU0FHRV9DTE9TRSxcblx0RVJSX0lOVkFMSURfUEFTU1dPUkQsXG5cdEVSUl9JTlZBTElEX1NJR05BVFVSRSxcblx0RVJSX0FCT1JUX0NIRUNLX1BBU1NXT1JELFxuXHRDb2RlY1N0cmVhbVxufTtcblxuY2xhc3MgQ29kZWNTdHJlYW0gZXh0ZW5kcyBUcmFuc2Zvcm1TdHJlYW0ge1xuXG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMsIGNvbmZpZykge1xuXHRcdHN1cGVyKHt9KTtcblx0XHRjb25zdCBjb2RlYyA9IHRoaXM7XG5cdFx0Y29uc3QgeyBjb2RlY1R5cGUgfSA9IG9wdGlvbnM7XG5cdFx0bGV0IFN0cmVhbTtcblx0XHRpZiAoY29kZWNUeXBlLnN0YXJ0c1dpdGgoQ09ERUNfREVGTEFURSkpIHtcblx0XHRcdFN0cmVhbSA9IERlZmxhdGVTdHJlYW07XG5cdFx0fSBlbHNlIGlmIChjb2RlY1R5cGUuc3RhcnRzV2l0aChDT0RFQ19JTkZMQVRFKSkge1xuXHRcdFx0U3RyZWFtID0gSW5mbGF0ZVN0cmVhbTtcblx0XHR9XG5cdFx0bGV0IHNpemUgPSAwO1xuXHRcdGNvbnN0IHN0cmVhbSA9IG5ldyBTdHJlYW0ob3B0aW9ucywgY29uZmlnKTtcblx0XHRjb25zdCByZWFkYWJsZSA9IHN1cGVyLnJlYWRhYmxlO1xuXHRcdGNvbnN0IHRyYW5zZm9ybVN0cmVhbSA9IG5ldyBUcmFuc2Zvcm1TdHJlYW0oe1xuXHRcdFx0dHJhbnNmb3JtKGNodW5rLCBjb250cm9sbGVyKSB7XG5cdFx0XHRcdGlmIChjaHVuayAmJiBjaHVuay5sZW5ndGgpIHtcblx0XHRcdFx0XHRzaXplICs9IGNodW5rLmxlbmd0aDtcblx0XHRcdFx0XHRjb250cm9sbGVyLmVucXVldWUoY2h1bmspO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Zmx1c2goKSB7XG5cdFx0XHRcdGNvbnN0IHsgc2lnbmF0dXJlIH0gPSBzdHJlYW07XG5cdFx0XHRcdE9iamVjdC5hc3NpZ24oY29kZWMsIHtcblx0XHRcdFx0XHRzaWduYXR1cmUsXG5cdFx0XHRcdFx0c2l6ZVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoY29kZWMsIFwicmVhZGFibGVcIiwge1xuXHRcdFx0Z2V0KCkge1xuXHRcdFx0XHRyZXR1cm4gcmVhZGFibGUucGlwZVRocm91Z2goc3RyZWFtKS5waXBlVGhyb3VnaCh0cmFuc2Zvcm1TdHJlYW0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59IiwiLypcbiBDb3B5cmlnaHQgKGMpIDIwMjIgR2lsZGFzIExvcm1lYXUuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cbiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuXG4gMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgXG4gbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIFxuIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuXG4gMy4gVGhlIG5hbWVzIG9mIHRoZSBhdXRob3JzIG1heSBub3QgYmUgdXNlZCB0byBlbmRvcnNlIG9yIHByb21vdGUgcHJvZHVjdHNcbiBkZXJpdmVkIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cblxuIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgJydBUyBJUycnIEFORCBBTlkgRVhQUkVTU0VEIE9SIElNUExJRUQgV0FSUkFOVElFUyxcbiBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EXG4gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIEpDUkFGVCxcbiBJTkMuIE9SIEFOWSBDT05UUklCVVRPUlMgVE8gVEhJUyBTT0ZUV0FSRSBCRSBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULFxuIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1RcbiBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSxcbiBPUiBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GXG4gTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkdcbiBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsXG4gRVZFTiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqL1xuXG4vKiBnbG9iYWwgV29ya2VyLCBVUkwsIFRyYW5zZm9ybVN0cmVhbSwgV3JpdGFibGVTdHJlYW0gKi9cblxuaW1wb3J0IHtcblx0VU5ERUZJTkVEX1RZUEUsXG5cdEZVTkNUSU9OX1RZUEVcbn0gZnJvbSBcIi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQge1xuXHRDb2RlY1N0cmVhbSxcblx0TUVTU0FHRV9FVkVOVF9UWVBFLFxuXHRNRVNTQUdFX1NUQVJULFxuXHRNRVNTQUdFX1BVTEwsXG5cdE1FU1NBR0VfREFUQSxcblx0TUVTU0FHRV9BQ0tfREFUQSxcblx0TUVTU0FHRV9DTE9TRVxufSBmcm9tIFwiLi9zdHJlYW1zL2NvZGVjLXN0cmVhbS5qc1wiO1xuXG4vLyBkZW5vLWxpbnQtaWdub3JlIHZhbGlkLXR5cGVvZlxuY29uc3QgV0VCX1dPUktFUlNfU1VQUE9SVEVEID0gdHlwZW9mIFdvcmtlciAhPSBVTkRFRklORURfVFlQRTtcblxuZXhwb3J0IHtcblx0Q29kZWNXb3JrZXJcbn07XG5cbmNsYXNzIENvZGVjV29ya2VyIHtcblxuXHRjb25zdHJ1Y3Rvcih3b3JrZXJEYXRhLCB7IHJlYWRhYmxlLCB3cml0YWJsZSB9LCB7IG9wdGlvbnMsIGNvbmZpZywgc3RyZWFtT3B0aW9ucywgdXNlV2ViV29ya2VycywgdHJhbnNmZXJTdHJlYW1zLCBzY3JpcHRzIH0sIG9uVGFza0ZpbmlzaGVkKSB7XG5cdFx0Y29uc3QgeyBzaWduYWwgfSA9IHN0cmVhbU9wdGlvbnM7XG5cdFx0T2JqZWN0LmFzc2lnbih3b3JrZXJEYXRhLCB7XG5cdFx0XHRidXN5OiB0cnVlLFxuXHRcdFx0cmVhZGFibGU6IHJlYWRhYmxlLnBpcGVUaHJvdWdoKG5ldyBQcm9ncmVzc1dhdGNoZXJTdHJlYW0ocmVhZGFibGUsIHN0cmVhbU9wdGlvbnMsIGNvbmZpZyksIHsgc2lnbmFsIH0pLFxuXHRcdFx0d3JpdGFibGUsXG5cdFx0XHRvcHRpb25zOiBPYmplY3QuYXNzaWduKHt9LCBvcHRpb25zKSxcblx0XHRcdHNjcmlwdHMsXG5cdFx0XHR0cmFuc2ZlclN0cmVhbXMsXG5cdFx0XHR0ZXJtaW5hdGUoKSB7XG5cdFx0XHRcdGNvbnN0IHsgd29ya2VyLCBidXN5IH0gPSB3b3JrZXJEYXRhO1xuXHRcdFx0XHRpZiAod29ya2VyICYmICFidXN5KSB7XG5cdFx0XHRcdFx0d29ya2VyLnRlcm1pbmF0ZSgpO1xuXHRcdFx0XHRcdHdvcmtlckRhdGEuaW50ZXJmYWNlID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9uVGFza0ZpbmlzaGVkKCkge1xuXHRcdFx0XHR3b3JrZXJEYXRhLmJ1c3kgPSBmYWxzZTtcblx0XHRcdFx0b25UYXNrRmluaXNoZWQod29ya2VyRGF0YSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuICh1c2VXZWJXb3JrZXJzICYmIFdFQl9XT1JLRVJTX1NVUFBPUlRFRCA/IGNyZWF0ZVdlYldvcmtlckludGVyZmFjZSA6IGNyZWF0ZVdvcmtlckludGVyZmFjZSkod29ya2VyRGF0YSwgY29uZmlnKTtcblx0fVxufVxuXG5jbGFzcyBQcm9ncmVzc1dhdGNoZXJTdHJlYW0gZXh0ZW5kcyBUcmFuc2Zvcm1TdHJlYW0ge1xuXG5cdGNvbnN0cnVjdG9yKHJlYWRhYmxlU291cmNlLCB7IG9uc3RhcnQsIG9ucHJvZ3Jlc3MsIHNpemUsIG9uZW5kIH0sIHsgY2h1bmtTaXplIH0pIHtcblx0XHRsZXQgY2h1bmtPZmZzZXQgPSAwO1xuXHRcdHN1cGVyKHtcblx0XHRcdHN0YXJ0KCkge1xuXHRcdFx0XHRpZiAob25zdGFydCkge1xuXHRcdFx0XHRcdGNhbGxIYW5kbGVyKG9uc3RhcnQsIHNpemUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YXN5bmMgdHJhbnNmb3JtKGNodW5rLCBjb250cm9sbGVyKSB7XG5cdFx0XHRcdGNodW5rT2Zmc2V0ICs9IGNodW5rLmxlbmd0aDtcblx0XHRcdFx0aWYgKG9ucHJvZ3Jlc3MpIHtcblx0XHRcdFx0XHRhd2FpdCBjYWxsSGFuZGxlcihvbnByb2dyZXNzLCBjaHVua09mZnNldCwgc2l6ZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udHJvbGxlci5lbnF1ZXVlKGNodW5rKTtcblx0XHRcdH0sXG5cdFx0XHRmbHVzaCgpIHtcblx0XHRcdFx0cmVhZGFibGVTb3VyY2Uuc2l6ZSA9IGNodW5rT2Zmc2V0O1xuXHRcdFx0XHRpZiAob25lbmQpIHtcblx0XHRcdFx0XHRjYWxsSGFuZGxlcihvbmVuZCwgY2h1bmtPZmZzZXQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSwgeyBoaWdoV2F0ZXJNYXJrOiAxLCBzaXplOiAoKSA9PiBjaHVua1NpemUgfSk7XG5cdH1cbn1cblxuYXN5bmMgZnVuY3Rpb24gY2FsbEhhbmRsZXIoaGFuZGxlciwgLi4ucGFyYW1ldGVycykge1xuXHR0cnkge1xuXHRcdGF3YWl0IGhhbmRsZXIoLi4ucGFyYW1ldGVycyk7XG5cdH0gY2F0Y2ggKF9lcnJvcikge1xuXHRcdC8vIGlnbm9yZWRcblx0fVxufVxuXG5mdW5jdGlvbiBjcmVhdGVXb3JrZXJJbnRlcmZhY2Uod29ya2VyRGF0YSwgY29uZmlnKSB7XG5cdHJldHVybiB7XG5cdFx0cnVuOiAoKSA9PiBydW5Xb3JrZXIod29ya2VyRGF0YSwgY29uZmlnKVxuXHR9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVXZWJXb3JrZXJJbnRlcmZhY2Uod29ya2VyRGF0YSwgeyBiYXNlVVJMLCBjaHVua1NpemUgfSkge1xuXHRpZiAoIXdvcmtlckRhdGEuaW50ZXJmYWNlKSB7XG5cdFx0T2JqZWN0LmFzc2lnbih3b3JrZXJEYXRhLCB7XG5cdFx0XHR3b3JrZXI6IGdldFdlYldvcmtlcih3b3JrZXJEYXRhLnNjcmlwdHNbMF0sIGJhc2VVUkwsIHdvcmtlckRhdGEpLFxuXHRcdFx0aW50ZXJmYWNlOiB7XG5cdFx0XHRcdHJ1bjogKCkgPT4gcnVuV2ViV29ya2VyKHdvcmtlckRhdGEsIHsgY2h1bmtTaXplIH0pXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblx0cmV0dXJuIHdvcmtlckRhdGEuaW50ZXJmYWNlO1xufVxuXG5hc3luYyBmdW5jdGlvbiBydW5Xb3JrZXIoeyBvcHRpb25zLCByZWFkYWJsZSwgd3JpdGFibGUsIG9uVGFza0ZpbmlzaGVkIH0sIGNvbmZpZykge1xuXHRjb25zdCBjb2RlY1N0cmVhbSA9IG5ldyBDb2RlY1N0cmVhbShvcHRpb25zLCBjb25maWcpO1xuXHR0cnkge1xuXHRcdGF3YWl0IHJlYWRhYmxlLnBpcGVUaHJvdWdoKGNvZGVjU3RyZWFtKS5waXBlVG8od3JpdGFibGUsIHsgcHJldmVudENsb3NlOiB0cnVlLCBwcmV2ZW50QWJvcnQ6IHRydWUgfSk7XG5cdFx0Y29uc3Qge1xuXHRcdFx0c2lnbmF0dXJlLFxuXHRcdFx0c2l6ZVxuXHRcdH0gPSBjb2RlY1N0cmVhbTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c2lnbmF0dXJlLFxuXHRcdFx0c2l6ZVxuXHRcdH07XG5cdH0gZmluYWxseSB7XG5cdFx0b25UYXNrRmluaXNoZWQoKTtcblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBydW5XZWJXb3JrZXIod29ya2VyRGF0YSwgY29uZmlnKSB7XG5cdGxldCByZXNvbHZlUmVzdWx0LCByZWplY3RSZXN1bHQ7XG5cdGNvbnN0IHJlc3VsdCA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRyZXNvbHZlUmVzdWx0ID0gcmVzb2x2ZTtcblx0XHRyZWplY3RSZXN1bHQgPSByZWplY3Q7XG5cdH0pO1xuXHRPYmplY3QuYXNzaWduKHdvcmtlckRhdGEsIHtcblx0XHRyZWFkZXI6IG51bGwsXG5cdFx0d3JpdGVyOiBudWxsLFxuXHRcdHJlc29sdmVSZXN1bHQsXG5cdFx0cmVqZWN0UmVzdWx0LFxuXHRcdHJlc3VsdFxuXHR9KTtcblx0Y29uc3QgeyByZWFkYWJsZSwgb3B0aW9ucywgc2NyaXB0cyB9ID0gd29ya2VyRGF0YTtcblx0Y29uc3QgeyB3cml0YWJsZSwgY2xvc2VkIH0gPSB3YXRjaENsb3NlZFN0cmVhbSh3b3JrZXJEYXRhLndyaXRhYmxlKTtcblx0Y29uc3Qgc3RyZWFtc1RyYW5zZmVycmVkID0gc2VuZE1lc3NhZ2Uoe1xuXHRcdHR5cGU6IE1FU1NBR0VfU1RBUlQsXG5cdFx0c2NyaXB0czogc2NyaXB0cy5zbGljZSgxKSxcblx0XHRvcHRpb25zLFxuXHRcdGNvbmZpZyxcblx0XHRyZWFkYWJsZSxcblx0XHR3cml0YWJsZVxuXHR9LCB3b3JrZXJEYXRhKTtcblx0aWYgKCFzdHJlYW1zVHJhbnNmZXJyZWQpIHtcblx0XHRPYmplY3QuYXNzaWduKHdvcmtlckRhdGEsIHtcblx0XHRcdHJlYWRlcjogcmVhZGFibGUuZ2V0UmVhZGVyKCksXG5cdFx0XHR3cml0ZXI6IHdyaXRhYmxlLmdldFdyaXRlcigpXG5cdFx0fSk7XG5cdH1cblx0Y29uc3QgcmVzdWx0VmFsdWUgPSBhd2FpdCByZXN1bHQ7XG5cdHRyeSB7XG5cdFx0YXdhaXQgd3JpdGFibGUuZ2V0V3JpdGVyKCkuY2xvc2UoKTtcblx0fSBjYXRjaCAoX2Vycm9yKSB7XG5cdFx0Ly8gaWdub3JlZFxuXHR9XG5cdGF3YWl0IGNsb3NlZDtcblx0cmV0dXJuIHJlc3VsdFZhbHVlO1xufVxuXG5mdW5jdGlvbiB3YXRjaENsb3NlZFN0cmVhbSh3cml0YWJsZVNvdXJjZSkge1xuXHRjb25zdCB3cml0ZXIgPSB3cml0YWJsZVNvdXJjZS5nZXRXcml0ZXIoKTtcblx0bGV0IHJlc29sdmVTdHJlYW1DbG9zZWQ7XG5cdGNvbnN0IGNsb3NlZCA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gcmVzb2x2ZVN0cmVhbUNsb3NlZCA9IHJlc29sdmUpO1xuXHRjb25zdCB3cml0YWJsZSA9IG5ldyBXcml0YWJsZVN0cmVhbSh7XG5cdFx0YXN5bmMgd3JpdGUoY2h1bmspIHtcblx0XHRcdGF3YWl0IHdyaXRlci5yZWFkeTtcblx0XHRcdGF3YWl0IHdyaXRlci53cml0ZShjaHVuayk7XG5cdFx0fSxcblx0XHRjbG9zZSgpIHtcblx0XHRcdHdyaXRlci5yZWxlYXNlTG9jaygpO1xuXHRcdFx0cmVzb2x2ZVN0cmVhbUNsb3NlZCgpO1xuXHRcdH0sXG5cdFx0YWJvcnQocmVhc29uKSB7XG5cdFx0XHRyZXR1cm4gd3JpdGVyLmFib3J0KHJlYXNvbik7XG5cdFx0fVxuXHR9KTtcblx0cmV0dXJuIHsgd3JpdGFibGUsIGNsb3NlZCB9O1xufVxuXG5sZXQgY2xhc3NpY1dvcmtlcnNTdXBwb3J0ZWQgPSB0cnVlO1xubGV0IHRyYW5zZmVyU3RyZWFtc1N1cHBvcnRlZCA9IHRydWU7XG5cbmZ1bmN0aW9uIGdldFdlYldvcmtlcih1cmwsIGJhc2VVUkwsIHdvcmtlckRhdGEpIHtcblx0Y29uc3Qgd29ya2VyT3B0aW9ucyA9IHsgdHlwZTogXCJtb2R1bGVcIiB9O1xuXHRsZXQgc2NyaXB0VXJsLCB3b3JrZXI7XG5cdC8vIGRlbm8tbGludC1pZ25vcmUgdmFsaWQtdHlwZW9mXG5cdGlmICh0eXBlb2YgdXJsID09IEZVTkNUSU9OX1RZUEUpIHtcblx0XHR1cmwgPSB1cmwoKTtcblx0fVxuXHR0cnkge1xuXHRcdHNjcmlwdFVybCA9IG5ldyBVUkwodXJsLCBiYXNlVVJMKTtcblx0fSBjYXRjaCAoX2Vycm9yKSB7XG5cdFx0c2NyaXB0VXJsID0gdXJsO1xuXHR9XG5cdGlmIChjbGFzc2ljV29ya2Vyc1N1cHBvcnRlZCkge1xuXHRcdHRyeSB7XG5cdFx0XHR3b3JrZXIgPSBuZXcgV29ya2VyKHNjcmlwdFVybCk7XG5cdFx0fSBjYXRjaCAoX2Vycm9yKSB7XG5cdFx0XHRjbGFzc2ljV29ya2Vyc1N1cHBvcnRlZCA9IGZhbHNlO1xuXHRcdFx0d29ya2VyID0gbmV3IFdvcmtlcihzY3JpcHRVcmwsIHdvcmtlck9wdGlvbnMpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHR3b3JrZXIgPSBuZXcgV29ya2VyKHNjcmlwdFVybCwgd29ya2VyT3B0aW9ucyk7XG5cdH1cblx0d29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoTUVTU0FHRV9FVkVOVF9UWVBFLCBldmVudCA9PiBvbk1lc3NhZ2UoZXZlbnQsIHdvcmtlckRhdGEpKTtcblx0cmV0dXJuIHdvcmtlcjtcbn1cblxuZnVuY3Rpb24gc2VuZE1lc3NhZ2UobWVzc2FnZSwgeyB3b3JrZXIsIHdyaXRlciwgb25UYXNrRmluaXNoZWQsIHRyYW5zZmVyU3RyZWFtcyB9KSB7XG5cdHRyeSB7XG5cdFx0bGV0IHsgdmFsdWUsIHJlYWRhYmxlLCB3cml0YWJsZSB9ID0gbWVzc2FnZTtcblx0XHRjb25zdCB0cmFuc2ZlcmFibGVzID0gW107XG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRpZiAodmFsdWUuYnl0ZUxlbmd0aCA8IHZhbHVlLmJ1ZmZlci5ieXRlTGVuZ3RoKSB7XG5cdFx0XHRcdG1lc3NhZ2UudmFsdWUgPSB2YWx1ZS5idWZmZXIuc2xpY2UoMCwgdmFsdWUuYnl0ZUxlbmd0aCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0bWVzc2FnZS52YWx1ZSA9IHZhbHVlLmJ1ZmZlcjtcblx0XHRcdH1cblx0XHRcdHRyYW5zZmVyYWJsZXMucHVzaChtZXNzYWdlLnZhbHVlKTtcblx0XHR9XG5cdFx0aWYgKHRyYW5zZmVyU3RyZWFtcyAmJiB0cmFuc2ZlclN0cmVhbXNTdXBwb3J0ZWQpIHtcblx0XHRcdGlmIChyZWFkYWJsZSkge1xuXHRcdFx0XHR0cmFuc2ZlcmFibGVzLnB1c2gocmVhZGFibGUpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHdyaXRhYmxlKSB7XG5cdFx0XHRcdHRyYW5zZmVyYWJsZXMucHVzaCh3cml0YWJsZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1lc3NhZ2UucmVhZGFibGUgPSBtZXNzYWdlLndyaXRhYmxlID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKHRyYW5zZmVyYWJsZXMubGVuZ3RoKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHR3b3JrZXIucG9zdE1lc3NhZ2UobWVzc2FnZSwgdHJhbnNmZXJhYmxlcyk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSBjYXRjaCAoX2Vycm9yKSB7XG5cdFx0XHRcdHRyYW5zZmVyU3RyZWFtc1N1cHBvcnRlZCA9IGZhbHNlO1xuXHRcdFx0XHRtZXNzYWdlLnJlYWRhYmxlID0gbWVzc2FnZS53cml0YWJsZSA9IG51bGw7XG5cdFx0XHRcdHdvcmtlci5wb3N0TWVzc2FnZShtZXNzYWdlKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0d29ya2VyLnBvc3RNZXNzYWdlKG1lc3NhZ2UpO1xuXHRcdH1cblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRpZiAod3JpdGVyKSB7XG5cdFx0XHR3cml0ZXIucmVsZWFzZUxvY2soKTtcblx0XHR9XG5cdFx0b25UYXNrRmluaXNoZWQoKTtcblx0XHR0aHJvdyBlcnJvcjtcblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBvbk1lc3NhZ2UoeyBkYXRhIH0sIHdvcmtlckRhdGEpIHtcblx0Y29uc3QgeyB0eXBlLCB2YWx1ZSwgbWVzc2FnZUlkLCByZXN1bHQsIGVycm9yIH0gPSBkYXRhO1xuXHRjb25zdCB7IHJlYWRlciwgd3JpdGVyLCByZXNvbHZlUmVzdWx0LCByZWplY3RSZXN1bHQsIG9uVGFza0ZpbmlzaGVkIH0gPSB3b3JrZXJEYXRhO1xuXHR0cnkge1xuXHRcdGlmIChlcnJvcikge1xuXHRcdFx0Y29uc3QgeyBtZXNzYWdlLCBzdGFjaywgY29kZSwgbmFtZSB9ID0gZXJyb3I7XG5cdFx0XHRjb25zdCByZXNwb25zZUVycm9yID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuXHRcdFx0T2JqZWN0LmFzc2lnbihyZXNwb25zZUVycm9yLCB7IHN0YWNrLCBjb2RlLCBuYW1lIH0pO1xuXHRcdFx0Y2xvc2UocmVzcG9uc2VFcnJvcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0eXBlID09IE1FU1NBR0VfUFVMTCkge1xuXHRcdFx0XHRjb25zdCB7IHZhbHVlLCBkb25lIH0gPSBhd2FpdCByZWFkZXIucmVhZCgpO1xuXHRcdFx0XHRzZW5kTWVzc2FnZSh7IHR5cGU6IE1FU1NBR0VfREFUQSwgdmFsdWUsIGRvbmUsIG1lc3NhZ2VJZCB9LCB3b3JrZXJEYXRhKTtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlID09IE1FU1NBR0VfREFUQSkge1xuXHRcdFx0XHRhd2FpdCB3cml0ZXIucmVhZHk7XG5cdFx0XHRcdGF3YWl0IHdyaXRlci53cml0ZShuZXcgVWludDhBcnJheSh2YWx1ZSkpO1xuXHRcdFx0XHRzZW5kTWVzc2FnZSh7IHR5cGU6IE1FU1NBR0VfQUNLX0RBVEEsIG1lc3NhZ2VJZCB9LCB3b3JrZXJEYXRhKTtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlID09IE1FU1NBR0VfQ0xPU0UpIHtcblx0XHRcdFx0Y2xvc2UobnVsbCwgcmVzdWx0KTtcblx0XHRcdH1cblx0XHR9XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0Y2xvc2UoZXJyb3IpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY2xvc2UoZXJyb3IsIHJlc3VsdCkge1xuXHRcdGlmIChlcnJvcikge1xuXHRcdFx0cmVqZWN0UmVzdWx0KGVycm9yKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzb2x2ZVJlc3VsdChyZXN1bHQpO1xuXHRcdH1cblx0XHRpZiAod3JpdGVyKSB7XG5cdFx0XHR3cml0ZXIucmVsZWFzZUxvY2soKTtcblx0XHR9XG5cdFx0b25UYXNrRmluaXNoZWQoKTtcblx0fVxufSIsIi8qXG4gQ29weXJpZ2h0IChjKSAyMDIyIEdpbGRhcyBMb3JtZWF1LiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXG4gUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cbiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cblxuIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IFxuIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiBcbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cblxuIDMuIFRoZSBuYW1lcyBvZiB0aGUgYXV0aG9ycyBtYXkgbm90IGJlIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzXG4gZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG5cbiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEICcnQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1NFRCBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsXG4gSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORFxuIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBKQ1JBRlQsXG4gSU5DLiBPUiBBTlkgQ09OVFJJQlVUT1JTIFRPIFRISVMgU09GVFdBUkUgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCxcbiBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UXG4gTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsXG4gT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRlxuIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HXG4gTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLFxuIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cblxuLyogZ2xvYmFsIHNldFRpbWVvdXQsIGNsZWFyVGltZW91dCAqL1xuXG5pbXBvcnQgeyBVTkRFRklORURfVkFMVUUgfSBmcm9tIFwiLi9jb25zdGFudHMuanNcIjtcbmltcG9ydCB7XG5cdENPREVDX0lORkxBVEUsXG5cdENPREVDX0RFRkxBVEUsXG5cdEVSUl9JTlZBTElEX1NJR05BVFVSRSxcblx0RVJSX0lOVkFMSURfUEFTU1dPUkQsXG5cdEVSUl9BQk9SVF9DSEVDS19QQVNTV09SRFxufSBmcm9tIFwiLi9zdHJlYW1zL2NvZGVjLXN0cmVhbS5qc1wiO1xuaW1wb3J0IHsgQ29kZWNXb3JrZXIgfSBmcm9tIFwiLi9jb2RlYy13b3JrZXIuanNcIjtcblxubGV0IHBvb2wgPSBbXTtcbmNvbnN0IHBlbmRpbmdSZXF1ZXN0cyA9IFtdO1xuXG5leHBvcnQge1xuXHRydW5Xb3JrZXIsXG5cdHRlcm1pbmF0ZVdvcmtlcnMsXG5cdENPREVDX0RFRkxBVEUsXG5cdENPREVDX0lORkxBVEUsXG5cdEVSUl9JTlZBTElEX1NJR05BVFVSRSxcblx0RVJSX0lOVkFMSURfUEFTU1dPUkQsXG5cdEVSUl9BQk9SVF9DSEVDS19QQVNTV09SRFxufTtcblxubGV0IGluZGV4V29ya2VyID0gMDtcblxuYXN5bmMgZnVuY3Rpb24gcnVuV29ya2VyKHN0cmVhbSwgd29ya2VyT3B0aW9ucykge1xuXHRjb25zdCB7IG9wdGlvbnMsIGNvbmZpZyB9ID0gd29ya2VyT3B0aW9ucztcblx0Y29uc3QgeyB0cmFuc2ZlclN0cmVhbXMsIHVzZVdlYldvcmtlcnMsIHVzZUNvbXByZXNzaW9uU3RyZWFtLCBjb2RlY1R5cGUsIGNvbXByZXNzZWQsIHNpZ25lZCwgZW5jcnlwdGVkIH0gPSBvcHRpb25zO1xuXHRjb25zdCB7IHdvcmtlclNjcmlwdHMsIG1heFdvcmtlcnMsIHRlcm1pbmF0ZVdvcmtlclRpbWVvdXQgfSA9IGNvbmZpZztcblx0d29ya2VyT3B0aW9ucy50cmFuc2ZlclN0cmVhbXMgPSB0cmFuc2ZlclN0cmVhbXMgfHwgdHJhbnNmZXJTdHJlYW1zID09PSBVTkRFRklORURfVkFMVUU7XG5cdGNvbnN0IHN0cmVhbUNvcHkgPSAhY29tcHJlc3NlZCAmJiAhc2lnbmVkICYmICFlbmNyeXB0ZWQgJiYgIXdvcmtlck9wdGlvbnMudHJhbnNmZXJTdHJlYW1zO1xuXHR3b3JrZXJPcHRpb25zLnVzZVdlYldvcmtlcnMgPSAhc3RyZWFtQ29weSAmJiAodXNlV2ViV29ya2VycyB8fCAodXNlV2ViV29ya2VycyA9PT0gVU5ERUZJTkVEX1ZBTFVFICYmIGNvbmZpZy51c2VXZWJXb3JrZXJzKSk7XG5cdHdvcmtlck9wdGlvbnMuc2NyaXB0cyA9IHdvcmtlck9wdGlvbnMudXNlV2ViV29ya2VycyAmJiB3b3JrZXJTY3JpcHRzID8gd29ya2VyU2NyaXB0c1tjb2RlY1R5cGVdIDogW107XG5cdG9wdGlvbnMudXNlQ29tcHJlc3Npb25TdHJlYW0gPSB1c2VDb21wcmVzc2lvblN0cmVhbSB8fCAodXNlQ29tcHJlc3Npb25TdHJlYW0gPT09IFVOREVGSU5FRF9WQUxVRSAmJiBjb25maWcudXNlQ29tcHJlc3Npb25TdHJlYW0pO1xuXHRsZXQgd29ya2VyO1xuXHRjb25zdCB3b3JrZXJEYXRhID0gcG9vbC5maW5kKHdvcmtlckRhdGEgPT4gIXdvcmtlckRhdGEuYnVzeSk7XG5cdGlmICh3b3JrZXJEYXRhKSB7XG5cdFx0Y2xlYXJUZXJtaW5hdGVUaW1lb3V0KHdvcmtlckRhdGEpO1xuXHRcdHdvcmtlciA9IG5ldyBDb2RlY1dvcmtlcih3b3JrZXJEYXRhLCBzdHJlYW0sIHdvcmtlck9wdGlvbnMsIG9uVGFza0ZpbmlzaGVkKTtcblx0fSBlbHNlIGlmIChwb29sLmxlbmd0aCA8IG1heFdvcmtlcnMpIHtcblx0XHRjb25zdCB3b3JrZXJEYXRhID0geyBpbmRleFdvcmtlciB9O1xuXHRcdGluZGV4V29ya2VyKys7XG5cdFx0cG9vbC5wdXNoKHdvcmtlckRhdGEpO1xuXHRcdHdvcmtlciA9IG5ldyBDb2RlY1dvcmtlcih3b3JrZXJEYXRhLCBzdHJlYW0sIHdvcmtlck9wdGlvbnMsIG9uVGFza0ZpbmlzaGVkKTtcblx0fSBlbHNlIHtcblx0XHR3b3JrZXIgPSBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHBlbmRpbmdSZXF1ZXN0cy5wdXNoKHsgcmVzb2x2ZSwgc3RyZWFtLCB3b3JrZXJPcHRpb25zIH0pKTtcblx0fVxuXHRyZXR1cm4gd29ya2VyLnJ1bigpO1xuXG5cdGZ1bmN0aW9uIG9uVGFza0ZpbmlzaGVkKHdvcmtlckRhdGEpIHtcblx0XHRpZiAocGVuZGluZ1JlcXVlc3RzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgW3sgcmVzb2x2ZSwgc3RyZWFtLCB3b3JrZXJPcHRpb25zIH1dID0gcGVuZGluZ1JlcXVlc3RzLnNwbGljZSgwLCAxKTtcblx0XHRcdHJlc29sdmUobmV3IENvZGVjV29ya2VyKHdvcmtlckRhdGEsIHN0cmVhbSwgd29ya2VyT3B0aW9ucywgb25UYXNrRmluaXNoZWQpKTtcblx0XHR9IGVsc2UgaWYgKHdvcmtlckRhdGEud29ya2VyKSB7XG5cdFx0XHRjbGVhclRlcm1pbmF0ZVRpbWVvdXQod29ya2VyRGF0YSk7XG5cdFx0XHRpZiAoTnVtYmVyLmlzRmluaXRlKHRlcm1pbmF0ZVdvcmtlclRpbWVvdXQpICYmIHRlcm1pbmF0ZVdvcmtlclRpbWVvdXQgPj0gMCkge1xuXHRcdFx0XHR3b3JrZXJEYXRhLnRlcm1pbmF0ZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRwb29sID0gcG9vbC5maWx0ZXIoZGF0YSA9PiBkYXRhICE9IHdvcmtlckRhdGEpO1xuXHRcdFx0XHRcdHdvcmtlckRhdGEudGVybWluYXRlKCk7XG5cdFx0XHRcdH0sIHRlcm1pbmF0ZVdvcmtlclRpbWVvdXQpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRwb29sID0gcG9vbC5maWx0ZXIoZGF0YSA9PiBkYXRhICE9IHdvcmtlckRhdGEpO1xuXHRcdH1cblx0fVxufVxuXG5mdW5jdGlvbiBjbGVhclRlcm1pbmF0ZVRpbWVvdXQod29ya2VyRGF0YSkge1xuXHRjb25zdCB7IHRlcm1pbmF0ZVRpbWVvdXQgfSA9IHdvcmtlckRhdGE7XG5cdGlmICh0ZXJtaW5hdGVUaW1lb3V0KSB7XG5cdFx0Y2xlYXJUaW1lb3V0KHRlcm1pbmF0ZVRpbWVvdXQpO1xuXHRcdHdvcmtlckRhdGEudGVybWluYXRlVGltZW91dCA9IG51bGw7XG5cdH1cbn1cblxuZnVuY3Rpb24gdGVybWluYXRlV29ya2VycygpIHtcblx0cG9vbC5mb3JFYWNoKHdvcmtlckRhdGEgPT4ge1xuXHRcdGNsZWFyVGVybWluYXRlVGltZW91dCh3b3JrZXJEYXRhKTtcblx0XHR3b3JrZXJEYXRhLnRlcm1pbmF0ZSgpO1xuXHR9KTtcbn0iLCIvKlxuIENvcHlyaWdodCAoYykgMjAyMiBHaWxkYXMgTG9ybWVhdS4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG5cbiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBcbiBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gXG4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cbiAzLiBUaGUgbmFtZXMgb2YgdGhlIGF1dGhvcnMgbWF5IG5vdCBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0c1xuIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWMgcHJpb3Igd3JpdHRlbiBwZXJtaXNzaW9uLlxuXG4gVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnJ0FTIElTJycgQU5EIEFOWSBFWFBSRVNTRUQgT1IgSU1QTElFRCBXQVJSQU5USUVTLFxuIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkRcbiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgSkNSQUZULFxuIElOQy4gT1IgQU5ZIENPTlRSSUJVVE9SUyBUTyBUSElTIFNPRlRXQVJFIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsXG4gSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVFxuIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLFxuIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcbiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSxcbiBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5cbi8qIGdsb2JhbCBCbG9iLCBhdG9iLCBidG9hLCBYTUxIdHRwUmVxdWVzdCwgVVJMLCBmZXRjaCwgUmVhZGFibGVTdHJlYW0sIFdyaXRhYmxlU3RyZWFtLCBGaWxlUmVhZGVyLCBUcmFuc2Zvcm1TdHJlYW0sIFJlc3BvbnNlICovXG4vLyBkZW5vLWxpbnQtaWdub3JlLWZpbGUgbm8tdGhpcy1hbGlhc1xuXG5pbXBvcnQge1xuXHRVTkRFRklORURfVkFMVUUsXG5cdEZVTkNUSU9OX1RZUEVcbn0gZnJvbSBcIi4vY29uc3RhbnRzLmpzXCI7XG5pbXBvcnQgeyBnZXRDb25maWd1cmF0aW9uIH0gZnJvbSBcIi4vY29uZmlndXJhdGlvbi5qc1wiO1xuXG5jb25zdCBFUlJfSFRUUF9TVEFUVVMgPSBcIkhUVFAgZXJyb3IgXCI7XG5jb25zdCBFUlJfSFRUUF9SQU5HRSA9IFwiSFRUUCBSYW5nZSBub3Qgc3VwcG9ydGVkXCI7XG5jb25zdCBFUlJfSVRFUkFUT1JfQ09NUExFVEVEX1RPT19TT09OID0gXCJXcml0ZXIgaXRlcmF0b3IgY29tcGxldGVkIHRvbyBzb29uXCI7XG5cbmNvbnN0IENPTlRFTlRfVFlQRV9URVhUX1BMQUlOID0gXCJ0ZXh0L3BsYWluXCI7XG5jb25zdCBIVFRQX0hFQURFUl9DT05URU5UX0xFTkdUSCA9IFwiQ29udGVudC1MZW5ndGhcIjtcbmNvbnN0IEhUVFBfSEVBREVSX0NPTlRFTlRfUkFOR0UgPSBcIkNvbnRlbnQtUmFuZ2VcIjtcbmNvbnN0IEhUVFBfSEVBREVSX0FDQ0VQVF9SQU5HRVMgPSBcIkFjY2VwdC1SYW5nZXNcIjtcbmNvbnN0IEhUVFBfSEVBREVSX1JBTkdFID0gXCJSYW5nZVwiO1xuY29uc3QgSFRUUF9IRUFERVJfQ09OVEVOVF9UWVBFID0gXCJDb250ZW50LVR5cGVcIjtcbmNvbnN0IEhUVFBfTUVUSE9EX0hFQUQgPSBcIkhFQURcIjtcbmNvbnN0IEhUVFBfTUVUSE9EX0dFVCA9IFwiR0VUXCI7XG5jb25zdCBIVFRQX1JBTkdFX1VOSVQgPSBcImJ5dGVzXCI7XG5jb25zdCBERUZBVUxUX0NIVU5LX1NJWkUgPSA2NCAqIDEwMjQ7XG5cbmNvbnN0IFBST1BFUlRZX05BTUVfV1JJVEFCTEUgPSBcIndyaXRhYmxlXCI7XG5cbmNsYXNzIFN0cmVhbSB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5zaXplID0gMDtcblx0fVxuXG5cdGluaXQoKSB7XG5cdFx0dGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG5cdH1cbn1cblxuY2xhc3MgUmVhZGVyIGV4dGVuZHMgU3RyZWFtIHtcblxuXHRnZXQgcmVhZGFibGUoKSB7XG5cdFx0Y29uc3QgcmVhZGVyID0gdGhpcztcblx0XHRjb25zdCB7IGNodW5rU2l6ZSA9IERFRkFVTFRfQ0hVTktfU0laRSB9ID0gcmVhZGVyO1xuXHRcdGNvbnN0IHJlYWRhYmxlID0gbmV3IFJlYWRhYmxlU3RyZWFtKHtcblx0XHRcdHN0YXJ0KCkge1xuXHRcdFx0XHR0aGlzLmNodW5rT2Zmc2V0ID0gMDtcblx0XHRcdH0sXG5cdFx0XHRhc3luYyBwdWxsKGNvbnRyb2xsZXIpIHtcblx0XHRcdFx0Y29uc3QgeyBvZmZzZXQgPSAwLCBzaXplLCBkaXNrTnVtYmVyU3RhcnQgfSA9IHJlYWRhYmxlO1xuXHRcdFx0XHRjb25zdCB7IGNodW5rT2Zmc2V0IH0gPSB0aGlzO1xuXHRcdFx0XHRjb250cm9sbGVyLmVucXVldWUoYXdhaXQgcmVhZFVpbnQ4QXJyYXkocmVhZGVyLCBvZmZzZXQgKyBjaHVua09mZnNldCwgTWF0aC5taW4oY2h1bmtTaXplLCBzaXplIC0gY2h1bmtPZmZzZXQpLCBkaXNrTnVtYmVyU3RhcnQpKTtcblx0XHRcdFx0aWYgKGNodW5rT2Zmc2V0ICsgY2h1bmtTaXplID4gc2l6ZSkge1xuXHRcdFx0XHRcdGNvbnRyb2xsZXIuY2xvc2UoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLmNodW5rT2Zmc2V0ICs9IGNodW5rU2l6ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiByZWFkYWJsZTtcblx0fVxufVxuXG5jbGFzcyBXcml0ZXIgZXh0ZW5kcyBTdHJlYW0ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0Y29uc3Qgd3JpdGVyID0gdGhpcztcblx0XHRjb25zdCB3cml0YWJsZSA9IG5ldyBXcml0YWJsZVN0cmVhbSh7XG5cdFx0XHR3cml0ZShjaHVuaykge1xuXHRcdFx0XHRyZXR1cm4gd3JpdGVyLndyaXRlVWludDhBcnJheShjaHVuayk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHdyaXRlciwgUFJPUEVSVFlfTkFNRV9XUklUQUJMRSwge1xuXHRcdFx0Z2V0KCkge1xuXHRcdFx0XHRyZXR1cm4gd3JpdGFibGU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHR3cml0ZVVpbnQ4QXJyYXkoKSB7XG5cdFx0Ly8gYWJzdHJhY3Rcblx0fVxufVxuXG5jbGFzcyBEYXRhNjRVUklSZWFkZXIgZXh0ZW5kcyBSZWFkZXIge1xuXG5cdGNvbnN0cnVjdG9yKGRhdGFVUkkpIHtcblx0XHRzdXBlcigpO1xuXHRcdGxldCBkYXRhRW5kID0gZGF0YVVSSS5sZW5ndGg7XG5cdFx0d2hpbGUgKGRhdGFVUkkuY2hhckF0KGRhdGFFbmQgLSAxKSA9PSBcIj1cIikge1xuXHRcdFx0ZGF0YUVuZC0tO1xuXHRcdH1cblx0XHRjb25zdCBkYXRhU3RhcnQgPSBkYXRhVVJJLmluZGV4T2YoXCIsXCIpICsgMTtcblx0XHRPYmplY3QuYXNzaWduKHRoaXMsIHtcblx0XHRcdGRhdGFVUkksXG5cdFx0XHRkYXRhU3RhcnQsXG5cdFx0XHRzaXplOiBNYXRoLmZsb29yKChkYXRhRW5kIC0gZGF0YVN0YXJ0KSAqIDAuNzUpXG5cdFx0fSk7XG5cdH1cblxuXHRyZWFkVWludDhBcnJheShvZmZzZXQsIGxlbmd0aCkge1xuXHRcdGNvbnN0IHtcblx0XHRcdGRhdGFTdGFydCxcblx0XHRcdGRhdGFVUklcblx0XHR9ID0gdGhpcztcblx0XHRjb25zdCBkYXRhQXJyYXkgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuXHRcdGNvbnN0IHN0YXJ0ID0gTWF0aC5mbG9vcihvZmZzZXQgLyAzKSAqIDQ7XG5cdFx0Y29uc3QgYnl0ZXMgPSBhdG9iKGRhdGFVUkkuc3Vic3RyaW5nKHN0YXJ0ICsgZGF0YVN0YXJ0LCBNYXRoLmNlaWwoKG9mZnNldCArIGxlbmd0aCkgLyAzKSAqIDQgKyBkYXRhU3RhcnQpKTtcblx0XHRjb25zdCBkZWx0YSA9IG9mZnNldCAtIE1hdGguZmxvb3Ioc3RhcnQgLyA0KSAqIDM7XG5cdFx0Zm9yIChsZXQgaW5kZXhCeXRlID0gZGVsdGE7IGluZGV4Qnl0ZSA8IGRlbHRhICsgbGVuZ3RoOyBpbmRleEJ5dGUrKykge1xuXHRcdFx0ZGF0YUFycmF5W2luZGV4Qnl0ZSAtIGRlbHRhXSA9IGJ5dGVzLmNoYXJDb2RlQXQoaW5kZXhCeXRlKTtcblx0XHR9XG5cdFx0cmV0dXJuIGRhdGFBcnJheTtcblx0fVxufVxuXG5jbGFzcyBEYXRhNjRVUklXcml0ZXIgZXh0ZW5kcyBXcml0ZXIge1xuXG5cdGNvbnN0cnVjdG9yKGNvbnRlbnRUeXBlKSB7XG5cdFx0c3VwZXIoKTtcblx0XHRPYmplY3QuYXNzaWduKHRoaXMsIHtcblx0XHRcdGRhdGE6IFwiZGF0YTpcIiArIChjb250ZW50VHlwZSB8fCBcIlwiKSArIFwiO2Jhc2U2NCxcIixcblx0XHRcdHBlbmRpbmc6IFtdXG5cdFx0fSk7XG5cdH1cblxuXHR3cml0ZVVpbnQ4QXJyYXkoYXJyYXkpIHtcblx0XHRjb25zdCB3cml0ZXIgPSB0aGlzO1xuXHRcdGxldCBpbmRleEFycmF5ID0gMDtcblx0XHRsZXQgZGF0YVN0cmluZyA9IHdyaXRlci5wZW5kaW5nO1xuXHRcdGNvbnN0IGRlbHRhID0gd3JpdGVyLnBlbmRpbmcubGVuZ3RoO1xuXHRcdHdyaXRlci5wZW5kaW5nID0gXCJcIjtcblx0XHRmb3IgKGluZGV4QXJyYXkgPSAwOyBpbmRleEFycmF5IDwgKE1hdGguZmxvb3IoKGRlbHRhICsgYXJyYXkubGVuZ3RoKSAvIDMpICogMykgLSBkZWx0YTsgaW5kZXhBcnJheSsrKSB7XG5cdFx0XHRkYXRhU3RyaW5nICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYXJyYXlbaW5kZXhBcnJheV0pO1xuXHRcdH1cblx0XHRmb3IgKDsgaW5kZXhBcnJheSA8IGFycmF5Lmxlbmd0aDsgaW5kZXhBcnJheSsrKSB7XG5cdFx0XHR3cml0ZXIucGVuZGluZyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGFycmF5W2luZGV4QXJyYXldKTtcblx0XHR9XG5cdFx0aWYgKGRhdGFTdHJpbmcubGVuZ3RoID4gMikge1xuXHRcdFx0d3JpdGVyLmRhdGEgKz0gYnRvYShkYXRhU3RyaW5nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0d3JpdGVyLnBlbmRpbmcgPSBkYXRhU3RyaW5nO1xuXHRcdH1cblx0fVxuXG5cdGdldERhdGEoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YSArIGJ0b2EodGhpcy5wZW5kaW5nKTtcblx0fVxufVxuXG5jbGFzcyBCbG9iUmVhZGVyIGV4dGVuZHMgUmVhZGVyIHtcblxuXHRjb25zdHJ1Y3RvcihibG9iKSB7XG5cdFx0c3VwZXIoKTtcblx0XHRPYmplY3QuYXNzaWduKHRoaXMsIHtcblx0XHRcdGJsb2IsXG5cdFx0XHRzaXplOiBibG9iLnNpemVcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJlYWRVaW50OEFycmF5KG9mZnNldCwgbGVuZ3RoKSB7XG5cdFx0Y29uc3QgcmVhZGVyID0gdGhpcztcblx0XHRjb25zdCBvZmZzZXRFbmQgPSBvZmZzZXQgKyBsZW5ndGg7XG5cdFx0Y29uc3QgYmxvYiA9IG9mZnNldCB8fCBvZmZzZXRFbmQgPCByZWFkZXIuc2l6ZSA/IHJlYWRlci5ibG9iLnNsaWNlKG9mZnNldCwgb2Zmc2V0RW5kKSA6IHJlYWRlci5ibG9iO1xuXHRcdGxldCBhcnJheUJ1ZmZlciA9IGF3YWl0IGJsb2IuYXJyYXlCdWZmZXIoKTtcblx0XHRpZiAoYXJyYXlCdWZmZXIuYnl0ZUxlbmd0aCA+IGxlbmd0aCkge1xuXHRcdFx0YXJyYXlCdWZmZXIgPSBhcnJheUJ1ZmZlci5zbGljZShvZmZzZXQsIG9mZnNldEVuZCk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgVWludDhBcnJheShhcnJheUJ1ZmZlcik7XG5cdH1cbn1cblxuY2xhc3MgQmxvYldyaXRlciBleHRlbmRzIFN0cmVhbSB7XG5cblx0Y29uc3RydWN0b3IoY29udGVudFR5cGUpIHtcblx0XHRzdXBlcigpO1xuXHRcdGNvbnN0IHdyaXRlciA9IHRoaXM7XG5cdFx0Y29uc3QgdHJhbnNmb3JtU3RyZWFtID0gbmV3IFRyYW5zZm9ybVN0cmVhbSgpO1xuXHRcdGNvbnN0IGhlYWRlcnMgPSBbXTtcblx0XHRpZiAoY29udGVudFR5cGUpIHtcblx0XHRcdGhlYWRlcnMucHVzaChbSFRUUF9IRUFERVJfQ09OVEVOVF9UWVBFLCBjb250ZW50VHlwZV0pO1xuXHRcdH1cblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkod3JpdGVyLCBQUk9QRVJUWV9OQU1FX1dSSVRBQkxFLCB7XG5cdFx0XHRnZXQoKSB7XG5cdFx0XHRcdHJldHVybiB0cmFuc2Zvcm1TdHJlYW0ud3JpdGFibGU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0d3JpdGVyLmJsb2IgPSBuZXcgUmVzcG9uc2UodHJhbnNmb3JtU3RyZWFtLnJlYWRhYmxlLCB7IGhlYWRlcnMgfSkuYmxvYigpO1xuXHR9XG5cblx0Z2V0RGF0YSgpIHtcblx0XHRyZXR1cm4gdGhpcy5ibG9iO1xuXHR9XG59XG5cbmNsYXNzIFRleHRSZWFkZXIgZXh0ZW5kcyBCbG9iUmVhZGVyIHtcblxuXHRjb25zdHJ1Y3Rvcih0ZXh0KSB7XG5cdFx0c3VwZXIobmV3IEJsb2IoW3RleHRdLCB7IHR5cGU6IENPTlRFTlRfVFlQRV9URVhUX1BMQUlOIH0pKTtcblx0fVxufVxuXG5jbGFzcyBUZXh0V3JpdGVyIGV4dGVuZHMgQmxvYldyaXRlciB7XG5cblx0Y29uc3RydWN0b3IoZW5jb2RpbmcpIHtcblx0XHRzdXBlcihlbmNvZGluZyk7XG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLCB7XG5cdFx0XHRlbmNvZGluZyxcblx0XHRcdHV0Zjg6ICFlbmNvZGluZyB8fCBlbmNvZGluZy50b0xvd2VyQ2FzZSgpID09IFwidXRmLThcIlxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgZ2V0RGF0YSgpIHtcblx0XHRjb25zdCB7XG5cdFx0XHRlbmNvZGluZyxcblx0XHRcdHV0Zjhcblx0XHR9ID0gdGhpcztcblx0XHRjb25zdCBibG9iID0gYXdhaXQgc3VwZXIuZ2V0RGF0YSgpO1xuXHRcdGlmIChibG9iLnRleHQgJiYgdXRmOCkge1xuXHRcdFx0cmV0dXJuIGJsb2IudGV4dCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0T2JqZWN0LmFzc2lnbihyZWFkZXIsIHtcblx0XHRcdFx0XHRvbmxvYWQ6ICh7IHRhcmdldCB9KSA9PiByZXNvbHZlKHRhcmdldC5yZXN1bHQpLFxuXHRcdFx0XHRcdG9uZXJyb3I6ICgpID0+IHJlamVjdChyZWFkZXIuZXJyb3IpXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZWFkZXIucmVhZEFzVGV4dChibG9iLCBlbmNvZGluZyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgRmV0Y2hSZWFkZXIgZXh0ZW5kcyBSZWFkZXIge1xuXG5cdGNvbnN0cnVjdG9yKHVybCwgb3B0aW9ucykge1xuXHRcdHN1cGVyKCk7XG5cdFx0Y3JlYXRlSHRwUmVhZGVyKHRoaXMsIHVybCwgb3B0aW9ucyk7XG5cdH1cblxuXHRhc3luYyBpbml0KCkge1xuXHRcdGF3YWl0IGluaXRIdHRwUmVhZGVyKHRoaXMsIHNlbmRGZXRjaFJlcXVlc3QsIGdldEZldGNoUmVxdWVzdERhdGEpO1xuXHRcdHN1cGVyLmluaXQoKTtcblx0fVxuXG5cdHJlYWRVaW50OEFycmF5KGluZGV4LCBsZW5ndGgpIHtcblx0XHRyZXR1cm4gcmVhZFVpbnQ4QXJyYXlIdHRwUmVhZGVyKHRoaXMsIGluZGV4LCBsZW5ndGgsIHNlbmRGZXRjaFJlcXVlc3QsIGdldEZldGNoUmVxdWVzdERhdGEpO1xuXHR9XG59XG5cbmNsYXNzIFhIUlJlYWRlciBleHRlbmRzIFJlYWRlciB7XG5cblx0Y29uc3RydWN0b3IodXJsLCBvcHRpb25zKSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjcmVhdGVIdHBSZWFkZXIodGhpcywgdXJsLCBvcHRpb25zKTtcblx0fVxuXG5cdGFzeW5jIGluaXQoKSB7XG5cdFx0YXdhaXQgaW5pdEh0dHBSZWFkZXIodGhpcywgc2VuZFhNTEh0dHBSZXF1ZXN0LCBnZXRYTUxIdHRwUmVxdWVzdERhdGEpO1xuXHRcdHN1cGVyLmluaXQoKTtcblx0fVxuXG5cdHJlYWRVaW50OEFycmF5KGluZGV4LCBsZW5ndGgpIHtcblx0XHRyZXR1cm4gcmVhZFVpbnQ4QXJyYXlIdHRwUmVhZGVyKHRoaXMsIGluZGV4LCBsZW5ndGgsIHNlbmRYTUxIdHRwUmVxdWVzdCwgZ2V0WE1MSHR0cFJlcXVlc3REYXRhKTtcblx0fVxufVxuXG5mdW5jdGlvbiBjcmVhdGVIdHBSZWFkZXIoaHR0cFJlYWRlciwgdXJsLCBvcHRpb25zKSB7XG5cdGNvbnN0IHtcblx0XHRwcmV2ZW50SGVhZFJlcXVlc3QsXG5cdFx0dXNlUmFuZ2VIZWFkZXIsXG5cdFx0Zm9yY2VSYW5nZVJlcXVlc3RzXG5cdH0gPSBvcHRpb25zO1xuXHRvcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucyk7XG5cdGRlbGV0ZSBvcHRpb25zLnByZXZlbnRIZWFkUmVxdWVzdDtcblx0ZGVsZXRlIG9wdGlvbnMudXNlUmFuZ2VIZWFkZXI7XG5cdGRlbGV0ZSBvcHRpb25zLmZvcmNlUmFuZ2VSZXF1ZXN0cztcblx0ZGVsZXRlIG9wdGlvbnMudXNlWEhSO1xuXHRPYmplY3QuYXNzaWduKGh0dHBSZWFkZXIsIHtcblx0XHR1cmwsXG5cdFx0b3B0aW9ucyxcblx0XHRwcmV2ZW50SGVhZFJlcXVlc3QsXG5cdFx0dXNlUmFuZ2VIZWFkZXIsXG5cdFx0Zm9yY2VSYW5nZVJlcXVlc3RzXG5cdH0pO1xufVxuXG5hc3luYyBmdW5jdGlvbiBpbml0SHR0cFJlYWRlcihodHRwUmVhZGVyLCBzZW5kUmVxdWVzdCwgZ2V0UmVxdWVzdERhdGEpIHtcblx0Y29uc3Qge1xuXHRcdHVybCxcblx0XHR1c2VSYW5nZUhlYWRlcixcblx0XHRmb3JjZVJhbmdlUmVxdWVzdHNcblx0fSA9IGh0dHBSZWFkZXI7XG5cdGlmIChpc0h0dHBGYW1pbHkodXJsKSAmJiAodXNlUmFuZ2VIZWFkZXIgfHwgZm9yY2VSYW5nZVJlcXVlc3RzKSkge1xuXHRcdGNvbnN0IHsgaGVhZGVycyB9ID0gYXdhaXQgc2VuZFJlcXVlc3QoSFRUUF9NRVRIT0RfR0VULCBodHRwUmVhZGVyLCBnZXRSYW5nZUhlYWRlcnMoaHR0cFJlYWRlcikpO1xuXHRcdGlmICghZm9yY2VSYW5nZVJlcXVlc3RzICYmIGhlYWRlcnMuZ2V0KEhUVFBfSEVBREVSX0FDQ0VQVF9SQU5HRVMpICE9IEhUVFBfUkFOR0VfVU5JVCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKEVSUl9IVFRQX1JBTkdFKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGV0IGNvbnRlbnRTaXplO1xuXHRcdFx0Y29uc3QgY29udGVudFJhbmdlSGVhZGVyID0gaGVhZGVycy5nZXQoSFRUUF9IRUFERVJfQ09OVEVOVF9SQU5HRSk7XG5cdFx0XHRpZiAoY29udGVudFJhbmdlSGVhZGVyKSB7XG5cdFx0XHRcdGNvbnN0IHNwbGl0SGVhZGVyID0gY29udGVudFJhbmdlSGVhZGVyLnRyaW0oKS5zcGxpdCgvXFxzKlxcL1xccyovKTtcblx0XHRcdFx0aWYgKHNwbGl0SGVhZGVyLmxlbmd0aCkge1xuXHRcdFx0XHRcdGNvbnN0IGhlYWRlclZhbHVlID0gc3BsaXRIZWFkZXJbMV07XG5cdFx0XHRcdFx0aWYgKGhlYWRlclZhbHVlICYmIGhlYWRlclZhbHVlICE9IFwiKlwiKSB7XG5cdFx0XHRcdFx0XHRjb250ZW50U2l6ZSA9IE51bWJlcihoZWFkZXJWYWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoY29udGVudFNpemUgPT09IFVOREVGSU5FRF9WQUxVRSkge1xuXHRcdFx0XHRhd2FpdCBnZXRDb250ZW50TGVuZ3RoKGh0dHBSZWFkZXIsIHNlbmRSZXF1ZXN0LCBnZXRSZXF1ZXN0RGF0YSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRodHRwUmVhZGVyLnNpemUgPSBjb250ZW50U2l6ZTtcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0YXdhaXQgZ2V0Q29udGVudExlbmd0aChodHRwUmVhZGVyLCBzZW5kUmVxdWVzdCwgZ2V0UmVxdWVzdERhdGEpO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlYWRVaW50OEFycmF5SHR0cFJlYWRlcihodHRwUmVhZGVyLCBpbmRleCwgbGVuZ3RoLCBzZW5kUmVxdWVzdCwgZ2V0UmVxdWVzdERhdGEpIHtcblx0Y29uc3Qge1xuXHRcdHVzZVJhbmdlSGVhZGVyLFxuXHRcdGZvcmNlUmFuZ2VSZXF1ZXN0cyxcblx0XHRvcHRpb25zXG5cdH0gPSBodHRwUmVhZGVyO1xuXHRpZiAodXNlUmFuZ2VIZWFkZXIgfHwgZm9yY2VSYW5nZVJlcXVlc3RzKSB7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzZW5kUmVxdWVzdChIVFRQX01FVEhPRF9HRVQsIGh0dHBSZWFkZXIsIGdldFJhbmdlSGVhZGVycyhodHRwUmVhZGVyLCBpbmRleCwgbGVuZ3RoKSk7XG5cdFx0aWYgKHJlc3BvbnNlLnN0YXR1cyAhPSAyMDYpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihFUlJfSFRUUF9SQU5HRSk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgVWludDhBcnJheShhd2FpdCByZXNwb25zZS5hcnJheUJ1ZmZlcigpKTtcblx0fSBlbHNlIHtcblx0XHRjb25zdCB7IGRhdGEgfSA9IGh0dHBSZWFkZXI7XG5cdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRhd2FpdCBnZXRSZXF1ZXN0RGF0YShodHRwUmVhZGVyLCBvcHRpb25zKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBVaW50OEFycmF5KGh0dHBSZWFkZXIuZGF0YS5zdWJhcnJheShpbmRleCwgaW5kZXggKyBsZW5ndGgpKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRSYW5nZUhlYWRlcnMoaHR0cFJlYWRlciwgaW5kZXggPSAwLCBsZW5ndGggPSAxKSB7XG5cdHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBnZXRIZWFkZXJzKGh0dHBSZWFkZXIpLCB7IFtIVFRQX0hFQURFUl9SQU5HRV06IEhUVFBfUkFOR0VfVU5JVCArIFwiPVwiICsgaW5kZXggKyBcIi1cIiArIChpbmRleCArIGxlbmd0aCAtIDEpIH0pO1xufVxuXG5mdW5jdGlvbiBnZXRIZWFkZXJzKHsgb3B0aW9ucyB9KSB7XG5cdGNvbnN0IHsgaGVhZGVycyB9ID0gb3B0aW9ucztcblx0aWYgKGhlYWRlcnMpIHtcblx0XHRpZiAoU3ltYm9sLml0ZXJhdG9yIGluIGhlYWRlcnMpIHtcblx0XHRcdHJldHVybiBPYmplY3QuZnJvbUVudHJpZXMoaGVhZGVycyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBoZWFkZXJzO1xuXHRcdH1cblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRGZXRjaFJlcXVlc3REYXRhKGh0dHBSZWFkZXIpIHtcblx0YXdhaXQgZ2V0UmVxdWVzdERhdGEoaHR0cFJlYWRlciwgc2VuZEZldGNoUmVxdWVzdCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFhNTEh0dHBSZXF1ZXN0RGF0YShodHRwUmVhZGVyKSB7XG5cdGF3YWl0IGdldFJlcXVlc3REYXRhKGh0dHBSZWFkZXIsIHNlbmRYTUxIdHRwUmVxdWVzdCk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldFJlcXVlc3REYXRhKGh0dHBSZWFkZXIsIHNlbmRSZXF1ZXN0KSB7XG5cdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc2VuZFJlcXVlc3QoSFRUUF9NRVRIT0RfR0VULCBodHRwUmVhZGVyLCBnZXRIZWFkZXJzKGh0dHBSZWFkZXIpKTtcblx0aHR0cFJlYWRlci5kYXRhID0gbmV3IFVpbnQ4QXJyYXkoYXdhaXQgcmVzcG9uc2UuYXJyYXlCdWZmZXIoKSk7XG5cdGlmICghaHR0cFJlYWRlci5zaXplKSB7XG5cdFx0aHR0cFJlYWRlci5zaXplID0gaHR0cFJlYWRlci5kYXRhLmxlbmd0aDtcblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRDb250ZW50TGVuZ3RoKGh0dHBSZWFkZXIsIHNlbmRSZXF1ZXN0LCBnZXRSZXF1ZXN0RGF0YSkge1xuXHRpZiAoaHR0cFJlYWRlci5wcmV2ZW50SGVhZFJlcXVlc3QpIHtcblx0XHRhd2FpdCBnZXRSZXF1ZXN0RGF0YShodHRwUmVhZGVyLCBodHRwUmVhZGVyLm9wdGlvbnMpO1xuXHR9IGVsc2Uge1xuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgc2VuZFJlcXVlc3QoSFRUUF9NRVRIT0RfSEVBRCwgaHR0cFJlYWRlciwgZ2V0SGVhZGVycyhodHRwUmVhZGVyKSk7XG5cdFx0Y29uc3QgY29udGVudExlbmd0aCA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KEhUVFBfSEVBREVSX0NPTlRFTlRfTEVOR1RIKTtcblx0XHRpZiAoY29udGVudExlbmd0aCkge1xuXHRcdFx0aHR0cFJlYWRlci5zaXplID0gTnVtYmVyKGNvbnRlbnRMZW5ndGgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCBnZXRSZXF1ZXN0RGF0YShodHRwUmVhZGVyLCBodHRwUmVhZGVyLm9wdGlvbnMpO1xuXHRcdH1cblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBzZW5kRmV0Y2hSZXF1ZXN0KG1ldGhvZCwgeyBvcHRpb25zLCB1cmwgfSwgaGVhZGVycykge1xuXHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwgT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywgeyBtZXRob2QsIGhlYWRlcnMgfSkpO1xuXHRpZiAocmVzcG9uc2Uuc3RhdHVzIDwgNDAwKSB7XG5cdFx0cmV0dXJuIHJlc3BvbnNlO1xuXHR9IGVsc2Uge1xuXHRcdHRocm93IHJlc3BvbnNlLnN0YXR1cyA9PSA0MTYgPyBuZXcgRXJyb3IoRVJSX0hUVFBfUkFOR0UpIDogbmV3IEVycm9yKEVSUl9IVFRQX1NUQVRVUyArIChyZXNwb25zZS5zdGF0dXNUZXh0IHx8IHJlc3BvbnNlLnN0YXR1cykpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHNlbmRYTUxIdHRwUmVxdWVzdChtZXRob2QsIHsgdXJsIH0sIGhlYWRlcnMpIHtcblx0cmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRjb25zdCByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cdFx0cmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKFwibG9hZFwiLCAoKSA9PiB7XG5cdFx0XHRpZiAocmVxdWVzdC5zdGF0dXMgPCA0MDApIHtcblx0XHRcdFx0Y29uc3QgaGVhZGVycyA9IFtdO1xuXHRcdFx0XHRyZXF1ZXN0LmdldEFsbFJlc3BvbnNlSGVhZGVycygpLnRyaW0oKS5zcGxpdCgvW1xcclxcbl0rLykuZm9yRWFjaChoZWFkZXIgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHNwbGl0SGVhZGVyID0gaGVhZGVyLnRyaW0oKS5zcGxpdCgvXFxzKjpcXHMqLyk7XG5cdFx0XHRcdFx0c3BsaXRIZWFkZXJbMF0gPSBzcGxpdEhlYWRlclswXS50cmltKCkucmVwbGFjZSgvXlthLXpdfC1bYS16XS9nLCB2YWx1ZSA9PiB2YWx1ZS50b1VwcGVyQ2FzZSgpKTtcblx0XHRcdFx0XHRoZWFkZXJzLnB1c2goc3BsaXRIZWFkZXIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmVzb2x2ZSh7XG5cdFx0XHRcdFx0c3RhdHVzOiByZXF1ZXN0LnN0YXR1cyxcblx0XHRcdFx0XHRhcnJheUJ1ZmZlcjogKCkgPT4gcmVxdWVzdC5yZXNwb25zZSxcblx0XHRcdFx0XHRoZWFkZXJzOiBuZXcgTWFwKGhlYWRlcnMpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVqZWN0KHJlcXVlc3Quc3RhdHVzID09IDQxNiA/IG5ldyBFcnJvcihFUlJfSFRUUF9SQU5HRSkgOiBuZXcgRXJyb3IoRVJSX0hUVFBfU1RBVFVTICsgKHJlcXVlc3Quc3RhdHVzVGV4dCB8fCByZXF1ZXN0LnN0YXR1cykpKTtcblx0XHRcdH1cblx0XHR9LCBmYWxzZSk7XG5cdFx0cmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKFwiZXJyb3JcIiwgZXZlbnQgPT4gcmVqZWN0KGV2ZW50LmRldGFpbCA/IGV2ZW50LmRldGFpbC5lcnJvciA6IG5ldyBFcnJvcihcIk5ldHdvcmsgZXJyb3JcIikpLCBmYWxzZSk7XG5cdFx0cmVxdWVzdC5vcGVuKG1ldGhvZCwgdXJsKTtcblx0XHRpZiAoaGVhZGVycykge1xuXHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBPYmplY3QuZW50cmllcyhoZWFkZXJzKSkge1xuXHRcdFx0XHRyZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoZW50cnlbMF0sIGVudHJ5WzFdKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmVxdWVzdC5yZXNwb25zZVR5cGUgPSBcImFycmF5YnVmZmVyXCI7XG5cdFx0cmVxdWVzdC5zZW5kKCk7XG5cdH0pO1xufVxuXG5jbGFzcyBIdHRwUmVhZGVyIGV4dGVuZHMgUmVhZGVyIHtcblxuXHRjb25zdHJ1Y3Rvcih1cmwsIG9wdGlvbnMgPSB7fSkge1xuXHRcdHN1cGVyKCk7XG5cdFx0T2JqZWN0LmFzc2lnbih0aGlzLCB7XG5cdFx0XHR1cmwsXG5cdFx0XHRyZWFkZXI6IG9wdGlvbnMudXNlWEhSID8gbmV3IFhIUlJlYWRlcih1cmwsIG9wdGlvbnMpIDogbmV3IEZldGNoUmVhZGVyKHVybCwgb3B0aW9ucylcblx0XHR9KTtcblx0fVxuXG5cdHNldCBzaXplKHZhbHVlKSB7XG5cdFx0Ly8gaWdub3JlZFxuXHR9XG5cblx0Z2V0IHNpemUoKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZGVyLnNpemU7XG5cdH1cblxuXHRhc3luYyBpbml0KCkge1xuXHRcdGF3YWl0IHRoaXMucmVhZGVyLmluaXQoKTtcblx0XHRzdXBlci5pbml0KCk7XG5cdH1cblxuXHRyZWFkVWludDhBcnJheShpbmRleCwgbGVuZ3RoKSB7XG5cdFx0cmV0dXJuIHRoaXMucmVhZGVyLnJlYWRVaW50OEFycmF5KGluZGV4LCBsZW5ndGgpO1xuXHR9XG59XG5cbmNsYXNzIEh0dHBSYW5nZVJlYWRlciBleHRlbmRzIEh0dHBSZWFkZXIge1xuXG5cdGNvbnN0cnVjdG9yKHVybCwgb3B0aW9ucyA9IHt9KSB7XG5cdFx0b3B0aW9ucy51c2VSYW5nZUhlYWRlciA9IHRydWU7XG5cdFx0c3VwZXIodXJsLCBvcHRpb25zKTtcblx0fVxufVxuXG5cbmNsYXNzIFVpbnQ4QXJyYXlSZWFkZXIgZXh0ZW5kcyBSZWFkZXIge1xuXG5cdGNvbnN0cnVjdG9yKGFycmF5KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRPYmplY3QuYXNzaWduKHRoaXMsIHtcblx0XHRcdGFycmF5LFxuXHRcdFx0c2l6ZTogYXJyYXkubGVuZ3RoXG5cdFx0fSk7XG5cdH1cblxuXHRyZWFkVWludDhBcnJheShpbmRleCwgbGVuZ3RoKSB7XG5cdFx0cmV0dXJuIHRoaXMuYXJyYXkuc2xpY2UoaW5kZXgsIGluZGV4ICsgbGVuZ3RoKTtcblx0fVxufVxuXG5jbGFzcyBVaW50OEFycmF5V3JpdGVyIGV4dGVuZHMgV3JpdGVyIHtcblxuXHRpbml0KGluaXRTaXplID0gMCkge1xuXHRcdE9iamVjdC5hc3NpZ24odGhpcywge1xuXHRcdFx0b2Zmc2V0OiAwLFxuXHRcdFx0YXJyYXk6IG5ldyBVaW50OEFycmF5KGluaXRTaXplKVxuXHRcdH0pO1xuXHRcdHN1cGVyLmluaXQoKTtcblx0fVxuXG5cdHdyaXRlVWludDhBcnJheShhcnJheSkge1xuXHRcdGNvbnN0IHdyaXRlciA9IHRoaXM7XG5cdFx0aWYgKHdyaXRlci5vZmZzZXQgKyBhcnJheS5sZW5ndGggPiB3cml0ZXIuYXJyYXkubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBwcmV2aW91c0FycmF5ID0gd3JpdGVyLmFycmF5O1xuXHRcdFx0d3JpdGVyLmFycmF5ID0gbmV3IFVpbnQ4QXJyYXkocHJldmlvdXNBcnJheS5sZW5ndGggKyBhcnJheS5sZW5ndGgpO1xuXHRcdFx0d3JpdGVyLmFycmF5LnNldChwcmV2aW91c0FycmF5KTtcblx0XHR9XG5cdFx0d3JpdGVyLmFycmF5LnNldChhcnJheSwgd3JpdGVyLm9mZnNldCk7XG5cdFx0d3JpdGVyLm9mZnNldCArPSBhcnJheS5sZW5ndGg7XG5cdH1cblxuXHRnZXREYXRhKCkge1xuXHRcdHJldHVybiB0aGlzLmFycmF5O1xuXHR9XG59XG5cbmNsYXNzIFNwbGl0RGF0YVJlYWRlciBleHRlbmRzIFJlYWRlciB7XG5cblx0Y29uc3RydWN0b3IocmVhZGVycykge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5yZWFkZXJzID0gcmVhZGVycztcblx0fVxuXG5cdGFzeW5jIGluaXQoKSB7XG5cdFx0Y29uc3QgcmVhZGVyID0gdGhpcztcblx0XHRjb25zdCB7IHJlYWRlcnMgfSA9IHJlYWRlcjtcblx0XHRyZWFkZXIubGFzdERpc2tOdW1iZXIgPSAwO1xuXHRcdHJlYWRlci5sYXN0RGlza09mZnNldCA9IDA7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwocmVhZGVycy5tYXAoYXN5bmMgKGRpc2tSZWFkZXIsIGluZGV4RGlza1JlYWRlcikgPT4ge1xuXHRcdFx0YXdhaXQgZGlza1JlYWRlci5pbml0KCk7XG5cdFx0XHRpZiAoaW5kZXhEaXNrUmVhZGVyICE9IHJlYWRlcnMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRyZWFkZXIubGFzdERpc2tPZmZzZXQgKz0gZGlza1JlYWRlci5zaXplO1xuXHRcdFx0fVxuXHRcdFx0cmVhZGVyLnNpemUgKz0gZGlza1JlYWRlci5zaXplO1xuXHRcdH0pKTtcblx0XHRzdXBlci5pbml0KCk7XG5cdH1cblxuXHRhc3luYyByZWFkVWludDhBcnJheShvZmZzZXQsIGxlbmd0aCwgZGlza051bWJlciA9IDApIHtcblx0XHRjb25zdCByZWFkZXIgPSB0aGlzO1xuXHRcdGNvbnN0IHsgcmVhZGVycyB9ID0gdGhpcztcblx0XHRsZXQgcmVzdWx0O1xuXHRcdGxldCBjdXJyZW50RGlza051bWJlciA9IGRpc2tOdW1iZXI7XG5cdFx0aWYgKGN1cnJlbnREaXNrTnVtYmVyID09IC0xKSB7XG5cdFx0XHRjdXJyZW50RGlza051bWJlciA9IHJlYWRlcnMubGVuZ3RoIC0gMTtcblx0XHR9XG5cdFx0bGV0IGN1cnJlbnRSZWFkZXJPZmZzZXQgPSBvZmZzZXQ7XG5cdFx0d2hpbGUgKGN1cnJlbnRSZWFkZXJPZmZzZXQgPj0gcmVhZGVyc1tjdXJyZW50RGlza051bWJlcl0uc2l6ZSkge1xuXHRcdFx0Y3VycmVudFJlYWRlck9mZnNldCAtPSByZWFkZXJzW2N1cnJlbnREaXNrTnVtYmVyXS5zaXplO1xuXHRcdFx0Y3VycmVudERpc2tOdW1iZXIrKztcblx0XHR9XG5cdFx0Y29uc3QgY3VycmVudFJlYWRlciA9IHJlYWRlcnNbY3VycmVudERpc2tOdW1iZXJdO1xuXHRcdGNvbnN0IGN1cnJlbnRSZWFkZXJTaXplID0gY3VycmVudFJlYWRlci5zaXplO1xuXHRcdGlmIChjdXJyZW50UmVhZGVyT2Zmc2V0ICsgbGVuZ3RoIDw9IGN1cnJlbnRSZWFkZXJTaXplKSB7XG5cdFx0XHRyZXN1bHQgPSBhd2FpdCByZWFkVWludDhBcnJheShjdXJyZW50UmVhZGVyLCBjdXJyZW50UmVhZGVyT2Zmc2V0LCBsZW5ndGgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBjaHVua0xlbmd0aCA9IGN1cnJlbnRSZWFkZXJTaXplIC0gY3VycmVudFJlYWRlck9mZnNldDtcblx0XHRcdHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aCk7XG5cdFx0XHRyZXN1bHQuc2V0KGF3YWl0IHJlYWRVaW50OEFycmF5KGN1cnJlbnRSZWFkZXIsIGN1cnJlbnRSZWFkZXJPZmZzZXQsIGNodW5rTGVuZ3RoKSk7XG5cdFx0XHRyZXN1bHQuc2V0KGF3YWl0IHJlYWRlci5yZWFkVWludDhBcnJheShvZmZzZXQgKyBjaHVua0xlbmd0aCwgbGVuZ3RoIC0gY2h1bmtMZW5ndGgsIGRpc2tOdW1iZXIpLCBjaHVua0xlbmd0aCk7XG5cdFx0fVxuXHRcdHJlYWRlci5sYXN0RGlza051bWJlciA9IE1hdGgubWF4KGN1cnJlbnREaXNrTnVtYmVyLCByZWFkZXIubGFzdERpc2tOdW1iZXIpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuY2xhc3MgU3BsaXREYXRhV3JpdGVyIGV4dGVuZHMgU3RyZWFtIHtcblxuXHRjb25zdHJ1Y3Rvcih3cml0ZXJHZW5lcmF0b3IsIG1heFNpemUgPSA0Mjk0OTY3Mjk1KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb25zdCB6aXBXcml0ZXIgPSB0aGlzO1xuXHRcdE9iamVjdC5hc3NpZ24oemlwV3JpdGVyLCB7XG5cdFx0XHRkaXNrTnVtYmVyOiAwLFxuXHRcdFx0ZGlza09mZnNldDogMCxcblx0XHRcdHNpemU6IDAsXG5cdFx0XHRtYXhTaXplLFxuXHRcdFx0YXZhaWxhYmxlU2l6ZTogbWF4U2l6ZVxuXHRcdH0pO1xuXHRcdGxldCBkaXNrU291cmNlV3JpdGVyLCBkaXNrV3JpdGFibGUsIGRpc2tXcml0ZXI7XG5cdFx0Y29uc3Qgd3JpdGFibGUgPSBuZXcgV3JpdGFibGVTdHJlYW0oe1xuXHRcdFx0YXN5bmMgd3JpdGUoY2h1bmspIHtcblx0XHRcdFx0Y29uc3QgeyBhdmFpbGFibGVTaXplIH0gPSB6aXBXcml0ZXI7XG5cdFx0XHRcdGlmICghZGlza1dyaXRlcikge1xuXHRcdFx0XHRcdGNvbnN0IHsgdmFsdWUsIGRvbmUgfSA9IGF3YWl0IHdyaXRlckdlbmVyYXRvci5uZXh0KCk7XG5cdFx0XHRcdFx0aWYgKGRvbmUgJiYgIXZhbHVlKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoRVJSX0lURVJBVE9SX0NPTVBMRVRFRF9UT09fU09PTik7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGRpc2tTb3VyY2VXcml0ZXIgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGRpc2tTb3VyY2VXcml0ZXIuc2l6ZSA9IDA7XG5cdFx0XHRcdFx0XHRpZiAoZGlza1NvdXJjZVdyaXRlci5tYXhTaXplKSB7XG5cdFx0XHRcdFx0XHRcdHppcFdyaXRlci5tYXhTaXplID0gZGlza1NvdXJjZVdyaXRlci5tYXhTaXplO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0emlwV3JpdGVyLmF2YWlsYWJsZVNpemUgPSB6aXBXcml0ZXIubWF4U2l6ZTtcblx0XHRcdFx0XHRcdGF3YWl0IGluaXRTdHJlYW0oZGlza1NvdXJjZVdyaXRlcik7XG5cdFx0XHRcdFx0XHRkaXNrV3JpdGFibGUgPSB2YWx1ZS53cml0YWJsZTtcblx0XHRcdFx0XHRcdGRpc2tXcml0ZXIgPSBkaXNrV3JpdGFibGUuZ2V0V3JpdGVyKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGF3YWl0IHRoaXMud3JpdGUoY2h1bmspO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNodW5rLmxlbmd0aCA+PSBhdmFpbGFibGVTaXplKSB7XG5cdFx0XHRcdFx0YXdhaXQgd3JpdGVDaHVuayhjaHVuay5zbGljZSgwLCBhdmFpbGFibGVTaXplKSk7XG5cdFx0XHRcdFx0YXdhaXQgY2xvc2VEaXNrKCk7XG5cdFx0XHRcdFx0emlwV3JpdGVyLmRpc2tPZmZzZXQgKz0gZGlza1NvdXJjZVdyaXRlci5zaXplO1xuXHRcdFx0XHRcdHppcFdyaXRlci5kaXNrTnVtYmVyKys7XG5cdFx0XHRcdFx0ZGlza1dyaXRlciA9IG51bGw7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy53cml0ZShjaHVuay5zbGljZShhdmFpbGFibGVTaXplKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXdhaXQgd3JpdGVDaHVuayhjaHVuayk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhc3luYyBjbG9zZSgpIHtcblx0XHRcdFx0YXdhaXQgZGlza1dyaXRlci5yZWFkeTtcblx0XHRcdFx0YXdhaXQgY2xvc2VEaXNrKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHppcFdyaXRlciwgUFJPUEVSVFlfTkFNRV9XUklUQUJMRSwge1xuXHRcdFx0Z2V0KCkge1xuXHRcdFx0XHRyZXR1cm4gd3JpdGFibGU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRhc3luYyBmdW5jdGlvbiB3cml0ZUNodW5rKGNodW5rKSB7XG5cdFx0XHRjb25zdCBjaHVua0xlbmd0aCA9IGNodW5rLmxlbmd0aDtcblx0XHRcdGlmIChjaHVua0xlbmd0aCkge1xuXHRcdFx0XHRhd2FpdCBkaXNrV3JpdGVyLnJlYWR5O1xuXHRcdFx0XHRhd2FpdCBkaXNrV3JpdGVyLndyaXRlKGNodW5rKTtcblx0XHRcdFx0ZGlza1NvdXJjZVdyaXRlci5zaXplICs9IGNodW5rTGVuZ3RoO1xuXHRcdFx0XHR6aXBXcml0ZXIuc2l6ZSArPSBjaHVua0xlbmd0aDtcblx0XHRcdFx0emlwV3JpdGVyLmF2YWlsYWJsZVNpemUgLT0gY2h1bmtMZW5ndGg7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXN5bmMgZnVuY3Rpb24gY2xvc2VEaXNrKCkge1xuXHRcdFx0ZGlza1dyaXRhYmxlLnNpemUgPSBkaXNrU291cmNlV3JpdGVyLnNpemU7XG5cdFx0XHRhd2FpdCBkaXNrV3JpdGVyLmNsb3NlKCk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGlzSHR0cEZhbWlseSh1cmwpIHtcblx0Y29uc3QgeyBiYXNlVVJMIH0gPSBnZXRDb25maWd1cmF0aW9uKCk7XG5cdGNvbnN0IHsgcHJvdG9jb2wgfSA9IG5ldyBVUkwodXJsLCBiYXNlVVJMKTtcblx0cmV0dXJuIHByb3RvY29sID09IFwiaHR0cDpcIiB8fCBwcm90b2NvbCA9PSBcImh0dHBzOlwiO1xufVxuXG5hc3luYyBmdW5jdGlvbiBpbml0U3RyZWFtKHN0cmVhbSwgaW5pdFNpemUpIHtcblx0aWYgKHN0cmVhbS5pbml0ICYmICFzdHJlYW0uaW5pdGlhbGl6ZWQpIHtcblx0XHRhd2FpdCBzdHJlYW0uaW5pdChpbml0U2l6ZSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gaW5pdFJlYWRlcihyZWFkZXIpIHtcblx0aWYgKEFycmF5LmlzQXJyYXkocmVhZGVyKSkge1xuXHRcdHJlYWRlciA9IG5ldyBTcGxpdERhdGFSZWFkZXIocmVhZGVyKTtcblx0fVxuXHRpZiAocmVhZGVyIGluc3RhbmNlb2YgUmVhZGFibGVTdHJlYW0pIHtcblx0XHRyZWFkZXIgPSB7XG5cdFx0XHRyZWFkYWJsZTogcmVhZGVyXG5cdFx0fTtcblx0fVxuXHRyZXR1cm4gcmVhZGVyO1xufVxuXG5mdW5jdGlvbiBpbml0V3JpdGVyKHdyaXRlcikge1xuXHRpZiAod3JpdGVyLndyaXRhYmxlID09PSBVTkRFRklORURfVkFMVUUgJiYgdHlwZW9mIHdyaXRlci5uZXh0ID09IEZVTkNUSU9OX1RZUEUpIHtcblx0XHR3cml0ZXIgPSBuZXcgU3BsaXREYXRhV3JpdGVyKHdyaXRlcik7XG5cdH1cblx0aWYgKHdyaXRlciBpbnN0YW5jZW9mIFdyaXRhYmxlU3RyZWFtKSB7XG5cdFx0d3JpdGVyID0ge1xuXHRcdFx0d3JpdGFibGU6IHdyaXRlclxuXHRcdH07XG5cdH1cblx0Y29uc3QgeyB3cml0YWJsZSB9ID0gd3JpdGVyO1xuXHRpZiAod3JpdGFibGUuc2l6ZSA9PT0gVU5ERUZJTkVEX1ZBTFVFKSB7XG5cdFx0d3JpdGFibGUuc2l6ZSA9IDA7XG5cdH1cblx0Y29uc3Qgc3BsaXRaaXBGaWxlID0gd3JpdGVyIGluc3RhbmNlb2YgU3BsaXREYXRhV3JpdGVyO1xuXHRpZiAoIXNwbGl0WmlwRmlsZSkge1xuXHRcdE9iamVjdC5hc3NpZ24od3JpdGVyLCB7XG5cdFx0XHRkaXNrTnVtYmVyOiAwLFxuXHRcdFx0ZGlza09mZnNldDogMCxcblx0XHRcdGF2YWlsYWJsZVNpemU6IEluZmluaXR5LFxuXHRcdFx0bWF4U2l6ZTogSW5maW5pdHlcblx0XHR9KTtcblx0fVxuXHRyZXR1cm4gd3JpdGVyO1xufVxuXG5mdW5jdGlvbiByZWFkVWludDhBcnJheShyZWFkZXIsIG9mZnNldCwgc2l6ZSwgZGlza051bWJlcikge1xuXHRyZXR1cm4gcmVhZGVyLnJlYWRVaW50OEFycmF5KG9mZnNldCwgc2l6ZSwgZGlza051bWJlcik7XG59XG5cbmNvbnN0IFNwbGl0WmlwUmVhZGVyID0gU3BsaXREYXRhUmVhZGVyO1xuY29uc3QgU3BsaXRaaXBXcml0ZXIgPSBTcGxpdERhdGFXcml0ZXI7XG5cbmV4cG9ydCB7XG5cdGluaXRTdHJlYW0sXG5cdGluaXRSZWFkZXIsXG5cdGluaXRXcml0ZXIsXG5cdHJlYWRVaW50OEFycmF5LFxuXHRSZWFkZXIsXG5cdFdyaXRlcixcblx0VGV4dFJlYWRlcixcblx0VGV4dFdyaXRlcixcblx0RGF0YTY0VVJJUmVhZGVyLFxuXHREYXRhNjRVUklXcml0ZXIsXG5cdEJsb2JSZWFkZXIsXG5cdEJsb2JXcml0ZXIsXG5cdFVpbnQ4QXJyYXlSZWFkZXIsXG5cdFVpbnQ4QXJyYXlXcml0ZXIsXG5cdEh0dHBSZWFkZXIsXG5cdEh0dHBSYW5nZVJlYWRlcixcblx0U3BsaXRaaXBSZWFkZXIsXG5cdFNwbGl0WmlwV3JpdGVyLFxuXHRTcGxpdERhdGFSZWFkZXIsXG5cdFNwbGl0RGF0YVdyaXRlcixcblx0RVJSX0hUVFBfUkFOR0UsXG5cdEVSUl9JVEVSQVRPUl9DT01QTEVURURfVE9PX1NPT05cbn07IiwiLypcbiBDb3B5cmlnaHQgKGMpIDIwMjIgR2lsZGFzIExvcm1lYXUuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cbiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuXG4gMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgXG4gbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIFxuIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuXG4gMy4gVGhlIG5hbWVzIG9mIHRoZSBhdXRob3JzIG1heSBub3QgYmUgdXNlZCB0byBlbmRvcnNlIG9yIHByb21vdGUgcHJvZHVjdHNcbiBkZXJpdmVkIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cblxuIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgJydBUyBJUycnIEFORCBBTlkgRVhQUkVTU0VEIE9SIElNUExJRUQgV0FSUkFOVElFUyxcbiBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EXG4gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIEpDUkFGVCxcbiBJTkMuIE9SIEFOWSBDT05UUklCVVRPUlMgVE8gVEhJUyBTT0ZUV0FSRSBCRSBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULFxuIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1RcbiBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSxcbiBPUiBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GXG4gTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkdcbiBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsXG4gRVZFTiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqL1xuXG4vKiBnbG9iYWwgVGV4dERlY29kZXIgKi9cblxuY29uc3QgQ1A0MzcgPSBcIlxcMOKYuuKYu+KZpeKZpuKZo+KZoOKAouKXmOKXi+KXmeKZguKZgOKZquKZq+KYvOKWuuKXhOKGleKAvMK2wqfilqzihqjihpHihpPihpLihpDiiJ/ihpTilrLilrwgIVxcXCIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXFxcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fuKMgsOHw7zDqcOiw6TDoMOlw6fDqsOrw6jDr8Ouw6zDhMOFw4nDpsOGw7TDtsOyw7vDucO/w5bDnMKiwqPCpeKCp8aSw6HDrcOzw7rDscORwqrCusK/4oyQwqzCvcK8wqHCq8K74paR4paS4paT4pSC4pSk4pWh4pWi4pWW4pWV4pWj4pWR4pWX4pWd4pWc4pWb4pSQ4pSU4pS04pSs4pSc4pSA4pS84pWe4pWf4pWa4pWU4pWp4pWm4pWg4pWQ4pWs4pWn4pWo4pWk4pWl4pWZ4pWY4pWS4pWT4pWr4pWq4pSY4pSM4paI4paE4paM4paQ4paAzrHDn86Tz4DOo8+DwrXPhM6mzpjOqc604oiez4bOteKIqeKJocKx4oml4omk4oyg4oyhw7fiiYjCsOKImcK34oia4oG/wrLilqAgXCIuc3BsaXQoXCJcIik7XG5jb25zdCBWQUxJRF9DUDQzNyA9IENQNDM3Lmxlbmd0aCA9PSAyNTY7XG5cbmV4cG9ydCB7XG5cdGRlY29kZUNQNDM3XG59O1xuXG5mdW5jdGlvbiBkZWNvZGVDUDQzNyhzdHJpbmdWYWx1ZSkge1xuXHRpZiAoVkFMSURfQ1A0MzcpIHtcblx0XHRsZXQgcmVzdWx0ID0gXCJcIjtcblx0XHRmb3IgKGxldCBpbmRleENoYXJhY3RlciA9IDA7IGluZGV4Q2hhcmFjdGVyIDwgc3RyaW5nVmFsdWUubGVuZ3RoOyBpbmRleENoYXJhY3RlcisrKSB7XG5cdFx0XHRyZXN1bHQgKz0gQ1A0Mzdbc3RyaW5nVmFsdWVbaW5kZXhDaGFyYWN0ZXJdXTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHN0cmluZ1ZhbHVlKTtcblx0fVxufSIsIi8qXG4gQ29weXJpZ2h0IChjKSAyMDIyIEdpbGRhcyBMb3JtZWF1LiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuXG4gUmVkaXN0cmlidXRpb24gYW5kIHVzZSBpbiBzb3VyY2UgYW5kIGJpbmFyeSBmb3Jtcywgd2l0aCBvciB3aXRob3V0XG4gbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zIGFyZSBtZXQ6XG5cbiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UsXG4gdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lci5cblxuIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0IFxuIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiBcbiB0aGUgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cblxuIDMuIFRoZSBuYW1lcyBvZiB0aGUgYXV0aG9ycyBtYXkgbm90IGJlIHVzZWQgdG8gZW5kb3JzZSBvciBwcm9tb3RlIHByb2R1Y3RzXG4gZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIHBlcm1pc3Npb24uXG5cbiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEICcnQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1NFRCBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsXG4gSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZIEFORFxuIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFSRSBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCBKQ1JBRlQsXG4gSU5DLiBPUiBBTlkgQ09OVFJJQlVUT1JTIFRPIFRISVMgU09GVFdBUkUgQkUgTElBQkxFIEZPUiBBTlkgRElSRUNULCBJTkRJUkVDVCxcbiBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyAoSU5DTFVESU5HLCBCVVQgTk9UXG4gTElNSVRFRCBUTywgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsXG4gT1IgUFJPRklUUzsgT1IgQlVTSU5FU1MgSU5URVJSVVBUSU9OKSBIT1dFVkVSIENBVVNFRCBBTkQgT04gQU5ZIFRIRU9SWSBPRlxuIExJQUJJTElUWSwgV0hFVEhFUiBJTiBDT05UUkFDVCwgU1RSSUNUIExJQUJJTElUWSwgT1IgVE9SVCAoSU5DTFVESU5HXG4gTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLFxuIEVWRU4gSUYgQURWSVNFRCBPRiBUSEUgUE9TU0lCSUxJVFkgT0YgU1VDSCBEQU1BR0UuXG4gKi9cblxuLyogZ2xvYmFsIFRleHREZWNvZGVyICovXG5cbmltcG9ydCB7IGRlY29kZUNQNDM3IH0gZnJvbSBcIi4vY3A0MzctZGVjb2RlLmpzXCI7XG5cbmV4cG9ydCB7XG5cdGRlY29kZVRleHRcbn07XG5cbmZ1bmN0aW9uIGRlY29kZVRleHQodmFsdWUsIGVuY29kaW5nKSB7XG5cdGlmIChlbmNvZGluZyAmJiBlbmNvZGluZy50cmltKCkudG9Mb3dlckNhc2UoKSA9PSBcImNwNDM3XCIpIHtcblx0XHRyZXR1cm4gZGVjb2RlQ1A0MzcodmFsdWUpO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBuZXcgVGV4dERlY29kZXIoZW5jb2RpbmcpLmRlY29kZSh2YWx1ZSk7XG5cdH1cbn0iLCIvKlxuIENvcHlyaWdodCAoYykgMjAyMiBHaWxkYXMgTG9ybWVhdS4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cblxuIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmUgbWV0OlxuXG4gMS4gUmVkaXN0cmlidXRpb25zIG9mIHNvdXJjZSBjb2RlIG11c3QgcmV0YWluIHRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlLFxuIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG5cbiAyLiBSZWRpc3RyaWJ1dGlvbnMgaW4gYmluYXJ5IGZvcm0gbXVzdCByZXByb2R1Y2UgdGhlIGFib3ZlIGNvcHlyaWdodCBcbiBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIgaW4gXG4gdGhlIGRvY3VtZW50YXRpb24gYW5kL29yIG90aGVyIG1hdGVyaWFscyBwcm92aWRlZCB3aXRoIHRoZSBkaXN0cmlidXRpb24uXG5cbiAzLiBUaGUgbmFtZXMgb2YgdGhlIGF1dGhvcnMgbWF5IG5vdCBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBwcm9kdWN0c1xuIGRlcml2ZWQgZnJvbSB0aGlzIHNvZnR3YXJlIHdpdGhvdXQgc3BlY2lmaWMgcHJpb3Igd3JpdHRlbiBwZXJtaXNzaW9uLlxuXG4gVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCAnJ0FTIElTJycgQU5EIEFOWSBFWFBSRVNTRUQgT1IgSU1QTElFRCBXQVJSQU5USUVTLFxuIElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBUSEUgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkRcbiBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gSU4gTk8gRVZFTlQgU0hBTEwgSkNSQUZULFxuIElOQy4gT1IgQU5ZIENPTlRSSUJVVE9SUyBUTyBUSElTIFNPRlRXQVJFIEJFIExJQUJMRSBGT1IgQU5ZIERJUkVDVCwgSU5ESVJFQ1QsXG4gSU5DSURFTlRBTCwgU1BFQ0lBTCwgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVFxuIExJTUlURUQgVE8sIFBST0NVUkVNRU5UIE9GIFNVQlNUSVRVVEUgR09PRFMgT1IgU0VSVklDRVM7IExPU1MgT0YgVVNFLCBEQVRBLFxuIE9SIFBST0ZJVFM7IE9SIEJVU0lORVNTIElOVEVSUlVQVElPTikgSE9XRVZFUiBDQVVTRUQgQU5EIE9OIEFOWSBUSEVPUlkgT0ZcbiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuIE5FR0xJR0VOQ0UgT1IgT1RIRVJXSVNFKSBBUklTSU5HIElOIEFOWSBXQVkgT1VUIE9GIFRIRSBVU0UgT0YgVEhJUyBTT0ZUV0FSRSxcbiBFVkVOIElGIEFEVklTRUQgT0YgVEhFIFBPU1NJQklMSVRZIE9GIFNVQ0ggREFNQUdFLlxuICovXG5cbmNvbnN0IFBST1BFUlRZX05BTUVfRklMRU5BTUUgPSBcImZpbGVuYW1lXCI7XG5jb25zdCBQUk9QRVJUWV9OQU1FX1JBV19GSUxFTkFNRSA9IFwicmF3RmlsZW5hbWVcIjtcbmNvbnN0IFBST1BFUlRZX05BTUVfQ09NTUVOVCA9IFwiY29tbWVudFwiO1xuY29uc3QgUFJPUEVSVFlfTkFNRV9SQVdfQ09NTUVOVCA9IFwicmF3Q29tbWVudFwiO1xuY29uc3QgUFJPUEVSVFlfTkFNRV9VTkNPTVBQUkVTU0VEX1NJWkUgPSBcInVuY29tcHJlc3NlZFNpemVcIjtcbmNvbnN0IFBST1BFUlRZX05BTUVfQ09NUFBSRVNTRURfU0laRSA9IFwiY29tcHJlc3NlZFNpemVcIjtcbmNvbnN0IFBST1BFUlRZX05BTUVfT0ZGU0VUID0gXCJvZmZzZXRcIjtcbmNvbnN0IFBST1BFUlRZX05BTUVfRElTS19OVU1CRVJfU1RBUlQgPSBcImRpc2tOdW1iZXJTdGFydFwiO1xuY29uc3QgUFJPUEVSVFlfTkFNRV9MQVNUX01PRElGSUNBVElPTl9EQVRFID0gXCJsYXN0TW9kRGF0ZVwiO1xuY29uc3QgUFJPUEVSVFlfTkFNRV9SQVdfTEFTVF9NT0RJRklDQVRJT05fREFURSA9IFwicmF3TGFzdE1vZERhdGVcIjtcbmNvbnN0IFBST1BFUlRZX05BTUVfTEFTVF9BQ0NFU1NfREFURSA9IFwibGFzdEFjY2Vzc0RhdGVcIjtcbmNvbnN0IFBST1BFUlRZX05BTUVfUkFXX0xBU1RfQUNDRVNTX0RBVEUgPSBcInJhd0xhc3RBY2Nlc3NEYXRlXCI7XG5jb25zdCBQUk9QRVJUWV9OQU1FX0NSRUFUSU9OX0RBVEUgPSBcImNyZWF0aW9uRGF0ZVwiO1xuY29uc3QgUFJPUEVSVFlfTkFNRV9SQVdfQ1JFQVRJT05fREFURSA9IFwicmF3Q3JlYXRpb25EYXRlXCI7XG5jb25zdCBQUk9QRVJUWV9OQU1FX0lOVEVSTkFMX0ZJTEVfQVRUUklCVVRFID0gXCJpbnRlcm5hbEZpbGVBdHRyaWJ1dGVcIjtcbmNvbnN0IFBST1BFUlRZX05BTUVfRVhURVJOQUxfRklMRV9BVFRSSUJVVEUgPSBcImV4dGVybmFsRmlsZUF0dHJpYnV0ZVwiO1xuY29uc3QgUFJPUEVSVFlfTkFNRV9NU19ET1NfQ09NUEFUSUJMRSA9IFwibXNEb3NDb21wYXRpYmxlXCI7XG5jb25zdCBQUk9QRVJUWV9OQU1FX1pJUDY0ID0gXCJ6aXA2NFwiO1xuXG5jb25zdCBQUk9QRVJUWV9OQU1FUyA9IFtcblx0UFJPUEVSVFlfTkFNRV9GSUxFTkFNRSwgUFJPUEVSVFlfTkFNRV9SQVdfRklMRU5BTUUsIFBST1BFUlRZX05BTUVfQ09NUFBSRVNTRURfU0laRSwgUFJPUEVSVFlfTkFNRV9VTkNPTVBQUkVTU0VEX1NJWkUsXG5cdFBST1BFUlRZX05BTUVfTEFTVF9NT0RJRklDQVRJT05fREFURSwgUFJPUEVSVFlfTkFNRV9SQVdfTEFTVF9NT0RJRklDQVRJT05fREFURSwgUFJPUEVSVFlfTkFNRV9DT01NRU5ULCBQUk9QRVJUWV9OQU1FX1JBV19DT01NRU5ULFxuXHRQUk9QRVJUWV9OQU1FX0xBU1RfQUNDRVNTX0RBVEUsIFBST1BFUlRZX05BTUVfQ1JFQVRJT05fREFURSwgUFJPUEVSVFlfTkFNRV9PRkZTRVQsIFBST1BFUlRZX05BTUVfRElTS19OVU1CRVJfU1RBUlQsXG5cdFBST1BFUlRZX05BTUVfRElTS19OVU1CRVJfU1RBUlQsIFBST1BFUlRZX05BTUVfSU5URVJOQUxfRklMRV9BVFRSSUJVVEUsIFBST1BFUlRZX05BTUVfRVhURVJOQUxfRklMRV9BVFRSSUJVVEUsXG5cdFBST1BFUlRZX05BTUVfTVNfRE9TX0NPTVBBVElCTEUsIFBST1BFUlRZX05BTUVfWklQNjQsXG5cdFwiZGlyZWN0b3J5XCIsIFwiYml0RmxhZ1wiLCBcImVuY3J5cHRlZFwiLCBcInNpZ25hdHVyZVwiLCBcImZpbGVuYW1lVVRGOFwiLCBcImNvbW1lbnRVVEY4XCIsIFwiY29tcHJlc3Npb25NZXRob2RcIiwgXCJ2ZXJzaW9uXCIsIFwidmVyc2lvbk1hZGVCeVwiLFxuXHRcImV4dHJhRmllbGRcIiwgXCJyYXdFeHRyYUZpZWxkXCIsIFwiZXh0cmFGaWVsZFppcDY0XCIsIFwiZXh0cmFGaWVsZFVuaWNvZGVQYXRoXCIsIFwiZXh0cmFGaWVsZFVuaWNvZGVDb21tZW50XCIsIFwiZXh0cmFGaWVsZEFFU1wiLCBcImV4dHJhRmllbGROVEZTXCIsXG5cdFwiZXh0cmFGaWVsZEV4dGVuZGVkVGltZXN0YW1wXCJdO1xuXG5jbGFzcyBFbnRyeSB7XG5cblx0Y29uc3RydWN0b3IoZGF0YSkge1xuXHRcdFBST1BFUlRZX05BTUVTLmZvckVhY2gobmFtZSA9PiB0aGlzW25hbWVdID0gZGF0YVtuYW1lXSk7XG5cdH1cblxufVxuXG5leHBvcnQge1xuXHRQUk9QRVJUWV9OQU1FX0ZJTEVOQU1FLFxuXHRQUk9QRVJUWV9OQU1FX1JBV19GSUxFTkFNRSxcblx0UFJPUEVSVFlfTkFNRV9DT01NRU5ULFxuXHRQUk9QRVJUWV9OQU1FX1JBV19DT01NRU5ULFxuXHRQUk9QRVJUWV9OQU1FX1VOQ09NUFBSRVNTRURfU0laRSxcblx0UFJPUEVSVFlfTkFNRV9DT01QUFJFU1NFRF9TSVpFLFxuXHRQUk9QRVJUWV9OQU1FX09GRlNFVCxcblx0UFJPUEVSVFlfTkFNRV9ESVNLX05VTUJFUl9TVEFSVCxcblx0UFJPUEVSVFlfTkFNRV9MQVNUX01PRElGSUNBVElPTl9EQVRFLFxuXHRQUk9QRVJUWV9OQU1FX1JBV19MQVNUX01PRElGSUNBVElPTl9EQVRFLFxuXHRQUk9QRVJUWV9OQU1FX0xBU1RfQUNDRVNTX0RBVEUsXG5cdFBST1BFUlRZX05BTUVfUkFXX0xBU1RfQUNDRVNTX0RBVEUsXG5cdFBST1BFUlRZX05BTUVfQ1JFQVRJT05fREFURSxcblx0UFJPUEVSVFlfTkFNRV9SQVdfQ1JFQVRJT05fREFURSxcblx0UFJPUEVSVFlfTkFNRV9JTlRFUk5BTF9GSUxFX0FUVFJJQlVURSxcblx0UFJPUEVSVFlfTkFNRV9FWFRFUk5BTF9GSUxFX0FUVFJJQlVURSxcblx0UFJPUEVSVFlfTkFNRV9NU19ET1NfQ09NUEFUSUJMRSxcblx0UFJPUEVSVFlfTkFNRV9aSVA2NCxcblx0RW50cnlcbn07IiwiLypcbiBDb3B5cmlnaHQgKGMpIDIwMjIgR2lsZGFzIExvcm1lYXUuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cbiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuXG4gMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgXG4gbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIFxuIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuXG4gMy4gVGhlIG5hbWVzIG9mIHRoZSBhdXRob3JzIG1heSBub3QgYmUgdXNlZCB0byBlbmRvcnNlIG9yIHByb21vdGUgcHJvZHVjdHNcbiBkZXJpdmVkIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cblxuIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgJydBUyBJUycnIEFORCBBTlkgRVhQUkVTU0VEIE9SIElNUExJRUQgV0FSUkFOVElFUyxcbiBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EXG4gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIEpDUkFGVCxcbiBJTkMuIE9SIEFOWSBDT05UUklCVVRPUlMgVE8gVEhJUyBTT0ZUV0FSRSBCRSBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULFxuIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1RcbiBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSxcbiBPUiBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GXG4gTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkdcbiBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsXG4gRVZFTiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqL1xuXG4vKiBnbG9iYWwgQmlnSW50LCBSZXNwb25zZSwgV3JpdGFibGVTdHJlYW0gKi9cbi8vIGRlbm8tbGludC1pZ25vcmUtZmlsZSBuby10aGlzLWFsaWFzXG5cbmltcG9ydCB7XG5cdE1BWF8zMl9CSVRTLFxuXHRNQVhfMTZfQklUUyxcblx0Q09NUFJFU1NJT05fTUVUSE9EX0RFRkxBVEUsXG5cdENPTVBSRVNTSU9OX01FVEhPRF9TVE9SRSxcblx0Q09NUFJFU1NJT05fTUVUSE9EX0FFUyxcblx0U1BMSVRfWklQX0ZJTEVfU0lHTkFUVVJFLFxuXHRMT0NBTF9GSUxFX0hFQURFUl9TSUdOQVRVUkUsXG5cdENFTlRSQUxfRklMRV9IRUFERVJfU0lHTkFUVVJFLFxuXHRFTkRfT0ZfQ0VOVFJBTF9ESVJfU0lHTkFUVVJFLFxuXHRaSVA2NF9FTkRfT0ZfQ0VOVFJBTF9ESVJfTE9DQVRPUl9TSUdOQVRVUkUsXG5cdFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9TSUdOQVRVUkUsXG5cdEVYVFJBRklFTERfVFlQRV9aSVA2NCxcblx0RVhUUkFGSUVMRF9UWVBFX1VOSUNPREVfUEFUSCxcblx0RVhUUkFGSUVMRF9UWVBFX1VOSUNPREVfQ09NTUVOVCxcblx0RVhUUkFGSUVMRF9UWVBFX0FFUyxcblx0RVhUUkFGSUVMRF9UWVBFX05URlMsXG5cdEVYVFJBRklFTERfVFlQRV9OVEZTX1RBRzEsXG5cdEVYVFJBRklFTERfVFlQRV9FWFRFTkRFRF9USU1FU1RBTVAsXG5cdEVYVFJBRklFTERfVFlQRV9VU0RaLFxuXHRFTkRfT0ZfQ0VOVFJBTF9ESVJfTEVOR1RILFxuXHRaSVA2NF9FTkRfT0ZfQ0VOVFJBTF9ESVJfTE9DQVRPUl9MRU5HVEgsXG5cdFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9MRU5HVEgsXG5cdEJJVEZMQUdfRU5DUllQVEVELFxuXHRCSVRGTEFHX0xFVkVMLFxuXHRCSVRGTEFHX0RBVEFfREVTQ1JJUFRPUixcblx0QklURkxBR19MQU5HX0VOQ09ESU5HX0ZMQUcsXG5cdEZJTEVfQVRUUl9NU0RPU19ESVJfTUFTSyxcblx0RElSRUNUT1JZX1NJR05BVFVSRSxcblx0VU5ERUZJTkVEX1ZBTFVFXG59IGZyb20gXCIuL2NvbnN0YW50cy5qc1wiO1xuaW1wb3J0IHtcblx0Z2V0Q29uZmlndXJhdGlvbixcblx0Z2V0Q2h1bmtTaXplXG59IGZyb20gXCIuL2NvbmZpZ3VyYXRpb24uanNcIjtcbmltcG9ydCB7XG5cdHJ1bldvcmtlcixcblx0Q09ERUNfSU5GTEFURSxcblx0RVJSX0lOVkFMSURfU0lHTkFUVVJFLFxuXHRFUlJfSU5WQUxJRF9QQVNTV09SRCxcblx0RVJSX0FCT1JUX0NIRUNLX1BBU1NXT1JEXG59IGZyb20gXCIuL2NvZGVjLXBvb2wuanNcIjtcbmltcG9ydCB7XG5cdGluaXRTdHJlYW0sXG5cdGluaXRSZWFkZXIsXG5cdGluaXRXcml0ZXIsXG5cdHJlYWRVaW50OEFycmF5LFxuXHRCbG9iUmVhZGVyXG59IGZyb20gXCIuL2lvLmpzXCI7XG5pbXBvcnQgeyBkZWNvZGVUZXh0IH0gZnJvbSBcIi4vdXRpbC9kZWNvZGUtdGV4dC5qc1wiO1xuaW1wb3J0IHsgQ3JjMzIgfSBmcm9tIFwiLi9zdHJlYW1zL2NvZGVjcy9jcmMzMi5qc1wiO1xuaW1wb3J0IHtcblx0UFJPUEVSVFlfTkFNRV9SQVdfRklMRU5BTUUsXG5cdFBST1BFUlRZX05BTUVfRklMRU5BTUUsXG5cdFBST1BFUlRZX05BTUVfUkFXX0NPTU1FTlQsXG5cdFBST1BFUlRZX05BTUVfQ09NTUVOVCxcblx0UFJPUEVSVFlfTkFNRV9VTkNPTVBQUkVTU0VEX1NJWkUsXG5cdFBST1BFUlRZX05BTUVfQ09NUFBSRVNTRURfU0laRSxcblx0UFJPUEVSVFlfTkFNRV9PRkZTRVQsXG5cdFBST1BFUlRZX05BTUVfRElTS19OVU1CRVJfU1RBUlQsXG5cdFBST1BFUlRZX05BTUVfTEFTVF9NT0RJRklDQVRJT05fREFURSxcblx0UFJPUEVSVFlfTkFNRV9SQVdfTEFTVF9NT0RJRklDQVRJT05fREFURSxcblx0UFJPUEVSVFlfTkFNRV9MQVNUX0FDQ0VTU19EQVRFLFxuXHRQUk9QRVJUWV9OQU1FX1JBV19MQVNUX0FDQ0VTU19EQVRFLFxuXHRQUk9QRVJUWV9OQU1FX0NSRUFUSU9OX0RBVEUsXG5cdFBST1BFUlRZX05BTUVfUkFXX0NSRUFUSU9OX0RBVEUsXG5cdEVudHJ5XG59IGZyb20gXCIuL3ppcC1lbnRyeS5qc1wiO1xuXG5jb25zdCBFUlJfQkFEX0ZPUk1BVCA9IFwiRmlsZSBmb3JtYXQgaXMgbm90IHJlY29nbml6ZWRcIjtcbmNvbnN0IEVSUl9FT0NEUl9OT1RfRk9VTkQgPSBcIkVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeSBub3QgZm91bmRcIjtcbmNvbnN0IEVSUl9FT0NEUl9aSVA2NF9OT1RfRk9VTkQgPSBcIkVuZCBvZiBaaXA2NCBjZW50cmFsIGRpcmVjdG9yeSBub3QgZm91bmRcIjtcbmNvbnN0IEVSUl9FT0NEUl9MT0NBVE9SX1pJUDY0X05PVF9GT1VORCA9IFwiRW5kIG9mIFppcDY0IGNlbnRyYWwgZGlyZWN0b3J5IGxvY2F0b3Igbm90IGZvdW5kXCI7XG5jb25zdCBFUlJfQ0VOVFJBTF9ESVJFQ1RPUllfTk9UX0ZPVU5EID0gXCJDZW50cmFsIGRpcmVjdG9yeSBoZWFkZXIgbm90IGZvdW5kXCI7XG5jb25zdCBFUlJfTE9DQUxfRklMRV9IRUFERVJfTk9UX0ZPVU5EID0gXCJMb2NhbCBmaWxlIGhlYWRlciBub3QgZm91bmRcIjtcbmNvbnN0IEVSUl9FWFRSQUZJRUxEX1pJUDY0X05PVF9GT1VORCA9IFwiWmlwNjQgZXh0cmEgZmllbGQgbm90IGZvdW5kXCI7XG5jb25zdCBFUlJfRU5DUllQVEVEID0gXCJGaWxlIGNvbnRhaW5zIGVuY3J5cHRlZCBlbnRyeVwiO1xuY29uc3QgRVJSX1VOU1VQUE9SVEVEX0VOQ1JZUFRJT04gPSBcIkVuY3J5cHRpb24gbWV0aG9kIG5vdCBzdXBwb3J0ZWRcIjtcbmNvbnN0IEVSUl9VTlNVUFBPUlRFRF9DT01QUkVTU0lPTiA9IFwiQ29tcHJlc3Npb24gbWV0aG9kIG5vdCBzdXBwb3J0ZWRcIjtcbmNvbnN0IEVSUl9TUExJVF9aSVBfRklMRSA9IFwiU3BsaXQgemlwIGZpbGVcIjtcbmNvbnN0IENIQVJTRVRfVVRGOCA9IFwidXRmLThcIjtcbmNvbnN0IENIQVJTRVRfQ1A0MzcgPSBcImNwNDM3XCI7XG5jb25zdCBaSVA2NF9QUk9QRVJUSUVTID0gW1xuXHRbUFJPUEVSVFlfTkFNRV9VTkNPTVBQUkVTU0VEX1NJWkUsIE1BWF8zMl9CSVRTXSxcblx0W1BST1BFUlRZX05BTUVfQ09NUFBSRVNTRURfU0laRSwgTUFYXzMyX0JJVFNdLFxuXHRbUFJPUEVSVFlfTkFNRV9PRkZTRVQsIE1BWF8zMl9CSVRTXSxcblx0W1BST1BFUlRZX05BTUVfRElTS19OVU1CRVJfU1RBUlQsIE1BWF8xNl9CSVRTXVxuXTtcbmNvbnN0IFpJUDY0X0VYVFJBQ1RJT04gPSB7XG5cdFtNQVhfMTZfQklUU106IHtcblx0XHRnZXRWYWx1ZTogZ2V0VWludDMyLFxuXHRcdGJ5dGVzOiA0XG5cdH0sXG5cdFtNQVhfMzJfQklUU106IHtcblx0XHRnZXRWYWx1ZTogZ2V0QmlnVWludDY0LFxuXHRcdGJ5dGVzOiA4XG5cdH1cbn07XG5cbmNsYXNzIFppcFJlYWRlciB7XG5cblx0Y29uc3RydWN0b3IocmVhZGVyLCBvcHRpb25zID0ge30pIHtcblx0XHRPYmplY3QuYXNzaWduKHRoaXMsIHtcblx0XHRcdHJlYWRlcjogaW5pdFJlYWRlcihyZWFkZXIpLFxuXHRcdFx0b3B0aW9ucyxcblx0XHRcdGNvbmZpZzogZ2V0Q29uZmlndXJhdGlvbigpXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyogZ2V0RW50cmllc0dlbmVyYXRvcihvcHRpb25zID0ge30pIHtcblx0XHRjb25zdCB6aXBSZWFkZXIgPSB0aGlzO1xuXHRcdGxldCB7IHJlYWRlciB9ID0gemlwUmVhZGVyO1xuXHRcdGNvbnN0IHsgY29uZmlnIH0gPSB6aXBSZWFkZXI7XG5cdFx0YXdhaXQgaW5pdFN0cmVhbShyZWFkZXIpO1xuXHRcdGlmIChyZWFkZXIuc2l6ZSA9PT0gVU5ERUZJTkVEX1ZBTFVFIHx8ICFyZWFkZXIucmVhZFVpbnQ4QXJyYXkpIHtcblx0XHRcdHJlYWRlciA9IG5ldyBCbG9iUmVhZGVyKGF3YWl0IG5ldyBSZXNwb25zZShyZWFkZXIucmVhZGFibGUpLmJsb2IoKSk7XG5cdFx0XHRhd2FpdCBpbml0U3RyZWFtKHJlYWRlcik7XG5cdFx0fVxuXHRcdGlmIChyZWFkZXIuc2l6ZSA8IEVORF9PRl9DRU5UUkFMX0RJUl9MRU5HVEgpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihFUlJfQkFEX0ZPUk1BVCk7XG5cdFx0fVxuXHRcdHJlYWRlci5jaHVua1NpemUgPSBnZXRDaHVua1NpemUoY29uZmlnKTtcblx0XHRjb25zdCBlbmRPZkRpcmVjdG9yeUluZm8gPSBhd2FpdCBzZWVrU2lnbmF0dXJlKHJlYWRlciwgRU5EX09GX0NFTlRSQUxfRElSX1NJR05BVFVSRSwgcmVhZGVyLnNpemUsIEVORF9PRl9DRU5UUkFMX0RJUl9MRU5HVEgsIE1BWF8xNl9CSVRTICogMTYpO1xuXHRcdGlmICghZW5kT2ZEaXJlY3RvcnlJbmZvKSB7XG5cdFx0XHRjb25zdCBzaWduYXR1cmVBcnJheSA9IGF3YWl0IHJlYWRVaW50OEFycmF5KHJlYWRlciwgMCwgNCk7XG5cdFx0XHRjb25zdCBzaWduYXR1cmVWaWV3ID0gZ2V0RGF0YVZpZXcoc2lnbmF0dXJlQXJyYXkpO1xuXHRcdFx0aWYgKGdldFVpbnQzMihzaWduYXR1cmVWaWV3KSA9PSBTUExJVF9aSVBfRklMRV9TSUdOQVRVUkUpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKEVSUl9TUExJVF9aSVBfRklMRSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoRVJSX0VPQ0RSX05PVF9GT1VORCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IGVuZE9mRGlyZWN0b3J5VmlldyA9IGdldERhdGFWaWV3KGVuZE9mRGlyZWN0b3J5SW5mbyk7XG5cdFx0bGV0IGRpcmVjdG9yeURhdGFMZW5ndGggPSBnZXRVaW50MzIoZW5kT2ZEaXJlY3RvcnlWaWV3LCAxMik7XG5cdFx0bGV0IGRpcmVjdG9yeURhdGFPZmZzZXQgPSBnZXRVaW50MzIoZW5kT2ZEaXJlY3RvcnlWaWV3LCAxNik7XG5cdFx0Y29uc3QgY29tbWVudE9mZnNldCA9IGVuZE9mRGlyZWN0b3J5SW5mby5vZmZzZXQ7XG5cdFx0Y29uc3QgY29tbWVudExlbmd0aCA9IGdldFVpbnQxNihlbmRPZkRpcmVjdG9yeVZpZXcsIDIwKTtcblx0XHRjb25zdCBhcHBlbmRlZERhdGFPZmZzZXQgPSBjb21tZW50T2Zmc2V0ICsgRU5EX09GX0NFTlRSQUxfRElSX0xFTkdUSCArIGNvbW1lbnRMZW5ndGg7XG5cdFx0bGV0IGxhc3REaXNrTnVtYmVyID0gZ2V0VWludDE2KGVuZE9mRGlyZWN0b3J5VmlldywgNCk7XG5cdFx0Y29uc3QgZXhwZWN0ZWRMYXN0RGlza051bWJlciA9IHJlYWRlci5sYXN0RGlza051bWJlciB8fCAwO1xuXHRcdGxldCBkaXNrTnVtYmVyID0gZ2V0VWludDE2KGVuZE9mRGlyZWN0b3J5VmlldywgNik7XG5cdFx0bGV0IGZpbGVzTGVuZ3RoID0gZ2V0VWludDE2KGVuZE9mRGlyZWN0b3J5VmlldywgOCk7XG5cdFx0bGV0IHByZXBlbmRlZERhdGFMZW5ndGggPSAwO1xuXHRcdGxldCBzdGFydE9mZnNldCA9IDA7XG5cdFx0aWYgKGRpcmVjdG9yeURhdGFPZmZzZXQgPT0gTUFYXzMyX0JJVFMgfHwgZGlyZWN0b3J5RGF0YUxlbmd0aCA9PSBNQVhfMzJfQklUUyB8fCBmaWxlc0xlbmd0aCA9PSBNQVhfMTZfQklUUyB8fCBkaXNrTnVtYmVyID09IE1BWF8xNl9CSVRTKSB7XG5cdFx0XHRjb25zdCBlbmRPZkRpcmVjdG9yeUxvY2F0b3JBcnJheSA9IGF3YWl0IHJlYWRVaW50OEFycmF5KHJlYWRlciwgZW5kT2ZEaXJlY3RvcnlJbmZvLm9mZnNldCAtIFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9MT0NBVE9SX0xFTkdUSCwgWklQNjRfRU5EX09GX0NFTlRSQUxfRElSX0xPQ0FUT1JfTEVOR1RIKTtcblx0XHRcdGNvbnN0IGVuZE9mRGlyZWN0b3J5TG9jYXRvclZpZXcgPSBnZXREYXRhVmlldyhlbmRPZkRpcmVjdG9yeUxvY2F0b3JBcnJheSk7XG5cdFx0XHRpZiAoZ2V0VWludDMyKGVuZE9mRGlyZWN0b3J5TG9jYXRvclZpZXcsIDApICE9IFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9MT0NBVE9SX1NJR05BVFVSRSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoRVJSX0VPQ0RSX1pJUDY0X05PVF9GT1VORCk7XG5cdFx0XHR9XG5cdFx0XHRkaXJlY3RvcnlEYXRhT2Zmc2V0ID0gZ2V0QmlnVWludDY0KGVuZE9mRGlyZWN0b3J5TG9jYXRvclZpZXcsIDgpO1xuXHRcdFx0bGV0IGVuZE9mRGlyZWN0b3J5QXJyYXkgPSBhd2FpdCByZWFkVWludDhBcnJheShyZWFkZXIsIGRpcmVjdG9yeURhdGFPZmZzZXQsIFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9MRU5HVEgsIC0xKTtcblx0XHRcdGxldCBlbmRPZkRpcmVjdG9yeVZpZXcgPSBnZXREYXRhVmlldyhlbmRPZkRpcmVjdG9yeUFycmF5KTtcblx0XHRcdGNvbnN0IGV4cGVjdGVkRGlyZWN0b3J5RGF0YU9mZnNldCA9IGVuZE9mRGlyZWN0b3J5SW5mby5vZmZzZXQgLSBaSVA2NF9FTkRfT0ZfQ0VOVFJBTF9ESVJfTE9DQVRPUl9MRU5HVEggLSBaSVA2NF9FTkRfT0ZfQ0VOVFJBTF9ESVJfTEVOR1RIO1xuXHRcdFx0aWYgKGdldFVpbnQzMihlbmRPZkRpcmVjdG9yeVZpZXcsIDApICE9IFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9TSUdOQVRVUkUgJiYgZGlyZWN0b3J5RGF0YU9mZnNldCAhPSBleHBlY3RlZERpcmVjdG9yeURhdGFPZmZzZXQpIHtcblx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxEaXJlY3RvcnlEYXRhT2Zmc2V0ID0gZGlyZWN0b3J5RGF0YU9mZnNldDtcblx0XHRcdFx0ZGlyZWN0b3J5RGF0YU9mZnNldCA9IGV4cGVjdGVkRGlyZWN0b3J5RGF0YU9mZnNldDtcblx0XHRcdFx0cHJlcGVuZGVkRGF0YUxlbmd0aCA9IGRpcmVjdG9yeURhdGFPZmZzZXQgLSBvcmlnaW5hbERpcmVjdG9yeURhdGFPZmZzZXQ7XG5cdFx0XHRcdGVuZE9mRGlyZWN0b3J5QXJyYXkgPSBhd2FpdCByZWFkVWludDhBcnJheShyZWFkZXIsIGRpcmVjdG9yeURhdGFPZmZzZXQsIFpJUDY0X0VORF9PRl9DRU5UUkFMX0RJUl9MRU5HVEgsIC0xKTtcblx0XHRcdFx0ZW5kT2ZEaXJlY3RvcnlWaWV3ID0gZ2V0RGF0YVZpZXcoZW5kT2ZEaXJlY3RvcnlBcnJheSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZ2V0VWludDMyKGVuZE9mRGlyZWN0b3J5VmlldywgMCkgIT0gWklQNjRfRU5EX09GX0NFTlRSQUxfRElSX1NJR05BVFVSRSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoRVJSX0VPQ0RSX0xPQ0FUT1JfWklQNjRfTk9UX0ZPVU5EKTtcblx0XHRcdH1cblx0XHRcdGlmIChsYXN0RGlza051bWJlciA9PSBNQVhfMTZfQklUUykge1xuXHRcdFx0XHRsYXN0RGlza051bWJlciA9IGdldFVpbnQzMihlbmRPZkRpcmVjdG9yeVZpZXcsIDE2KTtcblx0XHRcdH1cblx0XHRcdGlmIChkaXNrTnVtYmVyID09IE1BWF8xNl9CSVRTKSB7XG5cdFx0XHRcdGRpc2tOdW1iZXIgPSBnZXRVaW50MzIoZW5kT2ZEaXJlY3RvcnlWaWV3LCAyMCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZmlsZXNMZW5ndGggPT0gTUFYXzE2X0JJVFMpIHtcblx0XHRcdFx0ZmlsZXNMZW5ndGggPSBnZXRCaWdVaW50NjQoZW5kT2ZEaXJlY3RvcnlWaWV3LCAzMik7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZGlyZWN0b3J5RGF0YUxlbmd0aCA9PSBNQVhfMzJfQklUUykge1xuXHRcdFx0XHRkaXJlY3RvcnlEYXRhTGVuZ3RoID0gZ2V0QmlnVWludDY0KGVuZE9mRGlyZWN0b3J5VmlldywgNDApO1xuXHRcdFx0fVxuXHRcdFx0ZGlyZWN0b3J5RGF0YU9mZnNldCAtPSBkaXJlY3RvcnlEYXRhTGVuZ3RoO1xuXHRcdH1cblx0XHRpZiAoZGlyZWN0b3J5RGF0YU9mZnNldCA+PSByZWFkZXIuc2l6ZSkge1xuXHRcdFx0cHJlcGVuZGVkRGF0YUxlbmd0aCA9IHJlYWRlci5zaXplIC0gZGlyZWN0b3J5RGF0YU9mZnNldCAtIGRpcmVjdG9yeURhdGFMZW5ndGggLSBFTkRfT0ZfQ0VOVFJBTF9ESVJfTEVOR1RIO1xuXHRcdFx0ZGlyZWN0b3J5RGF0YU9mZnNldCA9IHJlYWRlci5zaXplIC0gZGlyZWN0b3J5RGF0YUxlbmd0aCAtIEVORF9PRl9DRU5UUkFMX0RJUl9MRU5HVEg7XHRcblx0XHR9XG5cdFx0aWYgKGV4cGVjdGVkTGFzdERpc2tOdW1iZXIgIT0gbGFzdERpc2tOdW1iZXIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihFUlJfU1BMSVRfWklQX0ZJTEUpO1xuXHRcdH1cblx0XHRpZiAoZGlyZWN0b3J5RGF0YU9mZnNldCA8IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihFUlJfQkFEX0ZPUk1BVCk7XG5cdFx0fVxuXHRcdGxldCBvZmZzZXQgPSAwO1xuXHRcdGxldCBkaXJlY3RvcnlBcnJheSA9IGF3YWl0IHJlYWRVaW50OEFycmF5KHJlYWRlciwgZGlyZWN0b3J5RGF0YU9mZnNldCwgZGlyZWN0b3J5RGF0YUxlbmd0aCwgZGlza051bWJlcik7XG5cdFx0bGV0IGRpcmVjdG9yeVZpZXcgPSBnZXREYXRhVmlldyhkaXJlY3RvcnlBcnJheSk7XG5cdFx0aWYgKGRpcmVjdG9yeURhdGFMZW5ndGgpIHtcblx0XHRcdGNvbnN0IGV4cGVjdGVkRGlyZWN0b3J5RGF0YU9mZnNldCA9IGVuZE9mRGlyZWN0b3J5SW5mby5vZmZzZXQgLSBkaXJlY3RvcnlEYXRhTGVuZ3RoO1xuXHRcdFx0aWYgKGdldFVpbnQzMihkaXJlY3RvcnlWaWV3LCBvZmZzZXQpICE9IENFTlRSQUxfRklMRV9IRUFERVJfU0lHTkFUVVJFICYmIGRpcmVjdG9yeURhdGFPZmZzZXQgIT0gZXhwZWN0ZWREaXJlY3RvcnlEYXRhT2Zmc2V0KSB7XG5cdFx0XHRcdGNvbnN0IG9yaWdpbmFsRGlyZWN0b3J5RGF0YU9mZnNldCA9IGRpcmVjdG9yeURhdGFPZmZzZXQ7XG5cdFx0XHRcdGRpcmVjdG9yeURhdGFPZmZzZXQgPSBleHBlY3RlZERpcmVjdG9yeURhdGFPZmZzZXQ7XG5cdFx0XHRcdHByZXBlbmRlZERhdGFMZW5ndGggKz0gZGlyZWN0b3J5RGF0YU9mZnNldCAtIG9yaWdpbmFsRGlyZWN0b3J5RGF0YU9mZnNldDtcblx0XHRcdFx0ZGlyZWN0b3J5QXJyYXkgPSBhd2FpdCByZWFkVWludDhBcnJheShyZWFkZXIsIGRpcmVjdG9yeURhdGFPZmZzZXQsIGRpcmVjdG9yeURhdGFMZW5ndGgsIGRpc2tOdW1iZXIpO1xuXHRcdFx0XHRkaXJlY3RvcnlWaWV3ID0gZ2V0RGF0YVZpZXcoZGlyZWN0b3J5QXJyYXkpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBleHBlY3RlZERpcmVjdG9yeURhdGFMZW5ndGggPSBlbmRPZkRpcmVjdG9yeUluZm8ub2Zmc2V0IC0gZGlyZWN0b3J5RGF0YU9mZnNldCAtIChyZWFkZXIubGFzdERpc2tPZmZzZXQgfHwgMCk7XG5cdFx0aWYgKGRpcmVjdG9yeURhdGFMZW5ndGggIT0gZXhwZWN0ZWREaXJlY3RvcnlEYXRhTGVuZ3RoICYmIGV4cGVjdGVkRGlyZWN0b3J5RGF0YUxlbmd0aCA+PSAwKSB7XG5cdFx0XHRkaXJlY3RvcnlEYXRhTGVuZ3RoID0gZXhwZWN0ZWREaXJlY3RvcnlEYXRhTGVuZ3RoO1xuXHRcdFx0ZGlyZWN0b3J5QXJyYXkgPSBhd2FpdCByZWFkVWludDhBcnJheShyZWFkZXIsIGRpcmVjdG9yeURhdGFPZmZzZXQsIGRpcmVjdG9yeURhdGFMZW5ndGgsIGRpc2tOdW1iZXIpO1xuXHRcdFx0ZGlyZWN0b3J5VmlldyA9IGdldERhdGFWaWV3KGRpcmVjdG9yeUFycmF5KTtcblx0XHR9XG5cdFx0aWYgKGRpcmVjdG9yeURhdGFPZmZzZXQgPCAwIHx8IGRpcmVjdG9yeURhdGFPZmZzZXQgPj0gcmVhZGVyLnNpemUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihFUlJfQkFEX0ZPUk1BVCk7XG5cdFx0fVxuXHRcdGNvbnN0IGZpbGVuYW1lRW5jb2RpbmcgPSBnZXRPcHRpb25WYWx1ZSh6aXBSZWFkZXIsIG9wdGlvbnMsIFwiZmlsZW5hbWVFbmNvZGluZ1wiKTtcblx0XHRjb25zdCBjb21tZW50RW5jb2RpbmcgPSBnZXRPcHRpb25WYWx1ZSh6aXBSZWFkZXIsIG9wdGlvbnMsIFwiY29tbWVudEVuY29kaW5nXCIpO1xuXHRcdGZvciAobGV0IGluZGV4RmlsZSA9IDA7IGluZGV4RmlsZSA8IGZpbGVzTGVuZ3RoOyBpbmRleEZpbGUrKykge1xuXHRcdFx0Y29uc3QgZmlsZUVudHJ5ID0gbmV3IFppcEVudHJ5KHJlYWRlciwgY29uZmlnLCB6aXBSZWFkZXIub3B0aW9ucyk7XG5cdFx0XHRpZiAoZ2V0VWludDMyKGRpcmVjdG9yeVZpZXcsIG9mZnNldCkgIT0gQ0VOVFJBTF9GSUxFX0hFQURFUl9TSUdOQVRVUkUpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKEVSUl9DRU5UUkFMX0RJUkVDVE9SWV9OT1RfRk9VTkQpO1xuXHRcdFx0fVxuXHRcdFx0cmVhZENvbW1vbkhlYWRlcihmaWxlRW50cnksIGRpcmVjdG9yeVZpZXcsIG9mZnNldCArIDYpO1xuXHRcdFx0Y29uc3QgbGFuZ3VhZ2VFbmNvZGluZ0ZsYWcgPSBCb29sZWFuKGZpbGVFbnRyeS5iaXRGbGFnLmxhbmd1YWdlRW5jb2RpbmdGbGFnKTtcblx0XHRcdGNvbnN0IGZpbGVuYW1lT2Zmc2V0ID0gb2Zmc2V0ICsgNDY7XG5cdFx0XHRjb25zdCBleHRyYUZpZWxkT2Zmc2V0ID0gZmlsZW5hbWVPZmZzZXQgKyBmaWxlRW50cnkuZmlsZW5hbWVMZW5ndGg7XG5cdFx0XHRjb25zdCBjb21tZW50T2Zmc2V0ID0gZXh0cmFGaWVsZE9mZnNldCArIGZpbGVFbnRyeS5leHRyYUZpZWxkTGVuZ3RoO1xuXHRcdFx0Y29uc3QgdmVyc2lvbk1hZGVCeSA9IGdldFVpbnQxNihkaXJlY3RvcnlWaWV3LCBvZmZzZXQgKyA0KTtcblx0XHRcdGNvbnN0IG1zRG9zQ29tcGF0aWJsZSA9ICh2ZXJzaW9uTWFkZUJ5ICYgMCkgPT0gMDtcblx0XHRcdGNvbnN0IHJhd0ZpbGVuYW1lID0gZGlyZWN0b3J5QXJyYXkuc3ViYXJyYXkoZmlsZW5hbWVPZmZzZXQsIGV4dHJhRmllbGRPZmZzZXQpO1xuXHRcdFx0Y29uc3QgY29tbWVudExlbmd0aCA9IGdldFVpbnQxNihkaXJlY3RvcnlWaWV3LCBvZmZzZXQgKyAzMik7XG5cdFx0XHRjb25zdCBlbmRPZmZzZXQgPSBjb21tZW50T2Zmc2V0ICsgY29tbWVudExlbmd0aDtcblx0XHRcdGNvbnN0IHJhd0NvbW1lbnQgPSBkaXJlY3RvcnlBcnJheS5zdWJhcnJheShjb21tZW50T2Zmc2V0LCBlbmRPZmZzZXQpO1xuXHRcdFx0Y29uc3QgZmlsZW5hbWVVVEY4ID0gbGFuZ3VhZ2VFbmNvZGluZ0ZsYWc7XG5cdFx0XHRjb25zdCBjb21tZW50VVRGOCA9IGxhbmd1YWdlRW5jb2RpbmdGbGFnO1xuXHRcdFx0Y29uc3QgZGlyZWN0b3J5ID0gbXNEb3NDb21wYXRpYmxlICYmICgoZ2V0VWludDgoZGlyZWN0b3J5Vmlldywgb2Zmc2V0ICsgMzgpICYgRklMRV9BVFRSX01TRE9TX0RJUl9NQVNLKSA9PSBGSUxFX0FUVFJfTVNET1NfRElSX01BU0spO1xuXHRcdFx0Y29uc3Qgb2Zmc2V0RmlsZUVudHJ5ID0gZ2V0VWludDMyKGRpcmVjdG9yeVZpZXcsIG9mZnNldCArIDQyKSArIHByZXBlbmRlZERhdGFMZW5ndGg7XG5cdFx0XHRPYmplY3QuYXNzaWduKGZpbGVFbnRyeSwge1xuXHRcdFx0XHR2ZXJzaW9uTWFkZUJ5LFxuXHRcdFx0XHRtc0Rvc0NvbXBhdGlibGUsXG5cdFx0XHRcdGNvbXByZXNzZWRTaXplOiAwLFxuXHRcdFx0XHR1bmNvbXByZXNzZWRTaXplOiAwLFxuXHRcdFx0XHRjb21tZW50TGVuZ3RoLFxuXHRcdFx0XHRkaXJlY3RvcnksXG5cdFx0XHRcdG9mZnNldDogb2Zmc2V0RmlsZUVudHJ5LFxuXHRcdFx0XHRkaXNrTnVtYmVyU3RhcnQ6IGdldFVpbnQxNihkaXJlY3RvcnlWaWV3LCBvZmZzZXQgKyAzNCksXG5cdFx0XHRcdGludGVybmFsRmlsZUF0dHJpYnV0ZTogZ2V0VWludDE2KGRpcmVjdG9yeVZpZXcsIG9mZnNldCArIDM2KSxcblx0XHRcdFx0ZXh0ZXJuYWxGaWxlQXR0cmlidXRlOiBnZXRVaW50MzIoZGlyZWN0b3J5Vmlldywgb2Zmc2V0ICsgMzgpLFxuXHRcdFx0XHRyYXdGaWxlbmFtZSxcblx0XHRcdFx0ZmlsZW5hbWVVVEY4LFxuXHRcdFx0XHRjb21tZW50VVRGOCxcblx0XHRcdFx0cmF3RXh0cmFGaWVsZDogZGlyZWN0b3J5QXJyYXkuc3ViYXJyYXkoZXh0cmFGaWVsZE9mZnNldCwgY29tbWVudE9mZnNldClcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3QgW2ZpbGVuYW1lLCBjb21tZW50XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdFx0ZGVjb2RlVGV4dChyYXdGaWxlbmFtZSwgZmlsZW5hbWVVVEY4ID8gQ0hBUlNFVF9VVEY4IDogZmlsZW5hbWVFbmNvZGluZyB8fCBDSEFSU0VUX0NQNDM3KSxcblx0XHRcdFx0ZGVjb2RlVGV4dChyYXdDb21tZW50LCBjb21tZW50VVRGOCA/IENIQVJTRVRfVVRGOCA6IGNvbW1lbnRFbmNvZGluZyB8fCBDSEFSU0VUX0NQNDM3KVxuXHRcdFx0XSk7XG5cdFx0XHRPYmplY3QuYXNzaWduKGZpbGVFbnRyeSwge1xuXHRcdFx0XHRyYXdDb21tZW50LFxuXHRcdFx0XHRmaWxlbmFtZSxcblx0XHRcdFx0Y29tbWVudCxcblx0XHRcdFx0ZGlyZWN0b3J5OiBkaXJlY3RvcnkgfHwgZmlsZW5hbWUuZW5kc1dpdGgoRElSRUNUT1JZX1NJR05BVFVSRSlcblx0XHRcdH0pO1xuXHRcdFx0c3RhcnRPZmZzZXQgPSBNYXRoLm1heChvZmZzZXRGaWxlRW50cnksIHN0YXJ0T2Zmc2V0KTtcblx0XHRcdGF3YWl0IHJlYWRDb21tb25Gb290ZXIoZmlsZUVudHJ5LCBmaWxlRW50cnksIGRpcmVjdG9yeVZpZXcsIG9mZnNldCArIDYpO1xuXHRcdFx0Y29uc3QgZW50cnkgPSBuZXcgRW50cnkoZmlsZUVudHJ5KTtcblx0XHRcdGVudHJ5LmdldERhdGEgPSAod3JpdGVyLCBvcHRpb25zKSA9PiBmaWxlRW50cnkuZ2V0RGF0YSh3cml0ZXIsIGVudHJ5LCBvcHRpb25zKTtcblx0XHRcdG9mZnNldCA9IGVuZE9mZnNldDtcblx0XHRcdGNvbnN0IHsgb25wcm9ncmVzcyB9ID0gb3B0aW9ucztcblx0XHRcdGlmIChvbnByb2dyZXNzKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgb25wcm9ncmVzcyhpbmRleEZpbGUgKyAxLCBmaWxlc0xlbmd0aCwgbmV3IEVudHJ5KGZpbGVFbnRyeSkpO1xuXHRcdFx0XHR9IGNhdGNoIChfZXJyb3IpIHtcblx0XHRcdFx0XHQvLyBpZ25vcmVkXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHlpZWxkIGVudHJ5O1xuXHRcdH1cblx0XHRjb25zdCBleHRyYWN0UHJlcGVuZGVkRGF0YSA9IGdldE9wdGlvblZhbHVlKHppcFJlYWRlciwgb3B0aW9ucywgXCJleHRyYWN0UHJlcGVuZGVkRGF0YVwiKTtcblx0XHRjb25zdCBleHRyYWN0QXBwZW5kZWREYXRhID0gZ2V0T3B0aW9uVmFsdWUoemlwUmVhZGVyLCBvcHRpb25zLCBcImV4dHJhY3RBcHBlbmRlZERhdGFcIik7XG5cdFx0aWYgKGV4dHJhY3RQcmVwZW5kZWREYXRhKSB7XG5cdFx0XHR6aXBSZWFkZXIucHJlcGVuZGVkRGF0YSA9IHN0YXJ0T2Zmc2V0ID4gMCA/IGF3YWl0IHJlYWRVaW50OEFycmF5KHJlYWRlciwgMCwgc3RhcnRPZmZzZXQpIDogbmV3IFVpbnQ4QXJyYXkoKTtcblx0XHR9XG5cdFx0emlwUmVhZGVyLmNvbW1lbnQgPSBjb21tZW50TGVuZ3RoID8gYXdhaXQgcmVhZFVpbnQ4QXJyYXkocmVhZGVyLCBjb21tZW50T2Zmc2V0ICsgRU5EX09GX0NFTlRSQUxfRElSX0xFTkdUSCwgY29tbWVudExlbmd0aCkgOiBuZXcgVWludDhBcnJheSgpO1xuXHRcdGlmIChleHRyYWN0QXBwZW5kZWREYXRhKSB7XG5cdFx0XHR6aXBSZWFkZXIuYXBwZW5kZWREYXRhID0gYXBwZW5kZWREYXRhT2Zmc2V0IDwgcmVhZGVyLnNpemUgPyBhd2FpdCByZWFkVWludDhBcnJheShyZWFkZXIsIGFwcGVuZGVkRGF0YU9mZnNldCwgcmVhZGVyLnNpemUgLSBhcHBlbmRlZERhdGFPZmZzZXQpIDogbmV3IFVpbnQ4QXJyYXkoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRhc3luYyBnZXRFbnRyaWVzKG9wdGlvbnMgPSB7fSkge1xuXHRcdGNvbnN0IGVudHJpZXMgPSBbXTtcblx0XHRmb3IgYXdhaXQgKGNvbnN0IGVudHJ5IG9mIHRoaXMuZ2V0RW50cmllc0dlbmVyYXRvcihvcHRpb25zKSkge1xuXHRcdFx0ZW50cmllcy5wdXNoKGVudHJ5KTtcblx0XHR9XG5cdFx0cmV0dXJuIGVudHJpZXM7XG5cdH1cblxuXHRhc3luYyBjbG9zZSgpIHtcblx0fVxufVxuXG5leHBvcnQge1xuXHRaaXBSZWFkZXIsXG5cdEVSUl9CQURfRk9STUFULFxuXHRFUlJfRU9DRFJfTk9UX0ZPVU5ELFxuXHRFUlJfRU9DRFJfWklQNjRfTk9UX0ZPVU5ELFxuXHRFUlJfRU9DRFJfTE9DQVRPUl9aSVA2NF9OT1RfRk9VTkQsXG5cdEVSUl9DRU5UUkFMX0RJUkVDVE9SWV9OT1RfRk9VTkQsXG5cdEVSUl9MT0NBTF9GSUxFX0hFQURFUl9OT1RfRk9VTkQsXG5cdEVSUl9FWFRSQUZJRUxEX1pJUDY0X05PVF9GT1VORCxcblx0RVJSX0VOQ1JZUFRFRCxcblx0RVJSX1VOU1VQUE9SVEVEX0VOQ1JZUFRJT04sXG5cdEVSUl9VTlNVUFBPUlRFRF9DT01QUkVTU0lPTixcblx0RVJSX0lOVkFMSURfU0lHTkFUVVJFLFxuXHRFUlJfSU5WQUxJRF9QQVNTV09SRCxcblx0RVJSX1NQTElUX1pJUF9GSUxFXG59O1xuXG5jbGFzcyBaaXBFbnRyeSB7XG5cblx0Y29uc3RydWN0b3IocmVhZGVyLCBjb25maWcsIG9wdGlvbnMpIHtcblx0XHRPYmplY3QuYXNzaWduKHRoaXMsIHtcblx0XHRcdHJlYWRlcixcblx0XHRcdGNvbmZpZyxcblx0XHRcdG9wdGlvbnNcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIGdldERhdGEod3JpdGVyLCBmaWxlRW50cnksIG9wdGlvbnMgPSB7fSkge1xuXHRcdGNvbnN0IHppcEVudHJ5ID0gdGhpcztcblx0XHRjb25zdCB7XG5cdFx0XHRyZWFkZXIsXG5cdFx0XHRvZmZzZXQsXG5cdFx0XHRkaXNrTnVtYmVyU3RhcnQsXG5cdFx0XHRleHRyYUZpZWxkQUVTLFxuXHRcdFx0Y29tcHJlc3Npb25NZXRob2QsXG5cdFx0XHRjb25maWcsXG5cdFx0XHRiaXRGbGFnLFxuXHRcdFx0c2lnbmF0dXJlLFxuXHRcdFx0cmF3TGFzdE1vZERhdGUsXG5cdFx0XHR1bmNvbXByZXNzZWRTaXplLFxuXHRcdFx0Y29tcHJlc3NlZFNpemVcblx0XHR9ID0gemlwRW50cnk7XG5cdFx0Y29uc3QgbG9jYWxEaXJlY3RvcnkgPSBmaWxlRW50cnkubG9jYWxEaXJlY3RvcnkgPSB7fTtcblx0XHRjb25zdCBkYXRhQXJyYXkgPSBhd2FpdCByZWFkVWludDhBcnJheShyZWFkZXIsIG9mZnNldCwgMzAsIGRpc2tOdW1iZXJTdGFydCk7XG5cdFx0Y29uc3QgZGF0YVZpZXcgPSBnZXREYXRhVmlldyhkYXRhQXJyYXkpO1xuXHRcdGxldCBwYXNzd29yZCA9IGdldE9wdGlvblZhbHVlKHppcEVudHJ5LCBvcHRpb25zLCBcInBhc3N3b3JkXCIpO1xuXHRcdHBhc3N3b3JkID0gcGFzc3dvcmQgJiYgcGFzc3dvcmQubGVuZ3RoICYmIHBhc3N3b3JkO1xuXHRcdGlmIChleHRyYUZpZWxkQUVTKSB7XG5cdFx0XHRpZiAoZXh0cmFGaWVsZEFFUy5vcmlnaW5hbENvbXByZXNzaW9uTWV0aG9kICE9IENPTVBSRVNTSU9OX01FVEhPRF9BRVMpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKEVSUl9VTlNVUFBPUlRFRF9DT01QUkVTU0lPTik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjb21wcmVzc2lvbk1ldGhvZCAhPSBDT01QUkVTU0lPTl9NRVRIT0RfU1RPUkUgJiYgY29tcHJlc3Npb25NZXRob2QgIT0gQ09NUFJFU1NJT05fTUVUSE9EX0RFRkxBVEUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihFUlJfVU5TVVBQT1JURURfQ09NUFJFU1NJT04pO1xuXHRcdH1cblx0XHRpZiAoZ2V0VWludDMyKGRhdGFWaWV3LCAwKSAhPSBMT0NBTF9GSUxFX0hFQURFUl9TSUdOQVRVUkUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihFUlJfTE9DQUxfRklMRV9IRUFERVJfTk9UX0ZPVU5EKTtcblx0XHR9XG5cdFx0cmVhZENvbW1vbkhlYWRlcihsb2NhbERpcmVjdG9yeSwgZGF0YVZpZXcsIDQpO1xuXHRcdGxvY2FsRGlyZWN0b3J5LnJhd0V4dHJhRmllbGQgPSBsb2NhbERpcmVjdG9yeS5leHRyYUZpZWxkTGVuZ3RoID9cblx0XHRcdGF3YWl0IHJlYWRVaW50OEFycmF5KHJlYWRlciwgb2Zmc2V0ICsgMzAgKyBsb2NhbERpcmVjdG9yeS5maWxlbmFtZUxlbmd0aCwgbG9jYWxEaXJlY3RvcnkuZXh0cmFGaWVsZExlbmd0aCwgZGlza051bWJlclN0YXJ0KSA6XG5cdFx0XHRuZXcgVWludDhBcnJheSgpO1xuXHRcdGF3YWl0IHJlYWRDb21tb25Gb290ZXIoemlwRW50cnksIGxvY2FsRGlyZWN0b3J5LCBkYXRhVmlldywgNCwgdHJ1ZSk7XG5cdFx0T2JqZWN0LmFzc2lnbihmaWxlRW50cnksIHtcblx0XHRcdGxhc3RBY2Nlc3NEYXRlOiBsb2NhbERpcmVjdG9yeS5sYXN0QWNjZXNzRGF0ZSxcblx0XHRcdGNyZWF0aW9uRGF0ZTogbG9jYWxEaXJlY3RvcnkuY3JlYXRpb25EYXRlXG5cdFx0fSk7XG5cdFx0Y29uc3QgZW5jcnlwdGVkID0gemlwRW50cnkuZW5jcnlwdGVkICYmIGxvY2FsRGlyZWN0b3J5LmVuY3J5cHRlZDtcblx0XHRjb25zdCB6aXBDcnlwdG8gPSBlbmNyeXB0ZWQgJiYgIWV4dHJhRmllbGRBRVM7XG5cdFx0aWYgKGVuY3J5cHRlZCkge1xuXHRcdFx0aWYgKCF6aXBDcnlwdG8gJiYgZXh0cmFGaWVsZEFFUy5zdHJlbmd0aCA9PT0gVU5ERUZJTkVEX1ZBTFVFKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihFUlJfVU5TVVBQT1JURURfRU5DUllQVElPTik7XG5cdFx0XHR9IGVsc2UgaWYgKCFwYXNzd29yZCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoRVJSX0VOQ1JZUFRFRCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IGRhdGFPZmZzZXQgPSBvZmZzZXQgKyAzMCArIGxvY2FsRGlyZWN0b3J5LmZpbGVuYW1lTGVuZ3RoICsgbG9jYWxEaXJlY3RvcnkuZXh0cmFGaWVsZExlbmd0aDtcblx0XHRjb25zdCBzaXplID0gY29tcHJlc3NlZFNpemU7XG5cdFx0Y29uc3QgcmVhZGFibGUgPSByZWFkZXIucmVhZGFibGU7XG5cdFx0T2JqZWN0LmFzc2lnbihyZWFkYWJsZSwge1xuXHRcdFx0ZGlza051bWJlclN0YXJ0LFxuXHRcdFx0b2Zmc2V0OiBkYXRhT2Zmc2V0LFxuXHRcdFx0c2l6ZVxuXHRcdH0pO1xuXHRcdGNvbnN0IHNpZ25hbCA9IGdldE9wdGlvblZhbHVlKHppcEVudHJ5LCBvcHRpb25zLCBcInNpZ25hbFwiKTtcblx0XHRjb25zdCBjaGVja1Bhc3N3b3JkT25seSA9IGdldE9wdGlvblZhbHVlKHppcEVudHJ5LCBvcHRpb25zLCBcImNoZWNrUGFzc3dvcmRPbmx5XCIpO1xuXHRcdGlmIChjaGVja1Bhc3N3b3JkT25seSkge1xuXHRcdFx0d3JpdGVyID0gbmV3IFdyaXRhYmxlU3RyZWFtKCk7XG5cdFx0fVxuXHRcdHdyaXRlciA9IGluaXRXcml0ZXIod3JpdGVyKTtcblx0XHRhd2FpdCBpbml0U3RyZWFtKHdyaXRlciwgdW5jb21wcmVzc2VkU2l6ZSk7XG5cdFx0Y29uc3QgeyB3cml0YWJsZSB9ID0gd3JpdGVyO1xuXHRcdGNvbnN0IHsgb25zdGFydCwgb25wcm9ncmVzcywgb25lbmQgfSA9IG9wdGlvbnM7XG5cdFx0Y29uc3Qgd29ya2VyT3B0aW9ucyA9IHtcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0Y29kZWNUeXBlOiBDT0RFQ19JTkZMQVRFLFxuXHRcdFx0XHRwYXNzd29yZCxcblx0XHRcdFx0emlwQ3J5cHRvLFxuXHRcdFx0XHRlbmNyeXB0aW9uU3RyZW5ndGg6IGV4dHJhRmllbGRBRVMgJiYgZXh0cmFGaWVsZEFFUy5zdHJlbmd0aCxcblx0XHRcdFx0c2lnbmVkOiBnZXRPcHRpb25WYWx1ZSh6aXBFbnRyeSwgb3B0aW9ucywgXCJjaGVja1NpZ25hdHVyZVwiKSxcblx0XHRcdFx0cGFzc3dvcmRWZXJpZmljYXRpb246IHppcENyeXB0byAmJiAoYml0RmxhZy5kYXRhRGVzY3JpcHRvciA/ICgocmF3TGFzdE1vZERhdGUgPj4+IDgpICYgMHhGRikgOiAoKHNpZ25hdHVyZSA+Pj4gMjQpICYgMHhGRikpLFxuXHRcdFx0XHRzaWduYXR1cmUsXG5cdFx0XHRcdGNvbXByZXNzZWQ6IGNvbXByZXNzaW9uTWV0aG9kICE9IDAsXG5cdFx0XHRcdGVuY3J5cHRlZCxcblx0XHRcdFx0dXNlV2ViV29ya2VyczogZ2V0T3B0aW9uVmFsdWUoemlwRW50cnksIG9wdGlvbnMsIFwidXNlV2ViV29ya2Vyc1wiKSxcblx0XHRcdFx0dXNlQ29tcHJlc3Npb25TdHJlYW06IGdldE9wdGlvblZhbHVlKHppcEVudHJ5LCBvcHRpb25zLCBcInVzZUNvbXByZXNzaW9uU3RyZWFtXCIpLFxuXHRcdFx0XHR0cmFuc2ZlclN0cmVhbXM6IGdldE9wdGlvblZhbHVlKHppcEVudHJ5LCBvcHRpb25zLCBcInRyYW5zZmVyU3RyZWFtc1wiKSxcblx0XHRcdFx0Y2hlY2tQYXNzd29yZE9ubHlcblx0XHRcdH0sXG5cdFx0XHRjb25maWcsXG5cdFx0XHRzdHJlYW1PcHRpb25zOiB7IHNpZ25hbCwgc2l6ZSwgb25zdGFydCwgb25wcm9ncmVzcywgb25lbmQgfVxuXHRcdH07XG5cdFx0bGV0IG91dHB1dFNpemUgPSAwO1xuXHRcdHRyeSB7XG5cdFx0XHQoeyBvdXRwdXRTaXplIH0gPSAoYXdhaXQgcnVuV29ya2VyKHsgcmVhZGFibGUsIHdyaXRhYmxlIH0sIHdvcmtlck9wdGlvbnMpKSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmICghY2hlY2tQYXNzd29yZE9ubHkgfHwgZXJyb3IubWVzc2FnZSAhPSBFUlJfQUJPUlRfQ0hFQ0tfUEFTU1dPUkQpIHtcblx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGNvbnN0IHByZXZlbnRDbG9zZSA9IGdldE9wdGlvblZhbHVlKHppcEVudHJ5LCBvcHRpb25zLCBcInByZXZlbnRDbG9zZVwiKTtcblx0XHRcdHdyaXRhYmxlLnNpemUgKz0gb3V0cHV0U2l6ZTtcblx0XHRcdGlmICghcHJldmVudENsb3NlICYmICF3cml0YWJsZS5sb2NrZWQpIHtcblx0XHRcdFx0YXdhaXQgd3JpdGFibGUuZ2V0V3JpdGVyKCkuY2xvc2UoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGNoZWNrUGFzc3dvcmRPbmx5ID8gdW5kZWZpbmVkIDogd3JpdGVyLmdldERhdGEgPyB3cml0ZXIuZ2V0RGF0YSgpIDogd3JpdGFibGU7XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVhZENvbW1vbkhlYWRlcihkaXJlY3RvcnksIGRhdGFWaWV3LCBvZmZzZXQpIHtcblx0Y29uc3QgcmF3Qml0RmxhZyA9IGRpcmVjdG9yeS5yYXdCaXRGbGFnID0gZ2V0VWludDE2KGRhdGFWaWV3LCBvZmZzZXQgKyAyKTtcblx0Y29uc3QgZW5jcnlwdGVkID0gKHJhd0JpdEZsYWcgJiBCSVRGTEFHX0VOQ1JZUFRFRCkgPT0gQklURkxBR19FTkNSWVBURUQ7XG5cdGNvbnN0IHJhd0xhc3RNb2REYXRlID0gZ2V0VWludDMyKGRhdGFWaWV3LCBvZmZzZXQgKyA2KTtcblx0T2JqZWN0LmFzc2lnbihkaXJlY3RvcnksIHtcblx0XHRlbmNyeXB0ZWQsXG5cdFx0dmVyc2lvbjogZ2V0VWludDE2KGRhdGFWaWV3LCBvZmZzZXQpLFxuXHRcdGJpdEZsYWc6IHtcblx0XHRcdGxldmVsOiAocmF3Qml0RmxhZyAmIEJJVEZMQUdfTEVWRUwpID4+IDEsXG5cdFx0XHRkYXRhRGVzY3JpcHRvcjogKHJhd0JpdEZsYWcgJiBCSVRGTEFHX0RBVEFfREVTQ1JJUFRPUikgPT0gQklURkxBR19EQVRBX0RFU0NSSVBUT1IsXG5cdFx0XHRsYW5ndWFnZUVuY29kaW5nRmxhZzogKHJhd0JpdEZsYWcgJiBCSVRGTEFHX0xBTkdfRU5DT0RJTkdfRkxBRykgPT0gQklURkxBR19MQU5HX0VOQ09ESU5HX0ZMQUdcblx0XHR9LFxuXHRcdHJhd0xhc3RNb2REYXRlLFxuXHRcdGxhc3RNb2REYXRlOiBnZXREYXRlKHJhd0xhc3RNb2REYXRlKSxcblx0XHRmaWxlbmFtZUxlbmd0aDogZ2V0VWludDE2KGRhdGFWaWV3LCBvZmZzZXQgKyAyMiksXG5cdFx0ZXh0cmFGaWVsZExlbmd0aDogZ2V0VWludDE2KGRhdGFWaWV3LCBvZmZzZXQgKyAyNClcblx0fSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlYWRDb21tb25Gb290ZXIoZmlsZUVudHJ5LCBkaXJlY3RvcnksIGRhdGFWaWV3LCBvZmZzZXQsIGxvY2FsRGlyZWN0b3J5KSB7XG5cdGNvbnN0IHsgcmF3RXh0cmFGaWVsZCB9ID0gZGlyZWN0b3J5O1xuXHRjb25zdCBleHRyYUZpZWxkID0gZGlyZWN0b3J5LmV4dHJhRmllbGQgPSBuZXcgTWFwKCk7XG5cdGNvbnN0IHJhd0V4dHJhRmllbGRWaWV3ID0gZ2V0RGF0YVZpZXcobmV3IFVpbnQ4QXJyYXkocmF3RXh0cmFGaWVsZCkpO1xuXHRsZXQgb2Zmc2V0RXh0cmFGaWVsZCA9IDA7XG5cdHRyeSB7XG5cdFx0d2hpbGUgKG9mZnNldEV4dHJhRmllbGQgPCByYXdFeHRyYUZpZWxkLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgdHlwZSA9IGdldFVpbnQxNihyYXdFeHRyYUZpZWxkVmlldywgb2Zmc2V0RXh0cmFGaWVsZCk7XG5cdFx0XHRjb25zdCBzaXplID0gZ2V0VWludDE2KHJhd0V4dHJhRmllbGRWaWV3LCBvZmZzZXRFeHRyYUZpZWxkICsgMik7XG5cdFx0XHRleHRyYUZpZWxkLnNldCh0eXBlLCB7XG5cdFx0XHRcdHR5cGUsXG5cdFx0XHRcdGRhdGE6IHJhd0V4dHJhRmllbGQuc2xpY2Uob2Zmc2V0RXh0cmFGaWVsZCArIDQsIG9mZnNldEV4dHJhRmllbGQgKyA0ICsgc2l6ZSlcblx0XHRcdH0pO1xuXHRcdFx0b2Zmc2V0RXh0cmFGaWVsZCArPSA0ICsgc2l6ZTtcblx0XHR9XG5cdH0gY2F0Y2ggKF9lcnJvcikge1xuXHRcdC8vIGlnbm9yZWRcblx0fVxuXHRjb25zdCBjb21wcmVzc2lvbk1ldGhvZCA9IGdldFVpbnQxNihkYXRhVmlldywgb2Zmc2V0ICsgNCk7XG5cdE9iamVjdC5hc3NpZ24oZGlyZWN0b3J5LCB7XG5cdFx0c2lnbmF0dXJlOiBnZXRVaW50MzIoZGF0YVZpZXcsIG9mZnNldCArIDEwKSxcblx0XHR1bmNvbXByZXNzZWRTaXplOiBnZXRVaW50MzIoZGF0YVZpZXcsIG9mZnNldCArIDE4KSxcblx0XHRjb21wcmVzc2VkU2l6ZTogZ2V0VWludDMyKGRhdGFWaWV3LCBvZmZzZXQgKyAxNClcblx0fSk7XG5cdGNvbnN0IGV4dHJhRmllbGRaaXA2NCA9IGV4dHJhRmllbGQuZ2V0KEVYVFJBRklFTERfVFlQRV9aSVA2NCk7XG5cdGlmIChleHRyYUZpZWxkWmlwNjQpIHtcblx0XHRyZWFkRXh0cmFGaWVsZFppcDY0KGV4dHJhRmllbGRaaXA2NCwgZGlyZWN0b3J5KTtcblx0XHRkaXJlY3RvcnkuZXh0cmFGaWVsZFppcDY0ID0gZXh0cmFGaWVsZFppcDY0O1xuXHR9XG5cdGNvbnN0IGV4dHJhRmllbGRVbmljb2RlUGF0aCA9IGV4dHJhRmllbGQuZ2V0KEVYVFJBRklFTERfVFlQRV9VTklDT0RFX1BBVEgpO1xuXHRpZiAoZXh0cmFGaWVsZFVuaWNvZGVQYXRoKSB7XG5cdFx0YXdhaXQgcmVhZEV4dHJhRmllbGRVbmljb2RlKGV4dHJhRmllbGRVbmljb2RlUGF0aCwgUFJPUEVSVFlfTkFNRV9GSUxFTkFNRSwgUFJPUEVSVFlfTkFNRV9SQVdfRklMRU5BTUUsIGRpcmVjdG9yeSwgZmlsZUVudHJ5KTtcblx0XHRkaXJlY3RvcnkuZXh0cmFGaWVsZFVuaWNvZGVQYXRoID0gZXh0cmFGaWVsZFVuaWNvZGVQYXRoO1xuXHR9XG5cdGNvbnN0IGV4dHJhRmllbGRVbmljb2RlQ29tbWVudCA9IGV4dHJhRmllbGQuZ2V0KEVYVFJBRklFTERfVFlQRV9VTklDT0RFX0NPTU1FTlQpO1xuXHRpZiAoZXh0cmFGaWVsZFVuaWNvZGVDb21tZW50KSB7XG5cdFx0YXdhaXQgcmVhZEV4dHJhRmllbGRVbmljb2RlKGV4dHJhRmllbGRVbmljb2RlQ29tbWVudCwgUFJPUEVSVFlfTkFNRV9DT01NRU5ULCBQUk9QRVJUWV9OQU1FX1JBV19DT01NRU5ULCBkaXJlY3RvcnksIGZpbGVFbnRyeSk7XG5cdFx0ZGlyZWN0b3J5LmV4dHJhRmllbGRVbmljb2RlQ29tbWVudCA9IGV4dHJhRmllbGRVbmljb2RlQ29tbWVudDtcblx0fVxuXHRjb25zdCBleHRyYUZpZWxkQUVTID0gZXh0cmFGaWVsZC5nZXQoRVhUUkFGSUVMRF9UWVBFX0FFUyk7XG5cdGlmIChleHRyYUZpZWxkQUVTKSB7XG5cdFx0cmVhZEV4dHJhRmllbGRBRVMoZXh0cmFGaWVsZEFFUywgZGlyZWN0b3J5LCBjb21wcmVzc2lvbk1ldGhvZCk7XG5cdFx0ZGlyZWN0b3J5LmV4dHJhRmllbGRBRVMgPSBleHRyYUZpZWxkQUVTO1xuXHR9IGVsc2Uge1xuXHRcdGRpcmVjdG9yeS5jb21wcmVzc2lvbk1ldGhvZCA9IGNvbXByZXNzaW9uTWV0aG9kO1xuXHR9XG5cdGNvbnN0IGV4dHJhRmllbGROVEZTID0gZXh0cmFGaWVsZC5nZXQoRVhUUkFGSUVMRF9UWVBFX05URlMpO1xuXHRpZiAoZXh0cmFGaWVsZE5URlMpIHtcblx0XHRyZWFkRXh0cmFGaWVsZE5URlMoZXh0cmFGaWVsZE5URlMsIGRpcmVjdG9yeSk7XG5cdFx0ZGlyZWN0b3J5LmV4dHJhRmllbGROVEZTID0gZXh0cmFGaWVsZE5URlM7XG5cdH1cblx0Y29uc3QgZXh0cmFGaWVsZEV4dGVuZGVkVGltZXN0YW1wID0gZXh0cmFGaWVsZC5nZXQoRVhUUkFGSUVMRF9UWVBFX0VYVEVOREVEX1RJTUVTVEFNUCk7XG5cdGlmIChleHRyYUZpZWxkRXh0ZW5kZWRUaW1lc3RhbXApIHtcblx0XHRyZWFkRXh0cmFGaWVsZEV4dGVuZGVkVGltZXN0YW1wKGV4dHJhRmllbGRFeHRlbmRlZFRpbWVzdGFtcCwgZGlyZWN0b3J5LCBsb2NhbERpcmVjdG9yeSk7XG5cdFx0ZGlyZWN0b3J5LmV4dHJhRmllbGRFeHRlbmRlZFRpbWVzdGFtcCA9IGV4dHJhRmllbGRFeHRlbmRlZFRpbWVzdGFtcDtcblx0fVxuXHRjb25zdCBleHRyYUZpZWxkVVNEWiA9IGV4dHJhRmllbGQuZ2V0KEVYVFJBRklFTERfVFlQRV9VU0RaKTtcblx0aWYgKGV4dHJhRmllbGRVU0RaKSB7XG5cdFx0ZGlyZWN0b3J5LmV4dHJhRmllbGRVU0RaID0gZXh0cmFGaWVsZFVTRFo7XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVhZEV4dHJhRmllbGRaaXA2NChleHRyYUZpZWxkWmlwNjQsIGRpcmVjdG9yeSkge1xuXHRkaXJlY3RvcnkuemlwNjQgPSB0cnVlO1xuXHRjb25zdCBleHRyYUZpZWxkVmlldyA9IGdldERhdGFWaWV3KGV4dHJhRmllbGRaaXA2NC5kYXRhKTtcblx0Y29uc3QgbWlzc2luZ1Byb3BlcnRpZXMgPSBaSVA2NF9QUk9QRVJUSUVTLmZpbHRlcigoW3Byb3BlcnR5TmFtZSwgbWF4XSkgPT4gZGlyZWN0b3J5W3Byb3BlcnR5TmFtZV0gPT0gbWF4KTtcblx0Zm9yIChsZXQgaW5kZXhNaXNzaW5nUHJvcGVydHkgPSAwLCBvZmZzZXQgPSAwOyBpbmRleE1pc3NpbmdQcm9wZXJ0eSA8IG1pc3NpbmdQcm9wZXJ0aWVzLmxlbmd0aDsgaW5kZXhNaXNzaW5nUHJvcGVydHkrKykge1xuXHRcdGNvbnN0IFtwcm9wZXJ0eU5hbWUsIG1heF0gPSBtaXNzaW5nUHJvcGVydGllc1tpbmRleE1pc3NpbmdQcm9wZXJ0eV07XG5cdFx0aWYgKGRpcmVjdG9yeVtwcm9wZXJ0eU5hbWVdID09IG1heCkge1xuXHRcdFx0Y29uc3QgZXh0cmFjdGlvbiA9IFpJUDY0X0VYVFJBQ1RJT05bbWF4XTtcblx0XHRcdGRpcmVjdG9yeVtwcm9wZXJ0eU5hbWVdID0gZXh0cmFGaWVsZFppcDY0W3Byb3BlcnR5TmFtZV0gPSBleHRyYWN0aW9uLmdldFZhbHVlKGV4dHJhRmllbGRWaWV3LCBvZmZzZXQpO1xuXHRcdFx0b2Zmc2V0ICs9IGV4dHJhY3Rpb24uYnl0ZXM7XG5cdFx0fSBlbHNlIGlmIChleHRyYUZpZWxkWmlwNjRbcHJvcGVydHlOYW1lXSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKEVSUl9FWFRSQUZJRUxEX1pJUDY0X05PVF9GT1VORCk7XG5cdFx0fVxuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlYWRFeHRyYUZpZWxkVW5pY29kZShleHRyYUZpZWxkVW5pY29kZSwgcHJvcGVydHlOYW1lLCByYXdQcm9wZXJ0eU5hbWUsIGRpcmVjdG9yeSwgZmlsZUVudHJ5KSB7XG5cdGNvbnN0IGV4dHJhRmllbGRWaWV3ID0gZ2V0RGF0YVZpZXcoZXh0cmFGaWVsZFVuaWNvZGUuZGF0YSk7XG5cdGNvbnN0IGNyYzMyID0gbmV3IENyYzMyKCk7XG5cdGNyYzMyLmFwcGVuZChmaWxlRW50cnlbcmF3UHJvcGVydHlOYW1lXSk7XG5cdGNvbnN0IGRhdGFWaWV3U2lnbmF0dXJlID0gZ2V0RGF0YVZpZXcobmV3IFVpbnQ4QXJyYXkoNCkpO1xuXHRkYXRhVmlld1NpZ25hdHVyZS5zZXRVaW50MzIoMCwgY3JjMzIuZ2V0KCksIHRydWUpO1xuXHRjb25zdCBzaWduYXR1cmUgPSBnZXRVaW50MzIoZXh0cmFGaWVsZFZpZXcsIDEpO1xuXHRPYmplY3QuYXNzaWduKGV4dHJhRmllbGRVbmljb2RlLCB7XG5cdFx0dmVyc2lvbjogZ2V0VWludDgoZXh0cmFGaWVsZFZpZXcsIDApLFxuXHRcdFtwcm9wZXJ0eU5hbWVdOiBkZWNvZGVUZXh0KGV4dHJhRmllbGRVbmljb2RlLmRhdGEuc3ViYXJyYXkoNSkpLFxuXHRcdHZhbGlkOiAhZmlsZUVudHJ5LmJpdEZsYWcubGFuZ3VhZ2VFbmNvZGluZ0ZsYWcgJiYgc2lnbmF0dXJlID09IGdldFVpbnQzMihkYXRhVmlld1NpZ25hdHVyZSwgMClcblx0fSk7XG5cdGlmIChleHRyYUZpZWxkVW5pY29kZS52YWxpZCkge1xuXHRcdGRpcmVjdG9yeVtwcm9wZXJ0eU5hbWVdID0gZXh0cmFGaWVsZFVuaWNvZGVbcHJvcGVydHlOYW1lXTtcblx0XHRkaXJlY3RvcnlbcHJvcGVydHlOYW1lICsgXCJVVEY4XCJdID0gdHJ1ZTtcblx0fVxufVxuXG5mdW5jdGlvbiByZWFkRXh0cmFGaWVsZEFFUyhleHRyYUZpZWxkQUVTLCBkaXJlY3RvcnksIGNvbXByZXNzaW9uTWV0aG9kKSB7XG5cdGNvbnN0IGV4dHJhRmllbGRWaWV3ID0gZ2V0RGF0YVZpZXcoZXh0cmFGaWVsZEFFUy5kYXRhKTtcblx0Y29uc3Qgc3RyZW5ndGggPSBnZXRVaW50OChleHRyYUZpZWxkVmlldywgNCk7XG5cdE9iamVjdC5hc3NpZ24oZXh0cmFGaWVsZEFFUywge1xuXHRcdHZlbmRvclZlcnNpb246IGdldFVpbnQ4KGV4dHJhRmllbGRWaWV3LCAwKSxcblx0XHR2ZW5kb3JJZDogZ2V0VWludDgoZXh0cmFGaWVsZFZpZXcsIDIpLFxuXHRcdHN0cmVuZ3RoLFxuXHRcdG9yaWdpbmFsQ29tcHJlc3Npb25NZXRob2Q6IGNvbXByZXNzaW9uTWV0aG9kLFxuXHRcdGNvbXByZXNzaW9uTWV0aG9kOiBnZXRVaW50MTYoZXh0cmFGaWVsZFZpZXcsIDUpXG5cdH0pO1xuXHRkaXJlY3RvcnkuY29tcHJlc3Npb25NZXRob2QgPSBleHRyYUZpZWxkQUVTLmNvbXByZXNzaW9uTWV0aG9kO1xufVxuXG5mdW5jdGlvbiByZWFkRXh0cmFGaWVsZE5URlMoZXh0cmFGaWVsZE5URlMsIGRpcmVjdG9yeSkge1xuXHRjb25zdCBleHRyYUZpZWxkVmlldyA9IGdldERhdGFWaWV3KGV4dHJhRmllbGROVEZTLmRhdGEpO1xuXHRsZXQgb2Zmc2V0RXh0cmFGaWVsZCA9IDQ7XG5cdGxldCB0YWcxRGF0YTtcblx0dHJ5IHtcblx0XHR3aGlsZSAob2Zmc2V0RXh0cmFGaWVsZCA8IGV4dHJhRmllbGROVEZTLmRhdGEubGVuZ3RoICYmICF0YWcxRGF0YSkge1xuXHRcdFx0Y29uc3QgdGFnVmFsdWUgPSBnZXRVaW50MTYoZXh0cmFGaWVsZFZpZXcsIG9mZnNldEV4dHJhRmllbGQpO1xuXHRcdFx0Y29uc3QgYXR0cmlidXRlU2l6ZSA9IGdldFVpbnQxNihleHRyYUZpZWxkVmlldywgb2Zmc2V0RXh0cmFGaWVsZCArIDIpO1xuXHRcdFx0aWYgKHRhZ1ZhbHVlID09IEVYVFJBRklFTERfVFlQRV9OVEZTX1RBRzEpIHtcblx0XHRcdFx0dGFnMURhdGEgPSBleHRyYUZpZWxkTlRGUy5kYXRhLnNsaWNlKG9mZnNldEV4dHJhRmllbGQgKyA0LCBvZmZzZXRFeHRyYUZpZWxkICsgNCArIGF0dHJpYnV0ZVNpemUpO1xuXHRcdFx0fVxuXHRcdFx0b2Zmc2V0RXh0cmFGaWVsZCArPSA0ICsgYXR0cmlidXRlU2l6ZTtcblx0XHR9XG5cdH0gY2F0Y2ggKF9lcnJvcikge1xuXHRcdC8vIGlnbm9yZWRcblx0fVxuXHR0cnkge1xuXHRcdGlmICh0YWcxRGF0YSAmJiB0YWcxRGF0YS5sZW5ndGggPT0gMjQpIHtcblx0XHRcdGNvbnN0IHRhZzFWaWV3ID0gZ2V0RGF0YVZpZXcodGFnMURhdGEpO1xuXHRcdFx0Y29uc3QgcmF3TGFzdE1vZERhdGUgPSB0YWcxVmlldy5nZXRCaWdVaW50NjQoMCwgdHJ1ZSk7XG5cdFx0XHRjb25zdCByYXdMYXN0QWNjZXNzRGF0ZSA9IHRhZzFWaWV3LmdldEJpZ1VpbnQ2NCg4LCB0cnVlKTtcblx0XHRcdGNvbnN0IHJhd0NyZWF0aW9uRGF0ZSA9IHRhZzFWaWV3LmdldEJpZ1VpbnQ2NCgxNiwgdHJ1ZSk7XG5cdFx0XHRPYmplY3QuYXNzaWduKGV4dHJhRmllbGROVEZTLCB7XG5cdFx0XHRcdHJhd0xhc3RNb2REYXRlLFxuXHRcdFx0XHRyYXdMYXN0QWNjZXNzRGF0ZSxcblx0XHRcdFx0cmF3Q3JlYXRpb25EYXRlXG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGxhc3RNb2REYXRlID0gZ2V0RGF0ZU5URlMocmF3TGFzdE1vZERhdGUpO1xuXHRcdFx0Y29uc3QgbGFzdEFjY2Vzc0RhdGUgPSBnZXREYXRlTlRGUyhyYXdMYXN0QWNjZXNzRGF0ZSk7XG5cdFx0XHRjb25zdCBjcmVhdGlvbkRhdGUgPSBnZXREYXRlTlRGUyhyYXdDcmVhdGlvbkRhdGUpO1xuXHRcdFx0Y29uc3QgZXh0cmFGaWVsZERhdGEgPSB7IGxhc3RNb2REYXRlLCBsYXN0QWNjZXNzRGF0ZSwgY3JlYXRpb25EYXRlIH07XG5cdFx0XHRPYmplY3QuYXNzaWduKGV4dHJhRmllbGROVEZTLCBleHRyYUZpZWxkRGF0YSk7XG5cdFx0XHRPYmplY3QuYXNzaWduKGRpcmVjdG9yeSwgZXh0cmFGaWVsZERhdGEpO1xuXHRcdH1cblx0fSBjYXRjaCAoX2Vycm9yKSB7XG5cdFx0Ly8gaWdub3JlZFxuXHR9XG59XG5cbmZ1bmN0aW9uIHJlYWRFeHRyYUZpZWxkRXh0ZW5kZWRUaW1lc3RhbXAoZXh0cmFGaWVsZEV4dGVuZGVkVGltZXN0YW1wLCBkaXJlY3RvcnksIGxvY2FsRGlyZWN0b3J5KSB7XG5cdGNvbnN0IGV4dHJhRmllbGRWaWV3ID0gZ2V0RGF0YVZpZXcoZXh0cmFGaWVsZEV4dGVuZGVkVGltZXN0YW1wLmRhdGEpO1xuXHRjb25zdCBmbGFncyA9IGdldFVpbnQ4KGV4dHJhRmllbGRWaWV3LCAwKTtcblx0Y29uc3QgdGltZVByb3BlcnRpZXMgPSBbXTtcblx0Y29uc3QgdGltZVJhd1Byb3BlcnRpZXMgPSBbXTtcblx0aWYgKGxvY2FsRGlyZWN0b3J5KSB7XG5cdFx0aWYgKChmbGFncyAmIDB4MSkgPT0gMHgxKSB7XG5cdFx0XHR0aW1lUHJvcGVydGllcy5wdXNoKFBST1BFUlRZX05BTUVfTEFTVF9NT0RJRklDQVRJT05fREFURSk7XG5cdFx0XHR0aW1lUmF3UHJvcGVydGllcy5wdXNoKFBST1BFUlRZX05BTUVfUkFXX0xBU1RfTU9ESUZJQ0FUSU9OX0RBVEUpO1xuXHRcdH1cblx0XHRpZiAoKGZsYWdzICYgMHgyKSA9PSAweDIpIHtcblx0XHRcdHRpbWVQcm9wZXJ0aWVzLnB1c2goUFJPUEVSVFlfTkFNRV9MQVNUX0FDQ0VTU19EQVRFKTtcblx0XHRcdHRpbWVSYXdQcm9wZXJ0aWVzLnB1c2goUFJPUEVSVFlfTkFNRV9SQVdfTEFTVF9BQ0NFU1NfREFURSk7XG5cdFx0fVxuXHRcdGlmICgoZmxhZ3MgJiAweDQpID09IDB4NCkge1xuXHRcdFx0dGltZVByb3BlcnRpZXMucHVzaChQUk9QRVJUWV9OQU1FX0NSRUFUSU9OX0RBVEUpO1xuXHRcdFx0dGltZVJhd1Byb3BlcnRpZXMucHVzaChQUk9QRVJUWV9OQU1FX1JBV19DUkVBVElPTl9EQVRFKTtcblx0XHR9XG5cdH0gZWxzZSBpZiAoZXh0cmFGaWVsZEV4dGVuZGVkVGltZXN0YW1wLmRhdGEubGVuZ3RoID49IDUpIHtcblx0XHR0aW1lUHJvcGVydGllcy5wdXNoKFBST1BFUlRZX05BTUVfTEFTVF9NT0RJRklDQVRJT05fREFURSk7XG5cdFx0dGltZVJhd1Byb3BlcnRpZXMucHVzaChQUk9QRVJUWV9OQU1FX1JBV19MQVNUX01PRElGSUNBVElPTl9EQVRFKTtcblx0fVxuXHRsZXQgb2Zmc2V0ID0gMTtcblx0dGltZVByb3BlcnRpZXMuZm9yRWFjaCgocHJvcGVydHlOYW1lLCBpbmRleFByb3BlcnR5KSA9PiB7XG5cdFx0aWYgKGV4dHJhRmllbGRFeHRlbmRlZFRpbWVzdGFtcC5kYXRhLmxlbmd0aCA+PSBvZmZzZXQgKyA0KSB7XG5cdFx0XHRjb25zdCB0aW1lID0gZ2V0VWludDMyKGV4dHJhRmllbGRWaWV3LCBvZmZzZXQpO1xuXHRcdFx0ZGlyZWN0b3J5W3Byb3BlcnR5TmFtZV0gPSBleHRyYUZpZWxkRXh0ZW5kZWRUaW1lc3RhbXBbcHJvcGVydHlOYW1lXSA9IG5ldyBEYXRlKHRpbWUgKiAxMDAwKTtcblx0XHRcdGNvbnN0IHJhd1Byb3BlcnR5TmFtZSA9IHRpbWVSYXdQcm9wZXJ0aWVzW2luZGV4UHJvcGVydHldO1xuXHRcdFx0ZXh0cmFGaWVsZEV4dGVuZGVkVGltZXN0YW1wW3Jhd1Byb3BlcnR5TmFtZV0gPSB0aW1lO1xuXHRcdH1cblx0XHRvZmZzZXQgKz0gNDtcblx0fSk7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHNlZWtTaWduYXR1cmUocmVhZGVyLCBzaWduYXR1cmUsIHN0YXJ0T2Zmc2V0LCBtaW5pbXVtQnl0ZXMsIG1heGltdW1MZW5ndGgpIHtcblx0Y29uc3Qgc2lnbmF0dXJlQXJyYXkgPSBuZXcgVWludDhBcnJheSg0KTtcblx0Y29uc3Qgc2lnbmF0dXJlVmlldyA9IGdldERhdGFWaWV3KHNpZ25hdHVyZUFycmF5KTtcblx0c2V0VWludDMyKHNpZ25hdHVyZVZpZXcsIDAsIHNpZ25hdHVyZSk7XG5cdGNvbnN0IG1heGltdW1CeXRlcyA9IG1pbmltdW1CeXRlcyArIG1heGltdW1MZW5ndGg7XG5cdHJldHVybiAoYXdhaXQgc2VlayhtaW5pbXVtQnl0ZXMpKSB8fCBhd2FpdCBzZWVrKE1hdGgubWluKG1heGltdW1CeXRlcywgc3RhcnRPZmZzZXQpKTtcblxuXHRhc3luYyBmdW5jdGlvbiBzZWVrKGxlbmd0aCkge1xuXHRcdGNvbnN0IG9mZnNldCA9IHN0YXJ0T2Zmc2V0IC0gbGVuZ3RoO1xuXHRcdGNvbnN0IGJ5dGVzID0gYXdhaXQgcmVhZFVpbnQ4QXJyYXkocmVhZGVyLCBvZmZzZXQsIGxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaW5kZXhCeXRlID0gYnl0ZXMubGVuZ3RoIC0gbWluaW11bUJ5dGVzOyBpbmRleEJ5dGUgPj0gMDsgaW5kZXhCeXRlLS0pIHtcblx0XHRcdGlmIChieXRlc1tpbmRleEJ5dGVdID09IHNpZ25hdHVyZUFycmF5WzBdICYmIGJ5dGVzW2luZGV4Qnl0ZSArIDFdID09IHNpZ25hdHVyZUFycmF5WzFdICYmXG5cdFx0XHRcdGJ5dGVzW2luZGV4Qnl0ZSArIDJdID09IHNpZ25hdHVyZUFycmF5WzJdICYmIGJ5dGVzW2luZGV4Qnl0ZSArIDNdID09IHNpZ25hdHVyZUFycmF5WzNdKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0b2Zmc2V0OiBvZmZzZXQgKyBpbmRleEJ5dGUsXG5cdFx0XHRcdFx0YnVmZmVyOiBieXRlcy5zbGljZShpbmRleEJ5dGUsIGluZGV4Qnl0ZSArIG1pbmltdW1CeXRlcykuYnVmZmVyXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGdldE9wdGlvblZhbHVlKHppcFJlYWRlciwgb3B0aW9ucywgbmFtZSkge1xuXHRyZXR1cm4gb3B0aW9uc1tuYW1lXSA9PT0gVU5ERUZJTkVEX1ZBTFVFID8gemlwUmVhZGVyLm9wdGlvbnNbbmFtZV0gOiBvcHRpb25zW25hbWVdO1xufVxuXG5mdW5jdGlvbiBnZXREYXRlKHRpbWVSYXcpIHtcblx0Y29uc3QgZGF0ZSA9ICh0aW1lUmF3ICYgMHhmZmZmMDAwMCkgPj4gMTYsIHRpbWUgPSB0aW1lUmF3ICYgMHgwMDAwZmZmZjtcblx0dHJ5IHtcblx0XHRyZXR1cm4gbmV3IERhdGUoMTk4MCArICgoZGF0ZSAmIDB4RkUwMCkgPj4gOSksICgoZGF0ZSAmIDB4MDFFMCkgPj4gNSkgLSAxLCBkYXRlICYgMHgwMDFGLCAodGltZSAmIDB4RjgwMCkgPj4gMTEsICh0aW1lICYgMHgwN0UwKSA+PiA1LCAodGltZSAmIDB4MDAxRikgKiAyLCAwKTtcblx0fSBjYXRjaCAoX2Vycm9yKSB7XG5cdFx0Ly8gaWdub3JlZFxuXHR9XG59XG5cbmZ1bmN0aW9uIGdldERhdGVOVEZTKHRpbWVSYXcpIHtcblx0cmV0dXJuIG5ldyBEYXRlKChOdW1iZXIoKHRpbWVSYXcgLyBCaWdJbnQoMTAwMDApKSAtIEJpZ0ludCgxMTY0NDQ3MzYwMDAwMCkpKSk7XG59XG5cbmZ1bmN0aW9uIGdldFVpbnQ4KHZpZXcsIG9mZnNldCkge1xuXHRyZXR1cm4gdmlldy5nZXRVaW50OChvZmZzZXQpO1xufVxuXG5mdW5jdGlvbiBnZXRVaW50MTYodmlldywgb2Zmc2V0KSB7XG5cdHJldHVybiB2aWV3LmdldFVpbnQxNihvZmZzZXQsIHRydWUpO1xufVxuXG5mdW5jdGlvbiBnZXRVaW50MzIodmlldywgb2Zmc2V0KSB7XG5cdHJldHVybiB2aWV3LmdldFVpbnQzMihvZmZzZXQsIHRydWUpO1xufVxuXG5mdW5jdGlvbiBnZXRCaWdVaW50NjQodmlldywgb2Zmc2V0KSB7XG5cdHJldHVybiBOdW1iZXIodmlldy5nZXRCaWdVaW50NjQob2Zmc2V0LCB0cnVlKSk7XG59XG5cbmZ1bmN0aW9uIHNldFVpbnQzMih2aWV3LCBvZmZzZXQsIHZhbHVlKSB7XG5cdHZpZXcuc2V0VWludDMyKG9mZnNldCwgdmFsdWUsIHRydWUpO1xufVxuXG5mdW5jdGlvbiBnZXREYXRhVmlldyhhcnJheSkge1xuXHRyZXR1cm4gbmV3IERhdGFWaWV3KGFycmF5LmJ1ZmZlcik7XG59IiwiLypcbiBDb3B5cmlnaHQgKGMpIDIwMjIgR2lsZGFzIExvcm1lYXUuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG5cbiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiBtb2RpZmljYXRpb24sIGFyZSBwZXJtaXR0ZWQgcHJvdmlkZWQgdGhhdCB0aGUgZm9sbG93aW5nIGNvbmRpdGlvbnMgYXJlIG1ldDpcblxuIDEuIFJlZGlzdHJpYnV0aW9ucyBvZiBzb3VyY2UgY29kZSBtdXN0IHJldGFpbiB0aGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSxcbiB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuXG4gMi4gUmVkaXN0cmlidXRpb25zIGluIGJpbmFyeSBmb3JtIG11c3QgcmVwcm9kdWNlIHRoZSBhYm92ZSBjb3B5cmlnaHQgXG4gbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyIGluIFxuIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWQgd2l0aCB0aGUgZGlzdHJpYnV0aW9uLlxuXG4gMy4gVGhlIG5hbWVzIG9mIHRoZSBhdXRob3JzIG1heSBub3QgYmUgdXNlZCB0byBlbmRvcnNlIG9yIHByb21vdGUgcHJvZHVjdHNcbiBkZXJpdmVkIGZyb20gdGhpcyBzb2Z0d2FyZSB3aXRob3V0IHNwZWNpZmljIHByaW9yIHdyaXR0ZW4gcGVybWlzc2lvbi5cblxuIFRISVMgU09GVFdBUkUgSVMgUFJPVklERUQgJydBUyBJUycnIEFORCBBTlkgRVhQUkVTU0VEIE9SIElNUExJRUQgV0FSUkFOVElFUyxcbiBJTkNMVURJTkcsIEJVVCBOT1QgTElNSVRFRCBUTywgVEhFIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EXG4gRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFIERJU0NMQUlNRUQuIElOIE5PIEVWRU5UIFNIQUxMIEpDUkFGVCxcbiBJTkMuIE9SIEFOWSBDT05UUklCVVRPUlMgVE8gVEhJUyBTT0ZUV0FSRSBCRSBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULFxuIElOQ0lERU5UQUwsIFNQRUNJQUwsIEVYRU1QTEFSWSwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIChJTkNMVURJTkcsIEJVVCBOT1RcbiBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRiBTVUJTVElUVVRFIEdPT0RTIE9SIFNFUlZJQ0VTOyBMT1NTIE9GIFVTRSwgREFUQSxcbiBPUiBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GXG4gTElBQklMSVRZLCBXSEVUSEVSIElOIENPTlRSQUNULCBTVFJJQ1QgTElBQklMSVRZLCBPUiBUT1JUIChJTkNMVURJTkdcbiBORUdMSUdFTkNFIE9SIE9USEVSV0lTRSkgQVJJU0lORyBJTiBBTlkgV0FZIE9VVCBPRiBUSEUgVVNFIE9GIFRISVMgU09GVFdBUkUsXG4gRVZFTiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqL1xuXG5pbXBvcnQgeyBJbmZsYXRlIH0gZnJvbSBcIi4vY29yZS9zdHJlYW1zL2NvZGVjcy9pbmZsYXRlLmpzXCI7XG5pbXBvcnQgeyBjb25maWd1cmUgfSBmcm9tIFwiLi9jb3JlL2NvbmZpZ3VyYXRpb24uanNcIjtcbmltcG9ydCB7IGdldE1pbWVUeXBlIH0gZnJvbSBcIi4vY29yZS91dGlsL2RlZmF1bHQtbWltZS10eXBlLmpzXCI7XG5pbXBvcnQgeyB0ZXJtaW5hdGVXb3JrZXJzIH0gZnJvbSBcIi4vY29yZS9jb2RlYy1wb29sLmpzXCI7XG5cbmNvbmZpZ3VyZSh7IEluZmxhdGUgfSk7XG5cbmV4cG9ydCAqIGZyb20gXCIuL2NvcmUvaW8uanNcIjtcbmV4cG9ydCAqIGZyb20gXCIuL2NvcmUvemlwLXJlYWRlci5qc1wiO1xuZXhwb3J0IHtcblx0Y29uZmlndXJlLFxuXHRnZXRNaW1lVHlwZSxcblx0dGVybWluYXRlV29ya2Vyc1xufTsiLCIvKipcbiAqIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG5pbXBvcnQgdHlwZSB6aXAgZnJvbSAnQHppcC5qcy96aXAuanMnO1xuLy8gQHRzLWlnbm9yZVxuaW1wb3J0ICogYXMgemlwSW1wb3J0IGZyb20gJ0B6aXAuanMvemlwLmpzL2xpYi96aXAtbm8td29ya2VyLWluZmxhdGUuanMnO1xuaW1wb3J0IHR5cGUgeyBUcmFjZU1vZGVsQmFja2VuZCB9IGZyb20gJy4vdHJhY2VNb2RlbCc7XG5cbmNvbnN0IHppcGpzID0gemlwSW1wb3J0IGFzIHR5cGVvZiB6aXA7XG5cbnR5cGUgUHJvZ3Jlc3MgPSAoZG9uZTogbnVtYmVyLCB0b3RhbDogbnVtYmVyKSA9PiB1bmRlZmluZWQ7XG5cbmV4cG9ydCBjbGFzcyBaaXBUcmFjZU1vZGVsQmFja2VuZCBpbXBsZW1lbnRzIFRyYWNlTW9kZWxCYWNrZW5kIHtcbiAgcHJpdmF0ZSBfemlwUmVhZGVyOiB6aXAuWmlwUmVhZGVyPHVua25vd24+O1xuICBwcml2YXRlIF9lbnRyaWVzUHJvbWlzZTogUHJvbWlzZTxNYXA8c3RyaW5nLCB6aXAuRW50cnk+PjtcbiAgcHJpdmF0ZSBfdHJhY2VVUkw6IHN0cmluZztcblxuICBjb25zdHJ1Y3Rvcih0cmFjZVVSTDogc3RyaW5nLCBzZXJ2ZXI6IFRyYWNlVmlld2VyU2VydmVyLCBwcm9ncmVzczogUHJvZ3Jlc3MpIHtcbiAgICB0aGlzLl90cmFjZVVSTCA9IHRyYWNlVVJMO1xuICAgIHppcGpzLmNvbmZpZ3VyZSh7IGJhc2VVUkw6IHNlbGYubG9jYXRpb24uaHJlZiB9IGFzIGFueSk7XG4gICAgdGhpcy5femlwUmVhZGVyID0gbmV3IHppcGpzLlppcFJlYWRlcihcbiAgICAgICAgbmV3IHppcGpzLkh0dHBSZWFkZXIoZm9ybWF0VXJsKHRyYWNlVVJMLCBzZXJ2ZXIpLCB7IG1vZGU6ICdjb3JzJywgcHJldmVudEhlYWRSZXF1ZXN0OiB0cnVlIH0gYXMgYW55KSxcbiAgICAgICAgeyB1c2VXZWJXb3JrZXJzOiBmYWxzZSB9KTtcbiAgICB0aGlzLl9lbnRyaWVzUHJvbWlzZSA9IHRoaXMuX3ppcFJlYWRlci5nZXRFbnRyaWVzKHsgb25wcm9ncmVzczogcHJvZ3Jlc3MgfSkudGhlbihlbnRyaWVzID0+IHtcbiAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCB6aXAuRW50cnk+KCk7XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGVudHJpZXMpXG4gICAgICAgIG1hcC5zZXQoZW50cnkuZmlsZW5hbWUsIGVudHJ5KTtcbiAgICAgIHJldHVybiBtYXA7XG4gICAgfSk7XG4gIH1cblxuICBpc0xpdmUoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdHJhY2VVUkwoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3RyYWNlVVJMO1xuICB9XG5cbiAgYXN5bmMgZW50cnlOYW1lcygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgY29uc3QgZW50cmllcyA9IGF3YWl0IHRoaXMuX2VudHJpZXNQcm9taXNlO1xuICAgIHJldHVybiBbLi4uZW50cmllcy5rZXlzKCldO1xuICB9XG5cbiAgYXN5bmMgaGFzRW50cnkoZW50cnlOYW1lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCBlbnRyaWVzID0gYXdhaXQgdGhpcy5fZW50cmllc1Byb21pc2U7XG4gICAgcmV0dXJuIGVudHJpZXMuaGFzKGVudHJ5TmFtZSk7XG4gIH1cblxuICBhc3luYyByZWFkVGV4dChlbnRyeU5hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG4gICAgY29uc3QgZW50cmllcyA9IGF3YWl0IHRoaXMuX2VudHJpZXNQcm9taXNlO1xuICAgIGNvbnN0IGVudHJ5ID0gZW50cmllcy5nZXQoZW50cnlOYW1lKTtcbiAgICBpZiAoIWVudHJ5KVxuICAgICAgcmV0dXJuO1xuICAgIGNvbnN0IHdyaXRlciA9IG5ldyB6aXBqcy5UZXh0V3JpdGVyKCk7XG4gICAgYXdhaXQgZW50cnkuZ2V0RGF0YT8uKHdyaXRlcik7XG4gICAgcmV0dXJuIHdyaXRlci5nZXREYXRhKCk7XG4gIH1cblxuICBhc3luYyByZWFkQmxvYihlbnRyeU5hbWU6IHN0cmluZyk6IFByb21pc2U8QmxvYiB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCB0aGlzLl9lbnRyaWVzUHJvbWlzZTtcbiAgICBjb25zdCBlbnRyeSA9IGVudHJpZXMuZ2V0KGVudHJ5TmFtZSk7XG4gICAgaWYgKCFlbnRyeSlcbiAgICAgIHJldHVybjtcbiAgICBjb25zdCB3cml0ZXIgPSBuZXcgemlwanMuQmxvYldyaXRlcigpIGFzIHppcC5CbG9iV3JpdGVyO1xuICAgIGF3YWl0IGVudHJ5LmdldERhdGEhKHdyaXRlcik7XG4gICAgcmV0dXJuIHdyaXRlci5nZXREYXRhKCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZldGNoVHJhY2VNb2RlbEJhY2tlbmQgaW1wbGVtZW50cyBUcmFjZU1vZGVsQmFja2VuZCB7XG4gIHByaXZhdGUgX2VudHJpZXNQcm9taXNlOiBQcm9taXNlPE1hcDxzdHJpbmcsIHN0cmluZz4+O1xuICBwcml2YXRlIF9wYXRoOiBzdHJpbmc7XG4gIHByaXZhdGUgX3NlcnZlcjogVHJhY2VWaWV3ZXJTZXJ2ZXI7XG5cbiAgY29uc3RydWN0b3IocGF0aDogc3RyaW5nLCBzZXJ2ZXI6IFRyYWNlVmlld2VyU2VydmVyKSB7XG4gICAgdGhpcy5fcGF0aCAgPSBwYXRoO1xuICAgIHRoaXMuX3NlcnZlciA9IHNlcnZlcjtcbiAgICB0aGlzLl9lbnRyaWVzUHJvbWlzZSA9IHNlcnZlci5yZWFkRmlsZShwYXRoKS50aGVuKGFzeW5jIHJlc3BvbnNlID0+IHtcbiAgICAgIGlmICghcmVzcG9uc2UpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRmlsZSBub3QgZm91bmQnKTtcbiAgICAgIGNvbnN0IGpzb24gPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG4gICAgICBjb25zdCBlbnRyaWVzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICAgIGZvciAoY29uc3QgZW50cnkgb2YganNvbi5lbnRyaWVzKVxuICAgICAgICBlbnRyaWVzLnNldChlbnRyeS5uYW1lLCBlbnRyeS5wYXRoKTtcbiAgICAgIHJldHVybiBlbnRyaWVzO1xuICAgIH0pO1xuICB9XG5cbiAgaXNMaXZlKCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdHJhY2VVUkwoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fcGF0aDtcbiAgfVxuXG4gIGFzeW5jIGVudHJ5TmFtZXMoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCB0aGlzLl9lbnRyaWVzUHJvbWlzZTtcbiAgICByZXR1cm4gWy4uLmVudHJpZXMua2V5cygpXTtcbiAgfVxuXG4gIGFzeW5jIGhhc0VudHJ5KGVudHJ5TmFtZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgY29uc3QgZW50cmllcyA9IGF3YWl0IHRoaXMuX2VudHJpZXNQcm9taXNlO1xuICAgIHJldHVybiBlbnRyaWVzLmhhcyhlbnRyeU5hbWUpO1xuICB9XG5cbiAgYXN5bmMgcmVhZFRleHQoZW50cnlOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5fcmVhZEVudHJ5KGVudHJ5TmFtZSk7XG4gICAgcmV0dXJuIHJlc3BvbnNlPy50ZXh0KCk7XG4gIH1cblxuICBhc3luYyByZWFkQmxvYihlbnRyeU5hbWU6IHN0cmluZyk6IFByb21pc2U8QmxvYiB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5fcmVhZEVudHJ5KGVudHJ5TmFtZSk7XG4gICAgcmV0dXJuIHJlc3BvbnNlPy5zdGF0dXMgPT09IDIwMCA/IGF3YWl0IHJlc3BvbnNlPy5ibG9iKCkgOiB1bmRlZmluZWQ7XG4gIH1cblxuICBwcml2YXRlIGFzeW5jIF9yZWFkRW50cnkoZW50cnlOYW1lOiBzdHJpbmcpOiBQcm9taXNlPFJlc3BvbnNlIHwgdW5kZWZpbmVkPiB7XG4gICAgY29uc3QgZW50cmllcyA9IGF3YWl0IHRoaXMuX2VudHJpZXNQcm9taXNlO1xuICAgIGNvbnN0IGZpbGVOYW1lID0gZW50cmllcy5nZXQoZW50cnlOYW1lKTtcbiAgICBpZiAoIWZpbGVOYW1lKVxuICAgICAgcmV0dXJuO1xuICAgIHJldHVybiB0aGlzLl9zZXJ2ZXIucmVhZEZpbGUoZmlsZU5hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFVybCh0cmFjZTogc3RyaW5nLCBzZXJ2ZXI6IFRyYWNlVmlld2VyU2VydmVyKSB7XG4gIGxldCB1cmwgPSB0cmFjZS5zdGFydHNXaXRoKCdodHRwJykgfHwgdHJhY2Uuc3RhcnRzV2l0aCgnYmxvYicpID8gdHJhY2UgOiBzZXJ2ZXIuZ2V0RmlsZVVSTCh0cmFjZSkudG9TdHJpbmcoKTtcbiAgLy8gRHJvcGJveCBkb2VzIG5vdCBzdXBwb3J0IGNvcnMuXG4gIGlmICh1cmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly93d3cuZHJvcGJveC5jb20vJykpXG4gICAgdXJsID0gJ2h0dHBzOi8vZGwuZHJvcGJveHVzZXJjb250ZW50LmNvbS8nICsgdXJsLnN1YnN0cmluZygnaHR0cHM6Ly93d3cuZHJvcGJveC5jb20vJy5sZW5ndGgpO1xuICByZXR1cm4gdXJsO1xufVxuXG5leHBvcnQgY2xhc3MgVHJhY2VWaWV3ZXJTZXJ2ZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGJhc2VVcmw6IHN0cmluZykge31cblxuICBnZXRGaWxlVVJMKHBhdGg6IHN0cmluZyk6IFVSTCB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTCgndHJhY2UvZmlsZScsIHRoaXMuYmFzZVVybCk7XG4gICAgdXJsLnNlYXJjaFBhcmFtcy5zZXQoJ3BhdGgnLCBwYXRoKTtcbiAgICByZXR1cm4gdXJsO1xuICB9XG5cbiAgYXN5bmMgcmVhZEZpbGUocGF0aDogc3RyaW5nKTogUHJvbWlzZTxSZXNwb25zZSB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godGhpcy5nZXRGaWxlVVJMKHBhdGgpKTtcbiAgICBpZiAocmVzcG9uc2Uuc3RhdHVzID09PSA0MDQpXG4gICAgICByZXR1cm47XG4gICAgcmV0dXJuIHJlc3BvbnNlO1xuICB9XG59IiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0IHsgc3BsaXRQcm9ncmVzcyB9IGZyb20gJy4vcHJvZ3Jlc3MnO1xuaW1wb3J0IHsgdW53cmFwUG9wb3V0VXJsIH0gZnJvbSAnLi9zbmFwc2hvdFJlbmRlcmVyJztcbmltcG9ydCB7IFNuYXBzaG90U2VydmVyIH0gZnJvbSAnLi9zbmFwc2hvdFNlcnZlcic7XG5pbXBvcnQgeyBUcmFjZU1vZGVsIH0gZnJvbSAnLi90cmFjZU1vZGVsJztcbmltcG9ydCB7IEZldGNoVHJhY2VNb2RlbEJhY2tlbmQsIFRyYWNlVmlld2VyU2VydmVyLCBaaXBUcmFjZU1vZGVsQmFja2VuZCB9IGZyb20gJy4vdHJhY2VNb2RlbEJhY2tlbmRzJztcbmltcG9ydCB7IFRyYWNlVmVyc2lvbkVycm9yIH0gZnJvbSAnLi90cmFjZU1vZGVybml6ZXInO1xuXG4vLyBAdHMtaWdub3JlXG5kZWNsYXJlIGNvbnN0IHNlbGY6IFNlcnZpY2VXb3JrZXJHbG9iYWxTY29wZTtcblxuc2VsZi5hZGRFdmVudExpc3RlbmVyKCdpbnN0YWxsJywgZnVuY3Rpb24oZXZlbnQ6IGFueSkge1xuICBzZWxmLnNraXBXYWl0aW5nKCk7XG59KTtcblxuc2VsZi5hZGRFdmVudExpc3RlbmVyKCdhY3RpdmF0ZScsIGZ1bmN0aW9uKGV2ZW50OiBhbnkpIHtcbiAgZXZlbnQud2FpdFVudGlsKHNlbGYuY2xpZW50cy5jbGFpbSgpKTtcbn0pO1xuXG5jb25zdCBzY29wZVBhdGggPSBuZXcgVVJMKHNlbGYucmVnaXN0cmF0aW9uLnNjb3BlKS5wYXRobmFtZTtcblxuY29uc3QgbG9hZGVkVHJhY2VzID0gbmV3IE1hcDxzdHJpbmcsIHsgdHJhY2VNb2RlbDogVHJhY2VNb2RlbCwgc25hcHNob3RTZXJ2ZXI6IFNuYXBzaG90U2VydmVyIH0+KCk7XG5cbmNvbnN0IGNsaWVudElkVG9UcmFjZVVybHMgPSBuZXcgTWFwPHN0cmluZywgeyBsaW1pdDogbnVtYmVyIHwgdW5kZWZpbmVkLCB0cmFjZVVybHM6IFNldDxzdHJpbmc+LCB0cmFjZVZpZXdlclNlcnZlcjogVHJhY2VWaWV3ZXJTZXJ2ZXIgfT4oKTtcblxuYXN5bmMgZnVuY3Rpb24gbG9hZFRyYWNlKHRyYWNlVXJsOiBzdHJpbmcsIHRyYWNlRmlsZU5hbWU6IHN0cmluZyB8IG51bGwsIGNsaWVudDogYW55IHwgdW5kZWZpbmVkLCBsaW1pdDogbnVtYmVyIHwgdW5kZWZpbmVkLCBwcm9ncmVzczogKGRvbmU6IG51bWJlciwgdG90YWw6IG51bWJlcikgPT4gdW5kZWZpbmVkKTogUHJvbWlzZTxUcmFjZU1vZGVsPiB7XG4gIGF3YWl0IGdjKCk7XG4gIGNvbnN0IGNsaWVudElkID0gY2xpZW50Py5pZCA/PyAnJztcbiAgbGV0IGRhdGEgPSBjbGllbnRJZFRvVHJhY2VVcmxzLmdldChjbGllbnRJZCk7XG4gIGlmICghZGF0YSkge1xuICAgIGxldCB0cmFjZVZpZXdlclNlcnZlckJhc2VVcmwgPSBzZWxmLnJlZ2lzdHJhdGlvbi5zY29wZTtcbiAgICBpZiAoY2xpZW50Py51cmwpIHtcbiAgICAgIGNvbnN0IGNsaWVudFVybCA9IG5ldyBVUkwoY2xpZW50LnVybCk7XG4gICAgICBpZiAoY2xpZW50VXJsLnNlYXJjaFBhcmFtcy5oYXMoJ3NlcnZlcicpKVxuICAgICAgICB0cmFjZVZpZXdlclNlcnZlckJhc2VVcmwgPSBjbGllbnRVcmwuc2VhcmNoUGFyYW1zLmdldCgnc2VydmVyJykhO1xuICAgIH1cblxuICAgIGRhdGEgPSB7IGxpbWl0LCB0cmFjZVVybHM6IG5ldyBTZXQoKSwgdHJhY2VWaWV3ZXJTZXJ2ZXI6IG5ldyBUcmFjZVZpZXdlclNlcnZlcih0cmFjZVZpZXdlclNlcnZlckJhc2VVcmwpIH07XG4gICAgY2xpZW50SWRUb1RyYWNlVXJscy5zZXQoY2xpZW50SWQsIGRhdGEpO1xuICB9XG4gIGRhdGEudHJhY2VVcmxzLmFkZCh0cmFjZVVybCk7XG5cbiAgY29uc3QgdHJhY2VNb2RlbCA9IG5ldyBUcmFjZU1vZGVsKCk7XG4gIHRyeSB7XG4gICAgLy8gQWxsb3cgMTAlIHRvIGhvcCBmcm9tIHN3IHRvIHBhZ2UuXG4gICAgY29uc3QgW2ZldGNoUHJvZ3Jlc3MsIHVuemlwUHJvZ3Jlc3NdID0gc3BsaXRQcm9ncmVzcyhwcm9ncmVzcywgWzAuNSwgMC40LCAwLjFdKTtcbiAgICBjb25zdCBiYWNrZW5kID0gdHJhY2VVcmwuZW5kc1dpdGgoJ2pzb24nKSA/IG5ldyBGZXRjaFRyYWNlTW9kZWxCYWNrZW5kKHRyYWNlVXJsLCBkYXRhLnRyYWNlVmlld2VyU2VydmVyKSA6IG5ldyBaaXBUcmFjZU1vZGVsQmFja2VuZCh0cmFjZVVybCwgZGF0YS50cmFjZVZpZXdlclNlcnZlciwgZmV0Y2hQcm9ncmVzcyk7XG4gICAgYXdhaXQgdHJhY2VNb2RlbC5sb2FkKGJhY2tlbmQsIHVuemlwUHJvZ3Jlc3MpO1xuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICBpZiAoZXJyb3I/Lm1lc3NhZ2U/LmluY2x1ZGVzKCdDYW5ub3QgZmluZCAudHJhY2UgZmlsZScpICYmIGF3YWl0IHRyYWNlTW9kZWwuaGFzRW50cnkoJ2luZGV4Lmh0bWwnKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGxvYWQgdHJhY2UuIERpZCB5b3UgdXBsb2FkIGEgUGxheXdyaWdodCBIVE1MIHJlcG9ydCBpbnN0ZWFkPyBNYWtlIHN1cmUgdG8gZXh0cmFjdCB0aGUgYXJjaGl2ZSBmaXJzdCBhbmQgdGhlbiBkb3VibGUtY2xpY2sgdGhlIGluZGV4Lmh0bWwgZmlsZSBvciBwdXQgaXQgb24gYSB3ZWIgc2VydmVyLicpO1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIFRyYWNlVmVyc2lvbkVycm9yKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgbG9hZCB0cmFjZSBmcm9tICR7dHJhY2VGaWxlTmFtZSB8fCB0cmFjZVVybH0uICR7ZXJyb3IubWVzc2FnZX1gKTtcbiAgICBpZiAodHJhY2VGaWxlTmFtZSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGxvYWQgdHJhY2UgZnJvbSAke3RyYWNlRmlsZU5hbWV9LiBNYWtlIHN1cmUgdG8gdXBsb2FkIGEgdmFsaWQgUGxheXdyaWdodCB0cmFjZS5gKTtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBsb2FkIHRyYWNlIGZyb20gJHt0cmFjZVVybH0uIE1ha2Ugc3VyZSBhIHZhbGlkIFBsYXl3cmlnaHQgVHJhY2UgaXMgYWNjZXNzaWJsZSBvdmVyIHRoaXMgdXJsLmApO1xuICB9XG4gIGNvbnN0IHNuYXBzaG90U2VydmVyID0gbmV3IFNuYXBzaG90U2VydmVyKHRyYWNlTW9kZWwuc3RvcmFnZSgpLCBzaGExID0+IHRyYWNlTW9kZWwucmVzb3VyY2VGb3JTaGExKHNoYTEpKTtcbiAgbG9hZGVkVHJhY2VzLnNldCh0cmFjZVVybCwgeyB0cmFjZU1vZGVsLCBzbmFwc2hvdFNlcnZlciB9KTtcbiAgcmV0dXJuIHRyYWNlTW9kZWw7XG59XG5cbi8vIEB0cy1pZ25vcmVcbmFzeW5jIGZ1bmN0aW9uIGRvRmV0Y2goZXZlbnQ6IEZldGNoRXZlbnQpOiBQcm9taXNlPFJlc3BvbnNlPiB7XG4gIC8vIEluIG9yZGVyIHRvIG1ha2UgQWNjZXNzaWJpbGl0eSBJbnNpZ2h0cyBmb3IgV2ViIHdvcmsuXG4gIGlmIChldmVudC5yZXF1ZXN0LnVybC5zdGFydHNXaXRoKCdjaHJvbWUtZXh0ZW5zaW9uOi8vJykpXG4gICAgcmV0dXJuIGZldGNoKGV2ZW50LnJlcXVlc3QpO1xuXG4gIGNvbnN0IHJlcXVlc3QgPSBldmVudC5yZXF1ZXN0O1xuICBjb25zdCBjbGllbnQgPSBhd2FpdCBzZWxmLmNsaWVudHMuZ2V0KGV2ZW50LmNsaWVudElkKTtcblxuICAvLyBXaGVuIHRyYWNlIHZpZXdlciBpcyBkZXBsb3llZCBvdmVyIGh0dHBzLCB3ZSB3aWxsIGZvcmNlIHVwZ3JhZGVcbiAgLy8gaW5zZWN1cmUgaHR0cCBzdWJyZXNvdXJjZXMgdG8gaHR0cHMuIE90aGVyd2lzZSwgdGhlc2Ugd2lsbCBmYWlsXG4gIC8vIHRvIGxvYWQgaW5zaWRlIG91ciBodHRwcyBzbmFwc2hvdHMuXG4gIC8vIEluIHRoaXMgY2FzZSwgd2UgYWxzbyBtYXRjaCBodHRwIHJlc291cmNlcyBmcm9tIHRoZSBhcmNoaXZlIGJ5XG4gIC8vIHRoZSBodHRwcyB1cmxzLlxuICBjb25zdCBpc0RlcGxveWVkQXNIdHRwcyA9IHNlbGYucmVnaXN0cmF0aW9uLnNjb3BlLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJyk7XG5cbiAgaWYgKHJlcXVlc3QudXJsLnN0YXJ0c1dpdGgoc2VsZi5yZWdpc3RyYXRpb24uc2NvcGUpKSB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTCh1bndyYXBQb3BvdXRVcmwocmVxdWVzdC51cmwpKTtcbiAgICBjb25zdCByZWxhdGl2ZVBhdGggPSB1cmwucGF0aG5hbWUuc3Vic3RyaW5nKHNjb3BlUGF0aC5sZW5ndGggLSAxKTtcbiAgICBpZiAocmVsYXRpdmVQYXRoID09PSAnL3BpbmcnKSB7XG4gICAgICBhd2FpdCBnYygpO1xuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShudWxsLCB7IHN0YXR1czogMjAwIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHRyYWNlVXJsID0gdXJsLnNlYXJjaFBhcmFtcy5nZXQoJ3RyYWNlJyk7XG5cbiAgICBpZiAocmVsYXRpdmVQYXRoID09PSAnL2NvbnRleHRzJykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgbGltaXQgPSB1cmwuc2VhcmNoUGFyYW1zLmhhcygnbGltaXQnKSA/ICt1cmwuc2VhcmNoUGFyYW1zLmdldCgnbGltaXQnKSEgOiB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IHRyYWNlTW9kZWwgPSBhd2FpdCBsb2FkVHJhY2UodHJhY2VVcmwhLCB1cmwuc2VhcmNoUGFyYW1zLmdldCgndHJhY2VGaWxlTmFtZScpLCBjbGllbnQsIGxpbWl0LCAoZG9uZTogbnVtYmVyLCB0b3RhbDogbnVtYmVyKSA9PiB7XG4gICAgICAgICAgY2xpZW50LnBvc3RNZXNzYWdlKHsgbWV0aG9kOiAncHJvZ3Jlc3MnLCBwYXJhbXM6IHsgZG9uZSwgdG90YWwgfSB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkodHJhY2VNb2RlbCEuY29udGV4dEVudHJpZXMpLCB7XG4gICAgICAgICAgc3RhdHVzOiAyMDAsXG4gICAgICAgICAgaGVhZGVyczogeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH1cbiAgICAgICAgfSk7XG4gICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogZXJyb3I/Lm1lc3NhZ2UgfSksIHtcbiAgICAgICAgICBzdGF0dXM6IDUwMCxcbiAgICAgICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocmVsYXRpdmVQYXRoLnN0YXJ0c1dpdGgoJy9zbmFwc2hvdEluZm8vJykpIHtcbiAgICAgIGNvbnN0IHsgc25hcHNob3RTZXJ2ZXIgfSA9IGxvYWRlZFRyYWNlcy5nZXQodHJhY2VVcmwhKSB8fCB7fTtcbiAgICAgIGlmICghc25hcHNob3RTZXJ2ZXIpXG4gICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UobnVsbCwgeyBzdGF0dXM6IDQwNCB9KTtcbiAgICAgIHJldHVybiBzbmFwc2hvdFNlcnZlci5zZXJ2ZVNuYXBzaG90SW5mbyhyZWxhdGl2ZVBhdGgsIHVybC5zZWFyY2hQYXJhbXMpO1xuICAgIH1cblxuICAgIGlmIChyZWxhdGl2ZVBhdGguc3RhcnRzV2l0aCgnL3NuYXBzaG90LycpKSB7XG4gICAgICBjb25zdCB7IHNuYXBzaG90U2VydmVyIH0gPSBsb2FkZWRUcmFjZXMuZ2V0KHRyYWNlVXJsISkgfHwge307XG4gICAgICBpZiAoIXNuYXBzaG90U2VydmVyKVxuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHsgc3RhdHVzOiA0MDQgfSk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IHNuYXBzaG90U2VydmVyLnNlcnZlU25hcHNob3QocmVsYXRpdmVQYXRoLCB1cmwuc2VhcmNoUGFyYW1zLCB1cmwuaHJlZik7XG4gICAgICBpZiAoaXNEZXBsb3llZEFzSHR0cHMpXG4gICAgICAgIHJlc3BvbnNlLmhlYWRlcnMuc2V0KCdDb250ZW50LVNlY3VyaXR5LVBvbGljeScsICd1cGdyYWRlLWluc2VjdXJlLXJlcXVlc3RzJyk7XG4gICAgICByZXR1cm4gcmVzcG9uc2U7XG4gICAgfVxuXG4gICAgaWYgKHJlbGF0aXZlUGF0aC5zdGFydHNXaXRoKCcvY2xvc2VzdC1zY3JlZW5zaG90LycpKSB7XG4gICAgICBjb25zdCB7IHNuYXBzaG90U2VydmVyIH0gPSBsb2FkZWRUcmFjZXMuZ2V0KHRyYWNlVXJsISkgfHwge307XG4gICAgICBpZiAoIXNuYXBzaG90U2VydmVyKVxuICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHsgc3RhdHVzOiA0MDQgfSk7XG4gICAgICByZXR1cm4gc25hcHNob3RTZXJ2ZXIuc2VydmVDbG9zZXN0U2NyZWVuc2hvdChyZWxhdGl2ZVBhdGgsIHVybC5zZWFyY2hQYXJhbXMpO1xuICAgIH1cblxuICAgIGlmIChyZWxhdGl2ZVBhdGguc3RhcnRzV2l0aCgnL3NoYTEvJykpIHtcbiAgICAgIC8vIFNoYTEgZm9yIHNvdXJjZXMgaXMgYmFzZWQgb24gdGhlIGZpbGUgcGF0aCwgY2FuJ3QgbG9hZCBpdCBvZiBhIHJhbmRvbSBtb2RlbC5cbiAgICAgIGNvbnN0IHNoYTEgPSByZWxhdGl2ZVBhdGguc2xpY2UoJy9zaGExLycubGVuZ3RoKTtcbiAgICAgIGZvciAoY29uc3QgdHJhY2Ugb2YgbG9hZGVkVHJhY2VzLnZhbHVlcygpKSB7XG4gICAgICAgIGNvbnN0IGJsb2IgPSBhd2FpdCB0cmFjZS50cmFjZU1vZGVsLnJlc291cmNlRm9yU2hhMShzaGExKTtcbiAgICAgICAgaWYgKGJsb2IpXG4gICAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShibG9iLCB7IHN0YXR1czogMjAwLCBoZWFkZXJzOiBkb3dubG9hZEhlYWRlcnModXJsLnNlYXJjaFBhcmFtcykgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKG51bGwsIHsgc3RhdHVzOiA0MDQgfSk7XG4gICAgfVxuXG4gICAgaWYgKHJlbGF0aXZlUGF0aC5zdGFydHNXaXRoKCcvZmlsZS8nKSkge1xuICAgICAgY29uc3QgcGF0aCA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdwYXRoJykhO1xuICAgICAgY29uc3QgdHJhY2VWaWV3ZXJTZXJ2ZXIgPSBjbGllbnRJZFRvVHJhY2VVcmxzLmdldChldmVudC5jbGllbnRJZCA/PyAnJyk/LnRyYWNlVmlld2VyU2VydmVyO1xuICAgICAgaWYgKCF0cmFjZVZpZXdlclNlcnZlcilcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdjbGllbnQgaXMgbm90IGluaXRpYWxpemVkJyk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRyYWNlVmlld2VyU2VydmVyLnJlYWRGaWxlKHBhdGgpO1xuICAgICAgaWYgKCFyZXNwb25zZSlcbiAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShudWxsLCB7IHN0YXR1czogNDA0IH0pO1xuICAgICAgcmV0dXJuIHJlc3BvbnNlO1xuICAgIH1cblxuICAgIC8vIEZhbGxiYWNrIGZvciBzdGF0aWMgYXNzZXRzLlxuICAgIHJldHVybiBmZXRjaChldmVudC5yZXF1ZXN0KTtcbiAgfVxuXG4gIGNvbnN0IHNuYXBzaG90VXJsID0gdW53cmFwUG9wb3V0VXJsKGNsaWVudCEudXJsKTtcbiAgY29uc3QgdHJhY2VVcmwgPSBuZXcgVVJMKHNuYXBzaG90VXJsKS5zZWFyY2hQYXJhbXMuZ2V0KCd0cmFjZScpITtcbiAgY29uc3QgeyBzbmFwc2hvdFNlcnZlciB9ID0gbG9hZGVkVHJhY2VzLmdldCh0cmFjZVVybCkgfHwge307XG4gIGlmICghc25hcHNob3RTZXJ2ZXIpXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShudWxsLCB7IHN0YXR1czogNDA0IH0pO1xuXG4gIGNvbnN0IGxvb2t1cFVybHMgPSBbcmVxdWVzdC51cmxdO1xuICBpZiAoaXNEZXBsb3llZEFzSHR0cHMgJiYgcmVxdWVzdC51cmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSlcbiAgICBsb29rdXBVcmxzLnB1c2gocmVxdWVzdC51cmwucmVwbGFjZSgvXmh0dHBzLywgJ2h0dHAnKSk7XG4gIHJldHVybiBzbmFwc2hvdFNlcnZlci5zZXJ2ZVJlc291cmNlKGxvb2t1cFVybHMsIHJlcXVlc3QubWV0aG9kLCBzbmFwc2hvdFVybCk7XG59XG5cbmZ1bmN0aW9uIGRvd25sb2FkSGVhZGVycyhzZWFyY2hQYXJhbXM6IFVSTFNlYXJjaFBhcmFtcyk6IEhlYWRlcnMgfCB1bmRlZmluZWQge1xuICBjb25zdCBuYW1lID0gc2VhcmNoUGFyYW1zLmdldCgnZG4nKTtcbiAgY29uc3QgY29udGVudFR5cGUgPSBzZWFyY2hQYXJhbXMuZ2V0KCdkY3QnKTtcbiAgaWYgKCFuYW1lKVxuICAgIHJldHVybjtcbiAgY29uc3QgaGVhZGVycyA9IG5ldyBIZWFkZXJzKCk7XG4gIGhlYWRlcnMuc2V0KCdDb250ZW50LURpc3Bvc2l0aW9uJywgYGF0dGFjaG1lbnQ7IGZpbGVuYW1lPVwiYXR0YWNobWVudFwiOyBmaWxlbmFtZSo9VVRGLTgnJyR7ZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpfWApO1xuICBpZiAoY29udGVudFR5cGUpXG4gICAgaGVhZGVycy5zZXQoJ0NvbnRlbnQtVHlwZScsIGNvbnRlbnRUeXBlKTtcbiAgcmV0dXJuIGhlYWRlcnM7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdjKCkge1xuICBjb25zdCBjbGllbnRzID0gYXdhaXQgc2VsZi5jbGllbnRzLm1hdGNoQWxsKCk7XG4gIGNvbnN0IHVzZWRUcmFjZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuICBmb3IgKGNvbnN0IFtjbGllbnRJZCwgZGF0YV0gb2YgY2xpZW50SWRUb1RyYWNlVXJscykge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBpZiAoIWNsaWVudHMuZmluZChjID0+IGMuaWQgPT09IGNsaWVudElkKSkge1xuICAgICAgY2xpZW50SWRUb1RyYWNlVXJscy5kZWxldGUoY2xpZW50SWQpO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChkYXRhLmxpbWl0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbnN0IG9yZGVyZWQgPSBbLi4uZGF0YS50cmFjZVVybHNdO1xuICAgICAgLy8gTGVhdmUgdGhlIG5ld2VzdCByZXF1ZXN0ZWQgdHJhY2VzLlxuICAgICAgZGF0YS50cmFjZVVybHMgPSBuZXcgU2V0KG9yZGVyZWQuc2xpY2Uob3JkZXJlZC5sZW5ndGggLSBkYXRhLmxpbWl0KSk7XG4gICAgfVxuICAgIGRhdGEudHJhY2VVcmxzLmZvckVhY2godXJsID0+IHVzZWRUcmFjZXMuYWRkKHVybCkpO1xuICB9XG5cbiAgZm9yIChjb25zdCB0cmFjZVVybCBvZiBsb2FkZWRUcmFjZXMua2V5cygpKSB7XG4gICAgaWYgKCF1c2VkVHJhY2VzLmhhcyh0cmFjZVVybCkpXG4gICAgICBsb2FkZWRUcmFjZXMuZGVsZXRlKHRyYWNlVXJsKTtcbiAgfVxufVxuXG4vLyBAdHMtaWdub3JlXG5zZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ2ZldGNoJywgZnVuY3Rpb24oZXZlbnQ6IEZldGNoRXZlbnQpIHtcbiAgZXZlbnQucmVzcG9uZFdpdGgoZG9GZXRjaChldmVudCkpO1xufSk7XG4iXSwibmFtZXMiOlsiaHRtbCIsInVud3JhcFBvcG91dFVybCIsInRhcmdldElkcyIsImNvbnRleHQiLCJyZXN1bHQiLCJobiIsInYiLCJjIiwibW9kZSIsInRhYmxlIiwieiIsIlVOREVGSU5FRF9UWVBFIiwiRlVOQ1RJT05fVFlQRSIsImNvZGVjIiwiY29uZmlnIiwibWF4V29ya2VycyIsIkluZmxhdGUiLCJDb21wcmVzc2lvblN0cmVhbSIsIkRlY29tcHJlc3Npb25TdHJlYW0iLCJoYXNoIiwicGFzc3dvcmQiLCJzaWduZWQiLCJkZWNyeXB0IiwiY3JlYXRlS2V5cyIsImVuY3J5cHQiLCJjb2RlY0J5dGVzIiwiQ29kZWNTdHJlYW0iLCJTdHJlYW0iLCJydW5Xb3JrZXIiLCJ2YWx1ZSIsImVycm9yIiwid29ya2VyRGF0YSIsInN0cmVhbSIsIndvcmtlck9wdGlvbnMiLCJnZXRSZXF1ZXN0RGF0YSIsImhlYWRlcnMiLCJlbmRPZkRpcmVjdG9yeVZpZXciLCJjb21tZW50T2Zmc2V0IiwiY29tbWVudExlbmd0aCIsIm9wdGlvbnMiLCJ0cmFjZVVybCIsInNuYXBzaG90U2VydmVyIl0sIm1hcHBpbmdzIjoiOzs7QUFrQmdCLFNBQUEsY0FBYyxVQUFvQixTQUErQjtBQUMvRSxRQUFNLFdBQVcsSUFBSSxNQUFNLFFBQVEsTUFBTSxFQUFFLEtBQUssQ0FBQztBQUMxQyxTQUFBLElBQUksTUFBTSxRQUFRLE1BQU0sRUFBRSxLQUFLLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxNQUFNO0FBQzlDLFdBQUEsQ0FBQyxNQUFjLFVBQWtCO0FBQ3RDLGVBQVMsQ0FBQyxJQUFJLE9BQU8sUUFBUSxRQUFRLENBQUMsSUFBSTtBQUNqQyxlQUFB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QUFDbkIsTUFBTSxXQUFXO0FBR2pCLE1BQU0sV0FBVztBQUNqQixNQUFNLFdBQVc7QUFFakIsTUFBTSxXQUFXO0FBQUEsRUFBQztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFDeEo7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQ2hKO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUNoSjtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFDOUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFDOUk7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQzlJO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQy9JO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUMvSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFDako7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFDL0k7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQzdJO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUMvSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFDN0k7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQ2hKO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUMvSTtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFDL0k7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQy9JO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUM5STtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUM5STtBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFDL0k7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQ2hKO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUNqSjtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFDako7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQ2hKO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUNqSjtBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFDako7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQy9JO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQ2pKO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFDako7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQ2pKO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUNqSjtBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFDako7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQ2pKO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUNoSjtBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFDaEo7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQ2hKO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUc7QUFDOUcsTUFBTSxXQUFXO0FBQUEsRUFBQztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBTTtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBTTtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBTztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSztBQUFBLEVBQUk7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUNwSjtBQUFBLEVBQU07QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQU07QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBRztBQUFBLEVBQU87QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUs7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQU07QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQU07QUFBQSxFQUFJO0FBQUEsRUFBRztBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFDNUk7QUFBQSxFQUFPO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFPO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFNO0FBQUEsRUFBSTtBQUFBLEVBQUc7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBSztBQUd4RyxNQUFNLFNBQVM7QUFBQTtBQUFBLEVBQ2Q7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUk7QUFBQSxFQUFJO0FBQUEsRUFBSTtBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUs7QUFBQSxFQUFLO0FBQUEsRUFBSztBQUFBLEVBQUc7QUFBQztBQUd4SCxNQUFNLFNBQVM7QUFBQTtBQUFBLEVBQ2Q7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEsRUFBRztBQUFBLEVBQUc7QUFBQSxFQUFHO0FBQUEs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QUFBO0FBQUEsSUFDVDtBQUdPLFdBQUEsTUFBTSxNQUFNLE9BQU87QUFBQSxFQUM1QjtBQUVNLFFBQUEsY0FBYyxnQkFBZ0IsT0FBUSxHQUFHO0FBQy9DLFFBQU0sV0FBVyxJQUFJLElBQUksV0FBVyxFQUFFLGFBQWEsSUFBSSxPQUFPO0FBQzlELFFBQU0sRUFBRSxlQUFlLElBQUksYUFBYSxJQUFJLFFBQVEsS0FBSztBQUN6RCxNQUFJLENBQUM7QUFDSCxXQUFPLElBQUksU0FBUyxNQUFNLEVBQUUsUUFBUSxJQUFLLENBQUE7QUFFckMsUUFBQSxhQUFhLENBQUMsUUFBUSxHQUFHO0FBQy9CLE1BQUkscUJBQXFCLFFBQVEsSUFBSSxXQUFXLFVBQVU7QUFDeEQsZUFBVyxLQUFLLFFBQVEsSUFBSSxRQUFRLFVBQVUsTUFBTSxDQUFDO0FBQ3ZELFNBQU8sZUFBZSxjQUFjLFlBQVksUUFBUSxRQUFRLFdBQVc7QUFDN0U7QUFFQSxTQUFTLGdCQUFnQixjQUFvRDtBQUNyRSxRQUFBLE9BQU8sYUFBYSxJQUFJLElBQUk7QUFDNUIsUUFBQSxjQUFjLGFBQWEsSUFBSSxLQUFLO0FBQzFDLE1BQUksQ0FBQztBQUNIO0FBQ0ksUUFBQSxVQUFVLElBQUk7QUFDcEIsVUFBUSxJQUFJLHVCQUF1Qix1REFBdUQsbUJBQW1CLElBQUksQ0FBQyxFQUFFO0FBQ2hILE1BQUE7QUFDTSxZQUFBLElBQUksZ0JBQWdCLFdBQVc7QUFDbEMsU0FBQTtBQUNUO0FBRUEsZUFBZSxLQUFLO0FBQ2xCLFFBQU0sVUFBVSxNQUFNLEtBQUssUUFBUSxTQUFTO0FBQ3RDLFFBQUEsaUNBQWlCO0FBRXZCLGFBQVcsQ0FBQyxVQUFVLElBQUksS0FBSyxxQkFBcUI7QUFFbEQsUUFBSSxDQUFDLFFBQVEsS0FBSyxPQUFLLEVBQUUsT0FBTyxRQUFRLEdBQUc7QUFDekMsMEJBQW9CLE9BQU8sUUFBUTtBQUNuQztBQUFBLElBQ0Y7QUFDSSxRQUFBLEtBQUssVUFBVSxRQUFXO0FBQzVCLFlBQU0sVUFBVSxDQUFDLEdBQUcsS0FBSyxTQUFTO0FBRTdCLFdBQUEsWUFBWSxJQUFJLElBQUksUUFBUSxNQUFNLFFBQVEsU0FBUyxLQUFLLEtBQUssQ0FBQztBQUFBLElBQ3JFO0FBQ0EsU0FBSyxVQUFVLFFBQVEsQ0FBQSxRQUFPLFdBQVcsSUFBSSxHQUFHLENBQUM7QUFBQSxFQUNuRDtBQUVXLGFBQUEsWUFBWSxhQUFhLFFBQVE7QUFDdEMsUUFBQSxDQUFDLFdBQVcsSUFBSSxRQUFRO0FBQzFCLG1CQUFhLE9BQU8sUUFBUTtBQUFBLEVBQ2hDO0FBQ0Y7QUFHQSxLQUFLLGlCQUFpQixTQUFTLFNBQVMsT0FBbUI7QUFDbkQsUUFBQSxZQUFZLFFBQVEsS0FBSyxDQUFDO0FBQ2xDLENBQUM7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzksMTAsMTEsMTIsMTMsMTQsMTUsMTYsMTcsMTgsMTksMjAsMjEsMjIsMjMsMjQsMjUsMjYsMjcsMjgsMjksMzBdfQ==
