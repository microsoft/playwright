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

import { clsx } from '@web/uiUtils';
import './tabbedPane.css';
import { Toolbar } from './toolbar';
import * as React from 'react';

export interface TabbedPaneTabModel {
  id: string;
  title: string;
  count?: number;
  errorCount?: number;
  component?: React.ReactElement;
  render?: () => React.ReactElement;
}

export const TabbedPane: React.FunctionComponent<{
  tabs: TabbedPaneTabModel[],
  leftToolbar?: React.ReactElement[],
  rightToolbar?: React.ReactElement[],
  selectedTab: string,
  setSelectedTab: (tab: string) => void,
  dataTestId?: string,
  mode?: 'default' | 'select',
}> = ({ tabs, selectedTab, setSelectedTab, leftToolbar, rightToolbar, dataTestId, mode }) => {
  if (!mode)
    mode = 'default';
  return <div className='tabbed-pane' data-testid={dataTestId}>
    <div className='vbox'>
      <Toolbar>
        { leftToolbar && <div style={{ flex: 'none', display: 'flex', margin: '0 4px', alignItems: 'center' }}>
          {...leftToolbar}
        </div>}
        {mode === 'default' && <div style={{ flex: 'auto', display: 'flex', height: '100%', overflow: 'hidden' }}>
          {[...tabs.map(tab => (
            <TabbedPaneTab
              key={tab.id}
              id={tab.id}
              title={tab.title}
              count={tab.count}
              errorCount={tab.errorCount}
              selected={selectedTab === tab.id}
              onSelect={setSelectedTab}
            ></TabbedPaneTab>)),
          ]}
        </div>}
        {mode === 'select' && <div style={{ flex: 'auto', display: 'flex', height: '100%', overflow: 'hidden' }}>
          <select style={{ width: '100%', background: 'none', cursor: 'pointer' }} onChange={e => {
            setSelectedTab(tabs[e.currentTarget.selectedIndex].id);
          }}>
            {tabs.map(tab => {
              let suffix = '';
              if (tab.count)
                suffix = ` (${tab.count})`;
              if (tab.errorCount)
                suffix = ` (${tab.errorCount})`;
              return <option key={tab.id} value={tab.id} selected={tab.id === selectedTab}>{tab.title}{suffix}</option>;
            })}
          </select>
        </div>}
        {rightToolbar && <div style={{ flex: 'none', display: 'flex', alignItems: 'center' }}>
          {...rightToolbar}
        </div>}
      </Toolbar>
      {
        tabs.map(tab => {
          const className = 'tab-content tab-' + tab.id;
          if (tab.component)
            return <div key={tab.id} className={className} style={{ display: selectedTab === tab.id ? 'inherit' : 'none' }}>{tab.component}</div>;
          if (selectedTab === tab.id)
            return <div key={tab.id} className={className}>{tab.render!()}</div>;
        })
      }
    </div>
  </div>;
};

export const TabbedPaneTab: React.FunctionComponent<{
  id: string,
  title: string,
  count?: number,
  errorCount?: number,
  selected?: boolean,
  onSelect: (id: string) => void
}> = ({ id, title, count, errorCount, selected, onSelect }) => {
  return <div className={clsx('tabbed-pane-tab', selected && 'selected')}
    onClick={() => onSelect(id)}
    title={title}
    key={id}>
    <div className='tabbed-pane-tab-label'>{title}</div>
    {!!count && <div className='tabbed-pane-tab-counter'>{count}</div>}
    {!!errorCount && <div className='tabbed-pane-tab-counter error'>{errorCount}</div>}
  </div>;
};
