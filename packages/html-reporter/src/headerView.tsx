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
import { Link, navigate, SearchParamsContext } from './links';
import { statusIcon } from './statusIcon';
import { filterWithToken } from './filter';

export const HeaderView: React.FC<{
  stats: Stats,
  filterText: string,
  setFilterText: (filterText: string) => void,
}> = ({ stats, filterText, setFilterText }) => {
  const searchParams = React.useContext(SearchParamsContext);
  React.useEffect(() => {
    // Add an extra space such that users can easily add to query
    const query = searchParams.get('q');
    setFilterText(query ? `${query.trim()} ` : '');
  }, [searchParams, setFilterText]);

  return (<>
    <div className='pt-3'>
      <div className='header-view-status-container ml-2 pl-2 d-flex'>
        <StatsNavView stats={stats}></StatsNavView>
      </div>
      <form className='subnav-search' onSubmit={
        event => {
          event.preventDefault();
          const url = new URL(window.location.href);
          url.hash = filterText ? '?' + new URLSearchParams({ q: filterText }) : '';
          navigate(url);
        }
      }>
        {icons.search()}
        {/* Use navigationId to reset defaultValue */}
        <input spellCheck={false} className='form-control subnav-search-input input-contrast width-full' value={filterText} onChange={e => {
          setFilterText(e.target.value);
        }}></input>
      </form>
    </div>
  </>);
};

const StatsNavView: React.FC<{
  stats: Stats
}> = ({ stats }) => {
  const searchParams = React.useContext(SearchParamsContext);

  return <nav>
    <Link className='subnav-item' href='#?'>
      All <span className='d-inline counter'>{stats.total - stats.skipped}</span>
    </Link>
    <Link className='subnav-item' click={filterWithToken(searchParams, 's:passed', false)} ctrlClick={filterWithToken(searchParams, 's:passed', true)}>
      Passed <span className='d-inline counter'>{stats.expected}</span>
    </Link>
    <Link className='subnav-item' click={filterWithToken(searchParams, 's:failed', false)} ctrlClick={filterWithToken(searchParams, 's:failed', true)}>
      {!!stats.unexpected && statusIcon('unexpected')} Failed <span className='d-inline counter'>{stats.unexpected}</span>
    </Link>
    <Link className='subnav-item' click={filterWithToken(searchParams, 's:flaky', false)} ctrlClick={filterWithToken(searchParams, 's:flaky', true)}>
      {!!stats.flaky && statusIcon('flaky')} Flaky <span className='d-inline counter'>{stats.flaky}</span>
    </Link>
    <Link className='subnav-item' click={filterWithToken(searchParams, 's:skipped', false)} ctrlClick={filterWithToken(searchParams, 's:skipped', true)}>
      Skipped <span className='d-inline counter'>{stats.skipped}</span>
    </Link>
  </nav>;
};
