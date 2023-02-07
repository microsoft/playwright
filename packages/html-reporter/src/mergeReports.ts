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

import type { HTMLReport, Stats } from './types';

export function mergeReports(reports: HTMLReport[]): HTMLReport {
  const [report, ...rest] = reports;

  for (const currentReport of rest) {
    currentReport.files.forEach(file => {
      const existingGroup = report.files.find(({ fileId }) => fileId === file.fileId);

      if (existingGroup) {
        existingGroup.tests.push(...file.tests);
        mergeStats(existingGroup.stats, file.stats);
      } else {
        report.files.push(file);
      }
    });

    mergeStats(report.stats, currentReport.stats);
    report.metadata.duration += currentReport.metadata.duration;
  }

  return report;
}

function mergeStats(toStats: Stats, fromStats: Stats) {
  toStats.total += fromStats.total;
  toStats.expected += fromStats.expected;
  toStats.unexpected += fromStats.unexpected;
  toStats.flaky += fromStats.flaky;
  toStats.skipped += fromStats.skipped;
  toStats.duration += fromStats.duration;
  toStats.ok = toStats.ok && fromStats.ok;
}
