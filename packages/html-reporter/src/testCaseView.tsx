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
import { hashStringToInt } from './labelUtils';
import { msToString } from './uiUtils';

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
      <div className='test-case-location'>{test.location.file}:{test.location.line}</div>
      <div style={{ flex: 'auto' }}></div>
      <div className='test-case-duration'>{msToString(test.duration)}</div>
    </div>}
    {test && (!!test.projectName || labels) && <div className='test-case-project-labels-row'>
      {test && !!test.projectName && <ProjectLink projectNames={projectNames} projectName={test.projectName}></ProjectLink>}
      {labels && <LabelsLinkView labels={labels} />}
    </div>}
    {!!visibleAnnotations.length && <AutoChip header='Annotations'>
      {visibleAnnotations.map(annotation => <TestCaseAnnotationView annotation={annotation} />)}
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
  const CONTROL_CODES = '\\u0000-\\u0020\\u007f-\\u009f';
  const WEB_LINK_REGEX = new RegExp('(?:[a-zA-Z][a-zA-Z0-9+.-]{2,}:\\/\\/|www\\.)[^\\s' + CONTROL_CODES + '"]{2,}[^\\s' + CONTROL_CODES + '"\')}\\],:;.!?]', 'ug');

  const result = [];
  let currentIndex = 0;
  let match;

  while ((match = WEB_LINK_REGEX.exec(description)) !== null) {
    const stringBeforeMatch = description.substring(currentIndex, match.index);
    if (stringBeforeMatch)
      result.push(stringBeforeMatch);

    const value = match[0];
    result.push(renderLink(value));
    currentIndex = match.index + value.length;
  }
  const stringAfterMatches = description.substring(currentIndex);
  if (stringAfterMatches)
    result.push(stringAfterMatches);

  return result;
}

function renderLink(text: string) {
  let link = text;
  if (link.startsWith('www.'))
    link = 'https://' + link;

  return <a href={link} target='_blank' rel='noopener noreferrer'>{text}</a>;
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
      {labels.map(label => (
        <a key={label} style={{ textDecoration: 'none', color: 'var(--color-fg-default)' }} href={`#?q=${label}`} >
          <span style={{ margin: '6px 0 0 6px', cursor: 'pointer' }} className={'label label-color-' + (hashStringToInt(label))}>
            {label.slice(1)}
          </span>
        </a>
      ))}
    </>
  ) : null;
};
