/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// needs to work both in window and service worker, so we use `self`
const searchParams = new URLSearchParams(self.location.search); // see `installRootRedirect`

const testServerBaseURL = new URL(self.location.href);
const testServerPort = searchParams.get('testServerPort');
if (testServerPort)
  testServerBaseURL.port = testServerPort;

const testServerWebSocketURL = new URL(`/${searchParams.get('ws')}`, testServerBaseURL);
testServerWebSocketURL.protocol = (self.location.protocol === 'https:' ? 'wss:' : 'ws:');

export { searchParams, testServerBaseURL, testServerWebSocketURL };