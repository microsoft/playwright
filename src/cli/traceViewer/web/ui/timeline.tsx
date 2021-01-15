/*
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { ContextEntry } from '../../traceModel';
import './timeline.css';
import { FilmStrip } from './filmStrip';
import { Boundaries } from '../geometry';
import * as React from 'react';
import { useMeasure } from './helpers';
import { ActionEntry } from '../../traceModel';

export const Timeline: React.FunctionComponent<{
  context: ContextEntry,
  boundaries: Boundaries,
  selectedAction: ActionEntry | undefined,
  highlightedAction: ActionEntry | undefined,
  onSelected: (action: ActionEntry) => void,
  onHighlighted: (action: ActionEntry | undefined) => void,
}> = ({ context, boundaries, selectedAction, highlightedAction, onSelected, onHighlighted }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const [previewX, setPreviewX] = React.useState<number | undefined>();
  const targetAction = highlightedAction || selectedAction;

  const offsets = React.useMemo(() => {
    return calculateDividerOffsets(measure.width, boundaries);
  }, [measure.width, boundaries]);
  const actionEntries = React.useMemo(() => {
    const actions: ActionEntry[] = [];
    for (const page of context.pages)
      actions.push(...page.actions);
    return actions;
  }, [context]);
  const actionTimes = React.useMemo(() => {
    return actionEntries.map(entry => {
      return {
        entry,
        left: timeToPercent(measure.width, boundaries, entry.action.startTime!),
        right: timeToPercent(measure.width, boundaries, entry.action.endTime!),
      };
    });
  }, [actionEntries, boundaries, measure.width]);

  const findHoveredAction = (x: number) => {
    const time = positionToTime(measure.width, boundaries, x);
    const time1 = positionToTime(measure.width, boundaries, x - 5);
    const time2 = positionToTime(measure.width, boundaries, x + 5);
    let entry: ActionEntry | undefined;
    let distance: number | undefined;
    for (const e of actionEntries) {
      const left = Math.max(e.action.startTime!, time1);
      const right = Math.min(e.action.endTime!, time2);
      const middle = (e.action.startTime! + e.action.endTime!) / 2;
      const d = Math.abs(time - middle);
      if (left <= right && (!entry || d < distance!)) {
        entry = e;
        distance = d;
      }
    }
    return entry;
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (ref.current) {
      const x = event.clientX - ref.current.getBoundingClientRect().left;
      setPreviewX(x);
      onHighlighted(findHoveredAction(x));
    }
  };
  const onMouseLeave = () => {
    setPreviewX(undefined);
  };
  const onClick = (event: React.MouseEvent) => {
    if (ref.current) {
      const x = event.clientX - ref.current.getBoundingClientRect().left;
      const entry = findHoveredAction(x);
      if (entry)
        onSelected(entry);
    }
  };

  return <div ref={ref} className='timeline-view' onMouseMove={onMouseMove} onMouseOver={onMouseMove} onMouseLeave={onMouseLeave} onClick={onClick}>
    <div className='timeline-grid'>{
      offsets.map((offset, index) => {
        return <div key={index} className='timeline-divider' style={{ left: offset.percent + '%' }}>
          <div className='timeline-label'>{msToString(offset.time - boundaries.minimum)}</div>
        </div>;
      })
    }</div>
    <div className='timeline-lane timeline-action-labels'>{
      actionTimes.map(({ entry, left, right }) => {
        return <div key={entry.actionId}
          className={'timeline-action-label ' + entry.action.action + (targetAction === entry ? ' selected' : '')}
          style={{
            left: left + '%',
            width: (right - left) + '%',
          }}
        >
          {entry.action.action}
        </div>;
      })
    }</div>
    <div className='timeline-lane timeline-actions'>{
      actionTimes.map(({ entry, left, right }) => {
        return <div key={entry.actionId}
          className={'timeline-action ' + entry.action.action + (targetAction === entry ? ' selected' : '')}
          style={{
            left: left + '%',
            width: (right - left) + '%',
          }}
        ></div>;
      })
    }</div>
    <FilmStrip context={context} boundaries={boundaries} previewX={previewX} />
    <div className='timeline-time-bar timeline-time-bar-hover' style={{
      display: (previewX !== undefined) ? 'block' : 'none',
      left: (previewX || 0) + 'px',
    }}></div>
  </div>;
};

function calculateDividerOffsets(clientWidth: number, boundaries: Boundaries): { percent: number, time: number }[] {
  const minimumGap = 64;
  let dividerCount = clientWidth / minimumGap;
  const boundarySpan = boundaries.maximum - boundaries.minimum;
  const pixelsPerMillisecond = clientWidth / boundarySpan;
  let sectionTime = boundarySpan / dividerCount;

  const logSectionTime = Math.ceil(Math.log(sectionTime) / Math.LN10);
  sectionTime = Math.pow(10, logSectionTime);
  if (sectionTime * pixelsPerMillisecond >= 5 * minimumGap)
    sectionTime = sectionTime / 5;
  if (sectionTime * pixelsPerMillisecond >= 2 * minimumGap)
    sectionTime = sectionTime / 2;

  const firstDividerTime = boundaries.minimum;
  let lastDividerTime = boundaries.maximum;
  lastDividerTime += minimumGap / pixelsPerMillisecond;
  dividerCount = Math.ceil((lastDividerTime - firstDividerTime) / sectionTime);

  if (!sectionTime)
    dividerCount = 0;

  const offsets = [];
  for (let i = 0; i < dividerCount; ++i) {
    const time = firstDividerTime + sectionTime * i;
    offsets.push({ percent: timeToPercent(clientWidth, boundaries, time), time });
  }
  return offsets;
}

function timeToPercent(clientWidth: number, boundaries: Boundaries, time: number): number {
  const position = (time - boundaries.minimum) / (boundaries.maximum - boundaries.minimum) * clientWidth;
  return 100 * position / clientWidth;
}

function positionToTime(clientWidth: number, boundaries: Boundaries, x: number): number {
  const percent = x / clientWidth;
  return percent * (boundaries.maximum - boundaries.minimum) + boundaries.minimum;
}

function msToString(ms: number): string {
  if (!isFinite(ms))
    return '-';

  if (ms === 0)
    return '0';

  if (ms < 1000)
    return ms.toFixed(0) + 'ms';

  const seconds = ms / 1000;
  if (seconds < 60)
    return seconds.toFixed(1) + 's';

  const minutes = seconds / 60;
  if (minutes < 60)
    return minutes.toFixed(1) + 's';

  const hours = minutes / 60;
  if (hours < 24)
    return hours.toFixed(1) + 'h';

  const days = hours / 24;
  return days.toFixed(1) + 'h';
}
