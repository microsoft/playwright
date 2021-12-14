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

import React from 'react';
import { Chip } from './chip';
import { registerComponent } from '../test/component';

const ChipComponent: React.FC<{
  title?: string
}> = ({ title }) => {
  const [expanded, setExpanded] = React.useState(true);
  return <Chip header={title || 'Title'} expanded={expanded} setExpanded={setExpanded}>
    Chip body
  </Chip>;
};
registerComponent('ChipComponent', ChipComponent, {
  viewport: { width: 500, height: 500 },
});

const ChipComponentWithFunctions: React.FC<{
  setExpanded: (expanded: boolean) => void,
}> = ({ setExpanded }) => {
  return <Chip header='Title' expanded={false} setExpanded={setExpanded}>
    Chip body
  </Chip>;
};
registerComponent('ChipComponentWithFunctions', ChipComponentWithFunctions, {
  viewport: { width: 500, height: 500 },
});
