import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_CONFIG = {
  project: null,
  documents: ['NOTES.md', 'API_REFERENCE.md'],
  examples: ['examples/*.js'],
  output: 'DOC_GRAPH.json',
  excerptLines: 80,
  maxExcerptLines: 200,
  provenance: {
    commitPattern: 'Source Commit:\\s*`([a-f0-9]+)`',
    datePattern: 'Commit Date:\\s*`([^`]+)`',
  },
};

export function defaultProjectName(root, { basename = null, dirname = null } = {}) {
  return basename ?? dirname ?? root;
}

export function mergeConfig(base, override) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(override ?? {})) {
    if (value === undefined)
      continue;
    if (key === 'provenance' && value && typeof value === 'object') {
      merged.provenance = { ...base.provenance, ...value };
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

export function findConfigFile(root, explicitPath = undefined) {
  if (explicitPath) {
    const full = path.isAbsolute(explicitPath) ? explicitPath : path.join(root, explicitPath);
    if (!fs.existsSync(full))
      throw new Error(`Config file not found: ${full}`);
    return full;
  }
  for (const name of ['doc-graph.config.mjs', 'doc-graph.config.js', 'doc-graph.config.json']) {
    const full = path.join(root, name);
    if (fs.existsSync(full))
      return full;
  }
  return null;
}

export async function loadConfig(root, explicitPath = undefined) {
  const file = findConfigFile(root, explicitPath);
  if (!file)
    return { config: { ...DEFAULT_CONFIG }, file: null };
  let raw;
  if (file.endsWith('.json')) {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    const mod = await import(pathToFileURL(file).href);
    raw = mod.default ?? mod;
  }
  return { config: raw, file };
}

export function resolveConfig(root, configFile, overrides = {}) {
  const base = { ...DEFAULT_CONFIG };
  const fromFile = configFile ?? {};
  const merged = mergeConfig(mergeConfig(base, fromFile), overrides);
  const projectName = merged.project ?? path.basename(path.resolve(root));
  return { ...merged, project: projectName };
}

