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

// Race a promise against an AbortSignal. Throws when the signal aborts;
// otherwise resolves/rejects with the promise's outcome.
export async function race<T>(signal: AbortSignal, promise: Promise<T>): Promise<T> {
  if (signal.aborted)
    throw signal.reason ?? new Error('Aborted');
  let onAbort: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason ?? new Error('Aborted'));
    signal.addEventListener('abort', onAbort);
  });
  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    if (onAbort)
      signal.removeEventListener('abort', onAbort);
  }
}
