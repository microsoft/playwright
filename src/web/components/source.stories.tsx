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
import { Source, SourceProps } from './source';
import { exampleText } from './source.example';

export default {
  title: 'Components/Source',
  component: Source,
  parameters: {
    viewport: {
      defaultViewport: 'recorder'
    }
  }
} as Meta;

const Template: Story<SourceProps> = args => <Source {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  language: 'javascript',
  text: exampleText()
};

export const RunningOnLine = Template.bind({});
RunningOnLine.args = {
  language: 'javascript',
  text: exampleText(),
  highlight: [
    { line: 15, type: 'running' },
  ]
};

export const PausedOnLine = Template.bind({});
PausedOnLine.args = {
  language: 'javascript',
  text: exampleText(),
  highlight: [
    { line: 15, type: 'paused' },
  ]
};

export const ErrorOnLine = Template.bind({});
ErrorOnLine.args = {
  language: 'javascript',
  text: exampleText(),
  highlight: [
    { line: 15, type: 'error' },
  ]
};
