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

import * as React from 'react';
import { coveragePercent, formatCoveragePercent } from '@isomorphic/istanbulCoverage';
import { toTitleCase } from '@isomorphic/stringUtils';
import { clsx, useAsyncMemo } from '@web/uiUtils';
import '../colors.css';
import '../common.css';
import './coverageView.css';
import * as icons from '../icons';
import { Link, useSearchParams } from '../links';
import { annotateCoverage, buildCoverageTree, coverageLevel } from './coverageModel';
import { coverageFileEntry } from './loadedCoverage';

import type { CoverageBranchMarker, CoverageLine, CoverageSegmentKind, CoverageTreeNode } from './coverageModel';
import type { LoadedCoverage } from './loadedCoverage';
import type { CoverageFile, CoverageFileSummary } from '../types';
import type { CoverageMetric, CoverageSummary } from '@isomorphic/istanbulCoverage';

export const kCoverageFileParam = 'coverageFile';

const kMetrics = ['statements', 'branches', 'functions', 'lines'] as const;

const kSegmentTitles: Record<CoverageSegmentKind, string> = {
  statement: 'statement not covered',
  function: 'function not called',
  branch: 'branch not taken',
};

const kMarkerTitles: Record<CoverageBranchMarker, string> = {
  I: 'if path not taken',
  E: 'else path not taken',
};

export const CoverageView: React.FC<{
  coverage: LoadedCoverage | undefined,
}> = ({ coverage }) => {
  const searchParams = useSearchParams();
  const fileId = searchParams.get(kCoverageFileParam);
  const report = coverage?.json();
  const file = React.useMemo(() => report?.files.find(f => f.fileId === fileId), [report, fileId]);
  const tree = React.useMemo(() => buildCoverageTree(report?.files || []), [report]);

  if (!coverage || !report)
    return null;
  if (file)
    return <CoverageFileView coverage={coverage} file={file} rootPath={tree.path} />;
  return <div className='coverage-view'>
    <CoverageSummaryView summary={report.summary} />
    <CoverageFilesView root={tree} />
  </div>;
};

export const CoverageSummaryView: React.FC<{
  summary: CoverageSummary,
}> = ({ summary }) => {
  return <div className='coverage-summary'>
    {kMetrics.map(name => {
      const metric = summary[name];
      return <div key={name} className={clsx('coverage-metric', 'coverage-' + coverageLevel(metric))} data-testid={`coverage-metric-${name}`}>
        <div className='coverage-metric-label'>{name}</div>
        <div>
          <span className='coverage-percent'>{formatCoveragePercent(metric)}</span>
          <span className='coverage-fraction'>{metric.covered}/{metric.total}</span>
        </div>
        <CoverageBar metric={metric} />
      </div>;
    })}
  </div>;
};

const CoverageBar: React.FC<{ metric: CoverageMetric }> = ({ metric }) => {
  return <div className='coverage-bar'>
    <div className='coverage-bar-fill' style={{ width: coveragePercent(metric) + '%' }}></div>
  </div>;
};

const CoverageCell: React.FC<{ metric: CoverageMetric }> = ({ metric }) => {
  return <td className={clsx('coverage-files-metric', 'coverage-' + coverageLevel(metric))}>
    <div className='coverage-cell'>
      <span className='coverage-percent'>{formatCoveragePercent(metric)}</span>
      <CoverageBar metric={metric} />
      <span className='coverage-fraction'>{metric.covered}/{metric.total}</span>
    </div>
  </td>;
};

export const CoverageFilesView: React.FC<{
  root: CoverageTreeNode,
}> = ({ root }) => {
  const searchParams = useSearchParams();
  const [filterText, setFilterText] = React.useState('');
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const filtered = React.useMemo(() => filterTree(root, filterText.trim().toLowerCase()), [root, filterText]);
  const toggle = React.useCallback((path: string) => setCollapsed(collapsed => {
    const next = new Set(collapsed);
    if (next.has(path))
      next.delete(path);
    else
      next.add(path);
    return next;
  }), []);

  const rows: React.JSX.Element[] = [];
  const visit = (node: CoverageTreeNode, depth: number) => {
    for (const child of node.children) {
      const isCollapsed = !filterText && collapsed.has(child.path);
      rows.push(<CoverageRow key={child.path} node={child} depth={depth} collapsed={isCollapsed} toggle={toggle} searchParams={searchParams} />);
      if (!child.fileId && !isCollapsed)
        visit(child, depth + 1);
    }
  };
  visit(filtered, 0);

  return <>
    <div className='coverage-toolbar'>
      <form className='subnav-search' onSubmit={e => e.preventDefault()}>
        {icons.search()}
        <input spellCheck={false} className='form-control subnav-search-input input-contrast width-full' aria-label='Filter files' placeholder='Filter files' value={filterText} onChange={e => setFilterText(e.target.value)}></input>
      </form>
      {root.path && <span className='coverage-root-path' title={root.path}>{root.path}</span>}
    </div>
    {rows.length ? <table className='coverage-files' data-testid='coverage-files'>
      <thead>
        <tr>
          <th>File</th>
          {kMetrics.map(name => <th key={name} className='coverage-files-metric'>{toTitleCase(name)}</th>)}
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table> : <div className='coverage-empty'>No files match the filter.</div>}
  </>;
};

const CoverageRow: React.FC<{
  node: CoverageTreeNode,
  depth: number,
  collapsed: boolean,
  toggle: (path: string) => void,
  searchParams: URLSearchParams,
}> = ({ node, depth, collapsed, toggle, searchParams }) => {
  const href = node.fileId ? coverageFileHref(searchParams, node.fileId) : undefined;
  return <tr data-testid={node.fileId ? 'coverage-file' : 'coverage-directory'}>
    <td className='coverage-files-name' style={{ paddingLeft: 8 + depth * 20 }}>
      {href ?
        <Link href={href} click={href} title={node.path}>{node.name}</Link> :
        <button type='button' className='coverage-files-toggle' aria-expanded={!collapsed} onClick={() => toggle(node.path)}>
          {collapsed ? icons.rightArrow() : icons.downArrow()}
          {node.name}
        </button>}
    </td>
    {kMetrics.map(name => <CoverageCell key={name} metric={node.summary[name]} />)}
  </tr>;
};

export const CoverageFileView: React.FC<{
  coverage: LoadedCoverage,
  file: CoverageFileSummary,
  rootPath: string,
}> = ({ coverage, file, rootPath }) => {
  const searchParams = useSearchParams();
  const content = useAsyncMemo(() => coverage.entry(coverageFileEntry(file.fileId)) as Promise<CoverageFile | undefined>, [coverage, file.fileId], undefined);
  const lines = React.useMemo(() => content ? annotateCoverage(content) : [], [content]);
  const relativePath = rootPath && file.path.startsWith(rootPath + '/') ? file.path.slice(rootPath.length + 1) : file.path;

  const listParams = new URLSearchParams(searchParams);
  listParams.delete(kCoverageFileParam);
  const listHref = '#?' + listParams.toString();

  return <div className='coverage-view'>
    <div className='coverage-breadcrumbs'>
      <Link href={listHref} click={listHref}>All files</Link>
      <span className='coverage-breadcrumbs-separator'>/</span>
      <span title={file.path}>{relativePath}</span>
    </div>
    <CoverageSummaryView summary={file.summary} />
    {content && !content.source && <div className='coverage-empty'>Source is not available for {file.path}.</div>}
    {content && content.source && <>
      <div className='coverage-legend'>
        {Object.entries(kSegmentTitles).map(([kind, title]) => <span key={kind} className={'coverage-segment-' + kind}>{title}</span>)}
        {Object.entries(kMarkerTitles).map(([marker, title]) => <span key={marker}><span className='coverage-branch-marker'>{marker}</span>{title}</span>)}
      </div>
      <div className='coverage-source' data-testid='coverage-source'>
        <table>
          <tbody>
            {lines.map(line => <CoverageLineView key={line.number} line={line} />)}
          </tbody>
        </table>
      </div>
    </>}
  </div>;
};

const CoverageLineView: React.FC<{ line: CoverageLine }> = ({ line }) => {
  const status = line.count === undefined ? 'neutral' : line.count > 0 ? 'covered' : 'uncovered';
  return <tr className={'coverage-line-' + status} data-line={line.number}>
    <td className='coverage-line-number'>{line.number}</td>
    <td className='coverage-line-count'>{line.count === undefined ? '' : line.count + 'x'}</td>
    <td className='coverage-line-code'>
      {line.markers.map((marker, index) => <span key={index} className='coverage-branch-marker' title={kMarkerTitles[marker]}>{marker}</span>)}
      {line.segments.map((segment, index) => segment.kinds.length ?
        <span key={index} className={segment.kinds.map(kind => 'coverage-segment-' + kind).join(' ')} title={segment.kinds.map(kind => kSegmentTitles[kind]).join(', ')}>{segment.text}</span> :
        <React.Fragment key={index}>{segment.text}</React.Fragment>)}
    </td>
  </tr>;
};

export function coverageFileHref(searchParams: URLSearchParams, fileId: string): string {
  const params = new URLSearchParams(searchParams);
  params.set(kCoverageFileParam, fileId);
  return '#?' + params.toString();
}

function filterTree(node: CoverageTreeNode, filter: string): CoverageTreeNode {
  if (!filter)
    return node;
  const children: CoverageTreeNode[] = [];
  for (const child of node.children) {
    if (child.fileId) {
      if (child.path.toLowerCase().includes(filter))
        children.push(child);
      continue;
    }
    const filtered = filterTree(child, filter);
    if (filtered.children.length)
      children.push(filtered);
  }
  return { ...node, children };
}
