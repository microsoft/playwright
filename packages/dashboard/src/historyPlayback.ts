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

import type { HistoryCluster } from './dashboardChannel';
import type { DashboardModel } from './dashboardModel';

const MIME = 'video/webm; codecs="vp8"';
const SEEK_TOLERANCE_SEC = 0.05;
const SUPPORTS_MSE = typeof window !== 'undefined' && 'MediaSource' in window && MediaSource.isTypeSupported(MIME);

// Owns the per-session MSE playback pipeline: the <video> element, the
// MediaSource, the SourceBuffer, and seek scheduling. One controller per
// scrubber. The React shell mounts the controller's `<video>` into the
// container it wants to render the playback in.
//
// Kept as a plain class (not a hook) because the MSE state machine
// (MediaSource + SourceBuffer + append chain + pending seek + object URL)
// is exactly the kind of imperative resource that doesn't fit React's
// declarative model: a hook version would need 5+ refs and a useEffect
// cleanup that manually tears down the same state graph, with no
// semantic gain.
//
// Reads the cluster manifest from the model — every seek picks the
// covering cluster deterministically and fetches its exact byte range,
// so there's no guesswork on either side of the wire.
export class HistoryPlayback {
  readonly video: HTMLVideoElement;

  private readonly _model: DashboardModel;
  private _mediaSource: MediaSource | null = null;
  private _sourceBuffer: SourceBuffer | null = null;
  private _objectUrl: string | null = null;
  private _initLoaded = false;
  // Single tail of appendBuffer calls. The next append always chains
  // off the previous one, so we never race on `SourceBuffer.updating`.
  private _appendChain: Promise<void> = Promise.resolve();
  private _pendingSeekSec: number | null = null;
  private _disposed = false;
  // Unsubscribe from model updates; rebound when clusters arrive after
  // a seek targeting the live edge so we can append the freshly-landed
  // cluster.
  private _unsubscribe: (() => void) | null = null;

  constructor(model: DashboardModel) {
    this._model = model;
    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.controls = false;
    this.video.style.width = '100%';
    this.video.style.height = '100%';
    this.video.style.objectFit = 'contain';
    this.video.style.background = '#000';
    if (SUPPORTS_MSE)
      this._setupMediaSource();
    this._unsubscribe = model.subscribe(() => this._onModelChange());
  }

  // Stable callback ref: pass straight to a React `<div ref={...}>`. The
  // controller appends its `<video>` into that container, and removes it
  // again when React invokes the ref with `null`.
  readonly mountRef = (container: HTMLElement | null): void => {
    if (!container) {
      this.video.remove();
      return;
    }
    container.appendChild(this.video);
  };

  // Request that playback shows the frame at `wallClockMs`. Idempotent
  // and re-entrant — picks the covering cluster from the model's
  // manifest, fetches it (model dedupes), and seeks once buffered.
  seek(wallClockMs: number): void {
    if (!SUPPORTS_MSE)
      return;
    const clusters = this._model.state.history.clusters;
    if (clusters.length === 0)
      return;
    const originWallMs = clusters[0].startWallMs;
    const targetSec = Math.max(0, wallClockMs - originWallMs) / 1000;
    // While playing, the scrubber's `timeupdate` handler echoes the
    // current playhead back through model.setScrubTime → seek(). By the
    // time this seek runs, the video has naturally advanced past the
    // echo target; honoring it would yank playback backward and lock us
    // in a flicker. Recognise the echo (target at-or-slightly-behind
    // currentTime while playing) and let playback continue.
    if (!this.video.paused) {
      const diff = this.video.currentTime - targetSec;
      if (diff >= 0 && diff < 1) {
        this._pendingSeekSec = null;
        return;
      }
    }
    this._pendingSeekSec = targetSec;
    const pick = this._coveringCluster(wallClockMs);
    if (!pick)
      return;
    const { cluster, index } = pick;
    // Snap pending seek into the cluster's coverage if it lands in a gap
    // (e.g. static page → target after the latest cluster, or target
    // before the first cluster). This is deterministic: the manifest
    // tells us exactly where each cluster's coverage starts.
    const endWallMs = clusters[index + 1]?.startWallMs ?? Date.now();
    if (wallClockMs > endWallMs)
      this._pendingSeekSec = (endWallMs - originWallMs) / 1000 - SEEK_TOLERANCE_SEC;
    else if (wallClockMs < cluster.startWallMs)
      this._pendingSeekSec = (cluster.startWallMs - originWallMs) / 1000;
    this._maybeSatisfyPendingSeek();
    void this._ensureClusterBuffered(cluster);
  }

  async play(): Promise<void> {
    if (this.video.readyState < 2 /* HAVE_CURRENT_DATA */) {
      await new Promise<void>(resolve => {
        const onReady = () => {
          this.video.removeEventListener('loadeddata', onReady);
          this.video.removeEventListener('canplay', onReady);
          resolve();
        };
        this.video.addEventListener('loadeddata', onReady);
        this.video.addEventListener('canplay', onReady);
      });
    }
    await this.video.play().catch(() => {});
  }

  pause(): void {
    this.video.pause();
  }

  dispose(): void {
    if (this._disposed)
      return;
    this._disposed = true;
    this._unsubscribe?.();
    this._unsubscribe = null;
    const ms = this._mediaSource;
    const url = this._objectUrl;
    if (ms && ms.readyState === 'open')
      try { ms.endOfStream(); } catch { /* already closed */ }
    if (url)
      URL.revokeObjectURL(url);
    this.video.removeAttribute('src');
    try { this.video.load(); } catch { /* ignore */ }
    if (this.video.parentElement)
      this.video.parentElement.removeChild(this.video);
    this._mediaSource = null;
    this._sourceBuffer = null;
    this._objectUrl = null;
  }

  private _setupMediaSource(): void {
    const ms = new MediaSource();
    this._mediaSource = ms;
    const url = URL.createObjectURL(ms);
    this._objectUrl = url;
    this.video.src = url;

    ms.addEventListener('sourceopen', () => {
      if (this._disposed)
        return;
      const sb = ms.addSourceBuffer(MIME);
      sb.mode = 'segments';
      this._sourceBuffer = sb;
      // Whenever an append completes, retry any pending seek so we pick
      // up the moment we can satisfy it.
      sb.addEventListener('updateend', () => {
        if (this._disposed)
          return;
        this._maybeSatisfyPendingSeek();
      });
      void this._loadInit();
    });
  }

  private async _loadInit(): Promise<void> {
    const initBytes = this._model.state.history.init;
    if (this._disposed || !initBytes || this._initLoaded)
      return;
    await this._append(initBytes);
    this._initLoaded = true;
    const clusters = this._model.state.history.clusters;
    if (this._pendingSeekSec !== null && clusters.length > 0) {
      const wallMs = clusters[0].startWallMs + this._pendingSeekSec * 1000;
      const pick = this._coveringCluster(wallMs);
      if (pick)
        await this._ensureClusterBuffered(pick.cluster);
    }
  }

  // Pick the cluster whose coverage window covers `wallClockMs`, or — if
  // it falls in a gap — the closest preceding cluster. Returns null when
  // the manifest is empty. Returns the cluster's index so callers can
  // derive coverage end via `clusters[index+1]`.
  private _coveringCluster(wallClockMs: number): { cluster: HistoryCluster; index: number } | null {
    const clusters = this._model.state.history.clusters;
    if (clusters.length === 0)
      return null;
    // Binary search for the last cluster whose startWallMs <= wallClockMs.
    let lo = 0;
    let hi = clusters.length - 1;
    let pick = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (clusters[mid].startWallMs <= wallClockMs) {
        pick = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    // Target before the first cluster — snap forward to it.
    if (pick === -1)
      return { cluster: clusters[0], index: 0 };
    return { cluster: clusters[pick], index: pick };
  }

  // Make sure the cluster's bytes are present in the SourceBuffer's
  // buffered range. Uses `buffered` itself as the dedupe signal — so if
  // the browser evicts under memory pressure we transparently re-append
  // on the next seek through the same window.
  private async _ensureClusterBuffered(cluster: HistoryCluster): Promise<void> {
    const clusters = this._model.state.history.clusters;
    if (clusters.length === 0)
      return;
    const targetSec = (cluster.startWallMs - clusters[0].startWallMs) / 1000;
    if (this._coversBuffered(targetSec))
      return;
    const bytes = await this._model.readBytes(cluster.fileOffset, cluster.byteLen);
    if (this._disposed || !bytes || !this._initLoaded)
      return;
    if (this._coversBuffered(targetSec))
      return;
    await this._append(bytes);
  }

  // Serialise appends through a single promise chain. `appendBuffer` only
  // sets `sb.updating` synchronously; the slot isn't actually free until
  // `updateend` fires.
  private _append(bytes: Uint8Array): Promise<void> {
    this._appendChain = this._appendChain.then(() => new Promise<void>((resolve, reject) => {
      const sb = this._sourceBuffer;
      if (!sb || this._disposed) {
        resolve();
        return;
      }
      const onDone = () => {
        sb.removeEventListener('updateend', onDone);
        sb.removeEventListener('error', onError);
        resolve();
      };
      const onError = () => {
        sb.removeEventListener('updateend', onDone);
        sb.removeEventListener('error', onError);
        reject(new Error('SourceBuffer append failed'));
      };
      sb.addEventListener('updateend', onDone);
      sb.addEventListener('error', onError);
      try {
        // appendBuffer expects an ArrayBuffer-backed BufferSource. Both
        // callers (init/chunk bytes from Uint8Array.fromBase64 in
        // dashboardModel) hand us Uint8Arrays whose `buffer` is in fact
        // an ArrayBuffer — TS's lib types just widen it to ArrayBufferLike.
        sb.appendBuffer(bytes as Uint8Array<ArrayBuffer>);
      } catch (e) {
        sb.removeEventListener('updateend', onDone);
        sb.removeEventListener('error', onError);
        reject(e as Error);
      }
    })).catch(() => { /* swallow; next append is independent */ });
    return this._appendChain;
  }

  private _coversBuffered(targetSec: number): boolean {
    const sb = this._sourceBuffer;
    if (!sb)
      return false;
    for (let i = 0; i < sb.buffered.length; i++) {
      if (sb.buffered.start(i) - SEEK_TOLERANCE_SEC <= targetSec && targetSec <= sb.buffered.end(i) + SEEK_TOLERANCE_SEC)
        return true;
    }
    return false;
  }

  private _maybeSatisfyPendingSeek(): void {
    const target = this._pendingSeekSec;
    if (target === null)
      return;
    if (!this._coversBuffered(target))
      return;
    if (Math.abs(this.video.currentTime - target) < SEEK_TOLERANCE_SEC) {
      this._pendingSeekSec = null;
      return;
    }
    try {
      this.video.currentTime = target;
      this._pendingSeekSec = null;
    } catch {
      // not seekable yet — leave pendingSeekSec set so next updateend retries.
    }
  }

  // When the model emits (e.g. a `historyCluster` event landed), the
  // covering cluster for an outstanding seek may have just appeared.
  // Re-run the buffering path so we fetch + append it.
  private _onModelChange(): void {
    if (this._disposed || this._pendingSeekSec === null || !this._initLoaded)
      return;
    const clusters = this._model.state.history.clusters;
    if (clusters.length === 0)
      return;
    const wallMs = clusters[0].startWallMs + this._pendingSeekSec * 1000;
    const pick = this._coveringCluster(wallMs);
    if (!pick)
      return;
    void this._ensureClusterBuffered(pick.cluster);
  }
}

// Capture the frame currently displayed by an MSE-fed <video> as PNG bytes.
// Lives alongside the controller because it operates on the same `<video>`
// the controller owns.
export async function captureVideoFrameAsPng(video: HTMLVideoElement): Promise<{ data: string; viewportWidth: number; viewportHeight: number } | null> {
  if (!video.videoWidth || !video.videoHeight)
    return null;
  if (video.readyState < 2 /* HAVE_CURRENT_DATA */)
    return null;
  if (video.seeking)
    return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx)
      return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob)
      return null;
    const buf = await blob.arrayBuffer();
    return {
      data: new Uint8Array(buf).toBase64(),
      viewportWidth: canvas.width,
      viewportHeight: canvas.height,
    };
  } catch {
    return null;
  }
}
