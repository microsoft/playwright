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

import { debug } from 'playwright-core/lib/utilsBundle';
import { renderModalStates } from './tab';

import type { Tab, TabSnapshot } from './tab';
import type { CallToolResult, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from './context';

export const requestDebug = debug('pw:mcp:request');

export class Response {
  private _result: string[] = [];
  private _code: string[] = [];
  private _images: { contentType: string, data: Buffer }[] = [];
  private _context: Context;
  private _includeSnapshot: 'none' | 'full' | 'incremental' = 'none';
  private _includeTabs = false;
  private _tabSnapshot: TabSnapshot | undefined;

  readonly toolName: string;
  readonly toolArgs: Record<string, any>;
  private _isError: boolean | undefined;

  constructor(context: Context, toolName: string, toolArgs: Record<string, any>) {
    this._context = context;
    this.toolName = toolName;
    this.toolArgs = toolArgs;
  }

  addResult(result: string) {
    this._result.push(result);
  }

  addError(error: string) {
    this._result.push(error);
    this._isError = true;
  }

  isError() {
    return this._isError;
  }

  result() {
    return this._result.join('\n');
  }

  addCode(code: string) {
    this._code.push(code);
  }

  code() {
    return this._code.join('\n');
  }

  addImage(image: { contentType: string, data: Buffer }) {
    this._images.push(image);
  }

  images() {
    return this._images;
  }

  setIncludeSnapshot(full?: 'full') {
    this._includeSnapshot = full ?? 'incremental';
  }

  setIncludeTabs() {
    this._includeTabs = true;
  }

  async finish() {
    // All the async snapshotting post-action is happening here.
    // Everything below should race against modal states.
    if (this._includeSnapshot !== 'none' && this._context.currentTab())
      this._tabSnapshot = await this._context.currentTabOrDie().captureSnapshot();
    for (const tab of this._context.tabs())
      await tab.updateTitle();
  }

  tabSnapshot(): TabSnapshot | undefined {
    return this._tabSnapshot;
  }

  logBegin() {
    if (requestDebug.enabled)
      requestDebug(this.toolName, this.toolArgs);
  }

  logEnd() {
    if (requestDebug.enabled)
      requestDebug(this.serialize({ omitSnapshot: true, omitBlobs: true }));
  }

  serialize(options: { omitSnapshot?: boolean, omitBlobs?: boolean } = {}): { content: (TextContent | ImageContent)[], isError?: boolean } {
    const response: string[] = [];

    // Start with command result.
    if (this._result.length) {
      response.push('### Result');
      response.push(this._result.join('\n'));
      response.push('');
    }

    // Add code if it exists.
    if (this._code.length) {
      response.push(`### Ran Playwright code
\`\`\`js
${this._code.join('\n')}
\`\`\``);
      response.push('');
    }

    // List browser tabs.
    if (this._includeSnapshot !== 'none' || this._includeTabs)
      response.push(...renderTabsMarkdown(this._context.tabs(), this._includeTabs));

    // Add snapshot if provided.
    if (this._tabSnapshot?.modalStates.length) {
      response.push(...renderModalStates(this._context, this._tabSnapshot.modalStates));
      response.push('');
    } else if (this._tabSnapshot) {
      const includeSnapshot = options.omitSnapshot ? 'none' : this._includeSnapshot;
      response.push(renderTabSnapshot(this._tabSnapshot, includeSnapshot));
      response.push('');
    }

    // Main response part
    const content: (TextContent | ImageContent)[] = [
      { type: 'text', text: response.join('\n') },
    ];

    // Image attachments.
    if (this._context.config.imageResponses !== 'omit') {
      for (const image of this._images)
        content.push({ type: 'image', data: options.omitBlobs ? '<blob>' : image.data.toString('base64'), mimeType: image.contentType });
    }

    this._redactSecrets(content);
    return { content, isError: this._isError };
  }

  private _redactSecrets(content: (TextContent | ImageContent)[]) {
    if (!this._context.config.secrets)
      return;

    for (const item of content) {
      if (item.type !== 'text')
        continue;
      for (const [secretName, secretValue] of Object.entries(this._context.config.secrets))
        item.text = item.text.replaceAll(secretValue, `<secret>${secretName}</secret>`);
    }
  }
}

function renderTabSnapshot(tabSnapshot: TabSnapshot, includeSnapshot: 'none' | 'full' | 'incremental'): string {
  const lines: string[] = [];

  if (tabSnapshot.consoleMessages.length) {
    lines.push(`### New console messages`);
    for (const message of tabSnapshot.consoleMessages)
      lines.push(`- ${trim(message.toString(), 100)}`);
    lines.push('');
  }

  if (tabSnapshot.downloads.length) {
    lines.push(`### Downloads`);
    for (const entry of tabSnapshot.downloads) {
      if (entry.finished)
        lines.push(`- Downloaded file ${entry.download.suggestedFilename()} to ${entry.outputFile}`);
      else
        lines.push(`- Downloading file ${entry.download.suggestedFilename()} ...`);
    }
    lines.push('');
  }

  if (includeSnapshot === 'incremental' && tabSnapshot.ariaSnapshotDiff === '') {
    // When incremental snapshot is present, but empty, do not render page state altogether.
    return lines.join('\n');
  }

  lines.push(`### Page state`);
  lines.push(`- Page URL: ${tabSnapshot.url}`);
  lines.push(`- Page Title: ${tabSnapshot.title}`);

  if (includeSnapshot !== 'none') {
    lines.push(`- Page Snapshot:`);
    lines.push('```yaml');
    if (includeSnapshot === 'incremental' && tabSnapshot.ariaSnapshotDiff !== undefined)
      lines.push(tabSnapshot.ariaSnapshotDiff);
    else
      lines.push(tabSnapshot.ariaSnapshot);
    lines.push('```');
  }

  return lines.join('\n');
}

function renderTabsMarkdown(tabs: Tab[], force: boolean = false): string[] {
  if (tabs.length === 1 && !force)
    return [];

  if (!tabs.length) {
    return [
      '### Open tabs',
      'No open tabs. Use the "browser_navigate" tool to navigate to a page first.',
      '',
    ];
  }

  const lines: string[] = ['### Open tabs'];
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const current = tab.isCurrentTab() ? ' (current)' : '';
    lines.push(`- ${i}:${current} [${tab.lastTitle()}] (${tab.page.url()})`);
  }
  lines.push('');
  return lines;
}

function trim(text: string, maxLength: number) {
  if (text.length <= maxLength)
    return text;
  return text.slice(0, maxLength) + '...';
}

function parseSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  const sectionHeaders = text.split(/^### /m).slice(1); // Remove empty first element

  for (const section of sectionHeaders) {
    const firstNewlineIndex = section.indexOf('\n');
    if (firstNewlineIndex === -1)
      continue;

    const sectionName = section.substring(0, firstNewlineIndex);
    const sectionContent = section.substring(firstNewlineIndex + 1).trim();
    sections.set(sectionName, sectionContent);
  }

  return sections;
}

export function parseResponse(response: CallToolResult) {
  if (response.content?.[0].type !== 'text')
    return undefined;
  const text = response.content[0].text;

  const sections = parseSections(text);
  const result = sections.get('Result');
  const code = sections.get('Ran Playwright code');
  const tabs = sections.get('Open tabs');
  const pageState = sections.get('Page state');
  const consoleMessages = sections.get('New console messages');
  const modalState = sections.get('Modal state');
  const downloads = sections.get('Downloads');
  const codeNoFrame = code?.replace(/^```js\n/, '').replace(/\n```$/, '');
  const isError = response.isError;
  const attachments = response.content.slice(1);

  return {
    result,
    code: codeNoFrame,
    tabs,
    pageState,
    consoleMessages,
    modalState,
    downloads,
    isError,
    attachments,
  };
}
