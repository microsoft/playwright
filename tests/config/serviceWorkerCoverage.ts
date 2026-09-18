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

type PageLike = { evaluate(pageFunction: any): Promise<any> };

// Folds the worker's counters, served by its coverage route in instrumented builds,
// into the page's, from where the tracing coverage reads.
export async function mergeServiceWorkerCoverage(page: PageLike) {
  if (!process.env.PWTEST_COVERAGE)
    return;
  await page.evaluate(async () => {
    if (!navigator.serviceWorker?.controller)
      return;
    const response = await fetch('coverage');
    if (!response.ok)
      return;
    const taken = await response.json();
    const coverage = (window as any).__coverage__ ??= {};
    for (const [file, data] of Object.entries<any>(taken)) {
      const existing = coverage[file];
      if (!existing) {
        coverage[file] = data;
        continue;
      }
      for (const key of Object.keys(data.s))
        existing.s[key] += data.s[key];
      for (const key of Object.keys(data.f))
        existing.f[key] += data.f[key];
      for (const key of Object.keys(data.b))
        existing.b[key] = existing.b[key].map((count: number, i: number) => count + data.b[key][i]);
    }
  }).catch(() => {});
}
