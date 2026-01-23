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

import type { TabHeader } from './tab';
import type { CallToolResult, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from './context';

export const requestDebug = debug('pw:mcp:request');

type Result = {
  text?: string;
  data?: Buffer;
  isBase64?: boolean;
  title: string;
  file?:  {
    prefix: string;
    ext: string;
    suggestedFilename?: string;
    contentType?: string;
  };
};

export type Section = {
  title: string;
  content: Result[];
  isError?: boolean;
};

export class Response {
  private _results: Result[] = [];
  private _errors: string[] = [];
  private _code: string[] = [];
  private _context: Context;
  private _includeSnapshot: 'none' | 'full' | 'incremental' = 'none';
  private _includeSnapshotFileName: string | undefined;

  readonly toolName: string;
  readonly toolArgs: Record<string, any>;

  private constructor(ordinal: number, context: Context, toolName: string, toolArgs: Record<string, any>) {
    this._context = context;
    this.toolName = toolName;
    this.toolArgs = toolArgs;
  }

  static _ordinal = 0;

  static create(context: Context, toolName: string, toolArgs: Record<string, any>) {
    return new Response(++Response._ordinal, context, toolName, toolArgs);
  }

  addTextResult(text: string) {
    this._results.push({ title: '', text });
  }

  async addResult(title: string, data: string | Buffer, file: Result['file']) {
    this._results.push({
      text: typeof data === 'string' ? data : undefined,
      data: typeof data === 'string' ? undefined : data,
      title,
      file
    });
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

  async build(): Promise<Section[]> {
    const rootPath = this._context.firstRootPath();
    const sections: Section[] = [];
    const addSection = (title: string) => {
      const section = { title, content: [] as Result[], isError: title === 'Error' };
      sections.push(section);
      return section.content;
    };

    if (this._errors.length) {
      const content = addSection('Error');
      content.push({ text: this._errors.join('\n'), title: 'error' });
    }

    if (this._results.length) {
      const content = addSection('Result');
      content.push(...this._results);
    }


    // Code
    if (this._context.config.codegen !== 'none' && this._code.length) {
      const content = addSection('Ran Playwright code');
      for (const code of this._code)
        content.push({ text: code, title: 'code' });
    }

    // Render tab titles upon changes or when more than one tab.
    const tabSnapshot = this._context.currentTab() ? await this._context.currentTabOrDie().captureSnapshot() : undefined;
    const tabHeaders = await Promise.all(this._context.tabs().map(tab => tab.headerSnapshot()));
    if (this._includeSnapshot !== 'none' || tabHeaders.some(header => header.changed)) {
      if (tabHeaders.length !== 1) {
        const content = addSection('Open tabs');
        content.push({ text: renderTabsMarkdown(tabHeaders).join('\n'), title: 'Open tabs' });
      }

      const content = addSection('Page');
      content.push({ text: renderTabMarkdown(tabHeaders[0]).join('\n'), title: 'Page' });
    }

    // Handle modal states.
    if (tabSnapshot?.modalStates.length) {
      const content = addSection('Modal state');
      content.push({ text: renderModalStates(this._context.config, tabSnapshot.modalStates).join('\n'), title: 'Modal state' });
    }

    // Handle tab snapshot
    if (tabSnapshot && this._includeSnapshot !== 'none') {
      const content = addSection('Snapshot');
      const snapshot = this._includeSnapshot === 'full' ? tabSnapshot.ariaSnapshot : tabSnapshot.ariaSnapshotDiff ?? tabSnapshot.ariaSnapshot;
      content.push({ text: snapshot, title: 'snapshot', file: { prefix: 'page', ext: 'yml', suggestedFilename: this._includeSnapshotFileName } });
    }

    // Handle tab log
    if (tabSnapshot?.events.filter(event => event.type !== 'request').length) {
      const content = addSection('Events');
      const text: string[] = [];
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
      content.push({ text: text.join('\n'), title: 'events' });
    }
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

export async function serializeResponse(context: Context, sections: Section[], rootPath?: string): Promise<CallToolResult> {
  const redactText = (text: string): string => {
    for (const [secretName, secretValue] of Object.entries(context.config.secrets ?? {}))
      text = text.replaceAll(secretValue, `<secret>${secretName}</secret>`);
    return text;
  };

  const text: string[] = [];
  for (const section of sections) {
    text.push(`### ${section.title}`);
    for (const result of section.content) {
      if (!result.file) {
        if (result.text !== undefined)
          text.push(result.text);
        continue;
      }

      if (result.file.suggestedFilename || context.config.outputMode === 'file' || result.data) {
        const generatedFileName = await context.outputFile(dateAsFileName(result.file.prefix, result.file.ext), { origin: 'code', title: section.title });
        const fileName = result.file.suggestedFilename ? await context.outputFile(result.file.suggestedFilename, { origin: 'llm', title: section.title }) : generatedFileName;
        text.push(`- [${result.title}](${rootPath ? path.relative(rootPath, fileName) : fileName})`);
        if (result.data)
          await fs.promises.writeFile(fileName, result.data, 'utf-8');
        else
          await fs.promises.writeFile(fileName, result.text!);
      } else {
        if (result.file.ext === 'yml')
          text.push(`\`\`\`yaml\n${result.text!}\n\`\`\``);
        else
          text.push(result.text!);
      }
    }
  }
  const content: (TextContent | ImageContent)[] = [
    {
      type: 'text',
      text: redactText(text.join('\n')),
    }
  ];

  // Image attachments.
  if (context.config.imageResponses !== 'omit') {
    for (const result of sections.flatMap(section => section.content).filter(result => result.file?.contentType)) {
      const scaledData = scaleImageToFitMessage(result.data as Buffer, result.file!.contentType === 'image/png' ? 'png' : 'jpeg');
      content.push({ type: 'image', data: scaledData.toString('base64'), mimeType: result.file!.contentType! });
    }
  }

  return {
    content,
    ...(sections.some(section => section.isError) ? { isError: true } : {}),
  };
}

export async function serializeStructuredResponse(sections: Section[]): Promise<CallToolResult> {
  for (const section of sections) {
    for (const result of section.content) {
      if (!result.data)
        continue;
      result.isBase64 = true;
      result.text = result.data.toString('base64');
      result.data = undefined;
    }
  }
  return {
    content: [{ type: 'text' as const, text: '', _meta: { sections } }],
    isError: sections.some(section => section.isError),
  };
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
