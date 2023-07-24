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

export type KeyDefinition = {
  key?: string;
  keyCode?: number;
  keyCodeWithoutLocation?: number;
  shiftKey?: string;
  shiftKeyCode?: number;
  text?: string;
  location?: number;
  deadKeyMappings?: Record<string, string>;
  shiftDeadKeyMappings?: Record<string, string>;
};

export type KeyboardLayout =  Record<string, KeyDefinition>;

export type KeyboardLayoutMap = Record<string, KeyboardLayout>;
