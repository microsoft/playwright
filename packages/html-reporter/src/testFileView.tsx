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
import { Link, LinkBadge, SearchParamsContext, testResultHref, TraceLink } from './links';
import { statusIcon } from './statusIcon';
import './testFileView.css';
import { video, image } from './icons';
import { clsx } from '@web/uiUtils';
import { ProjectAndTagLabelsView } from './labels';

export const TestFileView: React.FC<React.PropsWithChildren<{
  file: TestFileSummary;
  projectNames: string[];
  isFileExpanded: (fileId: string) => boolean;
  setFileExpanded: (fileId: string, expanded: boolean) => void;
}>> = ({ file, projectNames, isFileExpanded, setFileExpanded }) => {
  const searchParams = React.useContext(SearchParamsContext);
  const filterParam = searchParams.has('q') ? '&q=' + searchParams.get('q') : '';
  return <Chip
    expanded={isFileExpanded(file.fileId)}
    noInsets={true}
    setExpanded={(expanded => setFileExpanded(file.fileId, expanded))}
    header={<span className='chip-header-allow-selection'>
      {file.fileName}
    </span>}>
    {file.tests.map(test =>
      <div key={`test-${test.testId}`} className={clsx('test-file-test', 'test-file-test-outcome-' + test.outcome)}>
        <div className='hbox' style={{ alignItems: 'flex-start' }}>
          <div className='hbox'>
            <span className='test-file-test-status-icon'>
              {statusIcon(test.outcome)}
            </span>
            <span>
              <Link href={testResultHref({ test }) + filterParam} title={[...test.path, test.title].join(' › ')}>
                <span className='test-file-title'>{[...test.path, test.title].join(' › ')}</span>
              </Link>
              <ProjectAndTagLabelsView style={{ marginLeft: '6px' }} projectNames={projectNames} activeProjectName={test.projectName} otherLabels={test.tags} />
            </span>
          </div>
          <span data-testid='test-duration' style={{ minWidth: '50px', textAlign: 'right' }}>{msToString(test.duration)}</span>
        </div>
        <div className='test-file-details-row'>
          <div className='test-file-details-row-items'>
            <Link href={testResultHref({ test })} title={[...test.path, test.title].join(' › ')} className='test-file-path-link'>
              <span className='test-file-path'>{test.location.file}:{test.location.line}</span>
            </Link>
            {imageDiffBadge(test)}
            {videoBadge(test)}
            <TraceLink test={test} dim={true} />
          </div>
        </div>
      </div>
    )}
  </Chip>;
};

function imageDiffBadge(test: TestCaseSummary): JSX.Element | undefined {
  for (const result of test.results) {
    for (const attachment of result.attachments) {
      if (attachment.contentType.startsWith('image/') && !!attachment.name.match(/-(expected|actual|diff)/))
        return <LinkBadge href={testResultHref({ test, result, anchor: `attachment-${result.attachments.indexOf(attachment)}` })} title='View images' dim={true}>{image()}</LinkBadge>;
    }
  }
}

function videoBadge(test: TestCaseSummary): JSX.Element | undefined {
  const resultWithVideo = test.results.find(result => result.attachments.some(attachment => attachment.name === 'video'));
  return resultWithVideo ? <LinkBadge href={testResultHref({ test, result: resultWithVideo, anchor: 'attachment-video' })} title='View video' dim={true}>{video()}</LinkBadge> : undefined;
}
