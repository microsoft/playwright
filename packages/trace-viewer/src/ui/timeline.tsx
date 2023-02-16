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

import type { ActionTraceEvent } from '@trace/trace';
import { msToString } from '@web/uiUtils';
import * as React from 'react';
import type { Boundaries } from '../geometry';
import { FilmStrip } from './filmStrip';
import { useMeasure } from './helpers';
import type { MultiTraceModel } from './modelUtil';
import './timeline.css';

type TimelineBar = {
  action?: ActionTraceEvent;
  event?: ActionTraceEvent;
  leftPosition: number;
  rightPosition: number;
  leftTime: number;
  rightTime: number;
  type: string;
  label: string;
  title: string;
  className: string;
};

export const Timeline: React.FunctionComponent<{
  context: MultiTraceModel,
  boundaries: Boundaries,
  selectedAction: ActionTraceEvent | undefined,
  onSelected: (action: ActionTraceEvent) => void,
}> = ({ context, boundaries, selectedAction, onSelected }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const barsRef = React.useRef<HTMLDivElement | null>(null);

  const [previewPoint, setPreviewPoint] = React.useState<{ x: number, clientY: number } | undefined>();
  const [hoveredBarIndex, setHoveredBarIndex] = React.useState<number | undefined>();

  const offsets = React.useMemo(() => {
    return calculateDividerOffsets(measure.width, boundaries);
  }, [measure.width, boundaries]);

  const bars = React.useMemo(() => {
    const bars: TimelineBar[] = [];
    for (const entry of context.actions) {
      let detail = trimRight(entry.metadata.params.selector || '', 50);
      if (entry.metadata.method === 'goto')
        detail = trimRight(entry.metadata.params.url || '', 50);
      bars.push({
        action: entry,
        leftTime: entry.metadata.startTime,
        rightTime: entry.metadata.endTime,
        leftPosition: timeToPosition(measure.width, boundaries, entry.metadata.startTime),
        rightPosition: timeToPosition(measure.width, boundaries, entry.metadata.endTime),
        label: entry.metadata.apiName + ' ' + detail,
        title: entry.metadata.endTime ? msToString(entry.metadata.endTime - entry.metadata.startTime) : 'Timed Out',
        type: entry.metadata.type + '.' + entry.metadata.method,
        className: `${entry.metadata.type}_${entry.metadata.method}`.toLowerCase()
      });
    }

    for (const event of context.events) {
      const startTime = event.metadata.startTime;
      bars.push({
        event,
        leftTime: startTime,
        rightTime: startTime,
        leftPosition: timeToPosition(measure.width, boundaries, startTime),
        rightPosition: timeToPosition(measure.width, boundaries, startTime),
        label: event.metadata.method,
        title: event.metadata.endTime ? msToString(event.metadata.endTime - event.metadata.startTime) : 'Timed Out',
        type: event.metadata.type + '.' + event.metadata.method,
        className: `${event.metadata.type}_${event.metadata.method}`.toLowerCase()
      });
    }
    return bars;
  }, [context, boundaries, measure.width]);

  const hoveredBar = hoveredBarIndex !== undefined ? bars[hoveredBarIndex] : undefined;
  let targetBar: TimelineBar | undefined = bars.find(bar => bar.action === selectedAction);
  targetBar = hoveredBar || targetBar;

  const findHoveredBarIndex = (x: number, y: number) => {
    const time = positionToTime(measure.width, boundaries, x);
    const time1 = positionToTime(measure.width, boundaries, x - 5);
    const time2 = positionToTime(measure.width, boundaries, x + 5);
    let index: number | undefined;
    let yDistance: number | undefined;
    let xDistance: number | undefined;
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const yMiddle = kBarHeight / 2 + barTop(bar);
      const left = Math.max(bar.leftTime, time1);
      const right = Math.min(bar.rightTime, time2);
      const xMiddle = (bar.leftTime + bar.rightTime) / 2;
      const xd = Math.abs(time - xMiddle);
      const yd = Math.abs(y - yMiddle);
      if (left > right)
        continue;
      // Prefer closest yDistance (the same bar), among those prefer the closest xDistance.
      if (index === undefined ||
          (yd < yDistance!) ||
          (Math.abs(yd - yDistance!) < 1e-2 && xd < xDistance!)) {
        index = i;
        xDistance = xd;
        yDistance = yd;
      }
    }
    return index;
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!ref.current || !barsRef.current)
      return;
    const x = event.clientX - ref.current.getBoundingClientRect().left;
    const y = event.clientY - barsRef.current.getBoundingClientRect().top;
    const index = findHoveredBarIndex(x, y);
    setPreviewPoint({ x, clientY: event.clientY });
    setHoveredBarIndex(index);
  };

  const onMouseLeave = () => {
    setPreviewPoint(undefined);
    setHoveredBarIndex(undefined);
  };

  const onClick = (event: React.MouseEvent) => {
    setPreviewPoint(undefined);
    if (!ref.current || !barsRef.current)
      return;
    const x = event.clientX - ref.current.getBoundingClientRect().left;
    const y = event.clientY - barsRef.current.getBoundingClientRect().top;
    const index = findHoveredBarIndex(x, y);
    if (index === undefined)
      return;
    const entry = bars[index].action;
    if (entry)
      onSelected(entry);
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
          className={'timeline-label ' + bar.className + (targetBar === bar ? ' selected' : '')}
          style={{
            left: bar.leftPosition,
            maxWidth: 100,
          }}
        >
          {bar.label}
        </div>;
      })
    }</div>
    <div className='timeline-lane timeline-bars' ref={barsRef}>{
      bars.map((bar, index) => {
        return <div key={index}
          className={'timeline-bar ' + (bar.action ? 'action ' : '') + (bar.event ? 'event ' : '') + bar.className + (targetBar === bar ? ' selected' : '')}
          style={{
            left: bar.leftPosition + 'px',
            width: Math.max(1, bar.rightPosition - bar.leftPosition) + 'px',
            top: barTop(bar) + 'px',
          }}
          title={bar.title}
        ></div>;
      })
    }</div>
    <FilmStrip context={context} boundaries={boundaries} previewPoint={previewPoint} />
    <div className='timeline-marker timeline-marker-hover' style={{
      display: (previewPoint !== undefined) ? 'block' : 'none',
      left: (previewPoint?.x || 0) + 'px',
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

function trimRight(s: string, maxLength: number): string {
  return s.length <= maxLength ? s : s.substring(0, maxLength - 1) + '\u2026';
}

const kBarHeight = 11;
function barTop(bar: TimelineBar): number {
  return bar.event ? 22 : (bar.action?.metadata.method === 'waitForEventInfo' ? 0 : 11);
}
