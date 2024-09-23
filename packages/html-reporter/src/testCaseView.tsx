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

import type { TestCase, TestCaseAnnotation } from './types';
import * as React from 'react';
import { TabbedPane } from './tabbedPane';
import { AutoChip } from './chip';
import './common.css';
import { ProjectLink } from './links';
import { statusIcon } from './statusIcon';
import './testCaseView.css';
import { TestResultView } from './testResultView';
import { linkifyText } from '@web/renderUtils';
import { hashStringToInt, msToString } from './utils';
import { clsx } from '@web/uiUtils';
import { CopyToClipboardContainer } from './copyToClipboard';

export const TestCaseView: React.FC<{
  projectNames: string[],
  test: TestCase | undefined,
  anchor: 'video' | 'diff' | '',
  run: number,
}> = ({ projectNames, test, run, anchor }) => {
  const [selectedResultIndex, setSelectedResultIndex] = React.useState(run);

  const labels = React.useMemo(() => {
    if (!test)
      return undefined;
    return test.tags;
  }, [test]);

  const visibleAnnotations = React.useMemo(() => {
    return test?.annotations?.filter(annotation => !annotation.type.startsWith('_')) || [];
  }, [test?.annotations]);

  return <div className='test-case-column vbox'>
    {test && <div className='test-case-path'>{test.path.join(' › ')}</div>}
    {test && <div className='test-case-title'>{test?.title}</div>}
    {test && <div className='hbox'>
      <div className='test-case-location'>
        <CopyToClipboardContainer value={`${test?.location.file}:${test?.location.line}`}>
          {test.location.file}:{test.location.line}
        </CopyToClipboardContainer>
      </div>
      <div style={{ flex: 'auto' }}></div>
      <div className='test-case-duration'>{msToString(test.duration)}</div>
    </div>}
    {test && (!!test.projectName || labels) && <div className='test-case-project-labels-row'>
      {test && !!test.projectName && <ProjectLink projectNames={projectNames} projectName={test.projectName}></ProjectLink>}
      {labels && <LabelsLinkView labels={labels} />}
    </div>}
    {!!visibleAnnotations.length && <AutoChip header='Annotations'>
      {visibleAnnotations.map((annotation, index) => <TestCaseAnnotationView key={index} annotation={annotation} />)}
    </AutoChip>}
    {test && <TabbedPane tabs={
      test.results.map((result, index) => ({
        id: String(index),
        title: <div style={{ display: 'flex', alignItems: 'center' }}>{statusIcon(result.status)} {retryLabel(index)}</div>,
        render: () => <TestResultView test={test!} result={result} anchor={anchor}></TestResultView>
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
