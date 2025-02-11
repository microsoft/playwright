import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown'
import './aiTab.css';
import type { LLMMessage } from 'playwright-core/lib/server/llm';
import { clsx } from '@web/uiUtils';

export interface AIState {
  prompt?: string;
  variables: Record<string, string>;
}

export function AITab({ state }: { state?: AIState }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<LLMMessage[]>([
    {
      role: "developer",
      content: 'You are a helpful assistant, skilled in programming and software testing with Playwright. Help me write good code. Be bold, creative and assertive when you suggest solutions.'
    }
  ]);
  const [abort, setAbort] = useState<AbortController>();

  const onSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInput('');
    const content = new FormData(event.target as any).get('content') as string;
    const messages = await new Promise<LLMMessage[]>(resolve => {
      setMessages(messages => {
          const newMessages = [...messages, { role: 'user', content } as LLMMessage];
          resolve(newMessages);
          return newMessages;
      })
    });
    const controller = new AbortController();
    setAbort(controller);

    const hydratedMessages = messages.map(message => {
      let content = message.content;
      for (const [variable, value] of Object.entries(state?.variables || {})) {
        content = content.replaceAll(variable, value);
      }
      return { ...message, content };
    })

    const response = await fetch('./llm/chat-completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(hydratedMessages),
      signal: controller.signal,
    });
    try {
      const decoder = new TextDecoder();
      let reply = '';
      function update() {
        setMessages(messages => {
          return messages.slice(0, -1).concat([{ role: 'assistant', content: reply }]);
        });
      }
      await response.body?.pipeTo(new WritableStream({
        write(chunk) {
          reply += decoder.decode(chunk, { stream: true });
          update();
        },
        close() {
          reply += decoder.decode();
          update();
        }
      }));
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
