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
import type { ModalState } from './tools/tool';

export const requestDebug = debug('pw:mcp:request');

export class Response {
  private _result: string[] = [];
  private _code: string[] = [];
  private _images: { contentType: string, data: Buffer }[] = [];
  private _files: { fileName: string, title: string }[] = [];
  private _context: Context;
  private _includeSnapshot: 'none' | 'full' | 'incremental' = 'none';
  private _includeTabs = false;
  private _includeModalStates: ModalState[] | undefined;
  private _includeMetaOnly: boolean = false;
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

  async addFile(fileName: string, options: { origin: 'code' | 'llm' | 'web', reason: string }) {
    const resolvedFile = await this._context.outputFile(fileName, options);
    this._files.push({ fileName: resolvedFile, title: options.reason });
    return resolvedFile;
  }

  setIncludeSnapshot() {
    this._includeSnapshot = this._context.config.snapshot.mode;
  }

  setIncludeFullSnapshot() {
    this._includeSnapshot = 'full';
  }

  setIncludeTabs() {
    this._includeTabs = true;
  }

  setIncludeModalStates(modalStates: ModalState[]) {
    this._includeModalStates = modalStates;
  }

  setIncludeMetaOnly() {
    this._includeMetaOnly = true;
  }

  async finish() {
    if (this._tabSnapshot)
      return;

    // All the async snapshotting post-action is happening here.
    // Everything below should race against modal states.
    if (this._context.currentTab())
      this._tabSnapshot = await this._context.currentTabOrDie().captureSnapshot(this._includeSnapshot !== 'none');
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
      requestDebug(this.serialize());
  }

  render(): RenderedResponse{
    const renderedResponse = new RenderedResponse();

    if (this._result.length)
      renderedResponse.results.push(...this._result);

    // Add code if it exists.
    if (this._code.length && this._context.config.codegen !== 'none')
      renderedResponse.code.push(...this._code);

    // List browser tabs.
    if (this._includeSnapshot !== 'none' || this._includeTabs) {
      const tabsMarkdown = renderTabsMarkdown(this._context.tabs(), this._includeTabs);
      if (tabsMarkdown.length)
        renderedResponse.states.tabs = tabsMarkdown.join('\n');
    }

    // Add snapshot if provided.
    if (this._tabSnapshot?.modalStates.length) {
      const modalStatesMarkdown = renderModalStates(this._tabSnapshot.modalStates);
      renderedResponse.states.modal = modalStatesMarkdown.join('\n');
    } else if (this._includeModalStates) {
      const modalStatesMarkdown = renderModalStates(this._includeModalStates);
      renderedResponse.states.modal = modalStatesMarkdown.join('\n');
    } else if (this._tabSnapshot) {
      renderTabSnapshot(this._tabSnapshot, this._includeSnapshot, renderedResponse);
    }

    if (this._files.length) {
      const lines: string[] = [];
      for (const file of this._files)
        lines.push(`- [${file.title}](${file.fileName})`);
      renderedResponse.updates.push({ category: 'files', content: lines.join('\n') });
    }

    return this._context.config.secrets ? renderedResponse.redact(this._context.config.secrets) : renderedResponse;
  }

  serialize(options: { _meta?: Record<string, any> } = {}): { content: (TextContent | ImageContent)[], isError?: boolean, _meta?: Record<string, any> } {
    const renderedResponse = this.render();
    const includeMeta = options._meta && 'dev.lowire/history' in options._meta && 'dev.lowire/state' in options._meta;
    const _meta: any = includeMeta ? renderedResponse.asMeta() : undefined;

    const content: (TextContent | ImageContent)[] = [
      {
        type: 'text',
        text: renderedResponse.asText(this._includeMetaOnly ? { categories: ['files'] } : undefined)
      },
    ];

    if (this._includeMetaOnly)
      return { _meta, content, isError: this._isError };

    // Image attachments.
    if (this._context.config.imageResponses !== 'omit') {
      for (const image of this._images)
        content.push({ type: 'image', data: image.data.toString('base64'), mimeType: image.contentType });
    }

    return {
      _meta,
      content,
      isError: this._isError
    };
  }
}

function renderTabSnapshot(tabSnapshot: TabSnapshot, includeSnapshot: 'none' | 'full' | 'incremental', response: RenderedResponse) {
  if (tabSnapshot.consoleMessages.length) {
    const lines: string[] = [];
    for (const message of tabSnapshot.consoleMessages)
      lines.push(`- ${trimMiddle(message.toString(), 100)}`);
    response.updates.push({ category: 'console', content: lines.join('\n') });
  }

  if (tabSnapshot.downloads.length) {
    const lines: string[] = [];
    for (const entry of tabSnapshot.downloads) {
      if (entry.finished)
        lines.push(`- Downloaded file ${entry.download.suggestedFilename()} to ${entry.outputFile}`);
      else
        lines.push(`- Downloading file ${entry.download.suggestedFilename()} ...`);
    }
    response.updates.push({ category: 'downloads', content: lines.join('\n') });
  }

  if (includeSnapshot === 'incremental' && tabSnapshot.ariaSnapshotDiff === '') {
    // When incremental snapshot is present, but empty, do not render page state altogether.
    return;
  }

  const lines: string[] = [];
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
  response.states.page = lines.join('\n');
}

function renderTabsMarkdown(tabs: Tab[], force: boolean = false): string[] {
  if (tabs.length === 1 && !force)
    return [];

  if (!tabs.length)
    return ['No open tabs. Use the "browser_navigate" tool to navigate to a page first.'];

  const lines: string[] = [];
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const current = tab.isCurrentTab() ? ' (current)' : '';
    lines.push(`- ${i}:${current} [${tab.lastTitle()}] (${tab.page.url()})`);
  }
  return lines;
}

function trimMiddle(text: string, maxLength: number) {
  if (text.length <= maxLength)
    return text;
  return text.slice(0, Math.floor(maxLength / 2)) + '...' + text.slice(- 3 - Math.floor(maxLength / 2));
}

export class RenderedResponse {
  readonly states: Partial<Record<'page' | 'tabs' | 'modal', string>> = {};
  readonly updates: { category: 'console' | 'downloads' | 'files', content: string }[] = [];
  readonly results: string[] = [];
  readonly code: string[] = [];

  constructor(copy?: { states: Partial<Record<'page' | 'tabs' | 'modal', string>>, updates: { category: 'console' | 'downloads' | 'files', content: string }[], results: string[], code: string[] }) {
    if (copy) {
      this.states = copy.states;
      this.updates = copy.updates;
      this.results = copy.results;
      this.code = copy.code;
    }
  }

  asText(filter?: { categories: string[] }): string {
    const text: string[] = [];
    if (this.results.length)
      text.push(`### Result\n${this.results.join('\n')}\n`);
    if (this.code.length)
      text.push(`### Ran Playwright code\n${this.code.join('\n')}\n`);

    for (const { category, content } of this.updates) {
      if (filter && !filter.categories.includes(category))
        continue;
      if (!content.trim())
        continue;

      switch (category) {
        case 'console':
          text.push(`### New console messages\n${content}\n`);
          break;
        case 'downloads':
          text.push(`### Downloads\n${content}\n`);
          break;
        case 'files':
          text.push(`### Files\n${content}\n`);
          break;
      }
    }

    for (const [category, value] of Object.entries(this.states)) {
      if (filter && !filter.categories.includes(category))
        continue;
      if (!value.trim())
        continue;

      switch (category) {
        case 'page':
          text.push(`### Page state\n${value}\n`);
          break;
        case 'tabs':
          text.push(`### Open tabs\n${value}\n`);
          break;
        case 'modal':
          text.push(`### Modal state\n${value}\n`);
          break;
      }
    }
    return text.join('\n');
  }

  asMeta() {
    const codeUpdate = this.code.length ? { category: 'code', content: this.code.join('\n') } : undefined;
    const resultUpdate = this.results.length ? { category: 'result', content: this.results.join('\n') } : undefined;
    const updates = [resultUpdate, codeUpdate, ...this.updates].filter(Boolean);
    return {
      'dev.lowire/history': updates,
      'dev.lowire/state': { ...this.states },
    };
  }

  redact(secrets: Record<string, string>): RenderedResponse {
    const redactText = (text: string) => {
      for (const [secretName, secretValue] of Object.entries(secrets))
        text = text.replaceAll(secretValue, `<secret>${secretName}</secret>`);
      return text;
    };

    const updates = this.updates.map(update => ({ ...update, content: redactText(update.content) }));
    const results = this.results.map(result => redactText(result));
    const code = this.code.map(code => redactText(code));
    const states = Object.fromEntries(Object.entries(this.states).map(([key, value]) => [key, redactText(value)]));
    return new RenderedResponse({ states, updates, results, code });
  }
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
  const files = sections.get('Files');
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
    files,
    isError,
    attachments,
    _meta: response._meta,
  };
}
