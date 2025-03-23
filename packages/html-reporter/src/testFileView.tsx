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

import type { TestCaseSummary, TestFileSummary } from './types';
import * as React from 'react';
import { msToString } from './utils';
import { Chip } from './chip';
import { generateTraceUrl, Link, LabelLink, SearchParamsContext, TagLinks, testResultHref } from './links';
import { statusIcon } from './statusIcon';
import './testFileView.css';
import { video, image, trace } from './icons';
import { clsx } from '@web/uiUtils';

export const TestFileView: React.FC<{
  file: TestFileSummary;
  projectNames: string[];
  isFileExpanded: (fileId: string) => boolean;
  setFileExpanded: (fileId: string, expanded: boolean) => void;
}> = ({ file, projectNames, isFileExpanded, setFileExpanded }) => {
  const searchParams = React.useContext(SearchParamsContext);

  return <Chip
    expanded={isFileExpanded(file.fileId)}
    noInsets={true}
    setExpanded={(expanded => setFileExpanded(file.fileId, expanded))}
    header={<span>{file.fileName}</span>}
  >
    {file.tests.map(test =>
      <div key={`test-${test.testId}`} className={clsx('test-file-test', 'test-file-test-outcome-' + test.outcome)}>
        <div className='hbox' style={{ alignItems: 'flex-start' }}>
          <div className='hbox'>
            <span className='test-file-test-status-icon'>
              {statusIcon(test.outcome)}
            </span>
            <span>
              <Link href={testResultHref({ test, filter: searchParams })} title={[...test.path, test.title].join(' › ')}>
                <span className='test-file-title'>{[...test.path, test.title].join(' › ')}</span>
              </Link>
              {projectNames.length > 1 && !!test.projectName && <LabelLink prefix='p:' searchParams={searchParams} name={test.projectName} />}
              <TagLinks searchParams={searchParams} tags={test.tags} />
            </span>
          </div>
          <span data-testid='test-duration' style={{ minWidth: '50px', textAlign: 'right' }}>{msToString(test.duration)}</span>
        </div>
        <div className='test-file-details-row'>
          <Link href={testResultHref({ test })} title={[...test.path, test.title].join(' › ')} className='test-file-path-link'>
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

function imageDiffBadge(test: TestCaseSummary) {
  for (const result of test.results) {
    for (const attachment of result.attachments) {
      if (attachment.contentType.startsWith('image/') && !!attachment.name.match(/-(expected|actual|diff)/))
        return <Link href={testResultHref({ test, result, anchor: `attachment-${result.attachments.indexOf(attachment)}` })} title='View images' className='test-file-badge'>{image()}</Link>;
    }
  }
}

function videoBadge(test: TestCaseSummary) {
  const resultWithVideo = test.results.find(result => result.attachments.some(attachment => attachment.name === 'video'));
  return resultWithVideo ? <Link href={testResultHref({ test, result: resultWithVideo, anchor: 'attachment-video' })} title='View video' className='test-file-badge'>{video()}</Link> : undefined;
}

function traceBadge(test: TestCaseSummary) {
  const firstTraces = test.results.map(result => result.attachments.filter(attachment => attachment.name === 'trace')).filter(traces => traces.length > 0)[0];
  return firstTraces ? <Link href={generateTraceUrl(firstTraces)} title='View trace' className='test-file-badge'>{trace()}</Link> : undefined;
}
