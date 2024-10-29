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
import { TestFileView } from './testFileView';
import './testFileView.css';
import { msToString } from './utils';
import { AutoChip } from './chip';
import { TestErrorView } from './testErrorView';

export const TestFilesView: React.FC<{
  tests: TestFileSummary[],
  expandedFiles: Map<string, boolean>,
  setExpandedFiles: (value: Map<string, boolean>) => void,
  projectNames: string[],
}> = ({ tests, expandedFiles, setExpandedFiles, projectNames }) => {
  const filteredFiles = React.useMemo(() => {
    const result: { file: TestFileSummary, defaultExpanded: boolean }[] = [];
    let visibleTests = 0;
    for (const file of tests) {
      visibleTests += file.tests.length;
      result.push({ file, defaultExpanded: visibleTests < 200 });
    }
    return result;
  }, [tests]);
  return <>
    {filteredFiles.map(({ file, defaultExpanded }) => {
      return <TestFileView
        key={`file-${file.fileId}`}
        file={file}
        projectNames={projectNames}
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
        }}>
      </TestFileView>;
    })}
  </>;
};

export const TestFilesHeader: React.FC<{
  report: HTMLReport | undefined,
  filteredStats?: FilteredStats,
}> = ({ report, filteredStats }) => {
  if (!report)
    return;
  return <>
    <div className='mt-2 mx-1' style={{ display: 'flex' }}>
      {report.projectNames.length === 1 && !!report.projectNames[0] && <div data-testid='project-name' style={{ color: 'var(--color-fg-subtle)' }}>Project: {report.projectNames[0]}</div>}
      {filteredStats && <div data-testid='filtered-tests-count' style={{ color: 'var(--color-fg-subtle)', padding: '0 10px' }}>Filtered: {filteredStats.total} {!!filteredStats.total && ('(' + msToString(filteredStats.duration) + ')')}</div>}
      <div style={{ flex: 'auto' }}></div>
      <div data-testid='overall-time' style={{ color: 'var(--color-fg-subtle)', marginRight: '10px' }}>{report ? new Date(report.startTime).toLocaleString() : ''}</div>
      <div data-testid='overall-duration' style={{ color: 'var(--color-fg-subtle)' }}>Total time: {msToString(report.duration ?? 0)}</div>
    </div>
    {!!report.errors.length && <AutoChip header='Errors' dataTestId='report-errors'>
      {report.errors.map((error, index) => <TestErrorView key={'test-report-error-message-' + index} error={error}></TestErrorView>)}
    </AutoChip>}
  </>;
};
