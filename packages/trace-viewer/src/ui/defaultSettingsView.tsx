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
import { type Setting, SettingsView } from './settingsView';
import { kThemeOptions, type Theme, useThemeSetting } from '@web/theme';
import { useSetting } from '@web/uiUtils';
import { canToggleAriaMode, shouldDisplayAriaMode } from './ariaModeView';

import type { TraceModel } from '@isomorphic/trace/traceModel';

/**
 * A view of the collection of standard settings used between various applications
 */
export const DefaultSettingsView: React.FC<{
  location: 'ui-mode' | 'trace-viewer',
  model?: TraceModel,
}> = ({ location, model }) => {
  const [
    shouldPopulateCanvasFromScreenshot,
    setShouldPopulateCanvasFromScreenshot,
  ] = useSetting('shouldPopulateCanvasFromScreenshot', false);
  const [displayAriaMode, setDisplayAriaMode] = useSetting('displayAriaMode', false);
  const [theme, setTheme] = useThemeSetting();
  const [mergeFiles, setMergeFiles] = useSetting('mergeFiles', false);
  const canToggleAria = canToggleAriaMode(model);

  return (
    <SettingsView
      settings={[
        {
          type: 'select',
          value: theme,
          set: setTheme,
          name: 'Theme',
          options: kThemeOptions
        } satisfies Setting<Theme>,
        ...(location === 'ui-mode' ? [{
          type: 'check',
          value: mergeFiles,
          set: setMergeFiles,
          name: 'Merge files'
        } satisfies Setting] : []),
        {
          type: 'check',
          value: shouldPopulateCanvasFromScreenshot,
          set: setShouldPopulateCanvasFromScreenshot,
          name: 'Display canvas content',
          title: 'Attempt to display the captured canvas appearance in the snapshot preview. May not be accurate.',
        },
        {
          type: 'check',
          value: shouldDisplayAriaMode(model, displayAriaMode),
          set: setDisplayAriaMode,
          name: 'Display Aria',
          disabled: !canToggleAria,
          title: canToggleAria
            ? 'Display the action screenshot and aria snapshot instead of the DOM snapshot.'
            : 'The trace does not have both DOM and aria snapshots, so there is nothing to switch between.',
        },
      ]}
    />
  );
};
