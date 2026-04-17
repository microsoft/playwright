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

/**
 * Protocol v1: single-tab interface. The extension manages debugger
 * attachment and forwards CDP events/commands through a thin wrapper.
 */

import type { ExtensionProtocolHandler, SendCommand, SendToPlaywright } from './cdpRelayHandler';
import type { ExtensionEventsV1 } from './protocol';

export class ExtensionProtocolV1 implements ExtensionProtocolHandler {
  private _sendCommand: SendCommand;
  private _sendToPlaywright: SendToPlaywright;
  private _connectedTabInfo: { targetInfo: any; sessionId: string } | undefined;
  private _nextSessionId = 1;

  constructor(sendCommand: SendCommand, sendToPlaywright: SendToPlaywright) {
    this._sendCommand = sendCommand;
    this._sendToPlaywright = sendToPlaywright;
  }

  handleExtensionEvent(method: string, params: any): void {
    switch (method) {
      case 'forwardCDPEvent': {
        const p = params as ExtensionEventsV1['forwardCDPEvent']['params'];
        const sessionId = p.sessionId || this._connectedTabInfo?.sessionId;
        this._sendToPlaywright({
          sessionId,
          method: p.method,
          params: p.params,
        });
        break;
      }
    }
  }

  async handleCDPCommand(method: string, params: any, sessionId: string | undefined): Promise<{ result: any } | undefined> {
    switch (method) {
      case 'Target.setAutoAttach': {
        if (sessionId)
          return undefined;
        const { targetInfo } = await this._sendCommand('attachToTab', {});
        this._connectedTabInfo = {
          targetInfo,
          sessionId: `pw-tab-${this._nextSessionId++}`,
        };
        this._sendToPlaywright({
          method: 'Target.attachedToTarget',
          params: {
            sessionId: this._connectedTabInfo.sessionId,
            targetInfo: {
              ...this._connectedTabInfo.targetInfo,
              attached: true,
            },
            waitingForDebugger: false,
          },
        });
        return { result: {} };
      }
      case 'Target.getTargetInfo': {
        return { result: this._connectedTabInfo?.targetInfo };
      }
      case 'Target.createTarget': {
        throw new Error('Tab creation is not supported yet.');
      }
    }
    return undefined;
  }

  async forwardToExtension(method: string, params: any, sessionId: string | undefined): Promise<any> {
    // Top level sessionId is only passed between the relay and the client.
    if (this._connectedTabInfo?.sessionId === sessionId)
      sessionId = undefined;
    return await this._sendCommand('forwardCDPCommand', { sessionId, method, params });
  }

  reset(): void {
    this._connectedTabInfo = undefined;
  }
}
