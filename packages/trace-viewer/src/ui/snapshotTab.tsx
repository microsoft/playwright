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
import { context, type MultiTraceModel, pageForAction, prevInList } from './modelUtil';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton } from '@web/components/toolbarButton';
import { clsx, useMeasure, useSetting } from '@web/uiUtils';
import { InjectedScript } from '@injected/injectedScript';
import { Recorder } from '@injected/recorder/recorder';
import ConsoleAPI from '@injected/consoleApi';
import { asLocator } from '@isomorphic/locatorGenerators';
import type { Language } from '@isomorphic/locatorGenerators';
import { locatorOrSelectorAsSelector } from '@isomorphic/locatorParser';
import { TabbedPaneTab } from '@web/components/tabbedPane';
import { BrowserFrame } from './browserFrame';
import { ClickPointer } from './clickPointer';

function findClosest<T>(items: T[], metric: (v: T) => number, target: number) {
  return items.find((item, index) => {
    if (index === items.length - 1)
      return true;
    const next = items[index + 1];
    return Math.abs(metric(item) - target) < Math.abs(metric(next) - target);
  });
}

export const SnapshotTab: React.FunctionComponent<{
  action: ActionTraceEvent | undefined,
  model?: MultiTraceModel,
  sdkLanguage: Language,
  testIdAttributeName: string,
  isInspecting: boolean,
  setIsInspecting: (isInspecting: boolean) => void,
  highlightedLocator: string,
  setHighlightedLocator: (locator: string) => void,
  openPage?: (url: string, target?: string) => Window | any,
}> = ({ action, model, sdkLanguage, testIdAttributeName, isInspecting, setIsInspecting, highlightedLocator, setHighlightedLocator, openPage }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const [snapshotTab, setSnapshotTab] = React.useState<'action'|'before'|'after'>('action');
  const [showScreenshotInsteadOfSnapshot] = useSetting('screenshot-instead-of-snapshot', false);

  type Snapshot = { action: ActionTraceEvent, snapshotName: string, point?: { x: number, y: number }, hasInputTarget?: boolean };
  const { snapshots } = React.useMemo(() => {
    if (!action)
      return { snapshots: {} };

    // if the action has no beforeSnapshot, use the last available afterSnapshot.
    let beforeSnapshot: Snapshot | undefined = action.beforeSnapshot ? { action, snapshotName: action.beforeSnapshot } : undefined;
    let a = action;
    while (!beforeSnapshot && a) {
      a = prevInList(a);
      beforeSnapshot = a?.afterSnapshot ? { action: a, snapshotName: a?.afterSnapshot } : undefined;
    }
    const afterSnapshot: Snapshot | undefined = action.afterSnapshot ? { action, snapshotName: action.afterSnapshot } : beforeSnapshot;
    const actionSnapshot: Snapshot | undefined = action.inputSnapshot ? { action, snapshotName: action.inputSnapshot, hasInputTarget: true } : afterSnapshot;
    if (actionSnapshot)
      actionSnapshot.point = action.point;
    return { snapshots: { action: actionSnapshot, before: beforeSnapshot, after: afterSnapshot } };
  }, [action]);

  const { snapshotInfoUrl, snapshotUrl, popoutUrl, point } = React.useMemo(() => {
    const snapshot = snapshots[snapshotTab];
    if (!snapshot)
      return { snapshotUrl: kBlankSnapshotUrl };

    const params = new URLSearchParams();
    params.set('trace', context(snapshot.action).traceUrl);
    params.set('name', snapshot.snapshotName);
    if (snapshot.point) {
      params.set('pointX', String(snapshot.point.x));
      params.set('pointY', String(snapshot.point.y));
      if (snapshot.hasInputTarget)
        params.set('hasInputTarget', '1');
    }
    const snapshotUrl = new URL(`snapshot/${snapshot.action.pageId}?${params.toString()}`, window.location.href).toString();
    const snapshotInfoUrl = new URL(`snapshotInfo/${snapshot.action.pageId}?${params.toString()}`, window.location.href).toString();

    const popoutParams = new URLSearchParams();
    popoutParams.set('r', snapshotUrl);
    popoutParams.set('trace', context(snapshot.action).traceUrl);
    if (snapshot.point) {
      popoutParams.set('pointX', String(snapshot.point.x));
      popoutParams.set('pointY', String(snapshot.point.y));
      if (snapshot.hasInputTarget)
        params.set('hasInputTarget', '1');
    }
    const popoutUrl = new URL(`snapshot.html?${popoutParams.toString()}`, window.location.href).toString();
    return { snapshots, snapshotInfoUrl, snapshotUrl, popoutUrl, point: snapshot.point };
  }, [snapshots, snapshotTab]);

  const iframeRef0 = React.useRef<HTMLIFrameElement>(null);
  const iframeRef1 = React.useRef<HTMLIFrameElement>(null);
  const [snapshotInfo, setSnapshotInfo] = React.useState<{ viewport: typeof kDefaultViewport, url: string, timestamp?: number, wallTime?: undefined }>({ viewport: kDefaultViewport, url: '' });
  const loadingRef = React.useRef({ iteration: 0, visibleIframe: 0 });

  React.useEffect(() => {
    (async () => {
      const thisIteration = loadingRef.current.iteration + 1;
      const newVisibleIframe = 1 - loadingRef.current.visibleIframe;
      loadingRef.current.iteration = thisIteration;

      const newSnapshotInfo = { url: '', viewport: kDefaultViewport, timestamp: undefined, wallTime: undefined };
      if (snapshotInfoUrl) {
        const response = await fetch(snapshotInfoUrl);
        const info = await response.json();
        if (!info.error) {
          newSnapshotInfo.url = info.url;
          newSnapshotInfo.viewport = info.viewport;
          newSnapshotInfo.timestamp = info.timestamp;
          newSnapshotInfo.wallTime = info.wallTime;
        }
      }

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
  }, [snapshotUrl, snapshotInfoUrl]);

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

  const page = action ? pageForAction(action) : undefined;
  const screencastFrame = React.useMemo(
      () => {
        if (snapshotInfo.wallTime && page?.screencastFrames[0]?.frameSwapWallTime)
          return findClosest(page.screencastFrames, frame => frame.frameSwapWallTime!, snapshotInfo.wallTime);

        if (snapshotInfo.timestamp && page?.screencastFrames)
          return findClosest(page.screencastFrames, frame => frame.timestamp, snapshotInfo.timestamp);
      },
      [page?.screencastFrames, snapshotInfo.timestamp, snapshotInfo.wallTime]
  );

  return <div
    className='snapshot-tab'
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
      highlightedLocator={highlightedLocator}
      setHighlightedLocator={setHighlightedLocator}
      iframe={iframeRef0.current}
      iteration={loadingRef.current.iteration} />
    <InspectModeController
      isInspecting={isInspecting}
      sdkLanguage={sdkLanguage}
      testIdAttributeName={testIdAttributeName}
      highlightedLocator={highlightedLocator}
      setHighlightedLocator={setHighlightedLocator}
      iframe={iframeRef1.current}
      iteration={loadingRef.current.iteration} />
    <Toolbar>
      <ToolbarButton className='pick-locator' title={showScreenshotInsteadOfSnapshot ? 'Disable "screenshots instead of snapshots" to pick a locator' : 'Pick locator'} icon='target' toggled={isInspecting} onClick={() => setIsInspecting(!isInspecting)} disabled={showScreenshotInsteadOfSnapshot} />
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
      <ToolbarButton icon='link-external' title={showScreenshotInsteadOfSnapshot ? 'Not available when showing screenshot' : 'Open snapshot in a new tab'} disabled={!popoutUrl || showScreenshotInsteadOfSnapshot} onClick={() => {
        if (!openPage)
          openPage = window.open;
        const win = openPage(popoutUrl || '', '_blank');
        win?.addEventListener('DOMContentLoaded', () => {
          const injectedScript = new InjectedScript(win as any, false, sdkLanguage, testIdAttributeName, 1, 'chromium', []);
          new ConsoleAPI(injectedScript);
        });
      }}></ToolbarButton>
    </Toolbar>
    <div ref={ref} className='snapshot-wrapper'>
      <div className='snapshot-container' style={{
        width: snapshotContainerSize.width + 'px',
        height: snapshotContainerSize.height + 'px',
        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
      }}>
        <BrowserFrame url={snapshotInfo.url} />
        {(showScreenshotInsteadOfSnapshot && screencastFrame) && (
          <>
            {point && <ClickPointer point={point} />}
            <img alt={`Screenshot of ${action?.apiName} > ${renderTitle(snapshotTab)}`} src={`sha1/${screencastFrame.sha1}`} width={screencastFrame.width} height={screencastFrame.height} />
          </>
        )}
        <div className='snapshot-switcher' style={showScreenshotInsteadOfSnapshot ? { display: 'none' } : undefined}>
          <iframe ref={iframeRef0} name='snapshot' title='DOM Snapshot' className={clsx(loadingRef.current.visibleIframe === 0 && 'snapshot-visible')}></iframe>
          <iframe ref={iframeRef1} name='snapshot' title='DOM Snapshot' className={clsx(loadingRef.current.visibleIframe === 1 && 'snapshot-visible')}></iframe>
        </div>
      </div>
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
  highlightedLocator: string,
  setHighlightedLocator: (locator: string) => void,
  iteration: number,
}> = ({ iframe, isInspecting, sdkLanguage, testIdAttributeName, highlightedLocator, setHighlightedLocator, iteration }) => {
  React.useEffect(() => {
    const recorders: { recorder: Recorder, frameSelector: string }[] = [];
    const isUnderTest = new URLSearchParams(window.location.search).get('isUnderTest') === 'true';
    try {
      createRecorders(recorders, sdkLanguage, testIdAttributeName, isUnderTest, '', iframe?.contentWindow);
    } catch {
      // Potential cross-origin exceptions.
    }

    for (const { recorder, frameSelector } of recorders) {
      const actionSelector = locatorOrSelectorAsSelector(sdkLanguage, highlightedLocator, testIdAttributeName);
      recorder.setUIState({
        mode: isInspecting ? 'inspecting' : 'none',
        actionSelector: actionSelector.startsWith(frameSelector) ? actionSelector.substring(frameSelector.length).trim() : undefined,
        language: sdkLanguage,
        testIdAttributeName,
        overlay: { offsetX: 0 },
      }, {
        async setSelector(selector: string) {
          setHighlightedLocator(asLocator(sdkLanguage, frameSelector + selector));
        },
        highlightUpdated() {
          for (const r of recorders) {
            if (r.recorder !== recorder)
              r.recorder.clearHighlight();
          }
        }
      });
    }
  }, [iframe, isInspecting, highlightedLocator, setHighlightedLocator, sdkLanguage, testIdAttributeName, iteration]);
  return <></>;
};

function createRecorders(recorders: { recorder: Recorder, frameSelector: string }[], sdkLanguage: Language, testIdAttributeName: string, isUnderTest: boolean, parentFrameSelector: string, frameWindow: Window | null | undefined) {
  if (!frameWindow)
    return;
  const win = frameWindow as any;
  if (!win._recorder) {
    const injectedScript = new InjectedScript(frameWindow as any, isUnderTest, sdkLanguage, testIdAttributeName, 1, 'chromium', []);
    const recorder = new Recorder(injectedScript);
    win._injectedScript = injectedScript;
    win._recorder = { recorder, frameSelector: parentFrameSelector };
  }
  recorders.push(win._recorder);

  for (let i = 0; i < frameWindow.frames.length; ++i) {
    const childFrame = frameWindow.frames[i];
    const frameSelector = childFrame.frameElement ? win._injectedScript.generateSelectorSimple(childFrame.frameElement, { omitInternalEngines: true, testIdAttributeName }) + ' >> internal:control=enter-frame >> ' : '';
    createRecorders(recorders, sdkLanguage, testIdAttributeName, isUnderTest, parentFrameSelector + frameSelector, childFrame);
  }
}

const kDefaultViewport = { width: 1280, height: 720 };
const kBlankSnapshotUrl = 'data:text/html,<body style="background: #ddd"></body>';
