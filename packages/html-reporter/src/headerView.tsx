/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { Stats } from './types';
import * as React from 'react';
import './colors.css';
import './common.css';
import './headerView.css';
import * as icons from './icons';
import { Link, navigate } from './links';
import { statusIcon } from './statusIcon';
import { msToString } from './uiUtils';

export const HeaderView: React.FC<React.PropsWithChildren<{
  stats: Stats,
  filterText: string,
  setFilterText: (filterText: string) => void,
  projectNames: string[],
}>> = ({ stats, filterText, setFilterText, projectNames }) => {
  React.useEffect(() => {
    (async () => {
      window.addEventListener('popstate', () => {
        const params = new URLSearchParams(window.location.hash.slice(1));
        setFilterText(params.get('q') || '');
      });
    })();
  });

  return (<>
    <div className='pt-3'>
      <div className='header-view-status-container ml-2 pl-2 d-flex'>
        <StatsNavView stats={stats}></StatsNavView>
      </div>
      <form className='subnav-search' onSubmit={
        event => {
          event.preventDefault();
          navigate(`#?q=${filterText ? encodeURIComponent(filterText) : ''}`);
        }
      }>
        {icons.search()}
        {/* Use navigationId to reset defaultValue */}
        <input type='search' spellCheck={false} className='form-control subnav-search-input input-contrast width-full' value={filterText} onChange={e => {
          setFilterText(e.target.value);
        }}></input>
      </form>
    </div>
    <div className='pt-2'>
      {projectNames.length === 1 && !!projectNames[0] && <span data-testid="project-name" style={{ color: 'var(--color-fg-subtle)', float: 'left' }}>Project: {projectNames[0]}</span>}
      <span data-testid="overall-duration" style={{ color: 'var(--color-fg-subtle)', paddingRight: '10px', float: 'right' }}>Total time: {msToString(stats.duration)}</span>
    </div>
  </>);
};

const StatsNavView: React.FC<{
  stats: Stats
}> = ({ stats }) => {
  return <nav className='d-flex no-wrap'>
    <Link className='subnav-item' href='#?'>
      All <span className='d-inline counter'>{stats.total}</span>
    </Link>
    <Link className='subnav-item' href='#?q=s:passed'>
      Passed <span className='d-inline counter'>{stats.expected}</span>
    </Link>
    <Link className='subnav-item' href='#?q=s:failed'>
      {!!stats.unexpected && statusIcon('unexpected')} Failed <span className='d-inline counter'>{stats.unexpected}</span>
    </Link>
    <Link className='subnav-item' href='#?q=s:flaky'>
      {!!stats.flaky && statusIcon('flaky')} Flaky <span className='d-inline counter'>{stats.flaky}</span>
    </Link>
    <Link className='subnav-item' href='#?q=s:skipped'>
      Skipped <span className='d-inline counter'>{stats.skipped}</span>
    </Link>
  </nav>;
};
