/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import { CDPSession } from '../Connection';

export class Overrides {
  private _client: CDPSession;

  constructor(client: CDPSession) {
    this._client = client;
  }

  async setGeolocation(options: { longitude: number; latitude: number; accuracy: (number | undefined); }) {
    const { longitude, latitude, accuracy = 0} = options;
    if (longitude < -180 || longitude > 180)
      throw new Error(`Invalid longitude "${longitude}": precondition -180 <= LONGITUDE <= 180 failed.`);
    if (latitude < -90 || latitude > 90)
      throw new Error(`Invalid latitude "${latitude}": precondition -90 <= LATITUDE <= 90 failed.`);
    if (accuracy < 0)
      throw new Error(`Invalid accuracy "${accuracy}": precondition 0 <= ACCURACY failed.`);
    await this._client.send('Emulation.setGeolocationOverride', {longitude, latitude, accuracy});
  }

  async setTimezone(timezoneId: string | null) {
    try {
      await this._client.send('Emulation.setTimezoneOverride', {timezoneId: timezoneId || ''});
    } catch (exception) {
      if (exception.message.includes('Invalid timezone'))
        throw new Error(`Invalid timezone ID: ${timezoneId}`);
      throw exception;
    }
  }
}
