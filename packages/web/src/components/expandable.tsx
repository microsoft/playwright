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
import { clsx } from '../uiUtils';

export const Expandable: React.FunctionComponent<React.PropsWithChildren<{
  title: JSX.Element | string,
  setExpanded: (expanded: boolean) => void,
  expanded: boolean,
  expandOnTitleClick?: boolean,
}>> = ({ title, children, setExpanded, expanded, expandOnTitleClick }) => {
  const id = React.useId();
  return <div className={clsx('expandable', expanded && 'expanded')}>
    <div
      role='button'
      aria-expanded={expanded}
      aria-controls={id}
      className='expandable-title'
      onClick={() => expandOnTitleClick && setExpanded(!expanded)}>
      <div
        className={clsx('codicon', expanded ? 'codicon-chevron-down' : 'codicon-chevron-right')}
        style={{ cursor: 'pointer', color: 'var(--vscode-foreground)', marginLeft: '5px' }}
        onClick={() => !expandOnTitleClick && setExpanded(!expanded)} />
      {title}
    </div>
    { expanded && <div id={id} role='region' style={{ marginLeft: 25 }}>{children}</div> }
  </div>;
};
