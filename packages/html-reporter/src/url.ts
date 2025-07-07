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

import type { TestAttachment, TestCase, TestCaseSummary, TestResult, TestResultSummary } from './types';

export function generateTraceUrl(traces: TestAttachment[]) {
  return `trace/index.html?${traces.map((a, i) => `trace=${new URL(a.path!, window.location.href)}`).join('&')}`;
}

export function testResultHref({ test, result, anchor }: { test?: TestCase | TestCaseSummary, result?: TestResult | TestResultSummary, anchor?: string }) {
  const params = new URLSearchParams();
  if (test)
    params.set('testId', test.testId);
  if (test && result)
    params.set('run', '' + test.results.indexOf(result as any));
  if (anchor)
    params.set('anchor', anchor);
  return `#?` + params;
}
