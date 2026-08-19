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
import type * as trace from '@trace/trace';

export type VideoThumbnail = {
  timestamp: number;
  url: string;
  width: number;
  height: number;
};

type CacheEntry = {
  thumbnails: VideoThumbnail[];
  listeners: Set<() => void>;
  started: boolean;
};

const cache = new Map<string, CacheEntry>();

const maxThumbnails = 120;
const thumbnailsPerSecond = 2;

export function useVideoThumbnails(video: trace.VideoTraceEvent | undefined, videoUrl: string | undefined): VideoThumbnail[] {
  const [, setVersion] = React.useState(0);
  const entry = video && videoUrl ? ensureEntry(video, videoUrl) : undefined;
  React.useEffect(() => {
    if (!entry)
      return;
    const listener = () => setVersion(version => version + 1);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  }, [entry]);
  return entry?.thumbnails ?? [];
}

function ensureEntry(video: trace.VideoTraceEvent, videoUrl: string): CacheEntry {
  let entry = cache.get(videoUrl);
  if (!entry) {
    entry = { thumbnails: [], listeners: new Set(), started: false };
    cache.set(videoUrl, entry);
  }
  if (!entry.started) {
    entry.started = true;
    void generateThumbnails(entry, video, videoUrl).catch(() => {});
  }
  return entry;
}

async function generateThumbnails(entry: CacheEntry, video: trace.VideoTraceEvent, videoUrl: string): Promise<void> {
  const response = await fetch(videoUrl);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const element = document.createElement('video');
  element.muted = true;
  element.preload = 'auto';
  element.src = objectUrl;
  try {
    await new Promise<void>((resolve, reject) => {
      element.addEventListener('loadedmetadata', () => resolve(), { once: true });
      element.addEventListener('error', () => reject(new Error('video failed to load')), { once: true });
    });
    let duration = element.duration;
    if (!isFinite(duration) || duration <= 0) {
      element.currentTime = Number.MAX_SAFE_INTEGER;
      await new Promise<void>(resolve => element.addEventListener('seeked', () => resolve(), { once: true }));
      duration = element.duration;
      if (!isFinite(duration) || duration <= 0)
        return;
    }
    const width = element.videoWidth || video.width;
    const height = element.videoHeight || video.height;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context)
      return;
    const count = Math.max(1, Math.min(maxThumbnails, Math.ceil(duration * thumbnailsPerSecond)));
    const step = duration / count;
    for (let i = 0; i <= count; ++i) {
      const time = Math.min(i * step, Math.max(0, duration - 0.001));
      await seek(element, time);
      context.drawImage(element, 0, 0, width, height);
      const frame = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!frame)
        continue;
      entry.thumbnails.push({
        timestamp: video.timestampOrigin + time * 1000,
        url: URL.createObjectURL(frame),
        width,
        height,
      });
      for (const listener of entry.listeners)
        listener();
    }
  } finally {
    element.removeAttribute('src');
    element.load();
    URL.revokeObjectURL(objectUrl);
  }
}

async function seek(element: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(element.currentTime - time) < 0.001 && element.readyState >= 2)
    return;
  await new Promise<void>(resolve => {
    element.addEventListener('seeked', () => resolve(), { once: true });
    element.currentTime = time;
  });
}
