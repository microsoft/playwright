/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ErrorMessage } from '@web/components/errorMessage';
import * as React from 'react';
import type * as modelUtil from './modelUtil';
import { PlaceholderPanel } from './placeholderPanel';
import { renderAction } from './actionList';
import type { Language } from '@isomorphic/locatorGenerators';

type ErrorsTabModel = {
  errors: Map<string, modelUtil.ActionTraceEventInContext>;
};

export function useErrorsTabModel(model: modelUtil.MultiTraceModel | undefined): ErrorsTabModel {
  return React.useMemo(() => {
    const errors = new Map<string, modelUtil.ActionTraceEventInContext>();
    for (const action of model?.actions || []) {
      // Overwrite errors with the last one.
      if (action.error?.message)
        errors.set(action.error.message, action);
    }
    return { errors };
  }, [model]);
}

export const ErrorsTab: React.FunctionComponent<{
  errorsModel: ErrorsTabModel,
  sdkLanguage: Language,
  revealInSource: (action: modelUtil.ActionTraceEventInContext) => void,
}> = ({ errorsModel, sdkLanguage, revealInSource }) => {
  if (!errorsModel.errors.size)
    return <PlaceholderPanel text='No errors' />;

  return <div className='fill' style={{ overflow: 'auto' }}>
    {[...errorsModel.errors.entries()].map(([message, action]) => {
      let location: string | undefined;
      let longLocation: string | undefined;
      if (action.stack?.[0]) {
        const file = action.stack[0].file.replace(/.*\/(.*)/, '$1');
        location = file + ':' + action.stack[0].line;
        longLocation = action.stack[0].file + ':' + action.stack[0].line;
      }
      return <div key={message}>
        <div className='hbox' style={{
          alignItems: 'center',
          padding: '5px 10px',
          minHeight: 36,
          fontWeight: 'bold',
          color: 'var(--vscode-errorForeground)',
        }}>
          {renderAction(action, { sdkLanguage })}
          {location && <div className='action-location'>
            @ <span title={longLocation} onClick={() => revealInSource(action)}>{location}</span>
          </div>}
        </div>
        <ErrorMessage error={message} />
      </div>;
    })}
  </div>;
};
