import fs from 'node:fs';
import path from 'node:path';

export function extractProvenance(content, config = {}) {
  const prov = config?.provenance ?? {};
  const commitPattern = prov.commitPattern ?? 'Source Commit:\\s*`([a-f0-9]+)`';
  const datePattern = prov.datePattern ?? 'Commit Date:\\s*`([^`]+)`';

  const commitMatch = content.match(new RegExp(commitPattern, 'i'));
  const dateMatch = content.match(new RegExp(datePattern, 'i'));

  const result = {};
  if (commitMatch)
    result.commit = commitMatch[1];
  if (dateMatch)
    result.commit_date = dateMatch[1];
  return result;
}

export function readDocument(file, root) {
  const full = path.isAbsolute(file) ? file : path.join(root, file);
  const content = fs.readFileSync(full, 'utf8');
  return { full, content };
}
