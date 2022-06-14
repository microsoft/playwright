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

// see http://www.softwareishard.com/blog/har-12-spec/
export type HARLog = {
  version: string;
  creator: HARCreator;
  browser: HARBrowser;
  pages: HARPage[];
  entries: HAREntry[];
};

export type HARCreator = {
  name: string;
  version: string;
};

export type HARBrowser = {
  name: string;
  version: string;
};

export type HARPage = {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: HARPageTimings;
};

export type HARPageTimings = {
  onContentLoad: number;
  onLoad: number;
};

export type HAREntry = {
  pageref?: string;
  startedDateTime: string;
  time: number;
  request: HARRequest;
  response: HARResponse;
  cache: HARCache;
  timings: HARTimings;
  serverIPAddress?: string;
  connection?: string;
};

export type HARRequest = {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HARCookie[];
  headers: HARHeader[];
  queryString: HARQueryParameter[];
  postData?: HARPostData;
  headersSize: number;
  bodySize: number;
};

export type HARResponse = {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HARCookie[];
  headers: HARHeader[];
  content: HARContent;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
};

export type HARCookie = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

export type HARHeader = {
  name: string;
  value: string;
};

export type HARQueryParameter = {
  name: string;
  value: string;
};

export type HARPostData = {
  mimeType: string;
  params: HARParam[];
  text: string;
};

export type HARParam = {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
};

export type HARContent = {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
};

export type HARCache = {
  beforeRequest: HARCacheState | null;
  afterRequest: HARCacheState | null;
};

export type HARCacheState = {
  expires?: string;
  lastAccess: string;
  eTag: string;
  hitCount: number;
};

export type HARTimings = {
  blocked?: number;
  dns?: number;
  connect?: number;
  send: number;
  wait: number;
  receive: number;
  ssl?: number;
};

export type HARSecurityDetails = {
  protocol?: string;
  subjectName?: string;
  issuer?: string;
  validFrom?: number;
  validTo?: number;
};
