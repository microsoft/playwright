"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CRCoverage = void 0;
var _eventsHelper = require("../../utils/eventsHelper");
var _utils = require("../../utils");
/**
 * Copyright 2017 Google Inc. All rights reserved.
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

class CRCoverage {
  constructor(client) {
    this._jsCoverage = void 0;
    this._cssCoverage = void 0;
    this._jsCoverage = new JSCoverage(client);
    this._cssCoverage = new CSSCoverage(client);
  }
  async startJSCoverage(options) {
    return await this._jsCoverage.start(options);
  }
  async stopJSCoverage() {
    return await this._jsCoverage.stop();
  }
  async startCSSCoverage(options) {
    return await this._cssCoverage.start(options);
  }
  async stopCSSCoverage() {
    return await this._cssCoverage.stop();
  }
}
exports.CRCoverage = CRCoverage;
class JSCoverage {
  constructor(client) {
    this._client = void 0;
    this._enabled = void 0;
    this._scriptIds = void 0;
    this._scriptSources = void 0;
    this._eventListeners = void 0;
    this._resetOnNavigation = void 0;
    this._reportAnonymousScripts = false;
    this._client = client;
    this._enabled = false;
    this._scriptIds = new Set();
    this._scriptSources = new Map();
    this._eventListeners = [];
    this._resetOnNavigation = false;
  }
  async start(options) {
    (0, _utils.assert)(!this._enabled, 'JSCoverage is already enabled');
    const {
      resetOnNavigation = true,
      reportAnonymousScripts = false
    } = options;
    this._resetOnNavigation = resetOnNavigation;
    this._reportAnonymousScripts = reportAnonymousScripts;
    this._enabled = true;
    this._scriptIds.clear();
    this._scriptSources.clear();
    this._eventListeners = [_eventsHelper.eventsHelper.addEventListener(this._client, 'Debugger.scriptParsed', this._onScriptParsed.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Runtime.executionContextsCleared', this._onExecutionContextsCleared.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Debugger.paused', this._onDebuggerPaused.bind(this))];
    await Promise.all([this._client.send('Profiler.enable'), this._client.send('Profiler.startPreciseCoverage', {
      callCount: true,
      detailed: true
    }), this._client.send('Debugger.enable'), this._client.send('Debugger.setSkipAllPauses', {
      skip: true
    })]);
  }
  _onDebuggerPaused() {
    this._client.send('Debugger.resume');
  }
  _onExecutionContextsCleared() {
    if (!this._resetOnNavigation) return;
    this._scriptIds.clear();
    this._scriptSources.clear();
  }
  async _onScriptParsed(event) {
    this._scriptIds.add(event.scriptId);
    // Ignore other anonymous scripts unless the reportAnonymousScripts option is true.
    if (!event.url && !this._reportAnonymousScripts) return;
    // This might fail if the page has already navigated away.
    const response = await this._client._sendMayFail('Debugger.getScriptSource', {
      scriptId: event.scriptId
    });
    if (response) this._scriptSources.set(event.scriptId, response.scriptSource);
  }
  async stop() {
    (0, _utils.assert)(this._enabled, 'JSCoverage is not enabled');
    this._enabled = false;
    const [profileResponse] = await Promise.all([this._client.send('Profiler.takePreciseCoverage'), this._client.send('Profiler.stopPreciseCoverage'), this._client.send('Profiler.disable'), this._client.send('Debugger.disable')]);
    _eventsHelper.eventsHelper.removeEventListeners(this._eventListeners);
    const coverage = {
      entries: []
    };
    for (const entry of profileResponse.result) {
      if (!this._scriptIds.has(entry.scriptId)) continue;
      if (!entry.url && !this._reportAnonymousScripts) continue;
      const source = this._scriptSources.get(entry.scriptId);
      if (source) coverage.entries.push({
        ...entry,
        source
      });else coverage.entries.push(entry);
    }
    return coverage;
  }
}
class CSSCoverage {
  constructor(client) {
    this._client = void 0;
    this._enabled = void 0;
    this._stylesheetURLs = void 0;
    this._stylesheetSources = void 0;
    this._eventListeners = void 0;
    this._resetOnNavigation = void 0;
    this._client = client;
    this._enabled = false;
    this._stylesheetURLs = new Map();
    this._stylesheetSources = new Map();
    this._eventListeners = [];
    this._resetOnNavigation = false;
  }
  async start(options) {
    (0, _utils.assert)(!this._enabled, 'CSSCoverage is already enabled');
    const {
      resetOnNavigation = true
    } = options;
    this._resetOnNavigation = resetOnNavigation;
    this._enabled = true;
    this._stylesheetURLs.clear();
    this._stylesheetSources.clear();
    this._eventListeners = [_eventsHelper.eventsHelper.addEventListener(this._client, 'CSS.styleSheetAdded', this._onStyleSheet.bind(this)), _eventsHelper.eventsHelper.addEventListener(this._client, 'Runtime.executionContextsCleared', this._onExecutionContextsCleared.bind(this))];
    await Promise.all([this._client.send('DOM.enable'), this._client.send('CSS.enable'), this._client.send('CSS.startRuleUsageTracking')]);
  }
  _onExecutionContextsCleared() {
    if (!this._resetOnNavigation) return;
    this._stylesheetURLs.clear();
    this._stylesheetSources.clear();
  }
  async _onStyleSheet(event) {
    const header = event.header;
    // Ignore anonymous scripts
    if (!header.sourceURL) return;
    // This might fail if the page has already navigated away.
    const response = await this._client._sendMayFail('CSS.getStyleSheetText', {
      styleSheetId: header.styleSheetId
    });
    if (response) {
      this._stylesheetURLs.set(header.styleSheetId, header.sourceURL);
      this._stylesheetSources.set(header.styleSheetId, response.text);
    }
  }
  async stop() {
    (0, _utils.assert)(this._enabled, 'CSSCoverage is not enabled');
    this._enabled = false;
    const ruleTrackingResponse = await this._client.send('CSS.stopRuleUsageTracking');
    await Promise.all([this._client.send('CSS.disable'), this._client.send('DOM.disable')]);
    _eventsHelper.eventsHelper.removeEventListeners(this._eventListeners);

    // aggregate by styleSheetId
    const styleSheetIdToCoverage = new Map();
    for (const entry of ruleTrackingResponse.ruleUsage) {
      let ranges = styleSheetIdToCoverage.get(entry.styleSheetId);
      if (!ranges) {
        ranges = [];
        styleSheetIdToCoverage.set(entry.styleSheetId, ranges);
      }
      ranges.push({
        startOffset: entry.startOffset,
        endOffset: entry.endOffset,
        count: entry.used ? 1 : 0
      });
    }
    const coverage = {
      entries: []
    };
    for (const styleSheetId of this._stylesheetURLs.keys()) {
      const url = this._stylesheetURLs.get(styleSheetId);
      const text = this._stylesheetSources.get(styleSheetId);
      const ranges = convertToDisjointRanges(styleSheetIdToCoverage.get(styleSheetId) || []);
      coverage.entries.push({
        url,
        ranges,
        text
      });
    }
    return coverage;
  }
}
function convertToDisjointRanges(nestedRanges) {
  const points = [];
  for (const range of nestedRanges) {
    points.push({
      offset: range.startOffset,
      type: 0,
      range
    });
    points.push({
      offset: range.endOffset,
      type: 1,
      range
    });
  }
  // Sort points to form a valid parenthesis sequence.
  points.sort((a, b) => {
    // Sort with increasing offsets.
    if (a.offset !== b.offset) return a.offset - b.offset;
    // All "end" points should go before "start" points.
    if (a.type !== b.type) return b.type - a.type;
    const aLength = a.range.endOffset - a.range.startOffset;
    const bLength = b.range.endOffset - b.range.startOffset;
    // For two "start" points, the one with longer range goes first.
    if (a.type === 0) return bLength - aLength;
    // For two "end" points, the one with shorter range goes first.
    return aLength - bLength;
  });
  const hitCountStack = [];
  const results = [];
  let lastOffset = 0;
  // Run scanning line to intersect all ranges.
  for (const point of points) {
    if (hitCountStack.length && lastOffset < point.offset && hitCountStack[hitCountStack.length - 1] > 0) {
      const lastResult = results.length ? results[results.length - 1] : null;
      if (lastResult && lastResult.end === lastOffset) lastResult.end = point.offset;else results.push({
        start: lastOffset,
        end: point.offset
      });
    }
    lastOffset = point.offset;
    if (point.type === 0) hitCountStack.push(point.range.count);else hitCountStack.pop();
  }
  // Filter out empty ranges.
  return results.filter(range => range.end - range.start > 1);
}