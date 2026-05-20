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

import { HistoryPlayback } from './historyPlayback';

import type { DashboardModel } from './dashboardModel';

// Thin React shell over the imperative HistoryPlayback controller.
//
// The component owns one controller instance for its lifetime. The
// callback ref is the lifecycle — created when React hands us a
// container element, disposed when it hands us null. No useEffect; the
// controller's `seek` is idempotent so we call it inline during render.
//
// Two HistoryPlayer instances can coexist (live-scrub + hover preview):
// each gets its own controller and its own `<video>`, but they share
// the recorder init segment and the per-chunk fetch cache via
// `DashboardModel`, so the second one isn't a network cold-start.
type HistoryPlayerProps = {
  model: DashboardModel;
  // Recorder-relative wall-clock ms to display.
  time: number;
  className?: string;
  // Optional handle on the underlying <video> for screenshot capture.
  // Receives the element on mount and null on unmount.
  videoRef?: React.MutableRefObject<HTMLVideoElement | null>;
  // Optional handle on the playback controller for parents that need to
  // call `play()`/`pause()` or read its snapshot (buffered ranges,
  // fetch state).
  playbackRef?: React.MutableRefObject<HistoryPlayback | null>;
};

export const HistoryPlayer: React.FC<HistoryPlayerProps> = ({ model, time, className, videoRef, playbackRef }) => {
  // The controller instance lives in a ref pinned to the component
  // instance. It's created/destroyed exclusively through the callback
  // ref below — never during render.
  const controllerRef = React.useRef<HistoryPlayback | null>(null);
  // Latest `time` kept in a ref so the mount callback can read it
  // without re-binding (which would dispose+recreate the controller
  // every time `time` changes).
  const timeRef = React.useRef(time);
  timeRef.current = time;

  const mountRef = React.useCallback((el: HTMLDivElement | null) => {
    if (el) {
      if (!controllerRef.current)
        controllerRef.current = new HistoryPlayback(model);
      const c = controllerRef.current;
      if (!c)
        return;
      c.mountRef(el);
      c.video.className = className ?? 'history-player';
      if (videoRef)
        videoRef.current = c.video;
      if (playbackRef)
        playbackRef.current = c;
      // Initial seek — between mount and the next render there's no
      // other code that would tell the controller what to display.
      c.seek(timeRef.current);
    } else {
      if (videoRef)
        videoRef.current = null;
      if (playbackRef)
        playbackRef.current = null;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    }
  }, [model, videoRef, playbackRef, className]);

  // Drive seek imperatively. Safe to call on every render — the
  // controller dedupes and noops when the target is already buffered.
  controllerRef.current?.seek(time);

  return <div ref={mountRef} className={className ?? 'history-player'} />;
};
HistoryPlayer.displayName = 'HistoryPlayer';

export { captureVideoFrameAsPng } from './historyPlayback';
