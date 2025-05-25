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

import './browserFrame.css';
import * as React from 'react';
import { CopyToClipboard } from './copyToClipboard';

export const BrowserFrame: React.FunctionComponent<{
  url?: string,
}> = ({ url }): React.ReactElement => {
  return <div className='browser-frame-header'>
    <div style={{ whiteSpace: 'nowrap' }}>
      <span className='browser-frame-dot' style={{ backgroundColor: 'rgb(242, 95, 88)' }}></span>
      <span className='browser-frame-dot' style={{ backgroundColor: 'rgb(251, 190, 60)' }}></span>
      <span className='browser-frame-dot' style={{ backgroundColor: 'rgb(88, 203, 66)' }}></span>
    </div>
    <div
      className='browser-frame-address-bar'
      title={url || 'about:blank'}
    >
      {url || 'about:blank'}
      {url && (
        <CopyToClipboard value={url} />
      )}
    </div>
    <div style={{ marginLeft: 'auto' }}>
      <div>
        <span className='browser-frame-menu-bar'></span>
        <span className='browser-frame-menu-bar'></span>
        <span className='browser-frame-menu-bar'></span>
      </div>
    </div>
  </div>;
};
