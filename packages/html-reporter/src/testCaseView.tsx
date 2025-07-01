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

import type { TestAnnotation } from '@playwright/test';
import type { TestCase, TestCaseSummary } from './types';
import * as React from 'react';
import { TabbedPane } from './tabbedPane';
import { AutoChip } from './chip';
import './common.css';
import { Link, ProjectLink, SearchParamsContext, testResultHref, TraceLink } from './links';
import { statusIcon } from './statusIcon';
import './testCaseView.css';
import { TestResultView } from './testResultView';
import { linkifyText } from '@web/renderUtils';
import { hashStringToInt, msToString } from './utils';
import { clsx } from '@web/uiUtils';
import { CopyToClipboardContainer } from './copyToClipboard';
import { HeaderView } from './headerView';
import type { MetadataWithCommitInfo } from '@playwright/isomorphic/types';

export const TestCaseView: React.FC<{
  projectNames: string[],
  test: TestCase,
  testRunMetadata: MetadataWithCommitInfo | undefined,
  next: TestCaseSummary | undefined,
  prev: TestCaseSummary | undefined,
  run: number,
}> = ({ projectNames, test, testRunMetadata, run, next, prev }) => {
  const [selectedResultIndex, setSelectedResultIndex] = React.useState(run);
  const searchParams = React.useContext(SearchParamsContext);

  const filterParam = searchParams.has('q') ? '&q=' + searchParams.get('q') : '';
  const labels = React.useMemo(() => test.tags, [test]);
  const visibleTestAnnotations = test.annotations.filter(a => !a.type.startsWith('_')) ?? [];

  return <>
    <HeaderView
      title={test.title}
      leftSuperHeader={<div className='test-case-path'>{test.path.join(' › ')}</div>}
      rightSuperHeader={<>
        <div className={clsx(!prev && 'hidden')}><Link href={testResultHref({ test: prev }) + filterParam}>« previous</Link></div>
        <div style={{ width: 10 }}></div>
        <div className={clsx(!next && 'hidden')}><Link href={testResultHref({ test: next }) + filterParam}>next »</Link></div>
      </>}
    />
    <div className='hbox' style={{ lineHeight: '24px' }}>
      <div className='test-case-location'>
        <CopyToClipboardContainer value={`${test.location.file}:${test.location.line}`}>
          {test.location.file}:{test.location.line}
        </CopyToClipboardContainer>
      </div>
      <div style={{ flex: 'auto' }}></div>
      <TraceLink test={test} trailingSeparator={true} />
      <div className='test-case-duration'>{msToString(test.duration)}</div>
    </div>
    {(!!test.projectName || labels) && <div className='test-case-project-labels-row'>
      {!!test.projectName && <ProjectLink projectNames={projectNames} projectName={test.projectName}></ProjectLink>}
      {labels && <LabelsLinkView labels={labels} />}
    </div>}
    {test.results.length === 0 && visibleTestAnnotations.length !== 0 && <AutoChip header='Annotations' dataTestId='test-case-annotations'>
      {visibleTestAnnotations.map((annotation, index) => <TestCaseAnnotationView key={index} annotation={annotation} />)}
    </AutoChip>}
    <TabbedPane tabs={
      test.results.map((result, index) => ({
        id: String(index),
        title: <div style={{ display: 'flex', alignItems: 'center' }}>
          {statusIcon(result.status)} {retryLabel(index)}
          {(test.results.length > 1) && <span className='test-case-run-duration'>{msToString(result.duration)}</span>}
        </div>,
        render: () => {
          const visibleAnnotations = result.annotations.filter(annotation => !annotation.type.startsWith('_'));
          return <>
            {!!visibleAnnotations.length && <AutoChip header='Annotations' dataTestId='test-case-annotations'>
              {visibleAnnotations.map((annotation, index) => <TestCaseAnnotationView key={index} annotation={annotation} />)}
            </AutoChip>}
            <TestResultView test={test!} result={result} testRunMetadata={testRunMetadata} />
          </>;
        },
      })) || []} selectedTab={String(selectedResultIndex)} setSelectedTab={id => setSelectedResultIndex(+id)} />
  </>;
};

function TestCaseAnnotationView({ annotation: { type, description } }: { annotation: TestAnnotation }) {
  return (
    <div className='test-case-annotation'>
      <span style={{ fontWeight: 'bold' }}>{type}</span>
      {description && <CopyToClipboardContainer value={description}>: {linkifyText(description)}</CopyToClipboardContainer>}
    </div>
  );
}

function retryLabel(index: number) {
  if (!index)
    return 'Run';
  return `Retry #${index}`;
}

const LabelsLinkView: React.FC<React.PropsWithChildren<{
  labels: string[],
}>> = ({ labels }) => {
  return labels.length > 0 ? (
    <>
      {labels.map(label => (
        <a key={label} style={{ textDecoration: 'none', color: 'var(--color-fg-default)' }} href={`#?q=${label}`} >
          <span style={{ margin: '6px 0 0 6px', cursor: 'pointer' }} className={clsx('label', 'label-color-' + hashStringToInt(label))}>
            {label.slice(1)}
          </span>
        </a>
      ))}
    </>
  ) : null;
};
