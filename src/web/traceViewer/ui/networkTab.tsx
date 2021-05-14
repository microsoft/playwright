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

import { ActionTraceEvent } from '../../../server/trace/common/traceEvents';
import { ContextEntry } from '../../../server/trace/viewer/traceModel';
import './networkTab.css';
import * as React from 'react';
import { NetworkResourceDetails } from './networkResourceDetails';
import { ResourceSnapshot } from '../../../server/snapshot/snapshotTypes';

export const NetworkTab: React.FunctionComponent<{
  context: ContextEntry,
  action: ActionTraceEvent | undefined,
  nextAction: ActionTraceEvent | undefined,
}> = ({ context, action, nextAction }) => {
  const [selected, setSelected] = React.useState(0);

  const resources: ResourceSnapshot[] = context.resources.filter(resource => {
    return action && resource.timestamp > action.metadata.startTime && (!nextAction || resource.timestamp < nextAction.metadata.startTime);
  });
  return <div className='network-tab'>{
    resources.map((resource, index) => {
      return <NetworkResourceDetails resource={resource} key={index} index={index} selected={selected === index} setSelected={setSelected} />;
    })
  }</div>;
};
