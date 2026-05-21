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

// Serialized via .toString() and evaluated in the Electron main process; must not capture any closure.
export function installDialogInterception() {
  const g = globalThis as any;
  if (g.__pw_dialog_patched)
    return;
  g.__pw_dialog_patched = true;
  const dialog = (require as any)('electron').dialog;
  if (!dialog)
    return;
  type Method = 'showOpenDialog' | 'showSaveDialog' | 'showMessageBox' | 'showCertificateTrustDialog';
  const pending = new Map<number, (result: any) => void>();
  let nextId = 0;
  g.__pw_dialog_interceptors = g.__pw_dialog_interceptors || { dialog: false, fileChooser: false };
  g.__pw_resolve_dialog = (id: number, result: any) => {
    const resolver = pending.get(id);
    if (!resolver)
      return;
    pending.delete(id);
    resolver(result);
  };
  const kindOf = (m: Method): 'fileChooser' | 'dialog' =>
    (m === 'showOpenDialog' || m === 'showSaveDialog') ? 'fileChooser' : 'dialog';
  const methods: Method[] = ['showOpenDialog', 'showSaveDialog', 'showMessageBox', 'showCertificateTrustDialog'];
  for (const method of methods) {
    const original = dialog[method];
    if (typeof original !== 'function')
      continue;
    dialog[method] = function(...args: any[]) {
      const callBinding = g.__pw_dialog_call;
      if (typeof callBinding !== 'function' || !g.__pw_dialog_interceptors[kindOf(method)])
        return original.apply(dialog, args);
      const last = args.length ? args[args.length - 1] : null;
      const options = last && typeof last === 'object' ? last : {};
      const id = ++nextId;
      const promise = new Promise<any>(resolve => pending.set(id, resolve));
      callBinding(JSON.stringify({ id, method, options }));
      return promise;
    };
  }
}
