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

import * as React from 'react';

import type * as trace from '@isomorphic/trace/trace';

// Playback runs the video on its own clock and only resyncs when it drifts this far away.
const maxDriftSeconds = 0.25;

// Video that was recording at the given trace time, -1 when none has started yet.
export function lastVideoIndex(videos: trace.VideoTraceEvent[], time: number): number {
  let result = -1;
  videos.forEach((video, index) => {
    if (video.timestamp <= time && (result === -1 || video.timestamp > videos[result].timestamp))
      result = index;
  });
  return result;
}

export const VideoFrame: React.FunctionComponent<{
  url: string,
  // Video start in the trace time.
  startTime: number,
  // Trace time to render.
  time: number,
  playing?: boolean,
  speed?: number,
  className?: string,
  width?: number,
  height?: number,
}> = ({ url, startTime, time, playing, speed, className, width, height }) => {
  const ref = React.useRef<HTMLVideoElement>(null);
  const offset = Math.max(0, (time - startTime) / 1000);
  const offsetRef = React.useRef(offset);
  offsetRef.current = offset;

  React.useEffect(() => {
    const video = ref.current;
    if (!video)
      return;
    if (!playing) {
      video.pause();
      if (Math.abs(video.currentTime - offset) > 0.001)
        video.currentTime = offset;
      return;
    }
    video.playbackRate = speed ?? 1;
    if (Math.abs(video.currentTime - offset) > maxDriftSeconds)
      video.currentTime = offset;
    if (video.paused)
      void video.play().catch(() => {});
  }, [url, offset, playing, speed]);

  return <video
    ref={ref}
    className={className}
    src={url}
    width={width}
    height={height}
    muted
    playsInline
    preload='auto'
    onLoadedMetadata={event => event.currentTarget.currentTime = offsetRef.current}
  />;
};
