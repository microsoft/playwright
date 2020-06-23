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

import { Writable } from 'stream';
import * as types from '../types';
import { Frame } from '../frames';
import { formatColors, Formatter } from '../utils/formatter';
import { Action, actionTitle, NavigationSignal, PopupSignal, Signal } from './recorderActions';
import { toModifiers } from './recorderController';

const { cst, cmt, fnc, kwd, prp, str } = formatColors;

export class TerminalOutput {
  private _lastAction: Action | undefined;
  private _lastActionText: string | undefined;
  private _out: Writable;

  constructor(out: Writable) {
    this._out = out;
    const formatter = new Formatter();

    formatter.add(`
      ${kwd('const')} ${cst('assert')} = ${fnc('require')}(${str('assert')});
      ${kwd('const')} { ${cst('chromium')}, ${cst('firefox')}, ${cst('webkit')} } = ${fnc('require')}(${str('playwright')});

      (${kwd('async')}() => {
        ${kwd('const')} ${cst('browser')} = ${kwd('await')} ${cst(`chromium`)}.${fnc('launch')}();
        ${kwd('const')} ${cst('page')} = ${kwd('await')} ${cst('browser')}.${fnc('newPage')}();
    `);
    this._out.write(formatter.format() + '\n`})();`\n');
  }

  addAction(pageAlias: string, frame: Frame, action: Action) {
    // We augment last action based on the type.
    let eraseLastAction = false;
    if (this._lastAction && action.name === 'fill' && this._lastAction.name === 'fill') {
      if (action.selector === this._lastAction.selector)
        eraseLastAction = true;
    }
    if (this._lastAction && action.name === 'click' && this._lastAction.name === 'click') {
      if (action.selector === this._lastAction.selector && action.clickCount > this._lastAction.clickCount)
        eraseLastAction = true;
    }
    for (const name of ['check', 'uncheck']) {
      if (this._lastAction && action.name === name && this._lastAction.name === 'click') {
        if ((action as any).selector === (this._lastAction as any).selector)
          eraseLastAction = true;
      }
    }
    this._printAction(pageAlias, frame, action, eraseLastAction);
  }

  _printAction(pageAlias: string, frame: Frame, action: Action, eraseLastAction: boolean) {
    // We erase terminating `})();` at all times.
    let eraseLines = 1;
    if (eraseLastAction && this._lastActionText)
      eraseLines += this._lastActionText.split('\n').length;
    // And we erase the last action too if augmenting.
    for (let i = 0; i < eraseLines; ++i)
      this._out.write('\u001B[1A\u001B[2K');

    this._lastAction = action;
    this._lastActionText = this._generateAction(pageAlias, frame, action);
    this._out.write(this._lastActionText + '\n})();\n');
  }

  lastAction(): Action | undefined {
    return this._lastAction;
  }

  signal(pageAlias: string, frame: Frame, signal: Signal) {
    if (this._lastAction) {
      this._lastAction.signals.push(signal);
      this._printAction(pageAlias, frame, this._lastAction, true);
    }
  }

  private _generateAction(pageAlias: string, frame: Frame, action: Action): string {
    const formatter = new Formatter(2);
    formatter.newLine();
    formatter.add(cmt(actionTitle(action)));

    const subject = frame === frame._page.mainFrame() ? cst(pageAlias) :
      `${cst(pageAlias)}.${fnc('frame')}(${formatObject({ url: frame.url() })})`;

    let navigationSignal: NavigationSignal | undefined;
    let popupSignal: PopupSignal | undefined;
    for (const signal of action.signals) {
      if (signal.name === 'navigation')
        navigationSignal = signal;
      if (signal.name === 'popup')
        popupSignal = signal;
    }

    const waitForNavigation = navigationSignal && navigationSignal.type === 'await';
    const assertNavigation = navigationSignal && navigationSignal.type === 'assert';

    const emitPromiseAll = waitForNavigation || popupSignal;
    if (emitPromiseAll) {
      // Generate either await Promise.all([]) or
      // const [popup1] = await Promise.all([]).
      let leftHandSide = '';
      if (popupSignal)
        leftHandSide = `${kwd('const')} [${cst(popupSignal.popupAlias)}] = `;
      formatter.add(`${leftHandSide}${kwd('await')} ${cst('Promise')}.${fnc('all')}([`);
    }

    // Popup signals.
    if (popupSignal)
      formatter.add(`${cst(pageAlias)}.${fnc('waitForEvent')}(${str('popup')}),`);

    // Navigation signal.
    if (waitForNavigation)
      formatter.add(`${cst(pageAlias)}.${fnc('waitForNavigation')}({ ${prp('url')}: ${str(navigationSignal!.url)} }),`);

    const prefix = waitForNavigation ? '' : kwd('await') + ' ';
    const actionCall = this._generateActionCall(action);
    const suffix = waitForNavigation ? '' : ';';
    formatter.add(`${prefix}${subject}.${actionCall}${suffix}`);

    if (emitPromiseAll)
      formatter.add(`]);`);
    else if (assertNavigation)
      formatter.add(`  ${cst('assert')}.${fnc('equal')}(${cst(pageAlias)}.${fnc('url')}(), ${str(navigationSignal!.url)});`);
    return formatter.format();
  }

  private _generateActionCall(action: Action): string {
    switch (action.name)  {
      case 'click': {
        let method = 'click';
        if (action.clickCount === 2)
          method = 'dblclick';
        const modifiers = toModifiers(action.modifiers);
        const options: types.MouseClickOptions = {};
        if (action.button !== 'left')
          options.button = action.button;
        if (modifiers.length)
          options.modifiers = modifiers;
        if (action.clickCount > 2)
          options.clickCount = action.clickCount;
        const optionsString = formatOptions(options);
        return `${fnc(method)}(${str(action.selector)}${optionsString})`;
      }
      case 'check':
        return `${fnc('check')}(${str(action.selector)})`;
      case 'uncheck':
        return `${fnc('uncheck')}(${str(action.selector)})`;
      case 'fill':
        return `${fnc('fill')}(${str(action.selector)}, ${str(action.text)})`;
      case 'press': {
        const modifiers = toModifiers(action.modifiers);
        const shortcut = [...modifiers, action.key].join('+');
        return `${fnc('press')}(${str(action.selector)}, ${str(shortcut)})`;
      }
      case 'navigate':
        return `${fnc('goto')}(${str(action.url)})`;
      case 'select':
        return `${fnc('selectOption')}(${str(action.selector)}, ${formatObject(action.options.length > 1 ? action.options : action.options[0])})`;
    }
  }
}

function formatOptions(value: any): string {
  const keys = Object.keys(value);
  if (!keys.length)
    return '';
  return ', ' + formatObject(value);
}

function formatObject(value: any): string {
  if (typeof value === 'string')
    return str(value);
  if (Array.isArray(value))
    return `[${value.map(o => formatObject(o)).join(', ')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length)
      return '{}';
    const tokens: string[] = [];
    for (const key of keys)
      tokens.push(`${prp(key)}: ${formatObject(value[key])}`);
    return `{${tokens.join(', ')}}`;
  }
  return String(value);
}

