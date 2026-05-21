/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert } from '@isomorphic/assert';
import { SdkObject } from '../instrumentation';

import type { ElectronApplication } from './electron';

export type ElectronFileChooserMethod = 'showOpenDialog' | 'showSaveDialog';
export type ElectronDialogMethod = 'showMessageBox' | 'showCertificateTrustDialog';
export type ElectronInterceptedMethod = ElectronFileChooserMethod | ElectronDialogMethod;

type OnResolve = (result: any) => Promise<void>;

export class ElectronFileChooser extends SdkObject {
  private _method: ElectronFileChooserMethod;
  private _options: any;
  private _onResolve: OnResolve;
  private _handled = false;

  constructor(app: ElectronApplication, method: ElectronFileChooserMethod, options: any, onResolve: OnResolve) {
    super(app, 'electron-file-chooser');
    this._method = method;
    this._options = options;
    this._onResolve = onResolve;
  }

  method(): ElectronFileChooserMethod {
    return this._method;
  }

  options(): any {
    return this._options;
  }

  async setFiles(filePaths: string[]) {
    assert(!this._handled, 'File chooser is already handled');
    this._handled = true;
    const result = this._method === 'showOpenDialog'
      ? { canceled: false, filePaths }
      : { canceled: false, filePath: filePaths[0] ?? '' };
    await this._onResolve(result);
  }

  async cancel() {
    assert(!this._handled, 'File chooser is already handled');
    this._handled = true;
    const result = this._method === 'showOpenDialog'
      ? { canceled: true, filePaths: [] }
      : { canceled: true, filePath: '' };
    await this._onResolve(result);
  }
}

export class ElectronDialog extends SdkObject {
  private _method: ElectronDialogMethod;
  private _options: any;
  private _onResolve: OnResolve;
  private _handled = false;

  constructor(app: ElectronApplication, method: ElectronDialogMethod, options: any, onResolve: OnResolve) {
    super(app, 'electron-dialog');
    this._method = method;
    this._options = options;
    this._onResolve = onResolve;
  }

  method(): ElectronDialogMethod {
    return this._method;
  }

  options(): any {
    return this._options;
  }

  async accept(result: any) {
    assert(!this._handled, 'Dialog is already handled');
    this._handled = true;
    await this._onResolve(result);
  }

  async dismiss() {
    assert(!this._handled, 'Dialog is already handled');
    this._handled = true;
    const defaultResult = this._method === 'showMessageBox' ? { response: 0, checkboxChecked: false } : undefined;
    await this._onResolve(defaultResult);
  }
}
