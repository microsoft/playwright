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

export type Setting = {
  name: string;
  title?: string;
} & ({
  type: 'check',
  value: boolean;
  set: (value: boolean) => void;
} | {
  type: 'select',
  options: Array<{ label: string, value: string }>;
  value: string;
  set: (value: string) => void;
});

export const SettingsView: React.FunctionComponent<{
  settings: Setting[];
}> = ({ settings }) => {
  return (
    <div className='vbox settings-view'>
      {settings.map(setting => {
        const labelId = `setting-${setting.name.replaceAll(/\s+/g, '-')}`;

        return (
          <div key={setting.name} className={`setting setting-${setting.type}`} title={setting.title}>
            {renderSetting(setting, labelId)}
          </div>
        );
      })}
    </div>
  );
};

const renderSetting = (setting: Setting, labelId: string) => {
  switch (setting.type) {
    case 'check':
      return (
        <>
          <input
            type='checkbox'
            id={labelId}
            checked={setting.value}
            onChange={() => setting.set(!setting.value)}
          />
          <label htmlFor={labelId}>{setting.name}</label>
        </>
      );
    case 'select':
      return (
        <>
          <label htmlFor={labelId}>{setting.name}:</label>
          <select id={labelId} value={setting.value} onChange={e => setting.set(e.target.value)}>
            {setting.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      );
    default:
      return null;
  }
};
