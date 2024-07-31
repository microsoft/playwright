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

import { clsx, msToString, useMeasure } from '@web/uiUtils';
import { GlassPane } from '@web/shared/glassPane';
import * as React from 'react';
import type { Boundaries } from '../geometry';
import { FilmStrip } from './filmStrip';
import type { FilmStripPreviewPoint } from './filmStrip';
import type { ActionTraceEventInContext, MultiTraceModel } from './modelUtil';
import './timeline.css';
import type { Language } from '@isomorphic/locatorGenerators';
import type { Entry } from '@trace/har';
import type { ConsoleEntry } from './consoleTab';

type TimelineBar = {
  action?: ActionTraceEventInContext;
  resource?: Entry;
  consoleMessage?: ConsoleEntry;
  leftPosition: number;
  rightPosition: number;
  leftTime: number;
  rightTime: number;
  active: boolean;
  error: boolean;
};

export const Timeline: React.FunctionComponent<{
  model: MultiTraceModel | undefined,
  consoleEntries: ConsoleEntry[] | undefined,
  boundaries: Boundaries,
  highlightedAction: ActionTraceEventInContext | undefined,
  highlightedEntry: Entry | undefined,
  highlightedConsoleEntry: ConsoleEntry | undefined,
  onSelected: (action: ActionTraceEventInContext) => void,
  selectedTime: Boundaries | undefined,
  setSelectedTime: (time: Boundaries | undefined) => void,
  sdkLanguage: Language,
}> = ({ model, boundaries, consoleEntries, onSelected, highlightedAction, highlightedEntry, highlightedConsoleEntry, selectedTime, setSelectedTime, sdkLanguage }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const [dragWindow, setDragWindow] = React.useState<{ startX: number, endX: number, pivot?: number, type: 'resize' | 'move' } | undefined>();
  const [previewPoint, setPreviewPoint] = React.useState<FilmStripPreviewPoint | undefined>();

  const { offsets, curtainLeft, curtainRight } = React.useMemo(() => {
    let activeWindow = selectedTime || boundaries;
    if (dragWindow && dragWindow.startX !== dragWindow.endX) {
      const time1 = positionToTime(measure.width, boundaries, dragWindow.startX);
      const time2 = positionToTime(measure.width, boundaries, dragWindow.endX);
      activeWindow = { minimum: Math.min(time1, time2), maximum: Math.max(time1, time2) };
    }
    const curtainLeft = timeToPosition(measure.width, boundaries, activeWindow.minimum);
    const maxRight = timeToPosition(measure.width, boundaries, boundaries.maximum);
    const curtainRight = maxRight - timeToPosition(measure.width, boundaries, activeWindow.maximum);
    return { offsets: calculateDividerOffsets(measure.width, boundaries), curtainLeft, curtainRight };
  }, [selectedTime, boundaries, dragWindow, measure]);

  const bars = React.useMemo(() => {
    const bars: TimelineBar[] = [];
    for (const entry of model?.actions || []) {
      if (entry.class === 'Test')
        continue;
      bars.push({
        action: entry,
        leftTime: entry.startTime,
        rightTime: entry.endTime || boundaries.maximum,
        leftPosition: timeToPosition(measure.width, boundaries, entry.startTime),
        rightPosition: timeToPosition(measure.width, boundaries, entry.endTime || boundaries.maximum),
        active: false,
        error: !!entry.error,
      });
    }

    for (const resource of model?.resources || []) {
      const startTime = resource._monotonicTime!;
      const endTime = resource._monotonicTime! + resource.time;
      bars.push({
        resource,
        leftTime: startTime,
        rightTime: endTime,
        leftPosition: timeToPosition(measure.width, boundaries, startTime),
        rightPosition: timeToPosition(measure.width, boundaries, endTime),
        active: false,
        error: false,
      });
    }

    for (const consoleMessage of consoleEntries || []) {
      bars.push({
        consoleMessage,
        leftTime: consoleMessage.timestamp,
        rightTime: consoleMessage.timestamp,
        leftPosition: timeToPosition(measure.width, boundaries, consoleMessage.timestamp),
        rightPosition: timeToPosition(measure.width, boundaries, consoleMessage.timestamp),
        active: false,
        error: consoleMessage.isError,
      });
    }

    return bars;
  }, [model, consoleEntries, boundaries, measure]);

  React.useMemo(() => {
    for (const bar of bars) {
      if (highlightedAction)
        bar.active = bar.action === highlightedAction;
      else if (highlightedEntry)
        bar.active = bar.resource === highlightedEntry;
      else if (highlightedConsoleEntry)
        bar.active = bar.consoleMessage === highlightedConsoleEntry;
      else
        bar.active = false;
    }
  }, [bars, highlightedAction, highlightedEntry, highlightedConsoleEntry]);

  const onMouseDown = React.useCallback((event: React.MouseEvent) => {
    setPreviewPoint(undefined);
    if (!ref.current)
      return;
    const x = event.clientX - ref.current.getBoundingClientRect().left;
    const time = positionToTime(measure.width, boundaries, x);
    const leftX = selectedTime ? timeToPosition(measure.width, boundaries, selectedTime.minimum) : 0;
    const rightX = selectedTime ? timeToPosition(measure.width, boundaries, selectedTime.maximum) : 0;

    if (selectedTime && Math.abs(x - leftX) < 10) {
      // Resize left.
      setDragWindow({ startX: rightX, endX: x, type: 'resize' });
    } else if (selectedTime && Math.abs(x - rightX) < 10) {
      // Resize right.
      setDragWindow({ startX: leftX, endX: x, type: 'resize' });
    } else if (selectedTime && time > selectedTime.minimum && time < selectedTime.maximum && event.clientY - ref.current.getBoundingClientRect().top < 20) {
      // Move window.
      setDragWindow({ startX: leftX, endX: rightX, pivot: x, type: 'move' });
    } else {
      // Create new.
      setDragWindow({ startX: x, endX: x, type: 'resize' });
    }
  }, [boundaries, measure, ref, selectedTime]);

  const onGlassPaneMouseMove = React.useCallback((event: MouseEvent) => {
    if (!ref.current)
      return;
    const x = event.clientX - ref.current.getBoundingClientRect().left;
    const time = positionToTime(measure.width, boundaries, x);
    const action = model?.actions.findLast(action => action.startTime <= time);

    if (!event.buttons) {
      setDragWindow(undefined);
      return;
    }

    // When moving window reveal action under cursor.
    if (action)
      onSelected(action);

    // Should not happen, but for type safety.
    if (!dragWindow)
      return;

    let newDragWindow = dragWindow;
    if (dragWindow.type === 'resize') {
      newDragWindow = { ...dragWindow, endX: x };
    } else {
      const delta = x - dragWindow.pivot!;
      let startX = dragWindow.startX + delta;
      let endX = dragWindow.endX + delta;
      if (startX < 0) {
        startX = 0;
        endX = startX + (dragWindow.endX - dragWindow.startX);
      }
      if (endX > measure.width) {
        endX = measure.width;
        startX = endX - (dragWindow.endX - dragWindow.startX);
      }
      newDragWindow = { ...dragWindow, startX, endX, pivot: x };
    }

    setDragWindow(newDragWindow);
    const time1 = positionToTime(measure.width, boundaries, newDragWindow.startX);
    const time2 = positionToTime(measure.width, boundaries, newDragWindow.endX);
    if (time1 !== time2)
      setSelectedTime({ minimum: Math.min(time1, time2), maximum: Math.max(time1, time2) });
  }, [boundaries, dragWindow, measure, model, onSelected, ref, setSelectedTime]);

  const onGlassPaneMouseUp = React.useCallback(() => {
    setPreviewPoint(undefined);
    if (!dragWindow)
      return;
    if (dragWindow.startX !== dragWindow.endX) {
      const time1 = positionToTime(measure.width, boundaries, dragWindow.startX);
      const time2 = positionToTime(measure.width, boundaries, dragWindow.endX);
      setSelectedTime({ minimum: Math.min(time1, time2), maximum: Math.max(time1, time2) });
    } else {
      const time = positionToTime(measure.width, boundaries, dragWindow.startX);
      const action = model?.actions.findLast(action => action.startTime <= time);
      if (action)
        onSelected(action);
      setSelectedTime(undefined);
    }
    setDragWindow(undefined);
  }, [boundaries, dragWindow, measure, model, setSelectedTime, onSelected]);

  const onMouseMove = React.useCallback((event: React.MouseEvent) => {
    if (!ref.current)
      return;
    const x = event.clientX - ref.current.getBoundingClientRect().left;
    const time = positionToTime(measure.width, boundaries, x);
    const action = model?.actions.findLast(action => action.startTime <= time);
    setPreviewPoint({ x, clientY: event.clientY, action, sdkLanguage });
  }, [boundaries, measure, model, ref, sdkLanguage]);

  const onMouseLeave = React.useCallback(() => {
    setPreviewPoint(undefined);
  }, []);

  const onPaneDoubleClick = React.useCallback(() => {
    setSelectedTime(undefined);
  }, [setSelectedTime]);

  return <div style={{ flex: 'none', borderBottom: '1px solid var(--vscode-panel-border)' }}>
    {!!dragWindow && <GlassPane
      cursor={dragWindow?.type === 'resize' ? 'ew-resize' : 'grab'}
      onPaneMouseUp={onGlassPaneMouseUp}
      onPaneMouseMove={onGlassPaneMouseMove}
      onPaneDoubleClick={onPaneDoubleClick} />}
    <div ref={ref}
      className='timeline-view'
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}>
      <div className='timeline-grid'>{
        offsets.map((offset, index) => {
          return <div key={index} className='timeline-divider' style={{ left: offset.position + 'px' }}>
            <div className='timeline-time'>{msToString(offset.time - boundaries.minimum)}</div>
          </div>;
        })
      }</div>
      <div style={{ height: 8 }}></div>
      <FilmStrip model={model} boundaries={boundaries} previewPoint={previewPoint} />
      <div className='timeline-bars'>{
        bars.map((bar, index) => {
          return <div key={index}
            className={clsx('timeline-bar',
                bar.action && 'action',
                bar.resource && 'network',
                bar.consoleMessage && 'console-message',
                bar.active && 'active',
                bar.error && 'error')}
            style={{
              left: bar.leftPosition,
              width: Math.max(5, bar.rightPosition - bar.leftPosition),
              top: barTop(bar),
              bottom: 0,
            }}
          ></div>;
        })
      }</div>
      <div className='timeline-marker' style={{
        display: (previewPoint !== undefined) ? 'block' : 'none',
        left: (previewPoint?.x || 0) + 'px',
      }} />
      {selectedTime && <div className='timeline-window'>
        <div className='timeline-window-curtain left' style={{ width: curtainLeft }}></div>
        <div className='timeline-window-resizer' style={{ left: -5 }}></div>
        <div className='timeline-window-center'>
          <div className='timeline-window-drag'></div>
        </div>
        <div className='timeline-window-resizer' style={{ left: 5 }}></div>
        <div className='timeline-window-curtain right' style={{ width: curtainRight }}></div>
      </div>}
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

function barTop(bar: TimelineBar): number {
  return bar.resource ? 25 : 20;
}
