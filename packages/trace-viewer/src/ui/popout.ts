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

type PopoutFunction = (url: string, target?: string) => Window | any;

let popoutFn: PopoutFunction = window.open;
export function setPopoutFunction(fn: PopoutFunction) {
  popoutFn = fn;
}

export function popout(url: string, target?: string): Window | undefined {
  const win = popoutFn(url, target);
  return win instanceof Window ? win : undefined;
}
