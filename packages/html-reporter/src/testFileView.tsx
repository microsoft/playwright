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

import type { HTMLReport, TestFileSummary } from '@playwright-test/reporters/html';
import * as React from 'react';
import { msToString } from './uiUtils';
import { Chip } from './chip';
import type { Filter } from './filter';
import { Link, ProjectLink } from './links';
import { statusIcon } from './statusIcon';
import './testFileView.css';

export const TestFileView: React.FC<{
  report: HTMLReport;
  file: TestFileSummary;
  isFileExpanded: (fileId: string) => boolean;
  setFileExpanded: (fileId: string, expanded: boolean) => void;
  filter: Filter;
}> = ({ file, report, isFileExpanded, setFileExpanded, filter }) => {
  return <Chip
    expanded={isFileExpanded(file.fileId)}
    noInsets={true}
    setExpanded={(expanded => setFileExpanded(file.fileId, expanded))}
    header={<span>
      <span style={{ float: 'right' }}>{msToString(file.stats.duration)}</span>
      {file.fileName}
    </span>}>
    {file.tests.filter(t => filter.matches(t)).map(test =>
      <div key={`test-${test.testId}`} className={'test-file-test test-file-test-outcome-' + test.outcome}>
        <span style={{ float: 'right' }}>{msToString(test.duration)}</span>
        {report.projectNames.length > 1 && !!test.projectName &&
          <span style={{ float: 'right' }}><ProjectLink projectNames={report.projectNames} projectName={test.projectName}></ProjectLink></span>}
        {statusIcon(test.outcome)}
        <Link href={`#?testId=${test.testId}`} title={[...test.path, test.title].join(' › ')}>
          {[...test.path, test.title].join(' › ')}
          <span className='test-file-path'>— {test.location.file}:{test.location.line}</span>
        </Link>
      </div>
    )}
  </Chip>;
};
