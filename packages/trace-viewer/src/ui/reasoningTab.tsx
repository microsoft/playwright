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
import './reasoningTab.css';

export interface LLMReasoningData {
  reasoning: string;
  actionDescription?: string;
}

// Mock data for demonstration - will be replaced with real data integration
const mockReasoningData: LLMReasoningData = {
  reasoning: `## Analysis

The current page shows a TodoMVC application interface. I can observe the following elements:

- A text input field with placeholder "What needs to be done?"
- A list of existing todo items below
- Filter buttons at the bottom: "All", "Active", "Completed"

## Decision

I will click on the input field and type "Buy groceries" to add a new todo item. This is the next step required to complete the task of adding items to the todo list.

## Reasoning

1. The input field is clearly visible and accessible
2. No existing todo item matches "Buy groceries"
3. This action aligns with the user's goal of managing their todo list

## Expected Outcome

After typing and pressing Enter, a new todo item "Buy groceries" should appear in the list below the input field.`,
  actionDescription: 'click → input[placeholder="What needs to be done?"]'
};

export const ReasoningTab: React.FunctionComponent<{
  reasoning?: LLMReasoningData,
}> = ({ reasoning = mockReasoningData }) => {
  if (!reasoning?.reasoning) {
    return <PlaceholderPanel text='No reasoning data available' />;
  }

  return (
    <div className='reasoning-tab'>
      {reasoning.actionDescription && (
        <div className='reasoning-action'>
          <span className='reasoning-action-label'>Action:</span>
          <code className='reasoning-action-value'>{reasoning.actionDescription}</code>
        </div>
      )}
      <div className='reasoning-content'>
        {renderMarkdown(reasoning.reasoning)}
      </div>
    </div>
  );
};

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className='reasoning-heading'>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className='reasoning-subheading'>{line.slice(4)}</h3>);
    } else if (line.startsWith('- ')) {
      elements.push(<li key={key++} className='reasoning-list-item'>{line.slice(2)}</li>);
    } else if (line.match(/^\d+\.\s/)) {
      const content = line.replace(/^\d+\.\s/, '');
      elements.push(<li key={key++} className='reasoning-list-item numbered'>{content}</li>);
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className='reasoning-spacer' />);
    } else {
      elements.push(<p key={key++} className='reasoning-paragraph'>{line}</p>);
    }
  }

  return elements;
}
