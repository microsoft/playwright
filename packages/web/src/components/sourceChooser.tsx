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
import type { Source } from '@recorder/recorderTypes';

export const SourceChooser: React.FC<{
  sources: Source[],
  fileId: string | undefined,
  setFileId: (fileId: string) => void,
}> = ({ sources, fileId, setFileId }) => {
  return <select className='source-chooser' hidden={!sources.length} value={fileId} onChange={event => {
    setFileId(event.target.selectedOptions[0].value);
  }}>{renderSourceOptions(sources)}</select>;
};

function renderSourceOptions(sources: Source[]): React.ReactNode {
  const transformTitle = (title: string): string => title.replace(/.*[/\\]([^/\\]+)/, '$1');
  const renderOption = (source: Source): React.ReactNode => (
    <option key={source.id} value={source.id}>{transformTitle(source.label)}</option>
  );

  const hasGroup = sources.some(s => s.group);
  if (hasGroup) {
    const groups = new Set(sources.map(s => s.group));
    return [...groups].filter(Boolean).map(group => (
      <optgroup label={group} key={group}>
        {sources.filter(s => s.group === group).map(source => renderOption(source))}
      </optgroup>
    ));
  }

  return sources.map(source => renderOption(source));
}

export function emptySource(): Source {
  return {
    id: 'default',
    isRecorded: false,
    text: '',
    language: 'javascript',
    label: '',
    highlight: []
  };
}