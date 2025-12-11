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

import * as React from 'react';
import { PlaceholderPanel } from './placeholderPanel';
import './chatTab.css';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  message: string;
  timestamp?: number;
}

export interface LLMChatData {
  messages: ChatMessage[];
}

// Mock data for demonstration - will be replaced with real data integration
const mockChatData: LLMChatData = {
  messages: [
    {
      role: 'system',
      message: 'You are a helpful web automation assistant. Your task is to interact with web pages to accomplish user goals. Analyze the page content and take appropriate actions.',
    },
    {
      role: 'user',
      message: 'Please add "Buy groceries" to the todo list on this TodoMVC application.',
    },
    {
      role: 'assistant',
      message: 'I can see the TodoMVC application. I will:\n1. Click on the input field with placeholder "What needs to be done?"\n2. Type "Buy groceries"\n3. Press Enter to add the item\n\nLet me start by clicking on the input field.',
    },
    {
      role: 'user',
      message: 'Great, the item was added. Now mark it as completed.',
    },
    {
      role: 'assistant',
      message: 'I can see "Buy groceries" in the todo list. I will click on the checkbox next to it to mark it as completed.',
    },
  ],
};

export const ChatTab: React.FunctionComponent<{
  chatData?: LLMChatData,
}> = ({ chatData = mockChatData }) => {
  if (!chatData?.messages?.length) {
    return <PlaceholderPanel text='No chat messages' />;
  }

  return (
    <div className='chat-tab'>
      <div className='chat-messages'>
        {chatData.messages.map((msg, index) => (
          <div key={index} className={`chat-message chat-message--${msg.role}`}>
            <div className='chat-message-header'>
              <span className={`chat-role chat-role--${msg.role}`}>
                {getRoleLabel(msg.role)}
              </span>
              {msg.timestamp && (
                <span className='chat-timestamp'>
                  {formatTimestamp(msg.timestamp)}
                </span>
              )}
            </div>
            <div className='chat-message-content'>
              {msg.message}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function getRoleLabel(role: ChatMessage['role']): string {
  switch (role) {
    case 'system': return 'System';
    case 'user': return 'User';
    case 'assistant': return 'Assistant';
    default: return role;
  }
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}
