import { ActionInContext } from "./codeGenerator";
import { LanguageGenerator, LanguageGeneratorOptions } from "./language";

export class RevBotActionGenerator implements LanguageGenerator {
  id = 'revbot';
  fileName = 'RevBot';
  highlighter = 'revbot';

  generateAction(actionInContext: ActionInContext): string {
    return 'ya yeet'
  }

  generateHeader(options: LanguageGeneratorOptions): string {
    const formatter = new RevBotFormatter();
    formatter.add(`
      import { BotAction } from 'bots/v2/interfaces/bot-actions'
      import { Revbot } from 'bots/v2/interfaces/revbot'

      declare let bot: Revbot
      const { helpers: helperActions, navigation: navigationActions } = bot.customActions

      let {
        chain,
        log,
        phase,
        click,
        fill,
        waitForSelector,
      } = bot.actions

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
      if (line.startsWith('}') || line.startsWith(']') || line.includes('});') || line === ');')
        spaces = spaces.substring(this._baseIndent.length);

      const extraSpaces = /^(for|while|if).*\(.*\)$/.test(previousLine) ? this._baseIndent : '';
      previousLine = line;

      line = spaces + extraSpaces + line;
      if (line.endsWith('{') || line.endsWith('[') || line.endsWith('('))
        spaces += this._baseIndent;
      if (line.endsWith('));'))
        spaces = spaces.substring(this._baseIndent.length);

      return this._baseOffset + line;
    }).join('\n');
  }
}
