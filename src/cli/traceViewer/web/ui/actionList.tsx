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

import { ActionEntry } from '../../traceModel';
import './actionList.css';
import * as React from 'react';

export const ActionList: React.FunctionComponent<{
  actions: ActionEntry[],
  selectedAction?: ActionEntry,
  onSelected: (action: ActionEntry) => void,
}> = ({ actions, selectedAction, onSelected }) => {
  return <div className='action-list'>{actions.map(actionEntry => {
    const { action, actionId } = actionEntry;
    return <div
      className={'action-entry' + (actionEntry === selectedAction ? ' selected' : '')}
      key={actionId}
      onClick={() => onSelected(actionEntry)}>
      <div className='action-header'>
        <div className='action-title'>{action.action}</div>
        {action.selector && <div className='action-selector' title={action.selector}>{action.selector}</div>}
        {action.action === 'goto' && action.value && <div className='action-url' title={action.value}>{action.value}</div>}
      </div>
      <div className='action-thumbnail'>
        {action.snapshot ? <img src={`action-preview/${actionId}.png`} /> : 'No snapshot available'}
      </div>
    </div>;
  })}</div>;
};
