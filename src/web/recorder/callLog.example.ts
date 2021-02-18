/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the 'License');
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an 'AS IS' BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import { CallLog } from '../../server/supplements/recorder/recorderTypes';

export function exampleCallLog(): CallLog[] {
  return [
    {
      'id': 3,
      'messages': [],
      'title': 'newPage',
      'status': 'done',
      'duration': 100,
      'params': {}
    },
    {
      'id': 4,
      'messages': [
        'navigating to "https://github.com/microsoft", waiting until "load"',
      ],
      'title': 'goto',
      'status': 'done',
      'params': {
        'url': 'https://github.com/microsoft'
      },
      'duration': 1100,
    },
    {
      'id': 5,
      'messages': [
        'waiting for selector "input[aria-label="Find a repository…"]"',
        '  selector resolved to visible <input name="q" value=" type="search" autocomplete="of…/>',
        'attempting click action',
        '  waiting for element to be visible, enabled and stable',
        '  element is visible, enabled and stable',
        '  scrolling into view if needed',
        '  done scrolling',
        '  checking that element receives pointer events at (351.6,291)',
        '  element does receive pointer events',
        '  performing click action'
      ],
      'title': 'click',
      'status': 'paused',
      'params': {
        'selector': 'input[aria-label="Find a repository…"]'
      },
    },
    {
      'id': 6,
      'messages': [
        'navigating to "https://github.com/microsoft", waiting until "load"',
      ],
      'error': 'Error occured',
      'title': 'error',
      'status': 'error',
      'params': {
      },
    },
  ];
}
