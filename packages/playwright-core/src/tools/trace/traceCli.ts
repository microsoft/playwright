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

import { traceOpen } from './traceOpen';
import { traceActions, traceAction } from './traceActions';
import { traceRequests, traceRequest } from './traceRequests';
import { traceConsole } from './traceConsole';
import { traceErrors } from './traceErrors';
import { traceSnapshot } from './traceSnapshot';
import { traceScreenshot } from './traceScreenshot';
import { traceAttachments, traceAttachment } from './traceAttachments';
import { installSkill } from './installSkill';

import type { Command } from '../../utilsBundle';

export function addTraceCommands(program: Command, logErrorAndExit: (e: Error) => void) {
  const traceCommand = program
      .command('trace')
      .description('inspect trace files from the command line');

  traceCommand
      .command('open <trace>')
      .description('extract trace file for inspection')
      .action((trace: string) => {
        traceOpen(trace).catch(logErrorAndExit);
      });

  traceCommand
      .command('actions')
      .description('list actions in the trace')
      .option('--grep <pattern>', 'filter actions by title pattern')
      .option('--errors-only', 'only show failed actions')
      .action((options: { grep?: string, errorsOnly?: boolean }) => {
        traceActions(options).catch(logErrorAndExit);
      });

  traceCommand
      .command('action <action-id>')
      .description('show details of a specific action')
      .action((actionId: string) => {
        traceAction(actionId).catch(logErrorAndExit);
      });

  traceCommand
      .command('requests')
      .description('show network requests')
      .option('--grep <pattern>', 'filter by URL pattern')
      .option('--method <method>', 'filter by HTTP method')
      .option('--status <code>', 'filter by status code')
      .option('--failed', 'only show failed requests (status >= 400)')
      .action((options: { grep?: string, method?: string, status?: string, failed?: boolean }) => {
        traceRequests(options).catch(logErrorAndExit);
      });

  traceCommand
      .command('request <request-id>')
      .description('show details of a specific network request')
      .action((requestId: string) => {
        traceRequest(requestId).catch(logErrorAndExit);
      });

  traceCommand
      .command('console')
      .description('show console messages')
      .option('--errors-only', 'only show errors')
      .option('--warnings', 'show errors and warnings')
      .option('--browser', 'only browser console messages')
      .option('--stdio', 'only stdout/stderr')
      .action((options: { errorsOnly?: boolean, warnings?: boolean, browser?: boolean, stdio?: boolean }) => {
        traceConsole(options).catch(logErrorAndExit);
      });

  traceCommand
      .command('errors')
      .description('show errors with stack traces')
      .action(() => {
        traceErrors().catch(logErrorAndExit);
      });

  traceCommand
      .command('snapshot <action-id>')
      .description('run a playwright-cli command against a DOM snapshot')
      .option('--name <name>', 'snapshot phase: before, input, or after')
      .option('--serve', 'serve snapshot on localhost and keep running')
      .allowUnknownOption(true)
      .allowExcessArguments(true)
      .action(async (actionId: string, options: { name?: string, serve?: boolean }, cmd: Command) => {
        try {
          // Collect everything after '--' as the browser command.
          const browserArgs = cmd.args.slice(1);
          await traceSnapshot(actionId, { ...options, browserArgs });
        } catch (e) {
          logErrorAndExit(e as Error);
        }
      });

  traceCommand
      .command('screenshot <action-id>')
      .description('save screencast screenshot for an action')
      .option('-o, --output <path>', 'output file path')
      .action((actionId: string, options: { output?: string }) => {
        traceScreenshot(actionId, options).catch(logErrorAndExit);
      });

  traceCommand
      .command('attachments')
      .description('list trace attachments')
      .action(() => {
        traceAttachments().catch(logErrorAndExit);
      });

  traceCommand
      .command('attachment <attachment-id>')
      .description('extract a trace attachment by its number')
      .option('-o, --output <path>', 'output file path')
      .action((attachmentId: string, options: { output?: string }) => {
        traceAttachment(attachmentId, options).catch(logErrorAndExit);
      });

  traceCommand
      .command('install-skill')
      .description('install SKILL.md for LLM integration')
      .action(() => {
        installSkill().catch(logErrorAndExit);
      });
}
