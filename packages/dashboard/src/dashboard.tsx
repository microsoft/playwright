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
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, LockIcon, LockOpenIcon, ReloadIcon, ScreenshotRegionIcon } from './icons';
import { Annotations } from './annotations';
import { buildAnnotatedImage, saveAnnotationAsDownload } from './annotationImage';
import { clientToViewport, getImageLayout } from './imageLayout';
import { Recording } from './recording';

import type { Annotation, AnnotationsHandle } from './annotations';
import { ToolbarButton } from '@web/components/toolbarButton';
import { useMeasureForRef } from '@web/uiUtils';

import type { DashboardModel } from './dashboardModel';

const BUTTONS = ['left', 'middle', 'right'] as const;

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

type DashboardProps = {
  model: DashboardModel;
};

export const Dashboard: React.FC<DashboardProps> = ({ model }) => {
  const [, setRevision] = React.useState(0);
  React.useEffect(() => model.subscribe(() => setRevision(r => r + 1)), [model]);

  const { tabs, mode, recording, liveFrame, annotateSession, pendingCapture } = model.state;
  const interactive = mode === 'interactive';
  const annotateActive = !!annotateSession;
  const selectedFrame = annotateSession?.frames.find(f => f.id === annotateSession.selectedFrameId) ?? null;

  const [flashTick, setFlashTick] = React.useState(0);

  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const viewportMainRef = React.useRef<HTMLDivElement>(null);
  const browserChromeRef = React.useRef<HTMLDivElement>(null);
  const interactiveBtnRef = React.useRef<HTMLButtonElement>(null);
  const moveThrottleRef = React.useRef(0);

  const aspect = liveFrame && liveFrame.viewportWidth && liveFrame.viewportHeight
    ? liveFrame.viewportWidth / liveFrame.viewportHeight
    : null;

  const [viewportRect] = useMeasureForRef(viewportMainRef);

  // Active recording hides the browser chrome so the viewport matches what's
  // being captured.
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

  const onSubmitAnnotateSession = React.useCallback(async () => {
    await model.submitAnnotateSession();
  }, [model]);

  function flashInteractiveHint() {
    setFlashTick(tick => tick + 1);
  }

  const onSaveRecording = React.useCallback(async (blob: Blob) => {
    const writable = await pickSaveWritable(`playwright-recording-${Date.now()}.webm`, 'WebM Video', 'video/webm', '.webm');
    if (!writable)
      return;
    await writable.write(blob);
    await writable.close();
    model.discardRecording();
  }, [model]);

  const onCloseAnnotate = React.useCallback(() => {
    if (!annotateSession)
      return;
    if (annotateSession.initiator === 'cli')
      model.completeAnnotation();
    else
      model.cancelAnnotate();
  }, [model, annotateSession]);

  const selectedTab = tabs?.find(t => t.selected);
  const ready = !!selectedTab;

  const [omniboxValue, setOmniboxValue] = React.useState(selectedTab?.url ?? '');
  React.useEffect(() => {
    setOmniboxValue(selectedTab?.url ?? '');
  }, [selectedTab?.url]);

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
    const { x, y } = imgCoords(e);
    model[method](x, y, BUTTONS[e.button] || 'left');
  }

  function onScreenMouseDown(e: React.MouseEvent) {
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
    if (!interactive)
      return;
    e.preventDefault();
    sendMouseEvent('mouseup', e);
  }

  function onScreenMouseMove(e: React.MouseEvent) {
    if (!interactive)
      return;
    const now = Date.now();
    if (now - moveThrottleRef.current < 32)
      return;
    moveThrottleRef.current = now;
    const { x, y } = imgCoords(e);
    model.mousemove(x, y);
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    model.wheel(e.deltaX, e.deltaY);
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    model.keydown(e.key);
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (!interactive)
      return;
    e.preventDefault();
    model.keyup(e.key);
  }

  function onOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const value = smartUrl((e.target as HTMLInputElement).value);
      model.navigate(value);
      e.currentTarget.blur();
    }
  }

  const overlayText = selectedTab ? undefined : 'Select a session';
  const isRecording = recording?.phase === 'recording';
  const showRecording = recording?.phase === 'stopped';
  const modeLabel = annotateActive ? 'Dashboard: annotate' : isRecording ? 'Dashboard: record' : 'Dashboard';

  const overlayOpen = !!selectedFrame;
  return (
    <main className={'dashboard-view' + (interactive ? ' interactive' : '') + (annotateActive ? ' has-annotate-sidebar' : '') + (overlayOpen ? ' annotate-fullscreen' : '')} aria-label={modeLabel}>
      <div className='dashboard-main'>
        {/* Toolbar */}
        <div ref={toolbarRef} className='toolbar' hidden={overlayOpen}>
          <ToolbarButton
            ref={interactiveBtnRef}
            className='mode-toggle mode-interactive'
            title={interactive ? 'Disable interactive mode' : 'Enable interactive mode'}
            toggled={interactive}
            disabled={!ready}
            onClick={() => {
              if (interactive)
                model.toggleInteractive();
              else
                model.enterInteractive();
            }}
          >
            {interactive ? <LockOpenIcon /> : <LockIcon />}
          </ToolbarButton>
          <ToolbarButton
            className='mode-annotate'
            title={annotateActive ? 'Add screenshot' : 'Take screenshot'}
            disabled={!ready || pendingCapture}
            onClick={() => {
              if (annotateActive)
                model.addAnnotateFrame();
              else
                model.enterAnnotate('user');
            }}
          >
            <ScreenshotRegionIcon />
          </ToolbarButton>
          <ToolbarButton
            className='mode-toggle mode-record'
            title={isRecording ? 'Stop recording' : 'Record video'}
            icon='record'
            toggled={isRecording}
            disabled={!ready || showRecording}
            onClick={() => {
              if (isRecording)
                model.stopRecording();
              else
                model.startRecording();
            }}
          >
            {isRecording && <span className='mode-record-label'>Recording...</span>}
          </ToolbarButton>
        </div>

        {/* Viewport */}
        <div className='viewport-wrapper'>
          <div ref={viewportMainRef} className='viewport-main'>
            <div className='browser-window' style={windowStyle}>
              {showBrowserChrome && (
                <div ref={browserChromeRef} className='browser-chrome'>
                  <button className='nav-btn' title='Back' aria-disabled={!interactive || undefined} onClick={() => {
                    if (!interactive) {
                      flashInteractiveHint();
                      return;
                    }
                    model.back();
                  }}>
                    <ChevronLeftIcon />
                  </button>
                  <button className='nav-btn' title='Forward' aria-disabled={!interactive || undefined} onClick={() => {
                    if (!interactive) {
                      flashInteractiveHint();
                      return;
                    }
                    model.forward();
                  }}>
                    <ChevronRightIcon />
                  </button>
                  <button className='nav-btn' title='Reload' aria-disabled={!interactive || undefined} onClick={() => {
                    if (!interactive) {
                      flashInteractiveHint();
                      return;
                    }
                    model.reload();
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
                      value={omniboxValue}
                      onChange={e => setOmniboxValue(e.target.value)}
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
              {selectedFrame && (
                <AnnotateOverlay
                  key={selectedFrame.id}
                  model={model}
                  frame={selectedFrame}
                />
              )}
              {overlayText && <div className={'screen-overlay' + (liveFrame ? ' has-frame' : '')}><span>{overlayText}</span></div>}
            </div>
          </div>
        </div>
      </div>
      {annotateSession && (
        <AnnotateSidebar
          model={model}
          session={annotateSession}
          onSubmit={onSubmitAnnotateSession}
          onClose={onCloseAnnotate}
        />
      )}

      {showRecording && recording?.phase === 'stopped' && (
        <Recording
          blob={recording.blob}
          blobUrl={recording.blobUrl}
          onSave={onSaveRecording}
          onClose={() => model.discardRecording()}
        />
      )}
    </main>
  );
};

type AnnotateSidebarProps = {
  model: DashboardModel;
  session: NonNullable<DashboardModel['state']['annotateSession']>;
  onSubmit: () => Promise<void> | void;
  onClose: () => void;
};

const AnnotateSidebar: React.FC<AnnotateSidebarProps> = ({ model, session, onSubmit, onClose }) => {
  const totalAnnotations = session.frames.reduce((n, f) => n + f.annotations.length, 0);
  const [submitting, setSubmitting] = React.useState(false);

  return (
    <aside className='annotate-sidebar' aria-label='Annotation screenshots'>
      <div className='annotate-sidebar-header dashboard-shell-sidebar-header'>
        <h2 className='dashboard-shell-sidebar-title'>UI Review</h2>
        <ToolbarButton
          className='annotate-sidebar-close'
          icon='close'
          title='Close annotation'
          onClick={onClose}
        />
      </div>
      <div className='annotate-sidebar-list'>
        {session.frames.map(frame => {
          const selected = frame.id === session.selectedFrameId;
          return (
            <div
              key={frame.id}
              className={'annotate-sidebar-thumb' + (selected ? ' selected' : '')}
            >
              <button
                className='annotate-sidebar-thumb-button'
                onClick={() => model.toggleSelectFrame(frame.id)}
                title={`${frame.sessionTitle || 'session'} · ${frame.tabTitle || 'tab'}\n${frame.url}`}
                aria-pressed={selected}
              >
                <span
                  className='annotate-sidebar-thumb-img-wrap'
                  style={{ aspectRatio: `${frame.viewportWidth} / ${frame.viewportHeight}` }}
                >
                  <img
                    className='annotate-sidebar-thumb-img'
                    alt=''
                    src={'data:image/png;base64,' + frame.data}
                  />
                  {frame.annotations.map(a => (
                    <span
                      key={a.id}
                      className='annotate-sidebar-thumb-rect'
                      style={{
                        left: `${(a.x / frame.viewportWidth) * 100}%`,
                        top: `${(a.y / frame.viewportHeight) * 100}%`,
                        width: `${(a.width / frame.viewportWidth) * 100}%`,
                        height: `${(a.height / frame.viewportHeight) * 100}%`,
                        ['--annotation-color' as any]: a.color,
                      }}
                    />
                  ))}
                </span>
              </button>
              <ToolbarButton
                className='annotate-sidebar-thumb-remove'
                icon='close'
                title='Remove screenshot'
                onClick={e => {
                  e.stopPropagation();
                  model.removeAnnotateFrame(frame.id);
                }}
              />
            </div>
          );
        })}
      </div>
      <button
        className='annotate-sidebar-submit'
        disabled={totalAnnotations === 0 || submitting}
        onClick={async () => {
          setSubmitting(true);
          try {
            await onSubmit();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
    </aside>
  );
};

type AnnotateOverlayProps = {
  model: DashboardModel;
  frame: import('./dashboardModel').AnnotateFrame;
};

const AnnotateOverlay: React.FC<AnnotateOverlayProps> = ({ model, frame }) => {
  const annotationsRef = React.useRef<AnnotationsHandle>(null);
  const displayRef = React.useRef<HTMLImageElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const onAnnotationsChange = React.useCallback((next: Annotation[]) => {
    model.updateFrameAnnotations(frame.id, next);
  }, [model, frame.id]);

  const onSave = React.useCallback(async () => {
    const img = displayRef.current;
    if (!img)
      return;
    const blob = await buildAnnotatedImage(img, frame.viewportWidth, frame.viewportHeight, frame.annotations);
    if (!blob)
      return;
    const safe = (frame.tabTitle || frame.url || 'screenshot').replace(/[^a-z0-9]+/gi, '-').slice(0, 40) || 'screenshot';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await saveAnnotationAsDownload(blob, `annotations-${stamp}-${safe}.png`);
  }, [frame]);

  const onClear = React.useCallback(() => {
    model.updateFrameAnnotations(frame.id, []);
    annotationsRef.current?.clearSelection();
  }, [model, frame.id]);

  return (
    <div className='annotate-overlay' role='dialog' aria-label={`Annotate screenshot from ${frame.tabTitle || frame.url || 'page'}`}>
      <div className='annotate-overlay-window'>
        <div className='annotate-overlay-chrome'>
          <span className='annotate-overlay-titlebar'>
            <span className='annotate-overlay-title-text'>{frame.tabTitle || 'untitled'}</span>
            <span className='annotate-overlay-title-sep'>·</span>
            <span className='annotate-overlay-title-url'>{frame.url}</span>
          </span>
          <ToolbarButton
            title='Save screenshot'
            onClick={onSave}
          >
            <DownloadIcon />
          </ToolbarButton>
          <ToolbarButton
            title='Clear annotations'
            icon='circle-slash'
            disabled={frame.annotations.length === 0}
            onClick={onClear}
          />
          <ToolbarButton
            title='Close screenshot'
            icon='close'
            onClick={() => model.deselectFrame()}
          />
        </div>
        <div ref={containerRef} className='annotate-overlay-canvas'>
          <img
            ref={displayRef}
            className='annotate-modal-image'
            alt='annotation'
            src={'data:image/png;base64,' + frame.data}
          />
          <Annotations
            ref={annotationsRef}
            active={true}
            displayRef={displayRef}
            screenRef={containerRef}
            viewportWidth={frame.viewportWidth}
            viewportHeight={frame.viewportHeight}
            annotations={frame.annotations}
            onAnnotationsChange={onAnnotationsChange}
          />
        </div>
      </div>
    </div>
  );
};
