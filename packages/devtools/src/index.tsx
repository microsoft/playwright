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

import type { SessionConfig } from '../../playwright/src/mcp/terminal/registry';

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

const DevToolsSession: React.FC<{ socketPath: string }> = ({ socketPath }) => {
  const [wsUrl, setWsUrl] = React.useState<string | undefined>();
  const [error, setError] = React.useState<string | undefined>();

  React.useEffect(() => {
    setWsUrl(undefined);
    setError(undefined);

    let cancelled = false;

    void (async () => {
      try {
        const listResp = await fetch('/api/sessions/list');
        if (!listResp.ok)
          throw new Error(`HTTP ${listResp.status}`);
        const sessions: { config: SessionConfig; canConnect: boolean }[] = await listResp.json();
        const session = sessions.find(s => s.config.socketPath === socketPath);
        if (!session)
          throw new Error('Session not found');

        const startResp = await fetch('/api/sessions/start-screencast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: session.config }),
        });
        if (!startResp.ok)
          throw new Error(`HTTP ${startResp.status}`);
        const { url } = await startResp.json();
        if (!cancelled)
          setWsUrl(url);
      } catch (e: any) {
        if (!cancelled)
          setError(e.message);
      }
    })();

    return () => { cancelled = true; };
  }, [socketPath]);

  if (error)
    return <div style={{ color: 'var(--err)', padding: 24, fontSize: 14 }}>Error: {error}</div>;
  if (!wsUrl)
    return <div style={{ color: 'var(--fg-muted)', padding: 24, fontSize: 14 }}>Connecting to session...</div>;
  return <DevTools wsUrl={wsUrl} />;
};

const App: React.FC = () => {
  const [socketPath, setSocketPath] = React.useState<string | undefined>(parseHash);

  React.useEffect(() => {
    const onPopState = () => setSocketPath(parseHash());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (socketPath)
    return <DevToolsSession socketPath={socketPath} />;
  return <Grid />;
};

ReactDOM.createRoot(document.querySelector('#root')!).render(<App/>);
