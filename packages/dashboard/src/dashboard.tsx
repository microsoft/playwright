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
import { DashboardClientContext } from './index';
import { asLocator } from '@isomorphic/locatorGenerators';
import { ChevronLeftIcon, ChevronRightIcon, ReloadIcon } from './icons';
import { Annotations, getImageLayout, clientToViewport } from './annotations';
import { ToolbarButton } from '@web/components/toolbarButton';
import { useMeasureForRef } from '@web/uiUtils';

import type { Tab, DashboardChannelEvents } from './dashboardChannel';

const BUTTONS = ['left', 'middle', 'right'] as const;
type Mode = 'readonly' | 'interactive' | 'annotate';

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
  if (hasDot || isLocalhost || hasPort || isIp)
    return 'https://' + value;
  return 'https://' + host + '.com' + value.slice(host.length);
}

export const Dashboard: React.FC = () => {
  const client = React.useContext(DashboardClientContext);
  const [mode, setMode] = React.useState<Mode>('readonly');
  const [tabs, setTabs] = React.useState<Tab[] | null>(null);
  const [url, setUrl] = React.useState('');
  const [frame, setFrame] = React.useState<DashboardChannelEvents['frame']>();
  const [picking, setPicking] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [screenshotIcon, setScreenshotIcon] = React.useState<'device-camera' | 'clippy'>('device-camera');
  const [flashTick, setFlashTick] = React.useState(0);

  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const viewportMainRef = React.useRef<HTMLDivElement>(null);
  const browserChromeRef = React.useRef<HTMLDivElement>(null);
  const interactiveBtnRef = React.useRef<HTMLButtonElement>(null);
  const moveThrottleRef = React.useRef(0);
  const modeRef = React.useRef<Mode>('readonly');

  const aspect = frame && frame.viewportWidth && frame.viewportHeight
    ? frame.viewportWidth / frame.viewportHeight
    : null;

  const [viewportRect] = useMeasureForRef(viewportMainRef);

  const windowStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    const OUTER_MARGIN = 24;
    const chromeHeight = browserChromeRef.current?.offsetHeight ?? 40;
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
  }, [viewportRect, aspect]);

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const interactive = mode === 'interactive';
  const annotating = mode === 'annotate';

  React.useEffect(() => {
    if (flashTick === 0 || interactive)
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
  }, [flashTick, interactive]);

  function flashInteractiveHint() {
    setFlashTick(tick => tick + 1);
  }

  const prevTabsRef = React.useRef<Tab[] | null>(null);

  React.useEffect(() => {
    if (!client)
      return;
    let resized = false;
    const onTabs = (params: DashboardChannelEvents['tabs']) => {
      const prev = prevTabsRef.current;
      const selected = params.tabs.find(t => t.selected);
      if (prev && selected && !prev.some(t => t.page === selected.page))
        setMode('interactive');
      prevTabsRef.current = params.tabs;
      setTabs(params.tabs);
      if (selected)
        setUrl(selected.url);
    };
    const onFrame = (params: DashboardChannelEvents['frame']) => {
      if (modeRef.current === 'annotate')
        return;
      setFrame(params);
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
    const onElementPicked = (params: DashboardChannelEvents['elementPicked']) => {
      const locator = asLocator('javascript', params.selector);
      navigator.clipboard?.writeText(locator).catch(() => {});
      setPicking(false);
    };
    const onPickLocator = () => {
      setMode('interactive');
      setPicking(true);
    };
    client.on('tabs', onTabs);
    client.on('frame', onFrame);
    client.on('elementPicked', onElementPicked);
    client.on('pickLocator', onPickLocator);
    return () => {
      client.off('tabs', onTabs);
      client.off('frame', onFrame);
      client.off('elementPicked', onElementPicked);
      client.off('pickLocator', onPickLocator);
    };
  }, [client]);

  const selectedTab = tabs?.find(t => t.selected);
  const ready = !!client && !!selectedTab;

  React.useEffect(() => {
    setRecording(false);
    setPicking(false);
  }, [selectedTab?.page]);

  function imgCoords(e: React.MouseEvent): { x: number; y: number } {
    const vw = frame?.viewportWidth ?? 0;
    const vh = frame?.viewportHeight ?? 0;
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
    if (picking && e.key === 'Escape') {
      e.preventDefault();
      client?.cancelPickLocator();
      setPicking(false);
      return;
    }
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
      setUrl(value);
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
    <div className={'dashboard-view' + (interactive ? ' interactive' : '') + (annotating ? ' annotate' : '')}>
      {/* Toolbar */}
      <div ref={toolbarRef} className='toolbar'>
        <ToolbarButton
          ref={interactiveBtnRef}
          className='mode-toggle mode-interactive'
          title={interactive ? 'Disable interactive mode' : 'Enable interactive mode'}
          icon='person'
          toggled={interactive}
          disabled={!ready}
          onClick={() => {
            client?.cancelPickLocator();
            setPicking(false);
            setMode(interactive ? 'readonly' : 'interactive');
          }}
        />
        <ToolbarButton
          className='mode-toggle mode-annotate'
          title={annotating ? 'Disable annotation mode' : 'Enable annotation mode'}
          icon='comment-draft'
          toggled={annotating}
          disabled={!ready || !frame}
          onClick={() => {
            client?.cancelPickLocator();
            setPicking(false);
            setMode(annotating ? 'readonly' : 'annotate');
          }}
        />
        <div className='toolbar-right'>
          <ToolbarButton
            className='recording'
            title={recording ? 'Stop recording' : 'Record video'}
            icon='record'
            toggled={recording}
            style={{ color: recording ? 'var(--color-scale-red-5)' : undefined }}
            disabled={!ready}
            onClick={async () => {
              if (!client)
                return;
              if (recording) {
                const writable = await pickSaveWritable(`playwright-recording-${Date.now()}.webm`, 'WebM Video', 'video/webm', '.webm');
                if (!writable)
                  return;
                setRecording(false);
                const { streamId } = await client.stopRecording();
                while (true) {
                  const { data, eof } = await client.readStream({ streamId });
                  if (eof)
                    break;
                  await writable.write(base64ToBlob(data, 'video/webm'));
                }
                await writable.close();
              } else {
                await client.startRecording();
                setRecording(true);
              }
            }}>
            {recording && <span className='recording-label'>Recording...</span>}
          </ToolbarButton>
          <ToolbarButton
            className='screenshot'
            title='Save screenshot'
            icon={screenshotIcon}
            disabled={!ready}
            onClick={async () => {
              if (!client)
                return;
              const writable = await pickSaveWritable(`playwright-screenshot-${Date.now()}.png`, 'PNG Image', 'image/png', '.png');
              if (!writable)
                return;
              const data = await client.screenshot();
              await writable.write(base64ToBlob(data, 'image/png'));
              await writable.close();
              setScreenshotIcon('clippy');
              setTimeout(() => setScreenshotIcon('device-camera'), 3000);
            }}
          />
        </div>
      </div>

      {/* Viewport */}
      <div className='viewport-wrapper'>
        <div ref={viewportMainRef} className='viewport-main'>
          <div className='browser-window' style={windowStyle}>
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
                    setUrl(e.target.value);
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
            <div
              ref={screenRef}
              className='screen'
              tabIndex={0}
              style={{ display: frame ? '' : 'none' }}
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
                src={frame ? 'data:image/jpeg;base64,' + frame.data : undefined}
              />
              <Annotations
                active={annotating}
                displayRef={displayRef}
                screenRef={screenRef}
                viewportWidth={frame?.viewportWidth ?? 0}
                viewportHeight={frame?.viewportHeight ?? 0}
              />
            </div>
            {overlayText && <div className={'screen-overlay' + (frame ? ' has-frame' : '')}><span>{overlayText}</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
};
