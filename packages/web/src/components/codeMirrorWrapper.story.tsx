/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from 'react';
import type { SourceHighlight, SourceProps } from './codeMirrorWrapper';
import { CodeMirrorWrapper } from './codeMirrorWrapper';

type StoryProps = {
  text?: string,
  highlighter?: SourceProps['highlighter'],
  highlight?: SourceHighlight[],
};

export const Default = ({ text, highlighter, highlight }: StoryProps) =>
  <CodeMirrorWrapper text={text ?? ''} highlighter={highlighter} highlight={highlight} />;

export const Editable = ({ readOnly }: { readOnly?: boolean }) => {
  const [value, setValue] = React.useState('');
  return <>
    <CodeMirrorWrapper text='initial' readOnly={readOnly} onChange={setValue} />
    <form hidden><input data-testid='value' readOnly value={value} /></form>
  </>;
};
