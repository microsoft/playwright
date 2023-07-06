/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import type { Meta } from '@storybook/react';
import { Timeline } from '../packages/trace-viewer/src';


export default {
  component: Timeline,
  title: 'TImeline',
} as Meta;

export const WorkbenchLoaderDefault = () => {
  return <Timeline model={undefined} onSelected={() => console.log('selected')} sdkLanguage={'javascript'} selectedAction={undefined} hideTimelineBars={true}/>;
};

