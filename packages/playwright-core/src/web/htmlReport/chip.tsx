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
import './chip.css';

export const Chip: React.FunctionComponent<{
  header: JSX.Element | string,
  expanded?: boolean,
  noInsets?: boolean,
  setExpanded?: (expanded: boolean) => void,
  children?: any,
}> = ({ header, expanded, setExpanded, children, noInsets }) => {
  return <div className='chip'>
    <div className={'chip-header' + (setExpanded ? ' expanded-' + expanded : '')} onClick={() => setExpanded?.(!expanded)}>
      {setExpanded && !!expanded && downArrow()}
      {setExpanded && !expanded && rightArrow()}
      {header}
    </div>
    {(!setExpanded || expanded) && <div className={'chip-body' + (noInsets ? ' chip-body-no-insets' : '')}>{children}</div>}
  </div>;
};

function downArrow() {
  return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' className='octicon color-fg-muted'>
    <path fillRule='evenodd' d='M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z'></path>
  </svg>;
}

function rightArrow() {
  return <svg aria-hidden='true' height='16' viewBox='0 0 16 16' version='1.1' width='16' data-view-component='true' className='octicon color-fg-muted'>
    <path fillRule='evenodd' d='M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z'></path>
  </svg>;
}
