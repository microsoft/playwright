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
import { ChevronLeftIcon, ChevronRightIcon, ReloadIcon } from './icons';
import { Annotations, getImageLayout, clientToViewport } from './annotations';
import { ToolbarButton } from '@web/components/toolbarButton';

import type { Tab, PageTarget, DashboardChannelEvents } from './dashboardChannel';
import type { DashboardClientChannel } from './dashboardClient';

const BUTTONS = ['left', 'middle', 'right'] as const;
export type Mode = 'readonly' | 'interactive' | 'annotate';

export type ViewportPanelProps = {
  client: DashboardClientChannel | undefined;
  browser: string;
  context: string | undefined;
  tabs: Tab[] | null;
  frame: DashboardChannelEvents['frame'] | undefined;
  url: string;
  setUrl: (url: string) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
  pickingPage: string | null;
  setPickingPage: (page: string | null) => void;
  recording: boolean;
  setRecording: (recording: boolean) => void;
  screenshotIcon: 'device-camera' | 'clippy';
  setScreenshotIcon: (icon: 'device-camera' | 'clippy') => void;
  showInteractiveHint: boolean;
  flashInteractiveHint: () => void;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  sidebarLocation: 'bottom' | 'right';
  overlayText: string | undefined;
  screenRef: React.RefObject<HTMLDivElement | null>;
  isMobile?: boolean;
};

export const ViewportPanel: React.FC<ViewportPanelProps> = ({
  client,
  browser,
  context,
  tabs,
  frame,
  url,
  setUrl,
  mode,
  setMode,
  pickingPage,
  setPickingPage,
  recording,
  setRecording,
  screenshotIcon,
  setScreenshotIcon,
  showInteractiveHint,
  flashInteractiveHint,
  sidebarVisible,
  setSidebarVisible,
  sidebarLocation,
  overlayText,
  screenRef,
  isMobile,
}) => {
  const displayRef = React.useRef<HTMLImageElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const moveThrottleRef = React.useRef(0);
  const modeRef = React.useRef<Mode>('readonly');
  const resizedRef = React.useRef(false);

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Resize window to match viewport on first frame (desktop only).
  React.useEffect(() => {
    if (isMobile || !frame || resizedRef.current)
      return;
    const toolbar = toolbarRef.current;
    if (!toolbar || !frame.viewportWidth || !frame.viewportHeight)
      return;
    resizedRef.current = true;
    const chromeHeight = toolbar.offsetHeight;
    const extraW = window.outerWidth - window.innerWidth;
    const extraH = window.outerHeight - window.innerHeight;
    const targetW = Math.min(frame.viewportWidth + extraW, screen.availWidth);
    const targetH = Math.min(frame.viewportHeight + chromeHeight + extraH, screen.availHeight);
    window.resizeTo(targetW, targetH);
  }, [frame, isMobile]);

  // Reset resized flag when browser changes.
  React.useEffect(() => {
    resizedRef.current = false;
  }, [browser]);

  const interactive = mode === 'interactive';
  const annotating = mode === 'annotate';

  const selectedTab = tabs?.find(t => t.selected);
  const ready = !!client && !!context && !!selectedTab;
  const pageTarget: PageTarget | undefined = ready && selectedTab
    ? { browser, context: context!, page: selectedTab.page }
    : undefined;

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
    if (!pageTarget)
      return;
    const { x, y } = imgCoords(e);
    client?.[method]({ ...pageTarget, x, y, button: BUTTONS[e.button] || 'left' });
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
    if (annotating || !interactive || !pageTarget)
      return;
    const now = Date.now();
    if (now - moveThrottleRef.current < 32)
      return;
    moveThrottleRef.current = now;
    const { x, y } = imgCoords(e);
    client?.mousemove({ ...pageTarget, x, y });
  }

  function onScreenWheel(e: React.WheelEvent) {
    if (annotating || !interactive || !pageTarget)
      return;
    e.preventDefault();
    client?.wheel({ ...pageTarget, deltaX: e.deltaX, deltaY: e.deltaY });
  }

  function onScreenKeyDown(e: React.KeyboardEvent) {
    if (annotating)
      return;
    if (pickingPage !== null && e.key === 'Escape') {
      e.preventDefault();
      if (pageTarget)
        client?.cancelPickLocator(pageTarget);
      setPickingPage(null);
      return;
    }
    if (!interactive || !pageTarget)
      return;
    e.preventDefault();
    client?.keydown({ ...pageTarget, key: e.key });
  }

  function onScreenKeyUp(e: React.KeyboardEvent) {
    if (annotating || !interactive || !pageTarget)
      return;
    e.preventDefault();
    client?.keyup({ ...pageTarget, key: e.key });
  }

  function onOmniboxKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      let value = (e.target as HTMLInputElement).value.trim();
      if (!/^https?:\/\//i.test(value))
        value = 'https://' + value;
      setUrl(value);
      if (pageTarget)
        client?.navigate({ ...pageTarget, url: value });
      e.currentTarget.blur();
    }
  }

  return (
    <div className={'dashboard-view' + (interactive ? ' interactive' : '') + (annotating ? ' annotate' : '')}>
      {/* Toolbar */}
      <div ref={toolbarRef} className='toolbar'>
        <button className='nav-btn' title='Back' aria-disabled={!interactive || undefined} onClick={() => {
          if (!interactive) {
            flashInteractiveHint();
            return;
          }
          pageTarget && client?.back(pageTarget);
        }}>
          <ChevronLeftIcon />
        </button>
        <button className='nav-btn' title='Forward' aria-disabled={!interactive || undefined} onClick={() => {
          if (!interactive) {
            flashInteractiveHint();
            return;
          }
          pageTarget && client?.forward(pageTarget);
        }}>
          <ChevronRightIcon />
        </button>
        <button className='nav-btn' title='Reload' aria-disabled={!interactive || undefined} onClick={() => {
          if (!interactive) {
            flashInteractiveHint();
            return;
          }
          pageTarget && client?.reload(pageTarget);
        }}>
          <ReloadIcon />
        </button>
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
        <ToolbarButton
          className='recording'
          title={recording ? 'Stop recording' : 'Record video'}
          icon='record'
          toggled={recording}
          style={{ color: recording ? (interactive ? 'var(--color-fg-on-emphasis)' : 'var(--color-scale-red-5)') : undefined }}
          disabled={!ready}
          onClick={async () => {
            if (!client || !pageTarget)
              return;
            if (recording) {
              const { path } = await client.stopRecording(pageTarget);
              await client.reveal({ path });
              setRecording(false);
            } else {
              await client.startRecording(pageTarget);
              setRecording(true);
            }
          }}>
          {recording && <span className='recording-label'>Recording...</span>}
        </ToolbarButton>
        <ToolbarButton
          className='screenshot'
          title='Copy screenshot to clipboard'
          icon={screenshotIcon}
          disabled={!ready}
          onClick={async () => {
            if (!client || !pageTarget)
              return;
            const screenshot = await client.screenshot(pageTarget);
            const blob = await (await fetch('data:image/png;base64,' + screenshot)).blob();
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            setScreenshotIcon('clippy');
            setTimeout(() => setScreenshotIcon('device-camera'), 3000);
          }}
        />
        <div style={{ marginLeft: 8, borderLeft: '1px solid var(--color-border-default)', paddingLeft: 8, display: 'flex', gap: 4 }}>
          <div style={{ position: 'relative' }}>
            <ToolbarButton
              title={interactive ? 'Disable interactive mode' : 'Enable interactive mode'}
              icon='inspect'
              toggled={interactive}
              disabled={!ready}
              onClick={() => {
                if (interactive) {
                  if (pageTarget)
                    client?.cancelPickLocator(pageTarget);
                  setPickingPage(null);
                  setMode('readonly');
                  return;
                }
                if (pageTarget)
                  client?.cancelPickLocator(pageTarget);
                setPickingPage(null);
                setMode('interactive');
              }}
            />
            {showInteractiveHint && <div className='interactive-hint-popover'>Enable interactive mode</div>}
          </div>
          <ToolbarButton
            title={annotating ? 'Disable annotation mode' : 'Enable annotation mode'}
            icon='edit'
            toggled={annotating}
            disabled={!ready || !frame}
            onClick={() => {
              if (annotating) {
                setMode('readonly');
                return;
              }
              if (pageTarget)
                client?.cancelPickLocator(pageTarget);
              setPickingPage(null);
              setMode('annotate');
            }}
          />
          {!isMobile && <ToolbarButton
            title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
            icon={sidebarLocation === 'bottom' ? 'layout-panel' : 'layout-sidebar-right'}
            toggled={sidebarVisible}
            onClick={() => setSidebarVisible(!sidebarVisible)}
            disabled={!ready}
          />}
        </div>
      </div>

      {/* Viewport */}
      <div className='viewport-wrapper'>
        <div className='viewport-main'>
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
  );
};
