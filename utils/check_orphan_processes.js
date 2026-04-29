#!/usr/bin/env node
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

// @ts-check

// Detects processes that survived a test run. Used by the run-test composite
// action: we snapshot processes before tests, then check after tests and fail
// if any process present after the run wasn't present before.
//
// Usage:
//   node utils/check_orphan_processes.js snapshot <file>
//   node utils/check_orphan_processes.js check <file> [graceSeconds]
//
// Process identity is (pid, startTime) so that PID reuse during a long test
// run cannot mask a real orphan. On Linux/macOS we filter to processes owned
// by the current user; on Windows we rely on the diff to filter noise.

const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

/**
 * @typedef {{ pid: number, ppid: number, startTime: string, command: string }} ProcessRecord
 */

// CI infrastructure processes that may legitimately spawn during the post-test
// grace window. These are noise from the GitHub-hosted runner image, not test
// leaks. Patterns are case-insensitive substring matches against the full
// command line.
const SYSTEM_PROCESS_DENYLIST = {
  linux: [
    '/usr/bin/dbus-daemon',          // systemd-activated user-session bus
  ],
  darwin: [
    '/System/Library/',              // macOS system frameworks / XPC services
    '/System/Cryptexes/',            // macOS Cryptex system payload
    '/System/Volumes/Preboot/Cryptexes/', // macOS preboot Cryptex
    '/usr/libexec/',                 // macOS launchd-managed helpers
    'cloudphotod',                   // self-named iCloud Photos daemon
  ],
  win32: [
    '\\System32\\svchost.exe',       // Windows service host
    '\\System32\\wbem\\wmiprvse.exe',// WMI provider (invoked by our own snapshot)
    '\\System32\\CompatTelRunner.exe',// Microsoft Compatibility Telemetry
  ],
};

// Per-job orphan-process ratchet. Each entry is a known unfixed leak — the
// test run for the named GitHub Actions job (github.job) may leave at most
// `max` orphan processes behind. Drive each entry to 0 (or remove it) as
// leaks are fixed. Jobs not listed have an implicit budget of 0. The job
// key is passed via the ORPHAN_PROCESS_BUDGET_KEY env var.
//
// `line` is this file's line number of the entry — used to point GitHub
// Actions notice/error annotations at the entry. Update it if you reorder.
const JOB_BUDGETS = {
  test_mcp: { max: 15, line: 71, reason: 'tests/mcp/ leaks cliDaemon.js + chromium browser tree (~9 processes) on test failures.' },
};

/** @returns {ProcessRecord[]} */
function readProcessesLinux() {
  const myUid = process.geteuid ? process.geteuid() : -1;
  /** @type {ProcessRecord[]} */
  const result = [];
  for (const dir of fs.readdirSync('/proc')) {
    const pid = +dir;
    if (isNaN(pid))
      continue;
    try {
      // Format of /proc/<pid>/stat is described in https://man7.org/linux/man-pages/man5/proc.5.html
      // Field 22 (1-indexed, after `comm`) is starttime in clock ticks since boot.
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      const commEnd = stat.lastIndexOf(')');
      if (commEnd === -1)
        continue;
      const comm = stat.slice(stat.indexOf('(') + 1, commEnd);
      const rest = stat.slice(commEnd + 2).split(/\s+/);
      // rest[0] = state, rest[1] = ppid, rest[2] = pgrp, ... rest[19] = starttime (field 22 - 3).
      const ppid = +rest[1];
      const startTime = rest[19];
      if (isNaN(ppid) || !startTime)
        continue;

      if (myUid >= 0) {
        const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
        const uidMatch = status.match(/^Uid:\s+(\d+)/m);
        if (!uidMatch || +uidMatch[1] !== myUid)
          continue;
      }

      let command = comm;
      try {
        const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
        const joined = cmdline.replace(/\0+$/g, '').replace(/\0/g, ' ').trim();
        if (joined)
          command = joined;
      } catch {
        // /proc/<pid>/cmdline can be empty or unreadable for kernel threads.
      }

      result.push({ pid, ppid, startTime, command });
    } catch {
      // Process exited between readdir and read, or we lack permission.
    }
  }
  return result;
}

/** @returns {ProcessRecord[]} */
function readProcessesMacOS() {
  const me = os.userInfo().username;
  const out = spawnSync('ps', ['-A', '-o', 'pid=,ppid=,user=,lstart=,command='], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (out.status !== 0)
    throw new Error(`ps failed (status ${out.status}): ${out.stderr}`);
  /** @type {ProcessRecord[]} */
  const result = [];
  for (const line of out.stdout.split('\n')) {
    if (!line.trim())
      continue;
    // lstart is 5 whitespace-separated fields (e.g. "Tue Apr 29 14:30:01 2026").
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.*)$/);
    if (!match)
      continue;
    const [, pid, ppid, user, lstart, command] = match;
    if (user !== me)
      continue;
    result.push({ pid: +pid, ppid: +ppid, startTime: lstart, command });
  }
  return result;
}

/** @returns {ProcessRecord[]} */
function readProcessesWindows() {
  // Single WMI query for everything we need. We don't filter by owner here;
  // owner lookup is one WMI call per process and would be very slow. The
  // before/after diff handles unrelated processes adequately.
  const script = `
$ErrorActionPreference = 'Stop'
$procs = Get-CimInstance -ClassName Win32_Process |
  ForEach-Object {
    [pscustomobject]@{
      pid = [int]$_.ProcessId
      ppid = [int]$_.ParentProcessId
      startTime = if ($_.CreationDate) { $_.CreationDate.ToString('o') } else { '' }
      command = if ($_.CommandLine) { $_.CommandLine } else { $_.Name }
    }
  }
ConvertTo-Json -InputObject @($procs) -Compress -Depth 3
`.trim();
  const out = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (out.status !== 0)
    throw new Error(`powershell failed (status ${out.status}): ${out.stderr}`);
  const parsed = JSON.parse(out.stdout.trim() || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}

/** @returns {ProcessRecord[]} */
function readProcesses() {
  switch (process.platform) {
    case 'linux': return readProcessesLinux();
    case 'darwin': return readProcessesMacOS();
    case 'win32': return readProcessesWindows();
    default: throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

/** @param {ProcessRecord} p */
function identity(p) {
  return `${p.pid}:${p.startTime}`;
}

/**
 * Returns true if the process matches a hardcoded CI infrastructure pattern
 * (system daemons, etc.) that should be ignored unconditionally.
 *
 * @param {ProcessRecord} p
 */
function isSystemProcess(p) {
  const patterns = SYSTEM_PROCESS_DENYLIST[process.platform] || [];
  const cmd = (p.command || '').toLowerCase();
  for (const pattern of patterns) {
    if (cmd.includes(pattern.toLowerCase()))
      return true;
  }
  return false;
}

/**
 * Returns the per-job orphan-process budget. Defaults to 0 for jobs not
 * listed in JOB_BUDGETS.
 *
 * @param {string} jobKey
 * @returns {{ max: number, line: number, reason: string }}
 */
function loadBudget(jobKey) {
  const entry = jobKey ? JOB_BUDGETS[jobKey] : null;
  return entry || { max: 0, line: 0, reason: '' };
}

/**
 * Builds a GitHub Actions workflow-command annotation prefix that points at
 * this file's JOB_BUDGETS entry for the given job (when known), so clicking
 * the annotation in the run summary or PR Checks tab jumps straight to the
 * line you'd edit to ratchet the budget.
 *
 * @param {'notice' | 'error'} level
 * @param {{ line: number }} budget
 */
function annotationPrefix(level, budget) {
  if (!budget.line)
    return `::${level}::`;
  return `::${level} file=utils/check_orphan_processes.js,line=${budget.line},title=Orphan-process budget::`;
}

/**
 * Returns the set of pids that should be excluded from the orphan list because
 * they are the check process itself, its ancestors, or its descendants.
 *
 * We exclude descendants of the check process (e.g. `ps`/`powershell` it
 * spawned) and the chain of ancestor pids (node, shell, runner, ...). We do
 * NOT exclude descendants of ancestors: an orphan reparented to a
 * subreaper/init that happens to be an ancestor of the check script would be
 * a real leak we want to catch.
 *
 * @param {ProcessRecord[]} processes
 * @returns {Set<number>}
 */
function selfExclusionSet(processes) {
  const byPid = new Map(processes.map(p => [p.pid, p]));
  /** @type {Map<number, number[]>} */
  const childrenOf = new Map();
  for (const p of processes) {
    const arr = childrenOf.get(p.ppid) || [];
    arr.push(p.pid);
    childrenOf.set(p.ppid, arr);
  }

  const excluded = new Set();

  // Walk ancestors from our own pid up to (but not including) pid 1 / 0.
  let cur = process.pid;
  while (cur && cur !== 1 && byPid.has(cur)) {
    if (excluded.has(cur))
      break;
    excluded.add(cur);
    cur = byPid.get(cur).ppid;
  }

  // Walk descendants of our own pid (helper subprocesses we spawned for the
  // process listing, etc.). Start from process.pid only, not from ancestors,
  // to avoid masking orphans reparented to a shared subreaper.
  const queue = [process.pid];
  while (queue.length) {
    const pid = queue.shift();
    for (const childPid of childrenOf.get(pid) || []) {
      if (!excluded.has(childPid)) {
        excluded.add(childPid);
        queue.push(childPid);
      }
    }
  }

  return excluded;
}

function snapshot(file) {
  const processes = readProcesses();
  fs.writeFileSync(file, JSON.stringify(processes));
  console.log(`Snapshot written to ${file} (${processes.length} processes)`);
}

async function check(file, graceSeconds, budgetKey) {
  if (graceSeconds > 0) {
    console.log(`Waiting ${graceSeconds}s grace period for late teardown...`);
    await new Promise(resolve => setTimeout(resolve, graceSeconds * 1000));
  }

  /** @type {ProcessRecord[]} */
  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  const beforeIds = new Set(before.map(identity));

  const after = readProcesses();
  const excluded = selfExclusionSet(after);
  const budget = loadBudget(budgetKey);

  const newProcesses = after.filter(p => !beforeIds.has(identity(p)) && !excluded.has(p.pid));
  const realOrphans = newProcesses.filter(p => !isSystemProcess(p));
  const systemNoise = newProcesses.length - realOrphans.length;

  console.log(`Snapshot: ${before.length} processes. Now: ${after.length}. New: ${newProcesses.length} (${systemNoise} system, ${excluded.size} self-excluded).`);
  if (budgetKey)
    console.log(`Budget for job '${budgetKey}': ${budget.max} orphan(s) allowed${budget.reason ? ` (${budget.reason})` : ''}.`);

  if (realOrphans.length > budget.max) {
    console.log(`${annotationPrefix('error', budget)}Detected ${realOrphans.length} orphaned process(es) — over the budget of ${budget.max} for '${budgetKey || '<no budget key set>'}':`);
    for (const p of realOrphans)
      console.log(`  pid=${p.pid} ppid=${p.ppid} command=${p.command}`);
    console.log(`To raise the budget, edit JOB_BUDGETS in utils/check_orphan_processes.js (and document the leak). Better: fix the leak.`);
    process.exit(1);
  }

  if (realOrphans.length > 0) {
    console.log(`Detected ${realOrphans.length} orphaned process(es) — within the budget of ${budget.max}:`);
    for (const p of realOrphans)
      console.log(`  pid=${p.pid} ppid=${p.ppid} command=${p.command}`);
  }

  if (budget.max > 0 && realOrphans.length < budget.max) {
    console.log(`${annotationPrefix('notice', budget)}Orphan count (${realOrphans.length}) is below the budget (${budget.max}) for '${budgetKey}'. Lower JOB_BUDGETS in utils/check_orphan_processes.js to lock in the improvement.`);
  }
}

async function main() {
  const [, , mode, file, graceArg] = process.argv;
  if (!mode || !file) {
    console.error('Usage:');
    console.error('  node utils/check_orphan_processes.js snapshot <file>');
    console.error('  node utils/check_orphan_processes.js check <file> [graceSeconds]');
    console.error('');
    console.error('Set ORPHAN_PROCESS_BUDGET_KEY to look up a per-job budget in');
    console.error('JOB_BUDGETS at the top of this file (defaults to 0).');
    process.exit(2);
  }
  if (mode === 'snapshot') {
    snapshot(file);
  } else if (mode === 'check') {
    const grace = graceArg ? +graceArg : 5;
    if (isNaN(grace) || grace < 0)
      throw new Error(`Invalid graceSeconds: ${graceArg}`);
    const budgetKey = process.env.ORPHAN_PROCESS_BUDGET_KEY || '';
    await check(file, grace, budgetKey);
  } else {
    console.error(`Unknown mode: ${mode}`);
    process.exit(2);
  }
}

main().catch(err => {
  console.error(err.stack || err.message || err);
  process.exit(2);
});
