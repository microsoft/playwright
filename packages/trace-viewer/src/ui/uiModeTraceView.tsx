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

import type { TreeItem } from '@testIsomorphic/testTree';
import { settings } from '@web/uiUtils';
import type * as reporterTypes from 'playwright/types/testReporter';
import React from 'react';
import type { SourceLocation } from '@isomorphic/trace/traceModel';
import type { AriaModeInfo } from './ariaModeView';
import type { SerializedSettings, UIModeTraceEvent, UIModeTraceParams, UIModeTraceRequest } from './uiModeTraceProtocol';

const searchParams = new URLSearchParams(window.location.search);
// The trace viewer has its own server on a different port, so it has a different origin.
// The browser gets to the two servers through the same host. The parameter is "<port>/<path>".
const traceViewerPortAndPath = searchParams.get('traceViewer') ?? '';
if (!/^\d+\//.test(traceViewerPortAndPath))
  throw new Error('UI mode does not have the address of the trace viewer');
const traceViewerBase = new URL(`${window.location.protocol}//${window.location.hostname}:${traceViewerPortAndPath}`);
const traceViewerOrigin = traceViewerBase.origin;
const traceViewerSettingsKey = 'traceViewerSettings';
const traceViewerParams = new URLSearchParams();
if (searchParams.has('isUnderTest'))
  traceViewerParams.set('isUnderTest', 'true');
// The frame applies the theme before it gets the first message.
traceViewerParams.set('theme', settings.getString('theme', 'system'));
const traceViewerUrl = new URL('uiModeTrace.html?' + traceViewerParams, traceViewerBase).toString();
// The settings that UI mode shows, and the trace viewer uses.
const sharedSettings = ['theme', 'shouldPopulateCanvasFromScreenshot', 'displayAriaMode'];
// Chromium does not match an origin with an IPv6 address in the "allow" list.
const clipboardAllowList = traceViewerOrigin.includes('[') ? '*' : traceViewerOrigin;

// The UI mode side of the trace viewer frame.
export const TraceView: React.FC<{
  item: { treeItem?: TreeItem, testFile?: SourceLocation, testCase?: reporterTypes.TestCase },
  rootDir?: string,
  onOpenExternally?: (location: SourceLocation) => void,
  revealSource?: boolean,
  pathSeparator: string,
  onTraceInfoChange?: (info: AriaModeInfo | undefined) => void,
}> = ({ item, rootDir, onOpenExternally, revealSource, pathSeparator, onTraceInfoChange }) => {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  // The frame is ready again each time it loads.
  const [readyCount, setReadyCount] = React.useState(0);
  const ready = readyCount > 0;

  const sendRequest = React.useCallback((request: UIModeTraceRequest) => {
    frameRef.current?.contentWindow?.postMessage(request, traceViewerOrigin);
  }, []);

  React.useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== traceViewerOrigin)
        return;
      const message = event.data as UIModeTraceEvent;
      if (message.method === 'ready') {
        sendRequest({ method: 'settings', settings: { ...storedTraceViewerSettings(), ...serializeSharedSettings() } });
        setReadyCount(count => count + 1);
      } else if (message.method === 'traceInfo') {
        onTraceInfoChange?.(message.info ? { hasDomSnapshots: !!message.info.hasDomSnapshots, hasAriaSnapshots: !!message.info.hasAriaSnapshots } : undefined);
      } else if (message.method === 'openExternally') {
        const { file, line, column } = message.location ?? {};
        if (typeof file === 'string' && Number.isInteger(line) && Number.isInteger(column))
          onOpenExternally?.({ file, line, column });
      } else if (message.method === 'saveSettings') {
        if (isSerializedSettings(message.settings))
          settings.setObject(traceViewerSettingsKey, message.settings);
      } else if (message.method === 'keydown') {
        const { key, code, ctrlKey, shiftKey, altKey, metaKey } = message.event ?? {};
        frameRef.current?.dispatchEvent(new KeyboardEvent('keydown', { key: String(key), code: String(code), ctrlKey: !!ctrlKey, shiftKey: !!shiftKey, altKey: !!altKey, metaKey: !!metaKey, bubbles: true, cancelable: true }));
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [sendRequest, onTraceInfoChange, onOpenExternally]);

  React.useEffect(() => {
    if (!ready)
      return;
    const listener = () => sendRequest({ method: 'settings', settings: serializeSharedSettings() });
    for (const name of sharedSettings)
      settings.onChangeEmitter.addEventListener(name, listener);
    return () => {
      for (const name of sharedSettings)
        settings.onChangeEmitter.removeEventListener(name, listener);
    };
  }, [ready, sendRequest]);

  // Each new item gives a new update, also when the values are the same.
  // The trace viewer then reads the source file again, because the file can be different.
  const params = React.useMemo(() => {
    const result = item.treeItem?.status === 'scheduled' ? undefined : item.testCase?.results[0];
    const params: UIModeTraceParams = {
      result: result ? {
        startTime: result.startTime.getTime(),
        duration: result.duration,
        workerIndex: result.workerIndex,
        tracePath: result.attachments.find(a => a.name === 'trace')?.path,
        errors: result.errors.flatMap(error => error.message ? [error.message] : []),
      } : undefined,
      testId: item.testCase?.id,
      outputDir: item.testCase ? outputDirForTestCase(item.testCase) : undefined,
      rootDir,
      testFile: item.testFile,
      status: item.treeItem?.status,
      annotations: item.testCase?.annotations ?? [],
      revealSource: !!revealSource,
      pathSeparator,
    };
    return params;
  }, [item, rootDir, revealSource, pathSeparator]);

  React.useEffect(() => {
    if (readyCount)
      sendRequest({ method: 'update', params });
  }, [readyCount, sendRequest, params]);

  return <iframe
    ref={frameRef}
    name='trace-viewer'
    title='Trace viewer'
    className='ui-mode-trace-frame'
    allow={`clipboard-write ${clipboardAllowList}`}
    sandbox='allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-forms'
    src={traceViewerUrl}
  ></iframe>;
};

function serializeSharedSettings(): SerializedSettings {
  const result: SerializedSettings = {};
  for (const name of sharedSettings) {
    if (localStorage[name] !== undefined)
      result[name] = localStorage[name];
  }
  return result;
}

function isSerializedSettings(value: unknown): value is SerializedSettings {
  return !!value && typeof value === 'object' && Object.values(value).every(item => typeof item === 'string');
}

// Before the trace viewer had its own origin, its settings were in the local storage of UI mode.
function storedTraceViewerSettings(): SerializedSettings {
  const stored = settings.getObject<SerializedSettings | undefined>(traceViewerSettingsKey, undefined);
  return isSerializedSettings(stored) ? stored : { ...localStorage };
}

const outputDirForTestCase = (testCase: reporterTypes.TestCase): string | undefined => {
  for (let suite: reporterTypes.Suite | undefined = testCase.parent; suite; suite = suite.parent) {
    if (suite.project())
      return suite.project()?.outputDir;
  }
  return undefined;
};
