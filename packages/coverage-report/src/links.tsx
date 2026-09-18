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

import * as React from 'react';

// Navigation state lives in the hash, e.g. #?coverageFile=<id>, so that the
// report can be opened from a file:// url and links stay shareable.
export function useHashParams(): URLSearchParams {
  const [params, setParams] = React.useState(() => currentHashParams());
  React.useEffect(() => {
    const listener = () => setParams(currentHashParams());
    window.addEventListener('hashchange', listener);
    return () => window.removeEventListener('hashchange', listener);
  }, []);
  return params;
}

export function hashHref(params: URLSearchParams): string {
  return '#?' + params.toString();
}

function currentHashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.slice(1).replace(/^\?/, ''));
}
