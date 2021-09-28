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

import * as React from 'react';

export const Expandable: React.FunctionComponent<{
  title: JSX.Element,
  body: JSX.Element,
  setExpanded: Function,
  expanded: Boolean,
  style?: React.CSSProperties,
}> = ({ title, body, setExpanded, expanded, style }) => {
  return <div style={{ ...style, display: 'flex', flexDirection: 'column' }}>
    <div className='expandable-title' style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', whiteSpace: 'nowrap' }}>
      <div
        className={'codicon codicon-' + (expanded ? 'chevron-down' : 'chevron-right')}
        style={{ cursor: 'pointer', color: 'var(--color)', marginRight: '4px' }}
        onClick={() => setExpanded(!expanded)} />
      {title}
    </div>
    { expanded && <div className='expandable-body' style={{ display: 'flex', flex: 'auto', margin: '5px 0 5px 20px' }}>{body}</div> }
  </div>;
};
