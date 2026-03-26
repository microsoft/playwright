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

import { debug } from '../../utilsBundle';
import { renderModalStates } from './tab';
import { scaleImageToFitMessage } from './screenshot';

import type { TabHeader } from './tab';
import type { CallToolResult, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { Context, FilenameTemplate } from './context';

export const requestDebug = debug('pw:mcp:request');

type ResolvedFile = {
  fileName: string;
  relativeName: string;
  printableLink: string;
};

type Section = {
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
  private _includeSnapshot: 'none' | 'full' | 'explicit' = 'none';
  private _includeSnapshotFileName: string | undefined;
  private _includeSnapshotSelector: string | undefined;
  private _includeSnapshotDepth: number | undefined;
  private _isClose: boolean = false;

  readonly toolName: string;
  readonly toolArgs: Record<string, any>;
  private _clientWorkspace: string;
  private _imageResults: { data: Buffer, imageType: 'png' | 'jpeg' }[] = [];

  constructor(context: Context, toolName: string, toolArgs: Record<string, any>, relativeTo?: string) {
    this._context = context;
    this.toolName = toolName;
    this.toolArgs = toolArgs;
    this._clientWorkspace = relativeTo ?? context.options.cwd;
  }

  private _computRelativeTo(fileName: string): string {
    return path.relative(this._clientWorkspace, fileName);
  }

  async resolveClientFile(template: FilenameTemplate, title: string): Promise<ResolvedFile> {
    let fileName: string;
    if (template.suggestedFilename)
      fileName = await this.resolveClientFilename(template.suggestedFilename);
    else
      fileName = await this._context.outputFile(template, { origin: 'llm' });
    const relativeName = this._computRelativeTo(fileName);
    const printableLink = `- [${title}](${relativeName})`;
    return { fileName, relativeName, printableLink };
  }

  async resolveClientFilename(filename: string): Promise<string> {
    return await this._context.workspaceFile(filename, this._clientWorkspace);
  }

  addTextResult(text: string) {
    this._results.push(text);
  }

  async addResult(title: string, data: Buffer | string, file: FilenameTemplate) {
    if (file.suggestedFilename || typeof data !== 'string') {
      const resolvedFile = await this.resolveClientFile(file, title);
      await this.addFileResult(resolvedFile, data);
    } else {
      this.addTextResult(data);
    }
  }

  private async _writeFile(resolvedFile: ResolvedFile, data: Buffer | string | null) {
    if (typeof data === 'string')
      await fs.promises.writeFile(resolvedFile.fileName, this._redactSecrets(data), 'utf-8');
    else if (data)
      await fs.promises.writeFile(resolvedFile.fileName, data);
  }

  async addFileResult(resolvedFile: ResolvedFile, data: Buffer | string | null) {
    await this._writeFile(resolvedFile, data);
    this.addTextResult(resolvedFile.printableLink);
  }

  addFileLink(title: string, fileName: string) {
    const relativeName = this._computRelativeTo(fileName);
    this.addTextResult(`- [${title}](${relativeName})`);
  }

  async registerImageResult(data: Buffer, imageType: 'png' | 'jpeg') {
    this._imageResults.push({ data, imageType });
  }

  setClose() {
    this._isClose = true;
  }

  addError(error: string) {
    this._errors.push(error);
  }

  addCode(code: string) {
    this._code.push(code);
  }

  setIncludeSnapshot() {
    this._includeSnapshot = this._context.config.snapshot?.mode ?? 'full';
  }

  setIncludeFullSnapshot(includeSnapshotFileName?: string, selector?: string, depth?: number) {
    this._includeSnapshot = 'explicit';
    this._includeSnapshotFileName = includeSnapshotFileName;
    this._includeSnapshotDepth = depth;
    this._includeSnapshotSelector = selector;
  }

  private _redactSecrets(text: string): string {
    for (const [secretName, secretValue] of Object.entries(this._context.config.secrets ?? {}))
      text = text.replaceAll(secretValue, `<secret>${secretName}</secret>`);
    return text;
  }


  async serialize(): Promise<CallToolResult> {
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
        text: sanitizeUnicode(this._redactSecrets(text.join('\n'))),
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
      ...(this._isClose ? { isClose: true } : {}),
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
    const tabSnapshot = this._context.currentTab() ? await this._context.currentTabOrDie().captureSnapshot(this._includeSnapshotSelector, this._includeSnapshotDepth, this._clientWorkspace) : undefined;
    const tabHeaders = await Promise.all(this._context.tabs().map(tab => tab.headerSnapshot()));
    if (this._includeSnapshot !== 'none' || tabHeaders.some(header => header.changed)) {
      if (tabHeaders.length !== 1)
        addSection('Open tabs', renderTabsMarkdown(tabHeaders));
      addSection('Page', renderTabMarkdown(tabHeaders.find(h => h.current) ?? tabHeaders[0]));
    }
    if (this._context.tabs().length === 0)
      this._isClose = true;

    // Handle modal states.
    if (tabSnapshot?.modalStates.length)
      addSection('Modal state', renderModalStates(this._context.config, tabSnapshot.modalStates));

    // Handle tab snapshot
    if (tabSnapshot && this._includeSnapshot !== 'none') {
      if (this._includeSnapshot !== 'explicit' || this._includeSnapshotFileName) {
        const suggestedFilename = this._includeSnapshotFileName === '<auto>' ? undefined : this._includeSnapshotFileName;
        const resolvedFile = await this.resolveClientFile({ prefix: 'page', ext: 'yml', suggestedFilename }, 'Snapshot');
        await this._writeFile(resolvedFile, tabSnapshot.ariaSnapshot);
        addSection('Snapshot', [resolvedFile.printableLink]);
      } else {
        addSection('Snapshot', [tabSnapshot.ariaSnapshot], 'yaml');
      }
    }

    // Handle tab log
    const text: string[] = [];
    if (tabSnapshot?.consoleLink)
      text.push(`- New console entries: ${tabSnapshot.consoleLink}`);
    if (tabSnapshot?.events.filter(event => event.type !== 'request').length) {
      for (const event of tabSnapshot.events) {
        if (event.type === 'download-start')
          text.push(`- Downloading file ${event.download.download.suggestedFilename()} ...`);
        else if (event.type === 'download-finish')
          text.push(`- Downloaded file ${event.download.download.suggestedFilename()} to "${this._computRelativeTo(event.download.outputFile)}"`);
      }
    }
    if (text.length)
      addSection('Events', text);

    const pausedDetails = this._context.debugger().pausedDetails();
    if (pausedDetails) {
      addSection('Paused', [
        `- ${pausedDetails.title} at ${this._computRelativeTo(pausedDetails.location.file)}${pausedDetails.location.line ? ':' + pausedDetails.location.line : ''}`,
        '- Use any tools to explore and interact, resume by calling resume/step-over/pause-at',
      ]);
    }
    return sections;
  }
}

export function renderTabMarkdown(tab: TabHeader): string[] {
  const lines = [`- Page URL: ${tab.url}`];
  if (tab.title)
    lines.push(`- Page Title: ${tab.title}`);
  if (tab.console.errors || tab.console.warnings)
    lines.push(`- Console: ${tab.console.errors} errors, ${tab.console.warnings} warnings`);
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

/**
 * Sanitizes a string to ensure it only contains well-formed Unicode.
 * Replaces lone surrogates with U+FFFD using String.prototype.toWellFormed().
 */
function sanitizeUnicode(text: string): string {
  return text.toWellFormed?.() ?? text;
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

export function parseResponse(response: CallToolResult, cwd?: string) {
  if (response.content?.[0].type !== 'text')
    return undefined;
  const text = response.content[0].text;

  const sections = parseSections(text);
  const error = sections.get('Error');
  const result = sections.get('Result');
  const code = sections.get('Ran Playwright code');
  const tabs = sections.get('Open tabs');
  const page = sections.get('Page');
  const snapshotSection = sections.get('Snapshot');
  const events = sections.get('Events');
  const modalState = sections.get('Modal state');
  const paused = sections.get('Paused');
  const codeNoFrame = code?.replace(/^```js\n/, '').replace(/\n```$/, '');
  const isError = response.isError;
  const attachments = response.content.length > 1 ? response.content.slice(1) : undefined;

  let snapshot: string | undefined;
  let inlineSnapshot: string | undefined;
  if (snapshotSection) {
    const match = snapshotSection.match(/\[Snapshot\]\(([^)]+)\)/);
    if (match) {
      if (cwd) {
        try {
          snapshot = fs.readFileSync(path.resolve(cwd, match[1]), 'utf-8');
        } catch {
        }
      }
    } else {
      inlineSnapshot = snapshotSection.replace(/^```yaml\n?/, '').replace(/\n?```$/, '');
    }
  }

  return {
    result,
    error,
    code: codeNoFrame,
    tabs,
    page,
    snapshot,
    inlineSnapshot,
    events,
    modalState,
    paused,
    isError,
    attachments,
    text,
  };
}
