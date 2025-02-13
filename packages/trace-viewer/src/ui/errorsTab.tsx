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
import { CopyToClipboardTextButton } from './copyToClipboard';
import { attachmentURL } from './attachmentsTab';
import { fixTestPrompt } from '@web/components/prompts';
import type { GitCommitInfo } from '@testIsomorphic/types';
import { AIConversation } from './aiConversation';
import { ToolbarButton } from '@web/components/toolbarButton';
import { LLMMessage, useLLMChat, useLLMConversation } from './llm';
import { useAsyncMemo } from '@web/uiUtils';

const GitCommitInfoContext = React.createContext<GitCommitInfo | undefined>(undefined);

export function GitCommitInfoProvider({ children, gitCommitInfo }: React.PropsWithChildren<{ gitCommitInfo: GitCommitInfo }>) {
  return <GitCommitInfoContext.Provider value={gitCommitInfo}>{children}</GitCommitInfoContext.Provider>;
}

export function useGitCommitInfo() {
  return React.useContext(GitCommitInfoContext);
}

function usePageSnapshot(actions: modelUtil.ActionTraceEventInContext[]) {
  return useAsyncMemo<string | undefined>(async () => {
    for (const action of actions) {
      for (const attachment of action.attachments ?? []) {
        if (attachment.name === 'pageSnapshot') {
          const response = await fetch(attachmentURL({ ...attachment, traceUrl: action.context.traceUrl }));
          return await response.text();
        }
      }
    }
  }, [actions], undefined);
}

const CopyPromptButton: React.FC<{
  error: string;
  pageSnapshot?: string;
  diff?: string;
}> = ({ error, pageSnapshot, diff }) => {
  const prompt = React.useMemo(
      () => fixTestPrompt(
          error,
          diff,
          pageSnapshot
      ),
      [error, diff, pageSnapshot]
  );

  return (
    <CopyToClipboardTextButton
      value={prompt}
      description='Fix with AI'
      copiedDescription={<>Copied <span className='codicon codicon-copy' style={{ marginLeft: '5px' }}/></>}
      style={{ width: '90px', justifyContent: 'center' }}
    />
  );
};

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
  actions: modelUtil.ActionTraceEventInContext[],
  wallTime: number,
  sdkLanguage: Language,
  revealInSource: (error: ErrorDescription) => void,
}> = ({ errorsModel, sdkLanguage, revealInSource, actions, wallTime }) => {
  const [showLLM, setShowLLM] = React.useState(false);
  const llmAvailable = !!useLLMChat();
  const pageSnapshot = usePageSnapshot(actions);
  const gitCommitInfo = useGitCommitInfo();
  const diff = gitCommitInfo?.['pull.diff'] ?? gitCommitInfo?.['revision.diff'];
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

      const errorId = `error-${wallTime}-${longLocation}`;

      return <div key={message} style={{ minHeight: errorsModel.errors.size === 1 ? '100%' : undefined, display: 'flex', flexDirection: 'column' }}>
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
            {llmAvailable
              ? <ToolbarButton onClick={() => setShowLLM(v => !v)} title="Fix with AI" className='copy-to-clipboard-text-button'>Fix with AI</ToolbarButton>
              : <CopyPromptButton error={message} pageSnapshot={pageSnapshot} diff={diff} />}
          </span>
        </div>
        
        <ErrorMessage error={message} />

        {showLLM && <AIErrorConversation error={message} pageSnapshot={pageSnapshot} conversationId={errorId} diff={diff} />}
      </div>;
    })}
  </div>;
};

export function AIErrorConversation({ conversationId, error, pageSnapshot, diff }: { conversationId: string, error: string, pageSnapshot?: string, diff?: string }) {
  const [history, conversation] = useLLMConversation(
    conversationId,
    [
      `My Playwright test failed. What's going wrong?`,
      `Please give me a suggestion how to fix it, and then explain what went wrong. Be very concise and apply Playwright best practices.`,
      `Don't include many headings in your output. Make sure what you're saying is correct, and take into account whether there might be a bug in the app.`
    ].join('\n')
  );

  const firstPrompt = React.useMemo<LLMMessage>(() => {
    const message: LLMMessage = {
      role: 'user',
      content: `Here's the error: ${error}`,
      displayContent: `Help me with the error above.`
    }

    if (diff)
      message.content += `\n\nCode diff:\n${diff}`;
    if (pageSnapshot)
      message.content += `\n\nPage snapshot:\n${pageSnapshot}`;

    if (diff)
      message.displayContent += ` Take the code diff${pageSnapshot ? ' and page snapshot' : ''} into account.`;
    else if (pageSnapshot)
      message.displayContent += ` Take the page snapshot into account.`;

    return message;
  }, [diff, pageSnapshot, error]);

  return <AIConversation history={history} conversation={conversation} firstPrompt={firstPrompt} />;
}
