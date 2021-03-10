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

import { ActionEntry } from '../../../server/trace/viewer/traceModel';
import './actionList.css';
import * as React from 'react';

export interface ActionListProps {
  actions: ActionEntry[],
  selectedAction: ActionEntry | undefined,
  highlightedAction: ActionEntry | undefined,
  onSelected: (action: ActionEntry) => void,
  onHighlighted: (action: ActionEntry | undefined) => void,
}

export const ActionList: React.FC<ActionListProps> = ({
  actions = [],
  selectedAction = undefined,
  highlightedAction = undefined,
  onSelected = () => {},
  onHighlighted = () => {},
}) => {
  return <div className='action-list'>{actions.map(actionEntry => {
    const { metadata, actionId } = actionEntry;
    return <div
      className={'action-entry' + (actionEntry === selectedAction ? ' selected' : '')}
      key={actionId}
      onClick={() => onSelected(actionEntry)}
      onMouseEnter={() => onHighlighted(actionEntry)}
      onMouseLeave={() => (highlightedAction === actionEntry) && onHighlighted(undefined)}
    >
      <div className={'action-error codicon codicon-issues'} hidden={!metadata.error} />
      <div className='action-title'>{metadata.method}</div>
      {metadata.params.selector && <div className='action-selector' title={metadata.params.selector}>{metadata.params.selector}</div>}
      {metadata.method === 'goto' && metadata.params.url && <div className='action-url' title={metadata.params.url}>{metadata.params.url}</div>}
    </div>;
  })}</div>;
};
