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

import * as React from 'react';
import { SettingsView } from './settingsView';
import { useDarkModeSetting } from '@web/theme';
import { useSetting } from '@web/uiUtils';

/**
 * A view of the collection of standard settings used between various applications
 */
export const DefaultSettingsView: React.FC<{}> = () => {
  const [
    shouldPopulateCanvasFromScreenshot,
    setShouldPopulateCanvasFromScreenshot,
  ] = useSetting('shouldPopulateCanvasFromScreenshot', false);
  const [hideFiles, setHideFiles] = useSetting('hideFiles', false);
  const [darkMode, setDarkMode] = useDarkModeSetting();

  return (
    <SettingsView
      settings={[
        {
          type: 'check',
          value: darkMode,
          set: setDarkMode,
          name: 'Dark mode'
        },
        {
          type: 'check',
          value: hideFiles,
          set: setHideFiles,
          name: 'Hide files'
        },
        {
          type: 'check',
          value: shouldPopulateCanvasFromScreenshot,
          set: setShouldPopulateCanvasFromScreenshot,
          name: 'Display canvas content',
          title: 'Attempt to display the captured canvas appearance in the snapshot preview. May not be accurate.',
        },
      ]}
    />
  );
};
