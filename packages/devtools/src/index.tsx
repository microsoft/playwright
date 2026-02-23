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

import React from 'react';
import * as ReactDOM from 'react-dom/client';
import './common.css';
import { DevTools } from './devtools';
import { Grid } from './grid';
import { SessionModel } from './sessionModel';

export function navigate(hash: string) {
  window.history.pushState(null, '', hash);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function parseHash(): string | undefined {
  const hash = window.location.hash;
  const prefix = '#session=';
  if (hash.startsWith(prefix))
    return decodeURIComponent(hash.slice(prefix.length));
  return undefined;
}

const model = new SessionModel();

const App: React.FC = () => {
  const [, setRevision] = React.useState(0);
  const [socketPath, setSocketPath] = React.useState<string | undefined>(parseHash);

  React.useEffect(() => {
    model.startPolling();
    const unsubscribe = model.subscribe(() => setRevision(r => r + 1));
    return () => {
      unsubscribe();
      model.stopPolling();
    };
  }, [model]);

  React.useEffect(() => {
    const onPopState = () => setSocketPath(parseHash());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (socketPath) {
    const wsUrl = model.wsUrls.get(socketPath);
    if (wsUrl)
      return <DevTools wsUrl={wsUrl} />;
  }
  return <Grid model={model} />;
};

ReactDOM.createRoot(document.querySelector('#root')!).render(<App/>);
