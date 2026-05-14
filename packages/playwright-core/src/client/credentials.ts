/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { BrowserContext } from './browserContext';
import type * as api from '../../types/types';
import type * as channels from '@protocol/channels';

export class Credentials implements api.Credentials {
  private _browserContext: BrowserContext;

  constructor(browserContext: BrowserContext) {
    this._browserContext = browserContext;
  }

  async install(): Promise<void> {
    await this._browserContext._channel.credentialsInstall({});
  }

  async create(options: channels.BrowserContextCredentialsCreateParams): Promise<channels.VirtualCredential> {
    const { credential } = await this._browserContext._channel.credentialsCreate(options);
    return credential;
  }

  async get(options: channels.BrowserContextCredentialsGetParams = {}): Promise<channels.VirtualCredential[]> {
    const { credentials } = await this._browserContext._channel.credentialsGet(options);
    return credentials;
  }

  async delete(id: string): Promise<void> {
    await this._browserContext._channel.credentialsDelete({ id });
  }

  async setUserVerified(value: boolean): Promise<void> {
    await this._browserContext._channel.credentialsSetUserVerified({ value });
  }
}
