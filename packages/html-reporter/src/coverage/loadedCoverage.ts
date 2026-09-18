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

import { fileCoverageSummary, addCoverageSummary, emptyCoverageSummary } from '@isomorphic/istanbulCoverage';

import type { LoadedReport } from '../loadedReport';
import type { CoverageFile, CoverageReport } from '../types';

export type LoadedCoverage = LoadedReport<CoverageReport>;

export function coverageFileEntry(fileId: string): string {
  return `coverage/${fileId}.json`;
}

export function createMemoryCoverage(files: CoverageFile[]): LoadedCoverage {
  const report: CoverageReport = { files: [], summary: emptyCoverageSummary() };
  const entries = new Map<string, CoverageFile>();
  files.forEach((file, index) => {
    const fileId = 'file-' + index;
    const summary = fileCoverageSummary(file.coverage);
    entries.set(coverageFileEntry(fileId), file);
    report.files.push({ fileId, path: file.path, summary });
    addCoverageSummary(report.summary, summary);
  });
  return {
    json: () => report,
    entry: async name => entries.get(name),
  };
}
