import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', '.hg', '.svn']);

function isHidden(name) {
  return name.startsWith('.');
}

function listEntries(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter(entry => !isHidden(entry.name) && !SKIP_DIRS.has(entry.name));
}

function segmentToRegex(segment) {
  let out = '^';
  for (const ch of segment) {
    if (ch === '*')
      out += '[^/]*';
    else if (ch === '?')
      out += '[^/]';
    else
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`${out}$`);
}

function collectFiles(dir, results) {
  for (const entry of listEntries(dir)) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())
      collectFiles(full, results);
    else if (entry.isFile())
      results.push(full);
  }
}

function walk(dir, segments, index, results, root) {
  if (index >= segments.length)
    return;
  const segment = segments[index];
  if (segment === '**') {
    if (index === segments.length - 1) {
      collectFiles(dir, results);
      return;
    }
    // Match zero directories.
    walk(dir, segments, index + 1, results, root);
    // Match one or more directories.
    for (const entry of listEntries(dir)) {
      if (entry.isDirectory())
        walk(path.join(dir, entry.name), segments, index, results, root);
    }
    return;
  }

  const regex = segmentToRegex(segment);
  const isLast = index === segments.length - 1;
  for (const entry of listEntries(dir)) {
    if (!regex.test(entry.name))
      continue;
    const full = path.join(dir, entry.name);
    if (isLast) {
      if (entry.isFile())
        results.push(full);
    } else if (entry.isDirectory()) {
      walk(full, segments, index + 1, results, root);
    }
  }
}

export function glob(pattern, root) {
  const normalized = pattern.replace(/\\/g, '/').replace(/^\.\//, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0)
    return [];
  const results = [];
  walk(path.resolve(root), segments, 0, results, root);
  const rel = results
    .map(full => path.relative(root, full).split(path.sep).join('/'))
    .filter(p => !p.startsWith('..'));
  return [...new Set(rel)].sort();
}

export function hasMagic(pattern) {
  return /[*?]/.test(pattern);
}
