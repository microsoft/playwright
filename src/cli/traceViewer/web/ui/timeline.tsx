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

import { ContextEntry, InterestingPageEvent, ActionEntry, trace } from '../../traceModel';
import './timeline.css';
import { Boundaries } from '../geometry';
import * as React from 'react';
import { useMeasure } from './helpers';

type TimelineBar = {
  entry?: ActionEntry;
  event?: InterestingPageEvent;
  leftPosition: number;
  rightPosition: number;
  leftTime: number;
  rightTime: number;
  type: string;
  label: string;
  priority: number;
};

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
  const [hoveredBar, setHoveredBar] = React.useState<TimelineBar | undefined>();

  const offsets = React.useMemo(() => {
    return calculateDividerOffsets(measure.width, boundaries);
  }, [measure.width, boundaries]);

  let targetBar: TimelineBar | undefined = hoveredBar;
  const bars = React.useMemo(() => {
    const bars: TimelineBar[] = [];
    for (const page of context.pages) {
      for (const entry of page.actions) {
        let detail = entry.action.selector || '';
        if (entry.action.action === 'goto')
          detail = entry.action.value || '';
        bars.push({
          entry,
          leftTime: entry.action.startTime,
          rightTime: entry.action.endTime,
          leftPosition: timeToPosition(measure.width, boundaries, entry.action.startTime),
          rightPosition: timeToPosition(measure.width, boundaries, entry.action.endTime),
          label: entry.action.action + ' ' + detail,
          type: entry.action.action,
          priority: 0,
        });
        if (entry === (highlightedAction || selectedAction))
          targetBar = bars[bars.length - 1];
      }
      let lastDialogOpened: trace.DialogOpenedEvent | undefined;
      for (const event of page.interestingEvents) {
        if (event.type === 'dialog-opened') {
          lastDialogOpened = event;
          continue;
        }
        if (event.type === 'dialog-closed' && lastDialogOpened) {
          bars.push({
            event,
            leftTime: lastDialogOpened.timestamp,
            rightTime: event.timestamp,
            leftPosition: timeToPosition(measure.width, boundaries, lastDialogOpened.timestamp),
            rightPosition: timeToPosition(measure.width, boundaries, event.timestamp),
            label: lastDialogOpened.message ? `${event.dialogType} "${lastDialogOpened.message}"` : event.dialogType,
            type: 'dialog',
            priority: -1,
          });
        } else if (event.type === 'navigation') {
          bars.push({
            event,
            leftTime: event.timestamp,
            rightTime: event.timestamp,
            leftPosition: timeToPosition(measure.width, boundaries, event.timestamp),
            rightPosition: timeToPosition(measure.width, boundaries, event.timestamp),
            label: `navigated to ${event.url}`,
            type: event.type,
            priority: 1,
          });
        } else if (event.type === 'load') {
          bars.push({
            event,
            leftTime: event.timestamp,
            rightTime: event.timestamp,
            leftPosition: timeToPosition(measure.width, boundaries, event.timestamp),
            rightPosition: timeToPosition(measure.width, boundaries, event.timestamp),
            label: `load`,
            type: event.type,
            priority: 1,
          });
        }
      }
    }
    bars.sort((a, b) => a.priority - b.priority);
    return bars;
  }, [context, boundaries, measure.width]);

  const findHoveredBar = (x: number) => {
    const time = positionToTime(measure.width, boundaries, x);
    const time1 = positionToTime(measure.width, boundaries, x - 5);
    const time2 = positionToTime(measure.width, boundaries, x + 5);
    let bar: TimelineBar | undefined;
    let distance: number | undefined;
    for (const b of bars) {
      const left = Math.max(b.leftTime, time1);
      const right = Math.min(b.rightTime, time2);
      const middle = (b.leftTime + b.rightTime) / 2;
      const d = Math.abs(time - middle);
      if (left <= right && (!bar || d < distance!)) {
        bar = b;
        distance = d;
      }
    }
    return bar;
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (ref.current) {
      const x = event.clientX - ref.current.getBoundingClientRect().left;
      setPreviewX(x);
      const bar = findHoveredBar(x);
      setHoveredBar(bar);
      onHighlighted(bar && bar.entry ? bar.entry : undefined);
    }
  };
  const onMouseLeave = () => {
    setPreviewX(undefined);
  };
  const onClick = (event: React.MouseEvent) => {
    if (ref.current) {
      const x = event.clientX - ref.current.getBoundingClientRect().left;
      const bar = findHoveredBar(x);
      if (bar && bar.entry)
        onSelected(bar.entry);
    }
  };

  return <div ref={ref} className='timeline-view' onMouseMove={onMouseMove} onMouseOver={onMouseMove} onMouseLeave={onMouseLeave} onClick={onClick}>
    <div className='timeline-grid'>{
      offsets.map((offset, index) => {
        return <div key={index} className='timeline-divider' style={{ left: offset.position + 'px' }}>
          <div className='timeline-time'>{msToString(offset.time - boundaries.minimum)}</div>
        </div>;
      })
    }</div>
    <div className='timeline-lane timeline-labels'>{
      bars.map((bar, index) => {
        return <div key={index}
          className={'timeline-label ' + bar.type + (targetBar === bar ? ' selected' : '')}
          style={{
            left: bar.leftPosition + 'px',
            width: Math.max(1, bar.rightPosition - bar.leftPosition) + 'px',
          }}
        >
          {bar.label}
        </div>;
      })
    }</div>
    <div className='timeline-lane timeline-bars'>{
      bars.map((bar, index) => {
        return <div key={index}
          className={'timeline-bar ' + bar.type + (targetBar === bar ? ' selected' : '')}
          style={{
            left: bar.leftPosition + 'px',
            width: Math.max(1, bar.rightPosition - bar.leftPosition) + 'px',
          }}
        ></div>;
      })
    }</div>
    <div className='timeline-marker timeline-marker-hover' style={{
      display: (previewX !== undefined) ? 'block' : 'none',
      left: (previewX || 0) + 'px',
    }}></div>
  </div>;
};

function calculateDividerOffsets(clientWidth: number, boundaries: Boundaries): { position: number, time: number }[] {
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
    offsets.push({ position: timeToPosition(clientWidth, boundaries, time), time });
  }
  return offsets;
}

function timeToPosition(clientWidth: number, boundaries: Boundaries, time: number): number {
  return (time - boundaries.minimum) / (boundaries.maximum - boundaries.minimum) * clientWidth;
}

function positionToTime(clientWidth: number, boundaries: Boundaries, x: number): number {
  return x / clientWidth * (boundaries.maximum - boundaries.minimum) + boundaries.minimum;
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
    return minutes.toFixed(1) + 'm';

  const hours = minutes / 60;
  if (hours < 24)
    return hours.toFixed(1) + 'h';

  const days = hours / 24;
  return days.toFixed(1) + 'd';
}
