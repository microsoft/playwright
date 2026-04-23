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
import { Annotations, getImageLayout, clientToViewport } from './annotations';

import type { Annotation, AnnotationsHandle } from './annotations';
import { ToolbarButton, ToolbarSeparator } from '@web/components/toolbarButton';
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

  const { tabs, mode, recording, liveFrame, annotateFrame, annotateInitiator, pendingAnnotate } = model.state;
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
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
    await model.submitAnnotation(data, annotations);
  }, [model]);

  function flashInteractiveHint() {
    setFlashTick(tick => tick + 1);
  }

  const onSaveRecording = React.useCallback(async () => {
    if (recording?.phase !== 'stopped')
      return;
    const writable = await pickSaveWritable(`playwright-recording-${Date.now()}.webm`, 'WebM Video', 'video/webm', '.webm');
    if (!writable)
      return;
    await writable.write(recording.blob);
    await writable.close();
  }, [recording]);

  const selectedTab = tabs?.find(t => t.selected);
  const ready = !!selectedTab;

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
    if (annotating || !interactive)
      return;
    const now = Date.now();
    if (now - moveThrottleRef.current < 32)
      return;
    moveThrottleRef.current = now;
    const { x, y } = imgCoords(e);
    model.mousemove(x, y);
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (annotating || !interactive)
      return;
    e.preventDefault();
    model.wheel(e.deltaX, e.deltaY);
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (annotating || !interactive)
      return;
    e.preventDefault();
    model.keydown(e.key);
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (annotating || !interactive)
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
                onClick={() => model.completeAnnotation()}
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
              onClick={() => {
                if (recording.phase === 'recording') {
                  model.stopRecording();
                } else {
                  URL.revokeObjectURL(recording.blobUrl);
                  model.startRecording();
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
                onClick={() => model.discardRecording()}
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
              onClick={() => model.toggleInteractive()}
            >
              {interactive ? <LockOpenIcon /> : <LockIcon />}
            </ToolbarButton>
            <ToolbarSeparator />
            <ToolbarButton
              className='mode-toggle mode-annotate'
              title='Enable annotation mode'
              disabled={!ready}
              onClick={() => {
                if (pendingAnnotate)
                  model.cancelAnnotate();
                else
                  model.enterAnnotate('user');
              }}
            >
              <ScreenshotRegionIcon />
            </ToolbarButton>
            <ToolbarButton
              title='Record video'
              icon='record'
              disabled={!ready}
              onClick={() => model.startRecording()}
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
                src={'data:image/png;base64,' + annotateFrame.data}
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
                src={recording.blobUrl}
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
                      value={selectedTab?.url}
                      onChange={() => {}}
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
