// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

export * from './lib/api';
export function playwright(browser: 'chromium'): import('./lib/api').ChromiumPlaywright;
export function playwright(browser: 'firefox'): import('./lib/api').FirefoxPlaywright;
export function playwright(browser: 'webkit'): import('./lib/api').WebKitPlaywright;
