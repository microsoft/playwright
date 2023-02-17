/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';
import { minimatch } from 'playwright-core/lib/utilsBundle';
import { promisify } from 'util';
import type { FullProjectInternal } from '../common/types';
import { createFileMatcher } from '../util';

const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);

export function filterProjects(projects: FullProjectInternal[], projectNames?: string[]): FullProjectInternal[] {
  if (!projectNames)
    return [...projects];
  const projectsToFind = new Set<string>();
  const unknownProjects = new Map<string, string>();
  projectNames.forEach(n => {
    const name = n.toLocaleLowerCase();
    projectsToFind.add(name);
    unknownProjects.set(name, n);
  });
  const result = projects.filter(project => {
    const name = project.name.toLocaleLowerCase();
    unknownProjects.delete(name);
    return projectsToFind.has(name);
  });
  if (unknownProjects.size) {
    const names = projects.map(p => p.name).filter(name => !!name);
    if (!names.length)
      throw new Error(`No named projects are specified in the configuration file`);
    const unknownProjectNames = Array.from(unknownProjects.values()).map(n => `"${n}"`).join(', ');
    throw new Error(`Project(s) ${unknownProjectNames} not found. Available named projects: ${names.map(name => `"${name}"`).join(', ')}`);
  }
  return result;
}

export function buildProjectsClosure(projects: FullProjectInternal[]): FullProjectInternal[] {
  const result = new Set<FullProjectInternal>();
  const visit = (depth: number, project: FullProjectInternal) => {
    if (depth > 100) {
      const error = new Error('Circular dependency detected between projects.');
      error.stack = '';
      throw error;
    }
    if (depth)
      project._internal.type = 'dependency';
    result.add(project);
    project._internal.deps.map(visit.bind(undefined, depth + 1));
  };
  for (const p of projects)
    p._internal.type = 'top-level';
  for (const p of projects)
    visit(0, p);
  return [...result];
}

export async function collectFilesForProject(project: FullProjectInternal, fsCache = new Map<string, string[]>()): Promise<string[]> {
  const extensions = ['.js', '.ts', '.mjs', '.tsx', '.jsx'];
  const testFileExtension = (file: string) => extensions.includes(path.extname(file));
  const allFiles = await cachedCollectFiles(project.testDir, project._internal.respectGitIgnore, fsCache);
  const testMatch = createFileMatcher(project.testMatch);
  const testIgnore = createFileMatcher(project.testIgnore);
  const testFiles = allFiles.filter(file => {
    if (!testFileExtension(file))
      return false;
    const isTest = !testIgnore(file) && testMatch(file);
    if (!isTest)
      return false;
    return true;
  });
  return testFiles;
}

async function cachedCollectFiles(testDir: string, respectGitIgnore: boolean, fsCache: Map<string, string[]>) {
  const key = testDir + ':' + respectGitIgnore;
  let result = fsCache.get(key);
  if (!result) {
    result = await collectFiles(testDir, respectGitIgnore);
    fsCache.set(key, result);
  }
  return result;
}

async function collectFiles(testDir: string, respectGitIgnore: boolean): Promise<string[]> {
  if (!fs.existsSync(testDir))
    return [];
  if (!fs.statSync(testDir).isDirectory())
    return [];

  type Rule = {
    dir: string;
    negate: boolean;
    match: (s: string, partial?: boolean) => boolean
  };
  type IgnoreStatus = 'ignored' | 'included' | 'ignored-but-recurse';

  const checkIgnores = (entryPath: string, rules: Rule[], isDirectory: boolean, parentStatus: IgnoreStatus) => {
    let status = parentStatus;
    for (const rule of rules) {
      const ruleIncludes = rule.negate;
      if ((status === 'included') === ruleIncludes)
        continue;
      const relative = path.relative(rule.dir, entryPath);
      if (rule.match('/' + relative) || rule.match(relative)) {
        // Matches "/dir/file" or "dir/file"
        status = ruleIncludes ? 'included' : 'ignored';
      } else if (isDirectory && (rule.match('/' + relative + '/') || rule.match(relative + '/'))) {
        // Matches "/dir/subdir/" or "dir/subdir/" for directories.
        status = ruleIncludes ? 'included' : 'ignored';
      } else if (isDirectory && ruleIncludes && (rule.match('/' + relative, true) || rule.match(relative, true))) {
        // Matches "/dir/donotskip/" when "/dir" is excluded, but "!/dir/donotskip/file" is included.
        status = 'ignored-but-recurse';
      }
    }
    return status;
  };

  const files: string[] = [];

  const visit = async (dir: string, rules: Rule[], status: IgnoreStatus) => {
    const entries = await readDirAsync(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    if (respectGitIgnore) {
      const gitignore = entries.find(e => e.isFile() && e.name === '.gitignore');
      if (gitignore) {
        const content = await readFileAsync(path.join(dir, gitignore.name), 'utf8');
        const newRules: Rule[] = content.split(/\r?\n/).map(s => {
          s = s.trim();
          if (!s)
            return;
          // Use flipNegate, because we handle negation ourselves.
          const rule = new minimatch.Minimatch(s, { matchBase: true, dot: true, flipNegate: true }) as any;
          if (rule.comment)
            return;
          rule.dir = dir;
          return rule;
        }).filter(rule => !!rule);
        rules = [...rules, ...newRules];
      }
    }

    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..')
        continue;
      if (entry.isFile() && entry.name === '.gitignore')
        continue;
      if (entry.isDirectory() && entry.name === 'node_modules')
        continue;
      const entryPath = path.join(dir, entry.name);
      const entryStatus = checkIgnores(entryPath, rules, entry.isDirectory(), status);
      if (entry.isDirectory() && entryStatus !== 'ignored')
        await visit(entryPath, rules, entryStatus);
      else if (entry.isFile() && entryStatus === 'included')
        files.push(entryPath);
    }
  };
  await visit(testDir, [], 'included');
  return files;
}
