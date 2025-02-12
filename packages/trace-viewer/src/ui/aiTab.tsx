import { useCallback, useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown'
import './aiTab.css';
import type { LLMMessage } from 'playwright-core/lib/server/llm';
import { clsx } from '@web/uiUtils';
import { useLLMChat } from './llm';

export interface AIState {
  prompt?: string;
  variables: Record<string, string>;
}

export function AITab({ state }: { state?: AIState }) {
  const [input, setInput] = useState('');

  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const chat = useLLMChat();
  const conversation = useMemo(() => chat?.startConversation('You are a helpful assistant, skilled in programming and software testing with Playwright. Help me write good code. Be bold, creative and assertive when you suggest solutions.'), [chat]);

  const [abort, setAbort] = useState<AbortController>();

  const onSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    if (!conversation)
      return;

    event.preventDefault();
    setInput('');
    const content = new FormData(event.target as any).get('content') as string;

    const controller = new AbortController();
    setAbort(controller);

    try {
      for await (const _chunk of conversation?.send(content, controller.signal))
        setMessages([...conversation?.history])
    } finally {
      setAbort(undefined);
    }
  }, []);

  useEffect(() => {
    if (state?.prompt)
      setInput(state?.prompt);
  }, [state])

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.filter(({ role }) => role !== 'developer').map((message, index) => (
          <div
            key={'' + index}
            className={clsx('message', message.role === 'user' && 'user-message')}
          >
            {message.role === 'assistant' && (
              <div className="message-icon">
                <img src="playwright-logo.svg" />
              </div>
            )}
            <div className="message-content">
              <Markdown>{message.content}</Markdown>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="input-form">
        <input
          type="text"
          name='content'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="message-input"
        />
        {abort ? (
          <button type="button" className="send-button" onClick={(evt) => {
            evt.preventDefault()
            abort.abort()
          }}>
            Cancel
          </button>
        ) : (
          <button type="submit" className="send-button" disabled={!input.trim()}>
            Send
          </button>  
        )}
      </form>
    </div>
  );
}
