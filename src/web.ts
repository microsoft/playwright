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

import { CRBrowser as ChromiumBrowser } from './chromium/crBrowser';
import { FFBrowser as FirefoxBrowser } from './firefox/ffBrowser';
import { WKBrowser as WebKitBrowser } from './webkit/wkBrowser';
import * as platform from './platform';

const connect = {
  chromium: {
    connect: async (url: string) => {
      const transport = new platform.WebSocketTransport(url);
      return ChromiumBrowser.connect(transport);
    }
  },
  webkit: {
    connect: async (url: string) => {
      const transport = new platform.WebSocketTransport(url);
      return WebKitBrowser.connect(transport);
    }
  },
  firefox: {
    connect: async (url: string) => {
      const transport = new platform.WebSocketTransport(url);
      return FirefoxBrowser.connect(transport);
    }
  }
};
export = connect;
