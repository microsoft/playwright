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

import http from 'http';
import { ManualPromise } from '@isomorphic/manualPromise';
import { httpRequest } from '@utils/network';

import type { HTTPRequestParams } from '@utils/network';
import type { Progress } from './progress';

export async function fetchData(progress: Progress | undefined, params: HTTPRequestParams, onError?: (params: HTTPRequestParams, response: http.IncomingMessage) => Promise<Error>): Promise<string> {
  const promise = new ManualPromise<string>();
  const { cancel } = httpRequest(params, async response => {
    if (response.statusCode !== 200) {
      const error = onError ? await onError(params, response) : new Error(`fetch failed: server returned code ${response.statusCode}. URL: ${params.url}`);
      promise.reject(error);
      return;
    }
    let body = '';
    response.on('data', (chunk: string) => body += chunk);
    response.on('error', (error: any) => promise.reject(error));
    response.on('end', () => promise.resolve(body));
  }, error => promise.reject(error));
  if (!progress)
    return promise;
  try {
    return await progress.race(promise);
  } catch (error) {
    cancel(error);
    throw error;
  }
}
