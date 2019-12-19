// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.


export class Firefox {
  private _browserWSEndpoint: string;

  constructor(browserWSEndpoint: string) {
    this._browserWSEndpoint = browserWSEndpoint;
  }

  wsEndpoint(): string {
    return this._browserWSEndpoint;
  }
}
