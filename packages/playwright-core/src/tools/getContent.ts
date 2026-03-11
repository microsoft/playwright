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

import { z } from '../mcpBundle';
import { defineTabTool } from './tool';

const getContentSchema = z.object({
  selector: z.string().optional().describe('CSS selector to filter content to specific elements'),
  viewportOnly: z.boolean().optional().describe('Only extract content currently visible in viewport (default: false)'),
  includeLinks: z.boolean().optional().describe('Format links as markdown (default: true)'),
  format: z.enum(['text', 'markdown', 'html']).optional().describe('Output format (default: "markdown")'),
});

function isVisibleInViewport(element: Element, viewportHeight: number): boolean {
  const rect = element.getBoundingClientRect();
  return rect.top >= 0 && rect.top < viewportHeight;
}

function extractContent(element: Element, options: {
  format: 'text' | 'markdown' | 'html';
  includeLinks: boolean;
  viewportOnly: boolean;
  viewportHeight: number;
}): string {
  const { format, includeLinks, viewportOnly, viewportHeight } = options;

  if (format === 'html') {
    return element.innerHTML;
  }

  // For text and markdown, we need to traverse the element tree
  let result = '';

  function traverse(node: Node, insideLink: boolean = false): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      // Skip whitespace-only text nodes that aren't significant
      if (text.trim() || result.length > 0) {
        result += text;
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE)
      return;

    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    // Skip scripts and styles
    if (tagName === 'script' || tagName === 'style' || tagName === 'noscript')
      return;

    // Check visibility for viewport-only mode
    if (viewportOnly && !isVisibleInViewport(element, viewportHeight))
      return;

    // Handle block elements - add newlines
    const isBlock = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'br', 'hr', 'thead', 'tbody', 'tfoot', 'th', 'td'].includes(tagName);
    if (isBlock && result.length > 0 && !result.endsWith('\n'))
      result += '\n';

    // Handle links for markdown format
    if (tagName === 'a' && format === 'markdown' && includeLinks) {
      const href = element.getAttribute('href');
      if (href) {
        const linkText = element.textContent || '';
        result += `[${linkText}](${href})`;
        return;
      }
    }

    // Handle list items for text format
    if (tagName === 'li' && format === 'text' && result.length > 0) {
      const lastNewline = result.lastIndexOf('\n');
      if (lastNewline === -1 || result.substring(lastNewline).trim().length > 0)
        result += '\n';
      result += '• ';
    }

    // Handle breaks
    if (tagName === 'br')
      result += '\n';

    // Traverse children
    let previousChild = null;
    for (const child of Array.from(element.childNodes)) {
      traverse(child, tagName === 'a' || insideLink);
      previousChild = child;
    }

    // Add trailing newline for block elements
    if (isBlock && format === 'markdown') {
      if (!result.endsWith('\n'))
        result += '\n';
    }
  }

  traverse(element);

  // Clean up excessive whitespace
  result = result.replace(/[ \t]+/g, ' ');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.trim();

  return result;
}

const getContent = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_get_content',
    title: 'Get page content',
    description: 'Extract text or structured content from the current page without writing JavaScript code',
    inputSchema: getContentSchema,
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const format = params.format || 'markdown';
    const includeLinks = params.includeLinks !== false;
    const viewportOnly = params.viewportOnly || false;

    await tab.waitForCompletion(async () => {
      const result = await tab.page.evaluate((options) => {
        const { selector, format, includeLinks, viewportOnly } = options;

        // Get the root element to extract from
        let rootElement: Element | null = null;
        if (selector) {
          rootElement = document.querySelector(selector);
          if (!rootElement)
            return { error: `No element found matching selector: "${selector}"` };
        } else {
          rootElement = document.body;
        }

        if (!rootElement)
          return { error: 'No content found on page' };

        const viewportHeight = window.innerHeight;

        // Helper function to check visibility
        function isVisibleInViewport(element: Element): boolean {
          const rect = element.getBoundingClientRect();
          return rect.top >= 0 && rect.top < viewportHeight;
        }

        // Extract content based on format
        if (format === 'html') {
          return { content: rootElement.innerHTML, format: 'html' };
        }

        // For text and markdown, traverse the element tree
        let result = '';
        const INVISIBLE = 'playwright-invisible';

        function traverse(node: Node, insideLink: boolean = false): void {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            if (text.trim() || result.length > 0) {
              result += text;
            }
            return;
          }

          if (node.nodeType !== Node.ELEMENT_NODE)
            return;

          const element = node as Element;
          const tagName = element.tagName.toLowerCase();

          // Skip scripts, styles, and hidden elements
          if (tagName === 'script' || tagName === 'style' || tagName === 'noscript')
            return;

          // Check visibility for viewport-only mode
          if (viewportOnly && !isVisibleInViewport(element))
            return;

          // Handle block elements
          const isBlock = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'br', 'hr', 'thead', 'tbody', 'tfoot', 'th', 'td', 'ul', 'ol', 'blockquote', 'pre', 'article', 'section', 'header', 'footer', 'main', 'nav', 'aside'].includes(tagName);
          if (isBlock && result.length > 0 && !result.endsWith('\n'))
            result += '\n';

          // Handle links for markdown format
          if (tagName === 'a' && format === 'markdown' && includeLinks) {
            const href = element.getAttribute('href');
            if (href) {
              const linkText = element.textContent || '';
              result += `[${linkText}](${href})`;
              return;
            }
          }

          // Handle list items for text format
          if (tagName === 'li' && format === 'text' && result.length > 0) {
            const lastNewline = result.lastIndexOf('\n');
            if (lastNewline === -1 || result.substring(lastNewline).trim().length > 0)
              result += '\n';
            result += '• ';
          }

          // Handle breaks
          if (tagName === 'br')
            result += '\n';

          // Handle headings in markdown
          if (format === 'markdown' && ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            const level = parseInt(tagName.charAt(1));
            result += '\n' + '#'.repeat(level) + ' ';
          }

          // Traverse children
          for (const child of Array.from(element.childNodes)) {
            traverse(child, tagName === 'a' || insideLink);
          }

          // Add trailing newline for block elements in markdown
          if (isBlock && format === 'markdown') {
            if (!result.endsWith('\n'))
              result += '\n';
          }
        }

        traverse(rootElement);

        // Clean up excessive whitespace
        result = result.replace(/[ \t]+/g, ' ');
        result = result.replace(/\n{3,}/g, '\n\n');
        result = result.trim();

        return { content: result, format };
      }, {
        selector: params.selector || null,
        format,
        includeLinks,
        viewportOnly,
      });

      if ('error' in result) {
        response.addError(result.error);
      } else {
        response.addTextResult(result.content);
      }
    });
  },
});

export default [
  getContent,
];
