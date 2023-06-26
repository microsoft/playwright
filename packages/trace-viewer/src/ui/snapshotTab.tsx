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
import { context, prevInList } from './modelUtil';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton } from '@web/components/toolbarButton';
import { copy, useMeasure } from '@web/uiUtils';
import { InjectedScript } from '@injected/injectedScript';
import { Recorder  } from '@injected/recorder';
import ConsoleAPI from '@injected/consoleApi';
import { asLocator } from '@isomorphic/locatorGenerators';
import type { Language } from '@isomorphic/locatorGenerators';
import { locatorOrSelectorAsSelector } from '@isomorphic/locatorParser';
import { TabbedPaneTab } from '@web/components/tabbedPane';

export const SnapshotTab: React.FunctionComponent<{
  action: ActionTraceEvent | undefined,
  sdkLanguage: Language,
  testIdAttributeName: string,
}> = ({ action, sdkLanguage, testIdAttributeName }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const [snapshotTab, setSnapshotTab] = React.useState<'action'|'before'|'after'>('action');
  const [isInspecting, setIsInspecting] = React.useState(false);
  const [highlightedLocator, setHighlightedLocator] = React.useState<string>('');
  const [pickerVisible, setPickerVisible] = React.useState(false);

  const { snapshots } = React.useMemo(() => {
    if (!action)
      return { snapshots: {} };

    // if the action has no beforeSnapshot, use the last available afterSnapshot.
    let beforeSnapshot = action.beforeSnapshot ? { action, snapshotName: action.beforeSnapshot } : undefined;
    let a = action;
    while (!beforeSnapshot && a) {
      a = prevInList(a);
      beforeSnapshot = a?.afterSnapshot ? { action: a, snapshotName: a?.afterSnapshot } : undefined;
    }
    const afterSnapshot = action.afterSnapshot ? { action, snapshotName: action.afterSnapshot } : beforeSnapshot;
    const actionSnapshot = action.inputSnapshot ? { action, snapshotName: action.inputSnapshot } : afterSnapshot;
    return { snapshots: { action: actionSnapshot, before: beforeSnapshot, after: afterSnapshot } };
  }, [action]);

  const { snapshotInfoUrl, snapshotUrl, pointX, pointY, popoutUrl } = React.useMemo(() => {
    const snapshot = snapshots[snapshotTab];
    if (!snapshot)
      return { snapshotUrl: kBlankSnapshotUrl };

    const params = new URLSearchParams();
    params.set('trace', context(snapshot.action).traceUrl);
    params.set('name', snapshot.snapshotName);
    const snapshotUrl = new URL(`snapshot/${snapshot.action.pageId}?${params.toString()}`, window.location.href).toString();
    const snapshotInfoUrl = new URL(`snapshotInfo/${snapshot.action.pageId}?${params.toString()}`, window.location.href).toString();

    const pointX = snapshotTab === 'action' ? snapshot.action.point?.x : undefined;
    const pointY = snapshotTab === 'action' ? snapshot.action.point?.y : undefined;
    const popoutParams = new URLSearchParams();
    popoutParams.set('r', snapshotUrl);
    popoutParams.set('trace', context(snapshot.action).traceUrl);
    const popoutUrl = new URL(`snapshot.html?${popoutParams.toString()}`, window.location.href).toString();
    return { snapshots, snapshotInfoUrl, snapshotUrl, pointX, pointY, popoutUrl };
  }, [snapshots, snapshotTab]);

  const iframeRef0 = React.useRef<HTMLIFrameElement>(null);
  const iframeRef1 = React.useRef<HTMLIFrameElement>(null);
  const [snapshotInfo, setSnapshotInfo] = React.useState({ viewport: kDefaultViewport, url: '' });
  const loadingRef = React.useRef({ iteration: 0, visibleIframe: 0 });

  React.useEffect(() => {
    (async () => {
      const thisIteration = loadingRef.current.iteration + 1;
      const newVisibleIframe = 1 - loadingRef.current.visibleIframe;
      loadingRef.current.iteration = thisIteration;

      const newSnapshotInfo = { url: '', viewport: kDefaultViewport };
      if (snapshotInfoUrl) {
        const response = await fetch(snapshotInfoUrl);
        const info = await response.json();
        if (!info.error) {
          newSnapshotInfo.url = info.url;
          newSnapshotInfo.viewport = info.viewport;
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

          const newUrl = snapshotUrl + (pointX === undefined ? '' : `&pointX=${pointX}&pointY=${pointY}`);
          // Try preventing history entry from being created.
          if (iframe.contentWindow)
            iframe.contentWindow.location.replace(newUrl);
          else
            iframe.src = newUrl;

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
  }, [snapshotUrl, snapshotInfoUrl, pointX, pointY]);

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
      <ToolbarButton title='Pick locator' disabled={!popoutUrl} toggled={pickerVisible} onClick={() => {
        setPickerVisible(!pickerVisible);
        setHighlightedLocator('');
        setIsInspecting(!pickerVisible);
      }}>Pick locator</ToolbarButton>
      {['action', 'before', 'after'].map(tab => {
        return <TabbedPaneTab
          id={tab}
          title={renderTitle(tab)}
          selected={snapshotTab === tab}
          onSelect={() => setSnapshotTab(tab as 'action' | 'before' | 'after')}
        ></TabbedPaneTab>;
      })}
      <div style={{ flex: 'auto' }}></div>
      <ToolbarButton icon='link-external' title='Open snapshot in a new tab' disabled={!popoutUrl} onClick={() => {
        const win = window.open(popoutUrl || '', '_blank');
        win?.addEventListener('DOMContentLoaded', () => {
          const injectedScript = new InjectedScript(win as any, false, sdkLanguage, testIdAttributeName, 1, 'chromium', []);
          new ConsoleAPI(injectedScript);
        });
      }}></ToolbarButton>
    </Toolbar>
    {pickerVisible && <Toolbar noMinHeight={true}>
      <ToolbarButton icon='microscope' title='Pick locator' disabled={!popoutUrl} toggled={isInspecting} onClick={() => {
        setIsInspecting(!isInspecting);
      }}></ToolbarButton>
      <CodeMirrorWrapper text={highlightedLocator} language={sdkLanguage} readOnly={!popoutUrl} focusOnChange={true} wrapLines={true} onChange={text => {
        // Updating text needs to go first - react can squeeze a render between the state updates.
        setHighlightedLocator(text);
        setIsInspecting(false);
      }}></CodeMirrorWrapper>
      <ToolbarButton icon='files' title='Copy locator' disabled={!popoutUrl} onClick={() => {
        copy(highlightedLocator);
      }}></ToolbarButton>
    </Toolbar>}
    <div ref={ref} className='snapshot-wrapper'>
      <div className='snapshot-container' style={{
        width: snapshotContainerSize.width + 'px',
        height: snapshotContainerSize.height + 'px',
        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
      }}>
        <div className='window-header'>
          <div style={{ whiteSpace: 'nowrap' }}>
            <span className='window-dot' style={{ backgroundColor: 'rgb(242, 95, 88)' }}></span>
            <span className='window-dot' style={{ backgroundColor: 'rgb(251, 190, 60)' }}></span>
            <span className='window-dot' style={{ backgroundColor: 'rgb(88, 203, 66)' }}></span>
          </div>
          <div className='window-address-bar' title={snapshotInfo.url || 'about:blank'}>{snapshotInfo.url || 'about:blank'}</div>
          <div style={{ marginLeft: 'auto' }}>
            <div>
              <span className='window-menu-bar'></span>
              <span className='window-menu-bar'></span>
              <span className='window-menu-bar'></span>
            </div>
          </div>
        </div>
        <div className='snapshot-switcher'>
          <iframe ref={iframeRef0} name='snapshot' className={loadingRef.current.visibleIframe === 0 ? 'snapshot-visible' : ''}></iframe>
          <iframe ref={iframeRef1} name='snapshot' className={loadingRef.current.visibleIframe === 1 ? 'snapshot-visible' : ''}></iframe>
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
    const win = iframe?.contentWindow as any;
    let recorder: Recorder | undefined;
    try {
      if (!win)
        return;
      recorder = win._recorder;
      if (!recorder && !isInspecting && !highlightedLocator)
        return;
    } catch {
      // Potential cross-origin exception when accessing win._recorder.
      return;
    }
    if (!recorder) {
      const injectedScript = new InjectedScript(win, false, sdkLanguage, testIdAttributeName, 1, 'chromium', []);
      recorder = new Recorder(injectedScript, {
        async setSelector(selector: string) {
          setHighlightedLocator(asLocator('javascript', selector, false /* isFrameLocator */, true /* playSafe */));
        }
      });
      win._recorder = recorder;
    }
    const actionSelector = locatorOrSelectorAsSelector(sdkLanguage, highlightedLocator, testIdAttributeName);
    recorder.setUIState({
      mode: isInspecting ? 'inspecting' : 'none',
      actionSelector,
      language: sdkLanguage,
      testIdAttributeName,
    });
  }, [iframe, isInspecting, highlightedLocator, setHighlightedLocator, sdkLanguage, testIdAttributeName, iteration]);
  return <></>;
};

const kDefaultViewport = { width: 1280, height: 720 };
const kBlankSnapshotUrl = 'data:text/html,<body style="background: #ddd"></body>';
