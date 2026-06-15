import { EventEmitter } from 'node:events';
import { watch as fsWatch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';

export type SourceWatcherOptions = {
  path: string;
  debounceMs?: number;
};

/**
 * Pure filter for SourceWatcher's `change` boundary. Exported so callers
 * (and unit tests) can verify the ignore-set without spinning up `fs.watch`.
 * Returns `true` when the filename should be dropped:
 *   - hidden files (leading `.`)
 *   - anything that is not a `.js` file (catches `.map`, `.d.ts`, `.json`, etc.)
 */
export function shouldIgnoreSourceFile(filename: string): boolean {
  if (filename.startsWith('.')) return true;
  if (!filename.endsWith('.js')) return true;
  return false;
}

/**
 * Watches a directory for `.js` file changes. Emits a single
 * `change(filepath)` event per debounced burst. Filters out
 * `.map`, `.d.ts`, and hidden files.
 *
 * Uses node:fs.watch with `recursive: true` so the entire dist
 * subtree is observed. (Recursive watch is supported on macOS
 * and Linux; Windows requires a different fallback — out of
 * scope for this dev-only tool.)
 */
export class SourceWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly path: string;
  private readonly debounceMs: number;

  constructor(opts: SourceWatcherOptions) {
    super();
    this.path = opts.path;
    this.debounceMs = opts.debounceMs ?? 200;
  }

  async start(): Promise<void> {
    if (this.watcher) return;
    this.watcher = fsWatch(
      this.path,
      { recursive: true },
      (_eventType, filename) => {
        if (!filename) return;
        if (this.shouldIgnore(filename)) return;
        this.scheduleEmit(filename);
      }
    );
    // Suppress the "no listeners" warning when start() is called
    // and the consumer hasn't subscribed yet.
    this.setMaxListeners(20);
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private shouldIgnore(filename: string): boolean {
    return shouldIgnoreSourceFile(filename);
  }

  private scheduleEmit(filename: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.emit('change', join(this.path, filename));
    }, this.debounceMs);
  }
}
