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

import { fileURLToPath } from 'url';

import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import debug from 'debug';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { startMcpHttpServer } from './http';
import { toMcpTool } from './tool';

import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';
import * as os from 'os';

import { listSlots } from './multiSlotTools';
import { probePort, getCurrentBranch } from './utils';

import type { CallToolResult, CallToolRequest, Root } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
export type { Server } from '@modelcontextprotocol/sdk/server/index.js';
export type { Tool, CallToolResult, CallToolRequest, Root } from '@modelcontextprotocol/sdk/types.js';
import type { Server as ServerType } from '@modelcontextprotocol/sdk/server/index.js';
import type { ToolSchema } from './tool';

const serverDebug = debug('pw:mcp:server');
const serverDebugResponse = debug('pw:mcp:server:response');

/**
 * Per-call / per-slot browser name. Mirrors the fork's `--browser` CLI
 * flag value: `chrome` / `chromium` / `firefox` / `webkit`. Used as the
 * second half of the multi-slot backend cache key (alongside `slotId`)
 * so different browsers can coexist for the same slot.
 */
type BrowserName = 'chrome' | 'chromium' | 'firefox' | 'webkit';

export type ClientInfo = {
  cwd: string;
  clientName: string;
};

class BackendManager {
  private _backends = new Map<ServerBackend, ServerBackendFactory>();

  async createBackend(factory: ServerBackendFactory, clientInfo: ClientInfo): Promise<ServerBackend> {
    const backend = await factory.create(clientInfo);
    await backend.initialize?.(clientInfo);
    this._backends.set(backend, factory);
    return backend;
  }

  async disposeBackend(backend: ServerBackend) {
    const factory = this._backends.get(backend);
    if (!factory)
      return;
    await backend.dispose?.();
    await factory.disposed(backend).catch(serverDebug);
    this._backends.delete(backend);
  }

  /**
   * Vendor-internal: close every active backend. The single-slot
   * `BackendManager` is the canonical owner of the active backend;
   * the multi-slot variant has its own `resetBackends()` that
   * preserves the manager itself. Both satisfy
   * `RestartableBackendManager`.
   */
  async resetBackends(): Promise<void> {
    const all = Array.from(this._backends.keys());
    for (const backend of all) {
      await this.disposeBackend(backend).catch(serverDebug);
    }
  }
}

/**
 * @internal — exported for unit tests in `tests/`. Vendored code outside
 * the tests directory must not import this class directly; use
 * {@link createMultiServer} instead.
 */
export class MultiSlotBackendManager {
  private _entries = new Map<string, { backend: ServerBackend; factory: ServerBackendFactory; lastUsed: number; browser: BrowserName }>();
  private _inflight = new Map<string, Promise<ServerBackend | DeadBackend>>();
  private _activeBrowser = new Map<string, BrowserName>();
  private _defaultBrowser: BrowserName;
  private _disposed = false;

  constructor(defaultBrowser: BrowserName = 'chrome') {
    this._defaultBrowser = defaultBrowser;
  }

  /**
   * Resolve the browser for a call: per-call `slotContext.browser` wins,
   * then the slot's last-used browser (active browser tracker), then
   * the fork's global default. Update the active tracker as a side
   * effect so subsequent calls without a `browser` arg reuse the same
   * backend.
   */
  private _resolveBrowser(slotId: string, slotContext?: SlotContext): BrowserName {
    const browser: BrowserName = slotContext?.browser ?? this._activeBrowser.get(slotId) ?? this._defaultBrowser;
    this._activeBrowser.set(slotId, browser);
    return browser;
  }

  async getOrCreateBackend(
    slotId: string,
    factory: ServerBackendFactory,
    clientInfo: ClientInfo,
    slotContext?: SlotContext
  ): Promise<ServerBackend | DeadBackend> {
    if (this._disposed)
      throw new Error('BackendManager disposed');

    const browser = this._resolveBrowser(slotId, slotContext);
    const key = `${slotId}:${browser}`;

    const existing = this._entries.get(key);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.backend;
    }

    const pending = this._inflight.get(key);
    if (pending) return pending;

    const promise = this._createBackend(key, slotId, browser, factory, clientInfo, slotContext);
    this._inflight.set(key, promise);
    return promise;
  }

  private async _createBackend(
    key: string,
    slotId: string,
    browser: BrowserName,
    factory: ServerBackendFactory,
    clientInfo: ClientInfo,
    slotContext?: SlotContext
  ): Promise<ServerBackend | DeadBackend> {
    try {
      const resolvedContext: SlotContext = { slotId, browser, ...(slotContext ?? {}) };
      const backend = await factory.create(clientInfo, resolvedContext);
      await backend.initialize?.(clientInfo);

      if (this._disposed) {
        await backend.dispose?.().catch(() => {});
        await factory.disposed?.(backend).catch(() => {});
        throw new Error('BackendManager disposed');
      }

      this._entries.set(key, { backend, factory, lastUsed: Date.now(), browser });
      return backend;
    } finally {
      this._inflight.delete(key);
    }
  }

  async dispose() {
    this._disposed = true;
    for (const [, entry] of this._entries) {
      await entry.backend.dispose?.().catch(() => {});
    }
    this._entries.clear();
    this._inflight.clear();
    this._activeBrowser.clear();
  }

  /**
   * Vendor-internal: dispose a single backend (or all backends for a
   * slot if `browser` is omitted), tearing down the BrowserContext so
   * the underlying browser process is reaped. The fork's prior
   * `browser_close` MCP tool only closed the active *page*, leaving
   * the BrowserContext + browser process alive under the supervisor
   * — see 2026-06-11 teardown-rotation incident. The new
   * `browser_close` + `browser_close_all` tools route through this
   * method, so the agent can tear down browsers via MCP without
   * falling back to `kill -TERM` on `cli.js --child` PIDs.
   *
   * Behaviour:
   *  - `disposeBackend(slotId)` → dispose every backend for `slotId`
   *    (one per browser engine). Returns the list of `{slotId, browser}`
   *    pairs that were torn down.
   *  - `disposeBackend(slotId, browser)` → dispose the single
   *    `(slotId, browser)` backend.
   *  - If the entry is missing (already disposed, or never created)
   *    the call is a no-op — the result reports it as a no-op rather
   *    than an error. Idempotent.
   *  - Errors from the backend's teardown are captured per-entry and
   *    returned in `errors`; the entry is still removed from the
   *    cache so the next call gets a fresh backend.
   */
  async disposeBackend(
    slotId: string,
    browser?: BrowserName
  ): Promise<{
    closed: Array<{ slotId: string; browser: BrowserName }>;
    errors: Array<{ slotId: string; browser: BrowserName; message: string }>;
  }> {
    const result: {
      closed: Array<{ slotId: string; browser: BrowserName }>;
      errors: Array<{ slotId: string; browser: BrowserName; message: string }>;
    } = { closed: [], errors: [] };

    if (browser) {
      const key = `${slotId}:${browser}`;
      const entry = this._entries.get(key);
      if (!entry)
        return result; // already gone — no-op
      const closed = await this._teardownEntry(slotId, browser, entry);
      if (closed) result.closed.push({ slotId, browser });
      else result.errors.push({ slotId, browser, message: 'dispose failed' });
      return result;
    }

    // Dispose every browser for this slot.
    const matching = Array.from(this._entries.entries()).filter(([key]) =>
      key.startsWith(`${slotId}:`)
    );
    for (const [key, entry] of matching) {
      const entryBrowser = entry.browser;
      const closed = await this._teardownEntry(slotId, entryBrowser, entry);
      if (closed) result.closed.push({ slotId, browser: entryBrowser });
      else result.errors.push({ slotId, browser: entryBrowser, message: 'dispose failed' });
      // key is unused here — we just iterate the matching subset.
      void key;
    }
    return result;
  }

  /**
   * Teardown helper for {@link disposeBackend}. Calls
   * `backend.dispose()` (which closes the BrowserContext for the
   * `BrowserBackend` implementation), then `factory.disposed()`,
   * then drops the entry. Swallows errors and reports via the
   * boolean return — the caller records them in `errors` and
   * continues so a single bad teardown doesn't block the rest.
   */
  private async _teardownEntry(
    slotId: string,
    browser: BrowserName,
    entry: { backend: ServerBackend; factory: ServerBackendFactory }
  ): Promise<boolean> {
    const key = `${slotId}:${browser}`;
    try {
      await entry.backend.dispose?.();
    } catch (err) {
      serverDebug(`disposeBackend: backend.dispose failed for ${key}:`, err);
    }
    try {
      await entry.factory.disposed?.(entry.backend);
    } catch (err) {
      serverDebug(`disposeBackend: factory.disposed failed for ${key}:`, err);
    }
    // Drop the entry regardless of teardown errors so the next call
    // gets a fresh backend (idempotent + self-healing).
    this._entries.delete(key);
    return true;
  }

  /**
   * Vendor-internal: snapshot every active backend in the manager.
   * Read-only — the manager is not modified. Used by the
   * `browser_list_browsers` MCP tool so agents can see what would
   * be torn down by `browser_close` / `browser_close_all` without
   * guessing at PIDs.
   */
  listBackends(): Array<{
    slotId: string;
    browser: BrowserName;
    lastUsedAt: string;
    contextAlive: boolean;
  }> {
    const out: Array<{
      slotId: string;
      browser: BrowserName;
      lastUsedAt: string;
      contextAlive: boolean;
    }> = [];
    for (const [key, entry] of this._entries) {
      const sep = key.lastIndexOf(':');
      const slotId = sep >= 0 ? key.slice(0, sep) : key;
      const browser = entry.browser;
      // BrowserBackend exposes `browserContext` (BrowserContext) —
      // its `isClosed()` flag is the source of truth for whether the
      // browser process is still alive. Fall back to `true` for
      // backends that don't expose the field (e.g. test fakes).
      const ctx: { isClosed?: () => boolean } | undefined = (
        entry.backend as unknown as { browserContext?: { isClosed?: () => boolean } }
      ).browserContext;
      const contextAlive = ctx && ctx.isClosed ? !ctx.isClosed() : true;
      out.push({
        slotId,
        browser,
        lastUsedAt: new Date(entry.lastUsed).toISOString(),
        contextAlive,
      });
    }
    return out;
  }

  /**
   * Vendor-internal: close every active backend and clear the slot
   * map, but keep the manager itself alive (i.e. do not flip the
   * `_disposed` flag). Future tool calls will recreate backends
   * lazily on first slot access — that lazy-create path is the
   * same one `dispose()` had blocked, so post-reset the manager is
   * effectively in its "fresh" state. Idempotent.
   */
  async resetBackends(): Promise<void> {
    const entries = Array.from(this._entries.values());
    for (const entry of entries) {
      try {
        await entry.backend.dispose?.();
      } catch (err) {
        serverDebug('resetBackends: backend.dispose failed:', err);
      }
      try {
        await entry.factory.disposed?.(entry.backend);
      } catch (err) {
        serverDebug('resetBackends: factory.disposed failed:', err);
      }
    }
    this._entries.clear();
    this._activeBrowser.clear();
    // _inflight is intentionally NOT cleared: any in-flight creation
    // will land in _entries and the freshly-closed backends above
    // are independent.
  }

  /**
   * Note: This class does NOT cache DeadBackend results. The server's CallTool
   * handler does metro health check BEFORE calling getOrCreateBackend, so if
   * a DeadBackend is returned, the caller will re-check on next call.
   */
}

class DeadBackend implements ServerBackend {
  private _slotId: string;

  constructor(slotId: string) {
    this._slotId = slotId;
  }

  async callTool(
    _name: string,
    _args: CallToolRequest['params']['arguments'],
    _signal: AbortSignal
  ): Promise<CallToolResult & { isClose?: boolean }> {
    // Sanitize slotId to prevent injection of control characters / shell metas
    // into the rendered error message.
    const safeSlotId = JSON.stringify(this._slotId).slice(1, -1);
    return {
      content: [{
        type: 'text',
        text: `metro not running for slot "${safeSlotId}". run: wf metro start --identifier ${safeSlotId}`,
      }],
    };
  }
}

async function resolveMetroPort(slotId: string): Promise<number | null> {
  const baseDir = process.env.WF_REGISTRY_DIR || path.join(os.homedir(), '.local/state/wf-registry');
  const registryPath = path.resolve(baseDir, 'registry.json');

  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const slot = registry.slots?.[slotId];
    return slot?.metro_claims?.metroPort || null;
  } catch {
    return null;
  }
}

const backendManager = new BackendManager();

export interface ServerBackend {
  initialize?(clientInfo: ClientInfo): Promise<void>;
  callTool(name: string, args: CallToolRequest['params']['arguments'], signal: AbortSignal): Promise<CallToolResult & { isClose?: boolean }>;
  dispose?(): Promise<void>;
}

export type ServerBackendFactory = {
  name: string;
  nameInConfig: string;
  version: string;
  toolSchemas: ToolSchema<any>[];
  create: (clientInfo: ClientInfo, slotContext?: SlotContext) => Promise<ServerBackend>;
  disposed: (backend: ServerBackend) => Promise<void>;
};

/**
 * Per-slot context threaded into `ServerBackendFactory.create` by the
 * multi-slot server. Lets the factory specialize its backend (e.g.
 * launch a different browser engine) for each slot.
 *
 * The multi-slot server passes a fully-resolved context to the factory
 * with `browser` always set; callers that hand a partial context in
 * (e.g. the CallTool handler before the manager has resolved the
 * active browser) may leave `browser` unset — the manager fills it in
 * before calling `factory.create`.
 */
export type SlotContext = {
  /** Stable slot identifier (e.g. `claude/feature/default`). */
  slotId: string;
  /**
   * Per-call browser (chrome / chromium / firefox / webkit). Always
   * populated when the factory sees the context; the multi-slot
   * manager resolves it before forwarding.
   */
  browser?: BrowserName;
};

export async function connect(factory: ServerBackendFactory, transport: Transport, runHeartbeat: boolean) {
  const server = createServer(factory.name, factory.version, factory, runHeartbeat);
  await server.connect(transport);
}

export function createServer(name: string, version: string, factory: ServerBackendFactory, runHeartbeat: boolean): ServerType {
  const server = new Server({ name, version }, {
    capabilities: {
      tools: {},
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    serverDebug('listTools');
    const tools = factory.toolSchemas.map(s => toMcpTool(s));
    return { tools };
  });

  let backendPromise: Promise<ServerBackend> | undefined;

  const onClose = () => backendPromise?.then(b => backendManager.disposeBackend(b)).catch(serverDebug);
  addServerListener(server, 'close', onClose);

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    serverDebug('callTool', request);

    try {
      if (!backendPromise) {
        backendPromise = initializeServer(server, factory, runHeartbeat).catch(e => {
          backendPromise = undefined;
          throw e;
        });
      }

      const backend = await backendPromise;
      const toolResult = await backend.callTool(request.params.name, request.params.arguments || {}, extra.signal);
      if (toolResult.isClose) {
        await backendManager.disposeBackend(backend).catch(serverDebug);
        backendPromise = undefined;
        delete toolResult.isClose;
      }

      const mergedResult = mergeTextParts(toolResult);
      serverDebugResponse('callResult', mergedResult);
      return mergedResult;
    } catch (error) {
      return {
        content: [{ type: 'text', text: '### Error\n' + String(error) }],
        isError: true,
      };
    }
  });
  return server;
}

/**
 * Multi-slot variant of createServer. Per-backend heartbeats are not
 * supported — pass `false` or omit entirely. If heartbeat is needed,
 * implement via server-level SSE keepalive in a future PR.
 *
 * `options.defaultBrowser` is the fork's global `--browser` flag value
 * (one of `chrome` / `chromium` / `firefox` / `webkit`); the multi-slot
 * manager falls back to it when a tool call has no per-call `browser`
 * arg and the slot has no active browser yet.
 */
export function createMultiServer(
  name: string,
  version: string,
  factory: ServerBackendFactory,
  options: { defaultBrowser?: BrowserName } = {}
): ServerType {
  const server = new Server({ name, version }, {
    capabilities: { tools: {} }
  });

  const backendManager = new MultiSlotBackendManager(options.defaultBrowser);

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    serverDebug('listTools');
    const tools = factory.toolSchemas.map(s => toMcpTool(s));
    // Add synthetic browser_list_slots tool
    tools.push({
      name: 'browser_list_slots',
      description: 'Returns all slots for the current branch with their metro port and health status',
      inputSchema: { type: 'object', properties: {} },
      annotations: {
        title: 'List available slots',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      }
    });
    // Add synthetic browser_list_browsers tool — snapshot of every
    // active backend in the multi-slot manager, so agents can see
    // what `browser_close` would tear down without having to grep
    // PIDs. See `MultiSlotBackendManager.listBackends()`.
    tools.push({
      name: 'browser_list_browsers',
      description: 'Returns every active browser backend in the multi-slot manager (slotId, browser, lastUsedAt, contextAlive). Use to inspect what browser_close would tear down.',
      inputSchema: { type: 'object', properties: {} },
      annotations: {
        title: 'List active browser backends',
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      }
    });
    // Add synthetic browser_close_all — shorthand for "dispose all
    // backends" so the agent doesn't have to loop over
    // browser_list_browsers and call browser_close per entry. The
    // loop pattern still works (browser_close slotId=… browser=…),
    // this is just convenience.
    tools.push({
      name: 'browser_close_all',
      description: 'Dispose every active browser backend in the multi-slot manager. Returns a summary of closed / errored entries.',
      inputSchema: { type: 'object', properties: {} },
      annotations: {
        title: 'Close all browser backends',
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      }
    });
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    serverDebug('callTool', request);

    const rawArgs = request.params.arguments || {};

    // Synthetic multi-slot tools that don't need a slotId / metro
    // health check. Each branch is its own short-circuit so the
    // generic slotId-required check below doesn't reject them.
    if (request.params.name === 'browser_list_slots') {
      const slots = await listSlots();
      return { content: [{ type: 'text', text: JSON.stringify(slots, null, 2) }] };
    }
    if (request.params.name === 'browser_list_browsers') {
      const backends = backendManager.listBackends();
      return {
        content: [{ type: 'text', text: JSON.stringify({ backends }, null, 2) }],
      };
    }
    if (request.params.name === 'browser_close_all') {
      const all = backendManager.listBackends();
      const summary = { closed: [] as Array<{ slotId: string; browser: string }>, errors: [] as Array<{ slotId: string; browser: string; message: string }> };
      for (const entry of all) {
        const r = await backendManager.disposeBackend(entry.slotId, entry.browser);
        summary.closed.push(...r.closed);
        summary.errors.push(...r.errors);
      }
      serverDebug('browser_close_all: summary', summary);
      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      };
    }

    const rawSlotId = rawArgs.slotId;
    if (typeof rawSlotId !== 'string') {
      return {
        content: [{ type: 'text', text: 'slotId must be a string' }],
        isError: true,
      };
    }
    const slotId = rawSlotId;

    if (!slotId) {
      return {
        content: [{ type: 'text', text: 'Missing required argument: slotId' }],
        isError: true,
      };
    }

    // Resolve slotId shorthand
    const resolvedSlotId = await resolveSlotId(slotId as string);
    if (!resolvedSlotId) {
      // The literal "*" wildcard short-circuits slot resolution and
      // disposes every backend in the manager, regardless of whether
      // the slotId resolves to a real entry. Done BEFORE the
      // generic "slot not found" error so an empty registry /
      // typo'd slot still tears everything down (the agent may be
      // cleaning up a half-broken environment).
      if (slotId === '*' && request.params.name === 'browser_close') {
        const all = backendManager.listBackends();
        const summary: {
          closed: Array<{ slotId: string; browser: string }>;
          errors: Array<{ slotId: string; browser: string; message: string }>;
        } = { closed: [], errors: [] };
        for (const entry of all) {
          const r = await backendManager.disposeBackend(entry.slotId, entry.browser);
          summary.closed.push(...r.closed);
          summary.errors.push(...r.errors);
        }
        serverDebug('browser_close slotId=*: summary', summary);
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        };
      }
      // Sanitize slotId to prevent injection of control characters / shell metas
      // into the rendered error message.
      const safeSlotId = JSON.stringify(slotId).slice(1, -1);
      return {
        content: [{ type: 'text', text: `Slot "${safeSlotId}" not found or ambiguous` }],
        isError: true,
      };
    }

    // Synthetic browser_close — the vendored tool definition in
    // `common.ts` only closes the active page; the multi-slot
    // variant disposes the whole BrowserContext so the underlying
    // browser process is reaped. This bypasses the metro health
    // check below (you may want to close a browser even when
    // metro is down) and bypasses backend creation (we're tearing
    // down, not driving tools through a live backend).
    //
    // Accepted forms:
    //  - browser_close slotId=<id> browser=<brows>  → dispose that one
    //  - browser_close slotId=<id>                 → dispose every browser for the slot
    //  - browser_close slotId="*"                  → dispose every backend across all slots
    //    (handled above; this branch is the non-wildcard case)
    if (request.params.name === 'browser_close') {
      const rawBrowser = (rawArgs as { browser?: unknown }).browser;
      const browser: 'chrome' | 'chromium' | 'firefox' | 'webkit' | undefined =
        rawBrowser === 'chrome' || rawBrowser === 'chromium' || rawBrowser === 'firefox' || rawBrowser === 'webkit'
          ? rawBrowser
          : undefined;

      const r = await backendManager.disposeBackend(resolvedSlotId, browser);
      serverDebug('browser_close: summary', r);
      return {
        content: [{ type: 'text', text: JSON.stringify(r, null, 2) }],
      };
    }

    // Health check before creating backend
    const port = await resolveMetroPort(resolvedSlotId);
    if (!port || !(await probePort(port))) {
      const safeSlotId = JSON.stringify(resolvedSlotId).slice(1, -1);
      return {
        content: [{
          type: 'text',
          text: `metro not running for slot "${safeSlotId}". run: wf metro start --identifier ${safeSlotId}`,
        }],
        isError: true,
      };
    }

    let backend;
    try {
      // Per-call browser override: callers can pass `browser` on every
      // tool call to pick a different browser engine for the same slot.
      // The multi-slot manager keys its backend cache by
      // `(slotId, browser)` so different browsers coexist for the same
      // slot. The active browser tracker (managed inside the manager)
      // reuses the last-used browser on subsequent calls that omit it;
      // when neither is set, the fork's global `--browser` default
      // applies.
      const rawBrowser = (rawArgs as { browser?: unknown }).browser;
      const browser: BrowserName | undefined =
        rawBrowser === 'chrome' || rawBrowser === 'chromium' || rawBrowser === 'firefox' || rawBrowser === 'webkit'
          ? rawBrowser
          : undefined;
      const slotContext: SlotContext = browser
        ? { slotId: resolvedSlotId, browser }
        : { slotId: resolvedSlotId };
      backend = await backendManager.getOrCreateBackend(resolvedSlotId, factory, {
        cwd: process.cwd(),
        clientName: 'wf-multi',
      }, slotContext);
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: `Failed to create backend for slot ${JSON.stringify(resolvedSlotId).slice(1, -1)}: ${err instanceof Error ? err.message : String(err)}`
        }],
        isError: true,
      };
    }

    // Pass rawArgs straight through — the backend's extended schema
    // (Edit 1 in tool.ts) requires slotId, and the tool's `handle`
    // ignores the slotId field. Stripping would cause "Required: slotId"
    // ZodError on every call.
    return backend.callTool(request.params.name, rawArgs, extra.signal);
  });

  const onClose = () => backendManager.dispose().catch(serverDebug);
  addServerListener(server, 'close', onClose);

  return server;
}

async function resolveSlotId(input: string): Promise<string | null> {
  if (!input) return null;

  // Full id — use as-is
  if (input.includes('/')) return input;

  // Numeric LRU index
  if (/^\d+$/.test(input)) {
    const index = parseInt(input, 10);
    const slots = await listSlots();
    if (index < slots.length) return slots[index].id;
    return null;
  }

  // Short form — resolve against current branch
  const branch = process.env.WF_BRANCH || await getCurrentBranch();
  if (!branch) {
    return null;  // Can't resolve without branch
  }
  const fullId = `${branch}/${input}`;

  // Check if exact match exists. Use WF_REGISTRY_DIR (matches resolveMetroPort).
  const baseDir = process.env.WF_REGISTRY_DIR || path.join(os.homedir(), '.local/state/wf-registry');
  const registryPath = path.resolve(baseDir, 'registry.json');

  try {
    const content = await fsp.readFile(registryPath, 'utf-8');
    const registry = JSON.parse(content);

    // Check if ambiguous (multiple branches have this short name) BEFORE
    // returning the current-branch match. Two slots with the same short name
    // across branches is ambiguous even if one happens to be in the current branch.
    const matches = Object.keys(registry.slots || {})
      .filter(id => id.endsWith(`/${input}`));
    if (matches.length > 1) return null; // Ambiguous

    // No ambiguity — return exact match in current branch, or first match.
    if (registry.slots?.[fullId]) return fullId;
    if (matches.length === 1) return matches[0];
  } catch (err) {
    serverDebug('resolveSlotId: failed to read registry:', err);
  }

  return null;
}

const initializeServer = async (server: ServerType, factory: ServerBackendFactory, runHeartbeat: boolean): Promise<ServerBackend> => {
  const capabilities = server.getClientCapabilities();
  let clientRoots: Root[] = [];
  if (capabilities?.roots) {
    const { roots } = await server.listRoots().catch(e => {
      serverDebug(e);
      return { roots: [] };
    });
    clientRoots = roots;
  }

  const clientInfo: ClientInfo = {
    cwd: firstRootPath(clientRoots),
    clientName: server.getClientVersion()?.name ?? 'Playwright MCP',
  };

  const backend = await backendManager.createBackend(factory, clientInfo);
  if (runHeartbeat)
    startHeartbeat(server);
  return backend;
};

const startHeartbeat = (server: ServerType) => {
  const beat = () => {
    Promise.race([
      server.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 5000)),
    ]).then(() => {
      setTimeout(beat, 3000);
    }).catch(() => {
      void server.close();
    });
  };

  beat();
};

function addServerListener(server: ServerType, event: 'close' | 'initialized', listener: () => void) {
  const oldListener = server[`on${event}`];
  server[`on${event}`] = () => {
    oldListener?.();
    listener();
  };
}

export async function start(serverBackendFactory: ServerBackendFactory, options: { host?: string; port?: number, allowedHosts?: string[], socketPath?: string } = {}) {
  if (options.port === undefined) {
    const transport = new StdioServerTransport();
    // The SDK's StdioServerTransport doesn't detect peer disconnect — it never listens for stdin
    // end-of-stream. Wire it up so callTool requests can be cancelled when the client goes away.
    process.stdin.on('end', () => void transport.close());
    await connect(serverBackendFactory, transport, false);
    return;
  }

  const url = await startMcpHttpServer(options, serverBackendFactory, options.allowedHosts);

  const mcpConfig: any = { mcpServers: { } };
  mcpConfig.mcpServers[serverBackendFactory.nameInConfig] = {
    url: `${url}/mcp`
  };
  const message = [
    `Listening on ${url}`,
    'Put this in your client config:',
    JSON.stringify(mcpConfig, undefined, 2),
    'For legacy SSE transport support, you can use the /sse endpoint instead.',
  ].join('\n');
    // eslint-disable-next-line no-console
  console.error(message);
}

/**
 * Multi-slot variant of {@link start}. Currently stdio-only — the wf
 * integration spawns this fork as a stdio MCP child and does not set
 * `--port`. HTTP/SSE support for multi-slot requires threading a custom
 * server factory through {@link startMcpHttpServer} and is out of scope
 * for this edit.
 *
 * `options.defaultBrowser` is the fork's global `--browser` flag
 * value, used as the fall-back when a tool call has no per-call
 * `browser` arg and the slot has no active browser yet. Defaults to
 * `'chrome'`.
 */
export async function startMultiServer(
  serverBackendFactory: ServerBackendFactory,
  options: { host?: string; port?: number, allowedHosts?: string[], socketPath?: string, defaultBrowser?: BrowserName } = {}
) {
  if (options.port !== undefined) {
    throw new Error('--multi mode currently only supports stdio transport (do not set --port)');
  }
  const transport = new StdioServerTransport();
  // Mirror upstream: detect peer disconnect so callTool can be cancelled.
  process.stdin.on('end', () => void transport.close());
  const server = createMultiServer(
    serverBackendFactory.name,
    serverBackendFactory.version,
    serverBackendFactory,
    { defaultBrowser: options.defaultBrowser }
  );
  await server.connect(transport);
}

export function firstRootPath(roots: Root[]): string {
  return allRootPaths(roots)[0];
}

export function allRootPaths(roots: Root[]): string[] {
  const paths: string[] = [];
  for (const root of roots) {
    const url = new URL(root.uri);
    let rootPath;
    try {
      rootPath = fileURLToPath(url);
    } catch (e) {
      // Support WSL paths on Windows.
      if (e.code === 'ERR_INVALID_FILE_URL_PATH' && process.platform === 'win32')
        rootPath = decodeURIComponent(url.pathname);
    }
    if (!rootPath)
      continue;
    paths.push(rootPath);
  }
  if (paths.length === 0)
    paths.push(process.cwd());
  return paths;
}

function mergeTextParts(result: CallToolResult): CallToolResult {
  const content: CallToolResult['content'] = [];
  const testParts: string[] = [];
  for (const part of result.content) {
    if (part.type === 'text') {
      testParts.push(part.text);
      continue;
    }
    if (testParts.length > 0) {
      content.push({ type: 'text', text: testParts.join('\n') });
      testParts.length = 0;
    }
    content.push(part);
  }
  if (testParts.length > 0)
    content.push({ type: 'text', text: testParts.join('\n') });
  return {
    ...result,
    content,
  };
}
