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
import './colors.css';
import './common.css';
import { applyTheme } from '@web/theme';
import { Dashboard } from './dashboard';
import { Grid } from './grid';
import { SessionModel } from './sessionModel';

applyTheme();

export function navigate(hash: string) {
  window.history.pushState(null, '', hash);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

type HashState = { guid?: string, interactive?: boolean };

function parseHash(): HashState {
  const hash = window.location.hash;
  if (!hash.startsWith('#'))
    return {};
  const result: HashState = {};
  for (const part of hash.slice(1).split('&')) {
    if (part === 'interactive') {
      result.interactive = true;
      continue;
    }
    const eq = part.indexOf('=');
    if (eq === -1)
      continue;
    const key = part.slice(0, eq);
    const value = decodeURIComponent(part.slice(eq + 1));
    if (key === 'session')
      result.guid = value;
  }
  return result;
}

const model = new SessionModel();

const App: React.FC = () => {
  const [, setRevision] = React.useState(0);
  const [hashState, setHashState] = React.useState<HashState>(parseHash);

  React.useEffect(() => {
    model.startPolling();
    const unsubscribe = model.subscribe(() => setRevision(r => r + 1));
    return () => {
      unsubscribe();
      model.stopPolling();
    };
  }, [model]);

  React.useEffect(() => {
    const onPopState = () => setHashState(parseHash());
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onPopState);
    };
  }, []);

  if (hashState.guid) {
    const wsUrl = model.sessionByGuid(hashState.guid)?.wsUrl;
    return <Dashboard key={hashState.guid} wsUrl={wsUrl || undefined} initialInteractive={hashState.interactive} />;
  }
  return <Grid model={model} />;
};

ReactDOM.createRoot(document.querySelector('#root')!).render(<App/>);
