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
import './overviewGrid.css';

import type { Tab } from './dashboardChannel';
import type { DashboardModel } from './dashboardModel';

type OverviewGridProps = {
  model: DashboardModel;
};

export const OverviewGrid: React.FC<OverviewGridProps> = ({ model }) => {
  const { tabs, liveFrames } = model.state;
  const items = tabs ?? [];
  return (
    <div className='overview-grid' role='list' aria-label='All tabs overview'>
      {items.length === 0 && (
        <div className='overview-empty' role='status' aria-live='polite'>No open tabs.</div>
      )}
      {items.map(tab => (
        <OverviewTile
          key={tab.page}
          tab={tab}
          frame={liveFrames.get(tab.page)}
          onClick={() => model.selectTab(tab)}
        />
      ))}
    </div>
  );
};

type OverviewTileProps = {
  tab: Tab;
  frame: { data: string } | undefined;
  onClick: () => void;
};

const OverviewTile: React.FC<OverviewTileProps> = ({ tab, frame, onClick }) => {
  return (
    <button
      className='overview-tile'
      role='listitem'
      onClick={onClick}
      title={tab.title || tab.url}
    >
      <div className='overview-tile-chrome'>
        <div className='overview-tile-omnibox'>{tab.url || 'about:blank'}</div>
      </div>
      <div className='overview-tile-screen'>
        {frame
          ? <img alt='' src={'data:image/jpeg;base64,' + frame.data} />
          : <div className='overview-tile-placeholder' aria-hidden='true' />}
      </div>
    </button>
  );
};
