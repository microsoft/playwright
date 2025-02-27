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
import type { MetadataWithCommitInfo } from '@testIsomorphic/types';
import { AIConversation } from './aiConversation';
import { ToolbarButton } from '@web/components/toolbarButton';
import { useIsLLMAvailable, useLLMChat } from './llm';
import { useAsyncMemo } from '@web/uiUtils';
import { useSources } from './sourceTab';

const CommitInfoContext = React.createContext<MetadataWithCommitInfo | undefined>(undefined);

export function CommitInfoProvider({ children, commitInfo }: React.PropsWithChildren<{ commitInfo: MetadataWithCommitInfo }>) {
  return <CommitInfoContext.Provider value={commitInfo}>{children}</CommitInfoContext.Provider>;
}

export function useCommitInfo() {
  return React.useContext(CommitInfoContext);
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

function useCodeFrame(stack: StackFrame[] | undefined, sources: Map<string, modelUtil.SourceModel>, width: number) {
  const selectedFrame = stack?.[0];
  const { source } = useSources(stack, 0, sources);
  return React.useMemo(() => {
    if (!source.content)
      return '';

    const targetLine = selectedFrame?.line ?? 0;

    const lines = source.content.split('\n');
    const start = Math.max(0, targetLine - width);
    const end = Math.min(lines.length, targetLine + width);
    const lineNumberWidth = String(end).length;
    const codeFrame = lines.slice(start, end).map((line, i) => {
      const lineNumber = start + i + 1;
      const paddedLineNumber = String(lineNumber).padStart(lineNumberWidth, ' ');
      if (lineNumber !== targetLine)
        return `  ${(paddedLineNumber)} | ${line}`;

      let highlightLine = `> ${paddedLineNumber} | ${line}`;
      if (selectedFrame?.column)
        highlightLine += `\n${' '.repeat(4 + lineNumberWidth + selectedFrame.column)}^`;
      return highlightLine;
    }).join('\n');
    return codeFrame;
  }, [source, selectedFrame, width]);
}

const CopyPromptButton: React.FC<{
  error: string;
  codeFrame: string;
  pageSnapshot?: string;
  diff?: string;
}> = ({ error, codeFrame, pageSnapshot, diff }) => {
  const prompt = React.useMemo(
      () => fixTestPrompt(
          error + '\n\n' + codeFrame,
          diff,
          pageSnapshot
      ),
      [error, diff, codeFrame, pageSnapshot]
  );

  return (
    <CopyToClipboardTextButton
      value={prompt}
      description='Copy as Prompt'
      copiedDescription={<>Copied <span className='codicon codicon-copy' style={{ marginLeft: '5px' }}/></>}
      style={{ width: '120px', justifyContent: 'center' }}
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

function Error({ message, error, errorId, sdkLanguage, pageSnapshot, revealInSource, sources }: { message: string, error: ErrorDescription, errorId: string, sdkLanguage: Language, pageSnapshot?: string, revealInSource: (error: ErrorDescription) => void, sources: Map<string, modelUtil.SourceModel> }) {
  const [showLLM, setShowLLM] = React.useState(false);
  const llmAvailable = useIsLLMAvailable();
  const metadata = useCommitInfo();

  let location: string | undefined;
  let longLocation: string | undefined;
  const stackFrame = error.stack?.[0];
  if (stackFrame) {
    const file = stackFrame.file.replace(/.*[/\\](.*)/, '$1');
    location = file + ':' + stackFrame.line;
    longLocation = stackFrame.file + ':' + stackFrame.line;
  }

  const codeFrame = useCodeFrame(error.stack, sources, 3);

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
        {llmAvailable
          ? <FixWithAIButton conversationId={errorId} onChange={setShowLLM} value={showLLM} error={message} diff={metadata?.gitDiff} pageSnapshot={pageSnapshot} />
          : <CopyPromptButton error={message} codeFrame={codeFrame} pageSnapshot={pageSnapshot} diff={metadata?.gitDiff} />}
      </span>
    </div>

    <ErrorMessage error={message} />

    {showLLM && <AIConversation conversationId={errorId} />}
  </div>;
}

function FixWithAIButton({ conversationId, value, onChange, error, diff, pageSnapshot }: { conversationId: string, value: boolean, onChange: React.Dispatch<React.SetStateAction<boolean>>, error: string, diff?: string, pageSnapshot?: string }) {
  const chat = useLLMChat();

  return <ToolbarButton
    onClick={() => {
      if (!chat.getConversation(conversationId)) {
        const conversation = chat.startConversation(conversationId, [
          `My Playwright test failed. What's going wrong?`,
          `Please give me a suggestion how to fix it, and then explain what went wrong. Be very concise and apply Playwright best practices.`,
          `Don't include many headings in your output. Make sure what you're saying is correct, and take into account whether there might be a bug in the app.`
        ].join('\n'));

        let content = `Here's the error: ${error}`;
        let displayContent = `Help me with the error above.`;

        if (diff)
          content += `\n\nCode diff:\n${diff}`;
        if (pageSnapshot)
          content += `\n\nPage snapshot:\n${pageSnapshot}`;

        if (diff)
          displayContent += ` Take the code diff${pageSnapshot ? ' and page snapshot' : ''} into account.`;
        else if (pageSnapshot)
          displayContent += ` Take the page snapshot into account.`;

        conversation.send(content, displayContent);
      }

      onChange(v => !v);
    }}
    style={{ width: '96px', justifyContent: 'center' }}
    title='Fix with AI'
    className='copy-to-clipboard-text-button'
  >
    {value ? 'Hide AI' : 'Fix with AI'}
  </ToolbarButton>;
}

export const ErrorsTab: React.FunctionComponent<{
  errorsModel: ErrorsTabModel,
  actions: modelUtil.ActionTraceEventInContext[],
  wallTime: number,
  sources: Map<string, modelUtil.SourceModel>,
  sdkLanguage: Language,
  revealInSource: (error: ErrorDescription) => void,
}> = ({ errorsModel, sdkLanguage, revealInSource, actions, wallTime, sources }) => {
  const pageSnapshot = usePageSnapshot(actions);

  if (!errorsModel.errors.size)
    return <PlaceholderPanel text='No errors' />;

  return <div className='fill' style={{ overflow: 'auto' }}>
    {[...errorsModel.errors.entries()].map(([message, error]) => {
      const errorId = `error-${wallTime}-${message}`;
      return <Error key={errorId} errorId={errorId} message={message} error={error} sources={sources} revealInSource={revealInSource} sdkLanguage={sdkLanguage} pageSnapshot={pageSnapshot} />;
    })}
  </div>;
};
