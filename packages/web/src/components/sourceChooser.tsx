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
  return <select className='source-chooser' hidden={!sources.length} title='Source chooser' value={fileId} onChange={event => {
    setFileId(event.target.selectedOptions[0].value);
  }}>{renderSourceOptions(sources)}</select>;
};

function renderSourceOptions(sources: Source[]): React.ReactNode {
  const transformTitle = (title: string): string => title.replace(/.*[/\\]([^/\\]+)/, '$1');
  const renderOption = (source: Source): React.ReactNode => (
    <option key={source.id} value={source.id}>{transformTitle(source.label)}</option>
  );

  const sourcesByGroups = new Map<string, Source[]>();
  for (const source of sources) {
    let list = sourcesByGroups.get(source.group || 'Debugger');
    if (!list) {
      list = [];
      sourcesByGroups.set(source.group || 'Debugger', list);
    }
    list.push(source);
  }

  return [...sourcesByGroups.entries()].map(([group, sources]) => (
    <optgroup label={group} key={group}>
      {sources.filter(s => (s.group || 'Debugger') === group).map(source => renderOption(source))}
    </optgroup>
  ));
}

export function emptySource(): Source {
  return {
    id: 'default',
    timestamp: 0,
    isPrimary: false,
    isRecorded: false,
    text: '',
    language: 'javascript',
    label: '',
    highlight: []
  };
}
