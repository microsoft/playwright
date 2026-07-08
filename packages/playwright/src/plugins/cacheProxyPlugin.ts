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

import { CacheProxy } from './cacheProxy/server';
import { ResponseCache } from './cacheProxy/cache';

import type { TestRunnerPlugin } from '.';
import type { FullConfigInternal } from '../common';

export const cacheProxyPluginForConfig = (config: FullConfigInternal): TestRunnerPlugin[] => {
  const httpCache = config.httpCache;
  if (!httpCache)
    return [];

  let cache: ResponseCache | undefined;
  let proxy: CacheProxy | undefined;
  return [{
    name: 'playwright:cache-proxy',
    setup: async () => {
      cache = new ResponseCache(httpCache.dir);
      await cache.load();
      proxy = new CacheProxy({ cache, match: httpCache.match }, httpCache.proxy);
      process.env.PLAYWRIGHT_TEST_CACHE_PROXY = await proxy.start();
    },
    teardown: async () => {
      delete process.env.PLAYWRIGHT_TEST_CACHE_PROXY;
      await proxy?.stop();
      await cache?.flush();
      proxy = undefined;
      cache = undefined;
    },
  }];
};
