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

import type { TestCase } from './types';
import * as React from 'react';
import { TabbedPane } from './tabbedPane';
import { AutoChip } from './chip';
import './common.css';
import { ProjectLink } from './links';
import { statusIcon } from './statusIcon';
import './testCaseView.css';
import { TestResultView } from './testResultView';

export const TestCaseView: React.FC<{
  projectNames: string[],
  test: TestCase | undefined,
  anchor: 'video' | 'diff' | '',
  run: number,
}> = ({ projectNames, test, run, anchor }) => {
  const [selectedResultIndex, setSelectedResultIndex] = React.useState(run);

  const annotations = new Map<string, (string | undefined)[]>();
  test?.annotations.forEach(annotation => {
    const list = annotations.get(annotation.type) || [];
    list.push(annotation.description);
    annotations.set(annotation.type, list);
  });

  return <div className='test-case-column vbox'>
    {test && <div className='test-case-path'>{test.path.join(' › ')}</div>}
    {test && <div className='test-case-title'>{test?.title}</div>}
    {test && <div className='test-case-location'>{test.location.file}:{test.location.line}</div>}
    {test && !!test.projectName && <ProjectLink projectNames={projectNames} projectName={test.projectName}></ProjectLink>}
    {annotations.size > 0 && <AutoChip header='Annotations'>
      {[...annotations].map(annotation => <TestCaseAnnotationView type={annotation[0]} descriptions={annotation[1]} />)}
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

function TestCaseAnnotationView({ type, descriptions }: { type: string, descriptions: (string | undefined)[] }) {
  const filteredDescriptions = descriptions.filter(Boolean) as string[];
  return (
    <div className='test-case-annotation'>
      <span style={{ fontWeight: 'bold' }}>{type}</span>
      {!!filteredDescriptions.length && <span>: {filteredDescriptions.map((d, i) => {
        const rendered = renderAnnotationDescription(d);
        if (i < filteredDescriptions.length - 1)
          return <>{rendered}, </>;
        return rendered;
      })}</span>}
    </div>
  );
}

function retryLabel(index: number) {
  if (!index)
    return 'Run';
  return `Retry #${index}`;
}
