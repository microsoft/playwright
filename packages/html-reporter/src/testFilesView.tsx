/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { FilteredStats, HTMLReport, TestFileSummary } from './types';
import * as React from 'react';
import type { Filter } from './filter';
import { TestFileView } from './testFileView';
import './testFileView.css';
import { msToString } from './utils';
import { AutoChip } from './chip';
import { TestErrorView } from './testErrorView';

export const TestFilesView: React.FC<{
  report?: HTMLReport,
  expandedFiles: Map<string, boolean>,
  setExpandedFiles: (value: Map<string, boolean>) => void,
  filter: Filter,
  filteredStats: FilteredStats,
  projectNames: string[],
}> = ({ report, filter, expandedFiles, setExpandedFiles, projectNames, filteredStats }) => {
  const filteredFiles = React.useMemo(() => {
    const result: { file: TestFileSummary, defaultExpanded: boolean }[] = [];
    let visibleTests = 0;
    for (const file of report?.files || []) {
      const tests = file.tests.filter(t => filter.matches(t));
      visibleTests += tests.length;
      if (tests.length)
        result.push({ file, defaultExpanded: visibleTests < 200 });
    }
    return result;
  }, [report, filter]);
  return <>
    <div className='mt-2 mx-1' style={{ display: 'flex' }}>
      {projectNames.length === 1 && !!projectNames[0] && <div data-testid='project-name' style={{ color: 'var(--color-fg-subtle)' }}>Project: {projectNames[0]}</div>}
      {!filter.empty() && <div data-testid='filtered-tests-count' style={{ color: 'var(--color-fg-subtle)', padding: '0 10px' }}>Filtered: {filteredStats.total} {!!filteredStats.total && ('(' + msToString(filteredStats.duration) + ')')}</div>}
      <div style={{ flex: 'auto' }}></div>
      <div data-testid='overall-time' style={{ color: 'var(--color-fg-subtle)', marginRight: '10px' }}>{report ? new Date(report.startTime).toLocaleString() : ''}</div>
      <div data-testid='overall-duration' style={{ color: 'var(--color-fg-subtle)' }}>Total time: {msToString(report?.duration ?? 0)}</div>
    </div>
    {report && !!report.errors.length && <AutoChip header='Errors' dataTestId='report-errors'>
      {report.errors.map((error, index) => <TestErrorView key={'test-report-error-message-' + index} error={error}></TestErrorView>)}
    </AutoChip>}
    {report && filteredFiles.map(({ file, defaultExpanded }) => {
      return <TestFileView
        key={`file-${file.fileId}`}
        report={report}
        file={file}
        isFileExpanded={fileId => {
          const value = expandedFiles.get(fileId);
          if (value === undefined)
            return defaultExpanded;
          return !!value;
        }}
        setFileExpanded={(fileId, expanded) => {
          const newExpanded = new Map(expandedFiles);
          newExpanded.set(fileId, expanded);
          setExpandedFiles(newExpanded);
        }}
        filter={filter}>
      </TestFileView>;
    })}
  </>;
};
