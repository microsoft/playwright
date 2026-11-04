#!/usr/bin/env node
// Finds runtime dependencies that `npm audit` flags with a moderate or higher
// advisory, picks for each the newest safe version that was published at least
// --max-age-days ago and that every dependent in package-lock.json accepts, and
// (with --apply) rolls the lock file to it. Prints a markdown report of every
// package the lock file change touched, with publish date and weekly downloads.
//
//   node .claude/skills/playwright-audit-deps/audit-deps.mjs            # plan only
//   node .claude/skills/playwright-audit-deps/audit-deps.mjs --apply    # change package.json / package-lock.json
//
// Options:
//   --max-age-days=N   only pick versions published at least N days ago (default 8)
//   --base=REF         git ref to diff package-lock.json against for the report (default HEAD)
//   --allow-major      also roll root-pinned packages across a major version
//   --report=FILE      also write the markdown report to FILE
//   --severity=LEVEL   lowest severity to act on: low, moderate, high, critical (default moderate)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const semver = createRequire(path.join(root, 'package.json'))('semver');

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const apply = !!args.apply;
const maxAgeDays = Number(args['max-age-days'] ?? 8);
const baseRef = args.base ?? 'HEAD';
const allowMajor = !!args['allow-major'];
const severities = ['low', 'moderate', 'high', 'critical'];
const minSeverity = severities.indexOf(args.severity ?? 'moderate');
const cutoff = new Date(Date.now() - maxAgeDays * 24 * 3600 * 1000);

const lockPath = path.join(root, 'package-lock.json');
const lock = () => JSON.parse(fs.readFileSync(lockPath, 'utf8'));

// ---------- helpers ----------

function npm(argv) {
  try {
    return execFileSync('npm', argv, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
  } catch (e) {
    if (e.stdout)
      return e.stdout;
    throw e;
  }
}

const viewCache = new Map();
function view(spec) {
  if (!viewCache.has(spec))
    viewCache.set(spec, JSON.parse(npm(['view', spec, '--json'])));
  return viewCache.get(spec);
}

function publishTime(name, version) {
  return new Date(view(name).time[version]);
}

const downloadsCache = new Map();
async function downloads(name, version) {
  if (!downloadsCache.has(name)) {
    try {
      const res = await fetch(`https://api.npmjs.org/versions/${encodeURIComponent(name)}/last-week`);
      downloadsCache.set(name, (await res.json()).downloads ?? {});
    } catch {
      downloadsCache.set(name, {});
    }
  }
  return downloadsCache.get(name)[version];
}

function nameOf(nodePath) {
  return nodePath.slice(nodePath.lastIndexOf('node_modules/') + 'node_modules/'.length);
}

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

// ---------- what is runtime ----------

function bundleInlinedPaths() {
  const lines = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory())
        walk(p);
      else if (entry.name.endsWith('.js.txt'))
        lines.push(...fs.readFileSync(p, 'utf8').split('\n').map(l => l.trim().replace(/^[\d.]+ KB\s+/, '')).filter(l => l.startsWith('node_modules/')));
    }
  };
  for (const pkg of fs.readdirSync(path.join(root, 'packages'))) {
    const lib = path.join(root, 'packages', pkg, 'lib');
    if (fs.existsSync(lib))
      walk(lib);
  }
  if (!lines.length)
    throw new Error('No bundle reports under packages/*/lib. Run `npm run build` first.');
  return lines;
}

function workspaceRuntimeDeps() {
  const names = new Set();
  for (const pkg of fs.readdirSync(path.join(root, 'packages'))) {
    const file = path.join(root, 'packages', pkg, 'package.json');
    if (fs.existsSync(file))
      for (const name of Object.keys(JSON.parse(fs.readFileSync(file, 'utf8')).dependencies ?? {}))
        names.add(name);
  }
  return names;
}

// ---------- lock file constraints ----------

function resolveDep(packages, fromPath, name) {
  let base = fromPath;
  for (;;) {
    const candidate = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;
    if (packages[candidate])
      return candidate;
    if (!base)
      return null;
    const idx = base.lastIndexOf('/node_modules/');
    base = idx === -1 ? '' : base.slice(0, idx);
  }
}

function constraints(lockJson) {
  const map = new Map(); // nodePath -> [{ from, range }]
  for (const [from, entry] of Object.entries(lockJson.packages)) {
    if (entry.link)
      continue;
    const deps = { ...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies, ...(from === '' ? entry.devDependencies : {}) };
    for (const [name, range] of Object.entries(deps)) {
      const target = resolveDep(lockJson.packages, from, name);
      if (!target)
        continue;
      if (!map.has(target))
        map.set(target, []);
      map.get(target).push({ from, range });
    }
  }
  return map;
}

// ---------- version choice ----------

// A dependent that is not runtime does not block a roll: npm nests the old
// version under it, and that nested copy never reaches a bundle. A runtime
// dependent that rejects the new version would get such a nested copy too,
// and that one would be bundled, so it blocks.
function chooseVersion({ name, current, nodePath, badRanges, cons, isRuntime }) {
  const time = view(name).time;
  const rootPinned = cons.some(c => c.from === '');
  const others = cons.filter(c => c.from !== '' && (c.from.startsWith('packages/') || isRuntime(c.from)));
  const allowPrerelease = !!semver.prerelease(current);
  const candidates = Object.keys(time)
      .filter(v => semver.valid(v) && (allowPrerelease || !semver.prerelease(v)))
      .filter(v => semver.gt(v, current))
      .filter(v => !badRanges.some(r => semver.satisfies(v, r, { includePrerelease: true })));
  const oldEnough = candidates.filter(v => new Date(time[v]) <= cutoff);
  const accepted = oldEnough.filter(v => others.every(c => semver.satisfies(v, c.range, { includePrerelease: true })));
  const pick = accepted.sort(semver.rcompare)[0];
  if (!pick) {
    if (!candidates.length)
      return { reason: 'no fixed version published' };
    if (!oldEnough.length) {
      const soonest = candidates.sort((a, b) => new Date(time[a]) - new Date(time[b]))[0];
      return { reason: `fixed versions are newer than ${maxAgeDays} days (${soonest} on ${fmtDate(new Date(time[soonest]))})` };
    }
    const blockers = others.filter(c => !oldEnough.some(v => semver.satisfies(v, c.range, { includePrerelease: true })));
    return { reason: `blocked by ${blockers.map(c => `${c.from || 'package.json'} (${c.range})`).join(', ')}` };
  }
  const major = semver.major(pick) !== semver.major(current);
  if (rootPinned && major && !allowMajor)
    return { reason: `needs a major bump to ${pick} in package.json (rerun with --allow-major)`, version: pick };
  return { version: pick, rootPinned, major, nodePath };
}

// ---------- lock file edits ----------

function setLockVersion(nodePath, name, version) {
  const json = lock();
  const entry = json.packages[nodePath];
  const meta = view(`${name}@${version}`);
  const next = { version, resolved: meta.dist.tarball, integrity: meta.dist.integrity };
  for (const key of ['dev', 'optional', 'devOptional', 'peer', 'inBundle'])
    if (entry[key] !== undefined)
      next[key] = entry[key];
  if (meta.license)
    next.license = typeof meta.license === 'string' ? meta.license : meta.license.type;
  for (const key of ['dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta', 'bin', 'engines', 'os', 'cpu', 'funding', 'deprecated'])
    if (meta[key] !== undefined)
      next[key] = meta[key];
  if (meta.scripts && ['preinstall', 'install', 'postinstall'].some(s => meta.scripts[s]))
    next.hasInstallScript = true;
  json.packages[nodePath] = next;
  fs.writeFileSync(lockPath, JSON.stringify(json, null, 2) + '\n');
}

function lockDiff(baseJson, headJson) {
  const changes = [];
  const paths = new Set([...Object.keys(baseJson.packages), ...Object.keys(headJson.packages)]);
  for (const p of paths) {
    if (!p.includes('node_modules/'))
      continue;
    const before = baseJson.packages[p]?.version;
    const after = headJson.packages[p]?.version;
    if (before !== after)
      changes.push({ nodePath: p, name: nameOf(p), before, after });
  }
  return changes.sort((a, b) => a.nodePath.localeCompare(b.nodePath));
}

// Packages that `npm install` pulled in past the cutoff are rolled back to the
// newest version that is old enough and that every dependent accepts.
function checkInstalled(names) {
  const ls = JSON.parse(npm(['ls', '--json', ...names]));
  if (ls.problems?.length)
    throw new Error(`npm ls reports problems after the roll:\n${ls.problems.join('\n')}`);
}

function pinDownNewcomers(baseJson) {
  const json = lock();
  const cons = constraints(json);
  let changed = false;
  for (const { nodePath, name, before, after } of lockDiff(baseJson, json)) {
    if (!after || !semver.valid(after) || publishTime(name, after) <= cutoff)
      continue;
    const choice = chooseVersion({ name, current: before && semver.valid(before) ? before : '0.0.0', nodePath, badRanges: [], cons: (cons.get(nodePath) ?? []).filter(c => c.from !== ''), isRuntime: () => true });
    if (!choice.version || choice.version === after)
      continue;
    console.log(`  ${name}@${after} is newer than ${maxAgeDays} days, pinning ${nodePath} to ${choice.version}`);
    setLockVersion(nodePath, name, choice.version);
    changed = true;
  }
  return changed;
}

// ---------- main ----------

async function main() {
  const audit = JSON.parse(npm(['audit', '--json']));
  const inlined = bundleInlinedPaths();
  const workspaceDeps = workspaceRuntimeDeps();
  const isRuntime = nodePath => inlined.some(l => l.startsWith(nodePath + '/')) || (nodePath.split('node_modules/').length === 2 && workspaceDeps.has(nameOf(nodePath)));

  const lockJson = lock();
  const cons = constraints(lockJson);
  const plan = [];
  const skipped = [];
  for (const [name, vuln] of Object.entries(audit.vulnerabilities ?? {})) {
    const advisories = vuln.via.filter(v => typeof v === 'object' && v.name === name);
    if (!advisories.length)
      continue; // only affected through a dependency; that dependency has its own entry
    if (severities.indexOf(vuln.severity) < minSeverity) {
      skipped.push(`${name} (${vuln.severity})`);
      continue;
    }
    for (const nodePath of vuln.nodes) {
      if (!isRuntime(nodePath)) {
        skipped.push(`${nodePath} (not in a runtime bundle)`);
        continue;
      }
      const current = lockJson.packages[nodePath].version;
      const choice = chooseVersion({ name, current, nodePath, badRanges: advisories.map(a => a.range), cons: cons.get(nodePath) ?? [], isRuntime });
      plan.push({ name, nodePath, current, severity: vuln.severity, advisories: advisories.map(a => a.url.replace('https://github.com/advisories/', '')), ...choice });
    }
  }

  console.log(`\n## Runtime advisories (${args.severity ?? 'moderate'} and above), versions published on or before ${fmtDate(cutoff)}\n`);
  for (const p of plan)
    console.log(`- ${p.nodePath} ${p.current} [${p.severity}, ${p.advisories.join(' ')}]: ${p.version && !p.reason ? `roll to ${p.version}${p.major ? ' (major)' : ''}` : `not rolled: ${p.reason}`}`);
  if (!plan.length)
    console.log('- none');
  if (skipped.length)
    console.log(`\nSkipped: ${skipped.join(', ')}`);

  const actionable = plan.filter(p => p.version && !p.reason);
  if (!apply) {
    if (actionable.length)
      console.log('\nRerun with --apply to change package.json / package-lock.json.');
    return;
  }

  const baseJson = JSON.parse(execFileSync('git', ['show', `${baseRef}:package-lock.json`], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }));
  console.log('');
  for (const p of actionable) {
    console.log(`Rolling ${p.nodePath} ${p.current} -> ${p.version}`);
    if (p.rootPinned)
      npm(['install', `${p.name}@${p.version}`, '--save-exact', '--no-audit', '--no-fund']);
    else
      setLockVersion(p.nodePath, p.name, p.version);
  }
  for (let round = 0; round < 5; round++) {
    npm(['install', '--no-audit', '--no-fund']);
    if (!pinDownNewcomers(baseJson))
      break;
  }
  checkInstalled(actionable.map(p => p.name));

  const final = lock();
  const changes = lockDiff(baseJson, final);
  const byPath = new Map(plan.map(p => [p.nodePath, p]));
  // One row per (package, old, new); nested copies of the same roll are counted.
  const grouped = new Map();
  for (const c of changes) {
    const key = `${c.name} ${c.before} ${c.after}`;
    if (!grouped.has(key))
      grouped.set(key, { ...c, nested: 0 });
    const g = grouped.get(key);
    const isNested = c.nodePath.split('node_modules/').length > 2;
    if (isNested)
      g.nested++;
    else
      g.nodePath = c.nodePath;
    if (byPath.get(c.nodePath))
      g.plan = byPath.get(c.nodePath);
  }
  const rows = [];
  for (const c of [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name))) {
    const why = c.plan ? `${c.plan.severity}: ${c.plan.advisories.join(', ')}` : 'dependency';
    const dl = c.after ? await downloads(c.name, c.after) : undefined;
    const date = c.after && semver.valid(c.after) ? fmtDate(publishTime(c.name, c.after)) : '';
    const where = c.nested ? ` (${c.nested} nested cop${c.nested === 1 ? 'y' : 'ies'})` : '';
    rows.push(`| ${c.name}${where} | ${c.before ?? '-'} | ${c.after ?? '-'} | ${date} | ${dl?.toLocaleString('en-US') ?? ''} | ${why} |`);
  }
  const notRolled = plan.filter(p => p.reason).map(p => `- ${p.name} ${p.current} (${p.severity}, ${p.advisories.join(', ')}): ${p.reason}`);
  const report = [
    `| Package | Old | New | Published | Downloads, last 7 days | Reason |`,
    `|---|---|---|---|---|---|`,
    ...rows,
    ...(notRolled.length ? ['', 'Not rolled:', ...notRolled] : []),
  ].join('\n');
  console.log('\n' + report + '\n');
  if (args.report)
    fs.writeFileSync(args.report, report + '\n');
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
