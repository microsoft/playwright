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

import { settings } from './uiUtils';

declare global {
  interface Document {
    playwrightThemeInitialized?: boolean;
  }
}

type DocumentTheme = 'dark-mode' | 'light-mode';
export type Theme = DocumentTheme | 'system';

const kDefaultTheme: Theme = 'system';
const kThemeSettingsKey = 'theme';
export const kThemeOptions: { label: string; value: Theme }[] = [
  { label: 'Dark mode', value: 'dark-mode' },
  { label: 'Light mode', value: 'light-mode' },
  { label: 'System', value: 'system' },
] as const satisfies { label: string; value: Theme }[];

const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

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

  updateDocumentTheme(currentTheme());

  prefersDarkScheme.addEventListener('change', () => {
    updateDocumentTheme(currentTheme());
  });
}

const listeners = new Set<(theme: DocumentTheme) => void>();
function updateDocumentTheme(newTheme: Theme) {
  const oldDocumentTheme = currentDocumentTheme();
  const newDocumentTheme = newTheme === 'system'
    ? (prefersDarkScheme.matches ? 'dark-mode' : 'light-mode')
    : newTheme;

  if (oldDocumentTheme === newDocumentTheme)
    return;

  if (oldDocumentTheme)
    document.documentElement.classList.remove(oldDocumentTheme);
  document.documentElement.classList.add(newDocumentTheme);
  for (const listener of listeners)
    listener(newDocumentTheme);
}

export function addThemeListener(listener: (theme: DocumentTheme) => void) {
  listeners.add(listener);
}

export function removeThemeListener(listener: (theme: DocumentTheme) => void) {
  listeners.delete(listener);
}

function currentTheme(): Theme {
  return settings.getString(kThemeSettingsKey, kDefaultTheme);
}

export function currentDocumentTheme(): DocumentTheme | null {
  if (document.documentElement.classList.contains('dark-mode'))
    return 'dark-mode';
  if (document.documentElement.classList.contains('light-mode'))
    return 'light-mode';
  return null;
}

export function useThemeSetting(): [Theme, (value: Theme) => void] {
  const [theme, setTheme] = React.useState<Theme>(currentTheme());

  React.useEffect(() => {
    settings.setString(kThemeSettingsKey, theme);
    updateDocumentTheme(theme);
  }, [theme]);

  return [theme, setTheme];
}
