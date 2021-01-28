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

import { ActionEntry } from '../../../cli/traceViewer/traceModel';
import { Boundaries, Size } from '../geometry';
import { NetworkTab } from './networkTab';
import { SourceTab } from './sourceTab';
import './propertiesTabbedPane.css';
import * as React from 'react';
import { msToString, useMeasure } from './helpers';
import { LogsTab } from './logsTab';

export const PropertiesTabbedPane: React.FunctionComponent<{
  actionEntry: ActionEntry | undefined,
  snapshotSize: Size,
  selectedTime: number | undefined,
  boundaries: Boundaries,
}> = ({ actionEntry, snapshotSize, selectedTime, boundaries }) => {
  const [selected, setSelected] = React.useState<'snapshot' | 'source' | 'network' | 'logs'>('snapshot');
  return <div className='properties-tabbed-pane'>
    <div className='vbox'>
      <div className='hbox' style={{ flex: 'none' }}>
        <div className='properties-tab-strip'>
          <div className={'properties-tab-element ' + (selected === 'snapshot' ? 'selected' : '')}
            onClick={() => setSelected('snapshot')}>
            <div className='properties-tab-label'>Snapshot</div>
          </div>
          <div className={'properties-tab-element ' + (selected === 'source' ? 'selected' : '')}
            onClick={() => setSelected('source')}>
            <div className='properties-tab-label'>Source</div>
          </div>
          <div className={'properties-tab-element ' + (selected === 'network' ? 'selected' : '')}
            onClick={() => setSelected('network')}>
            <div className='properties-tab-label'>Network</div>
          </div>
          <div className={'properties-tab-element ' + (selected === 'logs' ? 'selected' : '')}
            onClick={() => setSelected('logs')}>
            <div className='properties-tab-label'>Logs</div>
          </div>
        </div>
      </div>
      <div className='properties-tab-content' style={{ display: selected === 'snapshot' ? 'flex' : 'none' }}>
        <SnapshotTab actionEntry={actionEntry} snapshotSize={snapshotSize} selectedTime={selectedTime} boundaries={boundaries} />
      </div>
      <div className='properties-tab-content' style={{ display: selected === 'source' ? 'flex' : 'none' }}>
        <SourceTab actionEntry={actionEntry} />
      </div>
      <div className='properties-tab-content' style={{ display: selected === 'network' ? 'flex' : 'none' }}>
        <NetworkTab actionEntry={actionEntry} />
      </div>
      <div className='properties-tab-content' style={{ display: selected === 'logs' ? 'flex' : 'none' }}>
        <LogsTab actionEntry={actionEntry} />
      </div>
    </div>
  </div>;
};

const SnapshotTab: React.FunctionComponent<{
  actionEntry: ActionEntry | undefined,
  snapshotSize: Size,
  selectedTime: number | undefined,
  boundaries: Boundaries,
}> = ({ actionEntry, snapshotSize, selectedTime, boundaries }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const [snapshotIndex, setSnapshotIndex] = React.useState(0);

  let snapshots: { name: string, snapshotId?: string, snapshotTime?: number }[] = [];
  snapshots = (actionEntry ? (actionEntry.action.snapshots || []) : []).slice();
  if (!snapshots.length || snapshots[0].name !== 'before')
    snapshots.unshift({ name: 'before', snapshotTime: actionEntry ? actionEntry.action.startTime : 0 });
  if (snapshots[snapshots.length - 1].name !== 'after')
    snapshots.push({ name: 'after', snapshotTime: actionEntry ? actionEntry.action.endTime : 0 });

  const iframeRef = React.createRef<HTMLIFrameElement>();
  React.useEffect(() => {
    if (!actionEntry || !iframeRef.current)
      return;

    // TODO: this logic is copied from SnapshotServer. Find a way to share.
    let snapshotUrl = 'data:text/html,Snapshot is not available';
    if (selectedTime) {
      snapshotUrl = `/snapshot/pageId/${actionEntry.action.pageId!}/timestamp/${selectedTime}/main`;
    } else {
      const snapshot = snapshots[snapshotIndex];
      if (snapshot && snapshot.snapshotTime)
        snapshotUrl = `/snapshot/pageId/${actionEntry.action.pageId!}/timestamp/${snapshot.snapshotTime}/main`;
      else if (snapshot && snapshot.snapshotId)
        snapshotUrl = `/snapshot/pageId/${actionEntry.action.pageId!}/snapshotId/${snapshot.snapshotId}/main`;
    }

    try {
      (iframeRef.current.contentWindow as any).showSnapshot(snapshotUrl);
    } catch (e) {
    }
  }, [actionEntry, snapshotIndex, selectedTime]);

  const scale = Math.min(measure.width / snapshotSize.width, measure.height / snapshotSize.height);
  return <div className='snapshot-tab'>
    <div className='snapshot-controls'>{
      selectedTime && <div key='selectedTime' className='snapshot-toggle'>
        {msToString(selectedTime - boundaries.minimum)}
      </div>
    }{!selectedTime && snapshots.map((snapshot, index) => {
        return <div
          key={snapshot.name}
          className={'snapshot-toggle' + (snapshotIndex === index ? ' toggled' : '')}
          onClick={() => setSnapshotIndex(index)}>
          {snapshot.name}
        </div>
      })
    }</div>
    <div ref={ref} className='snapshot-wrapper'>
      <div className='snapshot-container' style={{
        width: snapshotSize.width + 'px',
        height: snapshotSize.height + 'px',
        transform: `translate(${-snapshotSize.width * (1 - scale) / 2}px, ${-snapshotSize.height * (1 - scale) / 2}px) scale(${scale})`,
      }}>
        <iframe ref={iframeRef} id='snapshot' name='snapshot' src='/snapshot/'></iframe>
      </div>
    </div>
  </div>;
};
