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

import type { CallMetadata } from './callMetadata';

// Most server operations are run inside a Progress instance, which is conceptually
// similar to a cancellation token.
//
// Each method that takes a Progress must result in one of the three outcomes:
//   - It finishes successfully, returning a value, before the Progress is aborted.
//   - It throws some error, before the Progress is aborted.
//   - It throws the Progress's aborted error, because the Progress was aborted before
//     the method could finish.
//
// As a rule of thumb, the above is achieved by:
//   - Passing the Progress instance when awaiting other methods.
//   - Using `progress.race()` when awaiting other methods that do not take a Progress argument.
//     In this case, it is important that awaited method has no side effects, for example
//     it is a read-only browser protocol call.
//   - In rare cases, when the awaited method does not take a Progress argument,
//     but it does have side effects such as creating a page - a proper try/catch/finally
//     should be used to cleanup. Whether the cleanup is awaited or not depends on the method details.
//     For the trickiest cases, look at `raceUncancellableOperationWithCleanup()` helper method.
export interface Progress {
  log(message: string): void;
  race<T>(promise: Promise<T> | Promise<T>[]): Promise<T>;
  wait(timeout: number): Promise<void>;
  metadata: CallMetadata;
}
