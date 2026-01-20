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

import fs from 'fs';
import path from 'path';

import { debug } from 'playwright-core/lib/utilsBundle';
import { renderModalStates } from './tab';

import type { Tab, TabSnapshot } from './tab';
import type { CallToolResult, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from './context';
import type { ModalState } from './tools/tool';

export const requestDebug = debug('pw:mcp:request');

type PartCategory = 'result' | 'code' | 'modal' | 'tabs' | 'page' | 'console' | 'downloads' | 'files' | 'network';
type OutputPart = {
  category: PartCategory;
  title?: string;
  content: string;
};
type OutputConfig = Record<PartCategory, { mode: 'file' | 'text', fileName?: string }>;

export class Response {
  private _ordinal: number;
  private _result: string[] = [];
  private _code: string[] = [];
  private _images: { contentType: string, data: Buffer }[] = [];
  private _savedFiles: { fileName: string, title: string }[] = [];
  private _context: Context;
  private _includeSnapshot: 'none' | 'full' | 'incremental' = 'none';
  private _includeTabs = false;
  private _includeModalStates: ModalState[] | undefined;
  private _tabSnapshot: TabSnapshot | undefined;
  readonly outputConfig: OutputConfig;

  readonly toolName: string;
  readonly toolArgs: Record<string, any>;
  private _isError: boolean | undefined;

  private constructor(ordinal: number, context: Context, toolName: string, toolArgs: Record<string, any>) {
    this._ordinal = ordinal;
    this._context = context;
    this.outputConfig = Object.fromEntries(allCategories.map(({ category }) => [category, { mode: context.config.outputMode ?? 'stdout' }])) as OutputConfig;
    this.toolName = toolName;
    this.toolArgs = toolArgs;
  }

  static _ordinal = 0;

  static create(context: Context, toolName: string, toolArgs: Record<string, any>) {
    return new Response(++Response._ordinal, context, toolName, toolArgs);
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

  async addFile(fileName: string, options: { origin: 'code' | 'llm' | 'web', title: string }) {
    const resolvedFile = await this._context.outputFile(fileName, options);
    this._savedFiles.push({ fileName: resolvedFile, title: options.title });
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

  private _renderParts(): OutputPart[] {
    const parts: OutputPart[] = [];
    if (this._result.length)
      parts.push({ category: 'result', content: this._result.join('\n') });

    // Add code if it exists.
    if (this._code.length && this._context.config.codegen !== 'none')
      parts.push({ category: 'code', content: this._code.join('\n') });

    // List browser tabs.
    if (this._includeSnapshot !== 'none' || this._includeTabs) {
      const tabsMarkdown = renderTabsMarkdown(this._context.tabs(), this._includeTabs);
      if (tabsMarkdown.length)
        parts.push({ category: 'tabs', content: tabsMarkdown.join('\n') });
    }

    // Add snapshot if provided.
    if (this._tabSnapshot?.modalStates.length) {
      const modalStatesMarkdown = renderModalStates(this._tabSnapshot.modalStates);
      parts.push({ category: 'modal', content: modalStatesMarkdown.join('\n') });
    } else if (this._includeModalStates) {
      const modalStatesMarkdown = renderModalStates(this._includeModalStates);
      parts.push({ category: 'modal', content: modalStatesMarkdown.join('\n') });
    } else if (this._tabSnapshot) {
      renderTabSnapshot(this._tabSnapshot, this._includeSnapshot, parts);
    }

    // Saved files
    if (this._savedFiles.length) {
      const root = this._context.firstRootPath();
      const lines: string[] = [];
      for (const file of this._savedFiles) {
        lines.push(`- [${file.title}](${root ? path.relative(root, file.fileName) : file.fileName})`);
      }
      parts.push({ category: 'files', content: lines.join('\n') });
    }
    return parts;
  }

  private _redactParts(parts: OutputPart[]): OutputPart[] {
    const redactText = (text: string) => {
      for (const [secretName, secretValue] of Object.entries(this._context.config.secrets ?? {}))
        text = text.replaceAll(secretValue, `<secret>${secretName}</secret>`);
      return text;
    };
    return this._context.config.secrets ? parts.map(part => ({ ...part, content: redactText(part.content) })) : parts;
  }

  async serialize(): Promise<{ content: (TextContent | ImageContent)[], isError?: boolean }> {
    const parts = this._redactParts(this._renderParts());

    const text: string[] = [];
    const rootPath = this._context.firstRootPath();

    for (const { category, title, ext } of allCategories) {
      const part = parts.find(p => p.category === category);
      if (!part || !part.content.trim())
        continue;

      if (this.outputConfig[category as PartCategory]?.mode === 'file' && ext) {
        let fileName = this.outputConfig[category as PartCategory]?.fileName;
        if (!fileName) {
          const baseName = `${category}-${this._ordinal}${ext}`;
          fileName = await this._context.outputFile(baseName, { origin: 'code', title: 'Saving response' });
        }
        await fs.promises.writeFile(fileName, part.content);
        const relativeName = rootPath ? path.relative(rootPath, fileName) : fileName;
        text.push(`☑️  Saving \`${part.title ?? title}\` as "${relativeName}"`);
      } else {
        text.push(`### ${part.title ?? title}\n${part.content}\n`);
      }
    }

    const content: (TextContent | ImageContent)[] = [
      {
        type: 'text',
        text: text.join('\n')
      },
    ];

    // Image attachments.
    if (this._context.config.imageResponses !== 'omit') {
      for (const image of this._images)
        content.push({ type: 'image', data: image.data.toString('base64'), mimeType: image.contentType });
    }

    return {
      content,
      isError: this._isError
    };
  }
}

function renderTabSnapshot(tabSnapshot: TabSnapshot, includeSnapshot: 'none' | 'full' | 'incremental', parts: OutputPart[]) {
  if (tabSnapshot.consoleMessages.length) {
    const lines: string[] = [];
    for (const message of tabSnapshot.consoleMessages)
      lines.push(`- ${trimMiddle(message.toString(), 100)}`);
    parts.push({ category: 'console', content: lines.join('\n') });
  }

  if (tabSnapshot.downloads.length) {
    const lines: string[] = [];
    for (const entry of tabSnapshot.downloads) {
      if (entry.finished)
        lines.push(`- Downloaded file ${entry.download.suggestedFilename()} to ${entry.outputFile}`);
      else
        lines.push(`- Downloading file ${entry.download.suggestedFilename()} ...`);
    }
    parts.push({ category: 'downloads', content: lines.join('\n') });
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
  parts.push({ category: 'page', content: lines.join('\n') });
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

// Entries with ext are never saved to files.
const allCategories: { category: PartCategory, title: string, ext?: string }[] = [
  { category: 'result', title: 'Result' },
  { category: 'code', title: 'Ran Playwright code' },
  { category: 'modal', title: 'Modal state' },
  { category: 'tabs', title: 'Open tabs' },
  { category: 'page', title: 'Page state', ext: '.md' },
  { category: 'console', title: 'New console messages', ext: '.log' },
  { category: 'downloads', title: 'Downloads', ext: '.log' },
  { category: 'network', title: 'Network', ext: '.log' },
  { category: 'files', title: 'Files', ext: '' },
];

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
  };
}
