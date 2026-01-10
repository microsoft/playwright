/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Dispatcher } from './dispatcher';
import { pageAgentExpect, pageAgentPerform, runLoop } from '../agent/pageAgent';
import { SdkObject } from '../instrumentation';
import { Context } from '../agent/context';

import type { PageDispatcher } from './pageDispatcher';
import type { DispatcherScope } from './dispatcher';
import type * as channels from '@protocol/channels';
import type { Progress } from '@protocol/progress';
import type { Page } from '../page';
import type * as loopTypes from '@lowire/loop';

export class PageAgentDispatcher extends Dispatcher<SdkObject, channels.PageAgentChannel, DispatcherScope> implements channels.PageAgentChannel {
  _type_PageAgent = true;
  _type_EventTarget = true;
  private _page: Page;
  private _agentParams: channels.PageAgentParams;
  private _usage: Usage = { turns: 0, inputTokens: 0, outputTokens: 0 };

  constructor(scope: PageDispatcher, options: channels.PageAgentParams) {
    super(scope, new SdkObject(scope._object, 'pageAgent'), 'PageAgent', { page: scope });
    this._page = scope._object;
    this._agentParams = options;
  }

  async perform(params: channels.PageAgentPerformParams, progress: Progress): Promise<channels.PageAgentPerformResult> {
    const resolvedParams = resolveCallOptions(this._agentParams, params);
    const context = new Context(progress, this._page, resolvedParams);

    await pageAgentPerform(context, {
      ...this._eventSupport(),
      ...resolvedParams,
      task: params.task,
    });
    return { usage: this._usage };
  }

  async expect(params: channels.PageAgentExpectParams, progress: Progress): Promise<channels.PageAgentExpectResult> {
    const resolvedParams = resolveCallOptions(this._agentParams, params);
    const context = new Context(progress, this._page, resolvedParams);

    await pageAgentExpect(context, {
      ...this._eventSupport(),
      ...resolvedParams,
      expectation: params.expectation,
    });
    return { usage: this._usage };
  }

  async extract(params: channels.PageAgentExtractParams, progress: Progress): Promise<channels.PageAgentExtractResult> {
    const resolvedParams = resolveCallOptions(this._agentParams, params);
    const context = new Context(progress, this._page, resolvedParams);

    const task = `
  ### Instructions
  Extract the following information from the page. Do not perform any actions, just extract the information.

  ### Query
  ${params.query}`;
    const { result } = await runLoop(context, [], task, params.schema, {
      ...this._eventSupport(),
      ...resolvedParams,
    });
    return { result, usage: this._usage };
  }

  async dispose(params: channels.PageAgentDisposeParams, progress: Progress): Promise<void> {
  }

  private _eventSupport(): loopTypes.LoopEvents {
    const self = this;
    return {
      onBeforeTurn(params: { conversation: loopTypes.Conversation }) {
        const userMessage = params.conversation.messages.find(m => m.role === 'user');
        self._dispatchEvent('turn', { role: 'user', message: userMessage?.content ?? '' });
        return 'continue' as const;
      },

      onAfterTurn(params: { assistantMessage: loopTypes.AssistantMessage, totalUsage: loopTypes.Usage }) {
        const usage = { inputTokens: params.totalUsage.input, outputTokens: params.totalUsage.output };
        const intent = params.assistantMessage.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
        self._dispatchEvent('turn', { role: 'assistant', message: intent, usage });
        if (!params.assistantMessage.content.filter(c => c.type === 'tool_call').length)
          self._dispatchEvent('turn', { role: 'assistant', message: `no tool calls`, usage });
        self._usage = { turns: self._usage.turns + 1, inputTokens: self._usage.inputTokens + usage.inputTokens, outputTokens: self._usage.outputTokens + usage.outputTokens };
        return 'continue' as const;
      },

      onBeforeToolCall(params: { toolCall: loopTypes.ToolCallContentPart }) {
        self._dispatchEvent('turn', { role: 'assistant', message: `call tool "${params.toolCall.name}"` });
        return 'continue' as const;
      },

      onAfterToolCall(params: { toolCall: loopTypes.ToolCallContentPart, result: loopTypes.ToolResult }) {
        const suffix = params.toolCall.result?.isError ? 'failed' : 'succeeded';
        self._dispatchEvent('turn', { role: 'user', message: `tool "${params.toolCall.name}" ${suffix}` });
        return 'continue' as const;
      },

      onToolCallError(params: { toolCall: loopTypes.ToolCallContentPart, error: Error }) {
        self._dispatchEvent('turn', { role: 'user', message: `tool "${params.toolCall.name}" failed: ${params.error.message}` });
        return 'continue' as const;
      }
    };
  }
}

function resolveCallOptions(agentParams: channels.PageAgentParams, callParams: channels.PageAgentPerformParams | channels.PageAgentExpectParams | channels.PageAgentExtractParams): channels.PageAgentParams {
  return {
    ...agentParams,
    ...callParams,
  };
}

type Usage = {
  turns: number,
  inputTokens: number,
  outputTokens: number,
};
