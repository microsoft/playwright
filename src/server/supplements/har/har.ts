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
export type Log = {
  version: string;
  creator: Creator;
  browser: Browser;
  pages: Page[];
  entries: Entry[];
};

export type Creator = {
  name: string;
  version: string;
};

export type Browser = {
  name: string;
  version: string;
};

export type Page = {
  startedDateTime: Date;
  id: string;
  title: string;
  pageTimings: PageTimings;
};

export type PageTimings = {
  onContentLoad: number;
  onLoad: number;
};

export type Entry = {
  pageref?: string;
  startedDateTime: Date;
  time: number;
  request: Request;
  response: Response;
  cache: Cache;
  timings: Timings;
  serverIPAddress?: string;
  connection?: string;
  _serverPort?: number;
  _securityDetails?: SecurityDetails;
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
};

export type Cookie = {
  name: string;
  value: string;
  path?: string;
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

export type Header = {
  name: string;
  value: string;
};

export type QueryParameter = {
  name: string;
  value: string;
};

export type PostData = {
  mimeType: string;
  params: Param[];
  text: string;
};

export type Param = {
  name: string;
  value?: string;
  fileName?: string;
  contentType?: string;
};

export type Content = {
  size: number;
  compression?: number;
  mimeType: string;
  text?: string;
  encoding?: string;
};

export type Cache = {
  beforeRequest: CacheState | null;
  afterRequest: CacheState | null;
};

export type CacheState = {
  expires?: string;
  lastAccess: string;
  eTag: string;
  hitCount: number;
};

export type Timings = {
  blocked?: number;
  dns?: number;
  connect?: number;
  send: number;
  wait: number;
  receive: number;
  ssl?: number;
};

export type SecurityDetails = {
  protocol?: string;
  subjectName?: string;
  issuer?: string;
  validFrom?: number;
  validTo?: number;
};
