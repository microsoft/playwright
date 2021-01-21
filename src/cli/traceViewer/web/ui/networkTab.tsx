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

import { ActionEntry } from '../../traceModel';
import './networkTab.css';
import * as React from 'react';
import { Expandable } from './helpers';

export const NetworkTab: React.FunctionComponent<{
  actionEntry: ActionEntry | undefined,
}> = ({ actionEntry }) => {
  const [selected, setSelected] = React.useState(0);
  return <div className='network-tab'>{
    (actionEntry ? actionEntry.resources : []).map((resource, index) => {
      return <div key={index}
        className={'network-request ' + (index === selected ? 'selected' : '')}
        onClick={() => setSelected(index)}>
        <Expandable style={{ width: '100%' }} title={
          <div className='network-request-title'><div>{resource.url}</div></div>
        } body={
          <div className='network-request-details'>{resource.responseHeaders.map(pair => `${pair.name}: ${pair.value}`).join('\n')}</div>
        }/>
      </div>;
    })
  }</div>;
};
