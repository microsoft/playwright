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

const click = declareCommand({
  name: 'click',
  description: 'Perform click on a web page',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
  }),
  options: z.object({
    button: z.string().optional().describe('Button to click, defaults to left'),
    modifiers: z.array(z.string()).optional().describe('Modifier keys to press'),
  }),
  toolName: 'browser_click',
  toolParams: ({ ref }, { button, modifiers }) => ({ ref, button, modifiers }),
});

const doubleClick = declareCommand({
  name: 'dblclick',
  description: 'Perform double click on a web page',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
  }),
  options: z.object({
    button: z.string().optional().describe('Button to click, defaults to left'),
    modifiers: z.array(z.string()).optional().describe('Modifier keys to press'),
  }),
  toolName: 'browser_click',
  toolParams: ({ ref }, { button, modifiers }) => ({ ref, button, modifiers, doubleClick: true }),
});

const close = declareCommand({
  name: 'close',
  description: 'Close the page',
  args: z.object({}),
  toolName: 'browser_close',
  toolParams: () => ({}),
});

const consoleMessages = declareCommand({
  name: 'console',
  description: 'Returns all console messages',
  args: z.object({
    level: z.string().optional().describe('Level of the console messages to return. Each level includes the messages of more severe levels. Defaults to "info".'),
  }),
  toolName: 'browser_console_messages',
  toolParams: ({ level }) => ({ level }),
});

const drag = declareCommand({
  name: 'drag',
  description: 'Perform drag and drop between two elements',
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

const evaluate = declareCommand({
  name: 'evaluate',
  description: 'Evaluate JavaScript expression on page or element',
  args: z.object({
    function: z.string().describe('() => { /* code */ } or (element) => { /* code */ } when element is provided'),
    ref: z.string().optional().describe('Exact target element reference from the page snapshot'),
  }),
  toolName: 'browser_evaluate',
  toolParams: ({ function: fn, ref }) => ({ function: fn, ref }),
});

const fileUpload = declareCommand({
  name: 'upload-file',
  description: 'Upload one or multiple files',
  args: z.object({}),
  options: z.object({
    paths: z.array(z.string()).optional().describe('The absolute paths to the files to upload. Can be single file or multiple files. If omitted, file chooser is cancelled.'),
  }),
  toolName: 'browser_file_upload',
  toolParams: (_, { paths }) => ({ paths }),
});

const handleDialog = declareCommand({
  name: 'handle-dialog',
  description: 'Handle a dialog',
  args: z.object({
    accept: z.boolean().describe('Whether to accept the dialog.'),
    promptText: z.string().optional().describe('The text of the prompt in case of a prompt dialog.'),
  }),
  toolName: 'browser_handle_dialog',
  toolParams: ({ accept, promptText }) => ({ accept, promptText }),
});

const hover = declareCommand({
  name: 'hover',
  description: 'Hover over element on page',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
  }),
  toolName: 'browser_hover',
  toolParams: ({ ref }) => ({ ref }),
});

const open = declareCommand({
  name: 'open',
  description: 'Open URL',
  args: z.object({
    url: z.string().describe('The URL to navigate to'),
  }),
  options: z.object({
    headed: z.boolean().default(false).describe('Run browser in headed mode'),
  }),
  toolName: 'browser_open',
  toolParams: ({ url }, { headed }) => ({ url, headed }),
});

const navigateBack = declareCommand({
  name: 'go-back',
  description: 'Go back to the previous page',
  args: z.object({}),
  toolName: 'browser_navigate_back',
  toolParams: () => ({}),
});

const networkRequests = declareCommand({
  name: 'network-requests',
  description: 'Returns all network requests since loading the page',
  args: z.object({}),
  options: z.object({
    includeStatic: z.boolean().optional().describe('Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.'),
  }),
  toolName: 'browser_network_requests',
  toolParams: (_, { includeStatic }) => ({ includeStatic }),
});

const pressKey = declareCommand({
  name: 'press',
  description: 'Press a key on the keyboard',
  args: z.object({
    key: z.string().describe('Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'),
  }),
  toolName: 'browser_press_key',
  toolParams: ({ key }) => ({ key }),
});

const resize = declareCommand({
  name: 'resize',
  description: 'Resize the browser window',
  args: z.object({
    width: z.number().describe('Width of the browser window'),
    height: z.number().describe('Height of the browser window'),
  }),
  toolName: 'browser_resize',
  toolParams: ({ width, height }) => ({ width, height }),
});

const runCode = declareCommand({
  name: 'run-code',
  description: 'Run Playwright code snippet',
  args: z.object({
    code: z.string().describe('A JavaScript function containing Playwright code to execute. It will be invoked with a single argument, page, which you can use for any page interaction.'),
  }),
  toolName: 'browser_run_code',
  toolParams: ({ code }) => ({ code }),
});

const selectOption = declareCommand({
  name: 'select-option',
  description: 'Select an option in a dropdown',
  args: z.object({
    ref: z.string().describe('Exact target element reference from the page snapshot'),
    values: z.array(z.string()).describe('Array of values to select in the dropdown. This can be a single value or multiple values.'),
  }),
  toolName: 'browser_select_option',
  toolParams: ({ ref, values }) => ({ ref, values }),
});

const snapshot = declareCommand({
  name: 'snapshot',
  description: 'Capture accessibility snapshot of the current page, this is better than screenshot',
  args: z.object({}),
  options: z.object({
    filename: z.string().optional().describe('Save snapshot to markdown file instead of returning it in the response.'),
  }),
  toolName: 'browser_snapshot',
  toolParams: (_, { filename }) => ({ filename }),
});

const screenshot = declareCommand({
  name: 'screenshot',
  description: 'Take a screenshot of the current page. You can\'t perform actions based on the screenshot, use browser_snapshot for actions.',
  args: z.object({
    ref: z.string().optional().describe('Exact target element reference from the page snapshot.'),
  }),
  options: z.object({
    filename: z.string().optional().describe('File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.'),
    fullPage: z.boolean().optional().describe('When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport.'),
  }),
  toolName: 'browser_take_screenshot',
  toolParams: ({ ref }, { filename, fullPage }) => ({ filename, ref, fullPage }),
});

const type = declareCommand({
  name: 'type',
  description: 'Type text into editable element',
  args: z.object({
    text: z.string().describe('Text to type into the element'),
  }),
  options: z.object({
    submit: z.boolean().optional().describe('Whether to submit entered text (press Enter after)'),
  }),
  toolName: 'browser_press_sequentially',
  toolParams: ({ text }, { submit }) => ({ text, submit }),
});

const waitFor = declareCommand({
  name: 'wait-for',
  description: 'Wait for text to appear or disappear or a specified time to pass',
  args: z.object({}),
  options: z.object({
    time: z.number().optional().describe('The time to wait in seconds'),
    text: z.string().optional().describe('The text to wait for'),
    textGone: z.string().optional().describe('The text to wait for to disappear'),
  }),
  toolName: 'browser_wait_for',
  toolParams: (_, { time, text, textGone }) => ({ time, text, textGone }),
});

const tab = declareCommand({
  name: 'tab',
  description: 'Close a browser tab',
  args: z.object({
    action: z.string().describe(`Action to perform on tabs, 'list' | 'new' | 'close' | 'select'`),
    index: z.number().optional().describe('Tab index. If omitted, current tab is closed.'),
  }),
  toolName: 'browser_tabs',
  toolParams: ({ action, index }) => ({ action, index }),
});

const mouseClickXy = declareCommand({
  name: 'mouse-click-xy',
  description: 'Click left mouse button at a given position',
  args: z.object({
    x: z.number().describe('X coordinate'),
    y: z.number().describe('Y coordinate'),
  }),
  toolName: 'browser_mouse_click_xy',
  toolParams: ({ x, y }) => ({ x, y }),
});

const mouseDragXy = declareCommand({
  name: 'mouse-drag-xy',
  description: 'Drag left mouse button to a given position',
  args: z.object({
    startX: z.number().describe('Start X coordinate'),
    startY: z.number().describe('Start Y coordinate'),
    endX: z.number().describe('End X coordinate'),
    endY: z.number().describe('End Y coordinate'),
  }),
  toolName: 'browser_mouse_drag_xy',
  toolParams: ({ startX, startY, endX, endY }) => ({ startX, startY, endX, endY }),
});

const mouseMoveXy = declareCommand({
  name: 'mouse-move-xy',
  description: 'Move mouse to a given position',
  args: z.object({
    x: z.number().describe('X coordinate'),
    y: z.number().describe('Y coordinate'),
  }),
  toolName: 'browser_mouse_move_xy',
  toolParams: ({ x, y }) => ({ x, y }),
});

// PDF generation commands (opt-in via --caps=pdf)

const pdfSave = declareCommand({
  name: 'pdf-save',
  description: 'Save page as PDF',
  args: z.object({}),
  options: z.object({
    filename: z.string().optional().describe('File name to save the pdf to. Defaults to `page-{timestamp}.pdf` if not specified.'),
  }),
  toolName: 'browser_pdf_save',
  toolParams: (_, { filename }) => ({ filename }),
});

const startTracing = declareCommand({
  name: 'start-tracing',
  description: 'Start trace recording',
  args: z.object({}),
  toolName: 'browser_start_tracing',
  toolParams: () => ({}),
});

const stopTracing = declareCommand({
  name: 'stop-tracing',
  description: 'Stop trace recording',
  args: z.object({}),
  toolName: 'browser_stop_tracing',
  toolParams: () => ({}),
});

const commandsArray: AnyCommandSchema[] = [
  click,
  close,
  doubleClick,
  consoleMessages,
  drag,
  evaluate,
  fileUpload,
  handleDialog,
  hover,
  open,
  navigateBack,
  networkRequests,
  pressKey,
  resize,
  runCode,
  selectOption,
  snapshot,
  screenshot,
  type,
  waitFor,
  tab,
  mouseClickXy,
  mouseDragXy,
  mouseMoveXy,
  pdfSave,
  startTracing,
  stopTracing,
];

export const commands = Object.fromEntries(commandsArray.map(cmd => [cmd.name, cmd]));
