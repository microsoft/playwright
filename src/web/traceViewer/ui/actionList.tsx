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
import './tabbedPane.css';
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
  const actionListRef = React.createRef<HTMLDivElement>();

  React.useEffect(() => {
    actionListRef.current?.focus();
  }, [selectedAction]);

  return <div className='action-list vbox'>
    <div className='.action-list-title tab-strip'>
      <div className='tab-element'>
        <div className='tab-label'>Actions</div>
      </div>
    </div>
    <div
      className='action-list-content'
      tabIndex={0}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown' &&  event.key !== 'ArrowUp')
          return;
        const index = selectedAction ? actions.indexOf(selectedAction) : -1;
        if (event.key === 'ArrowDown') {
          if (index === -1)
            onSelected(actions[0]);
          else
            onSelected(actions[Math.min(index + 1, actions.length - 1)]);
        }
        if (event.key === 'ArrowUp') {
          if (index === -1)
            onSelected(actions[actions.length - 1]);
          else
            onSelected(actions[Math.max(index - 1, 0)]);
        }
      }}
      ref={actionListRef}
    >
      {actions.map(actionEntry => {
        const { metadata, actionId } = actionEntry;
        const selectedSuffix = actionEntry === selectedAction ? ' selected' : '';
        const highlightedSuffix = actionEntry === highlightedAction ? ' highlighted' : '';
        return <div
          className={'action-entry' + selectedSuffix + highlightedSuffix}
          key={actionId}
          onClick={() => onSelected(actionEntry)}
          onMouseEnter={() => onHighlighted(actionEntry)}
          onMouseLeave={() => (highlightedAction === actionEntry) && onHighlighted(undefined)}
        >
          <div className={'action-error codicon codicon-issues'} hidden={!metadata.error} />
          <div className='action-title'>{metadata.apiName || metadata.method}</div>
          {metadata.params.selector && <div className='action-selector' title={metadata.params.selector}>{metadata.params.selector}</div>}
          {metadata.method === 'goto' && metadata.params.url && <div className='action-url' title={metadata.params.url}>{metadata.params.url}</div>}
        </div>;
      })}
    </div>
  </div>;
};
