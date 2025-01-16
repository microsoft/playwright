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
import './treeItem.css';
import * as icons from './icons';
import { clsx } from '@web/uiUtils';

// flash is retriggered whenever the value changes
function useFlash(flash: any | undefined) {
  const [flashState, setFlashState] = React.useState(false);
  React.useEffect(() => {
    if (flash) {
      setFlashState(true);
      const timeout = setTimeout(() => setFlashState(false), 1000);
      return () => clearTimeout(timeout);
    }
  }, [flash]);
  return flashState;
}

export const TreeItem: React.FunctionComponent<{
  title: JSX.Element,
  loadChildren?: () => JSX.Element[],
  onClick?: () => void,
  expandByDefault?: boolean,
  depth: number,
  style?:  React.CSSProperties,
  flash?: any
}> = ({ title, loadChildren, onClick, expandByDefault, depth, style, flash }) => {
  const addFlashClass = useFlash(flash);
  const [expanded, setExpanded] = React.useState(expandByDefault || false);
  return <div className={clsx('tree-item', addFlashClass && 'yellow-flash')} style={style}>
    <span className='tree-item-title' style={{ whiteSpace: 'nowrap', paddingLeft: depth * 22 + 4 }} onClick={() => { onClick?.(); setExpanded(!expanded); }} >
      {loadChildren && !!expanded && icons.downArrow()}
      {loadChildren && !expanded && icons.rightArrow()}
      {!loadChildren && <span style={{ visibility: 'hidden' }}>{icons.rightArrow()}</span>}
      {title}
    </span>
    {expanded && loadChildren?.()}
  </div>;
};
