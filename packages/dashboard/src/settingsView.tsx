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

import React from 'react';
import './settingsView.css';
import { kThemeOptions, type Theme, useThemeSetting } from '@web/theme';
import { GearIcon } from './icons';

export const SettingsButton: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [theme, setTheme] = useThemeSetting();
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open)
      return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape')
        setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className='settings-button-container'>
      <button
        className={'settings-gear-btn' + (open ? ' open' : '')}
        title='Settings'
        onClick={() => setOpen(!open)}
      >
        <GearIcon />
      </button>
      {open && (
        <div className='settings-popup'>
          <div className='setting-row'>
            <span className='setting-label'>Theme</span>
            <div className='setting-options'>
              {kThemeOptions.map(o => (
                <div
                  key={o.value}
                  className={'setting-option' + (theme === o.value ? ' selected' : '')}
                  onClick={() => { setTheme(o.value as Theme); setOpen(false); }}
                >
                  {o.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
