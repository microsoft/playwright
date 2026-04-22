/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import './dashboard.css';
import { DashboardClientContext } from './dashboardContext';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, LockIcon, LockOpenIcon, ReloadIcon, ScreenshotRegionIcon } from './icons';
import { Annotations, getImageLayout, clientToViewport } from './annotations';

import type { Annotation, AnnotationsHandle } from './annotations';
import { ToolbarButton, ToolbarSeparator } from '@web/components/toolbarButton';
import { useMeasureForRef } from '@web/uiUtils';

import type { Tab, DashboardChannelEvents } from './dashboardChannel';

const BUTTONS = ['left', 'middle', 'right'] as const;
type Mode = 'readonly' | 'interactive' | 'annotate';

// Recording mode is a separate, mode-replacing overlay similar to annotate.
// While null, the normal toolbar is shown. When non-null, the recording
// toolbar replaces it.
type RecordingState =
  | { phase: 'recording' }
  | { phase: 'stopped'; blob: Blob; url: string };

type DashboardState = {
  // Server-driven session state.
  tabs: Tab[] | null;
  url: string;
  // The latest frame received from the server. Cleared on page swap;
  // the server is responsible for emitting a fresh frame for the new
  // page (see _startScreencast).
  liveFrame: DashboardChannelEvents['frame'] | undefined;
  // Snapshot of the frame at the moment we entered annotate mode. The
  // <Annotations> overlay draws on this frozen image so the canvas does
  // not jump around as new live frames arrive.
  annotateFrame: DashboardChannelEvents['frame'] | undefined;
  // Server requested annotate but we have no fresh frame for the active
  // page. The next FRAME action will enter annotate mode.
  cliAnnotatePending: boolean;
  // Whether the current annotate session was initiated by CLI or by the
  // user. Determines whether submit goes to the server or saves locally.
  annotateInitiator: 'cli' | 'user' | null;
  // Interaction mode and ephemeral UI flags.
  mode: Mode;
  recording: RecordingState | null;
};

type DashboardAction =
  // Server events
  | { type: 'tabs'; tabs: Tab[] }
  | { type: 'frame'; frame: DashboardChannelEvents['frame'] }
  | { type: 'cliAnnotate' }
  | { type: 'cliCancelAnnotate' }
  // User events
  | { type: 'toggleInteractive' }
  | { type: 'toggleAnnotate' }
  | { type: 'startRecording' }
  | { type: 'stoppedRecording'; blob: Blob; url: string }
  | { type: 'exitRecording' }
  | { type: 'submitAnnotation' }
  | { type: 'setUrl'; url: string };

const initialDashboardState: DashboardState = {
  tabs: null,
  url: '',
  liveFrame: undefined,
  annotateFrame: undefined,
  cliAnnotatePending: false,
  annotateInitiator: null,
  mode: 'readonly',
  recording: null,
};

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'tabs': {
      const newSelected = action.tabs.find(t => t.selected);
      const oldSelected = state.tabs?.find(t => t.selected);
      const url = newSelected ? newSelected.url : state.url;
      // Page change = had a selected tab, now have a different selected
      // tab. Initial selection (none -> some) is not a "change".
      const pageChanged = !!oldSelected && !!newSelected && newSelected.page !== oldSelected.page;
      if (!pageChanged)
        return { ...state, tabs: action.tabs, url };
      // Page swap. Clear frames and rely on the server to emit a fresh
      // frame for the new page (see _startScreencast which awaits a
      // screenshot to force one). If we were annotating, mark pending so
      // the next FRAME re-enters annotate with the new page's image.
      const wasAnnotateActive = state.mode === 'annotate' || state.cliAnnotatePending;
      const newTabIsBrandNew = !!state.tabs && !state.tabs.some(t => t.page === newSelected.page);
      let mode: Mode = state.mode;
      if (!wasAnnotateActive && newTabIsBrandNew && state.tabs)
        mode = 'interactive';
      return {
        ...state,
        tabs: action.tabs,
        url,
        mode,
        recording: null,
        liveFrame: undefined,
        annotateFrame: undefined,
        cliAnnotatePending: wasAnnotateActive,
      };
    }
    case 'frame': {
      const liveFrame = action.frame;
      if (state.cliAnnotatePending) {
        return {
          ...state,
          liveFrame,
          annotateFrame: liveFrame,
          mode: 'annotate',
          cliAnnotatePending: false,
          annotateInitiator: state.annotateInitiator ?? 'cli',
        };
      }
      return { ...state, liveFrame };
    }
    case 'cliAnnotate': {
      if (state.mode === 'annotate') {
        // Already annotating (user-initiated). Mark CLI as the source so
        // submit goes to the server.
        return { ...state, annotateInitiator: 'cli' };
      }
      if (state.liveFrame) {
        return {
          ...state,
          mode: 'annotate',
          annotateFrame: state.liveFrame,
          cliAnnotatePending: false,
          annotateInitiator: 'cli',
        };
      }
      return { ...state, cliAnnotatePending: true, annotateInitiator: 'cli' };
    }
    case 'cliCancelAnnotate': {
      const exitingAnnotate = state.mode === 'annotate';
      return {
        ...state,
        mode: exitingAnnotate ? 'readonly' : state.mode,
        annotateFrame: undefined,
        cliAnnotatePending: false,
        annotateInitiator: null,
      };
    }
    case 'toggleInteractive': {
      const next: Mode = state.mode === 'interactive' ? 'readonly' : 'interactive';
      return { ...state, mode: next };
    }
    case 'toggleAnnotate': {
      if (state.mode === 'annotate') {
        return {
          ...state,
          mode: 'readonly',
          annotateFrame: undefined,
          annotateInitiator: null,
        };
      }
      if (!state.liveFrame)
        return state;
      // Preserve a CLI initiator across mode toggles so that CLI annotate
      // sessions stay engaged when the user switches to interactive and
      // back. Only set 'user' if there was no prior CLI engagement.
      const initiator: 'cli' | 'user' | null = state.annotateInitiator ?? 'user';
      return {
        ...state,
        mode: 'annotate',
        annotateFrame: state.liveFrame,
        cliAnnotatePending: false,
        annotateInitiator: initiator,
      };
    }
    case 'startRecording':
      return { ...state, recording: { phase: 'recording' } };
    case 'stoppedRecording':
      return { ...state, recording: { phase: 'stopped', blob: action.blob, url: action.url } };
    case 'exitRecording':
      return { ...state, recording: null };
    case 'submitAnnotation':
      return {
        ...state,
        mode: 'readonly',
        annotateFrame: undefined,
        cliAnnotatePending: false,
        annotateInitiator: null,
      };
    case 'setUrl':
      return { ...state, url: action.url };
  }
}

async function pickSaveWritable(suggestedName: string, description: string, mime: string, extension: string): Promise<FileSystemWritableFileStream | null> {
  try {
    const handle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: [{ description, accept: { [mime]: [extension] } }],
    });
    return await handle.createWritable();
  } catch {
    return null;
  }
}

function base64ToBlob(base64: string, mime: string): Blob {
  return new Blob([(Uint8Array as any).fromBase64(base64)], { type: mime });
}

function smartUrl(input: string): string {
  const value = input.trim();
  if (!value)
    return value;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith('about:') || value.startsWith('data:'))
    return value;
  const host = value.split(/[/?#]/, 1)[0];
  const hasDot = host.includes('.');
  const isLocalhost = /^localhost(:\d+)?$/i.test(host);
  const hasPort = /:\d+$/.test(host);
  const isIp = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host);
  if (isLocalhost || isIp || (hasPort && !hasDot))
    return 'http://' + value;
  if (hasDot || hasPort)
    return 'https://' + value;
  return 'https://' + host + '.com' + value.slice(host.length);
}

export const Dashboard: React.FC = () => {
  const client = React.useContext(DashboardClientContext);
  const [state, dispatch] = React.useReducer(dashboardReducer, initialDashboardState);
  const { tabs, url, mode, recording, liveFrame, annotateFrame, annotateInitiator } = state;
  const interactive = mode === 'interactive';
  const annotating = mode === 'annotate';

  const [flashTick, setFlashTick] = React.useState(0);
  const [annotationCount, setAnnotationCount] = React.useState(0);

  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const annotateViewRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const viewportMainRef = React.useRef<HTMLDivElement>(null);
  const browserChromeRef = React.useRef<HTMLDivElement>(null);
  const interactiveBtnRef = React.useRef<HTMLButtonElement>(null);
  const annotationsRef = React.useRef<AnnotationsHandle>(null);
  const moveThrottleRef = React.useRef(0);

  const aspect = liveFrame && liveFrame.viewportWidth && liveFrame.viewportHeight
    ? liveFrame.viewportWidth / liveFrame.viewportHeight
    : null;

  const [viewportRect] = useMeasureForRef(viewportMainRef);

  // Active recording hides the browser chrome so the viewport matches what's
  // being captured (mirroring annotate mode's chrome-less frame).
  const showBrowserChrome = recording?.phase !== 'recording';

  const windowStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    const OUTER_MARGIN = 24;
    const chromeHeight = showBrowserChrome ? (browserChromeRef.current?.offsetHeight ?? 40) : 0;
    const availW = viewportRect.width - OUTER_MARGIN;
    const availH = viewportRect.height - OUTER_MARGIN;
    if (availW <= 0 || availH <= 0)
      return undefined;
    if (aspect === null)
      return { width: availW, height: availH };
    const screenH = availH - chromeHeight;
    let w = availW;
    let h = w / aspect;
    if (h > screenH) {
      h = screenH;
      w = h * aspect;
    }
    return { width: w, height: h + chromeHeight };
  }, [viewportRect, aspect, showBrowserChrome]);

  React.useEffect(() => {
    if (flashTick === 0)
      return;
    const btn = interactiveBtnRef.current;
    if (!btn)
      return;
    btn.classList.remove('flash');
    // Force a reflow so that re-adding the class restarts the animation.
    void btn.offsetWidth;
    btn.classList.add('flash');
    const timer = setTimeout(() => btn.classList.remove('flash'), 2000);
    return () => {
      clearTimeout(timer);
      btn.classList.remove('flash');
    };
  }, [flashTick]);

  React.useEffect(() => {
    if (interactive)
      interactiveBtnRef.current?.classList.remove('flash');
  }, [interactive]);

  const onSubmitAnnotations = React.useCallback(async (blob: Blob, annotations: Annotation[]) => {
    if (!client)
      return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
    await client.submitAnnotation({
      data,
      annotations: annotations.map(a => ({ x: a.x, y: a.y, width: a.width, height: a.height, text: a.text })),
    });
    dispatch({ type: 'submitAnnotation' });
  }, [client]);

  function flashInteractiveHint() {
    setFlashTick(tick => tick + 1);
  }

  const onStartRecording = React.useCallback(async () => {
    if (!client)
      return;
    await client.startRecording();
    dispatch({ type: 'startRecording' });
  }, [client]);

  const onStopRecording = React.useCallback(async () => {
    if (!client)
      return;
    const { streamId } = await client.stopRecording();
    const chunks: Blob[] = [];
    while (true) {
      const { data, eof } = await client.readStream({ streamId });
      if (data)
        chunks.push(base64ToBlob(data, 'video/webm'));
      if (eof)
        break;
    }
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    dispatch({ type: 'stoppedRecording', blob, url });
  }, [client]);

  const onSaveRecording = React.useCallback(async () => {
    if (state.recording?.phase !== 'stopped')
      return;
    const writable = await pickSaveWritable(`playwright-recording-${Date.now()}.webm`, 'WebM Video', 'video/webm', '.webm');
    if (!writable)
      return;
    await writable.write(state.recording.blob);
    await writable.close();
  }, [state.recording]);

  const onExitRecording = React.useCallback(async () => {
    if (state.recording?.phase === 'recording' && client) {
      // Drain the stream without persisting; keeps the server clean.
      const { streamId } = await client.stopRecording();
      while (true) {
        const { eof } = await client.readStream({ streamId });
        if (eof)
          break;
      }
    }
    if (state.recording?.phase === 'stopped')
      URL.revokeObjectURL(state.recording.url);
    dispatch({ type: 'exitRecording' });
  }, [state.recording, client]);


  React.useEffect(() => {
    if (!client)
      return;
    let resized = false;
    const onTabs = (params: DashboardChannelEvents['tabs']) => {
      dispatch({ type: 'tabs', tabs: params.tabs });
    };
    const onFrame = (params: DashboardChannelEvents['frame']) => {
      dispatch({ type: 'frame', frame: params });
      const toolbar = toolbarRef.current;
      if (!resized && toolbar && params.viewportWidth && params.viewportHeight) {
        resized = true;
        const chromeHeight = toolbar.offsetHeight;
        const extraW = window.outerWidth - window.innerWidth;
        const extraH = window.outerHeight - window.innerHeight;
        const targetW = Math.min(params.viewportWidth + extraW, screen.availWidth);
        const targetH = Math.min(params.viewportHeight + chromeHeight + extraH, screen.availHeight);
        window.resizeTo(targetW, targetH);
      }
    };
    const onAnnotate = () => dispatch({ type: 'cliAnnotate' });
    const onCancelAnnotate = () => dispatch({ type: 'cliCancelAnnotate' });
    client.on('tabs', onTabs);
    client.on('frame', onFrame);
    client.on('annotate', onAnnotate);
    client.on('cancelAnnotate', onCancelAnnotate);
    return () => {
      client.off('tabs', onTabs);
      client.off('frame', onFrame);
      client.off('annotate', onAnnotate);
      client.off('cancelAnnotate', onCancelAnnotate);
    };
  }, [client]);

  const selectedTab = tabs?.find(t => t.selected);
  const ready = !!client && !!selectedTab;

  function imgCoords(e: React.MouseEvent): { x: number; y: number } {
    const vw = liveFrame?.viewportWidth ?? 0;
    const vh = liveFrame?.viewportHeight ?? 0;
    if (!vw || !vh)
      return { x: 0, y: 0 };
    const layout = getImageLayout(displayRef.current);
    if (!layout)
      return { x: 0, y: 0 };
    return clientToViewport(layout, vw, vh, e.clientX, e.clientY);
  }

  function sendMouseEvent(method: 'mousedown' | 'mouseup', e: React.MouseEvent) {
    if (!client)
      return;
    const { x, y } = imgCoords(e);
    client[method]({ x, y, button: BUTTONS[e.button] || 'left' });
  }

  function onScreenMouseDown(e: React.MouseEvent) {
    if (annotating)
      return;
    e.preventDefault();
    screenRef.current?.focus();
    if (!ready)
      return;
    if (!interactive) {
      flashInteractiveHint();
      return;
    }
    sendMouseEvent('mousedown', e);
  }

  function onScreenMouseUp(e: React.MouseEvent) {
    if (annotating || !interactive)
      return;
    e.preventDefault();
    sendMouseEvent('mouseup', e);
  }

  function onScreenMouseMove(e: React.MouseEvent) {
    if (annotating || !interactive || !client)
      return;
    const now = Date.now();
    if (now - moveThrottleRef.current < 32)
      return;
    moveThrottleRef.current = now;
    const { x, y } = imgCoords(e);
    client.mousemove({ x, y });
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (annotating || !interactive || !client)
      return;
    e.preventDefault();
    client.wheel({ deltaX: e.deltaX, deltaY: e.deltaY });
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (annotating)
      return;
    if (!interactive || !client)
      return;
    e.preventDefault();
    client.keydown({ key: e.key });
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (annotating || !interactive || !client)
      return;
    e.preventDefault();
    client.keyup({ key: e.key });
  }

  function onOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const value = smartUrl((e.target as HTMLInputElement).value);
      dispatch({ type: 'setUrl', url: value });
      client?.navigate({ url: value });
      e.currentTarget.blur();
    }
  }

  let overlayText: string | undefined;
  if (!client)
    overlayText = 'Disconnected';
  else if (!selectedTab)
    overlayText = 'Select a session';

  return (
    <div className={'dashboard-view' + (interactive ? ' interactive' : '') + (annotating ? ' annotate' : '') + (recording ? ' recording' : '')}>
      {/* Toolbar */}
      <div ref={toolbarRef} className='toolbar'>
        {annotating ? (
          <>
            {annotateInitiator === 'cli' && (
              <>
                <ToolbarButton
                  className='annotate-toolbar-btn'
                  title='Submit annotation'
                  icon='check'
                  disabled={annotationCount === 0}
                  onClick={() => annotationsRef.current?.submit()}
                />
                <ToolbarSeparator />
              </>
            )}
            <ToolbarButton
              className='annotate-toolbar-btn'
              title='Save annotated image'
              onClick={() => annotationsRef.current?.save()}
            >
              <DownloadIcon />
            </ToolbarButton>
            <ToolbarButton
              className='annotate-toolbar-btn'
              title='Clear annotations'
              icon='circle-slash'
              disabled={annotationCount === 0}
              onClick={() => annotationsRef.current?.clear()}
            />
            <div className='toolbar-right'>
              <ToolbarButton
                className='annotate-toolbar-btn'
                title='Close annotation mode'
                icon='close'
                onClick={() => dispatch({ type: 'toggleAnnotate' })}
              />
            </div>
          </>
        ) : recording ? (
          <>
            <ToolbarButton
              className='recording'
              title={recording.phase === 'recording' ? 'Stop recording' : 'Start new recording'}
              icon='record'
              toggled={recording.phase === 'recording'}
              style={{ color: recording.phase === 'recording' ? 'var(--color-scale-red-5)' : undefined }}
              onClick={async () => {
                if (recording.phase === 'recording') {
                  await onStopRecording();
                } else {
                  URL.revokeObjectURL(recording.url);
                  await onStartRecording();
                }
              }}>
              {recording.phase === 'recording' && <span className='recording-label'>Recording...</span>}
            </ToolbarButton>
            <ToolbarButton
              title='Save recording'
              disabled={recording.phase !== 'stopped'}
              onClick={onSaveRecording}
            >
              <DownloadIcon />
            </ToolbarButton>
            <div className='toolbar-right'>
              <ToolbarButton
                title='Close'
                icon='close'
                onClick={onExitRecording}
              />
            </div>
          </>
        ) : (
          <>
            <ToolbarButton
              ref={interactiveBtnRef}
              className='mode-toggle mode-interactive'
              title={interactive ? 'Disable interactive mode' : 'Enable interactive mode'}
              toggled={interactive}
              disabled={!ready}
              onClick={() => {
                dispatch({ type: 'toggleInteractive' });
              }}
            >
              {interactive ? <LockOpenIcon /> : <LockIcon />}
            </ToolbarButton>
            <ToolbarSeparator />
            <ToolbarButton
              className='mode-toggle mode-annotate'
              title='Enable annotation mode'
              disabled={!ready || !liveFrame}
              onClick={() => {
                dispatch({ type: 'toggleAnnotate' });
              }}
            >
              <ScreenshotRegionIcon />
            </ToolbarButton>
            <ToolbarButton
              title='Record video'
              icon='record'
              disabled={!ready}
              onClick={onStartRecording}
            />
          </>
        )}
      </div>

      {/* Viewport */}
      <div className='viewport-wrapper'>
        <div ref={viewportMainRef} className='viewport-main'>
          {annotating && annotateFrame ? (
            <div ref={annotateViewRef} className='annotate-view'>
              <img
                ref={displayRef}
                id='display'
                className='annotate-image'
                alt='annotation'
                src={'data:image/jpeg;base64,' + annotateFrame.data}
              />
              <Annotations
                ref={annotationsRef}
                active={true}
                displayRef={displayRef}
                screenRef={annotateViewRef}
                viewportWidth={annotateFrame.viewportWidth ?? 0}
                viewportHeight={annotateFrame.viewportHeight ?? 0}
                onSubmit={onSubmitAnnotations}
                onAnnotationsChange={setAnnotationCount}
              />
            </div>
          ) : recording?.phase === 'stopped' ? (
            <div className='recording-view'>
              <video
                className='recording-video'
                src={recording.url}
                controls
                autoPlay
              />
            </div>
          ) : (
            <div className='browser-window' style={windowStyle}>
              {showBrowserChrome && (
                <div ref={browserChromeRef} className='browser-chrome'>
                  <button className='nav-btn' title='Back' aria-disabled={!interactive || undefined} onClick={() => {
                    if (!interactive) {
                      flashInteractiveHint();
                      return;
                    }
                    client?.back();
                  }}>
                    <ChevronLeftIcon />
                  </button>
                  <button className='nav-btn' title='Forward' aria-disabled={!interactive || undefined} onClick={() => {
                    if (!interactive) {
                      flashInteractiveHint();
                      return;
                    }
                    client?.forward();
                  }}>
                    <ChevronRightIcon />
                  </button>
                  <button className='nav-btn' title='Reload' aria-disabled={!interactive || undefined} onClick={() => {
                    if (!interactive) {
                      flashInteractiveHint();
                      return;
                    }
                    client?.reload();
                  }}>
                    <ReloadIcon />
                  </button>
                  <div className='omnibox-wrap'>
                    <input
                      id='omnibox'
                      className='omnibox'
                      type='text'
                      placeholder='Search or enter URL'
                      spellCheck={false}
                      autoComplete='off'
                      value={url}
                      onChange={e => {
                        if (!interactive)
                          return;
                        dispatch({ type: 'setUrl', url: e.target.value });
                      }}
                      onKeyDown={e => {
                        if (!interactive)
                          return;
                        onOmniboxKeyDown(e);
                      }}
                      onFocus={e => {
                        if (!interactive) {
                          flashInteractiveHint();
                          e.target.blur();
                          return;
                        }
                        e.target.select();
                      }}
                      aria-disabled={!interactive || undefined}
                      readOnly={!interactive}
                    />
                  </div>
                </div>
              )}
              <div
                ref={screenRef}
                className='screen'
                tabIndex={0}
                style={{ display: liveFrame ? '' : 'none' }}
                onMouseDown={onScreenMouseDown}
                onMouseUp={onScreenMouseUp}
                onMouseMove={onScreenMouseMove}
                onWheel={onScreenWheel}
                onKeyDown={onScreenKeyDown}
                onKeyUp={onScreenKeyUp}
                onContextMenu={e => e.preventDefault()}
              >
                <img
                  ref={displayRef}
                  id='display'
                  className='display'
                  alt='screencast'
                  src={liveFrame ? 'data:image/jpeg;base64,' + liveFrame.data : undefined}
                />
              </div>
              {overlayText && <div className={'screen-overlay' + (liveFrame ? ' has-frame' : '')}><span>{overlayText}</span></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
