/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Connection } from '../Connection';

export class Permissions {
  private _connection: Connection;
  private _browserContextId: string;

  constructor(connection: Connection, browserContextId: string | null) {
    this._connection = connection;
    this._browserContextId = browserContextId;
  }


  async override(origin: string, permissions: Array<string>) {
    const webPermissionToProtocol = new Map([
      ['geolocation', 'geo'],
      ['microphone', 'microphone'],
      ['camera', 'camera'],
      ['notifications', 'desktop-notifications'],
    ]);
    permissions = permissions.map(permission => {
      const protocolPermission = webPermissionToProtocol.get(permission);
      if (!protocolPermission)
        throw new Error('Unknown permission: ' + permission);
      return protocolPermission;
    });
    await this._connection.send('Browser.grantPermissions', {origin, browserContextId: this._browserContextId || undefined, permissions});
  }

  async clearOverrides() {
    await this._connection.send('Browser.resetPermissions', {browserContextId: this._browserContextId || undefined});
  }
}
