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

// Navigation commands

const open = declareCommand({
  name: 'open',
  description: 'Open URL',
  category: 'core',
  args: z.object({
    url: z.string().describe('The URL to navigate to'),
  }),
  toolName: 'browser_navigate',
  toolParams: ({ url }) => ({ url }),
});

const close = declareCommand({
  name: 'close',
  description: 'Close the page',
  category: 'core',
  args: z.object({}),
  toolName: '',
  toolParams: () => ({}),
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
    x: z.number().describe('X coordinate'),
    y: z.number().describe('Y coordinate'),
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
    dx: z.number().describe('Y delta'),
    dy: z.number().describe('X delta'),
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
  options: z.object({
    headed: z.boolean().default(false).describe('Run browser in headed mode'),
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
    w: z.number().describe('Width of the browser window'),
    h: z.number().describe('Height of the browser window'),
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
    index: z.number().optional().describe('Tab index. If omitted, current tab is closed.'),
  }),
  toolName: 'browser_tabs',
  toolParams: ({ index }) => ({ action: 'close', index }),
});

const tabSelect = declareCommand({
  name: 'tab-select',
  description: 'Select a browser tab',
  category: 'tabs',
  args: z.object({
    index: z.number().describe('Tab index'),
  }),
  toolName: 'browser_tabs',
  toolParams: ({ index }) => ({ action: 'select', index }),
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

// Sessions

const sessionList = declareCommand({
  name: 'session-list',
  description: 'List all sessions',
  category: 'session',
  args: z.object({}),
  toolName: '',
  toolParams: () => ({}),
});

const sessionStop = declareCommand({
  name: 'session-stop',
  description: 'Stop session',
  category: 'session',
  args: z.object({
    name: z.string().optional().describe('Name of the session to stop. If omitted, current session is stopped.'),
  }),
  toolName: '',
  toolParams: () => ({}),
});

const sessionStopAll = declareCommand({
  name: 'session-stop-all',
  description: 'Stop all sessions',
  category: 'session',
  toolName: '',
  toolParams: () => ({}),
});

const sessionDelete = declareCommand({
  name: 'session-delete',
  description: 'Delete session data',
  category: 'session',
  args: z.object({
    name: z.string().optional().describe('Name of the session to delete. If omitted, current session is deleted.'),
  }),
  toolName: '',
  toolParams: ({ name }) => ({ name }),
});

const config = declareCommand({
  name: 'config',
  description: 'Restart session with new config, defaults to `playwright-cli.json`',
  category: 'config',
  options: z.object({
    browser: z.string().optional().describe('browser or chrome channel to use, possible values: chrome, firefox, webkit, msedge.'),
    config: z.string().optional().describe('Path to the configuration file'),
    isolated: z.boolean().optional().describe('keep the browser profile in memory, do not save it to disk.'),
    headed: z.boolean().optional().describe('run browser in headed mode'),
  }),
  toolName: '',
  toolParams: () => ({}),
});

const commandsArray: AnyCommandSchema[] = [
  // core category
  open,
  close,
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

  // config
  config,

  // devtools category
  networkRequests,
  tracingStart,
  tracingStop,
  videoStart,
  videoStop,

  // session category
  sessionList,
  sessionStop,
  sessionStopAll,
  sessionDelete,
];

export const commands = Object.fromEntries(commandsArray.map(cmd => [cmd.name, cmd]));
