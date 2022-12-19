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

import type { HTMLReport, TestCaseSummary, TestFileSummary } from './types';
import * as React from 'react';
import { msToString } from './uiUtils';
import { Chip } from './chip';
import type { Filter } from './filter';
import { generateTraceUrl, Link, ProjectLink } from './links';
import { statusIcon } from './statusIcon';
import './testFileView.css';
import { video, image, trace } from './icons';

export const TestFileView: React.FC<React.PropsWithChildren<{
  report: HTMLReport;
  file: TestFileSummary;
  isFileExpanded: (fileId: string) => boolean;
  setFileExpanded: (fileId: string, expanded: boolean) => void;
  filter: Filter;
}>> = ({ file, report, isFileExpanded, setFileExpanded, filter }) => {
  return <Chip
    expanded={isFileExpanded(file.fileId)}
    noInsets={true}
    setExpanded={(expanded => setFileExpanded(file.fileId, expanded))}
    header={<span>
      {file.fileName}
    </span>}>
    {file.tests.filter(t => filter.matches(t)).map(test =>
      <div key={`test-${test.testId}`} className={'test-file-test test-file-test-outcome-' + test.outcome}>
        <div style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
          <span style={{ float: 'right', minWidth: '50px', textAlign: 'right' }}>{msToString(test.duration)}</span>
          {report.projectNames.length > 1 && !!test.projectName &&
              <span style={{ float: 'right' }}><ProjectLink projectNames={report.projectNames} projectName={test.projectName}></ProjectLink></span>}
          {statusIcon(test.outcome)}
          <Link href={`#?testId=${test.testId}`} title={[...test.path, test.title].join(' › ')}>
            <span className='test-file-title'>{[...test.path, test.title].join(' › ')}</span>
          </Link>
        </div>
        <div className='test-file-details-row'>
          <Link href={`#?testId=${test.testId}`} title={[...test.path, test.title].join(' › ')} className='test-file-path-link'>
            <span className='test-file-path'>{test.location.file}:{test.location.line}</span>
          </Link>
          {imageDiffBadge(test)}
          {videoBadge(test)}
          {traceBadge(test)}
        </div>
      </div>
    )}
  </Chip>;
};

function imageDiffBadge(test: TestCaseSummary): JSX.Element | undefined {
  const resultWithImageDiff = test.results.find(result => result.attachments.some(attachment => {
    return attachment.contentType.startsWith('image/') && !!attachment.name.match(/-(expected|actual|diff)/);
  }));
  return resultWithImageDiff ? <Link href={`#?testId=${test.testId}&anchor=diff&run=${test.results.indexOf(resultWithImageDiff)}`} title='View images' className='test-file-badge'>{image()}</Link> : undefined;
}

function videoBadge(test: TestCaseSummary): JSX.Element | undefined {
  const resultWithVideo = test.results.find(result => result.attachments.some(attachment => attachment.name === 'video'));
  return resultWithVideo ? <Link href={`#?testId=${test.testId}&anchor=video&run=${test.results.indexOf(resultWithVideo)}`} title='View video' className='test-file-badge'>{video()}</Link> : undefined;
}

function traceBadge(test: TestCaseSummary): JSX.Element | undefined {
  const firstTraces = test.results.map(result => result.attachments.filter(attachment => attachment.name === 'trace')).filter(traces => traces.length > 0)[0];
  return firstTraces ? <Link href={generateTraceUrl(firstTraces)} title='View trace' className='test-file-badge'>{trace()}</Link> : undefined;
}
