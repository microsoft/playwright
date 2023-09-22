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

type Progress = (done: number, total: number) => undefined;

export function splitProgress(progress: Progress, weights: number[]): Progress[] {
  const doneList = new Array(weights.length).fill(0);
  return new Array(weights.length).fill(0).map((_, i) => {
    return (done: number, total: number) => {
      doneList[i] = done / total * weights[i] * 1000;
      progress(doneList.reduce((a, b) => a + b, 0), 1000);
    };
  });
}
