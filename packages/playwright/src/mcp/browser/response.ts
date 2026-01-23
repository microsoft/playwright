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
import { renderModalStates, shouldIncludeMessage } from './tab';
import { dateAsFileName } from './tools/utils';

import type { TabHeader } from './tab';
import type { CallToolResult, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from './context';

export const requestDebug = debug('pw:mcp:request');

type Result = {
  data: Buffer | string;
  title: string;
  filename?: string;
};

export class Response {
  private _ordinal: number;
  private _results: Result[] = [];
  private _errors: string[] = [];
  private _code: string[] = [];
  private _images: { contentType: string, data: Buffer }[] = [];
  private _context: Context;
  private _includeSnapshot: 'none' | 'full' | 'incremental' = 'none';
  private _includeSnapshotFileName: string | undefined;

  readonly toolName: string;
  readonly toolArgs: Record<string, any>;

  private constructor(ordinal: number, context: Context, toolName: string, toolArgs: Record<string, any>) {
    this._ordinal = ordinal;
    this._context = context;
    this.toolName = toolName;
    this.toolArgs = toolArgs;
  }

  static _ordinal = 0;

  static create(context: Context, toolName: string, toolArgs: Record<string, any>) {
    return new Response(++Response._ordinal, context, toolName, toolArgs);
  }

  addTextResult(result: string) {
    this._results.push({ title: '', data: result });
  }

  async addResult(title: string, data: string | Buffer, file: { prefix: string, ext: string, suggestedFilename?: string }) {
    let filename: string | undefined;
    if (!file.suggestedFilename) {
      // Binary always goes into a file.
      if (typeof data !== 'string')
        filename = dateAsFileName(file.prefix, file.ext);
      // What can go into a file goes into a file in outputMode === file.
      if (this._context.config.outputMode === 'file')
        filename = dateAsFileName(file.prefix, file.ext);
    } else {
      filename = await this._context.outputFile(file.suggestedFilename, { origin: 'llm', title });
    }
    this._results.push({ data, title, filename });
  }

  addError(error: string) {
    this._errors.push(error);
  }

  addCode(code: string) {
    this._code.push(code);
  }

  addImage(image: { contentType: string, data: Buffer }) {
    this._images.push(image);
  }

  setIncludeSnapshot() {
    this._includeSnapshot = this._context.config.snapshot.mode;
  }

  setIncludeFullSnapshot(includeSnapshotFileName?: string) {
    this._includeSnapshot = 'full';
    this._includeSnapshotFileName = includeSnapshotFileName;
  }

  async build(): Promise<{ content: (TextContent | ImageContent)[], isError?: boolean }> {
    const rootPath = this._context.firstRootPath();
    const sections: { title: string, content: string[] }[] = [];
    const addSection = (title: string): string[] => {
      const section = { title, content: [] as string[] };
      sections.push(section);
      return section.content;
    };

    if (this._errors.length) {
      const text = addSection('Error');
      text.push('### Error');
      text.push(this._errors.join('\n'));
    }

    // Results
    if (this._results.length) {
      const text = addSection('Result');
      for (const result of this._results) {
        if (result.filename) {
          text.push(`- [${result.title}](${rootPath ? path.relative(rootPath, result.filename) : result.filename})`);
          if (typeof result.data === 'string')
            await fs.promises.writeFile(result.filename, this._redactText(result.data), 'utf-8');
          else
            await fs.promises.writeFile(result.filename, result.data);
        } else if (typeof result.data === 'string' && result.data.trim()) {
          text.push(result.data);
        }
      }
    }

    // Code
    if (this._context.config.codegen !== 'none' && this._code.length) {
      const text = addSection('Ran Playwright code');
      text.push(...this._code);
    }

    // Render tab titles upon changes or when more than one tab.
    const tabSnapshot = this._context.currentTab() ? await this._context.currentTabOrDie().captureSnapshot() : undefined;
    const tabHeaders = await Promise.all(this._context.tabs().map(tab => tab.headerSnapshot()));
    if (tabHeaders.some(header => header.changed)) {
      if (tabHeaders.length !== 1) {
        const text = addSection('Open tabs');
        text.push(...renderTabsMarkdown(tabHeaders));
      }

      const text = addSection('Page');
      text.push(...renderTabMarkdown(tabHeaders[0]));
    }

    // Handle modal states.
    if (tabSnapshot?.modalStates.length) {
      const text = addSection('Modal state');
      text.push(...renderModalStates(this._context.config, tabSnapshot.modalStates));
    }

    // Handle tab snapshot
    if (tabSnapshot && this._includeSnapshot === 'full') {
      let fileName: string | undefined;
      if (this._includeSnapshotFileName)
        fileName = await this._context.outputFile(this._includeSnapshotFileName, { origin: 'llm', title: 'Saved snapshot' });
      else if (this._context.config.outputMode === 'file')
        fileName = await this._context.outputFile(dateAsFileName('snapshot', 'yml'), { origin: 'code', title: 'Saved snapshot' });
      if (fileName) {
        await fs.promises.writeFile(fileName, tabSnapshot.ariaSnapshot, 'utf-8');
        const text = addSection('Snapshot');
        text.push(`- File: ${rootPath ? path.relative(rootPath, fileName) : fileName}`);
      } else {
        const text = addSection('Snapshot');
        text.push('```yaml');
        text.push(tabSnapshot.ariaSnapshot);
        text.push('```');
      }
    }

    if (tabSnapshot && this._includeSnapshot === 'incremental') {
      const text = addSection('Snapshot');
      text.push('```yaml');
      if (tabSnapshot.ariaSnapshotDiff !== undefined)
        text.push(tabSnapshot.ariaSnapshotDiff);
      else
        text.push(tabSnapshot.ariaSnapshot);
      text.push('```');
    }

    // Handle tab log
    if (tabSnapshot?.events.filter(event => event.type !== 'request').length) {
      const text = addSection('Events');
      for (const event of tabSnapshot.events) {
        if (event.type === 'console') {
          if (shouldIncludeMessage(this._context.config.console.level, event.message.type))
            text.push(`- ${trimMiddle(event.message.toString(), 100)}`);
        } else if (event.type === 'download-start') {
          text.push(`- Downloading file ${event.download.download.suggestedFilename()} ...`);
        } else if (event.type === 'download-finish') {
          text.push(`- Downloaded file ${event.download.download.suggestedFilename()} to "${rootPath ? path.relative(rootPath, event.download.outputFile) : event.download.outputFile}"`);
        }
      }
    }

    const allText = sections.flatMap(section => {
      const content: string[] = [];
      content.push(`### ${section.title}`);
      content.push(...section.content);
      content.push('');
      return content;
    }).join('\n');

    const content: (TextContent | ImageContent)[] = [
      {
        type: 'text',
        text: this._redactText(allText)
      },
    ];

    // Image attachments.
    if (this._context.config.imageResponses !== 'omit') {
      for (const image of this._images)
        content.push({ type: 'image', data: image.data.toString('base64'), mimeType: image.contentType });
    }

    return {
      content,
      ...this._errors.length > 0 ? { isError: true } : {},
    };
  }

  private _redactText(text: string): string {
    for (const [secretName, secretValue] of Object.entries(this._context.config.secrets ?? {}))
      text = text.replaceAll(secretValue, `<secret>${secretName}</secret>`);
    return text;
  }
}

export function renderTabMarkdown(tab: TabHeader): string[] {
  const lines = [`- Page URL: ${tab.url}`];
  if (tab.title)
    lines.push(`- Page Title: ${tab.title}`);
  return lines;
}

export function renderTabsMarkdown(tabs: TabHeader[]): string[] {
  if (!tabs.length)
    return ['No open tabs. Navigate to a URL to create one.'];

  const lines: string[] = [];
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const current = tab.current ? ' (current)' : '';
    lines.push(`- ${i}:${current} [${tab.title}](${tab.url})`);
  }
  return lines;
}

function trimMiddle(text: string, maxLength: number) {
  if (text.length <= maxLength)
    return text;
  return text.slice(0, Math.floor(maxLength / 2)) + '...' + text.slice(- 3 - Math.floor(maxLength / 2));
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
  const error = sections.get('Error');
  const result = sections.get('Result');
  const code = sections.get('Ran Playwright code');
  const tabs = sections.get('Open tabs');
  const page = sections.get('Page');
  const snapshot = sections.get('Snapshot');
  const events = sections.get('Events');
  const modalState = sections.get('Modal state');
  const codeNoFrame = code?.replace(/^```js\n/, '').replace(/\n```$/, '');
  const isError = response.isError;
  const attachments = response.content.length > 1 ? response.content.slice(1) : undefined;

  return {
    result,
    error,
    code: codeNoFrame,
    tabs,
    page,
    snapshot,
    events,
    modalState,
    isError,
    attachments,
    text,
  };
}
