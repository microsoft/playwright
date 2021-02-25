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
import { ActionList, ActionListProps } from './actionList';

export default {
  title: 'TraceViewer/ActionList',
  component: ActionList,
  backgrounds: {
    default: '#edebe9',
  }
} as Meta;

const Template: Story<ActionListProps> = args => <ActionList {...args} />;

export const Primary = Template.bind({});
Primary.args = {
  actions: [
    {
      actionId: 'id2',
      action: {
        timestamp: Date.now(),
        type: 'action',
        contextId: '<context>',
        action: 'goto',
        value: 'https://github.com/microsoft',
        startTime: Date.now(),
        endTime: Date.now(),
      },
      resources: [],
    },
    {
      actionId: 'id',
      action: {
        timestamp: Date.now(),
        type: 'action',
        contextId: '<context>',
        action: 'click',
        selector: 'input[aria-label="Find a repository…"]',
        startTime: Date.now(),
        endTime: Date.now(),
      },
      resources: [],
    }
  ]
};
