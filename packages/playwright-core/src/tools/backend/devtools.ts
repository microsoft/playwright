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

import { spawn } from 'child_process';

import * as z from 'zod';

import { libPath } from '../../package';
import { annotateInContext } from '../dashboard/dashboardApp';
import { defineTabTool, defineTool } from './tool';
import { elementSchema, optionalElementSchema } from './snapshot';

import type { AnnotationData } from '@dashboard/dashboardChannel';

const resume = defineTool({
  capability: 'devtools',

  schema: {
    name: 'browser_resume',
    title: 'Resume paused script execution',
    description: 'Resume script execution after it was paused. When called with step set to true, execution will pause again before the next action.',
    inputSchema: z.object({
      step: z.boolean().optional().describe('When true, execution will pause again before the next action, allowing step-by-step debugging.'),
      location: z.string().optional().describe('Pause execution at a specific <file>:<line>, e.g. "example.spec.ts:42".'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const pausedPromise = new Promise<void>(resolve => {
      const listener = () => {
        if (browserContext.debugger.pausedDetails()) {
          browserContext.debugger.off('pausedstatechanged', listener);
          resolve();
        }
      };
      browserContext.debugger.on('pausedstatechanged', listener);
    });

    if (params.location) {
      const [file, lineStr] = params.location.split(':');
      let location;
      if (lineStr) {
        const line = Number(lineStr);
        if (isNaN(line))
          throw new Error(`Invalid location "${params.location}", expected format is <file>:<line>, e.g. "example.spec.ts:42"`);
        location = { file, line };
      } else {
        location = { file: params.location };
      }
      await browserContext.debugger.runTo(location);
    } else if (params.step) {
      await browserContext.debugger.next();
    } else {
      await browserContext.debugger.resume();
    }
    await pausedPromise;
  },
});

const highlight = defineTabTool({
  capability: 'devtools',
  schema: {
    name: 'browser_highlight',
    title: 'Highlight element',
    description: 'Show a persistent highlight overlay around the element on the page.',
    inputSchema: elementSchema.extend({
      style: z.string().optional().describe('Additional inline CSS applied to the highlight overlay, e.g. "outline: 2px dashed red".'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    const { locator } = await tab.targetLocator(params);
    await locator.highlight({ style: params.style });
    response.addTextResult(`Highlighted ${locator}`);
  },
});

const hideHighlight = defineTabTool({
  capability: 'devtools',
  schema: {
    name: 'browser_hide_highlight',
    title: 'Hide element highlight',
    description: 'Remove a highlight overlay previously added for the element.',
    inputSchema: optionalElementSchema.extend({
      element: z.string().optional().describe('Human-readable element description used when adding the highlight; must match the value passed to browser_highlight.'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    if (params.target) {
      const { locator } = await tab.targetLocator({ target: params.target, element: params.element });
      await locator.hideHighlight();
      response.addTextResult(`Hid highlight for ${locator}`);
    } else {
      await tab.page.hideHighlight();
      response.addTextResult(`Hid page highlight`);
    }
  },
});

const annotate = defineTabTool({
  capability: 'devtools',
  schema: {
    name: 'browser_annotate',
    title: 'Annotate the current page',
    description: 'Open the Playwright Dashboard in annotation mode for the current page and wait for the user to draw annotations. Returns the annotated screenshot, ARIA snapshot, and the list of annotations.',
    inputSchema: z.object({
      modal: z.boolean().optional().describe('Open a dedicated dashboard window for this annotation (modal), instead of reusing the singleton dashboard daemon. Experimental — used to A/B-compare the two implementations.'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response, signal) => {
    const result = params.modal
      ? await runModalAnnotate(tab, signal)
      : await runDaemonAnnotate(tab, signal);
    if (result === 'cancelled') {
      response.addTextResult('Annotation cancelled.');
      return;
    }
    if ('error' in result) {
      response.addError(result.error);
      return;
    }
    if (!result.annotations.length && !result.png && !result.ariaSnapshot) {
      response.addTextResult('No annotations were submitted.');
      return;
    }
    for (const a of result.annotations)
      response.addTextResult(`{ x: ${a.x}, y: ${a.y}, width: ${a.width}, height: ${a.height} }: ${a.text}`);
    const date = new Date();
    if (result.png)
      await response.addResult('Annotation image', Buffer.from(result.png, 'base64'), { prefix: 'annotations', ext: 'png', date });
    if (result.ariaSnapshot)
      await response.addResult('Annotation snapshot', Buffer.from(result.ariaSnapshot, 'utf8'), { prefix: 'annotations', ext: 'yaml', date });
  },
});

type AnnotateResult =
  | { png?: string; ariaSnapshot?: string; annotations: AnnotationData[] }
  | { error: string }
  | 'cancelled';

async function runDaemonAnnotate(tab: import('./tab').Tab, signal: AbortSignal | undefined): Promise<AnnotateResult> {
  // eslint-disable-next-line no-restricted-syntax -- _guid is the cross-process page identifier shared with the dashboard daemon.
  const pageId = (tab.page as any)._guid as string;
  const daemonScript = libPath('entry', 'dashboardApp.js');
  const daemonArgs = [daemonScript, `--pageId=${pageId}`];

  const daemon = spawn(process.execPath, daemonArgs, { detached: true, stdio: 'ignore' });
  daemon.unref();

  const client = spawn(process.execPath, [...daemonArgs, '--annotate', '--json'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const onAbort = () => client.kill();
  signal?.addEventListener('abort', onAbort);
  const stdoutChunks: Buffer[] = [];
  client.stdout!.on('data', chunk => stdoutChunks.push(chunk));
  const exitCode = await new Promise<number | null>(resolve => client.on('exit', code => resolve(code)));
  signal?.removeEventListener('abort', onAbort);
  if (signal?.aborted)
    return 'cancelled';
  if (exitCode !== 0)
    return { error: `Annotation client exited with code ${exitCode}` };
  const text = Buffer.concat(stdoutChunks).toString('utf8').trim();
  if (!text)
    return { annotations: [] };
  return JSON.parse(text) as AnnotateResult;
}

async function runModalAnnotate(tab: import('./tab').Tab, signal: AbortSignal | undefined): Promise<AnnotateResult> {
  const payload = await annotateInContext(tab.page.context(), tab.page, signal);
  if (signal?.aborted)
    return 'cancelled';
  if (!payload)
    return { annotations: [] };
  return { png: payload.png, ariaSnapshot: payload.ariaSnapshot, annotations: payload.annotations };
}

export default [resume, highlight, hideHighlight, annotate];
