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
import { useMeasure } from './helpers';
import type { ActionTraceEvent } from '@trace/trace';
import { context, prevInList } from './modelUtil';
import { CodeMirrorWrapper } from '@web/components/codeMirrorWrapper';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton } from '@web/components/toolbarButton';
import { copy } from '@web/uiUtils';
import { InjectedScript } from '@injected/injectedScript';
import { Recorder  } from '@injected/recorder';
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
    const popoutUrl = new URL(`popout.html?${popoutParams.toString()}`, window.location.href).toString();
    return { snapshots, snapshotInfoUrl, snapshotUrl, pointX, pointY, popoutUrl };
  }, [snapshots, snapshotTab]);

  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [snapshotInfo, setSnapshotInfo] = React.useState({ viewport: kDefaultViewport, url: '' });
  React.useEffect(() => {
    (async () => {
      if (snapshotInfoUrl) {
        const response = await fetch(snapshotInfoUrl);
        const info = await response.json();
        if (!info.error)
          setSnapshotInfo(info);
      } else {
        setSnapshotInfo({ viewport: kDefaultViewport, url: '' });
      }
      if (!iframeRef.current)
        return;
      try {
        const newUrl = snapshotUrl + (pointX === undefined ? '' : `&pointX=${pointX}&pointY=${pointY}`);
        // Try preventing history entry from being created.
        if (iframeRef.current.contentWindow)
          iframeRef.current.contentWindow.location.replace(newUrl);
        else
          iframeRef.current.src = newUrl;
      } catch (e) {
      }
    })();
  }, [iframeRef, snapshotUrl, snapshotInfoUrl, pointX, pointY]);

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
      iframe={iframeRef.current} />
    <Toolbar>
      <ToolbarButton title='Pick locator' disabled={!popoutUrl} toggled={pickerVisible} onClick={() => {
        setPickerVisible(!pickerVisible);
        setHighlightedLocator('');
        setIsInspecting(!pickerVisible);
      }}>Pick locator</ToolbarButton>
      <div style={{ width: 5 }}></div>
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
        window.open(popoutUrl || '', '_blank');
      }}></ToolbarButton>
    </Toolbar>
    {pickerVisible && <Toolbar>
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
        <iframe ref={iframeRef} id='snapshot' name='snapshot'></iframe>
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
}> = ({ iframe, isInspecting, sdkLanguage, testIdAttributeName, highlightedLocator, setHighlightedLocator }) => {
  React.useEffect(() => {
    const win = iframe?.contentWindow as any;
    try {
      if (!win || !isInspecting && !highlightedLocator && !win._recorder)
        return;
    } catch {
      // Potential cross-origin exception.
      return;
    }
    let recorder: Recorder | undefined = win._recorder;
    if (!recorder) {
      const injectedScript = new InjectedScript(win, false, sdkLanguage, testIdAttributeName, 1, 'chromium', []);
      recorder = new Recorder(injectedScript, {
        async setSelector(selector: string) {
          recorder!.setUIState({ mode: 'none', language: sdkLanguage, testIdAttributeName });
          setHighlightedLocator(asLocator('javascript', selector, false));
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
  }, [iframe, isInspecting, highlightedLocator, setHighlightedLocator, sdkLanguage, testIdAttributeName]);
  return <></>;
};

const kDefaultViewport = { width: 1280, height: 720 };
const kBlankSnapshotUrl = 'data:text/html,<body style="background: #ddd"></body>';
