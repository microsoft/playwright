import { EventEmitter } from 'node:events';
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import type { RestartConfig } from './restart-config.js';
import { ChildRpc } from './child-rpc.js';

export enum SupervisorState {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  RESTARTING = 'restarting',
  GAVE_UP = 'gave_up',
}

export type SupervisorOptions = {
  cliPath: string;
  /** Extra env vars to merge on top of `process.env` for the child. */
  extraEnv?: NodeJS.ProcessEnv;
  config: RestartConfig;
  /**
   * Override spawn for tests. Defaults to `node:child_process.spawn`.
   * Signature: (cmd, args, opts) => ChildProcess-shaped object.
   */
  spawnImpl?: typeof nodeSpawn;
};

export class Supervisor extends EventEmitter {
  private child: ChildProcess | null = null;
  private childRpc: ChildRpc | null = null;
  private state: SupervisorState = SupervisorState.STOPPED;
  private restartCount = 0;
  // SourceWatcher is dynamically imported only when config.watch is true.
  // cli.js (Task 5) wires the actual restart; this supervisor just emits
  // the event and lets the watcher side decide.
  private watcher: { stop: () => Promise<void> } | null = null;
  private readonly cliPath: string;
  private readonly extraEnv: NodeJS.ProcessEnv;
  private readonly config: RestartConfig;
  private readonly spawnImpl: typeof nodeSpawn;
  private stopping = false;
  /**
   * Stability timer. When a child has been alive longer than
   * `maxRestartDelayMs`, we treat it as "healthy enough that a
   * subsequent crash is a fresh incident, not a continuation of
   * the previous startup-retry sequence." When the timer fires,
   * we reset `restartCount` to 0 and emit `child-stable` so
   * observers (and tests) can see the transition.
   *
   * Tracked so we can clear it on every respawn (a new child
   * means a new stability window) and on `stop()`.
   */
  private stabilityTimer: NodeJS.Timeout | null = null;

  constructor(opts: SupervisorOptions) {
    super();
    this.cliPath = opts.cliPath;
    this.extraEnv = opts.extraEnv ?? {};
    this.config = opts.config;
    this.spawnImpl = opts.spawnImpl ?? nodeSpawn;
  }

  getState(): SupervisorState {
    return this.state;
  }

  getChildPid(): number | null {
    return this.child?.pid ?? null;
  }

  /**
   * Test/diagnostic accessor for the current restart counter.
   * Production code should rely on the `child-exhausted` /
   * `child-stable` events instead of polling this. Exposed so
   * the unit test can assert "stability timer reset the
   * counter" deterministically.
   */
  getRestartCountForTest(): number {
    return this.restartCount;
  }

  /**
   * The live JSON-RPC client for the current child (or null until
   * `spawnChild` runs). SupervisorServer grabs this on
   * `child-initialized` so it can pull the real tool list and
   * forward `tools/call` requests to the child.
   *
   * After `restart()` runs, a new ChildRpc is constructed inside
   * `spawnChild` and exposed here — callers should re-read after
   * `restart-completed` fires.
   */
  getChildRpc(): ChildRpc | null {
    return this.childRpc;
  }

  private clearStabilityTimer(): void {
    if (this.stabilityTimer) {
      clearTimeout(this.stabilityTimer);
      this.stabilityTimer = null;
    }
  }

  /**
   * Arm a `maxRestartDelayMs`-duration timer that, if it fires
   * (i.e. the child is still alive when the timer expires),
   * resets the auto-restart counter and emits `child-stable`.
   * Called from `spawnChild()` after a successful spawn. A
   * subsequent spawn (or `stop()`) clears the previous timer,
   * so the stability window is always anchored to the *current*
   * child, not the lifetime of the supervisor.
   */
  private armStabilityTimer(): void {
    this.clearStabilityTimer();
    this.stabilityTimer = setTimeout(() => {
      this.stabilityTimer = null;
      // Only reset if we're still in the running state — a crash
      // that happened before the timer fired already triggered
      // a respawn (or a GAVE_UP), so resetting here would be
      // either a no-op or would re-arm a counter we already
      // gave up on. Cheap defensive check.
      if (this.state === SupervisorState.RUNNING) {
        this.restartCount = 0;
        this.emit('child-stable');
      }
    }, this.config.maxRestartDelayMs);
    // Unref so a still-armed timer on an otherwise-idle
    // supervisor doesn't keep the event loop alive past stop().
    this.stabilityTimer.unref?.();
  }

  async start(): Promise<void> {
    if (this.state !== SupervisorState.STOPPED) {
      throw new Error(`Cannot start: supervisor is ${this.state}`);
    }
    this.stopping = false;
    await this.spawnChild();
    if (this.config.watch) {
      // Dynamic import: source-watcher.js is owned by Task 2 (parallel).
      // We resolve it lazily so this module compiles even before the
      // watcher module exists; cli.js (Task 5) wires the actual
      // restart-on-change hook.
      const { SourceWatcher } = await import('./source-watcher.js');
      this.watcher = new SourceWatcher({
        path: this.config.watchPath,
        debounceMs: 200,
      });
      (this.watcher as unknown as EventEmitter).on('change', (filepath: string) => {
        this.emit('source-changed', filepath);
        void this.restart({ reason: `source change: ${filepath}` });
      });
      await (this.watcher as unknown as { start: () => Promise<void> }).start();
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.clearStabilityTimer();
    if (this.watcher) {
      try {
        await this.watcher.stop();
      } catch {
        // ignore
      }
      this.watcher = null;
    }
    if (this.child) {
      try {
        this.child.kill('SIGTERM');
      } catch {
        // ignore
      }
    }
    this.state = SupervisorState.STOPPED;
  }

  async restart(opts: { reason?: string } = {}): Promise<void> {
    this.emit('restart-initiated', opts.reason ?? 'manual');
    if (this.child) {
      try {
        this.child.kill('SIGTERM');
      } catch {
        // ignore
      }
      // Wait briefly for the child to actually exit
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 100);
        this.child?.once('exit', () => {
          clearTimeout(t);
          resolve();
        });
      });
    }
    // Tear down the old ChildRpc — its child has just exited and
    // any pending request() would otherwise reject. spawnChild
    // constructs a fresh one below.
    this.childRpc?.close();
    this.childRpc = null;
    this.state = SupervisorState.RESTARTING;
    // Manual restart resets the counter — operator action shouldn't
    // count against the auto-restart gate.
    this.restartCount = 0;
    await this.spawnChild();
    this.emit('restart-completed', this.child?.pid ?? null);
  }

  private async spawnChild(): Promise<void> {
    this.state = SupervisorState.STARTING;
    // Read parent-supplied extra args (fork flags the supervisor
    // doesn't consume itself) and forward them to the child so the
    // child launches with the same viewport, headless mode, browser,
    // etc. that the user asked for. If WF_FORK_EXTRA_ARGS is missing
    // or invalid JSON, fall back to spawning with --child only.
    let forwardedArgs = ['--child'];
    const raw = this.extraEnv.WF_FORK_EXTRA_ARGS;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((a) => typeof a === 'string')) {
          forwardedArgs = ['--child', ...parsed];
        }
      } catch {
        // ignore bad env; fall through to default
      }
    }
    this.child = this.spawnImpl(process.execPath, [this.cliPath, ...forwardedArgs], {
      env: { ...process.env, ...this.extraEnv },
      // Pipe all three: the supervisor owns the parent's stdio for
      // the MCP transport, and the child has no need to talk to the
      // opencode client directly (it is supervised + restarted
      // through the supervisor's `browser_restart_server` tool).
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.emit('child-started', this.child.pid);

    this.child.on('exit', (code, signal) => {
      void this.handleChildExit(code, signal);
    });

    // Construct a ChildRpc over the freshly-spawned child. We don't
    // await waitInitialized() here — spawnChild is sync-shaped and
    // blocks the supervisor's stdio if we did. Instead, fire-and-
    // forget: on success emit `child-initialized` (so SupervisorServer
    // can swap its advertised tool list + forward notifications); on
    // failure emit `child-init-failed` (so the caller can log/observe).
    const rpc = new ChildRpc(this.child);
    this.childRpc = rpc;
    rpc.waitInitialized()
      .then((serverInfo) => {
        this.emit('child-initialized', {
          pid: this.child?.pid,
          serverInfo,
          tools: this.childRpc?.listTools() ?? [],
        });
      })
      .catch((err: unknown) => {
        this.emit('child-init-failed', err);
      });

    this.state = SupervisorState.RUNNING;
    // Note: we deliberately do NOT reset restartCount here. The auto-restart
    // path in handleChildExit increments it, and the GAVE_UP gate is keyed
    // off "consecutive failed children." Manual restart() resets the
    // counter explicitly (operator action shouldn't count). The
    // stability-timer (started below) handles the "child ran for a while
    // before crashing" case, which is the right semantic for an
    // independently-healthy long-lived child.
    this.armStabilityTimer();
  }

  private async handleChildExit(
    code: number | null,
    _signal: NodeJS.Signals | null
  ): Promise<void> {
    if (this.stopping) return;
    this.child = null;
    if (code === 0) {
      this.emit('child-exited-clean', code);
      this.state = SupervisorState.STOPPED;
      return;
    }
    if (!this.config.autoRestart) {
      this.emit('child-exited-fatal', code);
      this.state = SupervisorState.STOPPED;
      return;
    }
    if (this.restartCount >= this.config.maxRestarts) {
      this.emit('child-exhausted', this.restartCount);
      this.state = SupervisorState.GAVE_UP;
      return;
    }
    this.restartCount++;
    const delay = Math.min(
      this.config.restartDelayMs * 2 ** (this.restartCount - 1),
      this.config.maxRestartDelayMs
    );
    this.emit('child-crashed', { code, attempt: this.restartCount, delayMs: delay });
    await new Promise((r) => setTimeout(r, delay));
    if (this.stopping) return;
    try {
      await this.spawnChild();
    } catch (err) {
      this.emit('restart-failed', err);
      this.state = SupervisorState.GAVE_UP;
    }
  }
}
