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
import { Filter } from './filter';
import { LoadedReport } from './loadedReport';
import { TestFileView } from './testFileView';
import * as icons from './icons';

export function Speedboard({ filter, report }: { filter: Filter, report: LoadedReport}) {
  return <>
    <SlowestTests filter={filter} report={report} />
  </>;
}

export function SlowestTests({ filter, report }: { filter: Filter, report: LoadedReport}) {
  const [length, setLength] = React.useState(10);
  const slowestTests = React.useMemo(() => {
    const tests = report.json().files.flatMap(file => file.tests).filter(t => filter.matches(t));
    return tests.sort((a, b) => b.duration - a.duration);
  }, [report, filter]);
  return <TestFileView
    file={{
      fileId: 'slowest',
      fileName: 'Slowest Tests',
      tests: slowestTests.slice(0, length),
      stats: null as any,
    }}
    projectNames={report.json().projectNames}
    footer={
      <button className='link-badge' onClick={() => setLength(l => l + 10)}>
        {icons.downArrow()}
        Show more
      </button>
    }
  />;
}
