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

export const Expandable: React.FunctionComponent<React.PropsWithChildren<{
  title: JSX.Element | string,
  setExpanded: Function,
  expanded: boolean,
  style?: React.CSSProperties,
}>> = ({ title, children, setExpanded, expanded, style }) => {
  return <div style={{ ...style, display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', whiteSpace: 'nowrap' }}>
      <div
        className={'codicon codicon-' + (expanded ? 'chevron-down' : 'chevron-right')}
        style={{ cursor: 'pointer', color: 'var(--vscode-foreground)', marginRight: '4px' }}
        onClick={() => setExpanded(!expanded)} />
      {title}
    </div>
    { expanded && <div style={{ display: 'flex', flex: 'auto', margin: '5px 0 5px 20px' }}>{children}</div> }
  </div>;
};
