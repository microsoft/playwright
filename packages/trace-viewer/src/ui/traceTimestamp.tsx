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

import * as React from 'react';
import { useSetting } from '@web/uiUtils';
import { useTraceModel } from './traceModelContext';
import './traceTimestamp.css';

export type TimeZone = 'local' | 'utc';

export const TraceTimestamp: React.FC<{
  location: 'timeline' | 'snapshot';
  time?: number;
  wallTime?: number;
  style?: React.CSSProperties;
}> = ({ location, time, wallTime, style }) => {
  const model = useTraceModel();
  const [timeZone] = useSetting<TimeZone>('timeZone', 'local');
  const [displayTimestamp] = useSetting(location === 'timeline' ? 'displayTimelineTimestamp' : 'displaySnapshotTimestamp', false);
  const timestamp = wallTime ?? (time !== undefined && model?.wallTimeOffset !== undefined ? model.wallTimeOffset + time : undefined);
  if (!displayTimestamp || timestamp === undefined)
    return null;

  const date = new Date(timestamp);
  const text = timeZone === 'utc' ? date.toISOString().slice(11, 23) + 'Z' : date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hourCycle: 'h23',
  });
  return <time className={`trace-timestamp ${location}-timestamp`} style={style} dateTime={date.toISOString()} title={date.toLocaleString(undefined, {
    timeZone: timeZone === 'utc' ? 'UTC' : undefined,
    timeZoneName: 'short',
  })}>{text}</time>;
};
