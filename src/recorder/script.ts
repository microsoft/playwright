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

import * as dom from '../dom';
import { Formatter, formatColors } from './formatter';
import { Action, NavigationSignal, actionTitle } from './actions';

export class Script {
  private _actions: Action[] = [];

  addAction(action: Action) {
    this._actions.push(action);
  }

  lastAction(): Action | undefined {
    return this._actions[this._actions.length - 1];
  }

  private _compact(): Action[] {
    const result: Action[] = [];
    let lastAction: Action | undefined;
    for (const action of this._actions) {
      if (lastAction && action.name === 'fill' && lastAction.name === 'fill') {
        if (action.selector === lastAction.selector)
          result.pop();
      }
      if (lastAction && action.name === 'click' && lastAction.name === 'click') {
        if (action.selector === lastAction.selector && action.clickCount > lastAction.clickCount)
          result.pop();
      }
      for (const name of ['check', 'uncheck']) {
        if (lastAction && action.name === name && lastAction.name === 'click') {
          if ((action as any).selector === (lastAction as any).selector)
            result.pop();
        }
      }
      lastAction = action;
      result.push(action);
    }
    return result;
  }

  generate(browserType: string) {
    const formatter = new Formatter();
    const { cst, cmt, fnc, kwd, prp, str } = formatColors;
    formatter.add(`
      ${kwd('const')} { ${cst('chromium')}. ${cst('firefox')}, ${cst('webkit')} } = ${fnc('require')}(${str('playwright')});

      (${kwd('async')}() => {
        ${kwd('const')} ${cst('browser')} = ${kwd('await')} ${cst(`${browserType}`)}.${fnc('launch')}();
        ${kwd('const')} ${cst('page')} = ${kwd('await')} ${cst('browser')}.${fnc('newPage')}();
    `);
    for (const action of this._compact()) {
      formatter.newLine();
      formatter.add(cmt(actionTitle(action)));
      let navigationSignal: NavigationSignal | undefined;
      if (action.name !== 'navigate' && action.signals && action.signals.length)
        navigationSignal = action.signals[action.signals.length - 1];
      if (navigationSignal) {
        formatter.add(`${kwd('await')} ${cst('Promise')}.${fnc('all')}([
          ${cst('page')}.${fnc('waitForNavigation')}({ ${prp('url')}: ${str(navigationSignal.url)} }),`);
      }
      const prefix = navigationSignal ? '' : kwd('await') + ' ';
      const suffix = navigationSignal ? '' : ';';
      if (action.name === 'click') {
        let method = 'click';
        if (action.clickCount === 2)
          method = 'dblclick';
        const modifiers = toModifiers(action.modifiers);
        const options: dom.ClickOptions = {};
        if (action.button !== 'left')
          options.button = action.button;
        if (modifiers.length)
          options.modifiers = modifiers;
        if (action.clickCount > 2)
          options.clickCount = action.clickCount;
        const optionsString = formatOptions(options);
        formatter.add(`${prefix}${cst('page')}.${fnc(method)}(${str(action.selector)}${optionsString})${suffix}`);
      }
      if (action.name === 'check')
        formatter.add(`${prefix}${cst('page')}.${fnc('check')}(${str(action.selector)})${suffix}`);
      if (action.name === 'uncheck')
        formatter.add(`${prefix}${cst('page')}.${fnc('uncheck')}(${str(action.selector)})${suffix}`);
      if (action.name === 'fill')
        formatter.add(`${prefix}${cst('page')}.${fnc('fill')}(${str(action.selector)}, ${str(action.text)})${suffix}`);
      if (action.name === 'press')
        formatter.add(`${prefix}${cst('page')}.${fnc('press')}(${str(action.selector)}, ${str(action.key)})${suffix}`);
      if (action.name === 'navigate')
        formatter.add(`${prefix}${cst('page')}.${fnc('goto')}(${str(action.url)})${suffix}`);
      if (action.name === 'select')
        formatter.add(`${prefix}${cst('page')}.${fnc('select')}(${str(action.selector)}, ${formatObject(action.options.length > 1 ? action.options : action.options[0])})${suffix}`);
      if (navigationSignal)
        formatter.add(`]);`);
    }
    formatter.add(`
      })();
    `);
    return formatter.format();
  }
}

function formatOptions(value: any): string {
  const keys = Object.keys(value);
  if (!keys.length)
    return '';
  return ', ' + formatObject(value);
}

function formatObject(value: any): string {
  const { prp, str } = formatColors;
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
    return `{ ${tokens.join(', ')} }`;
  }
  return String(value);
}

function toModifiers(modifiers: number): ('Alt' | 'Control' | 'Meta' | 'Shift')[] {
  const result: ('Alt' | 'Control' | 'Meta' | 'Shift')[] = [];
  if (modifiers & 1)
    result.push('Alt');
  if (modifiers & 2)
    result.push('Control');
  if (modifiers & 4)
    result.push('Meta');
  if (modifiers & 8)
    result.push('Shift');
  return result;
}
