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

import fs from 'fs';
import type { CRSession } from './crConnection';

const kBindingName = '__pw_devtools__';

// This class intercepts preferences-related DevTools embedder methods
// and stores preferences as a json file in the browser installation directory.
export class CRDevTools {
  private _preferencesPath: string;
  private _prefs: any;
  private _savePromise: Promise<any>;
  __testHookOnBinding?: (parsed: any) => any;

  constructor(preferencesPath: string) {
    this._preferencesPath = preferencesPath;
    this._savePromise = Promise.resolve();
  }

  install(session: CRSession) {
    session.on('Runtime.bindingCalled', async event => {
      if (event.name !== kBindingName)
        return;
      const parsed = JSON.parse(event.payload);
      let result = undefined;
      if (this.__testHookOnBinding)
        this.__testHookOnBinding(parsed);
      if (parsed.method === 'getPreferences') {
        if (this._prefs === undefined) {
          try {
            const json = await fs.promises.readFile(this._preferencesPath, 'utf8');
            this._prefs = JSON.parse(json);
          } catch (e) {
            this._prefs = {};
          }
        }
        result = this._prefs;
      } else if (parsed.method === 'setPreference') {
        this._prefs[parsed.params[0]] = parsed.params[1];
        this._save();
      } else if (parsed.method === 'removePreference') {
        delete this._prefs[parsed.params[0]];
        this._save();
      } else if (parsed.method === 'clearPreferences') {
        this._prefs = {};
        this._save();
      }
      session.send('Runtime.evaluate', {
        expression: `window.DevToolsAPI.embedderMessageAck(${parsed.id}, ${JSON.stringify(result)})`,
        contextId: event.executionContextId
      }).catch(e => null);
    });
    Promise.all([
      session.send('Runtime.enable'),
      session.send('Runtime.addBinding', { name: kBindingName }),
      session.send('Page.enable'),
      session.send('Page.addScriptToEvaluateOnNewDocument', { source: `
        (() => {
          const init = () => {
            // Lazy init happens when InspectorFrontendHost is initialized.
            // At this point DevToolsHost is ready to be used.
            const host = window.DevToolsHost;
            const old = host.sendMessageToEmbedder.bind(host);
            host.sendMessageToEmbedder = message => {
              if (['getPreferences', 'setPreference', 'removePreference', 'clearPreferences'].includes(JSON.parse(message).method))
                window.${kBindingName}(message);
              else
                old(message);
            };
          };
          let value;
          Object.defineProperty(window, 'InspectorFrontendHost', {
            configurable: true,
            enumerable: true,
            get() { return value; },
            set(v) { value = v; init(); },
          });
        })()
      ` }),
      session.send('Runtime.runIfWaitingForDebugger'),
    ]).catch(e => null);
  }

  _save() {
    // Serialize saves to avoid corruption.
    this._savePromise = this._savePromise.then(async () => {
      await fs.promises.writeFile(this._preferencesPath, JSON.stringify(this._prefs)).catch(e => null);
    });
  }
}
