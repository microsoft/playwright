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
import { hashStringToInt, matchTags } from './labelUtils';

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
    return matchTags(test.path.join(' ') + ' ' + test.title).sort((a, b) => a.localeCompare(b));
  }, [test]);

  return <div className='test-case-column vbox'>
    {test && <div className='test-case-path'>{test.path.join(' › ')}</div>}
    {test && <div className='test-case-title'>{test?.title}</div>}
    {test && <div className='test-case-location'>{test.location.file}:{test.location.line}</div>}
    {test && (!!test.projectName || labels) && <div className='test-case-project-labels-row'>
      {test && !!test.projectName && <ProjectLink projectNames={projectNames} projectName={test.projectName}></ProjectLink>}
      {labels && <LabelsLinkView labels={labels} />}
    </div>}
    {test && !!test.annotations.length && <AutoChip header='Annotations'>
      {test?.annotations.map(annotation => <TestCaseAnnotationView annotation={annotation} />)}
    </AutoChip>}
    {test && <TabbedPane tabs={
      test.results.map((result, index) => ({
        id: String(index),
        title: <div style={{ display: 'flex', alignItems: 'center' }}>{statusIcon(result.status)} {retryLabel(index)}</div>,
        render: () => <TestResultView test={test!} result={result} anchor={anchor}></TestResultView>
      })) || []} selectedTab={String(selectedResultIndex)} setSelectedTab={id => setSelectedResultIndex(+id)} />}
  </div>;
};

function renderAnnotationDescription(description: string) {
  try {
    if (['http:', 'https:'].includes(new URL(description).protocol))
      return <a href={description} target='_blank' rel='noopener noreferrer'>{description}</a>;
  } catch {}
  return description;
}

function TestCaseAnnotationView({ annotation: { type, description } }: { annotation: TestCaseAnnotation }) {
  return (
    <div className='test-case-annotation'>
      <span style={{ fontWeight: 'bold' }}>{type}</span>
      {description && <span>: {renderAnnotationDescription(description)}</span>}
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
      {labels.map(tag => (
        <a key={tag} style={{ textDecoration: 'none', color: 'var(--color-fg-default)' }} href={`#?q=@${tag}`} >
          <span style={{ margin: '6px 0 0 6px', cursor: 'pointer' }} className={'label label-color-' + (hashStringToInt(tag))}>
            {tag}
          </span>
        </a>
      ))}
    </>
  ) : null;
};
