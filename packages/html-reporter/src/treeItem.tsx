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

export const TreeItem: React.FunctionComponent<{
  title: JSX.Element,
  loadChildren?: () => JSX.Element[],
  onClick?: () => void,
  expandByDefault?: boolean,
  depth: number,
  selected?: boolean,
  style?:  React.CSSProperties,
}> = ({ title, loadChildren, onClick, expandByDefault, depth, selected, style }) => {
  const [expanded, setExpanded] = React.useState(expandByDefault || false);
  const className = selected ? 'tree-item-title selected' : 'tree-item-title';
  return <div className={'tree-item'} style={style}>
    <span className={className} style={{ whiteSpace: 'nowrap', paddingLeft: depth * 22 + 4 }} onClick={() => { onClick?.(); setExpanded(!expanded); }} >
      {loadChildren && !!expanded && icons.downArrow()}
      {loadChildren && !expanded && icons.rightArrow()}
      {!loadChildren && <span style={{ visibility: 'hidden' }}>{icons.rightArrow()}</span>}
      {title}
    </span>
    {expanded && loadChildren?.()}
  </div>;
};
