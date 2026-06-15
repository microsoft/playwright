import { z } from 'zod';

/**
 * Zod schema for the supervisor's restart + watch config.
 * All fields have sensible defaults; env/CLI only override what
 * the user wants different. `watchPath` is required because the
 * sensible default depends on the location of the running cli.js
 * (the supervisor module itself doesn't know where it's invoked
 * from); the caller (cli.js) computes the default and passes it
 * in via `cliFlags` or `defaultWatchPath`.
 */
export const RestartConfigSchema = z.object({
  maxRestarts: z.number().int().min(0).max(10).default(3),
  restartDelayMs: z.number().int().min(0).max(60_000).default(1000),
  maxRestartDelayMs: z.number().int().min(0).max(300_000).default(30_000),
  autoRestart: z.boolean().default(true),
  watch: z.boolean().default(true),
  watchPath: z.string(),
});

export type RestartConfig = z.infer<typeof RestartConfigSchema>;

/**
 * Read restart config from env vars + CLI flags. CLI wins over env
 * wins over defaults. Unknown env vars are ignored.
 */
export function parseRestartConfig(opts: {
  env?: NodeJS.ProcessEnv;
  cliFlags?: Partial<{
    maxRestarts: number;
    restartDelayMs: number;
    maxRestartDelayMs: number;
    autoRestart: boolean;
    watch: boolean;
    watchPath: string;
  }>;
  /**
   * Default watch path, used when neither env nor CLI flags set one.
   * The caller is responsible for computing this from the location
   * of the running entry script (cli.js), since the supervisor
   * module doesn't know its own install path at runtime (the file
   * lives in a CJS bundle with no `__filename` of its own).
   */
  defaultWatchPath: string;
}): RestartConfig {
  const env = opts.env ?? process.env;
  const cli = opts.cliFlags ?? {};

  const fromEnv: Partial<z.infer<typeof RestartConfigSchema>> = {};
  if (env.WF_MCP_MAX_RESTARTS !== undefined) {
    fromEnv.maxRestarts = Number(env.WF_MCP_MAX_RESTARTS);
  }
  if (env.WF_MCP_RESTART_DELAY_MS !== undefined) {
    fromEnv.restartDelayMs = Number(env.WF_MCP_RESTART_DELAY_MS);
  }
  if (env.WF_MCP_MAX_RESTART_DELAY_MS !== undefined) {
    fromEnv.maxRestartDelayMs = Number(env.WF_MCP_MAX_RESTART_DELAY_MS);
  }
  if (env.WF_MCP_AUTO_RESTART !== undefined) {
    fromEnv.autoRestart = env.WF_MCP_AUTO_RESTART !== 'false';
  }
  if (env.WF_MCP_WATCH !== undefined) {
    fromEnv.watch = env.WF_MCP_WATCH !== 'false';
  }
  if (env.WF_MCP_WATCH_PATH !== undefined) {
    fromEnv.watchPath = env.WF_MCP_WATCH_PATH;
  }

  return RestartConfigSchema.parse({
    watchPath: opts.defaultWatchPath,
    ...fromEnv,
    ...cli,
  });
}
