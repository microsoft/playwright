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

import * as icons from './icons';
import './colors.css';
import './common.css';

export function statusIcon(status: 'failed' | 'timedOut' | 'skipped' | 'passed' | 'expected' | 'unexpected' | 'flaky' | 'interrupted'): JSX.Element {
  switch (status) {
    case 'failed':
    case 'unexpected':
      return icons.cross();
    case 'passed':
    case 'expected':
      return icons.check();
    case 'timedOut':
      return icons.clock();
    case 'flaky':
      return icons.warning();
    case 'skipped':
    case 'interrupted':
      return icons.blank();
  }
}
