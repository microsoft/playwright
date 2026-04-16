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

import type { Tab, DashboardChannelEvents } from './dashboardChannel';

const BUTTONS = ['left', 'middle', 'right'] as const;
type Mode = 'readonly' | 'interactive' | 'annotate';

export const Dashboard: React.FC = () => {
  const client = React.useContext(DashboardClientContext);
  const [mode, setMode] = React.useState<Mode>('readonly');
  const [tabs, setTabs] = React.useState<Tab[] | null>(null);
  const [url, setUrl] = React.useState('');
  const [frame, setFrame] = React.useState<DashboardChannelEvents['frame']>();
  const [picking, setPicking] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [screenshotIcon, setScreenshotIcon] = React.useState<'device-camera' | 'clippy'>('device-camera');
  const [showInteractiveHint, setShowInteractiveHint] = React.useState(false);

  const displayRef = React.useRef<HTMLImageElement>(null);
  const screenRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const moveThrottleRef = React.useRef(0);
  const hintTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const modeRef = React.useRef<Mode>('readonly');

  React.useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const interactive = mode === 'interactive';
  const annotating = mode === 'annotate';

  React.useEffect(() => {
    if (interactive)
      setShowInteractiveHint(false);
  }, [interactive]);

  React.useEffect(() => {
    return () => clearTimeout(hintTimerRef.current);
  }, []);

  function flashInteractiveHint() {
    clearTimeout(hintTimerRef.current);
    setShowInteractiveHint(true);
    hintTimerRef.current = setTimeout(() => setShowInteractiveHint(false), 2000);
  }

  React.useEffect(() => {
    if (!client)
      return;
    let resized = false;
    const onTabs = (params: DashboardChannelEvents['tabs']) => {
      setTabs(params.tabs);
      const selected = params.tabs.find(t => t.selected);
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
      let value = (e.target as HTMLInputElement).value.trim();
      if (!/^https?:\/\//i.test(value))
        value = 'https://' + value;
      setUrl(value);
      client?.navigate({ url: value });
      e.currentTarget.blur();
    }
  }

  let overlayText: string | undefined;
  if (!client)
    overlayText = 'Disconnected';
  else if (tabs === null)
    overlayText = 'Loading...';
  else if (tabs.length === 0)
    overlayText = 'No tabs open';
  else if (!selectedTab)
    overlayText = 'Select a tab from the sidebar';

  return (
    <div className={'dashboard-view' + (interactive ? ' interactive' : '') + (annotating ? ' annotate' : '')}>
      {/* Toolbar */}
      <div ref={toolbarRef} className='toolbar'>
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
            if (!client)
              return;
            if (recording) {
              const { path } = await client.stopRecording();
              await client.reveal({ path });
              setRecording(false);
            } else {
              await client.startRecording();
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
            if (!client)
              return;
            const screenshot = await client.screenshot();
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
                  client?.cancelPickLocator();
                  setPicking(false);
                  setMode('readonly');
                  return;
                }
                client?.cancelPickLocator();
                setPicking(false);
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
              client?.cancelPickLocator();
              setPicking(false);
              setMode('annotate');
            }}
          />
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
