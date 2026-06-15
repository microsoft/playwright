import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { ChildProcess } from 'node:child_process';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_INIT_TIMEOUT_MS = 10_000;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
};

export type ChildServerInfo = {
  name: string;
  version: string;
  protocolVersion?: string;
  capabilities?: Record<string, unknown>;
};

/**
 * JSON-RPC-over-NDJSON client that wraps a child MCP server's stdio.
 *
 * Lifecycle:
 *   1. Construct with the child ChildProcess.
 *   2. Call waitInitialized() once after the child spawns. This sends
 *      the supervisor's own initialize frame and captures the child's
 *      serverInfo + tool list.
 *   3. Use request() for any subsequent MCP call (forwarded as-is).
 *   4. Subscribe to 'notification' for server-sent frames (no id).
 *   5. Call close() when the child exits (tears down pending timers).
 */
export class ChildRpc extends EventEmitter {
  private readonly child: ChildProcess;
  private readonly pending = new Map<string, Pending>();
  private buf = '';
  private closed = false;
  private serverInfo: ChildServerInfo | null = null;
  private cachedTools: unknown[] = [];

  constructor(child: ChildProcess) {
    super();
    this.child = child;
    this.attachReader(child);
    child.on('exit', (code, signal) => this.handleChildExit(code, signal));
  }

  /** Send initialize, await the response, cache serverInfo + tools/list. */
  async waitInitialized(initTimeoutMs: number = DEFAULT_INIT_TIMEOUT_MS): Promise<ChildServerInfo> {
    const initResult = (await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'wf-playwright-multi-supervisor', version: '0.0.0' },
    }, initTimeoutMs)) as { serverInfo: ChildServerInfo; capabilities?: Record<string, unknown> };

    this.serverInfo = initResult.serverInfo;

    // Pull tools/list once. The supervisor advertises this snapshot
    // until the next restart, at which point a new ChildRpc repopulates.
    try {
      const toolsResult = (await this.request('tools/list', {})) as { tools: unknown[] };
      this.cachedTools = toolsResult.tools || [];
    } catch {
      this.cachedTools = [];
    }

    return this.serverInfo;
  }

  /** Return the cached tool list (populated by waitInitialized). */
  listTools(): unknown[] {
    return this.cachedTools;
  }

  /** Return the captured serverInfo, or null if waitInitialized hasn't resolved. */
  getServerInfo(): ChildServerInfo | null {
    return this.serverInfo;
  }

  /** Send a JSON-RPC request; return the result. Throws on timeout or child exit. */
  async request(method: string, params: unknown, timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS): Promise<unknown> {
    if (this.closed) throw new Error('ChildRpc is closed');
    const id = randomUUID();
    const frame = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ChildRpc request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin!.write(frame, (err) => {
        if (err) {
          this.pending.delete(id);
          clearTimeout(timer);
          reject(new Error(`ChildRpc write failed: ${err.message}`));
        }
      });
    });
  }

  /** Tear down: reject all pending, detach listeners. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error('ChildRpc closed'));
    }
    this.pending.clear();
    this.removeAllListeners();
  }

  private attachReader(child: ChildProcess): void {
    // Defensive: setEncoding is on Node's Readable stream. Tests
    // that mock `node:child_process` sometimes return a plain
    // EventEmitter for stdout. Skip the encoding call in that
    // case — `data` events will deliver Buffers, which we coerce
    // via String() below.
    const stdout = child.stdout;
    if (stdout && typeof (stdout as { setEncoding?: unknown }).setEncoding === 'function') {
      stdout.setEncoding('utf8');
    }
    if (!stdout) return;
    stdout.on('data', (chunk: string | Buffer) => {
      this.buf += typeof chunk === 'string' ? chunk : String(chunk);
      let nl;
      while ((nl = this.buf.indexOf('\n')) !== -1) {
        const line = this.buf.slice(0, nl).trim();
        this.buf = this.buf.slice(nl + 1);
        if (!line) continue;
        this.handleFrame(line);
      }
    });
  }

  private handleFrame(line: string): void {
    let msg: { id?: string; method?: string; result?: unknown; error?: unknown; params?: unknown };
    try {
      msg = JSON.parse(line);
    } catch {
      return; // ignore non-JSON lines (log noise from the child)
    }
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      // Return either result or error so the caller decides
      // how to surface it (SupervisorServer passes through directly).
      p.resolve(msg.error !== undefined ? msg.error : msg.result);
    } else if (msg.id === undefined && msg.method !== undefined) {
      // Server-sent notification (no id, has method).
      this.emit('notification', { method: msg.method, params: msg.params });
    }
  }

  private handleChildExit(code: number | null, signal: NodeJS.Signals | null): void {
    const msg = `Child exited (code=${code}, signal=${signal})`;
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(msg));
    }
    this.pending.clear();
  }
}
