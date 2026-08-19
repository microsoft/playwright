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
  setExpanded: (expanded: boolean) => void,
  expanded: boolean,
  expandOnTitleClick?: boolean,
  titleSuffix?: React.ReactNode,
  className?: string;
}>> = ({ title, children, setExpanded, expanded, expandOnTitleClick, titleSuffix, className }) => {
  const titleId = React.useId();
  const regionId = React.useId();

  const onClick = React.useCallback(() => setExpanded(!expanded), [expanded, setExpanded]);

  const chevron = <div
    className={clsx('codicon', expanded ? 'codicon-chevron-down' : 'codicon-chevron-right')}
    style={{ color: 'var(--vscode-foreground)', marginLeft: '5px' }} />;

  return <div className={clsx('expandable', expanded && 'expanded', className)}>
    <div className='expandable-title' id={expandOnTitleClick ? undefined : titleId}>
      {expandOnTitleClick ?
        <button
          id={titleId}
          aria-expanded={expanded}
          aria-controls={regionId}
          className='expandable-title-button'
          onClick={onClick}>
          {chevron}
          {title}
        </button> :
        <>
          <button
            aria-expanded={expanded}
            aria-controls={regionId}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            className='expandable-title-button'
            onClick={onClick}>
            {chevron}
          </button>
          {title}
        </>}
      {titleSuffix}
    </div>
    {expanded && <div id={regionId} aria-labelledby={titleId} role='region' className='expandable-content'>{children}</div>}
  </div>;
};
