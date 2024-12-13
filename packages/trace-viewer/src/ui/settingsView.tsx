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
import './settingsView.css';

export type Setting<T> = {
  value: T;
  set: (value: T) => void;
  name: string;
  title?: string;
};

export const SettingsView: React.FunctionComponent<{
  settings: Setting<boolean>[];
}> = ({ settings }) => {
  return (
    <div className='vbox settings-view'>
      {settings.map(({ value, set, name, title }) => {
        const labelId = `setting-${name}`;

        return (
          <div key={name} className='setting' title={title}>
            <input
              type='checkbox'
              id={labelId}
              checked={value}
              onChange={() => set(!value)}
            />
            <label htmlFor={labelId}>{name}</label>
          </div>
        );
      })}
    </div>
  );
};
