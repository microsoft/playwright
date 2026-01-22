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

import React from 'react';
import { LoadedReport } from './loadedReport';
import { TestFileView } from './testFileView';
import * as icons from './icons';
import { TestCaseSummary } from './types';
import { AutoChip } from './chip';
import { formatDuration, GanttChart, GanttEntry } from './gantt';

export function Speedboard({ report, tests }: { report: LoadedReport, tests: TestCaseSummary[] }) {
  return <>
    <Shards report={report} />
    <SlowestTests report={report} tests={tests} />
  </>;
}

export function SlowestTests({ report, tests }: { report: LoadedReport, tests: TestCaseSummary[] }) {
  const [length, setLength] = React.useState(50);
  return <TestFileView
    file={{
      fileId: 'slowest',
      fileName: 'Slowest Tests',
      tests: tests.slice(0, length),
      stats: null as any,
    }}
    projectNames={report.json().projectNames}
    footer={
      length < tests.length
        ? <button className='link-badge fullwidth-link' style={{ padding: '8px 5px' }} onClick={() => setLength(l => l + 50)}>
          {icons.downArrow()}
          Show 50 more
        </button>
        : undefined
    }
  />;
}

export function Shards({ report }: { report: LoadedReport }) {
  const machines = report.json().machines;
  if (machines.length === 0)
    return null;

  const entries: GanttEntry[] = machines
      .map(machine => {
        const label = machine.tag.join(' ');
        const startTimeFormatted = new Date(machine.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
        let tooltip = `${label} started at ${startTimeFormatted}, runs ${formatDuration(machine.duration)}`;
        if (machine.shardIndex)
          tooltip += ` (shard ${machine.shardIndex})`;
        return {
          label,
          tooltip,
          startTime: machine.startTime,
          duration: machine.duration,
          shardIndex: machine.shardIndex ?? 1,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label) || a.shardIndex - b.shardIndex);

  return <AutoChip header='Timeline'>
    <GanttChart entries={entries} />
  </AutoChip>;
}
