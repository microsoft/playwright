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
import '../actionList.css';
import { traceParamsForAction } from '@isomorphic/recorderUtils';
import { asLocator } from '@isomorphic/locatorGenerators';
import type { Language } from '@isomorphic/locatorGenerators';

const ActionList = ListView<actionTypes.ActionInContext>;

export const ActionListView: React.FC<{
  sdkLanguage: Language,
  actions: actionTypes.ActionInContext[],
  selectedAction: actionTypes.ActionInContext | undefined,
  onSelectedAction: (action: actionTypes.ActionInContext | undefined) => void,
}> = ({
  sdkLanguage,
  actions,
  selectedAction,
  onSelectedAction,
}) => {
  const render = React.useCallback((action: actionTypes.ActionInContext) => {
    return renderAction(sdkLanguage, action);
  }, [sdkLanguage]);
  return <div className='vbox'>
    <ActionList
      name='actions'
      items={actions}
      selectedItem={selectedAction}
      onSelected={onSelectedAction}
      render={render} />
  </div>;
};

export const renderAction = (sdkLanguage: Language, action: actionTypes.ActionInContext) => {
  const { method, params } = traceParamsForAction(action);
  const locator = params.selector ? asLocator(sdkLanguage || 'javascript', params.selector) : undefined;

  const apiName = `page.${method}`;
  return <>
    <div className='action-title' title={apiName}>
      <span>{apiName}</span>
      {locator && <div className='action-selector' title={locator}>{locator}</div>}
      {method === 'goto' && params.url && <div className='action-url' title={params.url}>{params.url}</div>}
    </div>
  </>;
};
