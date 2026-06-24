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

function notAvailable(): never {
  throw new Error('path is not available in the browser');
}

export const sep = '/';
export const dirname: any = notAvailable;
export const basename: any = notAvailable;
export const resolve: any = notAvailable;
export const join: any = notAvailable;
export const relative: any = notAvailable;
export const isAbsolute: any = notAvailable;

export default { sep, dirname, basename, resolve, join, relative, isAbsolute };
