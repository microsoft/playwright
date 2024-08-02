"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Screenshotter = void 0;
exports.validateScreenshotOptions = validateScreenshotOptions;
var _helper = require("./helper");
var _utils = require("../utils");
var _multimap = require("../utils/multimap");
/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

function inPagePrepareForScreenshots(screenshotStyle, hideCaret, disableAnimations, syncAnimations) {
  // In WebKit, sync the animations.
  if (syncAnimations) {
    const style = document.createElement('style');
    style.textContent = 'body {}';
    document.head.appendChild(style);
    document.documentElement.getBoundingClientRect();
    style.remove();
  }
  if (!screenshotStyle && !hideCaret && !disableAnimations) return;
  const collectRoots = (root, roots = []) => {
    roots.push(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    do {
      const node = walker.currentNode;
      const shadowRoot = node instanceof Element ? node.shadowRoot : null;
      if (shadowRoot) collectRoots(shadowRoot, roots);
    } while (walker.nextNode());
    return roots;
  };
  const roots = collectRoots(document);
  const cleanupCallbacks = [];
  if (screenshotStyle) {
    for (const root of roots) {
      const styleTag = document.createElement('style');
      styleTag.textContent = screenshotStyle;
      if (root === document) document.documentElement.append(styleTag);else root.append(styleTag);
      cleanupCallbacks.push(() => {
        styleTag.remove();
      });
    }
  }
  if (hideCaret) {
    const elements = new Map();
    for (const root of roots) {
      root.querySelectorAll('input,textarea,[contenteditable]').forEach(element => {
        elements.set(element, {
          value: element.style.getPropertyValue('caret-color'),
          priority: element.style.getPropertyPriority('caret-color')
        });
        element.style.setProperty('caret-color', 'transparent', 'important');
      });
    }
    cleanupCallbacks.push(() => {
      for (const [element, value] of elements) element.style.setProperty('caret-color', value.value, value.priority);
    });
  }
  if (disableAnimations) {
    const infiniteAnimationsToResume = new Set();
    const handleAnimations = root => {
      for (const animation of root.getAnimations()) {
        if (!animation.effect || animation.playbackRate === 0 || infiniteAnimationsToResume.has(animation)) continue;
        const endTime = animation.effect.getComputedTiming().endTime;
        if (Number.isFinite(endTime)) {
          try {
            animation.finish();
          } catch (e) {
            // animation.finish() should not throw for
            // finite animations, but we'd like to be on the
            // safe side.
          }
        } else {
          try {
            animation.cancel();
            infiniteAnimationsToResume.add(animation);
          } catch (e) {
            // animation.cancel() should not throw for
            // infinite animations, but we'd like to be on the
            // safe side.
          }
        }
      }
    };
    for (const root of roots) {
      const handleRootAnimations = handleAnimations.bind(null, root);
      handleRootAnimations();
      root.addEventListener('transitionrun', handleRootAnimations);
      root.addEventListener('animationstart', handleRootAnimations);
      cleanupCallbacks.push(() => {
        root.removeEventListener('transitionrun', handleRootAnimations);
        root.removeEventListener('animationstart', handleRootAnimations);
      });
    }
    cleanupCallbacks.push(() => {
      for (const animation of infiniteAnimationsToResume) {
        try {
          animation.play();
        } catch (e) {
          // animation.play() should never throw, but
          // we'd like to be on the safe side.
        }
      }
    });
  }
  window.__pwCleanupScreenshot = () => {
    for (const cleanupCallback of cleanupCallbacks) cleanupCallback();
    delete window.__pwCleanupScreenshot;
  };
}
class Screenshotter {
  constructor(page) {
    this._queue = new TaskQueue();
    this._page = void 0;
    this._page = page;
    this._queue = new TaskQueue();
  }
  async _originalViewportSize(progress) {
    const originalViewportSize = this._page.viewportSize();
    let viewportSize = originalViewportSize;
    if (!viewportSize) viewportSize = await this._page.mainFrame().waitForFunctionValueInUtility(progress, () => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    return {
      viewportSize,
      originalViewportSize
    };
  }
  async _fullPageSize(progress) {
    const fullPageSize = await this._page.mainFrame().waitForFunctionValueInUtility(progress, () => {
      if (!document.body || !document.documentElement) return null;
      return {
        width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth, document.body.offsetWidth, document.documentElement.offsetWidth, document.body.clientWidth, document.documentElement.clientWidth),
        height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight, document.body.clientHeight, document.documentElement.clientHeight)
      };
    });
    return fullPageSize;
  }
  async screenshotPage(progress, options) {
    const format = validateScreenshotOptions(options);
    return this._queue.postTask(async () => {
      progress.log('taking page screenshot');
      const {
        viewportSize
      } = await this._originalViewportSize(progress);
      await this._preparePageForScreenshot(progress, this._page.mainFrame(), options.style, options.caret !== 'initial', options.animations === 'disabled');
      progress.throwIfAborted(); // Avoid restoring after failure - should be done by cleanup.

      if (options.fullPage) {
        const fullPageSize = await this._fullPageSize(progress);
        let documentRect = {
          x: 0,
          y: 0,
          width: fullPageSize.width,
          height: fullPageSize.height
        };
        const fitsViewport = fullPageSize.width <= viewportSize.width && fullPageSize.height <= viewportSize.height;
        if (options.clip) documentRect = trimClipToSize(options.clip, documentRect);
        const buffer = await this._screenshot(progress, format, documentRect, undefined, fitsViewport, options);
        progress.throwIfAborted(); // Avoid restoring after failure - should be done by cleanup.
        await this._restorePageAfterScreenshot();
        return buffer;
      }
      const viewportRect = options.clip ? trimClipToSize(options.clip, viewportSize) : {
        x: 0,
        y: 0,
        ...viewportSize
      };
      const buffer = await this._screenshot(progress, format, undefined, viewportRect, true, options);
      progress.throwIfAborted(); // Avoid restoring after failure - should be done by cleanup.
      await this._restorePageAfterScreenshot();
      return buffer;
    });
  }
  async screenshotElement(progress, handle, options) {
    const format = validateScreenshotOptions(options);
    return this._queue.postTask(async () => {
      progress.log('taking element screenshot');
      const {
        viewportSize
      } = await this._originalViewportSize(progress);
      await this._preparePageForScreenshot(progress, handle._frame, options.style, options.caret !== 'initial', options.animations === 'disabled');
      progress.throwIfAborted(); // Do not do extra work.

      await handle._waitAndScrollIntoViewIfNeeded(progress, true /* waitForVisible */);
      progress.throwIfAborted(); // Do not do extra work.
      const boundingBox = await handle.boundingBox();
      (0, _utils.assert)(boundingBox, 'Node is either not visible or not an HTMLElement');
      (0, _utils.assert)(boundingBox.width !== 0, 'Node has 0 width.');
      (0, _utils.assert)(boundingBox.height !== 0, 'Node has 0 height.');
      const fitsViewport = boundingBox.width <= viewportSize.width && boundingBox.height <= viewportSize.height;
      progress.throwIfAborted(); // Avoid extra work.
      const scrollOffset = await this._page.mainFrame().waitForFunctionValueInUtility(progress, () => ({
        x: window.scrollX,
        y: window.scrollY
      }));
      const documentRect = {
        ...boundingBox
      };
      documentRect.x += scrollOffset.x;
      documentRect.y += scrollOffset.y;
      const buffer = await this._screenshot(progress, format, _helper.helper.enclosingIntRect(documentRect), undefined, fitsViewport, options);
      progress.throwIfAborted(); // Avoid restoring after failure - should be done by cleanup.
      await this._restorePageAfterScreenshot();
      return buffer;
    });
  }
  async _preparePageForScreenshot(progress, frame, screenshotStyle, hideCaret, disableAnimations) {
    if (disableAnimations) progress.log('  disabled all CSS animations');
    const syncAnimations = this._page._delegate.shouldToggleStyleSheetToSyncAnimations();
    await Promise.all(this._page.frames().map(async frame => {
      await frame.nonStallingEvaluateInExistingContext('(' + inPagePrepareForScreenshots.toString() + `)(${JSON.stringify(screenshotStyle)}, ${hideCaret}, ${disableAnimations}, ${syncAnimations})`, false, 'utility').catch(() => {});
    }));
    if (!process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY) {
      progress.log('waiting for fonts to load...');
      await frame.nonStallingEvaluateInExistingContext('document.fonts.ready', false, 'utility').catch(() => {});
      progress.log('fonts loaded');
    }
    progress.cleanupWhenAborted(() => this._restorePageAfterScreenshot());
  }
  async _restorePageAfterScreenshot() {
    await Promise.all(this._page.frames().map(async frame => {
      frame.nonStallingEvaluateInExistingContext('window.__pwCleanupScreenshot && window.__pwCleanupScreenshot()', false, 'utility').catch(() => {});
    }));
  }
  async _maskElements(progress, options) {
    const framesToParsedSelectors = new _multimap.MultiMap();
    const cleanup = async () => {
      await Promise.all([...framesToParsedSelectors.keys()].map(async frame => {
        await frame.hideHighlight();
      }));
    };
    if (!options.mask || !options.mask.length) return cleanup;
    await Promise.all((options.mask || []).map(async ({
      frame,
      selector
    }) => {
      const pair = await frame.selectors.resolveFrameForSelector(selector);
      if (pair) framesToParsedSelectors.set(pair.frame, pair.info.parsed);
    }));
    progress.throwIfAborted(); // Avoid extra work.

    await Promise.all([...framesToParsedSelectors.keys()].map(async frame => {
      await frame.maskSelectors(framesToParsedSelectors.get(frame), options.maskColor || '#F0F');
    }));
    progress.cleanupWhenAborted(cleanup);
    return cleanup;
  }
  async _screenshot(progress, format, documentRect, viewportRect, fitsViewport, options) {
    var _options$quality;
    if (options.__testHookBeforeScreenshot) await options.__testHookBeforeScreenshot();
    progress.throwIfAborted(); // Screenshotting is expensive - avoid extra work.
    const shouldSetDefaultBackground = options.omitBackground && format === 'png';
    if (shouldSetDefaultBackground) {
      await this._page._delegate.setBackgroundColor({
        r: 0,
        g: 0,
        b: 0,
        a: 0
      });
      progress.cleanupWhenAborted(() => this._page._delegate.setBackgroundColor());
    }
    progress.throwIfAborted(); // Avoid extra work.

    const cleanupHighlight = await this._maskElements(progress, options);
    progress.throwIfAborted(); // Avoid extra work.

    const quality = format === 'jpeg' ? (_options$quality = options.quality) !== null && _options$quality !== void 0 ? _options$quality : 80 : undefined;
    const buffer = await this._page._delegate.takeScreenshot(progress, format, documentRect, viewportRect, quality, fitsViewport, options.scale || 'device');
    progress.throwIfAborted(); // Avoid restoring after failure - should be done by cleanup.

    await cleanupHighlight();
    progress.throwIfAborted(); // Avoid restoring after failure - should be done by cleanup.

    if (shouldSetDefaultBackground) await this._page._delegate.setBackgroundColor();
    progress.throwIfAborted(); // Avoid side effects.
    if (options.__testHookAfterScreenshot) await options.__testHookAfterScreenshot();
    return buffer;
  }
}
exports.Screenshotter = Screenshotter;
class TaskQueue {
  constructor() {
    this._chain = void 0;
    this._chain = Promise.resolve();
  }
  postTask(task) {
    const result = this._chain.then(task);
    this._chain = result.catch(() => {});
    return result;
  }
}
function trimClipToSize(clip, size) {
  const p1 = {
    x: Math.max(0, Math.min(clip.x, size.width)),
    y: Math.max(0, Math.min(clip.y, size.height))
  };
  const p2 = {
    x: Math.max(0, Math.min(clip.x + clip.width, size.width)),
    y: Math.max(0, Math.min(clip.y + clip.height, size.height))
  };
  const result = {
    x: p1.x,
    y: p1.y,
    width: p2.x - p1.x,
    height: p2.y - p1.y
  };
  (0, _utils.assert)(result.width && result.height, 'Clipped area is either empty or outside the resulting image');
  return result;
}
function validateScreenshotOptions(options) {
  let format = null;
  // options.type takes precedence over inferring the type from options.path
  // because it may be a 0-length file with no extension created beforehand (i.e. as a temp file).
  if (options.type) {
    (0, _utils.assert)(options.type === 'png' || options.type === 'jpeg', 'Unknown options.type value: ' + options.type);
    format = options.type;
  }
  if (!format) format = 'png';
  if (options.quality !== undefined) {
    (0, _utils.assert)(format === 'jpeg', 'options.quality is unsupported for the ' + format + ' screenshots');
    (0, _utils.assert)(typeof options.quality === 'number', 'Expected options.quality to be a number but found ' + typeof options.quality);
    (0, _utils.assert)(Number.isInteger(options.quality), 'Expected options.quality to be an integer');
    (0, _utils.assert)(options.quality >= 0 && options.quality <= 100, 'Expected options.quality to be between 0 and 100 (inclusive), got ' + options.quality);
  }
  if (options.clip) {
    (0, _utils.assert)(typeof options.clip.x === 'number', 'Expected options.clip.x to be a number but found ' + typeof options.clip.x);
    (0, _utils.assert)(typeof options.clip.y === 'number', 'Expected options.clip.y to be a number but found ' + typeof options.clip.y);
    (0, _utils.assert)(typeof options.clip.width === 'number', 'Expected options.clip.width to be a number but found ' + typeof options.clip.width);
    (0, _utils.assert)(typeof options.clip.height === 'number', 'Expected options.clip.height to be a number but found ' + typeof options.clip.height);
    (0, _utils.assert)(options.clip.width !== 0, 'Expected options.clip.width not to be 0.');
    (0, _utils.assert)(options.clip.height !== 0, 'Expected options.clip.height not to be 0.');
  }
  return format;
}