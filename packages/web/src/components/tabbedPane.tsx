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

import { clsx } from '../uiUtils';
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
  selectedTab?: string,
  setSelectedTab?: (tab: string) => void,
  dataTestId?: string,
  mode?: 'default' | 'select',
  overflowMode?: 'none' | 'select'
}> = ({ tabs, selectedTab, setSelectedTab, leftToolbar, rightToolbar, dataTestId, mode, overflowMode }) => {
  const id = React.useId();
  if (!selectedTab)
    selectedTab = tabs[0].id;
  if (!mode)
    mode = 'default';
  if (!overflowMode)
    overflowMode = 'none';

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [visibleTabs, setVisibleTabs] = React.useState<TabbedPaneTabModel[]>(mode !== 'select' ? tabs : []);
  const [overflowTabs, setOverflowTabs] = React.useState<TabbedPaneTabModel[]>(mode === 'select' ? tabs : []);
  const [tabWidths, setTabWidths] = React.useState<Record<string, number>>({});
  const [, setContainerWidth] = React.useState<number>(0);
  const [tabbedPaneWidth, setTabbedPaneWidth] = React.useState<number>(0);

  // Initial measurements
  const measureContainerTabs = React.useCallback(() => {
    const container = containerRef.current;
    if (!container)
      return;

    const containerWidth = container.getBoundingClientRect().width;
    setContainerWidth(containerWidth);

    const tabWidths: Record<string, number> = {};
    const tabbedPaneTabs = container.querySelectorAll('.tabbed-pane-tab');
    tabbedPaneTabs.forEach(tabbedPane => {
      const element = tabbedPane as HTMLElement;
      if (element && element.title)
        tabWidths[element.title] = tabbedPane.scrollWidth;
    });
    setTabWidths(tabWidths);

    // For width calculation: Assume the dropdown width is 1.5x of the rightmost menu item
    const tabWidthValues = Object.values(tabWidths);
    const tabbedPaneWidth =  1.5 * tabWidthValues[tabWidthValues.length - 1] || 0;
    if (tabbedPaneWidth > 0)
      setTabbedPaneWidth(tabbedPaneWidth);
  }, []);

  const calculateVisibleTabCount = React.useCallback((availableWidth: number, tabWidths: Record<string, number>, tabs: TabbedPaneTabModel[]): number => {
    let requiredWidth = 0;

    for (const tabWidth of Object.values(tabWidths)) {
      requiredWidth += tabWidth;
      if (requiredWidth > availableWidth) {
        // Overflow detected, calculate how many tabs can fit
        let visibleCount = 0;
        let cumulativeWidth = 0;

        for (let index = 0; index < tabs.length; index++) {
          const tab = tabs[index];
          const tabWidth = tabWidths[tab.title];
          cumulativeWidth += tabWidth;

          if (cumulativeWidth > availableWidth) {
            visibleCount = index;
            break;
          }
        }
        return visibleCount;
      }
    }

    return tabs.length;
  }, []);

  const adjustElementRenderings = React.useCallback(() => {
    const container = containerRef.current;
    if (!container)
      return;

    const containerWidth = container.getBoundingClientRect().width;
    setContainerWidth(containerWidth);

    const initialAvailableWidth = containerWidth - (overflowTabs.length > 0 ? tabbedPaneWidth : 0);
    const finalAvailableWidth = containerWidth - tabbedPaneWidth;

    const visibleCount = calculateVisibleTabCount(initialAvailableWidth, tabWidths, tabs) === tabs.length
      ? tabs.length
      : calculateVisibleTabCount(finalAvailableWidth, tabWidths, tabs);

    const visibleTabsList = tabs.slice(0, visibleCount);
    const overflowTabsList = tabs.slice(visibleCount);

    setVisibleTabs(visibleTabsList);
    setOverflowTabs(overflowTabsList);
  }, [tabWidths, overflowTabs, tabbedPaneWidth, tabs, calculateVisibleTabCount]);

  // Initial measurement and setup
  React.useEffect(() => {
    if (overflowMode !== 'select')
      return;

    measureContainerTabs();
  }, [measureContainerTabs, overflowMode]);

  // Adjust when Tab widths change
  React.useEffect(() => {
    if (overflowMode !== 'select')
      return;

    if (overflowTabs.length > 0)
      adjustElementRenderings();
  }, [adjustElementRenderings, overflowMode, overflowTabs.length]);

  React.useEffect(() => {
    if (overflowMode !== 'select')
      return;

    const container = containerRef.current;
    if (!container)
      return;

    const handleResize = () => {
      setTimeout(adjustElementRenderings, 0);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [adjustElementRenderings, overflowMode]);

  return <div className='tabbed-pane' data-testid={dataTestId} ref={containerRef}>
    <div className='vbox'>
      <Toolbar>
        { leftToolbar && <div style={{ flex: 'none', display: 'flex', margin: '0 4px', alignItems: 'center' }}>
          {...leftToolbar}
        </div>}
        {visibleTabs.length > 0 && <div style={{ flex: 'auto', display: 'flex', height: '100%', overflow: 'hidden' }} role='tablist'>
          {visibleTabs.map(visibleTab => {
            const tab = tabs.find(t => t.id === visibleTab.id) || visibleTab;
            return (
              <TabbedPaneTab
                key={tab.id}
                id={tab.id}
                ariaControls={`${id}-${tab.id}`}
                title={tab.title}
                count={tab.count}
                errorCount={tab.errorCount}
                selected={selectedTab === tab.id}
                onSelect={setSelectedTab}
              />
            );
          })}
        </div>}
        {overflowTabs.length > 0 && <div style={{ flex: 'auto', display: 'flex', height: '100%', overflow: 'hidden' }} role='tablist'>
          <select style={{ width: '100%', background: 'none', cursor: 'pointer' }} value={selectedTab} onChange={e => {
            setSelectedTab?.(overflowTabs[e.currentTarget.selectedIndex].id);
          }}>
            {overflowTabs.map(overflowTab => {
              const tab = tabs.find(t => t.id === overflowTab.id) || overflowTab;
              let suffix = '';
              if (tab.count)
                suffix = ` (${tab.count})`;
              if (tab.errorCount)
                suffix = ` (${tab.errorCount})`;
              return <option key={tab.id} value={tab.id} role='tab' aria-controls={`${id}-${tab.id}`}>{tab.title}{suffix}</option>;
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
            return <div key={tab.id} id={`${id}-${tab.id}`} role='tabpanel' aria-label={tab.title} className={className} style={{ display: selectedTab === tab.id ? 'inherit' : 'none' }}>{tab.component}</div>;
          if (selectedTab === tab.id)
            return <div key={tab.id} id={`${id}-${tab.id}`} role='tabpanel' aria-label={tab.title} className={className}>{tab.render!()}</div>;
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
  onSelect?: (id: string) => void,
  ariaControls?: string,
}> = ({ id, title, count, errorCount, selected, onSelect, ariaControls }) => {
  return <div className={clsx('tabbed-pane-tab', selected && 'selected')}
    onClick={() => onSelect?.(id)}
    role='tab'
    title={title}
    aria-controls={ariaControls}>
    <div className='tabbed-pane-tab-label'>{title}</div>
    {!!count && <div className='tabbed-pane-tab-counter'>{count}</div>}
    {!!errorCount && <div className='tabbed-pane-tab-counter error'>{errorCount}</div>}
  </div>;
};
