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
  component?: React.ReactElement;
  render?: () => React.ReactElement;
}

export const TabbedPane: React.FunctionComponent<{
  tabs: TabbedPaneTabModel[],
  leftToolbar?: React.ReactElement[],
  rightToolbar?: React.ReactElement[],
  selectedTab: string,
  setSelectedTab: (tab: string) => void
}> = ({ tabs, selectedTab, setSelectedTab, leftToolbar, rightToolbar }) => {
  return <div className='tabbed-pane'>
    <div className='vbox'>
      <Toolbar>{[
        ...leftToolbar || [],
        ...tabs.map(tab => (
          <TabbedPaneTab
            id={tab.id}
            title={tab.title}
            selected={selectedTab === tab.id}
            onSelect={setSelectedTab}
          ></TabbedPaneTab>)),
        <div className='spacer'></div>,
        ...rightToolbar || [],
      ]}</Toolbar>
      {
        tabs.map(tab => {
          if (tab.component)
            return <div key={tab.id} className='tab-content' style={{ display: selectedTab === tab.id ? 'inherit' : 'none' }}>{tab.component}</div>;
          if (selectedTab === tab.id)
            return <div key={tab.id} className='tab-content'>{tab.render!()}</div>;
        })
      }
    </div>
  </div>;
};

export const TabbedPaneTab: React.FunctionComponent<{
  id: string,
  title: string | JSX.Element,
  selected?: boolean,
  onSelect: (id: string) => void
}> = ({ id, title, selected, onSelect }) => {
  return <div className={'tabbed-pane-tab ' + (selected ? 'selected' : '')}
    onClick={() => onSelect(id)}
    key={id}>
    <div className='tabbed-pane-tab-label'>{title}</div>
  </div>;
};
