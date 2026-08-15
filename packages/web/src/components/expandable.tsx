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
  title: React.JSX.Element | string,
  // Rendered next to the title, outside of the toggle. Use it for links and buttons,
  // which cannot be nested inside the toggle button.
  titleChildren?: React.ReactNode,
  setExpanded: (expanded: boolean) => void,
  expanded: boolean,
  expandOnTitleClick?: boolean,
  className?: string;
}>> = ({ title, titleChildren, children, setExpanded, expanded, expandOnTitleClick, className }) => {
  const titleId = React.useId();
  const regionId = React.useId();

  const onClick = React.useCallback(() => setExpanded(!expanded), [expanded, setExpanded]);

  const chevron = <div
    className={clsx('codicon', expanded ? 'codicon-chevron-down' : 'codicon-chevron-right')}
    style={{ cursor: 'pointer', color: 'var(--vscode-foreground)', marginLeft: '5px' }}
    onClick={!expandOnTitleClick ? onClick : undefined} />;

  return <div className={clsx('expandable', expanded && 'expanded', className)}>
    <div className='expandable-title'>
      {expandOnTitleClick ?
        <button
          id={titleId}
          type='button'
          aria-expanded={expanded}
          aria-controls={regionId}
          className='expandable-toggle'
          onClick={onClick}>
          {chevron}
          {title}
        </button> :
        <>
          {chevron}
          {title}
        </>}
      {titleChildren}
    </div>
    {expanded && <div id={regionId} aria-labelledby={titleId} role='region' className='expandable-content'>{children}</div>}
  </div>;
};
