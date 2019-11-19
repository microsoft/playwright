#!/usr/bin/env node
/**
 * Copyright 2017 Google Inc. All rights reserved.
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
const path = require('path');
const {TestServer} = require('../utils/testserver/');

const port = 8907;
const httpsPort = 8908;
const assetsPath = path.join(__dirname, 'assets');
const cachedPath = path.join(__dirname, 'assets', 'cached');

Promise.all([
  TestServer.create(assetsPath, port),
  TestServer.createHTTPS(assetsPath, httpsPort)
]).then(([server, httpsServer]) => {
  server.enableHTTPCache(cachedPath);
  httpsServer.enableHTTPCache(cachedPath);
  console.log(`HTTP: server is running on http://localhost:${port}`);
  console.log(`HTTPS: server is running on https://localhost:${httpsPort}`);
});
