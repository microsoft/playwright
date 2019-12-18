// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as js from './javascript';

export type ConsoleMessageLocation = {
  url?: string,
  lineNumber?: number,
  columnNumber?: number,
};

export class ConsoleMessage {
  private _type: string;
  private _text?: string;
  private _args: js.JSHandle[];
  private _location: ConsoleMessageLocation;

  constructor(type: string, text: string | undefined, args: js.JSHandle[], location?: ConsoleMessageLocation) {
    this._type = type;
    this._text = text;
    this._args = args;
    this._location = location || {};
  }

  type(): string {
    return this._type;
  }

  text(): string {
    if (this._text === undefined)
      this._text = this._args.map(arg => arg._context._delegate.handleToString(arg, false /* includeType */)).join(' ');
    return this._text;
  }

  args(): js.JSHandle[] {
    return this._args;
  }

  location(): ConsoleMessageLocation {
    return this._location;
  }
}
