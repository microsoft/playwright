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
export type HARFile = {
  log: Log;
};

export type Log = {
  version: string;
  creator: Creator;
  browser?: Browser;
  pages?: Page[];
  entries: Entry[];
  comment?: string;
};

export type Creator = {
  name: string;
  version: string;
  comment?: string;
};

export type Browser = {
  name: string;
  version: string;
  comment?: string;
};

export type Page = {
  startedDateTime: string;
  id: string;
  title: string;
  pageTimings: PageTimings;
  comment?: string;
};

export type PageTimings = {
  onContentLoad?: number;
  onLoad?: number;
  comment?: string;
};

export type Entry = {
  pageref?: string;
  startedDateTime: string;
  time: number;
  request: Request;
  response: Response;
  cache: Cache;
  timings: Timings;
  serverIPAddress?: string;
  connection?: string;
  _frameref?: string;
  _monotonicTime?: number;
  _serverPort?: number;
  _securityDetails?: SecurityDetails;
  _wasAborted?: boolean;
  _wasFulfilled?: boolean;
  _wasContinued?: boolean;
  _apiRequest?: boolean;
};

export type Request = {
  method: string;
  url: string;
  httpVersion: string;
  cookies: Cookie[];
  headers: Header[];
  queryString: QueryParameter[];
  postData?: PostData;
  headersSize: number;
  bodySize: number;
  comment?: string;
};

export type Response = {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: Cookie[];
  headers: Header[];
  content: Content;
  redirectURL: string;
  headersSize: number;
  bodySize: number;
  comment?: string;
  _transferSize?: number;
  _failureText?: string
};

export type Cookie = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  comment?: string;
};

export type Header = {
  name: string;
  value: string;
  comment?: string;
};

export type QueryParameter = {
  name: string;
  value: string;
  comment?: string;
};

export type PostData = {
  mimeType: string;
  params: Param[];
  text: string;
  comment?: string;
  _sha1?: string;
  _file?: string;
};

export type Param = {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
  comment?: string;
};

export type Content = {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
  comment?: string;
  _sha1?: string;
  _file?: string;
};

export type Cache = {
  beforeRequest?: CacheState | null;
  afterRequest?: CacheState | null;
  comment?: string;
};

export type CacheState = {
  expires?: string;
  lastAccess: string;
  eTag: string;
  hitCount: number;
  comment?: string;
};

export type Timings = {
  blocked?: number;
  dns?: number;
  connect?: number;
  send: number;
  wait: number;
  receive: number;
  ssl?: number;
  comment?: string;
};

export type SecurityDetails = {
  protocol?: string;
  subjectName?: string;
  issuer?: string;
  validFrom?: number;
  validTo?: number;
};
