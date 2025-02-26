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
import { promisify } from 'util';

import { escapeRegExp } from 'playwright-core/lib/utils';
import { minimatch } from 'playwright-core/lib/utilsBundle';

import { createFileMatcher } from '../util';

import type { FullProjectInternal } from '../common/config';


const readFileAsync = promisify(fs.readFile);
const readDirAsync = promisify(fs.readdir);

function wildcardPatternToRegExp(pattern: string): RegExp {
  return new RegExp('^' + pattern.split('*').map(escapeRegExp).join('.*') + '$', 'ig');
}

export function filterProjects(projects: FullProjectInternal[], projectNames?: string[]): FullProjectInternal[] {
  if (!projectNames)
    return [...projects];

  const projectNamesToFind = new Set<string>();
  const unmatchedProjectNames = new Map<string, string>();
  const patterns = new Set<RegExp>();
  for (const name of projectNames!) {
    const lowerCaseName = name.toLocaleLowerCase();
    if (lowerCaseName.includes('*')) {
      patterns.add(wildcardPatternToRegExp(lowerCaseName));
    } else {
      projectNamesToFind.add(lowerCaseName);
      unmatchedProjectNames.set(lowerCaseName, name);
    }
  }

  const result = projects.filter(project => {
    const lowerCaseName = project.project.name.toLocaleLowerCase();
    if (projectNamesToFind.has(lowerCaseName)) {
      unmatchedProjectNames.delete(lowerCaseName);
      return true;
    }
    for (const regex of patterns) {
      regex.lastIndex = 0;
      if (regex.test(lowerCaseName))
        return true;
    }
    return false;
  });

  if (unmatchedProjectNames.size) {
    const unknownProjectNames = Array.from(unmatchedProjectNames.values()).map(n => `"${n}"`).join(', ');
    throw new Error(`Project(s) ${unknownProjectNames} not found. Available projects: ${projects.map(p => `"${p.project.name}"`).join(', ')}`);
  }

  if (!result.length) {
    const allProjects = projects.map(p => `"${p.project.name}"`).join(', ');
    throw new Error(`No projects matched. Available projects: ${allProjects}`);
  }


  return result;
}

export function buildTeardownToSetupsMap(projects: FullProjectInternal[]): Map<FullProjectInternal, FullProjectInternal[]> {
  const result = new Map<FullProjectInternal, FullProjectInternal[]>();
  for (const project of projects) {
    if (project.teardown) {
      const setups = result.get(project.teardown) || [];
      setups.push(project);
      result.set(project.teardown, setups);
    }
  }
  return result;
}

export function buildProjectsClosure(projects: FullProjectInternal[], hasTests?: (project: FullProjectInternal) => boolean): Map<FullProjectInternal, 'top-level' | 'dependency'> {
  const result = new Map<FullProjectInternal, 'top-level' | 'dependency'>();
  const visit = (depth: number, project: FullProjectInternal) => {
    if (depth > 100) {
      const error = new Error('Circular dependency detected between projects.');
      error.stack = '';
      throw error;
    }

    if (depth === 0 && hasTests && !hasTests(project))
      return;

    if (result.get(project) !== 'dependency')
      result.set(project, depth ? 'dependency' : 'top-level');

    for (const dep of project.deps)
      visit(depth + 1, dep);
    if (project.teardown)
      visit(depth + 1, project.teardown);
  };
  for (const p of projects)
    visit(0, p);
  return result;
}

export function buildDependentProjects(forProjects: FullProjectInternal[], projects: FullProjectInternal[]): Set<FullProjectInternal> {
  const reverseDeps = new Map<FullProjectInternal, FullProjectInternal[]>(projects.map(p => ([p, []])));
  for (const project of projects) {
    for (const dep of project.deps)
      reverseDeps.get(dep)!.push(project);
  }
  const result = new Set<FullProjectInternal>();
  const visit = (depth: number, project: FullProjectInternal) => {
    if (depth > 100) {
      const error = new Error('Circular dependency detected between projects.');
      error.stack = '';
      throw error;
    }
    result.add(project);
    for (const reverseDep of reverseDeps.get(project)!)
      visit(depth + 1, reverseDep);
    if (project.teardown)
      visit(depth + 1, project.teardown);
  };
  for (const forProject of forProjects)
    visit(0, forProject);
  return result;
}

export async function collectFilesForProject(project: FullProjectInternal, fsCache = new Map<string, string[]>()): Promise<string[]> {
  const extensions = new Set(['.js', '.ts', '.mjs', '.mts', '.cjs', '.cts', '.jsx', '.tsx', '.mjsx', '.mtsx', '.cjsx', '.ctsx']);
  const testFileExtension = (file: string) => extensions.has(path.extname(file));
  const allFiles = await cachedCollectFiles(project.project.testDir, project.respectGitIgnore, fsCache);
  const testMatch = createFileMatcher(project.project.testMatch);
  const testIgnore = createFileMatcher(project.project.testIgnore);
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
