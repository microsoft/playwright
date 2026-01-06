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
import { GroupedBarChart } from './barchart';

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
  const shards = report.json().shards;
  if (shards.length === 0)
    return null;

  let clash = false;
  const bots: Record<string, number[]> = {};
  for (const shard of shards) {
    const botName = shard.tag.join(' ');
    bots[botName] ??= [];
    const shardIndex = Math.max((shard.shardIndex ?? 1) - 1, 0);
    if (bots[botName][shardIndex] !== undefined)
      clash = true;
    bots[botName][shardIndex] = shard.duration;
  }

  const maxSeries = Math.max(...Object.values(bots).map(shardDurations => shardDurations.length));

  return <AutoChip header='Shard Duration'>
    <GroupedBarChart
      data={Object.values(bots)}
      groups={Object.keys(bots)}
      series={Array.from({ length: maxSeries }).map((_, i) => `Shard ${i + 1}`)}
    />
    {clash && <div style={{ marginTop: 8 }}>
      <icons.warning />
      Some shards could not be differentiated because of missing global tags.
      Please refer to <a href='https://playwright.dev/docs/test-sharding#merging-reports-from-multiple-environments' target='_blank' rel='noopener noreferrer'>
        the docs
      </a> on how to fix this.
    </div>}
  </AutoChip>;
}
