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
import type { ActionEntry } from '@isomorphic/trace/entries';
import type { Boundaries } from './geometry';
import './playbackControl.css';

const speeds = [0.5, 1, 2];

export type PlaybackState = {
  playing: boolean;
  speed: number;
  currentIndex: number;
  percent: number;
  animating: boolean;
  screencastTime: number | undefined;
  togglePlay: () => void;
  stop: () => void;
  prev: () => void;
  next: () => void;
  cycleSpeed: () => void;
  selectAction: (action: ActionEntry) => void;
  showSelectedAction: () => void;
  onScrubberMouseDown: (e: React.MouseEvent) => void;
  scrubberRef: React.RefObject<HTMLDivElement | null>;
  actionsLength: number;
  canPrev: boolean;
  canNext: boolean;
  canStop: boolean;
  ticks: number[] | undefined;
};

export function usePlayback(
  actions: ActionEntry[],
  selectedAction: ActionEntry | undefined,
  onActionSelected: (action: ActionEntry) => void,
  timeWindow: Boundaries | undefined,
  boundaries: Boundaries,
): PlaybackState {
  const [playing, setPlaying] = React.useState(false);
  const [speedIndex, setSpeedIndex] = React.useState(1);
  const [dragging, setDragging] = React.useState(false);
  // Set while playing or positioned between actions: the screencast is shown at this time instead of the action snapshot.
  const [screencastTime, setScreencastTime] = React.useState<number | undefined>(undefined);
  const speed = speeds[speedIndex];

  const currentIndex = selectedAction ? actions.indexOf(selectedAction) : -1;

  // Scrubber scale always matches the timeline boundaries (1:1 with timeline grid).
  const fullMin = boundaries.minimum;
  const fullMax = boundaries.maximum;
  const fullDuration = fullMax - fullMin || 1;

  // Playback boundaries: constrained to time window when selected.
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

  const clampToWindow = React.useCallback((index: number) => {
    return Math.max(firstWindowIndex, Math.min(lastWindowIndex, index));
  }, [firstWindowIndex, lastWindowIndex]);

  // Last action started at or before t, or the first action when none has started yet.
  const lastStartedIndex = React.useCallback((t: number): number => {
    let lo = 0;
    let hi = actions.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (actions[mid].startTime <= t)
        lo = mid;
      else
        hi = mid - 1;
    }
    return lo;
  }, [actions]);

  const selectedTime = selectedAction ? selectedAction.startTime : fullMin;
  const positionTime = screencastTime ?? selectedTime;
  const percent = Math.max(0, Math.min(100, ((positionTime - fullMin) / fullDuration) * 100));

  const windowMaxRef = React.useRef(windowMax);
  windowMaxRef.current = windowMax;

  React.useEffect(() => {
    if (!playing)
      return;
    let rafId: number;
    let lastFrameTime: number | undefined;
    let traceTime = positionTime;
    let lastSelectedIndex = clampToWindow(lastStartedIndex(traceTime));

    const tick = (now: number) => {
      if (lastFrameTime !== undefined) {
        const delta = (now - lastFrameTime) * speed;
        traceTime = Math.min(traceTime + delta, windowMaxRef.current);
      }
      lastFrameTime = now;
      setScreencastTime(traceTime);

      const index = clampToWindow(lastStartedIndex(traceTime));
      if (index !== lastSelectedIndex) {
        lastSelectedIndex = index;
        onActionSelectedRef.current(actionsRef.current[index]);
      }

      if (traceTime >= windowMaxRef.current) {
        setPlaying(false);
        setScreencastTime(undefined);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  const togglePlay = React.useCallback(() => {
    if (!actions.length)
      return;
    if (playing) {
      setPlaying(false);
      setScreencastTime(undefined);
      return;
    }
    // Restart from the window start when at the end, or outside the window.
    if (currentIndex >= lastWindowIndex || currentIndex < firstWindowIndex)
      onActionSelected(actions[firstWindowIndex]);
    setPlaying(true);
  }, [playing, actions, currentIndex, onActionSelected, firstWindowIndex, lastWindowIndex]);

  const selectAction = React.useCallback((action: ActionEntry) => {
    setPlaying(false);
    setScreencastTime(undefined);
    onActionSelectedRef.current(action);
  }, []);

  // Leave the between-actions position, so that the selected action's snapshot is shown.
  const showSelectedAction = React.useCallback(() => {
    setPlaying(false);
    setScreencastTime(undefined);
  }, []);

  const stop = React.useCallback(() => {
    setPlaying(false);
    setScreencastTime(undefined);
    if (actions.length)
      onActionSelected(actions[firstWindowIndex]);
  }, [actions, onActionSelected, firstWindowIndex]);

  const canPrev = currentIndex > firstWindowIndex;
  const canNext = currentIndex < lastWindowIndex;

  const prev = React.useCallback(() => {
    if (canPrev)
      selectAction(actions[currentIndex - 1]);
  }, [actions, canPrev, currentIndex, selectAction]);

  const next = React.useCallback(() => {
    if (canNext)
      selectAction(actions[currentIndex + 1]);
  }, [actions, canNext, currentIndex, selectAction]);

  const cycleSpeed = React.useCallback(() => {
    setSpeedIndex(i => (i + 1) % speeds.length);
  }, []);

  React.useEffect(() => {
    setPlaying(false);
    setScreencastTime(undefined);
  }, [actions]);

  const seekToMouseEvent = React.useCallback((e: MouseEvent | React.MouseEvent, snap: boolean) => {
    const rect = scrubberRef.current!.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = fullMin + fraction * fullDuration;
    // The screencast follows the pointer while dragging, releasing snaps to the action snapshot.
    setScreencastTime(snap ? undefined : time);
    let index = lastStartedIndex(time);
    const next = actions[index + 1];
    if (next && next.startTime - time < time - actions[index].startTime)
      ++index;
    onActionSelectedRef.current(actions[clampToWindow(index)]);
  }, [actions, fullMin, fullDuration, clampToWindow, lastStartedIndex]);

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
    seekToMouseEvent(e, false);

    const onMouseMove = (me: MouseEvent) => {
      seekToMouseEvent(me, false);
    };
    const onMouseUp = (me: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      dragCleanupRef.current = null;
      seekToMouseEvent(me, true);
      setDragging(false);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    dragCleanupRef.current = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [actions, seekToMouseEvent]);

  const animating = !playing && !dragging;
  const ticks = actions.length > 0 && actions.length <= 200 ? actions.map(a => ((a.startTime - fullMin) / fullDuration) * 100) : undefined;

  const canStop = playing || currentIndex > firstWindowIndex;

  return {
    playing, speed, currentIndex, percent, animating, screencastTime,
    togglePlay, stop, prev, next, cycleSpeed, selectAction, showSelectedAction,
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
