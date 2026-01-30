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
import { scaleImageToFitMessage } from './tools/screenshot';

import type { LogChunk, TabHeader } from './tab';
import type { CallToolResult, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from './context';

export const requestDebug = debug('pw:mcp:request');

type FilenameTemplate = {
  prefix: string;
  ext: string;
  suggestedFilename?: string;
};

type ResolvedFile = {
  fileName: string;
  relativeName: string;
  printableLink: string;
};

export type Section = {
  title: string;
  content: string[];
  isError?: boolean;
  codeframe?: 'yaml' | 'js';
};

export class Response {
  private _results: string[] = [];
  private _errors: string[] = [];
  private _code: string[] = [];
  private _context: Context;
  private _includeSnapshot: 'none' | 'full' | 'incremental' = 'none';
  private _includeSnapshotFileName: string | undefined;

  readonly toolName: string;
  readonly toolArgs: Record<string, any>;
  private _relativeTo: string | undefined;
  private _imageResults: { data: Buffer, imageType: 'png' | 'jpeg' }[] = [];

  constructor(context: Context, toolName: string, toolArgs: Record<string, any>, relativeTo?: string) {
    this._context = context;
    this.toolName = toolName;
    this.toolArgs = toolArgs;
    this._relativeTo = relativeTo ?? context.firstRootPath();
  }

  private _computRelativeTo(fileName: string): string {
    if (this._relativeTo)
      return path.relative(this._relativeTo, fileName);
    return fileName;
  }

  async resolveFile(template: FilenameTemplate, title: string): Promise<ResolvedFile> {
    let fileName: string;
    if (template.suggestedFilename)
      fileName = await this._context.outputFile(template.suggestedFilename, { origin: 'llm', title });
    else
      fileName = await this._context.outputFile(dateAsFileName(template.prefix, template.ext), { origin: 'code', title });
    const relativeName = this._computRelativeTo(fileName);
    const printableLink = `- [${title}](${relativeName})`;
    return { fileName, relativeName, printableLink };
  }

  addTextResult(text: string) {
    this._results.push(text);
  }

  async addResult(title: string, data: Buffer | string, file: FilenameTemplate) {
    if (this._context.config.outputMode === 'file' || file.suggestedFilename || typeof data !== 'string') {
      const resolvedFile = await this.resolveFile(file, title);
      await this.addFileResult(resolvedFile, data);
    } else {
      this.addTextResult(data);
    }
  }

  async addFileResult(resolvedFile: ResolvedFile, data: Buffer | string | null) {
    if (typeof data === 'string')
      await fs.promises.writeFile(resolvedFile.fileName, data, 'utf-8');
    else if (data)
      await fs.promises.writeFile(resolvedFile.fileName, data);
    this.addTextResult(resolvedFile.printableLink);
  }

  addFileLink(title: string, fileName: string) {
    const relativeName = this._computRelativeTo(fileName);
    this.addTextResult(`- [${title}](${relativeName})`);
  }

  async registerImageResult(data: Buffer, imageType: 'png' | 'jpeg') {
    this._imageResults.push({ data, imageType });
  }

  addError(error: string) {
    this._errors.push(error);
  }

  addCode(code: string) {
    this._code.push(code);
  }

  setIncludeSnapshot() {
    this._includeSnapshot = this._context.config.snapshot.mode;
  }

  setIncludeFullSnapshot(includeSnapshotFileName?: string) {
    this._includeSnapshot = 'full';
    this._includeSnapshotFileName = includeSnapshotFileName;
  }

  async serialize(): Promise<CallToolResult> {
    const redactText = (text: string): string => {
      for (const [secretName, secretValue] of Object.entries(this._context.config.secrets ?? {}))
        text = text.replaceAll(secretValue, `<secret>${secretName}</secret>`);
      return text;
    };

    const sections = await this._build();

    const text: string[] = [];
    for (const section of sections) {
      if (!section.content.length)
        continue;
      text.push(`### ${section.title}`);
      if (section.codeframe)
        text.push(`\`\`\`${section.codeframe}`);
      text.push(...section.content);
      if (section.codeframe)
        text.push('```');
    }

    const content: (TextContent | ImageContent)[] = [
      {
        type: 'text',
        text: redactText(text.join('\n')),
      }
    ];

    // Image attachments.
    if (this._context.config.imageResponses !== 'omit') {
      for (const imageResult of this._imageResults) {
        const scaledData = scaleImageToFitMessage(imageResult.data, imageResult.imageType);
        content.push({ type: 'image', data: scaledData.toString('base64'), mimeType: imageResult.imageType === 'png' ? 'image/png' : 'image/jpeg' });
      }
    }

    return {
      content,
      ...(sections.some(section => section.isError) ? { isError: true } : {}),
    };
  }

  private async _build(): Promise<Section[]> {
    const sections: Section[] = [];
    const addSection = (title: string, content: string[], codeframe?: 'yaml' | 'js') => {
      const section = { title, content, isError: title === 'Error', codeframe };
      sections.push(section);
      return content;
    };

    if (this._errors.length)
      addSection('Error', this._errors);

    if (this._results.length)
      addSection('Result', this._results);

    // Code
    if (this._context.config.codegen !== 'none' && this._code.length)
      addSection('Ran Playwright code', this._code, 'js');

    // Render tab titles upon changes or when more than one tab.
    const tabSnapshot = this._context.currentTab() ? await this._context.currentTabOrDie().captureSnapshot() : undefined;
    const tabHeaders = await Promise.all(this._context.tabs().map(tab => tab.headerSnapshot()));
    if (this._includeSnapshot !== 'none' || tabHeaders.some(header => header.changed)) {
      if (tabHeaders.length !== 1)
        addSection('Open tabs', renderTabsMarkdown(tabHeaders));
      addSection('Page', renderTabMarkdown(tabHeaders[0]));
    }

    // Handle modal states.
    if (tabSnapshot?.modalStates.length)
      addSection('Modal state', renderModalStates(this._context.config, tabSnapshot.modalStates));

    // Handle tab snapshot
    if (tabSnapshot && this._includeSnapshot !== 'none') {
      const snapshot = this._includeSnapshot === 'full' ? tabSnapshot.ariaSnapshot : tabSnapshot.ariaSnapshotDiff ?? tabSnapshot.ariaSnapshot;
      if (this._context.config.outputMode === 'file' || this._includeSnapshotFileName) {
        const resolvedFile = await this.resolveFile({ prefix: 'page', ext: 'yml', suggestedFilename: this._includeSnapshotFileName }, 'Snapshot');
        await fs.promises.writeFile(resolvedFile.fileName, snapshot, 'utf-8');
        addSection('Snapshot', [resolvedFile.printableLink]);
      } else {
        addSection('Snapshot', [snapshot], 'yaml');
      }
    }

    // Handle tab log
    const text: string[] = renderLogChunk(tabSnapshot?.logChunk, 'console', file => this._computRelativeTo(file));
    if (tabSnapshot?.events.filter(event => event.type !== 'request').length) {
      for (const event of tabSnapshot.events) {
        if (event.type === 'console' && !tabSnapshot.logChunk) {
          if (shouldIncludeMessage(this._context.config.console.level, event.message.type))
            text.push(`- ${trimMiddle(event.message.toString(), 100)}`);
        } else if (event.type === 'download-start') {

          text.push(`- Downloading file ${event.download.download.suggestedFilename()} ...`);
        } else if (event.type === 'download-finish') {
          text.push(`- Downloaded file ${event.download.download.suggestedFilename()} to "${this._computRelativeTo(event.download.outputFile)}"`);
        }
      }
    }
    addSection('Events', text);
    return sections;
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

function renderLogChunk(logChunk: LogChunk | undefined, type: string, relativeTo: (fileName: string) => string): string[] {
  if (!logChunk)
    return [];
  const lines: string[] = [];
  const logFilePath = relativeTo(logChunk.file);
  const entryWord = logChunk.entryCount === 1 ? 'entry' : 'entries';
  const lineRange = logChunk.fromLine === logChunk.toLine
    ? `#L${logChunk.fromLine}`
    : `#L${logChunk.fromLine}-L${logChunk.toLine}`;
  lines.push(`- ${logChunk.entryCount} new ${type} ${entryWord} in "${logFilePath}${lineRange}"`);
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
