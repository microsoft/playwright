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

import { ActionEntry } from '../../traceModel';
import { Size } from '../geometry';
import { NetworkTab } from './networkTab';
import { SourceTab } from './sourceTab';
import './propertiesTabbedPane.css';
import * as React from 'react';
import { useMeasure } from './helpers';
import { LogsTab } from './logsTab';

export const PropertiesTabbedPane: React.FunctionComponent<{
  actionEntry: ActionEntry | undefined,
  snapshotSize: Size,
}> = ({ actionEntry, snapshotSize }) => {
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
        <SnapshotTab actionEntry={actionEntry} snapshotSize={snapshotSize} />
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
}> = ({ actionEntry, snapshotSize }) => {
  const [measure, ref] = useMeasure<HTMLDivElement>();

  const iframeRef = React.createRef<HTMLIFrameElement>();
  React.useEffect(() => {
    if (iframeRef.current && !actionEntry)
      iframeRef.current.src = 'about:blank';
  }, [actionEntry, iframeRef]);

  React.useEffect(() => {
    if (actionEntry)
      (window as any).renderSnapshot(actionEntry.action);
  }, [actionEntry]);

  const scale = Math.min(measure.width / snapshotSize.width, measure.height / snapshotSize.height);
  return <div ref={ref} className='snapshot-wrapper'>
    <div className='snapshot-container' style={{
      width: snapshotSize.width + 'px',
      height: snapshotSize.height + 'px',
      transform: `translate(${-snapshotSize.width * (1 - scale) / 2}px, ${-snapshotSize.height * (1 - scale) / 2}px) scale(${scale})`,
    }}>
      <iframe ref={iframeRef} id='snapshot' name='snapshot'></iframe>
    </div>
  </div>;
};
