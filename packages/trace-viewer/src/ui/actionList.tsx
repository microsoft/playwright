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

import type { ActionTraceEvent } from '@playwright-core/server/trace/common/traceEvents';
import { msToString } from '@web/uiUtils';
import * as React from 'react';
import './actionList.css';
import * as modelUtil from './modelUtil';
import './tabbedPane.css';

export interface ActionListProps {
  actions: ActionTraceEvent[],
  selectedAction: ActionTraceEvent | undefined,
  highlightedAction: ActionTraceEvent | undefined,
  onSelected: (action: ActionTraceEvent) => void,
  onHighlighted: (action: ActionTraceEvent | undefined) => void,
  setSelectedTab: (tab: string) => void,
}

export const ActionList: React.FC<ActionListProps> = ({
  actions = [],
  selectedAction = undefined,
  highlightedAction = undefined,
  onSelected = () => {},
  onHighlighted = () => {},
  setSelectedTab = () => {},
}) => {
  const actionListRef = React.createRef<HTMLDivElement>();

  React.useEffect(() => {
    actionListRef.current?.focus();
  }, [selectedAction, actionListRef]);

  return <div className='action-list vbox'>
    <div
      className='action-list-content'
      tabIndex={0}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown' &&  event.key !== 'ArrowUp')
          return;
        event.stopPropagation();
        event.preventDefault();
        const index = selectedAction ? actions.indexOf(selectedAction) : -1;
        let newIndex = index;
        if (event.key === 'ArrowDown') {
          if (index === -1)
            newIndex = 0;
          else
            newIndex = Math.min(index + 1, actions.length - 1);
        }
        if (event.key === 'ArrowUp') {
          if (index === -1)
            newIndex = actions.length - 1;
          else
            newIndex = Math.max(index - 1, 0);
        }
        const element = actionListRef.current?.children.item(newIndex);
        if ((element as any)?.scrollIntoViewIfNeeded)
          (element as any).scrollIntoViewIfNeeded(false);
        else
          element?.scrollIntoView();
        onSelected(actions[newIndex]);
      }}
      ref={actionListRef}
    >
      {actions.length === 0 && <div className='no-actions-entry'>No actions recorded</div>}
      {actions.map(action => {
        const { metadata } = action;
        const selectedSuffix = action === selectedAction ? ' selected' : '';
        const highlightedSuffix = action === highlightedAction ? ' highlighted' : '';
        const error = metadata.error?.error?.message;
        const { errors, warnings } = modelUtil.stats(action);
        return <div
          className={'action-entry' + selectedSuffix + highlightedSuffix}
          key={metadata.id}
          onClick={() => onSelected(action)}
          onMouseEnter={() => onHighlighted(action)}
          onMouseLeave={() => (highlightedAction === action) && onHighlighted(undefined)}
        >
          <div className='action-title'>
            <span>{metadata.apiName}</span>
            {metadata.params.selector && <div className='action-selector' title={metadata.params.selector}>{metadata.params.selector}</div>}
            {metadata.method === 'goto' && metadata.params.url && <div className='action-url' title={metadata.params.url}>{metadata.params.url}</div>}
          </div>
          <div className='action-duration' style={{ flex: 'none' }}>{metadata.endTime ? msToString(metadata.endTime - metadata.startTime) : 'Timed Out'}</div>
          <div className='action-icons' onClick={() => setSelectedTab('console')}>
            {!!errors && <div className='action-icon'><span className={'codicon codicon-error'}></span><span className="action-icon-value">{errors}</span></div>}
            {!!warnings && <div className='action-icon'><span className={'codicon codicon-warning'}></span><span className="action-icon-value">{warnings}</span></div>}
          </div>
          {error && <div className='codicon codicon-issues' title={error} />}
        </div>;
      })}
    </div>
  </div>;
};
