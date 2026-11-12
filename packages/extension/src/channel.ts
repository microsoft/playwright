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


const OPEN_TIMEOUT_MS = 5000;

export class Channel {
  private _ws: WebSocket;
  private _closed = false;

  onCommand?: (method: string, params: any[]) => Promise<unknown>;
  onClose?: () => void;

  static async open(url: string): Promise<Channel> {
    const ws = new WebSocket(url);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('WebSocket error'));
        timer = setTimeout(() => reject(new Error('Connection timeout')), OPEN_TIMEOUT_MS);
      });
    } catch (error: any) {
      ws.close();
      throw new Error(`Failed to connect to MCP relay: ${error.message}`);
    } finally {
      clearTimeout(timer);
    }
    return new Channel(ws);
  }

  private constructor(ws: WebSocket) {
    this._ws = ws;
    this._ws.onmessage = event => void this._onMessage(event.data);
    this._ws.onclose = () => this._didClose();
  }

  get closed(): boolean {
    return this._closed;
  }

  sendEvent(method: string, params: unknown[]): void {
    this._send({ method, params });
  }

  close(reason: string): void {
    this._ws.close(1000, reason);
    // onclose fires asynchronously.
    this._didClose();
  }

  private async _onMessage(data: string): Promise<void> {
    let message: { id: number, method: string, params?: any[] };
    try {
      message = JSON.parse(data);
    } catch (error: any) {
      // An error response needs the id of the command, which is not known.
      this.close(`Error parsing message: ${error.message}`);
      return;
    }
    try {
      const result = await this.onCommand!(message.method, message.params ?? []);
      this._send({ id: message.id, result: result ?? {} });
    } catch (error: any) {
      this._send({ id: message.id, error: error.message });
    }
  }

  private _send(message: object): void {
    if (this._ws.readyState === WebSocket.OPEN)
      this._ws.send(JSON.stringify(message));
  }

  private _didClose(): void {
    if (this._closed)
      return;
    this._closed = true;
    this.onClose?.();
  }
}
