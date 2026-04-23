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

import type { Annotation } from './annotations';
import type { DashboardChannel, DashboardChannelEvents, MouseButton, SessionStatus, Tab } from './dashboardChannel';
import type { ClientInfo } from '../../playwright-core/src/tools/cli-client/registry';
import type { BrowserDescriptor } from '../../playwright-core/src/serverRegistry';

export type { SessionStatus } from './dashboardChannel';

export type Mode = 'readonly' | 'interactive' | 'annotate';

export type RecordingState =
  | { phase: 'recording' }
  | { phase: 'stopped'; blob: Blob; blobUrl: string };

export type AnnotateFrame = { data: string; viewportWidth: number; viewportHeight: number };

export type DashboardState = {
  // Session model state.
  sessions: SessionStatus[];
  clientInfo: ClientInfo | undefined;
  loadingSessions: boolean;
  // Dashboard / page state.
  tabs: Tab[] | null;
  liveFrame: DashboardChannelEvents['frame'] | undefined;
  annotateFrame: AnnotateFrame | undefined;
  pendingAnnotate: { initiator: 'cli' | 'user' } | null;
  annotateInitiator: 'cli' | 'user' | null;
  mode: Mode;
  recording: RecordingState | null;
};

type Listener = () => void;

const initialState: DashboardState = {
  sessions: [],
  clientInfo: undefined,
  loadingSessions: true,
  tabs: null,
  liveFrame: undefined,
  annotateFrame: undefined,
  pendingAnnotate: null,
  annotateInitiator: null,
  mode: 'readonly',
  recording: null,
};

export class DashboardModel {
  state: DashboardState = initialState;

  private _client: DashboardChannel;
  private _listeners = new Set<Listener>();
  // Monotonic token to invalidate in-flight screenshot requests when
  // pendingAnnotate is cleared or replaced.
  private _requestId = 0;

  constructor(client: DashboardChannel) {
    this._client = client;
    client.on('sessions', params => this._emit({ sessions: params.sessions, clientInfo: params.clientInfo, loadingSessions: false }));
    client.on('tabs', params => this._emit({ tabs: params.tabs }));
    client.on('frame', params => this._emit({ liveFrame: params }));
    client.on('annotate', () => this.enterAnnotate('cli'));
    client.on('cancelAnnotate', () => this.cancelAnnotate());
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

  deleteSessionData(descriptor: BrowserDescriptor) {
    void this._client.deleteSessionData({ browser: descriptor.browser.guid });
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
    this._emit({ mode: next });
  }

  // Public action methods are sync fire-and-forget wrappers around the
  // async private implementations. Callers from the GUI use the sync
  // variants; intra-model flows `await` the private variants when they
  // need to sequence mode switches correctly.

  enterAnnotate(initiator: 'cli' | 'user') {
    void this._enterAnnotate(initiator);
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

  cancelAnnotate() {
    this._requestId++;
    const s = this.state;
    this._emit({
      mode: s.mode === 'annotate' ? 'readonly' : s.mode,
      annotateFrame: undefined,
      pendingAnnotate: null,
      annotateInitiator: null,
    });
  }

  async submitAnnotation(data: string | undefined, annotations: Annotation[]) {
    await this._client.submitAnnotation({
      data,
      annotations: annotations.map(a => ({ x: a.x, y: a.y, width: a.width, height: a.height, text: a.text })),
    });
    this.cancelAnnotate();
  }

  private async _enterAnnotate(initiator: 'cli' | 'user') {
    await this._cleanupOnModeSwitch();
    this._requestAnnotate(initiator);
  }

  private async _completeAnnotation() {
    const s = this.state;
    if (s.mode === 'annotate' && s.annotateInitiator === 'cli' && s.annotateFrame)
      await this.submitAnnotation(undefined, []).catch(() => {});
    this.cancelAnnotate();
  }

  private async _startRecording() {
    await this._cleanupOnModeSwitch();
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

  private async _cleanupOnModeSwitch() {
    await this._discardRecording();
    await this._completeAnnotation();
  }

  private _requestAnnotate(initiator: 'cli' | 'user') {
    const s = this.state;
    if (s.mode === 'annotate') {
      if (initiator === 'cli' && s.annotateInitiator !== 'cli')
        this._emit({ annotateInitiator: 'cli' });
      return;
    }
    if (s.pendingAnnotate) {
      if (initiator === 'cli' && s.pendingAnnotate.initiator !== 'cli')
        this._emit({ pendingAnnotate: { initiator: 'cli' } });
      return;
    }
    const myId = ++this._requestId;
    this._emit({ pendingAnnotate: { initiator } });
    void this._fetchScreenshot(myId);
  }

  private async _fetchScreenshot(id: number) {
    let frame: AnnotateFrame | undefined;
    try {
      frame = await this._client.screenshot();
    } catch {
      // frame stays undefined
    }
    if (id !== this._requestId)
      return;
    const s = this.state;
    if (!s.pendingAnnotate)
      return;
    if (!frame) {
      this._emit({ pendingAnnotate: null });
      return;
    }
    this._emit({
      mode: 'annotate',
      annotateFrame: frame,
      annotateInitiator: s.pendingAnnotate.initiator,
      pendingAnnotate: null,
    });
  }

  private _emit(partial: Partial<DashboardState>) {
    this.state = { ...this.state, ...partial };
    for (const listener of this._listeners)
      listener();
  }
}

function base64ToBlob(base64: string, mime: string): Blob {
  return new Blob([(Uint8Array as any).fromBase64(base64)], { type: mime });
}
