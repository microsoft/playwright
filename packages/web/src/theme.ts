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

import React from 'react';
import { type Setting, settings } from './uiUtils';

declare global {
  interface Document {
    playwrightThemeInitialized?: boolean;
  }
}

export function applyTheme() {
  if (document.playwrightThemeInitialized)
    return;
  document.playwrightThemeInitialized = true;
  document!.defaultView!.addEventListener('focus', (event: any) => {
    if (event.target.document.nodeType === Node.DOCUMENT_NODE)
      document.body.classList.remove('inactive');
  }, false);
  document!.defaultView!.addEventListener('blur', event => {
    document.body.classList.add('inactive');
  }, false);

  const currentTheme = settings.getString('theme', 'light-mode');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  if (currentTheme === 'dark-mode' || prefersDarkScheme.matches)
    document.body.classList.add('dark-mode');
}

type Theme = 'dark-mode' | 'light-mode';

const listeners = new Set<(theme: Theme) => void>();
export function toggleTheme() {
  const oldTheme = currentTheme();
  const newTheme = oldTheme === 'dark-mode' ? 'light-mode' : 'dark-mode';

  if (oldTheme)
    document.body.classList.remove(oldTheme);
  document.body.classList.add(newTheme);
  settings.setString('theme', newTheme);
  for (const listener of listeners)
    listener(newTheme);
}

export function addThemeListener(listener: (theme: 'light-mode' | 'dark-mode') => void) {
  listeners.add(listener);
}

export function removeThemeListener(listener: (theme: Theme) => void) {
  listeners.delete(listener);
}

export function currentTheme(): Theme {
  return document.body.classList.contains('dark-mode') ? 'dark-mode' : 'light-mode';
}

export function useDarkModeSetting() {
  const [theme, setTheme] = React.useState(currentTheme() === 'dark-mode');
  return [theme, (value: boolean) => {
    const current = currentTheme() === 'dark-mode';
    if (current !== value)
      toggleTheme();
    setTheme(value);
  }, 'Dark mode'] as Setting<boolean>;
}
