// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export * from './lib/api';
export function playwright(browser: 'chromium'): import('./lib/api').Chromium;
export function playwright(browser: 'firefox'): import('./lib/api').Firefox;
export function playwright(browser: 'webkit'): import('./lib/api').WebKit;
