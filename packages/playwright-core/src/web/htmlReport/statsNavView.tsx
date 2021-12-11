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

import type { Stats } from '@playwright/test/src/reporters/html';
import * as React from 'react';
import './htmlReport.css';
import { Link } from './links';
import { statusIcon } from './statusIcon';

export const StatsNavView: React.FC<{
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
