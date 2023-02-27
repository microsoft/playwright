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

import type { ActionTraceEvent } from '@trace/trace';
import { msToString } from '@web/uiUtils';
import { ListView } from '@web/components/listView';
import * as React from 'react';
import './actionList.css';
import * as modelUtil from './modelUtil';
import { asLocator } from '@isomorphic/locatorGenerators';
import type { Language } from '@isomorphic/locatorGenerators';

export interface ActionListProps {
  actions: ActionTraceEvent[],
  selectedAction: ActionTraceEvent | undefined,
  sdkLanguage: Language | undefined;
  onSelected: (action: ActionTraceEvent) => void,
  onHighlighted: (action: ActionTraceEvent | undefined) => void,
  setSelectedTab: (tab: string) => void,
}

export const ActionList: React.FC<ActionListProps> = ({
  actions = [],
  selectedAction,
  sdkLanguage,
  onSelected = () => {},
  onHighlighted = () => {},
  setSelectedTab = () => {},
}) => {
  return <ListView
    items={actions}
    selectedItem={selectedAction}
    onSelected={(action: ActionTraceEvent) => onSelected(action)}
    onHighlighted={(action: ActionTraceEvent) => onHighlighted(action)}
    itemKey={(action: ActionTraceEvent) => action.callId}
    itemType={(action: ActionTraceEvent) => action.error?.message ? 'error' : undefined}
    itemRender={(action: ActionTraceEvent) => renderAction(action, sdkLanguage, setSelectedTab)}
    showNoItemsMessage={true}
  ></ListView>;
};

const renderAction = (
  action: ActionTraceEvent,
  sdkLanguage: Language | undefined,
  setSelectedTab: (tab: string) => void
) => {
  const { errors, warnings } = modelUtil.stats(action);
  const locator = action.params.selector ? asLocator(sdkLanguage || 'javascript', action.params.selector) : undefined;

  return <>
    <div className='action-title'>
      <span>{action.apiName}</span>
      {locator && <div className='action-selector' title={locator}>{locator}</div>}
      {action.method === 'goto' && action.params.url && <div className='action-url' title={action.params.url}>{action.params.url}</div>}
    </div>
    <div className='action-duration' style={{ flex: 'none' }}>{action.endTime ? msToString(action.endTime - action.startTime) : 'Timed Out'}</div>
    <div className='action-icons' onClick={() => setSelectedTab('console')}>
      {!!errors && <div className='action-icon'><span className={'codicon codicon-error'}></span><span className="action-icon-value">{errors}</span></div>}
      {!!warnings && <div className='action-icon'><span className={'codicon codicon-warning'}></span><span className="action-icon-value">{warnings}</span></div>}
    </div>
  </>;
};
