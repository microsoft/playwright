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
import { CopyToClipboardTextButton } from './copyToClipboard';
import { useAsyncMemo } from '@web/uiUtils';
import { attachmentURL } from './attachmentsTab';
import { fixTestInstructions } from '@web/prompts';

const CopyPromptButton: React.FC<{ prompt: string }> = ({ prompt }) => {
  return (
    <CopyToClipboardTextButton
      value={prompt}
      description='Copy prompt'
      copiedDescription={<>Copied <span className='codicon codicon-copy' style={{ marginLeft: '5px' }}/></>}
      style={{ width: '120px', justifyContent: 'center' }}
    />
  );
};

type ErrorsTabModel = {
  errors: Map<string, modelUtil.ErrorDescription>;
};

export function useErrorsTabModel(model: modelUtil.MultiTraceModel | undefined): ErrorsTabModel {
  return React.useMemo(() => {
    if (!model)
      return { errors: new Map() };
    const errors = new Map<string, modelUtil.ErrorDescription>();
    for (const error of model.errorDescriptors)
      errors.set(error.message, error);
    return { errors };
  }, [model]);
}

function ErrorView({ message, error, sdkLanguage, revealInSource }: { message: string, error: modelUtil.ErrorDescription, sdkLanguage: Language, revealInSource: (error: modelUtil.ErrorDescription) => void }) {
  let location: string | undefined;
  let longLocation: string | undefined;
  const stackFrame = error.stack?.[0];
  if (stackFrame) {
    const file = stackFrame.file.replace(/.*[/\\](.*)/, '$1');
    location = file + ':' + stackFrame.line;
    longLocation = stackFrame.file + ':' + stackFrame.line;
  }

  const prompt = useAsyncMemo(async () => {
    if (!error.context)
      return;
    const response = await fetch(attachmentURL(error.context));
    return fixTestInstructions + await response.text();
  }, [error], undefined);

  return <div style={{ display: 'flex', flexDirection: 'column', overflowX: 'clip' }}>
    <div className='hbox' style={{
      alignItems: 'center',
      padding: '5px 10px',
      minHeight: 36,
      fontWeight: 'bold',
      color: 'var(--vscode-errorForeground)',
      flex: 0,
    }}>
      {error.action && renderAction(error.action, { sdkLanguage })}
      {location && <div className='action-location'>
        @ <span title={longLocation} onClick={() => revealInSource(error)}>{location}</span>
      </div>}
      <span style={{ position: 'absolute', right: '5px' }}>
        {prompt && <CopyPromptButton prompt={prompt} />}
      </span>
    </div>

    <ErrorMessage error={message} />
  </div>;
}

export const ErrorsTab: React.FunctionComponent<{
  errorsModel: ErrorsTabModel,
  wallTime: number,
  sdkLanguage: Language,
  revealInSource: (error: modelUtil.ErrorDescription) => void,
}> = ({ errorsModel, sdkLanguage, revealInSource, wallTime }) => {
  if (!errorsModel.errors.size)
    return <PlaceholderPanel text='No errors' />;

  return <div className='fill' style={{ overflow: 'auto' }}>
    {[...errorsModel.errors.entries()].map(([message, error]) => {
      const errorId = `error-${wallTime}-${message}`;
      return <ErrorView key={errorId} message={message} error={error} revealInSource={revealInSource} sdkLanguage={sdkLanguage} />;
    })}
  </div>;
};
