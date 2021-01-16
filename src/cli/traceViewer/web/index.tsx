1;/**
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

import { TraceModel, VideoMetaInfo, trace } from '../traceModel';
import './common.css';
import './third_party/vscode/codicon.css';
import { Workbench } from './ui/workbench';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

declare global {
  interface Window {
    getTraceModel(): Promise<TraceModel>;
    getVideoMetaInfo(videoId: string): Promise<VideoMetaInfo | undefined>;
    readFile(filePath: string): Promise<string>;
    renderSnapshot(action: trace.ActionTraceEvent): void;
  }
}

function platformName(): string {
  if (window.navigator.userAgent.includes('Linux'))
    return 'platform-linux';
  if (window.navigator.userAgent.includes('Windows'))
    return 'platform-windows';
  if (window.navigator.userAgent.includes('Mac'))
    return 'platform-mac';
  return 'platform-generic';
}

(async () => {
  document!.defaultView!.addEventListener('focus', (event: any) => {
    if (event.target.document.nodeType === Node.DOCUMENT_NODE)
      document.body.classList.remove('inactive');
  }, false);
  document!.defaultView!.addEventListener('blur', event => {
    document.body.classList.add('inactive');
  }, false);

  document.documentElement.classList.add(platformName());

  const traceModel = await window.getTraceModel();
  ReactDOM.render(<Workbench traceModel={traceModel} />, document.querySelector('#root'));
})();
