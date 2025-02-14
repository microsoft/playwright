/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
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
import { useCallback, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import './aiConversation.css';
import { clsx } from '@web/uiUtils';
import { useLLMConversation } from './llm';

export function AIConversation({ conversationId }: { conversationId: string }) {
  const [history, conversation] = useLLMConversation(conversationId);
  const [input, setInput] = useState('');

  const onSubmit = useCallback(() => {
    setInput(content => {
      conversation.send(content);
      return '';
    });
  }, [conversation]);

  return (
    <div className='chat-container'>
      <p className='chat-disclaimer'>Chat based on {conversation.chat.api.name}. Check for mistakes.</p>
      <hr/>
      <div className='messages-container'>
        {history.filter(({ role }) => role !== 'developer').map((message, index) => (
          <div
            key={'' + index}
            className={clsx('message', message.role === 'user' && 'user-message')}
          >
            {message.role === 'assistant' && (
              <div className='message-icon'>
                <img src='playwright-logo.svg' />
              </div>
            )}
            <div className='message-content'>
              <Markdown options={{ disableParsingRawHTML: true }}>{message.displayContent ?? message.content}</Markdown>
            </div>
          </div>
        ))}
      </div>

      <div className='input-form'>
        <textarea
          name='content'
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder='Ask a question...'
          className='message-input'
        />
        {conversation.isSending() ? (
          <button type='button' className='send-button' onClick={evt => {
            evt.preventDefault();
            conversation.abortSending();
          }}>
            Cancel
          </button>
        ) : (
          <button className='send-button' disabled={!input.trim()} onClick={onSubmit}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}
