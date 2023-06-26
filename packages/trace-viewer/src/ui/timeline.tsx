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

import type { EventTraceEvent } from '@trace/trace';
import { msToString, useMeasure } from '@web/uiUtils';
import * as React from 'react';
import type { Boundaries } from '../geometry';
import { FilmStrip } from './filmStrip';
import type { ActionTraceEventInContext, MultiTraceModel } from './modelUtil';
import './timeline.css';
import { asLocator } from '@isomorphic/locatorGenerators';
import type { Language } from '@isomorphic/locatorGenerators';

type TimelineBar = {
  action?: ActionTraceEventInContext;
  event?: EventTraceEvent;
  leftPosition: number;
  rightPosition: number;
  leftTime: number;
  rightTime: number;
  type: string;
  label: string;
  title: string | undefined;
  className: string;
};

export const Timeline: React.FunctionComponent<{
  model: MultiTraceModel | undefined,
  selectedAction: ActionTraceEventInContext | undefined,
  onSelected: (action: ActionTraceEventInContext) => void,
  hideTimelineBars?: boolean,
  sdkLanguage: Language,
}> = ({ model, selectedAction, onSelected, hideTimelineBars, sdkLanguage }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const barsRef = React.useRef<HTMLDivElement | null>(null);

  const [previewPoint, setPreviewPoint] = React.useState<{ x: number, clientY: number } | undefined>();
  const [hoveredBarIndex, setHoveredBarIndex] = React.useState<number | undefined>();

  const { boundaries, offsets } = React.useMemo(() => {
    const boundaries = { minimum: model?.startTime || 0, maximum: model?.endTime || 30000 };
    if (boundaries.minimum > boundaries.maximum) {
      boundaries.minimum = 0;
      boundaries.maximum = 30000;
    }
    // Leave some nice free space on the right hand side.
    boundaries.maximum += (boundaries.maximum - boundaries.minimum) / 20;
    return { boundaries, offsets: calculateDividerOffsets(measure.width, boundaries) };
  }, [measure.width, model]);

  const bars = React.useMemo(() => {
    const bars: TimelineBar[] = [];
    for (const entry of model?.actions || []) {
      const locator = asLocator(sdkLanguage || 'javascript', entry.params.selector, false /* isFrameLocator */, true /* playSafe */);
      let detail = trimRight(locator || '', 50);
      if (entry.method === 'goto')
        detail = trimRight(entry.params.url || '', 50);
      bars.push({
        action: entry,
        leftTime: entry.startTime,
        rightTime: entry.endTime,
        leftPosition: timeToPosition(measure.width, boundaries, entry.startTime),
        rightPosition: timeToPosition(measure.width, boundaries, entry.endTime),
        label: entry.apiName + ' ' + detail,
        title: entry.endTime ? msToString(entry.endTime - entry.startTime) : 'Timed Out',
        type: entry.type + '.' + entry.method,
        className: `${entry.type}_${entry.method}`.toLowerCase()
      });
    }

    for (const event of model?.events || []) {
      const startTime = event.time;
      bars.push({
        event,
        leftTime: startTime,
        rightTime: startTime,
        leftPosition: timeToPosition(measure.width, boundaries, startTime),
        rightPosition: timeToPosition(measure.width, boundaries, startTime),
        label: event.method,
        title: undefined,
        type: event.class + '.' + event.method,
        className: `${event.class}_${event.method}`.toLowerCase()
      });
    }
    return bars;
  }, [model, boundaries, measure.width, sdkLanguage]);

  const hoveredBar = hoveredBarIndex !== undefined ? bars[hoveredBarIndex] : undefined;
  let targetBar: TimelineBar | undefined = bars.find(bar => bar.action === selectedAction);
  targetBar = hoveredBar || targetBar;

  const findHoveredBarIndex = (x: number) => {
    const time = positionToTime(measure.width, boundaries, x);
    const time1 = positionToTime(measure.width, boundaries, x - 5);
    const time2 = positionToTime(measure.width, boundaries, x + 5);
    let index: number | undefined;
    let xDistance: number | undefined;
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const left = Math.max(bar.leftTime, time1);
      const right = Math.min(bar.rightTime, time2);
      const xMiddle = (bar.leftTime + bar.rightTime) / 2;
      const xd = Math.abs(time - xMiddle);
      if (left > right)
        continue;
      if (index === undefined || xd < xDistance!) {
        index = i;
        xDistance = xd;
      }
    }
    return index;
  };

  const onMouseMove = (event: React.MouseEvent) => {
    if (!ref.current)
      return;
    const x = event.clientX - ref.current.getBoundingClientRect().left;
    const index = findHoveredBarIndex(x);
    setPreviewPoint({ x, clientY: event.clientY });
    setHoveredBarIndex(index);
  };

  const onMouseLeave = () => {
    setPreviewPoint(undefined);
    setHoveredBarIndex(undefined);
  };

  const onClick = (event: React.MouseEvent) => {
    setPreviewPoint(undefined);
    if (!ref.current)
      return;
    const x = event.clientX - ref.current.getBoundingClientRect().left;
    const index = findHoveredBarIndex(x);
    if (index === undefined)
      return;
    const entry = bars[index].action;
    if (entry)
      onSelected(entry);
  };

  return <div style={{ flex: 'none', borderBottom: '1px solid var(--vscode-panel-border)' }}>
    <div ref={ref} className='timeline-view' onMouseMove={onMouseMove} onMouseOver={onMouseMove} onMouseLeave={onMouseLeave} onClick={onClick}>
      <div className='timeline-grid'>{
        offsets.map((offset, index) => {
          return <div key={index} className='timeline-divider' style={{ left: offset.position + 'px' }}>
            <div className='timeline-time'>{msToString(offset.time - boundaries.minimum)}</div>
          </div>;
        })
      }</div>
      {!hideTimelineBars && <div className='timeline-lane timeline-labels'>{
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
      }</div>}
      {!hideTimelineBars && <div className='timeline-lane timeline-bars' ref={barsRef}>{
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
      }</div>}
      <FilmStrip model={model} boundaries={boundaries} previewPoint={previewPoint} />
      <div className='timeline-marker timeline-marker-hover' style={{
        display: (previewPoint !== undefined) ? 'block' : 'none',
        left: (previewPoint?.x || 0) + 'px',
      }}></div>
    </div>
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

function barTop(bar: TimelineBar): number {
  return bar.event ? 22 : (bar.action?.method === 'waitForEventInfo' ? 0 : 11);
}
