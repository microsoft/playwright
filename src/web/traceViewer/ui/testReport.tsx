/*
  Copyright (c) Microsoft Corporation.

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

import * as React from 'react';
import './testReport.css';
import { JSONReportTestResult, JSONReportSuite, JSONReportSpec } from '../../../server/trace/viewer/testModel';
import * as modelUtil from './modelUtil';
import { msToString } from '../../uiUtils';
import { highlightANSIText, renderTestStatus } from './helpers';
import { SplitView } from '../../components/splitView';

type TestSelection = {
  result: JSONReportTestResult;
  title: string;
  status: string;
};

const kIndent = 10;

export const TestReport: React.FunctionComponent<{
  report: modelUtil.TestReport,
  onSelected: (selection: TestSelection) => void,
  onHide: () => void,
}> = ({ report, onSelected, onHide }) => {
  const [selection, setSelection] = React.useState<TestSelection | undefined>();

  const list: JSX.Element[] = [];

  function renderSuite(suite: JSONReportSuite, indent: number, file: string) {
    list.push(<div
      className='test-report-item'
      key={list.length}>
        <div className='test-report-item-title' style={{ paddingLeft: indent + 'px' }}>
          {suite.title || suite.file}
        </div>
      </div>);
    (suite.suites || []).forEach(s => renderSuite(s, indent + kIndent, file));
    suite.specs.forEach(spec => renderSpec(spec, indent + kIndent, file));
  }

  function renderSpec(spec: JSONReportSpec, indent: number, file: string) {
    for (const test of spec.tests) {
      for (const result of test.results) {
        const projectName = test.projectName ? `[${test.projectName}] ` : '';
        let title = projectName + spec.title;
        if (result.retry)
          title += ` (retry #${result.retry})`;

        let status = 'expected';
        if (result.status === 'skipped')
          status = 'skipped';
        else if (result.status !== test.expectedStatus)
          status = result.retry === test.results.length - 1 ? 'unexpected' : 'retry';

        list.push(<div
          className={'test-report-item test-report-test-result' + (result === selection?.result ? ' selected' : '')}
          key={list.length}
          onClick={() => {
            const selection: TestSelection = { result, title: file + ' › ' + title, status };
            setSelection(selection);
            onSelected(selection);
          }}
        >
          {renderTestStatus(status, { flex: 'none', paddingLeft: indent + 'px', marginRight: '5px' })}
          <div className='test-report-item-title'>{title}</div>
          <div className='test-report-item-duration'>({msToString(result.duration)})</div>
        </div>);
      }
    }
  }

  report.json.suites.forEach(suite => renderSuite(suite, 5, suite.file));
  const error = selection?.result.error;

  return (
    <SplitView sidebarSize={120} orientation='vertical'>
      <div className='vbox test-report'>
        <div className='test-report-title tab-strip' onClick={onHide}>
          <div className='tab-element'>
            <div
              className='codicon codicon-chevron-left'
              style={{ marginRight: '10px' }} />
            <div style={{ marginRight: '10px' }}>🎭</div>
            <div className='tab-label'>Test Report</div>
          </div>
        </div>
        <div className='test-report-overview'>
          <div className='vbox'><div className='test-report-counter' style={{ color: 'var(--expected)' }}>{report.expected}</div><div>passed</div></div>
          <div className='vbox'><div className='test-report-counter' style={{ color: 'var(--unexpected)' }}>{report.unexpected}</div><div>failed</div></div>
          <div className='vbox'><div className='test-report-counter' style={{ color: 'var(--flaky)' }}>{report.flaky}</div><div>flaky</div></div>
          <div className='vbox'><div className='test-report-counter' style={{ color: 'var(--skipped)' }}>{report.skipped}</div><div>skipped</div></div>
        </div>
        <div className='test-report-list'>
          {list}
        </div>
      </div>
      <div className='vbox'>
        <div className='tab-strip'>
          <div className='tab-element' style={{ pointerEvents: 'none' }}>Test Error</div>
        </div>
        <div className='test-report-error'>{error ? highlightANSIText(error.message || '') : 'No error'}</div>
      </div>
    </SplitView>
  );
};

