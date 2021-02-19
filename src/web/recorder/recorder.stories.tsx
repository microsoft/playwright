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

import { Story, Meta } from '@storybook/react/types-6-0';
import React from 'react';
import { exampleCallLog } from './callLog.example';
import { Recorder, RecorderProps } from './recorder';

export default {
  title: 'Recorder/Recorder',
  component: Recorder,
  parameters: {
    viewport: {
      defaultViewport: 'recorder'
    }
  }
} as Meta;

const Template: Story<RecorderProps> = args => <Recorder {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  sources: [],
  paused: false,
  log: [],
  mode: 'none'
};

export const OneSource = Template.bind({});
OneSource.args = {
  sources: [
    {
      file: '<one>',
      text: '// Text One',
      language: 'javascript',
      highlight: [],
    },
  ],
  paused: false,
  log: [],
  mode: 'none'
};

export const TwoSources = Template.bind({});
TwoSources.args = {
  sources: [
    {
      file: '<one>',
      text: '// Text One',
      language: 'javascript',
      highlight: [],
    },
    {
      file: '<two>',
      text: '// Text Two',
      language: 'javascript',
      highlight: [],
    },
  ],
  paused: false,
  log: [],
  mode: 'none'
};

export const WithLog = Template.bind({});
WithLog.args = {
  sources: [
  ],
  paused: false,
  log: exampleCallLog(),
  mode: 'none'
};

export const Inspecting = Template.bind({});
Inspecting.args = {
  sources: [],
  paused: false,
  log: [],
  mode: 'inspecting',
  initialSelector: 'text=Find me'
};

export const Recording = Template.bind({});
Recording.args = {
  sources: [
    {
      file: '<javascript>',
      text: `await page.click('button');\n\nawait page.click('button');\n`,
      language: 'javascript',
      highlight: [],
    },
  ],
  paused: false,
  log: [],
  mode: 'recording',
};
