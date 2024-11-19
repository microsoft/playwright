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

import '@web/common.css';
import { Expandable } from '@web/components/expandable';
import '@web/third_party/vscode/codicon.css';
import { settings } from '@web/uiUtils';
import React from 'react';
import './uiModeFiltersView.css';
import type { TeleSuiteUpdaterTestModel } from '@testIsomorphic/teleSuiteUpdater';

export const FiltersView: React.FC<{
  filterText: string;
  setFilterText: (text: string) => void;
  statusFilters: Map<string, boolean>;
  setStatusFilters: (filters: Map<string, boolean>) => void;
  projectFilters: Map<string, boolean>;
  setProjectFilters: (filters: Map<string, boolean>) => void;
  testModel: TeleSuiteUpdaterTestModel | undefined,
  runTests: () => void;
}> = ({ filterText, setFilterText, statusFilters, setStatusFilters, projectFilters, setProjectFilters, testModel, runTests }) => {
  const [expanded, setExpanded] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const statusLine = [...statusFilters.entries()].filter(([_, v]) => v).map(([s]) => s).join(' ') || 'all';
  const projectsLine = [...projectFilters.entries()].filter(([_, v]) => v).map(([p]) => p).join(' ') || 'all';
  return <div className='filters'>
    <Expandable
      expanded={expanded}
      setExpanded={setExpanded}
      title={<input ref={inputRef} type='search' placeholder='Filter (e.g. text, @tag)' spellCheck={false} value={filterText}
        onChange={e => {
          setFilterText(e.target.value);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter')
            runTests();
        }} />}>
    </Expandable>
    <div className='filter-summary' title={'Status: ' + statusLine + '\nProjects: ' + projectsLine} onClick={() => setExpanded(!expanded)}>
      <span className='filter-label'>Status:</span> {statusLine}
      <span className='filter-label'>Projects:</span> {projectsLine}
    </div>
    {expanded && <div className='hbox' style={{ marginLeft: 14, maxHeight: 200, overflowY: 'auto' }}>
      <div className='filter-list' role='list' data-testid='status-filters'>
        {[...statusFilters.entries()].map(([status, value]) => {
          return <div className='filter-entry' key={status} role='listitem'>
            <label>
              <input type='checkbox' checked={value} onChange={() => {
                const copy = new Map(statusFilters);
                copy.set(status, !copy.get(status));
                setStatusFilters(copy);
              }}/>
              <div>{status}</div>
            </label>
          </div>;
        })}
      </div>
      <div className='filter-list' role='list' data-testid='project-filters'>
        {[...projectFilters.entries()].map(([projectName, value]) => {
          return <div className='filter-entry' key={projectName}  role='listitem'>
            <label>
              <input type='checkbox' checked={value} onChange={() => {
                const copy = new Map(projectFilters);
                copy.set(projectName, !copy.get(projectName));
                setProjectFilters(copy);
                const configFile = testModel?.config?.configFile;
                if (configFile)
                  settings.setObject(configFile + ':projects', [...copy.entries()].filter(([_, v]) => v).map(([k]) => k));
              }}/>
              <div>{projectName || 'untitled'}</div>
            </label>
          </div>;
        })}
      </div>
    </div>}
  </div>;
};
