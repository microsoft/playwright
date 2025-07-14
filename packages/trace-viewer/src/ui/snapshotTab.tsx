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

import './snapshotTab.css';
import * as React from 'react';
import type { ActionTraceEvent } from '@trace/trace';
import { context, type MultiTraceModel, nextActionByStartTime, previousActionByEndTime } from './modelUtil';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton } from '@web/components/toolbarButton';
import { clsx, useMeasure, useSetting } from '@web/uiUtils';
import { InjectedScript } from '@injected/injectedScript';
import { Recorder } from '@injected/recorder/recorder';
import { asLocator } from '@isomorphic/locatorGenerators';
import type { Language } from '@isomorphic/locatorGenerators';
import { locatorOrSelectorAsSelector } from '@isomorphic/locatorParser';
import { TabbedPaneTab } from '@web/components/tabbedPane';
import { BrowserFrame } from './browserFrame';
import type { ElementInfo } from '@recorder/recorderTypes';
import { parseAriaSnapshot } from '@isomorphic/ariaSnapshot';
import yaml from 'yaml';

export type HighlightedElement = {
  locator?: string,
  ariaSnapshot?: string
  lastEdited: 'locator' | 'ariaSnapshot' | 'none';
};

export const SnapshotTabsView: React.FunctionComponent<{
  action: ActionTraceEvent | undefined,
  model?: MultiTraceModel,
  sdkLanguage: Language,
  testIdAttributeName: string,
  isInspecting: boolean,
  setIsInspecting: (isInspecting: boolean) => void,
  highlightedElement: HighlightedElement,
  setHighlightedElement: (element: HighlightedElement) => void,
}> = ({ action, sdkLanguage, testIdAttributeName, isInspecting, setIsInspecting, highlightedElement, setHighlightedElement }) => {
  const [snapshotTab, setSnapshotTab] = React.useState<'action'|'before'|'after'>('action');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [shouldPopulateCanvasFromScreenshot, _] = useSetting('shouldPopulateCanvasFromScreenshot', false);

  const snapshots = React.useMemo(() => {
    return collectSnapshots(action);
  }, [action]);
  const { snapshotInfoUrl, snapshotUrl, popoutUrl } = React.useMemo(() => {
    const snapshot = snapshots[snapshotTab];
    return snapshot ? extendSnapshot(snapshot, shouldPopulateCanvasFromScreenshot) : { snapshotInfoUrl: undefined, snapshotUrl: undefined, popoutUrl: undefined };
  }, [snapshots, snapshotTab, shouldPopulateCanvasFromScreenshot]);

  const snapshotUrls = React.useMemo((): SnapshotUrls | undefined => snapshotInfoUrl !== undefined ? { snapshotInfoUrl, snapshotUrl, popoutUrl } : undefined, [snapshotInfoUrl, snapshotUrl, popoutUrl]);

  return <div className='snapshot-tab vbox'>
    <Toolbar>
      <ToolbarButton className='pick-locator' title='Pick locator' icon='target' toggled={isInspecting} onClick={() => setIsInspecting(!isInspecting)} />
      {['action', 'before', 'after'].map(tab => {
        return <TabbedPaneTab
          key={tab}
          id={tab}
          title={renderTitle(tab)}
          selected={snapshotTab === tab}
          onSelect={() => setSnapshotTab(tab as 'action' | 'before' | 'after')}
        ></TabbedPaneTab>;
      })}
      <div style={{ flex: 'auto' }}></div>
      <ToolbarButton icon='link-external' title='Open snapshot in a new tab' disabled={!snapshotUrls?.popoutUrl} onClick={() => {
        const win = window.open(snapshotUrls?.popoutUrl || '', '_blank');
        win?.addEventListener('DOMContentLoaded', () => {
          const injectedScript = new InjectedScript(win as any, { isUnderTest, sdkLanguage, testIdAttributeName, stableRafCount: 1, browserName: 'chromium', customEngines: [] });
          injectedScript.consoleApi.install();
        });
      }} />
    </Toolbar>
    <SnapshotView
      snapshotUrls={snapshotUrls}
      sdkLanguage={sdkLanguage}
      testIdAttributeName={testIdAttributeName}
      isInspecting={isInspecting}
      setIsInspecting={setIsInspecting}
      highlightedElement={highlightedElement}
      setHighlightedElement={setHighlightedElement}
    />
  </div>;
};

export const SnapshotView: React.FunctionComponent<{
  snapshotUrls: SnapshotUrls | undefined,
  sdkLanguage: Language,
  testIdAttributeName: string,
  isInspecting: boolean,
  setIsInspecting: (isInspecting: boolean) => void,
  highlightedElement: HighlightedElement,
  setHighlightedElement: (element: HighlightedElement) => void,
}> = ({ snapshotUrls, sdkLanguage, testIdAttributeName, isInspecting, setIsInspecting, highlightedElement, setHighlightedElement }) => {
  const iframeRef0 = React.useRef<HTMLIFrameElement>(null);
  const iframeRef1 = React.useRef<HTMLIFrameElement>(null);
  const [snapshotInfo, setSnapshotInfo] = React.useState<SnapshotInfo>({ viewport: kDefaultViewport, url: '' });
  const loadingRef = React.useRef({ iteration: 0, visibleIframe: 0 });

  React.useEffect(() => {
    (async () => {
      const thisIteration = loadingRef.current.iteration + 1;
      const newVisibleIframe = 1 - loadingRef.current.visibleIframe;
      loadingRef.current.iteration = thisIteration;

      const newSnapshotInfo = await fetchSnapshotInfo(snapshotUrls?.snapshotInfoUrl);

      // Interrupted by another load - bail out.
      if (loadingRef.current.iteration !== thisIteration)
        return;

      const iframe = [iframeRef0, iframeRef1][newVisibleIframe].current;
      if (iframe) {
        let loadedCallback = () => {};
        const loadedPromise = new Promise<void>(f => loadedCallback = f);
        try {
          iframe.addEventListener('load', loadedCallback);
          iframe.addEventListener('error', loadedCallback);

          // Try preventing history entry from being created.
          const snapshotUrl = snapshotUrls?.snapshotUrl || kBlankSnapshotUrl;
          if (iframe.contentWindow)
            iframe.contentWindow.location.replace(snapshotUrl);
          else
            iframe.src = snapshotUrl;

          await loadedPromise;
        } catch {
        } finally {
          iframe.removeEventListener('load', loadedCallback);
          iframe.removeEventListener('error', loadedCallback);
        }
      }
      // Interrupted by another load - bail out.
      if (loadingRef.current.iteration !== thisIteration)
        return;

      loadingRef.current.visibleIframe = newVisibleIframe;
      setSnapshotInfo(newSnapshotInfo);
    })();
  }, [snapshotUrls]);

  return <div
    className='vbox'
    tabIndex={0}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        if (isInspecting)
          setIsInspecting(false);
      }
    }}
  >
    <InspectModeController
      isInspecting={isInspecting}
      sdkLanguage={sdkLanguage}
      testIdAttributeName={testIdAttributeName}
      highlightedElement={highlightedElement}
      setHighlightedElement={setHighlightedElement}
      iframe={iframeRef0.current}
      iteration={loadingRef.current.iteration} />
    <InspectModeController
      isInspecting={isInspecting}
      sdkLanguage={sdkLanguage}
      testIdAttributeName={testIdAttributeName}
      highlightedElement={highlightedElement}
      setHighlightedElement={setHighlightedElement}
      iframe={iframeRef1.current}
      iteration={loadingRef.current.iteration} />
    <SnapshotWrapper snapshotInfo={snapshotInfo}>
      <div className='snapshot-switcher'>
        <iframe ref={iframeRef0} name='snapshot' title='DOM Snapshot' className={clsx(loadingRef.current.visibleIframe === 0 && 'snapshot-visible')}></iframe>
        <iframe ref={iframeRef1} name='snapshot' title='DOM Snapshot' className={clsx(loadingRef.current.visibleIframe === 1 && 'snapshot-visible')}></iframe>
      </div>
    </SnapshotWrapper>
  </div>;
};

const SnapshotWrapper: React.FunctionComponent<React.PropsWithChildren<{
  snapshotInfo: SnapshotInfo,
}>> = ({ snapshotInfo, children }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();

  const windowHeaderHeight = 40;
  const snapshotContainerSize = {
    width: snapshotInfo.viewport.width,
    height: snapshotInfo.viewport.height + windowHeaderHeight,
  };

  const scale = Math.min(measure.width / snapshotContainerSize.width, measure.height / snapshotContainerSize.height, 1);
  const translate = {
    x: (measure.width - snapshotContainerSize.width) / 2,
    y: (measure.height - snapshotContainerSize.height) / 2,
  };

  return <div ref={ref} className='snapshot-wrapper'>
    <div className='snapshot-container' style={{
      width: snapshotContainerSize.width + 'px',
      height: snapshotContainerSize.height + 'px',
      transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
    }}>
      <BrowserFrame url={snapshotInfo.url} />
      {children}
    </div>
  </div>;
};

function renderTitle(snapshotTitle: string): string {
  if (snapshotTitle === 'before')
    return 'Before';
  if (snapshotTitle === 'after')
    return 'After';
  if (snapshotTitle === 'action')
    return 'Action';
  return snapshotTitle;
}

export const InspectModeController: React.FunctionComponent<{
  iframe: HTMLIFrameElement | null,
  isInspecting: boolean,
  sdkLanguage: Language,
  testIdAttributeName: string,
  highlightedElement: HighlightedElement,
  setHighlightedElement: (element: HighlightedElement) => void,
  iteration: number,
}> = ({ iframe, isInspecting, sdkLanguage, testIdAttributeName, highlightedElement, setHighlightedElement, iteration }) => {
  React.useEffect(() => {
    const highlightedAriaSnapshot = highlightedElement.lastEdited === 'ariaSnapshot' ? highlightedElement.ariaSnapshot : undefined;
    const highlightedLocator = highlightedElement.lastEdited === 'locator' ? highlightedElement.locator : undefined;
    const forceRecorders = !!highlightedAriaSnapshot || !!highlightedLocator || isInspecting;

    const recorders: { recorder: Recorder, frameSelector: string }[] = [];
    const isUnderTest = new URLSearchParams(window.location.search).get('isUnderTest') === 'true';
    try {
      createRecorders(recorders, forceRecorders, sdkLanguage, testIdAttributeName, isUnderTest, '', iframe?.contentWindow);
    } catch {
      // Potential cross-origin exceptions.
    }

    const parsedSnapshot = highlightedAriaSnapshot ? parseAriaSnapshot(yaml, highlightedAriaSnapshot) : undefined;
    const fullSelector = highlightedLocator ? locatorOrSelectorAsSelector(sdkLanguage, highlightedLocator, testIdAttributeName) : undefined;
    for (const { recorder, frameSelector } of recorders) {
      const actionSelector = fullSelector?.startsWith(frameSelector) ? fullSelector.substring(frameSelector.length).trim() : undefined;
      const ariaTemplate = parsedSnapshot?.errors.length === 0 ? parsedSnapshot.fragment : undefined;
      recorder.setUIState({
        mode: isInspecting ? 'inspecting' : 'none',
        actionSelector,
        ariaTemplate,
        language: sdkLanguage,
        testIdAttributeName,
        overlay: { offsetX: 0 },
      }, {
        async elementPicked(elementInfo: ElementInfo) {
          setHighlightedElement({
            locator: asLocator(sdkLanguage, frameSelector + elementInfo.selector),
            ariaSnapshot: elementInfo.ariaSnapshot,
            lastEdited: 'none',
          });
        },
        highlightUpdated() {
          for (const r of recorders) {
            if (r.recorder !== recorder)
              r.recorder.clearHighlight();
          }
        }
      });
    }
  }, [iframe, isInspecting, highlightedElement, setHighlightedElement, sdkLanguage, testIdAttributeName, iteration]);
  return <></>;
};

function createRecorders(recorders: { recorder: Recorder, frameSelector: string }[], force: boolean, sdkLanguage: Language, testIdAttributeName: string, isUnderTest: boolean, parentFrameSelector: string, frameWindow: Window | null | undefined) {
  if (!frameWindow)
    return;
  const win = frameWindow as any;
  if (!win._recorder && force) {
    const injectedScript = new InjectedScript(frameWindow as any, { isUnderTest, sdkLanguage, testIdAttributeName, stableRafCount: 1, browserName: 'chromium', customEngines: [] });
    const recorder = new Recorder(injectedScript);
    win._injectedScript = injectedScript;
    win._recorder = { recorder, frameSelector: parentFrameSelector };
    if (isUnderTest) {
      (window as any)._weakRecordersForTest = (window as any)._weakRecordersForTest || new Set();
      (window as any)._weakRecordersForTest.add(new WeakRef(recorder));
    }
  }
  if (win._recorder)
    recorders.push(win._recorder);

  for (let i = 0; i < frameWindow.frames.length; ++i) {
    const childFrame = frameWindow.frames[i];
    const frameSelector = childFrame.frameElement ? win._injectedScript.generateSelectorSimple(childFrame.frameElement, { omitInternalEngines: true, testIdAttributeName }) + ' >> internal:control=enter-frame >> ' : '';
    createRecorders(recorders, force, sdkLanguage, testIdAttributeName, isUnderTest, parentFrameSelector + frameSelector, childFrame);
  }
}

export type Snapshot = {
  action: ActionTraceEvent;
  snapshotName: string;
  point?: { x: number, y: number };
  hasInputTarget?: boolean;
};

export type SnapshotInfo = {
  url: string;
  viewport: { width: number, height: number };
  timestamp?: number;
  wallTime?: undefined;
};

export type Snapshots = {
  action?: Snapshot;
  before?: Snapshot;
  after?: Snapshot;
};

export type SnapshotUrls = {
  snapshotInfoUrl: string;
  snapshotUrl: string;
  popoutUrl: string;
};

export function collectSnapshots(action: ActionTraceEvent | undefined): Snapshots {
  if (!action)
    return {};

  let beforeSnapshot: Snapshot | undefined = action.beforeSnapshot ? { action, snapshotName: action.beforeSnapshot } : undefined;
  if (!beforeSnapshot) {
    // If the action has no beforeSnapshot, use the last available afterSnapshot.
    for (let a = previousActionByEndTime(action); a; a = previousActionByEndTime(a)) {
      if (a.endTime <= action.startTime && a.afterSnapshot) {
        beforeSnapshot = { action: a, snapshotName: a.afterSnapshot };
        break;
      }
    }
  }

  let afterSnapshot: Snapshot | undefined = action.afterSnapshot ? { action, snapshotName: action.afterSnapshot } : undefined;
  if (!afterSnapshot) {
    let last: ActionTraceEvent | undefined;
    // - For test.step, we want to use the snapshot of the last nested action.
    // - For a regular action, we use snapshot of any overlapping in time action
    //   as a best effort.
    // - If there are no "nested" actions, use the beforeSnapshot which works best
    //   for simple `expect(a).toBe(b);` case. Also if the action doesn't have
    //   afterSnapshot, it likely doesn't have its own beforeSnapshot either,
    //   and we calculated it above from a previous action.
    for (let a = nextActionByStartTime(action); a && a.startTime <= action.endTime; a = nextActionByStartTime(a)) {
      if (a.endTime > action.endTime || !a.afterSnapshot)
        continue;
      if (last && last.endTime > a.endTime)
        continue;
      last = a;
    }
    if (last)
      afterSnapshot = { action: last, snapshotName: last.afterSnapshot! };
    else
      afterSnapshot = beforeSnapshot;
  }

  const actionSnapshot: Snapshot | undefined = action.inputSnapshot ? { action, snapshotName: action.inputSnapshot, hasInputTarget: true } : afterSnapshot;
  if (actionSnapshot)
    actionSnapshot.point = action.point;
  return { action: actionSnapshot, before: beforeSnapshot, after: afterSnapshot };
}

const isUnderTest = new URLSearchParams(window.location.search).has('isUnderTest');
const serverParam = new URLSearchParams(window.location.search).get('server');

export function extendSnapshot(snapshot: Snapshot, shouldPopulateCanvasFromScreenshot: boolean): SnapshotUrls {
  const params = new URLSearchParams();
  params.set('trace', context(snapshot.action).traceUrl);
  params.set('name', snapshot.snapshotName);
  if (isUnderTest)
    params.set('isUnderTest', 'true');
  if (snapshot.point) {
    params.set('pointX', String(snapshot.point.x));
    params.set('pointY', String(snapshot.point.y));
    if (snapshot.hasInputTarget)
      params.set('hasInputTarget', '1');
  }
  if (shouldPopulateCanvasFromScreenshot)
    params.set('shouldPopulateCanvasFromScreenshot', '1');

  const snapshotUrl = new URL(`snapshot/${snapshot.action.pageId}?${params.toString()}`, window.location.href).toString();
  const snapshotInfoUrl = new URL(`snapshotInfo/${snapshot.action.pageId}?${params.toString()}`, window.location.href).toString();

  const popoutParams = new URLSearchParams();
  popoutParams.set('r', snapshotUrl);
  if (serverParam)
    popoutParams.set('server', serverParam);
  popoutParams.set('trace', context(snapshot.action).traceUrl);
  if (snapshot.point) {
    popoutParams.set('pointX', String(snapshot.point.x));
    popoutParams.set('pointY', String(snapshot.point.y));
    if (snapshot.hasInputTarget)
      params.set('hasInputTarget', '1');
  }
  const popoutUrl = new URL(`snapshot.html?${popoutParams.toString()}`, window.location.href).toString();
  return { snapshotInfoUrl, snapshotUrl, popoutUrl };
}

export async function fetchSnapshotInfo(snapshotInfoUrl: string | undefined) {
  const result = { url: '', viewport: kDefaultViewport, timestamp: undefined, wallTime: undefined };
  if (snapshotInfoUrl) {
    const response = await fetch(snapshotInfoUrl);
    const info = await response.json();
    if (!info.error) {
      result.url = info.url;
      result.viewport = info.viewport;
      result.timestamp = info.timestamp;
      result.wallTime = info.wallTime;
    }
  }
  return result;
}

export const kDefaultViewport = { width: 1280, height: 720 };
const kBlankSnapshotUrl = 'data:text/html,<body style="background: #ddd"></body>';
