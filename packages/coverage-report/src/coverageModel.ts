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

import { addCoverageSummary, coveragePercent, emptyCoverageSummary, lineCoverage } from '@isomorphic/istanbulCoverage';

import type { CoverageFile, CoverageFileSummary, CoverageMetric, CoverageSummary, IstanbulRange } from '@isomorphic/istanbulCoverage';

export type CoverageTreeNode = {
  name: string;
  path: string;
  fileId?: string;
  summary: CoverageSummary;
  children: CoverageTreeNode[];
};

export type CoverageLevel = 'high' | 'medium' | 'low';

// Same thresholds as nyc.
export function coverageLevel(metric: CoverageMetric): CoverageLevel {
  const percent = coveragePercent(metric);
  if (percent >= 80)
    return 'high';
  if (percent >= 50)
    return 'medium';
  return 'low';
}

// File paths are posix, the reporter normalizes them.
export function buildCoverageTree(files: CoverageFileSummary[]): CoverageTreeNode {
  const entries = files.map(file => ({ file, segments: file.path.split('/').filter(Boolean) }));
  let rootSegments = entries.length ? entries[0].segments.slice(0, -1) : [];
  for (const { segments } of entries) {
    let i = 0;
    while (i < rootSegments.length && i < segments.length - 1 && rootSegments[i] === segments[i])
      ++i;
    rootSegments = rootSegments.slice(0, i);
  }

  const absolute = entries.length > 0 && entries.every(({ file }) => file.path.startsWith('/'));
  const root: CoverageTreeNode = { name: '', path: (absolute ? '/' : '') + rootSegments.join('/'), summary: emptyCoverageSummary(), children: [] };
  const directories = new Map<string, CoverageTreeNode>();
  for (const { file, segments } of entries) {
    let node = root;
    const relative = segments.slice(rootSegments.length);
    for (let i = 0; i < relative.length - 1; i++) {
      const dirPath = relative.slice(0, i + 1).join('/');
      let child = directories.get(dirPath);
      if (!child) {
        child = { name: relative[i], path: dirPath, summary: emptyCoverageSummary(), children: [] };
        directories.set(dirPath, child);
        node.children.push(child);
      }
      node = child;
    }
    node.children.push({ name: relative[relative.length - 1], path: relative.join('/'), fileId: file.fileId, summary: file.summary, children: [] });
  }
  finalizeNode(root);
  return root;
}

function finalizeNode(node: CoverageTreeNode) {
  for (const child of node.children) {
    if (!child.fileId) {
      // Collapse chains of single-directory folders.
      while (child.children.length === 1 && !child.children[0].fileId) {
        const only = child.children[0];
        child.name = child.name + '/' + only.name;
        child.path = only.path;
        child.children = only.children;
      }
      finalizeNode(child);
    }
    addCoverageSummary(node.summary, child.summary);
  }
  node.children.sort((a, b) => {
    if (!!a.fileId !== !!b.fileId)
      return a.fileId ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export type CoverageSegmentKind = 'statement' | 'function' | 'branch';

export type CoverageSegment = {
  text: string;
  kinds: CoverageSegmentKind[];
};

// 'I' - the if path was not taken, 'E' - the else path was not taken.
export type CoverageBranchMarker = 'I' | 'E';

export type CoverageLine = {
  number: number;
  count?: number;
  segments: CoverageSegment[];
  markers: CoverageBranchMarker[];
};

type Mark = { start: number, end: number, kind: CoverageSegmentKind };

export function annotateCoverage(file: CoverageFile): CoverageLine[] {
  const source = file.source ?? '';
  const textLines = source.split(/\r\n|\r|\n/);
  if (textLines.length > 1 && textLines[textLines.length - 1] === '')
    textLines.pop();
  const { coverage } = file;
  const marksByLine = new Map<number, Mark[]>();
  const markers = new Map<number, CoverageBranchMarker[]>();

  const addRange = (range: IstanbulRange, kind: CoverageSegmentKind) => {
    if (!range?.start || range.start.line === undefined)
      return;
    const endLine = range.end?.line ?? range.start.line;
    for (let line = range.start.line; line <= endLine; line++) {
      const text = textLines[line - 1];
      if (text === undefined)
        break;
      const start = line === range.start.line ? range.start.column : 0;
      const end = line === endLine ? Math.min(range.end?.column ?? text.length, text.length) : text.length;
      if (start >= end)
        continue;
      const marks = marksByLine.get(line) || [];
      marks.push({ start, end, kind });
      marksByLine.set(line, marks);
    }
  };

  for (const [key, range] of Object.entries(coverage.statementMap)) {
    if (!coverage.s[key])
      addRange(range, 'statement');
  }
  for (const [key, fn] of Object.entries(coverage.fnMap)) {
    if (!coverage.f[key])
      addRange(fn.decl, 'function');
  }
  for (const [key, branch] of Object.entries(coverage.branchMap)) {
    const counts = coverage.b[key] || [];
    branch.locations.forEach((location, i) => {
      if (counts[i])
        return;
      const implicit = !location?.start || location.start.line === undefined;
      if (branch.type === 'if' || implicit) {
        const line = branch.loc.start.line;
        const list = markers.get(line) || [];
        list.push(branch.type === 'if' && i === 0 ? 'I' : 'E');
        markers.set(line, list);
        return;
      }
      addRange(location, 'branch');
    });
  }

  const counts = lineCoverage(coverage);
  return textLines.map((text, index) => {
    const number = index + 1;
    return {
      number,
      count: counts.get(number),
      segments: splitLine(text, marksByLine.get(number) || []),
      markers: markers.get(number) || [],
    };
  });
}

function splitLine(text: string, marks: Mark[]): CoverageSegment[] {
  if (!marks.length)
    return [{ text, kinds: [] }];
  const boundaries = new Set<number>([0, text.length]);
  for (const mark of marks) {
    boundaries.add(mark.start);
    boundaries.add(mark.end);
  }
  const points = [...boundaries].sort((a, b) => a - b);
  const segments: CoverageSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [start, end] = [points[i], points[i + 1]];
    const kinds = new Set<CoverageSegmentKind>();
    for (const mark of marks) {
      if (mark.start <= start && mark.end >= end)
        kinds.add(mark.kind);
    }
    segments.push({ text: text.slice(start, end), kinds: [...kinds] });
  }
  return segments;
}
