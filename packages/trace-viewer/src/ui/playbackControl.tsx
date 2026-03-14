/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { ToolbarButton } from '@web/components/toolbarButton';
import * as React from 'react';
import type { ActionTraceEventInContext } from '@isomorphic/trace/traceModel';
import type { Boundaries } from './geometry';
import './playbackControl.css';

const speeds = [0.5, 1, 2];

export type PlaybackState = {
  playing: boolean;
  speed: number;
  currentIndex: number;
  percent: number;
  animating: boolean;
  togglePlay: () => void;
  stop: () => void;
  prev: () => void;
  next: () => void;
  cycleSpeed: () => void;
  onScrubberMouseDown: (e: React.MouseEvent) => void;
  scrubberRef: React.RefObject<HTMLDivElement | null>;
  actionsLength: number;
  canPrev: boolean;
  canNext: boolean;
  canStop: boolean;
  ticks: number[] | undefined;
};

export function usePlayback(
  actions: ActionTraceEventInContext[],
  selectedAction: ActionTraceEventInContext | undefined,
  onActionSelected: (action: ActionTraceEventInContext) => void,
  timeWindow: Boundaries | undefined,
  boundaries: Boundaries,
): PlaybackState {
  const [playing, setPlaying] = React.useState(false);
  const [speedIndex, setSpeedIndex] = React.useState(1);
  const [dragging, setDragging] = React.useState(false);
  const [dragFraction, setDragFraction] = React.useState<number | undefined>(undefined);
  const [cursorTime, setCursorTime] = React.useState<number | undefined>(undefined);
  const speed = speeds[speedIndex];

  const currentIndex = selectedAction ? actions.indexOf(selectedAction) : -1;

  // Scrubber scale always matches the timeline boundaries (1:1 with timeline grid).
  const fullMin = boundaries.minimum;
  const fullMax = boundaries.maximum;
  const fullDuration = fullMax - fullMin || 1;

  // Playback boundaries: constrained to time window when selected.
  const windowMin = timeWindow ? timeWindow.minimum : fullMin;
  const windowMax = timeWindow ? timeWindow.maximum : fullMax;

  // Actions within the effective window.
  const windowActions = React.useMemo(() => {
    if (!timeWindow)
      return actions;
    return actions.filter(a => a.startTime >= timeWindow.minimum && a.startTime <= timeWindow.maximum);
  }, [actions, timeWindow]);

  // First and last action indices within the window (in the full actions array).
  const firstWindowIndex = windowActions.length ? actions.indexOf(windowActions[0]) : 0;
  const lastWindowIndex = windowActions.length ? actions.indexOf(windowActions[windowActions.length - 1]) : actions.length - 1;

  const actionsRef = React.useRef(actions);
  actionsRef.current = actions;

  const onActionSelectedRef = React.useRef(onActionSelected);
  onActionSelectedRef.current = onActionSelected;

  const scrubberRef = React.useRef<HTMLDivElement>(null);

  const actionIndexAtTime = React.useCallback((t: number): number => {
    let lo = 0, hi = actions.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (actions[mid].startTime <= t)
        lo = mid;
      else
        hi = mid - 1;
    }
    if (lo < actions.length - 1) {
      const distPrev = t - actions[lo].startTime;
      const distNext = actions[lo + 1].startTime - t;
      if (distNext < distPrev)
        lo = lo + 1;
    }
    // Clamp to window bounds.
    return Math.max(firstWindowIndex, Math.min(lastWindowIndex, lo));
  }, [actions, firstWindowIndex, lastWindowIndex]);

  const selectedTime = selectedAction ? selectedAction.startTime : fullMin;

  let percent: number;
  if (dragging && dragFraction !== undefined)
    percent = dragFraction * 100;
  else if (playing && cursorTime !== undefined)
    percent = Math.max(0, Math.min(100, ((cursorTime - fullMin) / fullDuration) * 100));
  else
    percent = Math.max(0, Math.min(100, ((selectedTime - fullMin) / fullDuration) * 100));

  // Refs for raf closure.
  const windowMinRef = React.useRef(windowMin);
  windowMinRef.current = windowMin;
  const windowMaxRef = React.useRef(windowMax);
  windowMaxRef.current = windowMax;

  React.useEffect(() => {
    if (!playing)
      return;
    let rafId: number;
    let lastFrameTime: number | undefined;
    let traceTime = selectedTime;
    // If starting from before the window, jump to window start.
    if (traceTime < windowMinRef.current)
      traceTime = windowMinRef.current;
    let lastSelectedIndex = currentIndex;

    setCursorTime(traceTime);

    const tick = (now: number) => {
      if (lastFrameTime !== undefined) {
        const delta = (now - lastFrameTime) * speed;
        traceTime = Math.min(traceTime + delta, windowMaxRef.current);
      }
      lastFrameTime = now;
      setCursorTime(traceTime);

      const idx = actionIndexAtTime(traceTime);
      if (idx !== lastSelectedIndex) {
        lastSelectedIndex = idx;
        onActionSelectedRef.current(actionsRef.current[idx]);
      }

      if (traceTime >= windowMaxRef.current) {
        setPlaying(false);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  React.useEffect(() => {
    if (!playing)
      setCursorTime(undefined);
  }, [playing]);

  const togglePlay = React.useCallback(() => {
    if (!actions.length)
      return;
    // Always restart from the window start when at the end (or beyond the window).
    const atEnd = currentIndex >= lastWindowIndex;
    if (!playing && atEnd)
      onActionSelected(actions[firstWindowIndex]);
    setPlaying(!playing);
  }, [playing, actions, currentIndex, onActionSelected, firstWindowIndex, lastWindowIndex]);

  const stop = React.useCallback(() => {
    setPlaying(false);
    if (actions.length)
      onActionSelected(actions[firstWindowIndex]);
  }, [actions, onActionSelected, firstWindowIndex]);

  const prev = React.useCallback(() => {
    const target = Math.max(currentIndex - 1, firstWindowIndex);
    if (target !== currentIndex)
      onActionSelected(actions[target]);
  }, [actions, currentIndex, onActionSelected, firstWindowIndex]);

  const next = React.useCallback(() => {
    const target = Math.min(currentIndex + 1, lastWindowIndex);
    if (target !== currentIndex)
      onActionSelected(actions[target]);
  }, [actions, currentIndex, onActionSelected, lastWindowIndex]);

  const cycleSpeed = React.useCallback(() => {
    setSpeedIndex(i => (i + 1) % speeds.length);
  }, []);

  React.useEffect(() => {
    setPlaying(false);
  }, [actions]);

  const fractionFromMouseEvent = React.useCallback((e: MouseEvent | React.MouseEvent) => {
    const rect = scrubberRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const selectActionAtFraction = React.useCallback((fraction: number) => {
    if (!actions.length)
      return;
    const t = fullMin + fraction * fullDuration;
    const idx = actionIndexAtTime(t);
    onActionSelectedRef.current(actionsRef.current[idx]);
  }, [actions, fullMin, fullDuration, actionIndexAtTime]);

  const dragCleanupRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    return () => dragCleanupRef.current?.();
  }, []);

  const onScrubberMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (!actions.length || e.button !== 0)
      return;
    e.preventDefault();
    e.stopPropagation();
    scrubberRef.current?.focus();
    setDragging(true);
    setPlaying(false);
    const fraction = fractionFromMouseEvent(e);
    setDragFraction(fraction);
    selectActionAtFraction(fraction);

    const onMouseMove = (me: MouseEvent) => {
      const f = fractionFromMouseEvent(me);
      setDragFraction(f);
      selectActionAtFraction(f);
    };
    const onMouseUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dragCleanupRef.current = null;
      const f = fractionFromMouseEvent(me);
      selectActionAtFraction(f);
      setDragFraction(undefined);
      setDragging(false);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    dragCleanupRef.current = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [actions, selectActionAtFraction, fractionFromMouseEvent]);

  const animating = !playing && !dragging;
  const ticks = actions.length > 0 && actions.length <= 200 ? actions.map(a => ((a.startTime - fullMin) / fullDuration) * 100) : undefined;

  const canPrev = currentIndex > firstWindowIndex;
  const canNext = currentIndex < lastWindowIndex;
  const canStop = playing || currentIndex > firstWindowIndex;

  return {
    playing, speed, currentIndex, percent, animating,
    togglePlay, stop, prev, next, cycleSpeed,
    onScrubberMouseDown, scrubberRef, actionsLength: actions.length,
    canPrev, canNext, canStop, ticks,
  };
}

export const PlaybackButtons: React.FC<{
  playback: PlaybackState;
}> = ({ playback }) => {
  return <>
    <ToolbarButton icon='chevron-left' title='Previous action' onClick={playback.prev} disabled={!playback.canPrev} />
    <ToolbarButton icon={playback.playing ? 'debug-pause' : 'play'} disabled={!playback.actionsLength} title={playback.playing ? 'Pause' : 'Play'} onClick={playback.togglePlay} />
    <ToolbarButton icon='debug-stop' title='Stop' onClick={playback.stop} disabled={!playback.canStop} />
    <ToolbarButton icon='chevron-right' title='Next action' onClick={playback.next} disabled={!playback.canNext} />
    <button className='playback-speed' onClick={playback.cycleSpeed} title='Playback speed'>
      {playback.speed}x
    </button>
  </>;
};

export const PlaybackScrubber: React.FC<{
  playback: PlaybackState;
}> = ({ playback }) => {
  const onKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      playback.prev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      playback.next();
    }
  }, [playback]);

  return <div
    className='playback-scrubber'
    ref={playback.scrubberRef}
    onMouseDown={playback.onScrubberMouseDown}
    onKeyDown={onKeyDown}
    tabIndex={0}
    role='slider'
    aria-label='Playback position'
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(playback.percent)}
  >
    <div className='playback-track' />
    <div
      className={'playback-track-filled' + (playback.animating ? ' animated' : '')}
      style={{ 'width': `${playback.percent}%` }}
    />
    {playback.ticks?.map((p, i) => (
      <div key={i} className='playback-tick' style={{ 'left': `${p}%` }} />
    ))}
    <div
      className={'playback-thumb' + (playback.animating ? ' animated' : '')}
      style={{ 'left': `${playback.percent}%` }}
    />
  </div>;
};
