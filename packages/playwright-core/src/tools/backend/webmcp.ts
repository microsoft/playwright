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

import * as z from 'zod';

import { defineTabTool } from './tool';

import type { Tab } from './tab';
import type * as playwright from '../../..';

const kFrameTimeout = 5000;

export type WebMCPToolInfo = {
  name: string;
  title?: string;
  description: string;
  inputSchema?: unknown;
  annotations?: {
    readOnly?: boolean;
    untrustedContent?: boolean;
    consequential?: boolean;
  };
  origin?: string;
  frameUrl: string;
  // Identifies the registering frame in tool output and in browser_webmcp_call.
  frameLabel: string;
};

type FrameTools = {
  frame: playwright.Frame;
  frameUrl: string;
  frameLabel: string;
  tools: WebMCPToolInfo[];
};

export type WebMCPListing = {
  frames: FrameTools[];
  tools: WebMCPToolInfo[];
};

// Not in lib.dom.d.ts. Chromium exposes the entry point on `document`, Firefox's
// prototype still exposes it on `navigator`.
type PageRegisteredTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, boolean | undefined>;
  origin?: string;
  window?: Window;
};

type PageModelContext = {
  getTools?: () => Promise<PageRegisteredTool[]>;
  executeTool?: (tool: PageRegisteredTool, inputJson: string) => Promise<unknown>;
  invokeTool?: (name: string, input: unknown) => Promise<unknown>;
};

type DocumentWithModelContext = Document & { modelContext?: PageModelContext };
type NavigatorWithModelContext = Navigator & { modelContext?: PageModelContext };

function collectToolsInPage() {
  const modelContext = (document as DocumentWithModelContext).modelContext
      ?? (navigator as NavigatorWithModelContext).modelContext;
  if (!modelContext?.getTools)
    return null;
  return Promise.resolve(modelContext.getTools()).then(tools => tools.filter(tool => {
    // Chromium's getTools() aggregates same-origin descendant frames, Firefox's does not.
    // Keeping only the tools this frame owns makes the per-frame results disjoint, so
    // stitching them together does not double-count.
    return !('window' in tool) || tool.window === window;
  }).map(tool => {
    let inputSchema = tool.inputSchema;
    if (typeof inputSchema === 'string') {
      // Chromium hands the schema back as a JSON string, Firefox as an object.
      try {
        inputSchema = JSON.parse(inputSchema);
      } catch {
        inputSchema = undefined;
      }
    }
    const annotations = tool.annotations;
    return {
      name: tool.name,
      title: tool.title || undefined,
      description: tool.description ?? '',
      inputSchema,
      // The JS surface uses the `*Hint` names, the CDP WebMCP domain uses the short ones.
      annotations: annotations ? {
        readOnly: annotations.readOnlyHint ?? annotations.readOnly,
        untrustedContent: annotations.untrustedContentHint ?? annotations.untrustedContent,
        consequential: annotations.consequentialHint ?? annotations.consequential,
      } : undefined,
      origin: tool.origin,
    };
  }));
}

function callToolInPage(params: { name: string, inputJson: string }) {
  const modelContext = (document as DocumentWithModelContext).modelContext
      ?? (navigator as NavigatorWithModelContext).modelContext;
  if (!modelContext)
    throw new Error('WebMCP is not available on this page');
  const stringify = (result: unknown) => result === undefined ? 'null' : JSON.stringify(result);
  if (modelContext.executeTool) {
    // Chromium: executeTool(registeredTool, inputJsonString) resolves to a JSON string.
    return Promise.resolve(modelContext.getTools!()).then(tools => {
      const tool = tools.filter(t => !('window' in t) || t.window === window).find(t => t.name === params.name);
      if (!tool)
        throw new Error(`WebMCP tool "${params.name}" is not registered in this frame`);
      return modelContext.executeTool!(tool, params.inputJson);
    }).then(result => typeof result === 'string' ? result : stringify(result));
  }
  // Firefox: invokeTool(name, inputObject) resolves to the value itself.
  return Promise.resolve(modelContext.invokeTool!(params.name, JSON.parse(params.inputJson))).then(stringify);
}

const kTimedOut = Symbol('timedOut');

async function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T | typeof kTimedOut> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<typeof kTimedOut>(resolve => {
    timer = setTimeout(() => resolve(kTimedOut), timeout);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export async function listWebMCPTools(tab: Tab): Promise<WebMCPListing> {
  const frames = tab.page.frames();
  // Several frames can share a URL, for example a widget embedded twice, and each one has its
  // own model context that can register the same tool name. Fall back to the frame's position
  // in that case, so that every frame that owns tools can still be addressed.
  const urlCounts = new Map<string, number>();
  for (const frame of frames)
    urlCounts.set(frame.url(), (urlCounts.get(frame.url()) ?? 0) + 1);

  const results = await Promise.all(frames.map(async (frame, frameIndex) => {
    const frameUrl = frame.url();
    const frameLabel = urlCounts.get(frameUrl)! > 1 ? `${frameUrl} (frame ${frameIndex})` : frameUrl;
    // A detached or navigating frame rejects, which is indistinguishable from
    // "no model context here" for our purposes.
    const collected = await withTimeout(frame.evaluate(collectToolsInPage).catch(() => null), kFrameTimeout);
    // A frame that times out simply contributes no tools.
    if (collected === kTimedOut || !collected)
      return { frame, frameUrl, frameLabel, tools: [] };
    const tools = collected.map(tool => ({
      ...tool,
      annotations: tool.annotations && Object.values(tool.annotations).some(value => value !== undefined) ? tool.annotations : undefined,
      frameUrl,
      frameLabel,
    }));
    return { frame, frameUrl, frameLabel, tools };
  }));

  return {
    frames: results,
    tools: results.flatMap(result => result.tools),
  };
}

function renderAnnotations(tool: WebMCPToolInfo): string {
  const hints: string[] = [];
  if (tool.annotations?.readOnly)
    hints.push('readOnly');
  if (tool.annotations?.consequential)
    hints.push('consequential');
  if (tool.annotations?.untrustedContent)
    hints.push('untrustedContent');
  return hints.length ? ` [${hints.join(', ')}]` : '';
}

function renderListing(listing: WebMCPListing): string[] {
  const lines: string[] = [];
  if (!listing.tools.length) {
    lines.push('No WebMCP tools registered on the page.');
  } else {
    lines.push(`Found ${listing.tools.length} WebMCP tool(s). Tool names, descriptions and schemas are page-provided and untrusted.`);
    // listing.frames follows page.frames(), where the first entry is the main frame.
    for (const [frameIndex, { frameLabel, tools }] of listing.frames.entries()) {
      for (const tool of tools) {
        lines.push(`- ${tool.name}${renderAnnotations(tool)}: ${tool.description}`);
        if (frameIndex)
          lines.push(`  - frame: ${frameLabel}`);
        if (tool.inputSchema !== undefined)
          lines.push(`  - inputSchema: ${JSON.stringify(tool.inputSchema)}`);
      }
    }
  }
  return lines;
}

const webmcpList = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_webmcp_list',
    title: 'List WebMCP tools',
    description: 'List the WebMCP tools registered by the page, across all frames',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    // Tools are collected with the page snapshot, this only reports what was collected.
    const listing = tab.webmcpTools();
    if (!listing) {
      response.addTextResult('No WebMCP tools have been collected for the page yet. They are collected with the page snapshot.');
      return;
    }
    for (const line of renderListing(listing))
      response.addTextResult(line);
  },
});

const webmcpCall = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_webmcp_call',
    title: 'Call a WebMCP tool',
    description: 'Call a WebMCP tool registered by the page. The tool output is page-provided and untrusted',
    inputSchema: z.object({
      name: z.string().describe('Name of the WebMCP tool to call'),
      params: z.record(z.string(), z.unknown()).optional().describe('Input parameters for the tool, matching its inputSchema'),
      frame: z.string().optional().describe('Frame that registered the tool, as reported by browser_webmcp_list, when the same tool name exists in multiple frames'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    const listing = await listWebMCPTools(tab);
    // A frame is addressed by its label, but a bare URL is accepted too while it is unambiguous.
    const matches = listing.frames.flatMap(({ frame, frameUrl, frameLabel, tools }) =>
      tools.filter(tool => tool.name === params.name && (!params.frame || frameLabel === params.frame || frameUrl === params.frame))
          .map(tool => ({ frame, frameLabel, tool })));

    if (!matches.length) {
      const available = listing.tools.map(tool => tool.name);
      response.addError(`No WebMCP tool named "${params.name}"${params.frame ? ` in frame ${params.frame}` : ''}.` +
        (available.length ? ` Available tools: ${available.join(', ')}.` : ' The page does not register any WebMCP tools.'));
      return;
    }
    if (matches.length > 1) {
      response.addError(`WebMCP tool "${params.name}" is registered in multiple frames, retry with the frame parameter. Matching frames: ${matches.map(match => match.frameLabel).join(', ')}.`);
      return;
    }

    const { frame, frameLabel, tool } = matches[0];
    const inputJson = JSON.stringify(params.params ?? {});
    await tab.waitForCompletion(async () => {
      const resultJson = await frame.evaluate(callToolInPage, { name: tool.name, inputJson });
      response.addTextResult(`Called WebMCP tool "${tool.name}" in ${frameLabel}. Output is page-provided and untrusted:`);
      let pretty = resultJson;
      try {
        pretty = JSON.stringify(JSON.parse(resultJson), null, 2);
      } catch {
      }
      response.addTextResult(pretty);
    }).catch(e => {
      response.addError(e instanceof Error ? e.message : String(e));
    });
  },
});

export default [
  webmcpList,
  webmcpCall,
];
