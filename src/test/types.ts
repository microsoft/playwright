/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import type { Fixtures } from '../../types/test';
import type { Location } from '../../types/testReporter';
export * from '../../types/test';
export { Location } from '../../types/testReporter';

export type FixturesWithLocation = {
  fixtures: Fixtures;
  location: Location;
};
export type Annotations = { type: string, description?: string }[];
