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
import './expandable.css';

export const Expandable: React.FunctionComponent<React.PropsWithChildren<{
  title: JSX.Element | string,
  setExpanded: (expanded: boolean) => void,
  expanded: boolean,
  expandOnTitleClick?: boolean,
}>> = ({ title, children, setExpanded, expanded, expandOnTitleClick }) => {
  return <div className={'expandable' + (expanded ? ' expanded' : '')}>
    <div className='expandable-title' onClick={() => expandOnTitleClick && setExpanded(!expanded)}>
      <div
        className={'codicon codicon-' + (expanded ? 'chevron-down' : 'chevron-right')}
        style={{ cursor: 'pointer', color: 'var(--vscode-foreground)', marginLeft: '5px' }}
        onClick={() => !expandOnTitleClick && setExpanded(!expanded)} />
      {title}
    </div>
    { expanded && <div style={{ marginLeft: 25 }}>{children}</div> }
  </div>;
};
