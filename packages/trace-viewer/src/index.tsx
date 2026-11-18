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

import '@web/common.css';
import { applyTheme } from '@web/theme';
import '@web/third_party/vscode/codicon.css';
import * as ReactDOM from 'react-dom/client';
import { startServiceWorker } from './ui/serviceWorker';
import { WorkbenchLoader } from './ui/workbenchLoader';
import { LiveWorkbenchLoader } from './ui/liveWorkbenchLoader';

(async () => {
  const queryParams = new URLSearchParams(window.location.search);

  applyTheme();
  if (window.location.protocol !== 'file:')
    await startServiceWorker();

  const trace = queryParams.get('trace');
  const traceIsLive = trace?.endsWith('.json');
  const workbench = traceIsLive ? <LiveWorkbenchLoader traceJson={trace!} /> : <WorkbenchLoader/>;
  ReactDOM.createRoot(document.querySelector('#root')!).render(workbench);
})();
