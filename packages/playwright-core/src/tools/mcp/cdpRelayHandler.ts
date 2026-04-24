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

export type CDPMessage = {
  id?: number;
  sessionId?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: { code?: number; message: string };
};

export type SendCommand = (method: string, params: any) => Promise<any>;
export type SendToPlaywright = (message: CDPMessage) => void;

export interface ExtensionProtocolHandler {
  // Handle an event from the extension. Sends CDP events to Playwright as needed.
  handleExtensionEvent(method: string, params: any): void;
  // Handle a protocol-specific CDP command.
  // Returns { result } if handled, undefined to fall through to forwarding.
  handleCDPCommand(method: string, params: any, sessionId: string | undefined): Promise<{ result: any } | undefined>;
  // Forward a CDP command to the extension.
  forwardToExtension(method: string, params: any, sessionId: string | undefined): Promise<any>;
}
