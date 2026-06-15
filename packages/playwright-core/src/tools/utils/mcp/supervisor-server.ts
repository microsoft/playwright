import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import type { Supervisor } from './supervisor.js';
import type { ChildRpc } from './child-rpc.js';

export type SupervisorServerOptions = {
  supervisor: Supervisor;
  /** Min interval between restart_server calls. Default 5000ms. */
  minIntervalMs?: number;
};

const RESTART_TOOL: Tool = {
  name: 'browser_restart_server',
  description:
    'Restart the playwright MCP child process. Useful after editing ' +
    'fork source code (rebuild first, then call this). The supervisor ' +
    'kills the running child and spawns a new one; a tools/list_changed ' +
    'notification is sent when the new child is initialized.',
  inputSchema: {
    type: 'object',
    properties: {
      force: {
        type: 'boolean',
        description:
          'Bypass the "is healthy?" check. Default: skip restart if the ' +
          'child is healthy. Pass true to force.',
      },
      reason: {
        type: 'string',
        description: 'Free-text reason for the restart; logged in the supervisor.',
      },
    },
  },
};

/**
 * MCP server the supervisor exposes to opencode. Mirrors the
 * child's tools (caller injects them) plus the supervisor's own
 * `restart_server` tool. Uses only `tools: { listChanged: true }`
 * — no completion/sampling/resources (the child doesn't expose
 * those, so declaring them would be a lie and the SDK would
 * complain on the first completion request).
 */
export class SupervisorServer {
  private readonly server: Server;
  private readonly supervisor: Supervisor;
  private childRpc: ChildRpc | null = null;
  private cachedTools: Tool[] = [];
  private isRestartInProgress = false;
  private lastRestartTime = 0;
  private readonly minIntervalMs: number;

  constructor(opts: SupervisorServerOptions) {
    this.supervisor = opts.supervisor;
    // Allow tests / power users to override the rate limit via env.
    // Default: 5000ms.
    const envValue = process.env.WF_MCP_MIN_RESTART_INTERVAL_MS;
    const fromEnv = envValue !== undefined ? Number(envValue) : undefined;
    this.minIntervalMs = opts.minIntervalMs ?? fromEnv ?? 5000;
    this.server = new Server(
      { name: 'wf-playwright-multi-supervisor', version: '0.0.75-multi.1' },
      { capabilities: { tools: { listChanged: true } } }
    );
    this.setupHandlers();
  }

  /**
   * Hand the live JSON-RPC client to the supervisor server. Pulls
   * the child's real tool list (replacing the previous hand-
   * maintained stub) and subscribes to server-sent notifications
   * (e.g. `notifications/tools/list_changed`) so they get re-emitted
   * to the opencode client. On the call we also fire a single
   * `list_changed` to force opencode to refresh its tool cache.
   *
   * Called by cli.js on `child-initialized` (first boot) and again
   * after `restart-completed` (the supervisor already created a
   * fresh ChildRpc inside `spawnChild`).
   */
  setChildRpc(rpc: ChildRpc): void {
    // Detach the previous rpc's notifications so we don't leak
    // listeners across restarts.
    this.childRpc?.removeAllListeners('notification');
    this.childRpc = rpc;
    this.cachedTools = (rpc.listTools() ?? []) as Tool[];
    rpc.on('notification', (n: { method: string }) => {
      // Re-emit to the opencode client. Suppress — opencode may
      // be disconnected, in which case the SDK call rejects.
      this.server.notification({ method: n.method }).catch(() => {});
    });
    // Trigger a list_changed so opencode refreshes its tool cache.
    this.server
      .notification({ method: 'notifications/tools/list_changed' })
      .catch(() => {
        // ignore — if opencode has disconnected, we just lose the notification
      });
  }

  listTools(): Tool[] {
    return [...this.cachedTools, RESTART_TOOL];
  }

  /** Drive a `tools/call` request. Returns the CallToolResult. */
  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    if (name === 'browser_restart_server') {
      return this.handleRestart(args);
    }
    if (!this.childRpc) {
      return {
        content: [{ type: 'text', text: 'Child not initialized yet' }],
        isError: true,
      };
    }
    try {
      // Forward to the child over the live rpc. The child returns a
      // real CallToolResult-shaped object (success or a tool-level
      // isError), which we pass through verbatim. Only transport-
      // level failures (timeout, child exited) become isError here.
      return (await this.childRpc.request('tools/call', {
        name,
        arguments: args,
      })) as CallToolResult;
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Child call failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /** Start the server on stdio (the supervisor's stdio). */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: this.listTools(),
    }));
    this.server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const name = req.params.name;
      const args = (req.params.arguments ?? {}) as Record<string, unknown>;
      return this.callTool(name, args);
    });
  }

  private async handleRestart(args: Record<string, unknown>): Promise<CallToolResult> {
    if (this.isRestartInProgress) {
      return {
        content: [{ type: 'text', text: 'Restart already in progress.' }],
        isError: true,
      };
    }
    const now = Date.now();
    if (now - this.lastRestartTime < this.minIntervalMs) {
      const waitS = Math.ceil((this.minIntervalMs - (now - this.lastRestartTime)) / 1000);
      return {
        content: [{ type: 'text', text: `Please wait ${waitS}s before another restart.` }],
        isError: true,
      };
    }
    this.isRestartInProgress = true;
    const startTime = Date.now();
    try {
      await this.supervisor.restart({ reason: String(args.reason ?? 'manual') });
      const elapsed = Date.now() - startTime;
      this.lastRestartTime = Date.now();
      return {
        content: [
          {
            type: 'text',
            text: `Server restarted in ${elapsed}ms (reason: ${args.reason ?? 'manual'})`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Restart failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    } finally {
      this.isRestartInProgress = false;
    }
  }
}
