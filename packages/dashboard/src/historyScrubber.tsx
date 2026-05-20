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

import { historyTimeRange } from './dashboardModel';
import { HistoryPlayer } from './historyPlayer';
import './historyScrubber.css';

import type { DashboardModel, HistoryState } from './dashboardModel';
import type { HistoryPlayback } from './historyPlayback';

type HistoryScrubberProps = {
  model: DashboardModel;
  history: HistoryState;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playbackRef: React.RefObject<HistoryPlayback | null>;
};

const STEP_MS = 1000;
const STEP_BIG_MS = 5000;
// Roughly half the thumb's width — keeps it from running off either end
// of the track when the cursor is near the edges.
const THUMB_HALF_WIDTH_PX = 100;

export const HistoryScrubber: React.FC<HistoryScrubberProps> = ({ model, history, videoRef, playbackRef }) => {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef(false);
  const range = historyTimeRange(history, model.state.liveFrame);
  const total = range.endMs - range.startMs;
  const inScrub = history.scrubMode;
  const [playing, setPlaying] = React.useState(false);
  // Hover preview: a small floating <HistoryPlayer> tile pinned above the
  // track. `hover` is null when the cursor isn't over the track. We keep
  // the player mounted across hovers (one persistent MediaSource) by
  // remembering the last position and hiding via CSS — re-mounting on
  // every hover would tear down + rebuild MSE + re-append the init
  // segment, causing visible churn on rapid hover.
  const [hover, setHover] = React.useState<{ x: number; trackWidth: number; time: number } | null>(null);
  const lastHoverRef = React.useRef<{ x: number; trackWidth: number; time: number } | null>(null);
  if (hover)
    lastHoverRef.current = hover;
  const hoverRafRef = React.useRef<number | null>(null);

  const seek = React.useCallback((time: number) => {
    if (!model.state.history.scrubMode)
      model.enterScrub(time);
    else
      model.setScrubTime(time);
  }, [model]);

  const seekFromClientX = React.useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track || total <= 0)
      return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seek(range.startMs + ratio * total);
  }, [range.startMs, total, seek]);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0)
      return;
    draggingRef.current = true;
    // Pause playback when the user grabs the playhead.
    playbackRef.current?.pause();
    seekFromClientX(e.clientX);
    e.preventDefault();
  };

  const onTrackMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingRef.current || total <= 0)
      return;
    const clientX = e.clientX;
    if (hoverRafRef.current !== null)
      return;
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = null;
      const track = trackRef.current;
      if (!track)
        return;
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = x / rect.width;
      setHover({ x, trackWidth: rect.width, time: range.startMs + ratio * total });
    });
  };

  const onTrackMouseLeave = () => {
    if (hoverRafRef.current !== null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    setHover(null);
  };

  React.useEffect(() => () => {
    if (hoverRafRef.current !== null)
      cancelAnimationFrame(hoverRafRef.current);
  }, []);

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current)
        seekFromClientX(e.clientX);
    };
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [seekFromClientX]);

  // Reflect the underlying <video>'s play state into local UI state, and
  // advance scrubTime as the video plays so the playhead tracks naturally.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !inScrub)
      return;
    const originWallMs = history.clusters[0]?.startWallMs ?? 0;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      if (draggingRef.current)
        return;
      const t = originWallMs + video.currentTime * 1000;
      model.setScrubTime(t);
    };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    setPlaying(!video.paused);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, [videoRef, inScrub, model, history.clusters]);

  // Reset local play state on exiting scrub mode (the <video> unmounts).
  React.useEffect(() => {
    if (!inScrub)
      setPlaying(false);
  }, [inScrub]);

  const playDisabled = total <= 0;
  const onPlayClick = () => {
    if (playDisabled)
      return;
    if (!inScrub) {
      // Enter scrub a few seconds before live so there's something to play.
      model.enterScrub(range.endMs - 5000);
      // The controller may not exist yet — it's created when HistoryPlayer
      // mounts. Defer to a microtask so React commits the mount first,
      // then ask the controller to play. `play()` itself awaits loadeddata.
      queueMicrotask(() => {
        void playbackRef.current?.play();
      });
      return;
    }
    const c = playbackRef.current;
    if (!c)
      return;
    if (playing)
      c.pause();
    else
      void c.play();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (total <= 0)
      return;
    if (e.key === ' ' || e.key === 'Spacebar') {
      onPlayClick();
      e.preventDefault();
      return;
    }
    const step = e.shiftKey ? STEP_BIG_MS : STEP_MS;
    const t = inScrub ? history.scrubTime : range.endMs;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowLeft': next = t - step; break;
      case 'ArrowRight': next = t + step; break;
      case 'Home': next = range.startMs; break;
      case 'End': next = range.endMs; break;
      case 'Escape':
        if (inScrub) {
          model.exitScrub();
          e.preventDefault();
        }
        return;
    }
    if (next !== null) {
      seek(next);
      e.preventDefault();
    }
  };

  // 1s tick to refresh the displayed relative time ("-11s" → "-12s") even
  // when the bar geometry is frozen during scrub.
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!inScrub)
      return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inScrub]);

  if (!history.enabled)
    return null;

  const cursorRatio = total > 0 && inScrub
    ? Math.max(0, Math.min(1, (history.scrubTime - range.startMs) / total))
    : 1;
  const showRelative = inScrub ? formatRelative(history.scrubTime - nowTick) : 'live';
  const showAbsolute = inScrub ? formatAbsolute(history.scrubTime) : '';

  return (
    <div className={'history-scrubber' + (inScrub ? ' expanded' : '')}>
      <button
        className='history-play-btn'
        onClick={onPlayClick}
        disabled={playDisabled}
        title={inScrub ? (playing ? 'Pause (space)' : 'Play (space)') : 'Play recent history (space)'}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {inScrub && playing ? '❚❚' : '▶'}
      </button>
      <div
        ref={trackRef}
        className='history-track'
        tabIndex={0}
        role='slider'
        aria-label='History scrubber'
        aria-valuemin={range.startMs}
        aria-valuemax={range.endMs}
        aria-valuenow={inScrub ? history.scrubTime : range.endMs}
        onMouseDown={onMouseDown}
        onMouseMove={onTrackMouseMove}
        onMouseLeave={onTrackMouseLeave}
        onKeyDown={onKeyDown}
      >
        {/* Single coverage span. History is contiguous within a Page's
            lifetime, so segment seams are an MSE detail and not surfaced. */}
        {total > 0 && <div className='history-coverage' />}
        <div
          className='history-cursor'
          style={{ left: `${cursorRatio * 100}%`, opacity: inScrub ? 1 : 0 }}
        />
        {lastHoverRef.current && (
          <div
            className={'history-thumb' + (hover ? '' : ' hidden')}
            style={{ left: clampThumbCenter(lastHoverRef.current.x, lastHoverRef.current.trackWidth) }}
          >
            <HistoryPlayer model={model} time={lastHoverRef.current.time} className='history-thumb-player' />
            <div className='history-thumb-time'>{formatRelative(lastHoverRef.current.time - Date.now())}</div>
          </div>
        )}
      </div>
      <div className='history-time'>
        <span className='history-time-rel'>{showRelative}</span>
        {showAbsolute && <span className='history-time-abs'>{showAbsolute}</span>}
        {inScrub && (
          <button
            className='history-live-btn'
            onClick={() => model.exitScrub()}
            title='Return to live (Esc)'
          >
            ● LIVE
          </button>
        )}
      </div>
    </div>
  );
};

function clampThumbCenter(x: number, trackWidth: number): number {
  // Keep the (centered) thumb fully within the track.
  return Math.max(THUMB_HALF_WIDTH_PX, Math.min(trackWidth - THUMB_HALF_WIDTH_PX, x));
}

function formatRelative(deltaMs: number): string {
  const sec = Math.round(deltaMs / 1000);
  if (sec === 0)
    return 'live';
  const sign = sec < 0 ? '-' : '+';
  const abs = Math.abs(sec);
  if (abs < 60)
    return `${sign}${abs}s`;
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}m${s.toString().padStart(2, '0')}s`;
}

function formatAbsolute(timeMs: number): string {
  if (!Number.isFinite(timeMs) || timeMs <= 0)
    return '';
  return new Date(timeMs).toLocaleTimeString();
}
