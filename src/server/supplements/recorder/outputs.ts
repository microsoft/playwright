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

import * as fs from 'fs';
import * as querystring from 'querystring';
import * as hljs from '../../../third_party/highlightjs/highlightjs';

export interface RecorderOutput {
  printLn(text: string): void;
  popLn(text: string): void;
  flush(): void;
}

export interface Writable {
  write(data: string): void;
}

export class OutputMultiplexer implements RecorderOutput {
  private _outputs: RecorderOutput[]
  private _enabled = true;
  constructor(outputs: RecorderOutput[]) {
    this._outputs = outputs;
  }

  setEnabled(enabled: boolean) {
    this._enabled = enabled;
  }

  printLn(text: string) {
    if (!this._enabled)
      return;
    for (const output of this._outputs)
      output.printLn(text);
  }

  popLn(text: string) {
    if (!this._enabled)
      return;
    for (const output of this._outputs)
      output.popLn(text);
  }

  flush() {
    if (!this._enabled)
      return;
    for (const output of this._outputs)
      output.flush();
  }
}

export class BufferOutput {
  lines: string[] = [];

  printLn(text: string) {
    this.lines.push(...text.trimEnd().split('\n'));
  }

  popLn(text: string) {
    this.lines.length -= text.trimEnd().split('\n').length;
  }

  buffer(): string {
    return this.lines.join('\n');
  }
}

export class FileOutput extends BufferOutput implements RecorderOutput {
  private _fileName: string;

  constructor(fileName: string) {
    super();
    this._fileName = fileName;
    process.on('exit', () => this.flush());
  }

  flush() {
    fs.writeFileSync(this._fileName, this.buffer());
  }
}

export class TerminalOutput implements RecorderOutput {
  private _output: Writable;
  private _language: string;

  static create(output: Writable, language: string) {
    if (process.stdout.columns)
      return new TerminalOutput(output, language);
    return new FlushingTerminalOutput(output);
  }

  constructor(output: Writable, language: string) {
    this._output = output;
    this._language = language;
  }

  private _highlight(text: string) {
    let highlightedCode = hljs.highlight(this._language, text).value;
    highlightedCode = querystring.unescape(highlightedCode);
    highlightedCode = highlightedCode.replace(/<span class="hljs-keyword">/g, '\x1b[38;5;205m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-built_in">/g, '\x1b[38;5;220m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-literal">/g, '\x1b[38;5;159m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-title">/g, '');
    highlightedCode = highlightedCode.replace(/<span class="hljs-number">/g, '\x1b[38;5;78m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-string">/g, '\x1b[38;5;130m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-comment">/g, '\x1b[38;5;23m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-subst">/g, '\x1b[38;5;242m');
    highlightedCode = highlightedCode.replace(/<span class="hljs-function">/g, '');
    highlightedCode = highlightedCode.replace(/<span class="hljs-params">/g, '');
    highlightedCode = highlightedCode.replace(/<span class="hljs-attr">/g, '');
    highlightedCode = highlightedCode.replace(/<\/span>/g, '\x1b[0m');
    highlightedCode = highlightedCode.replace(/&#x27;/g, "'");
    highlightedCode = highlightedCode.replace(/&quot;/g, '"');
    highlightedCode = highlightedCode.replace(/&gt;/g, '>');
    highlightedCode = highlightedCode.replace(/&lt;/g, '<');
    highlightedCode = highlightedCode.replace(/&amp;/g, '&');
    return highlightedCode;
  }

  printLn(text: string) {
    // Split into lines for highlighter to not fail.
    for (const line of text.split('\n'))
      this._output.write(this._highlight(line) + '\n');
  }

  popLn(text: string) {
    const terminalWidth = process.stdout.columns || 80;
    for (const line of text.split('\n')) {
      const terminalLines = ((line.length - 1) / terminalWidth | 0) + 1;
      for (let i = 0; i < terminalLines; ++i)
        this._output.write('\u001B[1A\u001B[2K');
    }
  }

  flush() {}
}

export class FlushingTerminalOutput extends BufferOutput implements RecorderOutput {
  private _output: Writable

  constructor(output: Writable) {
    super();
    this._output = output;
  }

  printLn(text: string) {
    super.printLn(text);
    this._output.write('-------------8<-------------\n');
    this._output.write(this.buffer() + '\n');
    this._output.write('-------------8<-------------\n');
  }

  flush() {
    this._output.write(this.buffer() + '\n');
  }
}
