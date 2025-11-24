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

export type Setting<Value extends string = string> = {
  name: string;
  title?: string;
  count?: number;
} & ({
  type: 'check',
  value: boolean;
  set: (value: boolean) => void;
} | {
  type: 'select',
  options: Array<{ label: string, value: Value }>;
  value: Value;
  set: (value: Value) => void;
});

export const SettingsView = <Value extends string>(
  { settings }: { settings: Setting<Value>[] }
) => {
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

const renderSetting = <Value extends string>(setting: Setting<Value>, labelId: string) => {
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
          <label htmlFor={labelId}>{setting.name}{!!setting.count && <span className='setting-counter'>{setting.count}</span>}</label>
        </>
      );
    case 'select':
      return (
        <>
          <label htmlFor={labelId}>{setting.name}:{!!setting.count && <span className='setting-counter'>{setting.count}</span>}</label>
          <select id={labelId} value={setting.value} onChange={e => setting.set(e.target.value as Value)}>
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
