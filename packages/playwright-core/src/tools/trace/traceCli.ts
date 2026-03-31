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

import type { Command } from '../../utilsBundle';

export function addTraceCommands(program: Command, logErrorAndExit: (e: Error) => void) {
  const traceCommand = program
      .command('trace')
      .description('inspect trace files from the command line');

  traceCommand
      .command('open <trace>')
      .description('extract trace file for inspection')
      .action(async (trace: string) => {
        const { traceOpen } = await import('./traceOpen');
        traceOpen(trace).catch(logErrorAndExit);
      });

  traceCommand
      .command('close')
      .description('remove extracted trace data')
      .action(async () => {
        const { closeTrace } = await import('./traceUtils');
        closeTrace().catch(logErrorAndExit);
      });

  traceCommand
      .command('actions')
      .description('list actions in the trace')
      .option('--grep <pattern>', 'filter actions by title pattern')
      .option('--errors-only', 'only show failed actions')
      .action(async (options: { grep?: string, errorsOnly?: boolean }) => {
        const { traceActions } = await import('./traceActions');
        traceActions(options).catch(logErrorAndExit);
      });

  traceCommand
      .command('action <action-id>')
      .description('show details of a specific action')
      .action(async (actionId: string) => {
        const { traceAction } = await import('./traceActions');
        traceAction(actionId).catch(logErrorAndExit);
      });

  traceCommand
      .command('requests')
      .description('show network requests')
      .option('--grep <pattern>', 'filter by URL pattern')
      .option('--method <method>', 'filter by HTTP method')
      .option('--status <code>', 'filter by status code')
      .option('--failed', 'only show failed requests (status >= 400)')
      .action(async (options: { grep?: string, method?: string, status?: string, failed?: boolean }) => {
        const { traceRequests } = await import('./traceRequests');
        traceRequests(options).catch(logErrorAndExit);
      });

  traceCommand
      .command('request <request-id>')
      .description('show details of a specific network request')
      .action(async (requestId: string) => {
        const { traceRequest } = await import('./traceRequests');
        traceRequest(requestId).catch(logErrorAndExit);
      });

  traceCommand
      .command('console')
      .description('show console messages')
      .option('--errors-only', 'only show errors')
      .option('--warnings', 'show errors and warnings')
      .option('--browser', 'only browser console messages')
      .option('--stdio', 'only stdout/stderr')
      .action(async (options: { errorsOnly?: boolean, warnings?: boolean, browser?: boolean, stdio?: boolean }) => {
        const { traceConsole } = await import('./traceConsole');
        traceConsole(options).catch(logErrorAndExit);
      });

  traceCommand
      .command('errors')
      .description('show errors with stack traces')
      .action(async () => {
        const { traceErrors } = await import('./traceErrors');
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
          const { traceSnapshot } = await import('./traceSnapshot');
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
      .action(async (actionId: string, options: { output?: string }) => {
        const { traceScreenshot } = await import('./traceScreenshot');
        traceScreenshot(actionId, options).catch(logErrorAndExit);
      });

  traceCommand
      .command('attachments')
      .description('list trace attachments')
      .action(async () => {
        const { traceAttachments } = await import('./traceAttachments');
        traceAttachments().catch(logErrorAndExit);
      });

  traceCommand
      .command('attachment <attachment-id>')
      .description('extract a trace attachment by its number')
      .option('-o, --output <path>', 'output file path')
      .action(async (attachmentId: string, options: { output?: string }) => {
        const { traceAttachment } = await import('./traceAttachments');
        traceAttachment(attachmentId, options).catch(logErrorAndExit);
      });
}
