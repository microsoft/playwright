import * as http from 'http';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileP = promisify(execFile);

/**
 * Probe a local port via HTTP HEAD request.
 * Returns true if the server responds with 2xx or 3xx within the timeout.
 *
 * Default 5000ms because Metro's `/status` HEAD intermittently takes 1-2.5s
 * under load (file-map rebuild, transform workers, etc.). 2500ms was right
 * on the edge and produced false-negative `healthy: false` flakes for the
 * multi-slot manager. The regression pin in `tests/probe-port.test.ts`
 * still passes at this default (its 3s server-delay case still times out).
 */
export function probePort(port: number, timeoutMs: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: 'localhost', port, method: 'HEAD', timeout: timeoutMs },
      (res) => {
        res.resume(); // drain socket to prevent CLOSE_WAIT
        const ok = res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 400;
        resolve(ok);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/**
 * Get current git branch name, or null if not in a git repo
 * (or in detached HEAD state).
 */
export async function getCurrentBranch(): Promise<string | null> {
  try {
    const { stdout } = await execFileP('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
    const branch = stdout.trim();
    return branch === 'HEAD' ? null : branch; // detached HEAD = null
  } catch {
    return null;
  }
}
