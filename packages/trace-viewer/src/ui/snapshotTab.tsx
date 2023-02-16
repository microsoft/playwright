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
import { context } from './modelUtil';
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
  const [mode, setMode] = React.useState<'none' | 'inspecting'>('none');
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const [snapshotIndex, setSnapshotIndex] = React.useState(0);
  const [locator, setLocator] = React.useState<string>('');
  const [pickerVisible, setPickerVisible] = React.useState(false);

  const snapshotMap = new Map<string, { title: string, snapshotName: string }>();
  for (const snapshot of action?.metadata.snapshots || [])
    snapshotMap.set(snapshot.title, snapshot);
  const actionSnapshot = snapshotMap.get('action') || snapshotMap.get('after');
  const snapshots = [actionSnapshot ? { ...actionSnapshot, title: 'action' } : undefined, snapshotMap.get('before'), snapshotMap.get('after')].filter(Boolean) as { title: string, snapshotName: string }[];

  let snapshotUrl = 'data:text/html,<body style="background: #ddd"></body>';
  let popoutUrl: string | undefined;
  let snapshotInfoUrl: string | undefined;
  let pointX: number | undefined;
  let pointY: number | undefined;
  if (action) {
    const snapshot = snapshots[snapshotIndex];
    if (snapshot && snapshot.snapshotName) {
      const params = new URLSearchParams();
      params.set('trace', context(action).traceUrl);
      params.set('name', snapshot.snapshotName);
      snapshotUrl = new URL(`snapshot/${action.metadata.pageId}?${params.toString()}`, window.location.href).toString();
      snapshotInfoUrl = new URL(`snapshotInfo/${action.metadata.pageId}?${params.toString()}`, window.location.href).toString();
      if (snapshot.snapshotName.includes('action')) {
        pointX = action.metadata.point?.x;
        pointY = action.metadata.point?.y;
      }
      const popoutParams = new URLSearchParams();
      popoutParams.set('r', snapshotUrl);
      popoutParams.set('trace', context(action).traceUrl);
      popoutUrl = new URL(`popout.html?${popoutParams.toString()}`, window.location.href).toString();
    }
  }

  React.useEffect(() => {
    if (snapshots.length >= 1 && snapshotIndex >= snapshots.length)
      setSnapshotIndex(snapshots.length - 1);
  }, [snapshotIndex, snapshots]);

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
        iframeRef.current.src = snapshotUrl + (pointX === undefined ? '' : `&pointX=${pointX}&pointY=${pointY}`);
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

  const recorderGetter = () => {
    if (!iframeRef.current)
      return;
    return getOrCreateRecorder(iframeRef.current.contentWindow!, true, sdkLanguage, testIdAttributeName, locator => {
      setLocator(locator);
      setMode('none');
    });
  };

  return <div
    className='snapshot-tab'
    tabIndex={0}
    onKeyDown={event => {
      if (event.key === 'ArrowRight')
        setSnapshotIndex(Math.min(snapshotIndex + 1, snapshots.length - 1));
      if (event.key === 'ArrowLeft')
        setSnapshotIndex(Math.max(snapshotIndex - 1, 0));
    }}
  >
    <Toolbar>
      <ToolbarButton title='Pick locator' disabled={!popoutUrl} toggled={pickerVisible} onClick={() => {
        setPickerVisible(!pickerVisible);
        setMode(mode === 'inspecting' ? 'none' : 'inspecting');
        const recorder = recorderGetter();
        recorder?.setUIState({ mode: pickerVisible ? 'none' : 'inspecting', language: sdkLanguage, testIdAttributeName });
      }}>Pick locator</ToolbarButton>
      <div style={{ width: 5 }}></div>
      {snapshots.map((snapshot, index) => {
        return <TabbedPaneTab
          id={snapshot.title}
          title={renderTitle(snapshot.title)}
          selected={snapshotIndex === index}
          onSelect={() => setSnapshotIndex(index)}
        ></TabbedPaneTab>;
      })}
      <div style={{ flex: 'auto' }}></div>
      <ToolbarButton icon='link-external' title='Open snapshot in a new tab' disabled={!popoutUrl} onClick={() => {
        window.open(popoutUrl || '', '_blank');
      }}></ToolbarButton>
    </Toolbar>
    {pickerVisible && <Toolbar>
      <ToolbarButton icon='microscope' title='Pick locator' disabled={!popoutUrl} toggled={mode === 'inspecting'} onClick={() => {
        setMode(mode === 'inspecting' ? 'none' : 'inspecting');
        const recorder = recorderGetter();
        recorder?.setUIState({ mode: mode === 'inspecting' ? 'none' : 'inspecting', language: sdkLanguage, testIdAttributeName });
      }}></ToolbarButton>
      <CodeMirrorWrapper text={locator} language={sdkLanguage} readOnly={!popoutUrl} focusOnChange={true} wrapLines={true} onChange={text => {
        const recorder = recorderGetter();
        const actionSelector = locatorOrSelectorAsSelector(sdkLanguage, text, testIdAttributeName);
        recorder?.setUIState({ mode: 'none', language: sdkLanguage, testIdAttributeName, actionSelector });
        setLocator(text);
      }}></CodeMirrorWrapper>
      <ToolbarButton icon='files' title='Copy locator' disabled={!popoutUrl} onClick={() => {
        copy(locator);
      }}></ToolbarButton>
    </Toolbar>}
    <div ref={ref} className='snapshot-wrapper'>
      { snapshots.length ? <div className='snapshot-container' style={{
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
      </div> : <div className='no-snapshot'>Action does not have snapshots</div>
      }
    </div>
  </div>;
};

function getOrCreateRecorder(contentWindow: Window, enabled: boolean, sdkLanguage: Language, testIdAttributeName: string, setLocator: (locator: string) => void): Recorder | undefined {
  const win = contentWindow as any;
  if (!enabled && !win._recorder)
    return;
  let recorder: Recorder | undefined = win._recorder;

  if (!recorder) {
    const injectedScript = new InjectedScript(contentWindow as any, false, sdkLanguage, testIdAttributeName, 1, 'chromium', []);
    recorder = new Recorder(injectedScript, {
      async setSelector(selector: string) {
        recorder!.setUIState({ mode: 'none', language: sdkLanguage, testIdAttributeName });
        setLocator(asLocator('javascript', selector, false));
      }
    });
    win._recorder = recorder;
  }
  return recorder;
}

function renderTitle(snapshotTitle: string): string {
  if (snapshotTitle === 'before')
    return 'Before';
  if (snapshotTitle === 'after')
    return 'After';
  if (snapshotTitle === 'action')
    return 'Action';
  return snapshotTitle;
}

const kDefaultViewport = { width: 1280, height: 720 };
