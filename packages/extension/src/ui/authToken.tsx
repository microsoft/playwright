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

import React, { useCallback, useState } from 'react';
import { CopyToClipboard } from './copyToClipboard';
import { Button } from './tabItem';
import './authToken.css';

export const AuthTokenSection: React.FC<{}> = ({}) => {
  const [authToken, setAuthToken] = useState<string>(getOrCreateAuthToken);

  const onRegenerateToken = useCallback(() => {
    const newToken = generateAuthToken();
    localStorage.setItem('auth-token', newToken);
    setAuthToken(newToken);
  }, []);

  return (
    <div className='card'>
      <div className='card-header'>
        <h2 className='card-title'>Token</h2>
      </div>
      <div className='card-body'>
        <div className='muted'>A client that has this token connects without the connection dialog. Set this environment variable for the client:</div>
        <div className='auth-token-container'>
          <code className='auth-token-code'>{authTokenCode(authToken)}</code>
          <CopyToClipboard value={authTokenCode(authToken)} />
        </div>
      </div>
      <div className='card-footer'>
        <div className='muted'>A new token makes this one invalid. Connected clients stay connected until you disconnect them.</div>
        <Button variant='default' onClick={onRegenerateToken}>Rotate token</Button>
      </div>
    </div>
  );
};

function authTokenCode(authToken: string) {
  return `PLAYWRIGHT_MCP_EXTENSION_TOKEN=${authToken}`;
}

function generateAuthToken(): string {
  // Generate a cryptographically secure random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  // Convert to base64 and make it URL-safe
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
      .replace(/[+/=]/g, match => {
        switch (match) {
          case '+': return '-';
          case '/': return '_';
          case '=': return '';
          default: return match;
        }
      });
}

export const getOrCreateAuthToken = (): string => {
  let token = localStorage.getItem('auth-token');
  if (!token) {
    token = generateAuthToken();
    localStorage.setItem('auth-token', token);
  }
  return token;
};
