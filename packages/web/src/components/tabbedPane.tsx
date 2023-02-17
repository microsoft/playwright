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

import './tabbedPane.css';
import { Toolbar } from './toolbar';
import * as React from 'react';

export interface TabbedPaneTabModel {
  id: string;
  title: string | JSX.Element;
  count?: number;
  render: () => React.ReactElement;
}

export const TabbedPane: React.FunctionComponent<{
  tabs: TabbedPaneTabModel[],
  selectedTab: string,
  setSelectedTab: (tab: string) => void
}> = ({ tabs, selectedTab, setSelectedTab }) => {
  return <div className='tabbed-pane'>
    <div className='vbox'>
      <Toolbar>{
        tabs.map(tab => (
          <TabbedPaneTab
            id={tab.id}
            title={tab.title}
            count={tab.count}
            selected={selectedTab === tab.id}
            onSelect={setSelectedTab}
          ></TabbedPaneTab>
        ))
      }</Toolbar>
      {
        tabs.map(tab => {
          if (selectedTab === tab.id)
            return <div key={tab.id} className='tab-content'>{tab.render()}</div>;
        })
      }
    </div>
  </div>;
};

export const TabbedPaneTab: React.FunctionComponent<{
  id: string,
  title: string | JSX.Element,
  count?: number,
  selected?: boolean,
  onSelect: (id: string) => void
}> = ({ id, title, count, selected, onSelect }) => {
  return <div className={'tabbed-pane-tab ' + (selected ? 'selected' : '')}
    onClick={() => onSelect(id)}
    key={id}>
    <div className='tabbed-pane-tab-label'>{title}</div>
    <div className='tabbed-pane-tab-count'>{count || ''}</div>
  </div>;
};
