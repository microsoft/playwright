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

import { useDarkModeSetting } from '@web/theme';
import { useSetting } from '@web/uiUtils';
import type { Setting } from './settingsView';

export function useDarkModeCheckbox(): Setting {
  const [darkMode, setDarkMode] = useDarkModeSetting();
  return {
    type: 'check',
    value: darkMode,
    set: setDarkMode,
    name: 'Dark mode'
  };
}

export function useMergeFilesCheckbox(): Setting {
  const [mergeFiles, setMergeFiles] = useSetting('mergeFiles', false);
  return {
    type: 'check',
    value: mergeFiles,
    set: setMergeFiles,
    name: 'Merge files'
  };
}

export function usePopulateCanvasCheckbox(): Setting {
  const [
    shouldPopulateCanvasFromScreenshot,
    setShouldPopulateCanvasFromScreenshot,
  ] = useSetting('shouldPopulateCanvasFromScreenshot', false);
  return {
    type: 'check',
    value: shouldPopulateCanvasFromScreenshot,
    set: setShouldPopulateCanvasFromScreenshot,
    name: 'Display canvas content',
    title: 'Attempt to display the captured canvas appearance in the snapshot preview. May not be accurate.',
  };
}
