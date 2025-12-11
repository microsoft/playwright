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
import { CopyToClipboard } from './copyToClipboard';
import './axtreeTab.css';

export interface LLMAXTreeData {
  axtreeTxt: string;
  url?: string;
}

// Mock data for demonstration - will be replaced with real data integration
const mockAXTreeData: LLMAXTreeData = {
  url: 'https://demo.playwright.dev/todomvc/',
  axtreeTxt: `RootWebArea "TodoMVC" focused
  banner
    heading "todos" level=1
  main
    textbox "What needs to be done?" focused
    section
      checkbox "Toggle All"
      list "Todo list"
        listitem
          checkbox "Buy groceries" checked=false
          text "Buy groceries"
          button "Delete"
        listitem
          checkbox "Walk the dog" checked=true
          text "Walk the dog"
          button "Delete"
        listitem
          checkbox "Read a book" checked=false
          text "Read a book"
          button "Delete"
  contentinfo
    text "3 items left"
    list "Filters"
      listitem
        link "All" current=page
      listitem
        link "Active"
      listitem
        link "Completed"
    button "Clear completed"`,
};

export const AXTreeTab: React.FunctionComponent<{
  axtreeData?: LLMAXTreeData,
}> = ({ axtreeData = mockAXTreeData }) => {
  if (!axtreeData?.axtreeTxt) {
    return <PlaceholderPanel text='No accessibility tree data' />;
  }

  return (
    <div className='axtree-tab'>
      <div className='axtree-header'>
        <span className='axtree-label'>Accessibility Tree</span>
        {axtreeData.url && (
          <span className='axtree-url' title={axtreeData.url}>
            {axtreeData.url}
          </span>
        )}
        <div className='axtree-actions'>
          <CopyToClipboard value={axtreeData.axtreeTxt} />
        </div>
      </div>
      <div className='axtree-content'>
        <pre className='axtree-pre'>{highlightAXTree(axtreeData.axtreeTxt)}</pre>
      </div>
    </div>
  );
};

function highlightAXTree(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    const parts: React.ReactNode[] = [];
    let key = 0;

    // Match role names (words at the start or after indentation)
    const roleMatch = line.match(/^(\s*)([\w]+)/);
    if (roleMatch) {
      const [, indent, role] = roleMatch;
      parts.push(<span key={key++}>{indent}</span>);
      parts.push(<span key={key++} className='axtree-role'>{role}</span>);

      let rest = line.slice(indent.length + role.length);

      // Match quoted strings (names/labels)
      rest = rest.replace(/"([^"]+)"/g, (match, content) => {
        const placeholder = `__QUOTE_${key}__`;
        parts.push(<span key={key++} className='axtree-string'>"{content}"</span>);
        return placeholder;
      });

      // Match attributes (key=value)
      rest = rest.replace(/(\w+)=([\w"]+)/g, (match, attr, value) => {
        const placeholder = `__ATTR_${key}__`;
        parts.push(
          <span key={key++}>
            <span className='axtree-attr'>{attr}</span>
            <span>=</span>
            <span className='axtree-value'>{value}</span>
          </span>
        );
        return placeholder;
      });

      // Match level indicators
      rest = rest.replace(/level=(\d+)/g, (match, level) => {
        const placeholder = `__LEVEL_${key}__`;
        parts.push(
          <span key={key++}>
            <span className='axtree-attr'>level</span>
            <span>=</span>
            <span className='axtree-value'>{level}</span>
          </span>
        );
        return placeholder;
      });

      // Add remaining text
      const remainingParts = rest.split(/__\w+_\d+__/);
      for (const part of remainingParts) {
        if (part) {
          parts.push(<span key={key++}>{part}</span>);
        }
      }
    } else {
      parts.push(<span key={key++}>{line}</span>);
    }

    return (
      <div key={index} className='axtree-line'>
        {parts}
      </div>
    );
  });
}
