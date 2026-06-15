#!/usr/bin/env node
/**
 * Multi-slot Playwright MCP — supervisor-aware entry.
 * Built from the nuesslerm/playwright-fork submodule.
 *
 * One binary, two modes (gated by the `--child` CLI flag):
 *   - Default (no `--child`): supervisor mode. Spawns a child
 *     process running the same entry in child mode (passing
 *     `--child` to it). Exposes `restart_server` to opencode.
 *     Watches the fork's dist/ for source-code changes
 *     (nodemon-style auto-restart).
 *   - `--child`: child mode. Bare MCP server, no supervision.
 *     Used by the supervisor itself, by `wf mcp inspect`, and by
 *     tests.
 */

'use strict';

const path = require('node:path');

const here = __filename;
// cli.js is at: packages/playwright-mcp-fork/packages/playwright-mcp-dist/cli.js
// repo root is 5 levels up from cli.js's directory
const repoRoot = path.resolve(here, '..', '..', '..', '..', '..');
const cliPath = here;

const isChild = process.argv.includes('--child');
if (isChild) {
  let decorateMCPCommand;
  try {
    ({ decorateMCPCommand } = require('./dist/program.js'));
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error("dist/program.js not found. Run 'node build.js' first.");
    } else {
      console.error(err);
    }
    process.exit(1);
  }
  process.on('unhandledRejection', (err) => {
    console.error(err);
    process.exit(1);
  });
  const { program } = require('commander');
  const packageJSON = require('./package.json');
  const p = program
    .version('Version ' + packageJSON.version)
    .name('Playwright MCP (Multi-slot, fork build)');
  decorateMCPCommand(p);
  const filteredArgv = process.argv.filter((a) => a !== '--child');
  program.parseAsync(filteredArgv).catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  main().catch((err) => {
    console.error('[supervisor] fatal:', err);
    process.exit(1);
  });
}

async function main() {
  const {
    Supervisor,
  } = require('./dist/supervisor.js');
  const { SupervisorServer } = require('./dist/supervisor-server.js');
  const { parseRestartConfig } = require('./dist/restart-config.js');

  // Default watch path: dist/ of this package
  // cli.js is at packages/playwright-mcp-fork/packages/playwright-mcp-dist/cli.js
  const defaultWatchPath = path.resolve(
    repoRoot,
    'packages', 'playwright-mcp-fork', 'packages', 'playwright-mcp-dist', 'dist'
  );

  const { Command } = require('commander');
  const numberParser = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`Expected a number, got: ${v}`);
    return n;
  };
  const supervisorProgram = new Command()
    .allowUnknownOption(true)
    .passThroughOptions()
    .allowExcessArguments(true)
    .option('--max-restarts <n>', 'Maximum number of automatic restarts before giving up', numberParser)
    .option('--restart-delay <ms>', 'Initial delay between restart attempts in ms', numberParser)
    .option('--max-restart-delay <ms>', 'Cap on the exponential backoff delay in ms', numberParser)
    .option('--no-auto-restart', 'Disable automatic restart on child crash')
    .option('--no-watch', 'Disable file watcher (no auto-restart on dist changes)')
    .option('--watch-path <path>', 'Directory to watch for source-code changes')
    .parse(process.argv);

  const supervisorOpts = supervisorProgram.opts();
  const cliFlags = {};
  if (supervisorOpts.maxRestarts !== undefined) cliFlags.maxRestarts = supervisorOpts.maxRestarts;
  if (supervisorOpts.restartDelay !== undefined) cliFlags.restartDelayMs = supervisorOpts.restartDelay;
  if (supervisorOpts.maxRestartDelay !== undefined) cliFlags.maxRestartDelayMs = supervisorOpts.maxRestartDelay;
  if (supervisorOpts.autoRestart === false) cliFlags.autoRestart = false;
  if (supervisorOpts.watch === false) cliFlags.watch = false;
  if (supervisorOpts.watchPath !== undefined) cliFlags.watchPath = supervisorOpts.watchPath;

  const config = parseRestartConfig({ defaultWatchPath, cliFlags });

  const SUPERVISOR_FLAGS_WITH_VALUE = new Set([
    '--max-restarts',
    '--restart-delay',
    '--max-restart-delay',
    '--watch-path',
  ]);
  const SUPERVISOR_BOOLEAN_FLAGS = new Set([
    '--no-auto-restart',
    '--no-watch',
  ]);
  const extraArgs = [];
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--child') continue;
    if (SUPERVISOR_FLAGS_WITH_VALUE.has(arg)) {
      i++;
      continue;
    }
    if (SUPERVISOR_BOOLEAN_FLAGS.has(arg)) continue;
    extraArgs.push(arg);
  }
  const supervisor = new Supervisor({
    cliPath,
    config,
    extraEnv: { WF_FORK_EXTRA_ARGS: JSON.stringify(extraArgs) },
  });

  const server = new SupervisorServer({ supervisor });

  supervisor.on('child-started', (pid) => {
    console.error(`[supervisor] child started (pid=${pid})`);
  });
  supervisor.on('child-crashed', (info) => {
    console.error(
      `[supervisor] child crashed (code=${info.code}, attempt=${info.attempt}, retry in ${info.delayMs}ms)`
    );
  });
  supervisor.on('child-exhausted', (attempts) => {
    console.error(`[supervisor] restart limit reached after ${attempts} attempts; giving up`);
  });
  supervisor.on('restart-initiated', (reason) => {
    console.error(`[supervisor] restart initiated: ${reason}`);
  });
  supervisor.on('restart-completed', (pid) => {
    console.error(`[supervisor] restart completed (pid=${pid})`);
  });

  await supervisor.start();

  // Wait for the child to finish initializing before we start the MCP
  // server. Claude Code fetches tools/list once at connect time — if we
  // start the server before the child is ready, the initial list only
  // contains `browser_restart_server` (the supervisor's own tool) and
  // Claude Code never picks up the browser tools even after the later
  // notifications/tools/list_changed fires.
  await new Promise((resolve, reject) => {
    supervisor.once('child-initialized', resolve);
    supervisor.once('child-init-failed', (err) => reject(err instanceof Error ? err : new Error(String(err))));
  });
  const initRpc = supervisor.getChildRpc();
  if (initRpc) server.setChildRpc(initRpc);

  // Subsequent restarts: child-initialized fires again after each respawn's
  // waitInitialized() resolves inside spawnChild().
  supervisor.on('child-initialized', () => {
    const rpc = supervisor.getChildRpc();
    if (rpc) server.setChildRpc(rpc);
  });

  await server.start();

  console.error('[supervisor] signal handlers registering...');
  const logIgnoredSignal = (sig) => {
    console.error(`[supervisor] received ${sig}; ignored (supervisor only exits on SIGUSR2 from parent, or SIGKILL)`);
  };
  process.on('SIGINT', () => logIgnoredSignal('SIGINT'));
  process.on('SIGTERM', () => logIgnoredSignal('SIGTERM'));
  process.on('SIGHUP', () => logIgnoredSignal('SIGHUP'));
  process.on('SIGUSR2', async () => {
    console.error('[supervisor] received SIGUSR2; graceful shutdown');
    await supervisor.stop();
    process.exit(0);
  });
  console.error('[supervisor] signal handlers registered, ready');
}
