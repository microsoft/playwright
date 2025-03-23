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

import type { TestCase, TestCaseAnnotation, TestCaseSummary } from './types';
import * as React from 'react';
import { TabbedPane } from './tabbedPane';
import { AutoChip } from './chip';
import './common.css';
import { Link, LabelLink, SearchParamsContext, TagLinks, testResultHref } from './links';
import { statusIcon } from './statusIcon';
import './testCaseView.css';
import { TestResultView } from './testResultView';
import { linkifyText } from '@web/renderUtils';
import { msToString } from './utils';
import { clsx } from '@web/uiUtils';
import { CopyToClipboardContainer } from './copyToClipboard';

export const TestCaseView: React.FC<{
  test: TestCase | undefined,
  next: TestCaseSummary | undefined,
  prev: TestCaseSummary | undefined,
  run: number,
}> = ({ test, run, next, prev }) => {
  const [selectedResultIndex, setSelectedResultIndex] = React.useState(run);
  const searchParams = React.useContext(SearchParamsContext);

  const visibleAnnotations = React.useMemo(() => {
    return test?.annotations?.filter(annotation => !annotation.type.startsWith('_')) || [];
  }, [test?.annotations]);

  return <div className='test-case-column vbox'>
    {test && <div className='hbox'>
      <div className='test-case-path'>{test.path.join(' › ')}</div>
      <div style={{ flex: 'auto' }}></div>
      <div className={clsx(!prev && 'hidden')}><Link href={testResultHref({ test: prev, filter: searchParams })}>« previous</Link></div>
      <div style={{ width: 10 }}></div>
      <div className={clsx(!next && 'hidden')}><Link href={testResultHref({ test: next, filter: searchParams })}>next »</Link></div>
    </div>}

    {test && <div className='test-case-title'>{test.title}</div>}

    {test && <div className='hbox'>
      <div className='test-case-location'>
        <CopyToClipboardContainer value={`${test.location.file}:${test.location.line}`}>
          {test.location.file}:{test.location.line}
        </CopyToClipboardContainer>
      </div>
      <div style={{ flex: 'auto' }}></div>
      <div className='test-case-duration'>{msToString(test.duration)}</div>
    </div>}

    {(test?.projectName || test?.tags) && <div className='test-case-project-labels-row'>
      {test.projectName && <LabelLink prefix='p:' searchParams={searchParams} name={test.projectName}/>}
      <TagLinks searchParams={searchParams} tags={test.tags}/>
    </div>}

    {!!visibleAnnotations.length && <AutoChip header='Annotations'>
      {visibleAnnotations.map((annotation, index) => <TestCaseAnnotationView key={index} annotation={annotation} />)}
    </AutoChip>}

    {test && <TabbedPane tabs={
      test.results.map((result, index) => ({
        id: String(index),
        title: <div style={{ display: 'flex', alignItems: 'center' }}>
          {statusIcon(result.status)} {index === 0 ? 'Run' : `Retry #${index}`}
          {(test.results.length > 1) && <span className='test-case-run-duration'>{msToString(result.duration)}</span>}
        </div>,
        render: () => <TestResultView test={test} result={result} />
      })) || []} selectedTab={String(selectedResultIndex)} setSelectedTab={id => setSelectedResultIndex(+id)} />}
  </div>;
};

function TestCaseAnnotationView({ annotation: { type, description } }: { annotation: TestCaseAnnotation }) {
  return (
    <div className='test-case-annotation'>
      <span style={{ fontWeight: 'bold' }}>{type}</span>
      {description && <CopyToClipboardContainer value={description}>: {linkifyText(description)}</CopyToClipboardContainer>}
    </div>
  );
}
