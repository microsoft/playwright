// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as types from './types';

export type Point = types.Point;
export type HttpHeaders = types.HttpHeaders;

export interface Keyboard {
  down(key: string, options?: { text?: string }): Promise<void>;
  press(key: string, options?: { text?: string, delay?: number }): Promise<void>;
  sendCharacters(text: string): Promise<void>;
  type(text: string, options?: { delay?: number }): Promise<void>;
  up(key: string): Promise<void>;
}

export interface Mouse {
  move(x: number, y: number, options?: { steps?: number }): Promise<void>;
  down(options?: { button?: types.MouseButton, clickCount?: number }): Promise<void>;
  up(options?: { button?: types.MouseButton, clickCount?: number }): Promise<void>;
  click(x: number, y: number, options?: types.ClickOptions): Promise<void>;
  dblclick(x: number, y: number, options?: types.DoubleClickOptions): Promise<void>;
  tripleclick(x: number, y: number, options?: types.TripleClickOptions): Promise<void>;
}

export interface Request {
  url(): string;
  resourceType(): string;
  method(): string;
  postData(): string | undefined;
  headers(): types.HttpHeaders;
  isNavigationRequest(): boolean;
  redirectChain(): Request[];
  failure(): { errorText: string; } | null;
  response(): Response | null;
  frame(): Frame | null;
}

export interface Response {
  request(): Request;
  url(): string;
  ok(): boolean;
  status(): number;
  statusText(): string;
  headers(): types.HttpHeaders;
  buffer(): Promise<Buffer>;
  text(): Promise<string>;
  json(): Promise<any>;
  remoteAddress(): types.NetworkRemoteAddress;
  frame(): Frame | null;
}

export interface Frame {
}
