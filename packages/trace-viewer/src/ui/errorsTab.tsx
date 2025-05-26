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
import { copyPrompt } from '@web/prompts';
import { MetadataWithCommitInfo } from '@testIsomorphic/types';
import { calculateSha1 } from './sourceTab';

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

function ErrorView({ message, error, sdkLanguage, revealInSource }: { message: string, error: modelUtil.ErrorDescription, sdkLanguage: Language, revealInSource: (error: modelUtil.ErrorDescription) => void }) {
  let location: string | undefined;
  let longLocation: string | undefined;
  const stackFrame = error.stack?.[0];
  if (stackFrame) {
    const file = stackFrame.file.replace(/.*[/\\](.*)/, '$1');
    location = file + ':' + stackFrame.line;
    longLocation = stackFrame.file + ':' + stackFrame.line;
  }

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
    </div>

    <ErrorMessage error={message} />
  </div>;
}

export const ErrorsTab: React.FunctionComponent<{
  model: modelUtil.MultiTraceModel | undefined,
  wallTime: number,
  sdkLanguage: Language,
  revealInSource: (error: modelUtil.ErrorDescription) => void,
  metadata?: MetadataWithCommitInfo,
}> = ({ model, sdkLanguage, revealInSource, wallTime, metadata }) => {
  const errorContext = useAsyncMemo(async () => {
    const attachment = model?.attachments.find(a => a.name === 'error-context');
    if (!attachment)
      return;
    if (attachment.path)
      return await fetch(attachment.path).then(response => response.text());
  }, [model?.attachments], undefined);

  const prompt = useAsyncMemo(() =>
    copyPrompt(
        model?.title ?? '',
        (model?.errorDescriptors ?? []).map(error => ({
          message: error.message,
          location: error.stack?.[0]
        })),
        metadata,
        errorContext,
        async file => {
          let response = await fetch(`sha1/src@${await calculateSha1(file)}.txt`);
          if (response.status === 404)
            response = await fetch(`file?path=${encodeURIComponent(file)}`);
          if (response.status >= 400)
            return;
          return await response.text();
        }
    ), [model, metadata, errorContext], undefined
  );

  if (!model?.errorDescriptors.length)
    return <PlaceholderPanel text='No errors' />;

  return <div className='fill' style={{ overflow: 'auto' }}>
    <span style={{ position: 'absolute', right: '5px', top: '5px', zIndex: 1 }}>
      {prompt && <CopyPromptButton prompt={prompt} />}
    </span>
    {model?.errorDescriptors.map(error => {
      const errorId = `error-${wallTime}-${error.message}`;
      return <ErrorView key={errorId} message={error.message} error={error} revealInSource={revealInSource} sdkLanguage={sdkLanguage} />;
    })}
  </div>;
};
