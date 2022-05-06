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

import type { Fixtures, TestError, Project, TestPlugin } from '../types/test';
import type { Location } from '../types/testReporter';
import type { FullConfig as FullConfigPublic, FullProject as FullProjectPublic } from './types';
export * from '../types/test';
export type { Location } from '../types/testReporter';

export type FixturesWithLocation = {
  fixtures: Fixtures;
  location: Location;
};
export type Annotation = { type: string, description?: string };

export interface TestStepInternal {
  complete(result: { error?: Error | TestError }): void;
  title: string;
  category: string;
  canHaveChildren: boolean;
  forceNoParent: boolean;
  location?: Location;
  refinedTitle?: string;
}

/**
 * FullConfigInternal allows the plumbing of configuration details throughout the Test Runner without
 * increasing the surface area of the public API type called FullConfig.
 */
export interface FullConfigInternal extends FullConfigPublic {
  _globalOutputDir: string;
  _configDir: string;
  _testGroupsCount: number;
  _plugins: TestPlugin[];

  // Overrides the public field.
  projects: FullProjectInternal[];
}

/**
 * FullProjectInternal allows the plumbing of configuration details throughout the Test Runner without
 * increasing the surface area of the public API type called FullProject.
 */
export interface FullProjectInternal extends FullProjectPublic {
  _fullyParallel: boolean;
  _expect: Project['expect'];
  _screenshotsDir: string;
}
