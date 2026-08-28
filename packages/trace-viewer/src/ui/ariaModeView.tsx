/**
 * Copyright (c) Microsoft Corporation.
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

import './ariaModeView.css';
import * as React from 'react';
import { nextActionByStartTime, previousActionByEndTime } from '@isomorphic/trace/traceModel';
import { renderAriaSnapshotAsYaml } from '@isomorphic/ariaSnapshotRenderer';
import { clsx, useMeasure } from '@web/uiUtils';
import { PlaceholderPanel } from './placeholderPanel';

import type { ActionPhase, ActionTraceEvent, ScreenshotTraceEvent } from '@isomorphic/trace/trace';
import type { AriaNodeJSON, AriaSnapshotJSON } from '@isomorphic/ariaSnapshot';
import type { TraceModel } from '@isomorphic/trace/traceModel';

export type AriaModeTarget = {
  callId: string;
  phase: ActionPhase;
};

export type AriaModeTargets = {
  action?: AriaModeTarget;
  before?: AriaModeTarget;
  after?: AriaModeTarget;
};

export function canToggleAriaMode(model: TraceModel | undefined): boolean {
  return !!model?.hasDomSnapshots && !!model?.hasAriaSnapshots;
}

export function shouldDisplayAriaMode(model: TraceModel | undefined, setting: boolean): boolean {
  return canToggleAriaMode(model) ? setting : !!model?.hasAriaSnapshots;
}

// Mirrors the fallback logic in collectSnapshots(), but for screenshot / aria-snapshot events.
export function collectAriaModeTargets(model: TraceModel, action: ActionTraceEvent | undefined): AriaModeTargets {
  if (!action)
    return {};

  const hasArtifacts = (callId: string, phase: ActionPhase) => !!model.screenshotForCall(callId, phase) || !!model.ariaSnapshotForCall(callId, phase);

  let before: AriaModeTarget | undefined = hasArtifacts(action.callId, 'before') ? { callId: action.callId, phase: 'before' } : undefined;
  if (!before) {
    // If the action has no "before" artifacts, use the last available "after" ones.
    for (let a = previousActionByEndTime(action); a; a = previousActionByEndTime(a)) {
      if (a.endTime <= action.startTime && hasArtifacts(a.callId, 'after')) {
        before = { callId: a.callId, phase: 'after' };
        break;
      }
    }
  }

  let after: AriaModeTarget | undefined = hasArtifacts(action.callId, 'after') ? { callId: action.callId, phase: 'after' } : undefined;
  if (!after) {
    // For test.step and other actions without own artifacts, use the last nested
    // or overlapping action, and fall back to the "before" artifacts.
    let last: ActionTraceEvent | undefined;
    for (let a = nextActionByStartTime(action); a && a.startTime <= action.endTime; a = nextActionByStartTime(a)) {
      if (a.endTime > action.endTime || !hasArtifacts(a.callId, 'after'))
        continue;
      if (last && last.endTime > a.endTime)
        continue;
      last = a;
    }
    after = last ? { callId: last.callId, phase: 'after' } : before;
  }

  const actionTarget: AriaModeTarget | undefined = hasArtifacts(action.callId, 'action') ? { callId: action.callId, phase: 'action' } : after;
  return { action: actionTarget, before, after };
}

type Point = { x: number, y: number };
type Box = { x: number, y: number, width: number, height: number };

type AriaSnapshotLine = {
  text: string;
  box?: Box;
};

function buildAriaSnapshotLines(snapshot: AriaSnapshotJSON): AriaSnapshotLine[] {
  // Take the boxes aside so they are not rendered as [box=...] attributes in the yaml,
  // translating iframe-relative coordinates into the main page coordinates along the way.
  const boxes = new Map<AriaNodeJSON, Box>();
  const extractBoxes = (node: AriaNodeJSON | string, offset: { x: number, y: number }) => {
    if (typeof node === 'string')
      return;
    if (node.box)
      boxes.set(node, { ...node.box, x: node.box.x + offset.x, y: node.box.y + offset.y });
    const childOffset = node.role === 'iframe' && node.box ? { x: offset.x + node.box.x, y: offset.y + node.box.y } : offset;
    for (const child of node.children || [])
      extractBoxes(child, childOffset);
    delete node.box;
  };
  for (const node of snapshot)
    extractBoxes(node, { x: 0, y: 0 });

  const lineToNode = new Map<number, AriaNodeJSON>();
  const text = renderAriaSnapshotAsYaml(snapshot, { lineToNode });
  return text.split('\n').map((line, index) => {
    const node = lineToNode.get(index);
    return { text: line, box: node ? boxes.get(node) : undefined };
  });
}

const tokenRegex = /("(?:[^"\\]|\\.)*")|(\/(?:[^/\\]|\\.)*\/)|(\[[^\]]*\])/g;

function renderLineTokens(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const roleMatch = text.match(/^(\s*- )([\w-]+)/);
  let prefixLength = 0;
  if (roleMatch) {
    result.push(roleMatch[1]);
    result.push(<span key='role' className='aria-mode-role'>{roleMatch[2]}</span>);
    prefixLength = roleMatch[0].length;
  }
  const rest = text.substring(prefixLength);
  let lastIndex = 0;
  let key = 0;
  for (const match of rest.matchAll(tokenRegex)) {
    if (match.index! > lastIndex)
      result.push(rest.substring(lastIndex, match.index));
    result.push(<span key={++key} className={match[3] ? 'aria-mode-attribute' : 'aria-mode-string'}>{match[0]}</span>);
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < rest.length)
    result.push(rest.substring(lastIndex));
  return result;
}

export const AriaModeView: React.FunctionComponent<{
  model: TraceModel | undefined,
  target: AriaModeTarget | undefined,
  point?: Point,
  box?: Box,
}> = ({ model, target, point, box }) => {
  const screenshot = model && target ? model.screenshotForCall(target.callId, target.phase) : undefined;
  const ariaSnapshot = model && target ? model.ariaSnapshotForCall(target.callId, target.phase) : undefined;
  const [lines, setLines] = React.useState<AriaSnapshotLine[]>([]);
  const [highlightedBox, setHighlightedBox] = React.useState<Box | undefined>();

  React.useEffect(() => {
    setHighlightedBox(undefined);
    if (!model || !ariaSnapshot) {
      setLines([]);
      return;
    }
    let cancelled = false;
    fetch(model.createRelativeUrl(`file/${ariaSnapshot.file}`))
        .then(response => response.json())
        .then(json => {
          if (!cancelled)
            setLines(buildAriaSnapshotLines(json));
        })
        .catch(() => {
          if (!cancelled)
            setLines([]);
        });
    return () => {
      cancelled = true;
    };
  }, [model, ariaSnapshot]);

  if (!screenshot && !ariaSnapshot)
    return <PlaceholderPanel text='No aria snapshot' />;

  return <div className='aria-mode-view hbox'>
    <AriaModeScreenshot model={model!} screenshot={screenshot} highlightedBox={highlightedBox} point={point} box={box} />
    <div className='aria-mode-snapshot vbox'>
      {ariaSnapshot && <div className='aria-mode-lines' onMouseLeave={() => setHighlightedBox(undefined)}>
        {lines.map((line, index) => <div
          key={index}
          className={clsx('aria-mode-line', line.box && 'aria-mode-line-hoverable')}
          onMouseEnter={() => setHighlightedBox(line.box)}
        >{renderLineTokens(line.text)}</div>)}
      </div>}
      {!ariaSnapshot && <PlaceholderPanel text='No aria snapshot' />}
    </div>
  </div>;
};

const AriaModeScreenshot: React.FunctionComponent<{
  model: TraceModel,
  screenshot: ScreenshotTraceEvent | undefined,
  highlightedBox: Box | undefined,
  point: Point | undefined,
  box: Box | undefined,
}> = ({ model, screenshot, highlightedBox, point, box }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const [naturalSize, setNaturalSize] = React.useState<{ width: number, height: number } | undefined>();

  // Trace screenshots are taken with css scale, so image pixels match the aria box viewport
  // coordinates. The image is scaled to fit into the available area, scale the boxes and
  // the action point to match the rendered image.
  let overlays: React.ReactNode;
  if (screenshot && naturalSize && measure.width) {
    const padding = 10;
    const availableWidth = measure.width - 2 * padding;
    const availableHeight = measure.height - 2 * padding;
    const scale = Math.min(availableWidth / naturalSize.width, availableHeight / naturalSize.height, 1);
    const offsetX = padding + (availableWidth - naturalSize.width * scale) / 2;
    const offsetY = padding + (availableHeight - naturalSize.height * scale) / 2;
    const boxStyle = (b: Box): React.CSSProperties => ({
      left: offsetX + b.x * scale + 'px',
      top: offsetY + b.y * scale + 'px',
      width: b.width * scale + 'px',
      height: b.height * scale + 'px',
    });
    const pointStyle = (p: Point): React.CSSProperties => ({
      left: offsetX + p.x * scale + 'px',
      top: offsetY + p.y * scale + 'px',
      width: 20 * scale + 'px',
      height: 20 * scale + 'px',
    });
    overlays = <>
      {box && <div className='aria-mode-action-highlight' style={boxStyle(box)} />}
      {point && <div className='aria-mode-action-point' style={pointStyle(point)} />}
      {highlightedBox && <div className='aria-mode-highlight' style={boxStyle(highlightedBox)} />}
    </>;
  }

  return <div ref={ref} className='aria-mode-screenshot'>
    {screenshot && <img
      key={screenshot.file}
      src={model.createRelativeUrl(`file/${screenshot.file}`)}
      alt='Screenshot'
      onLoad={event => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
    />}
    {!screenshot && <PlaceholderPanel text='No screenshot' />}
    {overlays}
  </div>;
};
