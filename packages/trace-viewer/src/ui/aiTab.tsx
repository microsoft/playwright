import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown'
import './aiTab.css';
import { clsx } from '@web/uiUtils';
import { useLLMConversation } from './llm';

export interface AIState {
  prompt?: string;
  variables: Record<string, string>;
}

export function AITab({ state }: { state?: AIState }) {
  const [input, setInput] = useState('');
  const [history, conversation] = useLLMConversation('aitab', 'You are a helpful assistant, skilled in programming and software testing with Playwright. Help me write good code. Be bold, creative and assertive when you suggest solutions.');
  const [abort, setAbort] = useState<AbortController>();

  const onSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    if (!conversation)
      return;

    event.preventDefault();
    setInput('');
    const content = new FormData(event.target as any).get('content') as string;

    const controller = new AbortController();
    try { 
      setAbort(controller);
      await conversation.send(content, undefined, controller.signal);
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
        {history.filter(({ role }) => role !== 'developer').map((message, index) => (
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
              <Markdown>{message.displayContent ?? message.content}</Markdown>
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
