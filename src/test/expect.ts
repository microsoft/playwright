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

import expectLibrary from 'expect';
import {
  toBeChecked,
  toBeDisabled,
  toBeEditable,
  toBeEmpty,
  toBeEnabled,
  toBeFocused,
  toBeHidden,
  toBeSelected,
  toBeVisible,
  toContainText,
  toHaveAttr,
  toHaveClass,
  toHaveCSS,
  toHaveData,
  toHaveId,
  toHaveLength,
  toHaveProp,
  toHaveText,
  toHaveValue
} from './matchers/matchers';
import { toMatchSnapshot } from './matchers/toMatchSnapshot';
import type { Expect } from './types';

export const expect: Expect = expectLibrary as any;
expectLibrary.setState({ expand: false });
expectLibrary.extend({
  toBeChecked,
  toBeDisabled,
  toBeEditable,
  toBeEmpty,
  toBeEnabled,
  toBeFocused,
  toBeHidden,
  toBeSelected,
  toBeVisible,
  toContainText,
  toHaveAttr,
  toHaveClass,
  toHaveCSS,
  toHaveData,
  toHaveId,
  toHaveLength,
  toHaveProp,
  toHaveText,
  toHaveValue,
  toMatchSnapshot,
});
