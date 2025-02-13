import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown'
import './aiConversation.css';
import { clsx } from '@web/uiUtils';
import type { Conversation, LLMMessage } from './llm';

export function AIConversation({ history, conversation, firstPrompt }: { history: LLMMessage[], conversation: Conversation, firstPrompt?: LLMMessage }) {
  const [input, setInput] = useState('');
  const [abort, setAbort] = useState<AbortController>();

  const send = useCallback(async (prompt: string, visiblePrompt?: string) => {
    const controller = new AbortController();
    setAbort(controller);
    try {
      await conversation.send(prompt, visiblePrompt, controller.signal);
    } finally {
      setAbort(undefined);
    }
  }, [conversation]);

  const onSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInput('');
    const content = new FormData(event.target as any).get('content') as string;
    await send(content);
  }, [send]);

  useEffect(() => {
    if (!conversation.isEmpty())
      return;
    if (!firstPrompt)
      return;

    send(firstPrompt.content, firstPrompt.displayContent);
  }, [conversation, firstPrompt, send]);

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
