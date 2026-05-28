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
  const tabRefs = React.useRef<{ [key: string]: HTMLDivElement | null }>({});

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex(t => t.id === selectedTab);

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        const nextTab = tabs[(currentIndex + 1) % tabs.length];
        setSelectedTab(nextTab.id);
        tabRefs.current[nextTab.id]?.focus();
        break;

      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        const prevTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
        setSelectedTab(prevTab.id);
        tabRefs.current[prevTab.id]?.focus();
        break;

      case 'Home':
        event.preventDefault();
        setSelectedTab(tabs[0].id);
        tabRefs.current[tabs[0].id]?.focus();
        break;

      case 'End':
        event.preventDefault();
        setSelectedTab(tabs[tabs.length - 1].id);
        tabRefs.current[tabs[tabs.length - 1].id]?.focus();
        break;
    }
  };

  return <div className='tabbed-pane'>
    <div className='vbox'>
      <div className='hbox' style={{ flex: 'none' }}>
        <div className='tabbed-pane-tab-strip' role='tablist'>{
          tabs.map(tab => (
            <div
              ref={el => tabRefs.current[tab.id] = el}
              className={clsx('tabbed-pane-tab-element', selectedTab === tab.id && 'selected')}
              onClick={() => setSelectedTab(tab.id)}
              onKeyDown={handleKeyDown}
              id={`${idPrefix}-${tab.id}`}
              key={tab.id}
              role='tab'
              aria-selected={selectedTab === tab.id}
              aria-controls={`${idPrefix}-${tab.id}-panel`}
              tabIndex={selectedTab === tab.id ? 0 : -1}>
              <div className='tabbed-pane-tab-label'>{tab.title}</div>
            </div>
          ))
        }</div>
      </div>
      {
        tabs.map(tab => {
          if (selectedTab === tab.id)
            return <div key={tab.id} id={`${idPrefix}-${tab.id}-panel`} className='tab-content' role='tabpanel' aria-labelledby={`${idPrefix}-${tab.id}`} tabIndex={0}>{tab.render()}</div>;
        })
      }
    </div>
  </div>;
};
