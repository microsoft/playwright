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

import { z } from 'playwright-core/lib/mcpBundle';
import { declareCommand } from './command';

import type { AnyCommandSchema } from './command';

const numberArg = z.preprocess((val, ctx) => {
  const number = Number(val);
  if (Number.isNaN(number)) {
    ctx.issues.push({
      code: 'custom',
      message: `expected number, received '${val}'`,
      input: val,
    });
  }
  return number;
}, z.number());

// Navigation commands

const open = declareCommand({
  name: 'open',
  description: 'Open the browser',
  category: 'core',
  args: z.object({
    url: z.string().optional().describe('The URL to navigate to'),
  }),
  options: z.object({
    browser: z.string().optional().describe('Browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.'),
    config: z.string().optional().describe('Path to the configuration file, defaults to .playwright/cli.config.json'),
    extension: z.boolean().optional().describe('Connect to browser extension'),
    headed: z.boolean().optional().describe('Run browser in headed mode'),
    persistent: z.boolean().optional().describe('Use persistent browser profile'),
    profile: z.string().optional().describe('Use persistent browser profile, store profile in specified directory.'),
  }),
  toolName: ({ url }) => url ? 'browser_navigate' : 'browser_snapshot',
  toolParams: ({ url }) => ({ url: url || 'about:blank' }),
});

const close = declareCommand({
  name: 'close',
  description: 'Close the browser',
  category: 'core',
  args: z.object({}),
  toolName: '',
  toolParams: () => ({}),
});

const goto = declareCommand({
  name: 'goto',
  description: 'Navigate to a URL',
  category: 'core',
  args: z.object({
    url: z.string().describe('The URL to navigate to'),
  }),
  toolName: 'browser_navigate',
  toolParams: ({ url }) => ({ url }),
});

const goBack = declareCommand({
  name: 'go-back',
  description: 'Go back to the previous page',
  category: 'navigation',
  args: z.object({}),
  toolName: 'browser_navigate_back',
  toolParams: () => ({}),
});

const goForward = declareCommand({
  name: 'go-forward',
  description: 'Go forward to the next page',
  category: 'navigation',
  args: z.object({}),
  toolName: 'browser_navigate_forward',
  toolParams: () => ({}),
});

const reload = declareCommand({
  name: 'reload',
  description: 'Reload the current page',
  category: 'navigation',
  args: z.object({}),
  toolName: 'browser_reload',
  toolParams: () => ({}),
});

// Keyboard

const pressKey = declareCommand({
  name: 'press',
  description: 'Press a key on the keyboard, `a`, `ArrowLeft`',
  category: 'keyboard',
  args: z.object({
    key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
  }),
  toolName: 'browser_press_key',
  toolParams: ({ key }) => ({ key }),
});

const type = declareCommand({
  name: 'type',
  description: 'Type text into editable element',
  category: 'core',
  args: z.object({
    text: z.string().describe('Text to type into the element'),
  }),
  options: z.object({
    submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
  }),
  toolName: 'browser_press_sequentially',
  toolParams: ({ text, submit }) => ({ text, submit }),
});

const keydown = declareCommand({
  name: 'keydown',
  description: 'Press a key down on the keyboard',
  category: 'keyboard',
  args: z.object({
    key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
  }),
  toolName: 'browser_keydown',
  toolParams: ({ key }) => ({ key }),
});

const keyup = declareCommand({
  name: 'keyup',
  description: 'Press a key up on the keyboard',
  category: 'keyboard',
  args: z.object({
    key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
  }),
  toolName: 'browser_keyup',
  toolParams: ({ key }) => ({ key }),
});

// Mouse

const mouseMove = declareCommand({
  name: 'mousemove',
  description: 'Move mouse to a given position',
  category: 'mouse',
  args: z.object({
    x: numberArg.describe('X coordinate'),
    y: numberArg.describe('Y coordinate'),
  }),
  toolName: 'browser_mouse_move_xy',
  toolParams: ({ x, y }) => ({ x, y }),
});

const mouseDown = declareCommand({
  name: 'mousedown',
  description: 'Press mouse down',
  category: 'mouse',
  args: z.object({
    button: z.string().optional().describe('Button to press, defaults to left'),
  }),
  toolName: 'browser_mouse_down',
  toolParams: ({ button }) => ({ button }),
});

const mouseUp = declareCommand({
  name: 'mouseup',
  description: 'Press mouse up',
  category: 'mouse',
  args: z.object({
    button: z.string().optional().describe('Button to press, defaults to left'),
  }),
  toolName: 'browser_mouse_up',
  toolParams: ({ button }) => ({ button }),
});

const mouseWheel = declareCommand({
  name: 'mousewheel',
  description: 'Scroll mouse wheel',
  category: 'mouse',
  args: z.object({
    dx: numberArg.describe('Y delta'),
    dy: numberArg.describe('X delta'),
  }),
  toolName: 'browser_mouse_wheel',
  toolParams: ({ dx: deltaY, dy: deltaX }) => ({ deltaY, deltaX }),
});

// Core

const click = declareCommand({
  name: 'click',
  description: 'Perform click on a web page',
  category: 'core',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
    button: z.string().optional().describe('Button to click, defaults to left'),
  }),
  options: z.object({
    modifiers: z.array(z.string()).optional().describe('Modifier keys to press'),
  }),
  toolName: 'browser_click',
  toolParams: ({ ref, button, modifiers }) => ({ ref, button, modifiers }),
});

const doubleClick = declareCommand({
  name: 'dblclick',
  description: 'Perform double click on a web page',
  category: 'core',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
    button: z.string().optional().describe('Button to click, defaults to left'),
  }),
  options: z.object({
    modifiers: z.array(z.string()).optional().describe('Modifier keys to press'),
  }),
  toolName: 'browser_click',
  toolParams: ({ ref, button, modifiers }) => ({ ref, button, modifiers, doubleClick: true }),
});

const drag = declareCommand({
  name: 'drag',
  description: 'Perform drag and drop between two elements',
  category: 'core',
  args: z.object({
    startRef: z.string().describe('Exact source element reference from the page snapshot'),
    endRef: z.string().describe('Exact target element reference from the page snapshot'),
  }),
  toolName: 'browser_drag',
  toolParams: ({ startRef, endRef }) => ({ startRef, endRef }),
});

const fill = declareCommand({
  name: 'fill',
  description: 'Fill text into editable element',
  category: 'core',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
    text: z.string().describe('Text to fill into the element'),
  }),
  options: z.object({
    submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
  }),
  toolName: 'browser_type',
  toolParams: ({ ref, text, submit }) => ({ ref, text, submit }),
});

const hover = declareCommand({
  name: 'hover',
  description: 'Hover over element on page',
  category: 'core',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
  }),
  toolName: 'browser_hover',
  toolParams: ({ ref }) => ({ ref }),
});

const select = declareCommand({
  name: 'select',
  description: 'Select an option in a dropdown',
  category: 'core',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
    val: z.string().describe('Value to select in the dropdown'),
  }),
  toolName: 'browser_select_option',
  toolParams: ({ ref, val: value }) => ({ ref, values: [value] }),
});

const fileUpload = declareCommand({
  name: 'upload',
  description: 'Upload one or multiple files',
  category: 'core',
  args: z.object({
    file: z.string().describe('The absolute paths to the files to upload'),
  }),
  toolName: 'browser_file_upload',
  toolParams: ({ file }) => ({ paths: [file] }),
});

const check = declareCommand({
  name: 'check',
  description: 'Check a checkbox or radio button',
  category: 'core',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
  }),
  toolName: 'browser_check',
  toolParams: ({ ref }) => ({ ref }),
});

const uncheck = declareCommand({
  name: 'uncheck',
  description: 'Uncheck a checkbox or radio button',
  category: 'core',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
  }),
  toolName: 'browser_uncheck',
  toolParams: ({ ref }) => ({ ref }),
});

const snapshot = declareCommand({
  name: 'snapshot',
  description: 'Capture page snapshot to obtain element ref',
  category: 'core',
  args: z.object({}),
  options: z.object({
    filename: z.string().optional().describe('Save snapshot to markdown file instead of returning it in the response.'),
  }),
  toolName: 'browser_snapshot',
  toolParams: ({ filename }) => ({ filename }),
});

const evaluate = declareCommand({
  name: 'eval',
  description: 'Evaluate JavaScript expression on page or element',
  category: 'core',
  args: z.object({
    func: z.string().describe('() => { /* code */ } or (element) => { /* code */ } when element is provided'),
    ref: z.string().optional().describe('Exact target element reference from the page snapshot'),
  }),
  toolName: 'browser_evaluate',
  toolParams: ({ func, ref }) => ({ function: func, ref }),
});

const dialogAccept = declareCommand({
  name: 'dialog-accept',
  description: 'Accept a dialog',
  category: 'core',
  args: z.object({
    prompt: z.string().optional().describe('The text of the prompt in case of a prompt dialog.'),
  }),
  toolName: 'browser_handle_dialog',
  toolParams: ({ prompt: promptText }) => ({ accept: true, promptText }),
});

const dialogDismiss = declareCommand({
  name: 'dialog-dismiss',
  description: 'Dismiss a dialog',
  category: 'core',
  args: z.object({}),
  toolName: 'browser_handle_dialog',
  toolParams: () => ({ accept: false }),
});

const resize = declareCommand({
  name: 'resize',
  description: 'Resize the browser window',
  category: 'core',
  args: z.object({
    w: numberArg.describe('Width of the browser window'),
    h: numberArg.describe('Height of the browser window'),
  }),
  toolName: 'browser_resize',
  toolParams: ({ w: width, h: height }) => ({ width, height }),
});

const runCode = declareCommand({
  name: 'run-code',
  description: 'Run Playwright code snippet',
  category: 'devtools',
  args: z.object({
    code: z.string().describe('A JavaScript function containing Playwright code to execute. It will be invoked with a single argument, page, which you can use for any page interaction.'),
  }),
  toolName: 'browser_run_code',
  toolParams: ({ code }) => ({ code }),
});

// Tabs

const tabList = declareCommand({
  name: 'tab-list',
  description: 'List all tabs',
  category: 'tabs',
  args: z.object({}),
  toolName: 'browser_tabs',
  toolParams: () => ({ action: 'list' }),
});

const tabNew = declareCommand({
  name: 'tab-new',
  description: 'Create a new tab',
  category: 'tabs',
  args: z.object({
    url: z.string().optional().describe('The URL to navigate to in the new tab. If omitted, the new tab will be blank.'),
  }),
  toolName: 'browser_tabs',
  toolParams: ({ url }) => ({ action: 'new', url }),
});

const tabClose = declareCommand({
  name: 'tab-close',
  description: 'Close a browser tab',
  category: 'tabs',
  args: z.object({
    index: numberArg.optional().describe('Tab index. If omitted, current tab is closed.'),
  }),
  toolName: 'browser_tabs',
  toolParams: ({ index }) => ({ action: 'close', index }),
});

const tabSelect = declareCommand({
  name: 'tab-select',
  description: 'Select a browser tab',
  category: 'tabs',
  args: z.object({
    index: numberArg.describe('Tab index'),
  }),
  toolName: 'browser_tabs',
  toolParams: ({ index }) => ({ action: 'select', index }),
});

// Storage

const stateLoad = declareCommand({
  name: 'state-load',
  description: 'Loads browser storage (authentication) state from a file',
  category: 'storage',
  args: z.object({
    filename: z.string().describe('File name to load the storage state from.'),
  }),
  toolName: 'browser_set_storage_state',
  toolParams: ({ filename }) => ({ filename }),
});

const stateSave = declareCommand({
  name: 'state-save',
  description: 'Saves the current storage (authentication) state to a file',
  category: 'storage',
  args: z.object({
    filename: z.string().optional().describe('File name to save the storage state to.'),
  }),
  toolName: 'browser_storage_state',
  toolParams: ({ filename }) => ({ filename }),
});

// Cookies

const cookieList = declareCommand({
  name: 'cookie-list',
  description: 'List all cookies (optionally filtered by domain/path)',
  category: 'storage',
  args: z.object({}),
  options: z.object({
    domain: z.string().optional().describe('Filter cookies by domain'),
    path: z.string().optional().describe('Filter cookies by path'),
  }),
  toolName: 'browser_cookie_list',
  toolParams: ({ domain, path }) => ({ domain, path }),
});

const cookieGet = declareCommand({
  name: 'cookie-get',
  description: 'Get a specific cookie by name',
  category: 'storage',
  args: z.object({
    name: z.string().describe('Cookie name'),
  }),
  toolName: 'browser_cookie_get',
  toolParams: ({ name }) => ({ name }),
});

const cookieSet = declareCommand({
  name: 'cookie-set',
  description: 'Set a cookie with optional flags',
  category: 'storage',
  args: z.object({
    name: z.string().describe('Cookie name'),
    value: z.string().describe('Cookie value'),
  }),
  options: z.object({
    domain: z.string().optional().describe('Cookie domain'),
    path: z.string().optional().describe('Cookie path'),
    expires: numberArg.optional().describe('Cookie expiration as Unix timestamp'),
    httpOnly: z.boolean().optional().describe('Whether the cookie is HTTP only'),
    secure: z.boolean().optional().describe('Whether the cookie is secure'),
    sameSite: z.enum(['Strict', 'Lax', 'None']).optional().describe('Cookie SameSite attribute'),
  }),
  toolName: 'browser_cookie_set',
  toolParams: ({ name, value, domain, path, expires, httpOnly, secure, sameSite }) => ({ name, value, domain, path, expires, httpOnly, secure, sameSite }),
});

const cookieDelete = declareCommand({
  name: 'cookie-delete',
  description: 'Delete a specific cookie',
  category: 'storage',
  args: z.object({
    name: z.string().describe('Cookie name'),
  }),
  toolName: 'browser_cookie_delete',
  toolParams: ({ name }) => ({ name }),
});

const cookieClear = declareCommand({
  name: 'cookie-clear',
  description: 'Clear all cookies',
  category: 'storage',
  args: z.object({}),
  toolName: 'browser_cookie_clear',
  toolParams: () => ({}),
});

// LocalStorage

const localStorageList = declareCommand({
  name: 'localstorage-list',
  description: 'List all localStorage key-value pairs',
  category: 'storage',
  args: z.object({}),
  toolName: 'browser_localstorage_list',
  toolParams: () => ({}),
});

const localStorageGet = declareCommand({
  name: 'localstorage-get',
  description: 'Get a localStorage item by key',
  category: 'storage',
  args: z.object({
    key: z.string().describe('Key to get'),
  }),
  toolName: 'browser_localstorage_get',
  toolParams: ({ key }) => ({ key }),
});

const localStorageSet = declareCommand({
  name: 'localstorage-set',
  description: 'Set a localStorage item',
  category: 'storage',
  args: z.object({
    key: z.string().describe('Key to set'),
    value: z.string().describe('Value to set'),
  }),
  toolName: 'browser_localstorage_set',
  toolParams: ({ key, value }) => ({ key, value }),
});

const localStorageDelete = declareCommand({
  name: 'localstorage-delete',
  description: 'Delete a localStorage item',
  category: 'storage',
  args: z.object({
    key: z.string().describe('Key to delete'),
  }),
  toolName: 'browser_localstorage_delete',
  toolParams: ({ key }) => ({ key }),
});

const localStorageClear = declareCommand({
  name: 'localstorage-clear',
  description: 'Clear all localStorage',
  category: 'storage',
  args: z.object({}),
  toolName: 'browser_localstorage_clear',
  toolParams: () => ({}),
});

// SessionStorage

const sessionStorageList = declareCommand({
  name: 'sessionstorage-list',
  description: 'List all sessionStorage key-value pairs',
  category: 'storage',
  args: z.object({}),
  toolName: 'browser_sessionstorage_list',
  toolParams: () => ({}),
});

const sessionStorageGet = declareCommand({
  name: 'sessionstorage-get',
  description: 'Get a sessionStorage item by key',
  category: 'storage',
  args: z.object({
    key: z.string().describe('Key to get'),
  }),
  toolName: 'browser_sessionstorage_get',
  toolParams: ({ key }) => ({ key }),
});

const sessionStorageSet = declareCommand({
  name: 'sessionstorage-set',
  description: 'Set a sessionStorage item',
  category: 'storage',
  args: z.object({
    key: z.string().describe('Key to set'),
    value: z.string().describe('Value to set'),
  }),
  toolName: 'browser_sessionstorage_set',
  toolParams: ({ key, value }) => ({ key, value }),
});

const sessionStorageDelete = declareCommand({
  name: 'sessionstorage-delete',
  description: 'Delete a sessionStorage item',
  category: 'storage',
  args: z.object({
    key: z.string().describe('Key to delete'),
  }),
  toolName: 'browser_sessionstorage_delete',
  toolParams: ({ key }) => ({ key }),
});

const sessionStorageClear = declareCommand({
  name: 'sessionstorage-clear',
  description: 'Clear all sessionStorage',
  category: 'storage',
  args: z.object({}),
  toolName: 'browser_sessionstorage_clear',
  toolParams: () => ({}),
});

// Network

const routeMock = declareCommand({
  name: 'route',
  description: 'Mock network requests matching a URL pattern',
  category: 'network',
  args: z.object({
    pattern: z.string().describe('URL pattern to match (e.g., "**/api/users")'),
  }),
  options: z.object({
    status: numberArg.optional().describe('HTTP status code (default: 200)'),
    body: z.string().optional().describe('Response body (text or JSON string)'),
    ['content-type']: z.string().optional().describe('Content-Type header'),
    header: z.union([z.string(), z.array(z.string())]).optional().transform(v => v ? (Array.isArray(v) ? v : [v]) : undefined).describe('Header to add in "Name: Value" format (repeatable)'),
    ['remove-header']: z.string().optional().describe('Comma-separated header names to remove'),
  }),
  toolName: 'browser_route',
  toolParams: ({ pattern, status, body, ['content-type']: contentType, header: headers, ['remove-header']: removeHeaders }) => ({
    pattern,
    status,
    body,
    contentType,
    headers,
    removeHeaders,
  }),
});

const routeList = declareCommand({
  name: 'route-list',
  description: 'List all active network routes',
  category: 'network',
  args: z.object({}),
  toolName: 'browser_route_list',
  toolParams: () => ({}),
});

const unroute = declareCommand({
  name: 'unroute',
  description: 'Remove routes matching a pattern (or all routes)',
  category: 'network',
  args: z.object({
    pattern: z.string().optional().describe('URL pattern to unroute (omit to remove all)'),
  }),
  toolName: 'browser_unroute',
  toolParams: ({ pattern }) => ({ pattern }),
});

// Export

const screenshot = declareCommand({
  name: 'screenshot',
  description: 'screenshot of the current page or element',
  category: 'export',
  args: z.object({
    ref: z.string().optional().describe('Exact target element reference from the page snapshot.'),
  }),
  options: z.object({
    filename: z.string().optional().describe('File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.'),
    ['full-page']: z.boolean().optional().describe('When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport.'),
  }),
  toolName: 'browser_take_screenshot',
  toolParams: ({ ref, filename, ['full-page']: fullPage }) => ({ filename, ref, fullPage }),
});

const pdfSave = declareCommand({
  name: 'pdf',
  description: 'Save page as PDF',
  category: 'export',
  args: z.object({}),
  options: z.object({
    filename: z.string().optional().describe('File name to save the pdf to. Defaults to `page-{timestamp}.pdf` if not specified.'),
  }),
  toolName: 'browser_pdf_save',
  toolParams: ({ filename }) => ({ filename }),
});

// DevTools

const consoleList = declareCommand({
  name: 'console',
  description: 'List console messages',
  category: 'devtools',
  args: z.object({
    ['min-level']: z.string().optional().describe('Level of the console messages to return. Each level includes the messages of more severe levels. Defaults to "info".'),
  }),
  options: z.object({
    clear: z.boolean().optional().describe('Whether to clear the console list'),
  }),
  toolName: ({ clear }) => clear ? 'browser_console_clear' : 'browser_console_messages',
  toolParams: ({ ['min-level']: level, clear }) => clear ? ({}) : ({ level }),
});

const networkRequests = declareCommand({
  name: 'network',
  description: 'List all network requests since loading the page',
  category: 'devtools',
  args: z.object({}),
  options: z.object({
    static: z.boolean().optional().describe('Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.'),
    clear: z.boolean().optional().describe('Whether to clear the network list'),
  }),
  toolName: ({ clear }) => clear ? 'browser_network_clear' : 'browser_network_requests',
  toolParams: ({ static: includeStatic, clear }) => clear ? ({}) : ({ includeStatic }),
});

const tracingStart = declareCommand({
  name: 'tracing-start',
  description: 'Start trace recording',
  category: 'devtools',
  args: z.object({}),
  toolName: 'browser_start_tracing',
  toolParams: () => ({}),
});

const tracingStop = declareCommand({
  name: 'tracing-stop',
  description: 'Stop trace recording',
  category: 'devtools',
  args: z.object({}),
  toolName: 'browser_stop_tracing',
  toolParams: () => ({}),
});

const videoStart = declareCommand({
  name: 'video-start',
  description: 'Start video recording',
  category: 'devtools',
  args: z.object({}),
  toolName: 'browser_start_video',
  toolParams: () => ({}),
});

const videoStop = declareCommand({
  name: 'video-stop',
  description: 'Stop video recording',
  category: 'devtools',
  options: z.object({
    filename: z.string().optional().describe('Filename to save the video.'),
  }),
  toolName: 'browser_stop_video',
  toolParams: ({ filename }) => ({ filename }),
});

const show = declareCommand({
  name: 'show',
  description: 'Show browser DevTools',
  category: 'devtools',
  args: z.object({}),
  toolName: 'browser_show',
  toolParams: () => ({}),
});

// Sessions

const sessionList = declareCommand({
  name: 'list',
  description: 'List browser sessions',
  category: 'browsers',
  args: z.object({}),
  options: z.object({
    all: z.boolean().optional().describe('List all browser sessions across all workspaces'),
  }),
  toolName: '',
  toolParams: () => ({}),
});

const sessionCloseAll = declareCommand({
  name: 'close-all',
  description: 'Close all browser sessions',
  category: 'browsers',
  toolName: '',
  toolParams: () => ({}),
});

const killAll = declareCommand({
  name: 'kill-all',
  description: 'Forcefully kill all browser sessions (for stale/zombie processes)',
  category: 'browsers',
  toolName: '',
  toolParams: () => ({}),
});

const deleteData = declareCommand({
  name: 'delete-data',
  description: 'Delete session data',
  category: 'core',
  toolName: '',
  toolParams: () => ({}),
});

const configPrint = declareCommand({
  name: 'config-print',
  description: 'Print the final resolved config after merging CLI options, environment variables and config file.',
  category: 'config',
  hidden: true,
  toolName: 'browser_get_config',
  toolParams: () => ({}),
});

const install = declareCommand({
  name: 'install',
  description: 'Initialize workspace',
  category: 'install',
  args: z.object({}),
  options: z.object({
    skills: z.boolean().optional().describe('Install skills for Claude / GitHub Copilot'),
  }),
  toolName: '',
  toolParams: () => ({}),
});

const installBrowser = declareCommand({
  name: 'install-browser',
  description: 'Install browser',
  category: 'install',
  options: z.object({
    browser: z.string().optional().describe('Browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge'),
  }),
  toolName: 'browser_install',
  toolParams: () => ({}),
});

const tray = declareCommand({
  name: 'tray',
  description: 'Run tray',
  category: 'config',
  hidden: true,
  toolName: '',
  toolParams: () => ({}),
});

const commandsArray: AnyCommandSchema[] = [
  // core category
  open,
  close,
  goto,
  type,
  click,
  doubleClick,
  fill,
  drag,
  hover,
  select,
  fileUpload,
  check,
  uncheck,
  snapshot,
  evaluate,
  consoleList,
  dialogAccept,
  dialogDismiss,
  resize,
  runCode,
  deleteData,

  // navigation category
  goBack,
  goForward,
  reload,

  // keyboard category
  pressKey,
  keydown,
  keyup,

  // mouse category
  mouseMove,
  mouseDown,
  mouseUp,
  mouseWheel,

  // export category
  screenshot,
  pdfSave,

  // tabs category
  tabList,
  tabNew,
  tabClose,
  tabSelect,

  // storage category
  stateLoad,
  stateSave,
  cookieList,
  cookieGet,
  cookieSet,
  cookieDelete,
  cookieClear,
  localStorageList,
  localStorageGet,
  localStorageSet,
  localStorageDelete,
  localStorageClear,
  sessionStorageList,
  sessionStorageGet,
  sessionStorageSet,
  sessionStorageDelete,
  sessionStorageClear,

  // network category
  routeMock,
  routeList,
  unroute,

  // config category
  configPrint,

  // install category
  install,
  installBrowser,

  // devtools category
  networkRequests,
  show,
  tracingStart,
  tracingStop,
  videoStart,
  videoStop,

  // session category
  sessionList,
  sessionCloseAll,
  killAll,

  // Hidden commands
  tray,
];

export const commands = Object.fromEntries(commandsArray.map(cmd => [cmd.name, cmd]));
