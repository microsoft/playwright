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
import './colors.css';
import './common.css';
import * as icons from './icons';
import { clsx } from '@web/uiUtils';

export const Chip: React.FC<{
  header: JSX.Element | string,
  expanded?: boolean,
  noInsets?: boolean,
  setExpanded?: (expanded: boolean) => void,
  children?: any,
  dataTestId?: string,
  targetRef?: React.RefObject<HTMLDivElement>,
}> = ({ header, expanded, setExpanded, children, noInsets, dataTestId, targetRef }) => {
  return <div className='chip' data-testid={dataTestId} ref={targetRef}>
    <div
      className={clsx('chip-header', setExpanded && ' expanded-' + expanded)}
      onClick={() => setExpanded?.(!expanded)}
      title={typeof header === 'string' ? header : undefined}>
      {setExpanded && !!expanded && icons.downArrow()}
      {setExpanded && !expanded && icons.rightArrow()}
      {header}
    </div>
    {(!setExpanded || expanded) && <div className={clsx('chip-body', noInsets && 'chip-body-no-insets')}>{children}</div>}
  </div>;
};

export const AutoChip: React.FC<{
  header: JSX.Element | string,
  initialExpanded?: boolean,
  noInsets?: boolean,
  children?: any,
  dataTestId?: string,
  targetRef?: React.RefObject<HTMLDivElement>,
}> = ({ header, initialExpanded, noInsets, children, dataTestId, targetRef }) => {
  const [expanded, setExpanded] = React.useState(initialExpanded || initialExpanded === undefined);
  return <Chip
    header={header}
    expanded={expanded}
    setExpanded={setExpanded}
    noInsets={noInsets}
    dataTestId={dataTestId}
    targetRef={targetRef}
  >
    {children}
  </Chip>;
};
