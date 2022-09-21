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

import type { HTMLReport, TestFileSummary } from './types';
import * as React from 'react';
import type { Filter } from './filter';
import { TestFileView } from './testFileView';
import './testFileView.css';

export const TestFilesView: React.FC<{
  report?: HTMLReport,
  expandedFiles: Map<string, boolean>,
  setExpandedFiles: (value: Map<string, boolean>) => void,
  filter: Filter,
}> = ({ report, filter, expandedFiles, setExpandedFiles }) => {
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
