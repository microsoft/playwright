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

export function applyTheme() {
  if ((document as any).playwrightThemeInitialized)
    return;
  (document as any).playwrightThemeInitialized = true;
  document!.defaultView!.addEventListener('focus', (event: any) => {
    if (event.target.document.nodeType === Node.DOCUMENT_NODE)
      document.body.classList.remove('inactive');
  }, false);
  document!.defaultView!.addEventListener('blur', event => {
    document.body.classList.add('inactive');
  }, false);

  const currentTheme = localStorage.getItem('theme');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  if (currentTheme === 'dark-mode' || prefersDarkScheme.matches)
    document.body.classList.add('dark-mode');
}

export function toggleTheme() {
  const oldTheme = localStorage.getItem('theme');
  let newTheme: string;
  if (oldTheme === 'dark-mode')
    newTheme = 'light-mode';
  else
    newTheme = 'dark-mode';

  if (oldTheme)
    document.body.classList.remove(oldTheme);
  document.body.classList.add(newTheme);
  localStorage.setItem('theme', newTheme);
}
