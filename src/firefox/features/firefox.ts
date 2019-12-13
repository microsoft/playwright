// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { Browser } from '../Browser';
import { Connection } from '../Connection';

export class Firefox {
  private _connection: Connection;

  constructor(browser: Browser) {
    this._connection = browser._connection;
  }

  wsEndpoint(): string {
    return this._connection.url();
  }
}
