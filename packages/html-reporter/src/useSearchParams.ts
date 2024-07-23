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

import React from 'react';

export function useSearchParams() {
  const [searchParams, setSearchParams] = React.useState(getCurrentSearchParams());

  React.useEffect(() => {
    const handler = () => setSearchParams(getCurrentSearchParams());

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  return searchParams;
}

function getCurrentSearchParams() {
  return new URLSearchParams(window.location.hash.slice(1));
}
