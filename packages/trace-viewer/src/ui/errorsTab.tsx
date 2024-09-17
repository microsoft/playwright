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
import type { StackFrame } from '@protocol/channels';

export type ErrorDescription = {
  action?: modelUtil.ActionTraceEventInContext;
  stack?: StackFrame[];
};

type ErrorsTabModel = {
  errors: Map<string, ErrorDescription>;
};

export function useErrorsTabModel(model: modelUtil.MultiTraceModel | undefined): ErrorsTabModel {
  return React.useMemo(() => {
    if (!model)
      return { errors: new Map() };
    const errors = new Map<string, ErrorDescription>();
    for (const error of model.errorDescriptors)
      errors.set(error.message, error);
    return { errors };
  }, [model]);
}

export const ErrorsTab: React.FunctionComponent<{
  errorsModel: ErrorsTabModel,
  sdkLanguage: Language,
  revealInSource: (error: ErrorDescription) => void,
}> = ({ errorsModel, sdkLanguage, revealInSource }) => {
  if (!errorsModel.errors.size)
    return <PlaceholderPanel text='No errors' />;

  return <div className='fill' style={{ overflow: 'auto' }}>
    {[...errorsModel.errors.entries()].map(([message, error]) => {
      let location: string | undefined;
      let longLocation: string | undefined;
      const stackFrame = error.stack?.[0];
      if (stackFrame) {
        const file = stackFrame.file.replace(/.*[/\\](.*)/, '$1');
        location = file + ':' + stackFrame.line;
        longLocation = stackFrame.file + ':' + stackFrame.line;
      }
      return <div key={message}>
        <div className='hbox' style={{
          alignItems: 'center',
          padding: '5px 10px',
          minHeight: 36,
          fontWeight: 'bold',
          color: 'var(--vscode-errorForeground)',
        }}>
          {error.action && renderAction(error.action, { sdkLanguage })}
          {location && <div className='action-location'>
            @ <span title={longLocation} onClick={() => revealInSource(error)}>{location}</span>
          </div>}
        </div>
        <ErrorMessage error={message} />
      </div>;
    })}
  </div>;
};
