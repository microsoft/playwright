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

import { CRSession } from './crConnection';
import { assert, debugError, helper, RegisteredListener } from '../helper';
import { Protocol } from './protocol';

import { EVALUATION_SCRIPT_URL } from './crExecutionContext';
import * as types from '../types';

type JSRange = {
  startOffset: number,
  endOffset: number,
  count: number
}

type CSSCoverageEntry = {
  url: string,
  text?: string,
  ranges: {
    start: number,
    end: number
  }[]
};

type JSCoverageEntry = {
  url: string,
  source?: string,
  functions: {
    functionName: string,
    ranges: JSRange[]
  }[]
};

export class CRCoverage {
  private _jsCoverage: JSCoverage;
  private _cssCoverage: CSSCoverage;

  constructor(client: CRSession) {
    this._jsCoverage = new JSCoverage(client);
    this._cssCoverage = new CSSCoverage(client);
  }

  async startJSCoverage(options?: types.JSCoverageOptions) {
    return await this._jsCoverage.start(options);
  }

  async stopJSCoverage(): Promise<JSCoverageEntry[]> {
    return await this._jsCoverage.stop();
  }

  async startCSSCoverage(options?: types.CSSCoverageOptions) {
    return await this._cssCoverage.start(options);
  }

  async stopCSSCoverage(): Promise<CSSCoverageEntry[]> {
    return await this._cssCoverage.stop();
  }
}

class JSCoverage {
  _client: CRSession;
  _enabled: boolean;
  _scriptIds: Set<string>;
  _scriptSources: Map<string, string>;
  _eventListeners: RegisteredListener[];
  _resetOnNavigation: boolean;
  _reportAnonymousScripts = false;

  constructor(client: CRSession) {
    this._client = client;
    this._enabled = false;
    this._scriptIds = new Set();
    this._scriptSources = new Map();
    this._eventListeners = [];
    this._resetOnNavigation = false;
  }

  async start(options: types.JSCoverageOptions = {}) {
    assert(!this._enabled, 'JSCoverage is already enabled');
    const {
      resetOnNavigation = true,
      reportAnonymousScripts = false
    } = options;
    this._resetOnNavigation = resetOnNavigation;
    this._reportAnonymousScripts = reportAnonymousScripts;
    this._enabled = true;
    this._scriptIds.clear();
    this._scriptSources.clear();
    this._eventListeners = [
      helper.addEventListener(this._client, 'Debugger.scriptParsed', this._onScriptParsed.bind(this)),
      helper.addEventListener(this._client, 'Runtime.executionContextsCleared', this._onExecutionContextsCleared.bind(this)),
    ];
    this._client.on('Debugger.paused', () => this._client.send('Debugger.resume'));
    await Promise.all([
      this._client.send('Profiler.enable'),
      this._client.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true }),
      this._client.send('Debugger.enable'),
      this._client.send('Debugger.setSkipAllPauses', {skip: true})
    ]);
  }

  _onExecutionContextsCleared() {
    if (!this._resetOnNavigation)
      return;
    this._scriptIds.clear();
    this._scriptSources.clear();
  }

  async _onScriptParsed(event: Protocol.Debugger.scriptParsedPayload) {
    // Ignore playwright-injected scripts
    if (event.url === EVALUATION_SCRIPT_URL)
      return;
    this._scriptIds.add(event.scriptId);
    // Ignore other anonymous scripts unless the reportAnonymousScripts option is true.
    if (!event.url && !this._reportAnonymousScripts)
      return;
    try {
      const response = await this._client.send('Debugger.getScriptSource', {scriptId: event.scriptId});
      this._scriptSources.set(event.scriptId, response.scriptSource);
    } catch (e) {
      // This might happen if the page has already navigated away.
      debugError(e);
    }
  }

  async stop(): Promise<JSCoverageEntry[]> {
    assert(this._enabled, 'JSCoverage is not enabled');
    this._enabled = false;
    const [profileResponse] = await Promise.all([
      this._client.send('Profiler.takePreciseCoverage'),
      this._client.send('Profiler.stopPreciseCoverage'),
      this._client.send('Profiler.disable'),
      this._client.send('Debugger.disable'),
    ] as const);
    helper.removeEventListeners(this._eventListeners);

    const coverage: JSCoverageEntry[] = [];
    for (const entry of profileResponse.result) {
      if (!this._scriptIds.has(entry.scriptId))
        continue;
      if (!entry.url && !this._reportAnonymousScripts)
        continue;
      const source = this._scriptSources.get(entry.scriptId);
      if (source)
        coverage.push({...entry, source});
      else
        coverage.push(entry);
    }
    return coverage;
  }
}

class CSSCoverage {
  _client: CRSession;
  _enabled: boolean;
  _stylesheetURLs: Map<string, string>;
  _stylesheetSources: Map<string, string>;
  _eventListeners: RegisteredListener[];
  _resetOnNavigation: boolean;

  constructor(client: CRSession) {
    this._client = client;
    this._enabled = false;
    this._stylesheetURLs = new Map();
    this._stylesheetSources = new Map();
    this._eventListeners = [];
    this._resetOnNavigation = false;
  }

  async start(options: types.CSSCoverageOptions = {}) {
    assert(!this._enabled, 'CSSCoverage is already enabled');
    const {resetOnNavigation = true} = options;
    this._resetOnNavigation = resetOnNavigation;
    this._enabled = true;
    this._stylesheetURLs.clear();
    this._stylesheetSources.clear();
    this._eventListeners = [
      helper.addEventListener(this._client, 'CSS.styleSheetAdded', this._onStyleSheet.bind(this)),
      helper.addEventListener(this._client, 'Runtime.executionContextsCleared', this._onExecutionContextsCleared.bind(this)),
    ];
    await Promise.all([
      this._client.send('DOM.enable'),
      this._client.send('CSS.enable'),
      this._client.send('CSS.startRuleUsageTracking'),
    ]);
  }

  _onExecutionContextsCleared() {
    if (!this._resetOnNavigation)
      return;
    this._stylesheetURLs.clear();
    this._stylesheetSources.clear();
  }

  async _onStyleSheet(event: Protocol.CSS.styleSheetAddedPayload) {
    const header = event.header;
    // Ignore anonymous scripts
    if (!header.sourceURL)
      return;
    try {
      const response = await this._client.send('CSS.getStyleSheetText', {styleSheetId: header.styleSheetId});
      this._stylesheetURLs.set(header.styleSheetId, header.sourceURL);
      this._stylesheetSources.set(header.styleSheetId, response.text);
    } catch (e) {
      // This might happen if the page has already navigated away.
      debugError(e);
    }
  }

  async stop(): Promise<CSSCoverageEntry[]> {
    assert(this._enabled, 'CSSCoverage is not enabled');
    this._enabled = false;
    const ruleTrackingResponse = await this._client.send('CSS.stopRuleUsageTracking');
    await Promise.all([
      this._client.send('CSS.disable'),
      this._client.send('DOM.disable'),
    ]);
    helper.removeEventListeners(this._eventListeners);

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
        count: entry.used ? 1 : 0,
      });
    }

    const coverage: CSSCoverageEntry[] = [];
    for (const styleSheetId of this._stylesheetURLs.keys()) {
      const url = this._stylesheetURLs.get(styleSheetId)!;
      const text = this._stylesheetSources.get(styleSheetId)!;
      const ranges = convertToDisjointRanges(styleSheetIdToCoverage.get(styleSheetId) || []);
      coverage.push({ url, ranges, text });
    }

    return coverage;
  }
}

function convertToDisjointRanges(nestedRanges: {
    startOffset: number;
    endOffset: number;
    count: number; }[]): { start: number; end: number; }[] {
  const points = [];
  for (const range of nestedRanges) {
    points.push({ offset: range.startOffset, type: 0, range });
    points.push({ offset: range.endOffset, type: 1, range });
  }
  // Sort points to form a valid parenthesis sequence.
  points.sort((a, b) => {
    // Sort with increasing offsets.
    if (a.offset !== b.offset)
      return a.offset - b.offset;
    // All "end" points should go before "start" points.
    if (a.type !== b.type)
      return b.type - a.type;
    const aLength = a.range.endOffset - a.range.startOffset;
    const bLength = b.range.endOffset - b.range.startOffset;
    // For two "start" points, the one with longer range goes first.
    if (a.type === 0)
      return bLength - aLength;
    // For two "end" points, the one with shorter range goes first.
    return aLength - bLength;
  });

  const hitCountStack = [];
  const results: { start: number; end: number; }[] = [];
  let lastOffset = 0;
  // Run scanning line to intersect all ranges.
  for (const point of points) {
    if (hitCountStack.length && lastOffset < point.offset && hitCountStack[hitCountStack.length - 1] > 0) {
      const lastResult = results.length ? results[results.length - 1] : null;
      if (lastResult && lastResult.end === lastOffset)
        lastResult.end = point.offset;
      else
        results.push({start: lastOffset, end: point.offset});
    }
    lastOffset = point.offset;
    if (point.type === 0)
      hitCountStack.push(point.range.count);
    else
      hitCountStack.pop();
  }
  // Filter out empty ranges.
  return results.filter(range => range.end - range.start > 1);
}
