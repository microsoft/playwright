import { escapeWithQuotes } from "playwright-core/lib/utils/stringUtils";
import { ActionInContext } from "./codeGenerator";
import { LanguageGenerator, LanguageGeneratorOptions } from "./language";
import { Action, actionTitle } from "./recorderActions";

export class RevBotActionGenerator implements LanguageGenerator {
  id = 'revbot';
  fileName = 'RevBot';
  highlighter = 'revbot';

  generateAction(actionInContext: ActionInContext): string {
    const { action, pageAlias } = actionInContext;
    const formatter = new RevBotFormatter(6);
    formatter.newLine();
    formatter.add('// ' + actionTitle(action));

    const actionCall = this._generateActionCall(action);
    if (actionCall.length > 0) {
      formatter.add(actionCall)
    }

    return formatter.format();
  }

  private _generateActionCall(action: Action): string {
    switch (action.name) {
      case 'click':
        return this._selectorWarningText(action.selector) + `click({ selector: ${quote(action.selector)} })`;
      case 'check':
        return this._selectorWarningText(action.selector) + `click({ selector: ${quote(action.selector)} })`;
      case 'fill':
        return this._selectorWarningText(action.selector) + `fill({ selector: ${quote(action.selector)}, copy: ${quote(action.text)} }),`;
      case 'navigate':
        return `goto({ url: ${quote(action.url)} }),`;
      case 'select':
        return this._selectorWarningText(action.selector) + `selectOption({ selector: ${quote(action.selector)}, selection: ${formatObject(action.options.length > 1 ? action.options : action.options[0])} })`;

      case 'uncheck':
      case 'setInputFiles':
      case 'press':
        return `// action ${quote(action.name)} is not implemented.`

      // Navigate phase assumes the page is already open.
      case 'openPage':
      case 'closePage':
        return '';
    }
  }

  private _selectorWarningText(selector: string): string {
    return (selector.length > 15)
      ? '// The generator might have gotten carried away with its selector...\n'
      : ''
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    const formatter = new RevBotFormatter();
    formatter.add(`
      import { BotAction } from 'bots/v2/interfaces/bot-actions'
      import { Revbot } from 'bots/v2/interfaces/revbot'

      declare let bot: Revbot

      const {
        chain,
        click,
        fill,
        goto,
        phase,
        selectOption,
      } = bot.actions

      const { helpers: helperActions, navigation: navigationActions } = bot.customActions

      const selector = bot.constants.selector

      export const requiredFields: RequiredFields = [
        // TODO: Add required fields while adjusting selectors below
      ]

      /**
       * This navigate method was generated. User discretion is advised.
       */
      export const navigate = (): BotAction => {
        return chain(
          phase('NAVIGATE')(`);
    return formatter.format();
  }

  generateFooter(saveStorage: string | undefined): string {
    return '\n    ),\n  )\n}';
  }
}

class RevBotFormatter {
  private _baseIndent: string;
  private _baseOffset: string;
  private _lines: string[] = [];

  constructor(offset = 0) {
    this._baseIndent = ' '.repeat(2);
    this._baseOffset = ' '.repeat(offset);
  }

  prepend(text: string) {
    this._lines = text.trim().split('\n').map(line => line.trim()).concat(this._lines);
  }

  add(text: string) {
    this._lines.push(...text.trim().split('\n').map(line => line.trim()));
  }

  newLine() {
    this._lines.push('');
  }

  format(): string {
    let spaces = '';
    let previousLine = '';
    return this._lines.map((line: string) => {
      if (line === '')
        return line;
      if (line.startsWith('}') || line.startsWith(']'))
        spaces = spaces.substring(this._baseIndent.length);

      const extraSpaces = /^(for|while|if|try).*\(.*\)$/.test(previousLine) ? this._baseIndent : '';
      previousLine = line;

      const callCarryOver = line.startsWith('.set');
      line = spaces + extraSpaces + (callCarryOver ? this._baseIndent : '') + line;
      if (line.endsWith('{') || line.endsWith('['))
        spaces += this._baseIndent;
      return this._baseOffset + line;
    }).join('\n');
  }
}

function formatObject(value: any, indent = '  '): string {
  if (typeof value === 'string')
    return quote(value);
  if (Array.isArray(value))
    return `[${value.map(o => formatObject(o)).join(', ')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (!keys.length)
      return '{}';
    const tokens: string[] = [];
    for (const key of keys)
      tokens.push(`${key}: ${formatObject(value[key])}`);
    return `{\n${indent}${tokens.join(`,\n${indent}`)}\n}`;
  }
  return String(value);
}

function quote(text: string) {
  return escapeWithQuotes(text, '\'');
}
