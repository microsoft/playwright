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

import { buildAnnotatedImage, saveAnnotationAsDownload } from './annotationImage';
import { buildAnnotationZip } from './annotationZip';
import { captureVideoFrameAsPng } from './historyPlayback';

import type { Annotation } from './annotations';
import type { DashboardChannel, DashboardChannelEvents, HistoryCluster, HistorySnapshot, MouseButton, SessionStatus, SubmittedAnnotationFrame, Tab } from './dashboardChannel';
import type { ClientInfo } from '../../playwright-core/src/tools/cli-client/registry';
import type { BrowserDescriptor } from '../../playwright-core/src/serverRegistry';

export type { SessionStatus } from './dashboardChannel';

export type Mode = 'readonly' | 'interactive' | 'annotate';

export type RecordingState =
  | { phase: 'recording' }
  | { phase: 'stopped'; blob: Blob; blobUrl: string };

export type AnnotateFrame = {
  id: string;
  data: string;
  viewportWidth: number;
  viewportHeight: number;
  // Wall-clock ms since epoch — same coordinate space as live frame
  // timestamps, so live and historical frames are directly comparable.
  timestamp: number;
  ariaSnapshot?: string;
  sessionTitle?: string;
  title?: string;
  url?: string;
  annotations: Annotation[];
};

export type AnnotateSession = {
  initiator: 'cli' | 'user';
  frames: AnnotateFrame[];
  selectedFrameId: string | null;
  focusAnnotationId: string | null;
  feedback: string;
};

export type HistoryState = {
  enabled: boolean;
  // True when the user is in scrub mode (history player visible).
  scrubMode: boolean;
  // Currently scrubbed time, in wall-clock ms.
  scrubTime: number;
  // While scrubbing, the bar's right edge is frozen here so the cursor
  // doesn't drift left as the wall clock keeps advancing.
  // null = use the live edge.
  scrubFrozenEndMs: number | null;
  // Cluster manifest pushed by the daemon. Each entry describes a
  // wallclock start and an exact byte range in the webm, so the frontend
  // knows precisely what's available and where to fetch it from. Reset
  // on every `history` event; rebuilt from subsequent `historyCluster`
  // events.
  clusters: HistoryCluster[];
  // Webm init segment bytes for the current recording, decoded once
  // from the base64 in the `history` event. null when no recording is
  // active. The MSE pipeline appends this verbatim before any cluster.
  init: Uint8Array | null;
};

export type DashboardState = {
  // Session model state.
  sessions: SessionStatus[];
  clientInfo: ClientInfo | undefined;
  loadingSessions: boolean;
  // Dashboard / page state.
  tabs: Tab[] | null;
  liveFrame: DashboardChannelEvents['frame'] | undefined;
  annotateSession: AnnotateSession | null;
  pendingCapture: boolean;
  mode: Mode;
  recording: RecordingState | null;
  history: HistoryState;
};

type Listener = () => void;

const initialState: DashboardState = {
  sessions: [],
  clientInfo: undefined,
  loadingSessions: true,
  tabs: null,
  liveFrame: undefined,
  annotateSession: null,
  pendingCapture: false,
  mode: 'readonly',
  recording: null,
  history: { enabled: false, scrubMode: false, scrubTime: 0, scrubFrozenEndMs: null, clusters: [], init: null },
};

// Returns the wall-clock range visible to the history scrubber. `startMs` is
// the first cluster's wallclock; `endMs` is the frozen scrub-entry time while
// scrubbing (so the cursor doesn't drift as wall-clock advances), or the
// live edge otherwise (max of latest frame and wall clock now).
export function historyTimeRange(history: HistoryState, liveFrame: { timestamp: number } | undefined): { startMs: number; endMs: number } {
  const liveEdge = Math.max(liveFrame?.timestamp ?? 0, Date.now());
  const end = history.scrubFrozenEndMs ?? liveEdge;
  const start = history.clusters[0]?.startWallMs ?? end;
  return { startMs: start, endMs: Math.max(start, end) };
}

function clamp(v: number, min: number, max: number): number {
  if (max < min)
    return min;
  return Math.min(Math.max(v, min), max);
}

export class DashboardModel {
  state: DashboardState = initialState;

  private _client: DashboardChannel;
  private _listeners = new Set<Listener>();
  // Monotonic token to invalidate in-flight screenshot requests when
  // pendingAnnotate is cleared or replaced.
  private _requestId = 0;
  private _bytesCache = new Map<number, Promise<Uint8Array>>();

  constructor(client: DashboardChannel) {
    this._client = client;
    client.on('sessions', params => this._emit({ sessions: params.sessions, clientInfo: params.clientInfo, loadingSessions: false }));
    client.on('tabs', params => this._emit({ tabs: params.tabs }));
    client.on('frame', params => this._emit({ liveFrame: params }));
    client.on('annotate', () => this.enterAnnotate('cli'));
    client.on('cancelAnnotate', () => this.cancelAnnotate(false));
    client.on('history', snapshot => this._onHistorySnapshot(snapshot));
    client.on('historyCluster', params => this._onHistoryCluster(params));
  }

  private _onHistorySnapshot(snapshot: HistorySnapshot) {
    this._bytesCache.clear();
    const initialState = {
      enabled: false,
      scrubMode: false,
      scrubTime: 0,
      scrubFrozenEndMs: null,
      clusters: [],
      init: null
    };
    if (!snapshot.enabled) {
      this._emit({ history: initialState });
      return;
    }
    this._emit({ history: { ...initialState, enabled: true, init: Uint8Array.fromBase64(snapshot.init) } });
  }

  private _onHistoryCluster(c: HistoryCluster) {
    const { history } = this.state;
    if (!history.enabled)
      return;
    history.clusters.push(c);
    this._emit({ history });
  }

  enterScrub(timeMs?: number) {
    const h = this.state.history;
    if (!h.enabled || h.clusters.length === 0)
      return;
    // Freeze the bar's right edge so the cursor stays where the user
    // put it as wall time keeps advancing.
    const frozenEnd = Math.max(this.state.liveFrame?.timestamp ?? 0, Date.now());
    const start = h.clusters[0].startWallMs;
    const t = clamp(timeMs ?? frozenEnd, start, frozenEnd);
    this._emit({ history: { ...h, scrubMode: true, scrubTime: t, scrubFrozenEndMs: frozenEnd } });
  }

  exitScrub() {
    const h = this.state.history;
    if (!h.scrubMode)
      return;
    this._emit({ history: { ...h, scrubMode: false, scrubFrozenEndMs: null } });
  }

  setScrubTime(timeMs: number) {
    const h = this.state.history;
    if (!h.scrubMode)
      return;
    const range = historyTimeRange(h, this.state.liveFrame);
    const t = clamp(timeMs, range.startMs, range.endMs);
    if (t === h.scrubTime)
      return;
    this._emit({ history: { ...h, scrubTime: t } });
  }

  readBytes(offset: number, length: number): Promise<Uint8Array | null> {
    const cached = this._bytesCache.get(offset);
    if (cached)
      return cached;
    const p = (async () => {
      const result = await this._client.recorderReadBytes({ offset, length });
      return Uint8Array.fromBase64(result.data);
    })();
    this._bytesCache.set(offset, p);
    p.catch(() => this._bytesCache.delete(offset));
    return p;
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  // Session actions.

  sessionByGuid(guid: string): SessionStatus | undefined {
    return this.state.sessions.find(s => s.browser.guid === guid);
  }

  closeSession(descriptor: BrowserDescriptor) {
    void this._client.closeSession({ browser: descriptor.browser.guid });
  }

  setVisible(visible: boolean) {
    void this._client.setVisible({ visible });
  }

  // Tab actions.

  selectTab(tab: Tab) {
    void this._client.selectTab({ browser: tab.browser, context: tab.context, page: tab.page });
  }

  closeTab(tab: Tab) {
    void this._client.closeTab({ browser: tab.browser, context: tab.context, page: tab.page });
  }

  newTab(browser: string, context: string) {
    void this._client.newTab({ browser, context });
  }

  // Navigation.

  navigate(url: string) {
    void this._client.navigate({ url });
  }

  back() {
    void this._client.back();
  }

  forward() {
    void this._client.forward();
  }

  reload() {
    void this._client.reload();
  }

  // Input.

  mousemove(x: number, y: number) {
    void this._client.mousemove({ x, y });
  }

  mousedown(x: number, y: number, button: MouseButton) {
    void this._client.mousedown({ x, y, button });
  }

  mouseup(x: number, y: number, button: MouseButton) {
    void this._client.mouseup({ x, y, button });
  }

  wheel(deltaX: number, deltaY: number) {
    void this._client.wheel({ deltaX, deltaY });
  }

  keydown(key: string) {
    void this._client.keydown({ key });
  }

  keyup(key: string) {
    void this._client.keyup({ key });
  }

  // Dashboard / page actions.

  toggleInteractive() {
    const next: Mode = this.state.mode === 'interactive' ? 'readonly' : 'interactive';
    if (next === 'interactive')
      void this._enterInteractive();
    else
      this._emit({ mode: next });
  }

  // Public action methods are sync fire-and-forget wrappers around the
  // async private implementations. Callers from the GUI use the sync
  // variants; intra-model flows `await` the private variants when they
  // need to sequence mode switches correctly.

  enterInteractive() {
    void this._enterInteractive();
  }

  enterAnnotate(initiator: 'cli' | 'user') {
    void this._enterAnnotate(initiator);
  }

  addAnnotateFrame() {
    void this._addAnnotateFrame();
  }

  selectAnnotateFrame(id: string, focusAnnotationId?: string) {
    const session = this.state.annotateSession;
    if (!session || !session.frames.find(f => f.id === id))
      return;
    this._emit({ annotateSession: { ...session, selectedFrameId: id, focusAnnotationId: focusAnnotationId ?? null }, mode: 'annotate' });
  }

  toggleSelectFrame(id: string) {
    const session = this.state.annotateSession;
    if (!session)
      return;
    if (session.selectedFrameId === id)
      this._emit({ annotateSession: { ...session, selectedFrameId: null, focusAnnotationId: null }, mode: 'readonly' });
    else
      this.selectAnnotateFrame(id);
  }

  deselectFrame() {
    const session = this.state.annotateSession;
    if (!session || session.selectedFrameId === null)
      return;
    this._emit({ annotateSession: { ...session, selectedFrameId: null, focusAnnotationId: null }, mode: 'readonly' });
  }

  removeAnnotateFrame(id: string) {
    const session = this.state.annotateSession;
    if (!session)
      return;
    const frames = session.frames.filter(f => f.id !== id);
    if (frames.length === 0) {
      this.cancelAnnotate();
      return;
    }
    const selectedFrameId = session.selectedFrameId === id ? null : session.selectedFrameId;
    this._emit({ annotateSession: { ...session, frames, selectedFrameId } });
  }

  updateFrameAnnotations(frameId: string, annotations: Annotation[]) {
    const session = this.state.annotateSession;
    if (!session)
      return;
    const frames = session.frames.map(f => f.id === frameId ? { ...f, annotations } : f);
    this._emit({ annotateSession: { ...session, frames } });
  }

  updateFeedback(feedback: string) {
    const session = this.state.annotateSession;
    if (!session)
      return;
    this._emit({ annotateSession: { ...session, feedback } });
  }

  completeAnnotation() {
    void this._completeAnnotation();
  }

  startRecording() {
    void this._startRecording();
  }

  stopRecording() {
    void this._stopRecording();
  }

  discardRecording() {
    void this._discardRecording();
  }

  cancelAnnotate(notifyServer = true) {
    this._requestId++;
    const s = this.state;
    if (notifyServer && s.annotateSession?.initiator === 'cli')
      void this._client.cancelAnnotation();
    this._emit({
      mode: s.mode === 'annotate' ? 'readonly' : s.mode,
      annotateSession: null,
      pendingCapture: false,
    });
  }

  async submitAnnotateSession() {
    const session = this.state.annotateSession;
    if (!session)
      return;
    const frames: SubmittedAnnotationFrame[] = [];
    for (const frame of session.frames) {
      const data = await renderFrameToBase64Png(frame);
      frames.push({
        data: data ?? frame.data,
        ariaSnapshot: frame.ariaSnapshot,
        annotations: frame.annotations.map(a => ({ x: a.x, y: a.y, width: a.width, height: a.height, text: a.text })),
        sessionTitle: frame.sessionTitle,
        title: frame.title,
        url: frame.url,
        viewportWidth: frame.viewportWidth,
        viewportHeight: frame.viewportHeight,
        timestamp: frame.timestamp,
      });
    }
    if (session.initiator === 'cli') {
      await this._client.submitAnnotation({ frames, feedback: session.feedback });
    } else {
      const blob = await buildAnnotationZip(frames, session.feedback);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const saved = await saveAnnotationAsDownload(blob, `annotations-${stamp}.zip`);
      if (!saved)
        return; // user cancelled the file picker — keep the session open
    }
    this.cancelAnnotate();
  }

  private async _enterInteractive() {
    const s = this.state;
    // Interactive coexists with the annotate sidebar; only the overlay is
    // dismissed so the live page is reachable.
    this._emit({
      mode: 'interactive',
      annotateSession: s.annotateSession?.selectedFrameId
        ? { ...s.annotateSession, selectedFrameId: null, focusAnnotationId: null }
        : s.annotateSession,
    });
  }

  private async _enterAnnotate(initiator: 'cli' | 'user') {
    const s = this.state;
    if (s.annotateSession) {
      // Session already open: capture another frame and select it.
      if (initiator === 'cli' && s.annotateSession.initiator !== 'cli')
        this._emit({ annotateSession: { ...s.annotateSession, initiator: 'cli' } });
      await this._addAnnotateFrame();
      return;
    }
    await this._discardRecording();
    await this._addAnnotateFrame(initiator);
  }

  private async _addAnnotateFrame(initiator?: 'cli' | 'user') {
    if (this.state.pendingCapture)
      return;
    const myId = ++this._requestId;
    this._emit({ pendingCapture: true });
    let frameData: Awaited<ReturnType<DashboardChannel['screenshot']>> | undefined;
    try {
      frameData = await this._client.screenshot();
    } catch {
      // ignore
    }
    if (myId !== this._requestId)
      return;
    if (!frameData) {
      this._emit({ pendingCapture: false });
      return;
    }
    const selectedTab = this.state.tabs?.find(t => t.selected);
    const sessionTitle = this.state.sessions.find(s => s.browser.guid === selectedTab?.browser)?.title ?? '';
    const frame: AnnotateFrame = {
      id: 'frm-' + Math.random().toString(36).slice(2, 10),
      data: frameData.data,
      viewportWidth: frameData.viewportWidth,
      viewportHeight: frameData.viewportHeight,
      timestamp: Date.now(),
      ariaSnapshot: frameData.ariaSnapshot,
      sessionTitle,
      title: selectedTab?.title ?? '',
      url: selectedTab?.url ?? '',
      annotations: [],
    };
    this._pushAnnotateFrame(frame, initiator);
  }

  async addHistoryAnnotateFrame(video: HTMLVideoElement | null) {
    if (!video || this.state.pendingCapture)
      return;
    const captured = await captureVideoFrameAsPng(video);
    if (!captured)
      return;
    if (!this.state.annotateSession)
      await this._discardRecording();
    const frame: AnnotateFrame = {
      id: 'frm-' + Math.random().toString(36).slice(2, 10),
      data: captured.data,
      viewportWidth: captured.viewportWidth,
      viewportHeight: captured.viewportHeight,
      timestamp: this.state.history.scrubTime,
      annotations: [],
    };
    this._pushAnnotateFrame(frame, 'user');
  }

  private _pushAnnotateFrame(frame: AnnotateFrame, initiator?: 'cli' | 'user') {
    const existing = this.state.annotateSession;
    const session: AnnotateSession = existing
      ? { ...existing, frames: [...existing.frames, frame], selectedFrameId: frame.id, focusAnnotationId: null }
      : { initiator: initiator ?? 'user', frames: [frame], selectedFrameId: frame.id, focusAnnotationId: null, feedback: '' };
    this._emit({ annotateSession: session, pendingCapture: false, mode: 'annotate' });
  }

  private async _completeAnnotation() {
    const s = this.state;
    if (s.annotateSession?.initiator === 'cli')
      await this.submitAnnotateSession().catch(() => {});
    else
      this.cancelAnnotate();
  }

  private async _startRecording() {
    // Recording closes any open annotate session.
    if (this.state.annotateSession)
      this.cancelAnnotate();
    await this._client.startRecording();
    this._emit({ recording: { phase: 'recording' } });
  }

  private async _stopRecording() {
    const { streamId } = await this._client.stopRecording();
    const chunks: Blob[] = [];
    while (true) {
      const { data, eof } = await this._client.readStream({ streamId });
      if (data)
        chunks.push(base64ToBlob(data, 'video/webm'));
      if (eof)
        break;
    }
    const blob = new Blob(chunks, { type: 'video/webm' });
    const blobUrl = URL.createObjectURL(blob);
    this._emit({ recording: { phase: 'stopped', blob, blobUrl } });
  }

  private async _discardRecording() {
    const s = this.state;
    if (s.recording?.phase === 'recording') {
      try {
        const { streamId } = await this._client.stopRecording();
        while (true) {
          const { eof } = await this._client.readStream({ streamId });
          if (eof)
            break;
        }
      } catch {
        // Ignore; still transition out.
      }
    }
    if (s.recording?.phase === 'stopped')
      URL.revokeObjectURL(s.recording.blobUrl);
    this._emit({ recording: null });
  }

  private _emit(partial: Partial<DashboardState>) {
    this.state = { ...this.state, ...partial };
    for (const listener of this._listeners)
      listener();
  }
}

async function renderFrameToBase64Png(frame: AnnotateFrame): Promise<string | undefined> {
  const img = new Image();
  img.src = 'data:image/png;base64,' + frame.data;
  try {
    await img.decode();
  } catch {
    return undefined;
  }
  const blob = await buildAnnotatedImage(img, frame.viewportWidth, frame.viewportHeight, frame.annotations);
  if (!blob)
    return undefined;
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf).toBase64();
}

function base64ToBlob(base64: string, mime: string): Blob {
  return new Blob([Uint8Array.fromBase64(base64)], { type: mime });
}
