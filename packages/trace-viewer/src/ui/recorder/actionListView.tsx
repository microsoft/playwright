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

import type * as actionTypes from '@recorder/actions';
import { ListView } from '@web/components/listView';
import * as React from 'react';

const ActionList = ListView<actionTypes.ActionInContext>;

export const ActionListView: React.FC<{
  actions: actionTypes.ActionInContext[],
  selectedAction: actionTypes.ActionInContext | undefined,
  onSelectedAction: (action: actionTypes.ActionInContext | undefined) => void,
}> = ({
  actions,
  selectedAction,
  onSelectedAction,
}) => {
  return <div className='vbox'>
    <ActionList
      name='actions'
      items={actions}
      selectedItem={selectedAction}
      onSelected={onSelectedAction}
      render={renderAction} />
  </div>;
};

export const renderAction = (action: actionTypes.ActionInContext) => {
  return <>
    <div title={action.action.name}>
      <span>{action.action.name}</span>
    </div>
  </>;
};
