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

import { AutoChip, Chip } from './src/chip';
import { HeaderView } from './src/headerView';
import { TestCaseView } from './src/testCaseView';
import './src/theme.css';
import { registerComponent } from './test/component';

registerComponent('HeaderView', HeaderView);
registerComponent('Chip', Chip);
registerComponent('TestCaseView', TestCaseView);
registerComponent('AutoChip', AutoChip);
