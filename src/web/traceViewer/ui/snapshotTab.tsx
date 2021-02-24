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

import { ActionEntry } from '../../../server/trace/viewer/traceModel';
import { Boundaries, Size } from '../geometry';
import './snapshotTab.css';
import * as React from 'react';
import { useMeasure } from './helpers';
import { msToString } from '../../uiUtils';

export const SnapshotTab: React.FunctionComponent<{
  actionEntry: ActionEntry | undefined,
  snapshotSize: Size,
  selection: { pageId: string, time: number } | undefined,
  boundaries: Boundaries,
}> = ({ actionEntry, snapshotSize, selection, boundaries }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();
  const [snapshotIndex, setSnapshotIndex] = React.useState(0);

  let snapshots: { name: string, snapshotId?: string, snapshotTime?: number }[] = [];
  snapshots = (actionEntry ? (actionEntry.action.snapshots || []) : []).slice();
  if (actionEntry) {
    if (!snapshots.length || snapshots[0].name !== 'before')
      snapshots.unshift({ name: 'before', snapshotTime: actionEntry ? actionEntry.action.startTime : 0 });
    if (snapshots[snapshots.length - 1].name !== 'after')
      snapshots.push({ name: 'after', snapshotTime: actionEntry ? actionEntry.action.endTime : 0 });
  }
  const { pageId, time } = selection || { pageId: undefined, time: 0 };

  const iframeRef = React.createRef<HTMLIFrameElement>();
  React.useEffect(() => {
    if (!iframeRef.current)
      return;

    // TODO: this logic is copied from SnapshotServer. Find a way to share.
    let snapshotUrl = 'data:text/html,Snapshot is not available';
    if (pageId) {
      snapshotUrl = `/snapshot/pageId/${pageId}/timestamp/${time}/main`;
    } else if (actionEntry) {
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
  }, [actionEntry, snapshotIndex, pageId, time]);

  const scale = Math.min(measure.width / snapshotSize.width, measure.height / snapshotSize.height);
  return <div className='snapshot-tab'>
    <div className='snapshot-controls'>{
      selection && <div key='selectedTime' className='snapshot-toggle'>
        {msToString(selection.time - boundaries.minimum)}
      </div>
    }{!selection && snapshots.map((snapshot, index) => {
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
