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

import * as React from 'react';
import type * as modelUtil from './modelUtil';
import { NetworkResource } from './networkResourceDetails';
import './networkTab.css';
import type { Boundaries } from '../geometry';

export const NetworkTab: React.FunctionComponent<{
  model: modelUtil.MultiTraceModel | undefined,
  selectedTime: Boundaries | undefined,
}> = ({ model, selectedTime }) => {
  const resources = React.useMemo(() => {
    const resources = model?.resources || [];
    if (!selectedTime)
      return resources;
    return resources.filter(resource => {
      return !!resource._monotonicTime && (resource._monotonicTime >= selectedTime.minimum && resource._monotonicTime <= selectedTime.maximum);
    });
  }, [model, selectedTime]);
  return <div className='network-tab'> {
    resources.map((resource, index) => <NetworkResource key={index} resource={resource}></NetworkResource>)
  }</div>;
};
