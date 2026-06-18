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

import { clsx, handleTabListKeyDown } from '@web/uiUtils';
import './colors.css';
import './tabbedPane.css';
import * as React from 'react';

export interface TabbedPaneTab {
  id: string;
  title: string | React.JSX.Element;
  count?: number;
  render: () => React.ReactElement;
}

export const TabbedPane: React.FunctionComponent<{
  tabs: TabbedPaneTab[],
  selectedTab: string,
  setSelectedTab: (tab: string) => void
}> = ({ tabs, selectedTab, setSelectedTab }) => {
  const idPrefix = React.useId();
  const tabStripRef = React.useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const nextIndex = handleTabListKeyDown(e, tabStripRef.current);
    if (nextIndex !== -1)
      setSelectedTab(tabs[nextIndex].id);
  };

  return <div className='tabbed-pane'>
    <div className='vbox'>
      <div className='hbox' style={{ flex: 'none' }}>
        <div className='tabbed-pane-tab-strip' role='tablist' onKeyDown={handleKeyDown} ref={tabStripRef}>{
          tabs.map(tab => (
            <div className={clsx('tabbed-pane-tab-element', selectedTab === tab.id && 'selected')}
              onClick={() => setSelectedTab(tab.id)}
              id={`${idPrefix}-${tab.id}`}
              key={tab.id}
              role='tab'
              tabIndex={selectedTab === tab.id ? 0 : -1}
              aria-selected={selectedTab === tab.id}>
              <div className='tabbed-pane-tab-label'>{tab.title}</div>
            </div>
          ))
        }</div>
      </div>
      {
        tabs.map(tab => {
          if (selectedTab === tab.id)
            return <div key={tab.id} className='tab-content' role='tabpanel' aria-labelledby={`${idPrefix}-${tab.id}`}>{tab.render()}</div>;
        })
      }
    </div>
  </div>;
};
